import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Season",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("year", models.IntegerField(unique=True)),
                ("start_date", models.DateField()),
                ("end_date", models.DateField()),
            ],
            options={
                "db_table": "socialcomm_season",
                "ordering": ["year"],
            },
        ),
        migrations.CreateModel(
            name="Event",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True)),
                ("start_at", models.DateTimeField()),
                ("end_at", models.DateTimeField(blank=True, null=True)),
                ("location", models.CharField(blank=True, max_length=200)),
                (
                    "season",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="events", to="socialcomm.season"),
                ),
            ],
            options={
                "db_table": "socialcomm_event",
                "ordering": ["start_at", "title"],
            },
        ),
        migrations.CreateModel(
            name="Team",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100)),
                ("theme_color", models.CharField(blank=True, max_length=32)),
                ("is_active", models.BooleanField(default=True)),
                (
                    "season",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="teams", to="socialcomm.season"),
                ),
            ],
            options={
                "db_table": "socialcomm_team",
                "ordering": ["season__year", "name"],
            },
        ),
        migrations.CreateModel(
            name="TeamMembership",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("start_date", models.DateField()),
                ("end_date", models.DateField(blank=True, null=True)),
                (
                    "team",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="memberships", to="socialcomm.team"),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="team_memberships",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "socialcomm_teammembership",
                "ordering": ["team__name", "user__username", "start_date"],
            },
        ),
        migrations.CreateModel(
            name="PointAward",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("amount", models.IntegerField()),
                ("awarded_at", models.DateTimeField()),
                ("comment", models.CharField(blank=True, max_length=255)),
                (
                    "awarded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="awards_given",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "awarded_to_team",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="awards_received",
                        to="socialcomm.team",
                    ),
                ),
                (
                    "awarded_to_user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="awards_received",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "event",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="point_awards", to="socialcomm.event"),
                ),
            ],
            options={
                "db_table": "socialcomm_pointaward",
                "ordering": ["-awarded_at", "-id"],
            },
        ),
        migrations.AddConstraint(
            model_name="team",
            constraint=models.UniqueConstraint(fields=("season", "name"), name="uniq_team_season_name"),
        ),
        migrations.AddConstraint(
            model_name="teammembership",
            constraint=models.UniqueConstraint(fields=("user", "team", "start_date"), name="uniq_membership_user_team_start"),
        ),
        migrations.AddConstraint(
            model_name="pointaward",
            constraint=models.CheckConstraint(
                condition=(
                    (
                        models.Q(awarded_to_user__isnull=False)
                        & models.Q(awarded_to_team__isnull=True)
                    )
                    | (
                        models.Q(awarded_to_user__isnull=True)
                        & models.Q(awarded_to_team__isnull=False)
                    )
                ),
                name="pointaward_xor_user_team",
            ),
        ),
    ]
