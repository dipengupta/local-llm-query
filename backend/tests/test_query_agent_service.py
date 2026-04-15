from unittest.mock import Mock, patch

from django.db import DatabaseError
from django.test import SimpleTestCase

from apps.query_agent.service import QueryAgentError, QueryAgentService


class QueryAgentServiceTests(SimpleTestCase):
    @patch("apps.query_agent.service.run_query", side_effect=DatabaseError('syntax error at or near "LIMIT"'))
    @patch("apps.query_agent.service.validate_read_only_sql", return_value="SELECT * FROM socialcomm_event LIMIT 100")
    def test_wraps_database_execution_errors_as_query_agent_errors(self, mocked_validate_sql, mocked_run_query):
        client = Mock()
        client.complete_chat.return_value = "SELECT * FROM socialcomm_event"

        service = QueryAgentService(client)

        with self.assertRaises(QueryAgentError) as exc_info:
            service.answer_question("Show events")

        self.assertEqual(
            str(exc_info.exception),
            'The generated SQL failed to execute: syntax error at or near "LIMIT"',
        )
        self.assertEqual(exc_info.exception.raw_sql, "SELECT * FROM socialcomm_event LIMIT 100")
        mocked_validate_sql.assert_called_once_with("SELECT * FROM socialcomm_event")
        mocked_run_query.assert_called_once_with("SELECT * FROM socialcomm_event LIMIT 100")
