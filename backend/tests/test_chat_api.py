from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.query_agent.service import QueryAgentError


class ChatApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    @patch("apps.chat.views.OpenAICompatibleChatClient.complete_chat", return_value="Hello from the local model.")
    def test_general_chat_endpoint(self, mocked_complete_chat):
        response = self.client.post(
            "/api/chat/general/",
            {"messages": [{"role": "user", "content": "Hello"}]},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["answer"], "Hello from the local model.")
        mocked_complete_chat.assert_called_once()

    @patch(
        "apps.chat.views.QueryAgentService.answer_question",
        return_value={
            "answer": "CTRL ALT ELITE has 3405 points.",
            "raw_sql": "SELECT name, 3405 AS points FROM socialcomm_team LIMIT 1;",
            "sql": "SELECT name, 3405 AS points FROM socialcomm_team LIMIT 1",
            "columns": ["name", "points"],
            "rows": [{"name": "CTRL ALT ELITE", "points": 3405}],
        },
    )
    def test_query_chat_endpoint(self, mocked_answer_question):
        response = self.client.post("/api/chat/query/", {"question": "Who has 3405 points?"}, format="json")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("answer", payload)
        self.assertIn("raw_sql", payload)
        self.assertIn("sql", payload)
        self.assertEqual(payload["rows"][0]["points"], 3405)
        mocked_answer_question.assert_called_once_with("Who has 3405 points?")

    @patch(
        "apps.chat.views.QueryAgentService.answer_question",
        side_effect=QueryAgentError(
            "Only single-statement SQL is allowed.",
            raw_sql="SELECT COUNT(*) FROM socialcomm_event;",
        ),
    )
    def test_query_chat_endpoint_returns_raw_sql_on_validation_error(self, mocked_answer_question):
        response = self.client.post("/api/chat/query/", {"question": "How many events have happened?"}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Only single-statement SQL is allowed.")
        self.assertEqual(response.json()["sql"], "SELECT COUNT(*) FROM socialcomm_event;")
        mocked_answer_question.assert_called_once_with("How many events have happened?")


@override_settings(UI_E2E_TEST_MODE=True)
class ChatApiE2EModeTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_general_chat_endpoint_returns_deterministic_response(self):
        response = self.client.post(
            "/api/chat/general/",
            {"messages": [{"role": "user", "content": "Hello from Playwright"}]},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"answer": "Test reply: Hello from Playwright"})

    def test_query_chat_endpoint_returns_deterministic_response(self):
        response = self.client.post(
            "/api/chat/query/",
            {"question": "Count all records"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["answer"], "Deterministic query answer for: Count all records")
        self.assertEqual(payload["rows"][0]["question"], "Count all records")
        self.assertEqual(payload["columns"], ["question", "length"])

    def test_query_chat_endpoint_can_force_error(self):
        response = self.client.post(
            "/api/chat/query/",
            {"question": "trigger query error"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Playwright forced query error.")
