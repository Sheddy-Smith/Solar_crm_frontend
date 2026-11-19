from django.core.exceptions import ValidationError as DjangoValidationError
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from .invoice_allocation_serializers import (
    InvoiceAllocationBulkCreateSerializer,
    InvoiceAllocationCreateSerializer,
    InvoiceAllocationReverseSerializer,
    InvoicePaymentAllocationSerializer,
)
from .invoice_payment_allocation import (
    legacy_payment_amount_audit,
    outstanding_invoices_for_receipt,
    payment_available_amount,
)
from .models import InvoicePaymentAllocation, Payment
from .views import AccountsBaseViewSet


def _dj_to_drf(exc: DjangoValidationError):
    if hasattr(exc, 'message_dict'):
        raise ValidationError(exc.message_dict)
    if hasattr(exc, 'messages'):
        raise ValidationError(exc.messages)
    raise ValidationError(str(exc))


class InvoicePaymentAllocationViewSet(AccountsBaseViewSet):
    serializer_class = InvoicePaymentAllocationSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['payment', 'invoice', 'status']
    search_fields = ['notes', 'reversal_reason', 'payment__reference_no', 'invoice__invoice_no']
    ordering = ['-allocated_at', '-id']

    def get_queryset(self):
        qs = InvoicePaymentAllocation.objects.select_related(
            'payment', 'invoice', 'invoice__project', 'allocated_by', 'reversed_by',
        ).all()
        params = self.request.query_params
        if params.get('payment_id'):
            qs = qs.filter(payment_id=params.get('payment_id'))
        if params.get('invoice_id'):
            qs = qs.filter(invoice_id=params.get('invoice_id'))
        if params.get('customer_id'):
            qs = qs.filter(payment__party_id=params.get('customer_id'))
        if params.get('project_id'):
            qs = qs.filter(invoice__project_id=params.get('project_id'))
        if params.get('date_from'):
            qs = qs.filter(allocated_at__date__gte=params.get('date_from'))
        if params.get('date_to'):
            qs = qs.filter(allocated_at__date__lte=params.get('date_to'))
        return qs

    def create(self, request, *args, **kwargs):
        ser = InvoiceAllocationCreateSerializer(data=request.data, context={'request': request})
        ser.is_valid(raise_exception=True)
        try:
            row = ser.save()
        except DjangoValidationError as exc:
            _dj_to_drf(exc)
        out = InvoicePaymentAllocationSerializer(row, context={'request': request})
        return Response(out.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='bulk')
    def bulk(self, request):
        ser = InvoiceAllocationBulkCreateSerializer(data=request.data, context={'request': request})
        ser.is_valid(raise_exception=True)
        try:
            rows = ser.save()
        except DjangoValidationError as exc:
            _dj_to_drf(exc)
        out = InvoicePaymentAllocationSerializer(rows, many=True, context={'request': request})
        return Response(out.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='reverse')
    def reverse(self, request, pk=None):
        allocation = self.get_object()
        ser = InvoiceAllocationReverseSerializer(
            data=request.data,
            context={'request': request, 'allocation': allocation},
        )
        ser.is_valid(raise_exception=True)
        try:
            row = ser.save()
        except DjangoValidationError as exc:
            _dj_to_drf(exc)
        out = InvoicePaymentAllocationSerializer(row, context={'request': request})
        return Response(out.data)

    @action(detail=False, methods=['get'], url_path='eligible-invoices')
    def eligible_invoices(self, request):
        party_id = request.query_params.get('customer_id') or request.query_params.get('party_id')
        if not party_id:
            raise ValidationError({'customer_id': 'Required.'})
        project_id = request.query_params.get('project_id') or None
        rows = outstanding_invoices_for_receipt(
            party_id=int(party_id),
            project_id=int(project_id) if project_id else None,
        )
        payment_id = request.query_params.get('payment_id')
        available = None
        if payment_id:
            try:
                payment = Payment.objects.get(pk=payment_id)
                available = float(payment_available_amount(payment))
            except Payment.DoesNotExist:
                available = None
        return Response({
            'invoices': rows,
            'payment_available': available,
            'count': len(rows),
        })

    @action(detail=False, methods=['get'], url_path='legacy-audit')
    def legacy_audit(self, request):
        limit = int(request.query_params.get('limit') or 500)
        return Response(legacy_payment_amount_audit(limit=limit))
