from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.SerializerMethodField()
    plant_code = serializers.SerializerMethodField()

    def get_is_read(self, obj):
        read_ids = self.context.get('read_ids')
        if read_ids is not None:
            return obj.id in read_ids
        request = self.context.get('request')
        return bool(request and obj.read_by.filter(pk=request.user.pk).exists())

    def get_plant_code(self, obj):
        return obj.plant.plant_code if obj.plant_id else ''

    class Meta:
        model = Notification
        fields = [
            'id', 'category', 'severity', 'title', 'message', 'link', 'plant', 'plant_code',
            'module', 'channel', 'is_read', 'created_at',
        ]
