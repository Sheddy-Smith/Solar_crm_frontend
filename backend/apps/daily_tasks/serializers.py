from rest_framework import serializers

from .models import DailyTask, StaffDailyTask


CATEGORY_LABELS = dict(DailyTask.CATEGORY_CHOICES)


class DailyTaskSerializer(serializers.ModelSerializer):
    category_label = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = DailyTask
        fields = [
            'id', 'category', 'category_label', 'task_date', 'status', 'notes',
            'details', 'summary_text', 'assigned_to', 'assigned_to_name',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'summary_text', 'created_by', 'created_by_name',
            'assigned_to_name', 'created_at', 'updated_at',
        ]

    def get_category_label(self, obj):
        return CATEGORY_LABELS.get(obj.category, obj.category)

    def get_created_by_name(self, obj):
        return getattr(obj.created_by, 'name', '') if obj.created_by_id else ''

    def get_assigned_to_name(self, obj):
        return getattr(obj.assigned_to, 'name', '') if obj.assigned_to_id else ''

    def validate_details(self, value):
        return value if isinstance(value, dict) else {}

    def validate_assigned_to(self, value):
        if value and value.status == 'On Leave':
            raise serializers.ValidationError('Selected employee is on leave.')
        return value

    def validate(self, attrs):
        category = attrs.get('category') or getattr(self.instance, 'category', None)
        details = attrs.get('details')
        if details is None and self.instance:
            details = self.instance.details or {}
        details = details or {}
        errors = {}

        if category == 'site_visit_log':
            if not (details.get('survey_findings') or '').strip():
                errors['details'] = 'Survey findings are required.'
            if not details.get('project_id') and not details.get('lead_id') and not (details.get('site_location') or '').strip():
                errors['details'] = 'Select a project or lead, or enter site location.'
        elif category == 'installation_progress':
            if not details.get('project_id'):
                errors['details'] = 'Project is required.'
            if not (details.get('work_done') or '').strip():
                errors['details'] = 'Work done today is required.'
        elif category == 'material_dispatch':
            if not details.get('project_id'):
                errors['details'] = 'Project is required.'
            if not (details.get('items_dispatched') or '').strip():
                errors['details'] = 'Items dispatched are required.'
        elif category == 'stock_check':
            if not details.get('warehouse_id'):
                errors['details'] = 'Warehouse is required.'
            if not (details.get('checked_items') or '').strip():
                errors['details'] = 'Checked items are required.'

        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        return super().create(validated_data)


class StaffDailyTaskSerializer(serializers.ModelSerializer):
    assigned_by_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()
    assigned_to_user_id = serializers.IntegerField(source='assigned_to_id', read_only=True)
    branch_name = serializers.SerializerMethodField()
    can_update_status = serializers.SerializerMethodField()

    class Meta:
        model = StaffDailyTask
        fields = [
            'id', 'title', 'description',
            'assigned_by', 'assigned_by_name',
            'assigned_to', 'assigned_to_name', 'assigned_to_user_id',
            'branch', 'branch_name',
            'task_date', 'due_date', 'status',
            'created_at', 'updated_at', 'can_update_status',
        ]
        read_only_fields = [
            'assigned_by', 'assigned_by_name', 'assigned_to_name',
            'assigned_to_user_id', 'branch', 'branch_name',
            'created_at', 'updated_at', 'can_update_status',
        ]

    def get_assigned_by_name(self, obj):
        from apps.accounts.models import User
        return User.public_display_name(obj.assigned_by) if obj.assigned_by_id else ''

    def get_assigned_to_name(self, obj):
        from apps.accounts.models import User
        return User.public_display_name(obj.assigned_to) if obj.assigned_to_id else ''

    def get_branch_name(self, obj):
        return getattr(obj.branch, 'name', '') if obj.branch_id else ''

    def get_can_update_status(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        from .access import can_update_staff_task_status
        return can_update_staff_task_status(user, obj)

    def validate_status(self, value):
        allowed = {StaffDailyTask.STATUS_COMPLETED, StaffDailyTask.STATUS_NOT_COMPLETED}
        if value not in allowed:
            raise serializers.ValidationError('Status must be Completed or Not Completed.')
        return value

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['assigned_by'] = request.user
            assignee = validated_data.get('assigned_to')
            if assignee and assignee.branch_id:
                validated_data['branch'] = assignee.branch
            elif request.user.branch_id:
                validated_data['branch'] = request.user.branch
        return super().create(validated_data)
