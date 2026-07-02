from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0011_rename_subcd_to_subsidy'),
    ]

    operations = [
        migrations.AddField(
            model_name='projectexpense',
            name='payment_mode',
            field=models.CharField(
                blank=True,
                choices=[
                    ('Cash', 'Cash'),
                    ('Bank Transfer', 'Bank Transfer'),
                    ('UPI', 'UPI'),
                    ('Cheque', 'Cheque'),
                    ('NEFT', 'NEFT'),
                    ('RTGS', 'RTGS'),
                ],
                default='',
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name='projectexpense',
            name='paid_by',
            field=models.CharField(blank=True, default='', max_length=200),
        ),
        migrations.AddField(
            model_name='projectexpense',
            name='status',
            field=models.CharField(
                choices=[('Pending', 'Pending'), ('Paid', 'Paid'), ('Partial', 'Partial')],
                default='Pending',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='projectexpense',
            name='remarks',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.CreateModel(
            name='ProjectExpenseDocument',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('doc_type', models.CharField(
                    choices=[('Bill', 'Bill'), ('Invoice', 'Invoice'), ('Image', 'Image'), ('Other', 'Other')],
                    default='Other',
                    max_length=20,
                )),
                ('name', models.CharField(max_length=200)),
                ('file', models.FileField(upload_to='expense_docs/%Y/%m/')),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('expense', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='expense_documents',
                    to='projects.projectexpense',
                )),
            ],
        ),
    ]
