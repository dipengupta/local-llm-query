import sqlite3
from pathlib import Path
from tempfile import TemporaryDirectory

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from apps.query_agent.sql import run_query, validate_read_only_sql
from apps.socialcomm.models import Event, PointAward, Season, Team, TeamMembership


class ImportSocialDataCommandTests(TestCase):
    def test_imports_source_sqlite_data(self):
        with TemporaryDirectory() as tmpdir:
            sqlite_path = Path(tmpdir) / "source.sqlite3"
            self._build_source_database(sqlite_path)

            call_command("import_social_data", sqlite_path=str(sqlite_path), truncate=True)

        User = get_user_model()
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(Season.objects.count(), 1)
        self.assertEqual(Team.objects.count(), 1)
        self.assertEqual(Event.objects.count(), 1)
        self.assertEqual(TeamMembership.objects.count(), 1)
        self.assertEqual(PointAward.objects.count(), 1)

        membership = TeamMembership.objects.select_related("user", "team").get()
        self.assertEqual(membership.user.username, "mike")
        self.assertEqual(membership.team.name, "CTRL ALT ELITE")

    def _build_source_database(self, sqlite_path: Path) -> None:
        connection = sqlite3.connect(sqlite_path)
        cursor = connection.cursor()
        cursor.executescript(
            """
            CREATE TABLE auth_user (
                id integer NOT NULL PRIMARY KEY,
                password varchar(128) NOT NULL,
                last_login datetime NULL,
                is_superuser bool NOT NULL,
                username varchar(150) NOT NULL UNIQUE,
                last_name varchar(150) NOT NULL,
                email varchar(254) NOT NULL,
                is_staff bool NOT NULL,
                is_active bool NOT NULL,
                date_joined datetime NOT NULL,
                first_name varchar(150) NOT NULL
            );
            CREATE TABLE socialcomm_season (
                id integer NOT NULL PRIMARY KEY,
                year integer NOT NULL UNIQUE,
                start_date date NOT NULL,
                end_date date NOT NULL
            );
            CREATE TABLE socialcomm_team (
                id integer NOT NULL PRIMARY KEY,
                name varchar(100) NOT NULL,
                theme_color varchar(32) NOT NULL,
                is_active bool NOT NULL,
                season_id bigint NOT NULL
            );
            CREATE TABLE socialcomm_event (
                id integer NOT NULL PRIMARY KEY,
                title varchar(200) NOT NULL,
                description text NOT NULL,
                start_at datetime NOT NULL,
                end_at datetime NULL,
                location varchar(200) NOT NULL,
                season_id bigint NOT NULL
            );
            CREATE TABLE socialcomm_teammembership (
                id integer NOT NULL PRIMARY KEY,
                start_date date NOT NULL,
                end_date date NULL,
                team_id bigint NOT NULL,
                user_id integer NOT NULL
            );
            CREATE TABLE socialcomm_pointaward (
                id integer NOT NULL PRIMARY KEY,
                amount integer NOT NULL,
                awarded_at datetime NOT NULL,
                comment varchar(255) NOT NULL,
                awarded_by_id integer NULL,
                awarded_to_user_id integer NULL,
                awarded_to_team_id bigint NULL,
                event_id bigint NOT NULL
            );
            """
        )
        cursor.execute(
            """
            INSERT INTO auth_user (
                id, password, last_login, is_superuser, username, last_name, email,
                is_staff, is_active, date_joined, first_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (1, "pbkdf2_sha256$example", None, 0, "mike", "Jones", "mike@example.com", 0, 1, "2026-01-01 10:00:00", "Mike"),
        )
        cursor.execute(
            "INSERT INTO socialcomm_season (id, year, start_date, end_date) VALUES (?, ?, ?, ?)",
            (3, 2026, "2026-01-01", "2026-12-31"),
        )
        cursor.execute(
            "INSERT INTO socialcomm_team (id, name, theme_color, is_active, season_id) VALUES (?, ?, ?, ?, ?)",
            (12, "CTRL ALT ELITE", "", 1, 3),
        )
        cursor.execute(
            """
            INSERT INTO socialcomm_event (id, title, description, start_at, end_at, location, season_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (7, "Mike Games", "Games event", "2026-01-23 11:00:00", "2026-01-23 13:00:00", "Training Room", 3),
        )
        cursor.execute(
            "INSERT INTO socialcomm_teammembership (id, start_date, end_date, team_id, user_id) VALUES (?, ?, ?, ?, ?)",
            (70, "2026-01-02", None, 12, 1),
        )
        cursor.execute(
            """
            INSERT INTO socialcomm_pointaward (
                id, amount, awarded_at, comment, awarded_by_id, awarded_to_user_id, awarded_to_team_id, event_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (8, 3405, "2026-01-23 14:00:00", "", None, None, 12, 7),
        )
        connection.commit()
        connection.close()


class BundledSocialDataIntegrationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.sqlite_path = Path(__file__).resolve().parents[2] / "social-data.sqlite3"
        call_command("import_social_data", sqlite_path=str(cls.sqlite_path), truncate=True)

    def test_imports_bundled_social_data_fixture(self):
        User = get_user_model()

        self.assertEqual(User.objects.count(), 42)
        self.assertEqual(Team.objects.count(), 16)
        self.assertEqual(PointAward.objects.count(), 101)
        self.assertTrue(Team.objects.filter(name="CTRL ALT ELITE").exists())

    def test_query_returns_rows_from_imported_data(self):
        sql = validate_read_only_sql(
            """
            SELECT t.name, SUM(pa.amount) AS total_points
            FROM socialcomm_team t
            JOIN socialcomm_pointaward pa ON pa.awarded_to_team_id = t.id
            GROUP BY t.id, t.name
            ORDER BY total_points DESC, t.id ASC
            LIMIT 5
            """
        )

        columns, rows = run_query(sql)

        self.assertEqual(columns, ["name", "total_points"])
        self.assertGreater(len(rows), 0)
        self.assertIsInstance(rows[0]["name"], str)
        self.assertGreater(rows[0]["total_points"], 0)
