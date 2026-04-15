from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.chat.models import Conversation, ConversationTurn
from apps.query_agent.service import QueryAgentError


class ChatApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    @patch("apps.chat.views.OpenAICompatibleChatClient.complete_chat", return_value="Hello from the local model.")
    def test_general_chat_endpoint(self, mocked_complete_chat):
        response = self.client.post(
            "/api/chat/general/",
            {"question": "Hello"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["answer"], "Hello from the local model.")
        self.assertIn("conversation_id", response.json())
        turn = ConversationTurn.objects.get()
        self.assertEqual(turn.question, "Hello")
        self.assertEqual(turn.answer, "Hello from the local model.")
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
        self.assertIn("conversation_id", payload)
        self.assertEqual(payload["rows"][0]["points"], 3405)
        turn = ConversationTurn.objects.get()
        self.assertEqual(turn.raw_sql, "SELECT name, 3405 AS points FROM socialcomm_team LIMIT 1;")
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

    @patch("apps.chat.views.OpenAICompatibleChatClient.complete_chat", side_effect=["First answer", "Second answer"])
    def test_general_chat_endpoint_appends_to_existing_conversation(self, mocked_complete_chat):
        first_response = self.client.post("/api/chat/general/", {"question": "First question"}, format="json")
        conversation_id = first_response.json()["conversation_id"]

        second_response = self.client.post(
            "/api/chat/general/",
            {"question": "Second question", "conversation_id": conversation_id},
            format="json",
        )

        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(Conversation.objects.count(), 1)
        self.assertEqual(ConversationTurn.objects.count(), 2)
        self.assertEqual(
            mocked_complete_chat.call_args_list[1].args[0],
            [
                {"role": "system", "content": "You are the General assistant for a local web app. Be concise, helpful, and honest about what you do not know. Answer directly without long hidden reasoning."},
                {"role": "user", "content": "First question"},
                {"role": "assistant", "content": "First answer"},
                {"role": "user", "content": "Second question"},
            ],
        )

    @patch(
        "apps.chat.views.QueryAgentService.answer_question",
        side_effect=[
            {
                "answer": "First answer",
                "raw_sql": "SELECT 1",
                "sql": "SELECT 1",
                "columns": ["value"],
                "rows": [{"value": 1}],
            },
            {
                "answer": "Second answer",
                "raw_sql": "SELECT 2",
                "sql": "SELECT 2",
                "columns": ["value"],
                "rows": [{"value": 2}],
            },
        ],
    )
    def test_query_chat_endpoint_appends_to_existing_conversation(self, mocked_answer_question):
        first_response = self.client.post("/api/chat/query/", {"question": "First query"}, format="json")
        conversation_id = first_response.json()["conversation_id"]

        second_response = self.client.post(
            "/api/chat/query/",
            {"question": "Second query", "conversation_id": conversation_id},
            format="json",
        )

        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(Conversation.objects.count(), 1)
        self.assertEqual(ConversationTurn.objects.count(), 2)
        mocked_answer_question.assert_any_call("First query")
        mocked_answer_question.assert_any_call("Second query")

    def test_conversation_list_endpoint_returns_summaries(self):
        conversation = Conversation.objects.create(mode=Conversation.MODE_GENERAL, title="Hello there")
        ConversationTurn.objects.create(
            conversation=conversation,
            question="Hello there",
            answer="General Kenobi",
        )

        response = self.client.get("/api/chat/conversations/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload[0]["title"], "Hello there")
        self.assertEqual(payload[0]["turn_count"], 1)
        self.assertEqual(payload[0]["latest_question"], "Hello there")
        self.assertEqual(payload[0]["latest_answer"], "General Kenobi")

    def test_conversation_detail_endpoint_returns_turns(self):
        conversation = Conversation.objects.create(mode=Conversation.MODE_QUERY, title="Who scored?")
        turn = ConversationTurn.objects.create(
            conversation=conversation,
            question="Who scored?",
            answer="Alice",
            raw_sql="SELECT 'Alice'",
            sql="SELECT 'Alice'",
            rows=[{"name": "Alice"}],
        )

        response = self.client.get(f"/api/chat/conversations/{conversation.id}/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["id"], conversation.id)
        self.assertEqual(payload["turns"][0]["id"], turn.id)
        self.assertEqual(payload["turns"][0]["sql"], "SELECT 'Alice'")

    def test_turn_list_endpoint_returns_flat_turn_rows(self):
        conversation = Conversation.objects.create(mode=Conversation.MODE_GENERAL, title="Status check")
        turn = ConversationTurn.objects.create(
            conversation=conversation,
            question="What happened?",
            answer="Here is the answer.",
        )

        response = self.client.get("/api/chat/turns/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload[0]["id"], turn.id)
        self.assertEqual(payload[0]["conversation_id"], conversation.id)
        self.assertEqual(payload[0]["mode"], "general")
        self.assertEqual(payload[0]["title"], "Status check")
        self.assertEqual(payload[0]["question"], "What happened?")
        self.assertEqual(payload[0]["answer"], "Here is the answer.")
        self.assertEqual(payload[0]["turn_count"], 1)

    def test_conversation_latest_endpoint_returns_most_recent_conversation_for_mode(self):
        older = Conversation.objects.create(mode=Conversation.MODE_GENERAL, title="Older")
        ConversationTurn.objects.create(conversation=older, question="Old", answer="Answer")
        newer = Conversation.objects.create(mode=Conversation.MODE_GENERAL, title="Newer")
        ConversationTurn.objects.create(conversation=newer, question="New", answer="Answer")

        response = self.client.get("/api/chat/conversations/latest/?mode=general")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], newer.id)


@override_settings(UI_E2E_TEST_MODE=True)
class ChatApiE2EModeTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_general_chat_endpoint_returns_deterministic_response(self):
        response = self.client.post(
            "/api/chat/general/",
            {"question": "Hello from Playwright"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["answer"], "Test reply: Hello from Playwright")
        self.assertIn("conversation_id", response.json())

    def test_query_chat_endpoint_returns_deterministic_response(self):
        response = self.client.post(
            "/api/chat/query/",
            {"question": "Count all records"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["answer"], "Deterministic query answer for: Count all records")
        self.assertEqual(payload["raw_sql"], "SELECT :question AS question, char_length(:question) AS length")
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
