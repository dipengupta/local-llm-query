from __future__ import annotations

import sqlite3
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import models
from django.db import connection, transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.socialcomm.models import Event, PointAward, Season, Team, TeamMembership


class Command(BaseCommand):
    help = "Import socialcomm data from the provided SQLite database into Postgres."

    def add_arguments(self, parser):
        parser.add_argument(
            "--sqlite-path",
            default=str(Path(__file__).resolve().parents[5] / "social-data.sqlite3"),
            help="Path to the source SQLite database.",
        )
        parser.add_argument(
            "--truncate",
            action="store_true",
            help="Delete existing imported rows before loading fresh data.",
        )

    def handle(self, *args, **options):
        sqlite_path = Path(options["sqlite_path"]).resolve()
        if not sqlite_path.exists():
            raise CommandError(f"SQLite database not found: {sqlite_path}")

        if options["truncate"]:
            self._truncate_existing_data()

        source = sqlite3.connect(sqlite_path)
        source.row_factory = sqlite3.Row

        with transaction.atomic():
            self._import_users(source)
            self._import_rows(source, "socialcomm_season", Season)
            self._import_rows(source, "socialcomm_team", Team)
            self._import_rows(source, "socialcomm_event", Event)
            self._import_rows(source, "socialcomm_teammembership", TeamMembership)
            self._import_rows(source, "socialcomm_pointaward", PointAward)
            self._reset_sequences()

        self.stdout.write(self.style.SUCCESS("Import complete."))

    def _truncate_existing_data(self) -> None:
        User = get_user_model()
        PointAward.objects.all().delete()
        TeamMembership.objects.all().delete()
        Event.objects.all().delete()
        Team.objects.all().delete()
        Season.objects.all().delete()
        User.objects.exclude(is_superuser=True).delete()

    def _import_users(self, source: sqlite3.Connection) -> None:
        User = get_user_model()
        rows = source.execute(
            """
            SELECT id, password, last_login, is_superuser, username, last_name, email,
                   is_staff, is_active, date_joined, first_name
            FROM auth_user
            ORDER BY id
            """
        ).fetchall()
        for row in rows:
            User.objects.update_or_create(
                id=row["id"],
                defaults={
                    "password": row["password"],
                    "last_login": self._normalize_datetime(row["last_login"]),
                    "is_superuser": bool(row["is_superuser"]),
                    "username": row["username"],
                    "last_name": row["last_name"],
                    "email": row["email"],
                    "is_staff": bool(row["is_staff"]),
                    "is_active": bool(row["is_active"]),
                    "date_joined": self._normalize_datetime(row["date_joined"]),
                    "first_name": row["first_name"],
                },
            )

    def _import_rows(self, source: sqlite3.Connection, table_name: str, model) -> None:
        rows = source.execute(f"SELECT * FROM {table_name} ORDER BY id").fetchall()
        fields_by_column = {field.column: field for field in model._meta.concrete_fields if field.column != "id"}
        for row in rows:
            values = {
                column: self._normalize_value(fields_by_column[column], row[column])
                for column in fields_by_column
                if column in row.keys()
            }
            model.objects.update_or_create(id=row["id"], defaults=values)

    def _reset_sequences(self) -> None:
        models = [get_user_model(), Season, Team, Event, TeamMembership, PointAward]
        statements = connection.ops.sequence_reset_sql(no_style(), models)
        with connection.cursor() as cursor:
            for statement in statements:
                cursor.execute(statement)

    def _normalize_value(self, field: models.Field, value):
        if isinstance(field, models.DateTimeField):
            return self._normalize_datetime(value)
        return value

    def _normalize_datetime(self, value):
        if value in (None, ""):
            return value
        parsed = parse_datetime(value) if isinstance(value, str) else value
        if parsed is None:
            return value
        if timezone.is_naive(parsed):
            return timezone.make_aware(parsed, timezone.get_current_timezone())
        return parsed
