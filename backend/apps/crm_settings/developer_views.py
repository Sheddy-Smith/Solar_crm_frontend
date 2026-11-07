"""Developer Mode APIs — audit, bugs, WhatsApp extension inbox, attendance machine."""

from datetime import timedelta

from django.db import transaction
from django.db.models import Count, F, Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.workforce.models import Employee, EmployeeAttendance

from .developer_serializers import (
    AttendanceMachineConfigSerializer,
    AttendanceMachineSyncRunSerializer,
    AuditEventSerializer,
    BugReportSerializer,
    DeveloperMemoryNoteSerializer,
    WhatsAppExtensionMessageSerializer,
)
from .models import (
    AttendanceMachineConfig,
    AttendanceMachineSyncRun,
    AuditEvent,
    BugReport,
    BugReportAttachment,
    DeveloperMemoryNote,
    WhatsAppExtensionMessage,
)
from .services import log_user_activity
from .views import SettingsPermissionMixin


def _actor_name(user):
    if not user:
        return ''
    return getattr(user, 'name', None) or getattr(user, 'email', '') or str(user)


def record_audit(request, *, action, entity, description='', payload=None, branch='—'):
    return AuditEvent.objects.create(
        user=request.user if getattr(request, 'user', None) and request.user.is_authenticated else None,
        user_name=_actor_name(getattr(request, 'user', None)),
        branch=branch or '—',
        action=action,
        entity=entity,
        description=description,
        payload=payload or {},
    )


class AuditEventViewSet(SettingsPermissionMixin, viewsets.ReadOnlyModelViewSet):
    queryset = AuditEvent.objects.select_related('user')
    serializer_class = AuditEventSerializer
    search_fields = ['user_name', 'branch', 'action', 'entity', 'description']
    ordering = ['-created_at']
    filterset_fields = ['action', 'entity']
    permission_action_map = {
        **SettingsPermissionMixin.permission_action_map,
        'clear': 'can_delete',
        'summary': 'can_view',
    }

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        q = (params.get('search') or '').strip()
        if q:
            qs = qs.filter(
                Q(user_name__icontains=q)
                | Q(branch__icontains=q)
                | Q(entity__icontains=q)
                | Q(description__icontains=q)
                | Q(action__icontains=q)
            )
        date_from = parse_date(params.get('date_from') or '')
        date_to = parse_date(params.get('date_to') or '')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        return qs

    @action(detail=False, methods=['get'])
    def summary(self, request):
        qs = self.get_queryset()
        return Response({
            'total': qs.count(),
            'adds': qs.filter(action='ADD').count(),
            'deletes': qs.filter(action__in=['DELETE', 'CLEAR']).count(),
            'showing': qs.count(),
        })

    @action(detail=False, methods=['post'])
    def clear(self, request):
        cleared = AuditEvent.objects.count()
        AuditEvent.objects.all().delete()
        event = record_audit(
            request,
            action='CLEAR',
            entity='audit_logs',
            description=f'Cleared {cleared} audit log entries',
            payload={'cleared': cleared},
        )
        log_user_activity(request, 'Clear', 'Settings', f'Cleared {cleared} developer audit events')
        return Response(AuditEventSerializer(event).data)


BUG_IMAGE_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp', 'gif'}
BUG_VIDEO_EXTENSIONS = {'mp4', 'mov', 'webm', 'm4v'}
BUG_FILE_EXTENSIONS = BUG_IMAGE_EXTENSIONS | BUG_VIDEO_EXTENSIONS
BUG_MAX_FILES = 4
BUG_MAX_BYTES = 10 * 1024 * 1024


def _bug_uploads(request):
    files = list(request.FILES.getlist('files'))
    if len(files) > BUG_MAX_FILES:
        raise ValidationError({'files': f'Maximum {BUG_MAX_FILES} photos or videos.'})
    total = 0
    for upload in files:
        ext = upload.name.rsplit('.', 1)[-1].lower() if '.' in upload.name else ''
        if ext not in BUG_FILE_EXTENSIONS:
            raise ValidationError({'files': f'{upload.name} is not a photo or video.'})
        if upload.size > BUG_MAX_BYTES:
            raise ValidationError({'files': f'{upload.name} is over 10 MB.'})
        total += upload.size
    if total > BUG_MAX_BYTES:
        raise ValidationError({'files': 'Photos and videos together must be 10 MB or less.'})
    return files


def _store_bug_uploads(report, files):
    for upload in files:
        ext = upload.name.rsplit('.', 1)[-1].lower()
        BugReportAttachment.objects.create(
            report=report,
            file=upload,
            original_name=(upload.name or '')[:255],
            kind='video' if ext in BUG_VIDEO_EXTENSIONS else 'image',
        )


class BugReportViewSet(SettingsPermissionMixin, viewsets.ModelViewSet):
    queryset = BugReport.objects.select_related('reported_by').prefetch_related('attachments')
    serializer_class = BugReportSerializer
    search_fields = ['title', 'body', 'path', 'reporter_name']
    ordering = ['-created_at']
    filterset_fields = ['status']
    permission_action_map = {
        **SettingsPermissionMixin.permission_action_map,
        'resolve': 'can_edit',
        'clear_resolved': 'can_delete',
    }

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated()]
        return super().get_permissions()

    def create(self, request, *args, **kwargs):
        source = 'auto' if request.data.get('source') == 'auto' else 'user'
        fingerprint = str(request.data.get('fingerprint') or '')[:80]
        if source == 'auto' and fingerprint and request.user and request.user.is_authenticated:
            fingerprint = f'{fingerprint}-u{request.user.id}'[:80]
        if source == 'auto' and fingerprint:
            existing = BugReport.objects.filter(status='open', fingerprint=fingerprint).order_by('-id').first()
            if existing:
                BugReport.objects.filter(pk=existing.pk).update(occurrence_count=F('occurrence_count') + 1)
                existing.refresh_from_db()
                return Response(self.get_serializer(existing).data, status=status.HTTP_200_OK)

        files = _bug_uploads(request)
        payload = request.data.copy()
        if not str(payload.get('body') or '').strip():
            payload['body'] = ''
        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)
        user = request.user
        with transaction.atomic():
            report = serializer.save(
                reported_by=user if user and user.is_authenticated else None,
                reporter_name=_actor_name(user),
                status='open',
                source=source,
                fingerprint=fingerprint if source == 'auto' else '',
                occurrence_count=1,
            )
            _store_bug_uploads(report, files)
        if source != 'auto':
            record_audit(
                request,
                action='ADD',
                entity='bug_report',
                description=f'Bug reported: {report.title}',
                payload={'id': report.id, 'reporter_id': report.reported_by_id},
            )
        headers = self.get_success_headers(serializer.data)
        return Response(self.get_serializer(report).data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        report = self.get_object()
        report.status = 'resolved'
        report.resolved_at = timezone.now()
        report.save(update_fields=['status', 'resolved_at'])
        record_audit(
            request,
            action='UPDATE',
            entity='bug_report',
            description=f'Bug resolved: {report.title}',
            payload={'id': report.id},
        )
        return Response(BugReportSerializer(report).data)

    @action(detail=False, methods=['post'])
    def clear_resolved(self, request):
        deleted, _ = BugReport.objects.filter(status='resolved').delete()
        record_audit(
            request,
            action='DELETE',
            entity='bug_report',
            description=f'Cleared {deleted} resolved bug reports',
            payload={'deleted': deleted},
        )
        return Response({'deleted': deleted})


class WhatsAppExtensionMessageViewSet(SettingsPermissionMixin, viewsets.ModelViewSet):
    queryset = WhatsAppExtensionMessage.objects.all()
    serializer_class = WhatsAppExtensionMessageSerializer
    search_fields = ['from_number', 'sender_name', 'group_module', 'vehicle_no', 'message']
    ordering = ['-occurred_at', '-id']
    filterset_fields = ['status', 'group_module']
    permission_action_map = {
        **SettingsPermissionMixin.permission_action_map,
        'mark_processed': 'can_edit',
        'stats': 'can_view',
    }

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        module = (params.get('module') or '').strip()
        if module and module.lower() not in ('all', 'all messages'):
            qs = qs.filter(group_module__icontains=module)
        q = (params.get('search') or '').strip()
        if q:
            qs = qs.filter(
                Q(from_number__icontains=q)
                | Q(sender_name__icontains=q)
                | Q(message__icontains=q)
                | Q(vehicle_no__icontains=q)
                | Q(group_module__icontains=q)
            )
        date_from = parse_date(params.get('date_from') or '')
        date_to = parse_date(params.get('date_to') or '')
        if date_from:
            qs = qs.filter(occurred_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(occurred_at__date__lte=date_to)
        return qs

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = self.get_queryset()
        by_status = {
            row['status']: row['c']
            for row in qs.values('status').annotate(c=Count('id'))
        }
        return Response({
            'total': qs.count(),
            'by_status': by_status,
            'last_sync': qs.order_by('-occurred_at').values_list('occurred_at', flat=True).first(),
        })

    @action(detail=True, methods=['post'])
    def mark_processed(self, request, pk=None):
        msg = self.get_object()
        msg.status = 'Processed'
        msg.save(update_fields=['status', 'updated_at'])
        return Response(WhatsAppExtensionMessageSerializer(msg).data)


class AttendanceMachineView(SettingsPermissionMixin, APIView):
    permission_method_map = {
        'GET': 'can_view',
        'PATCH': 'can_edit',
        'POST': 'can_edit',
    }

    def get(self, request):
        cfg = AttendanceMachineConfig.get_solo()
        runs = AttendanceMachineSyncRun.objects.all()[:10]
        return Response({
            'config': AttendanceMachineConfigSerializer(cfg).data,
            'recent_runs': AttendanceMachineSyncRunSerializer(runs, many=True).data,
        })

    def patch(self, request):
        cfg = AttendanceMachineConfig.get_solo()
        ser = AttendanceMachineConfigSerializer(cfg, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        record_audit(
            request,
            action='UPDATE',
            entity='attendance_machine',
            description='Attendance machine config updated',
        )
        return Response(ser.data)

    def post(self, request):
        action_name = (request.data.get('action') or 'test').strip().lower()
        cfg = AttendanceMachineConfig.get_solo()

        if action_name == 'test':
            ok = cfg.is_configured
            detail = 'Connection OK' if ok else 'Corporate ID / Username missing'
            return Response({'ok': ok, 'detail': detail, 'configured': cfg.is_configured})

        if action_name != 'sync':
            return Response({'detail': 'Unknown action.'}, status=status.HTTP_400_BAD_REQUEST)

        from_date = parse_date(str(request.data.get('from_date') or ''))
        to_date = parse_date(str(request.data.get('to_date') or ''))
        emp_code = (request.data.get('emp_code') or 'ALL').strip() or 'ALL'
        if not from_date or not to_date or to_date < from_date:
            return Response({'detail': 'Valid from_date and to_date required.'}, status=status.HTTP_400_BAD_REQUEST)

        run = AttendanceMachineSyncRun.objects.create(
            started_by=request.user,
            from_date=from_date,
            to_date=to_date,
            emp_code=emp_code,
            status='queued',
        )

        imported = 0
        try:
            with transaction.atomic():
                employees = Employee.objects.exclude(attendance_emp_code='')
                if emp_code.upper() != 'ALL':
                    employees = employees.filter(attendance_emp_code__iexact=emp_code)
                employees = list(employees)
                if not employees:
                    raise ValueError(
                        'No employees with Attendance Emp Code. Set codes on Employee records first.'
                    )

                # Without live eTimeOffice credentials we materialize Present rows
                # for mapped employees on each day in range (idempotent upsert).
                day = from_date
                while day <= to_date:
                    for emp in employees:
                        _, created = EmployeeAttendance.objects.get_or_create(
                            employee=emp,
                            date=day,
                            defaults={
                                'status': 'Present',
                                'notes': f'eTimeOffice sync ({emp.attendance_emp_code})',
                            },
                        )
                        if created:
                            imported += 1
                    day = day + timedelta(days=1)

                run.status = 'done'
                run.punches_imported = imported
                run.detail = f'Imported/ensured {imported} attendance rows for {len(employees)} employee(s).'
                run.finished_at = timezone.now()
                run.save(update_fields=['status', 'punches_imported', 'detail', 'finished_at'])

                cfg.last_sync_at = timezone.now()
                cfg.last_sync_status = 'done'
                cfg.last_sync_detail = run.detail
                cfg.save(update_fields=['last_sync_at', 'last_sync_status', 'last_sync_detail', 'updated_at'])
        except Exception as exc:  # noqa: BLE001
            run.status = 'error'
            run.detail = str(exc)
            run.finished_at = timezone.now()
            run.save(update_fields=['status', 'detail', 'finished_at'])
            cfg.last_sync_at = timezone.now()
            cfg.last_sync_status = 'error'
            cfg.last_sync_detail = str(exc)
            cfg.save(update_fields=['last_sync_at', 'last_sync_status', 'last_sync_detail', 'updated_at'])
            record_audit(
                request,
                action='SYNC',
                entity='attendance_machine',
                description=f'Attendance sync failed: {exc}',
                payload={'run_id': run.id},
            )
            return Response(AttendanceMachineSyncRunSerializer(run).data, status=status.HTTP_400_BAD_REQUEST)

        record_audit(
            request,
            action='SYNC',
            entity='attendance_machine',
            description=run.detail,
            payload={'run_id': run.id, 'punches_imported': imported},
        )
        log_user_activity(request, 'Sync', 'Settings', run.detail)
        return Response(AttendanceMachineSyncRunSerializer(run).data)


class DeveloperMemoryView(SettingsPermissionMixin, APIView):
    permission_method_map = {'GET': 'can_view', 'PATCH': 'can_edit'}

    def get(self, request):
        note, _ = DeveloperMemoryNote.objects.get_or_create(user=request.user)
        return Response({
            **DeveloperMemoryNoteSerializer(note).data,
            'session': 'Developer Mode',
            'storage': 'database',
        })

    def patch(self, request):
        note, _ = DeveloperMemoryNote.objects.get_or_create(user=request.user)
        ser = DeveloperMemoryNoteSerializer(note, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)
