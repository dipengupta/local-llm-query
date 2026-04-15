import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Conversation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("mode", models.CharField(choices=[("general", "General"), ("query", "Query Agent")], max_length=16)),
                ("title", models.CharField(max_length=80)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "chat_conversation",
                "ordering": ["-updated_at", "-id"],
            },
        ),
        migrations.CreateModel(
            name="ConversationTurn",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("question", models.TextField()),
                ("answer", models.TextField()),
                ("raw_sql", models.TextField(blank=True)),
                ("sql", models.TextField(blank=True)),
                ("rows", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "conversation",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="turns",
                        to="chat.conversation",
                    ),
                ),
            ],
            options={
                "db_table": "chat_conversationturn",
                "ordering": ["created_at", "id"],
            },
        ),
    ]
