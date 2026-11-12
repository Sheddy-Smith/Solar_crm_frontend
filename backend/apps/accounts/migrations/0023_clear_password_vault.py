"""Destructive security migration: wipe + drop recoverable password_vault.

Forward-only by design. Reverse recreates an empty TextField but CANNOT restore
cleared ciphertext. Prefer rolling forward with a corrected release rather than
migrating backward expecting vault recovery.
"""
from django.db import migrations


def clear_vault(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    User.objects.exclude(password_vault='').update(password_vault='')


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0022_user_password_vault'),
    ]

    operations = [
        # reverse_code=noop: schema may come back empty; vault data is gone.
        migrations.RunPython(clear_vault, reverse_code=migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='user',
            name='password_vault',
        ),
    ]
