from __future__ import annotations

from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.chat.serializers import GeneralChatRequestSerializer, QueryChatRequestSerializer
from apps.chat.services import LLMServiceError, OpenAICompatibleChatClient
from apps.chat.test_mode import answer_query_for_e2e, complete_general_chat_for_e2e
from apps.query_agent.service import QueryAgentError, QueryAgentService


GENERAL_SYSTEM_PROMPT = (
    "You are the General assistant for a local web app. "
    "Be concise, helpful, and honest about what you do not know. "
    "Answer directly without long hidden reasoning."
)


class GeneralChatView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = GeneralChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            if settings.UI_E2E_TEST_MODE:
                answer = complete_general_chat_for_e2e(serializer.validated_data["messages"])
            else:
                client = OpenAICompatibleChatClient()
                messages = [{"role": "system", "content": GENERAL_SYSTEM_PROMPT}, *serializer.validated_data["messages"]]
                answer = client.complete_chat(
                    messages,
                    temperature=0.4,
                    max_tokens=220,
                    extra_body={"chat_template_kwargs": {"enable_thinking": False}},
                )
        except LLMServiceError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response({"answer": answer})


class QueryChatView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = QueryChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            if settings.UI_E2E_TEST_MODE:
                result = answer_query_for_e2e(serializer.validated_data["question"])
            else:
                result = QueryAgentService(OpenAICompatibleChatClient()).answer_question(serializer.validated_data["question"])
        except QueryAgentError as exc:
            return Response({"detail": str(exc), "sql": exc.raw_sql}, status=status.HTTP_400_BAD_REQUEST)
        except LLMServiceError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response(result)
