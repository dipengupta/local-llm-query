from django.test import SimpleTestCase, override_settings

from apps.query_agent.sql import QueryValidationError, validate_read_only_sql


@override_settings(QUERY_AGENT_MAX_ROWS=25)
class QueryValidationTests(SimpleTestCase):
    def test_accepts_allowlisted_select(self):
        sql = "SELECT id, username FROM auth_user LIMIT 10"
        self.assertEqual(validate_read_only_sql(sql), sql)

    def test_rejects_write_queries(self):
        with self.assertRaises(QueryValidationError):
            validate_read_only_sql("UPDATE auth_user SET is_active = false")

    def test_rejects_disallowed_tables(self):
        with self.assertRaises(QueryValidationError):
            validate_read_only_sql("SELECT * FROM django_session")

    def test_accepts_cte_that_reads_allowlisted_tables(self):
        sql = """
        WITH totals AS (
            SELECT season_id, COUNT(*) AS team_count
            FROM socialcomm_team
            GROUP BY season_id
        )
        SELECT * FROM totals
        """
        self.assertIn("WITH totals", validate_read_only_sql(sql))

    def test_accepts_single_statement_with_trailing_semicolon(self):
        sql = "SELECT COUNT(*) FROM socialcomm_event;"
        self.assertEqual(validate_read_only_sql(sql), "SELECT COUNT(*) FROM socialcomm_event")

    def test_accepts_sql_code_fence_output(self):
        sql = """
        ```sql
        SELECT COUNT(*) FROM socialcomm_event;
        ```
        """
        self.assertEqual(validate_read_only_sql(sql), "SELECT COUNT(*) FROM socialcomm_event")
