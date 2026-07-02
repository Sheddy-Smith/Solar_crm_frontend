from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0010_add_sub_cd_models'),
    ]

    operations = [
        migrations.RenameModel(
            old_name='SubCDApplication',
            new_name='SubsidyApplication',
        ),
        migrations.RenameModel(
            old_name='SubCDDocument',
            new_name='SubsidyDocument',
        ),
        migrations.RenameField(
            model_name='subsidydocument',
            old_name='sub_cd',
            new_name='subsidy',
        ),
    ]
