from django.db import migrations


def clear_vault(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    User.objects.exclude(password_vault='').update(password_vault='')


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0022_user_password_vault'),
    ]

    operations = [
        migrations.RunPython(clear_vault, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='user',
            name='password_vault',
        ),
    ]
