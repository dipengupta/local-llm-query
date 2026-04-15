from __future__ import annotations

import asyncio
import json

from django.http import StreamingHttpResponse
from django.db import transaction
from django.db.models import Count, Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.chat.models import Conversation, ConversationTurn, build_conversation_title
from apps.chat.serializers import (
    ConversationDetailSerializer,
    ConversationSummarySerializer,
    ConversationTurnListSerializer,
    GeneralChatRequestSerializer,
    QueryChatRequestSerializer,
)
from apps.chat.stream import turn_stream_broker
from apps.chat.services import LLMServiceError, OpenAICompatibleChatClient
from apps.chat.test_mode import answer_query_for_e2e, complete_general_chat_for_e2e
from apps.query_agent.service import QueryAgentError, QueryAgentService


GENERAL_SYSTEM_PROMPT = (
    "You are the General assistant for a local web app. "
    "Be concise, helpful, and honest about what you do not know. "
    "Answer directly without long hidden reasoning."
)


def get_conversation(conversation_id: int, mode: str) -> Conversation:
    return get_object_or_404(
        Conversation.objects.prefetch_related("turns"),
        pk=conversation_id,
        mode=mode,
    )


def build_general_context_messages(question: str, *, conversation: Conversation | None = None, fallback_messages=None):
    if conversation is not None:
        messages = []
        for turn in conversation.turns.all():
            messages.extend(
                [
                    {"role": "user", "content": turn.question},
                    {"role": "assistant", "content": turn.answer},
                ]
            )
        messages.append({"role": "user", "content": question})
        return messages

    if fallback_messages:
        return fallback_messages

    return [{"role": "user", "content": question}]


def create_conversation(mode: str, question: str) -> Conversation:
    return Conversation.objects.create(mode=mode, title=build_conversation_title(question))


def serialize_turn_row(turn: ConversationTurn) -> dict:
    serialized_turn = (
        ConversationTurn.objects.select_related("conversation")
        .annotate(turn_count=Count("conversation__turns"))
        .get(pk=turn.pk)
    )
    return ConversationTurnListSerializer(serialized_turn).data


def save_turn(
    conversation: Conversation | None,
    *,
    mode: str,
    question: str,
    answer: str,
    raw_sql: str = "",
    sql: str = "",
    rows=None,
) -> tuple[Conversation, ConversationTurn]:
    rows = rows or []
    with transaction.atomic():
        if conversation is None:
            conversation = create_conversation(mode, question)
        else:
            Conversation.objects.filter(pk=conversation.pk).update(updated_at=timezone.now())
            conversation.refresh_from_db(fields=["updated_at"])

        turn = ConversationTurn.objects.create(
            conversation=conversation,
            question=question,
            answer=answer,
            raw_sql=raw_sql,
            sql=sql,
            rows=rows,
        )
        transaction.on_commit(lambda: turn_stream_broker.publish(serialize_turn_row(turn)))

    return conversation, turn


class ConversationListView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        conversations = Conversation.objects.annotate(turn_count=Count("turns")).prefetch_related(
            Prefetch("turns", queryset=ConversationTurn.objects.order_by("-created_at", "-id"))
        )
        return Response(ConversationSummarySerializer(conversations, many=True).data)


class ConversationTurnListView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        turns = ConversationTurn.objects.select_related("conversation").annotate(
            turn_count=Count("conversation__turns")
        ).order_by("-created_at", "-id")
        return Response(ConversationTurnListSerializer(turns, many=True).data)


TURN_STREAM_HEARTBEAT_SECONDS = 15


def conversation_turn_stream_view(request):
    subscriber_id, event_queue = turn_stream_broker.subscribe()

    async def async_stream():
        yield "retry: 3000\n\n"
        try:
            while True:
                event = await asyncio.to_thread(
                    turn_stream_broker.get_next_event,
                    event_queue,
                    timeout=TURN_STREAM_HEARTBEAT_SECONDS,
                )
                if event is None:
                    yield ": keepalive\n\n"
                    continue
                yield f"event: turn\ndata: {json.dumps(event)}\n\n"
        except GeneratorExit:
            return
        finally:
            turn_stream_broker.unsubscribe(subscriber_id)

    def stream():
        yield "retry: 3000\n\n"
        try:
            while True:
                event = turn_stream_broker.get_next_event(event_queue, timeout=TURN_STREAM_HEARTBEAT_SECONDS)
                if event is None:
                    yield ": keepalive\n\n"
                    continue
                yield f"event: turn\ndata: {json.dumps(event)}\n\n"
        except GeneratorExit:
            return
        finally:
            turn_stream_broker.unsubscribe(subscriber_id)

    content = async_stream() if hasattr(request, "scope") else stream()
    response = StreamingHttpResponse(content, content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


class ConversationDetailView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, conversation_id: int):
        conversation = get_object_or_404(Conversation.objects.prefetch_related("turns"), pk=conversation_id)
        return Response(ConversationDetailSerializer(conversation).data)


class ConversationLatestView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        mode = request.query_params.get("mode", "").strip()
        valid_modes = {choice[0] for choice in Conversation.MODE_CHOICES}
        if mode not in valid_modes:
            return Response({"detail": "A valid mode is required."}, status=status.HTTP_400_BAD_REQUEST)

        conversation = (
            Conversation.objects.filter(mode=mode)
            .prefetch_related("turns")
            .order_by("-updated_at", "-id")
            .first()
        )
        if conversation is None:
            return Response({"detail": "No saved conversation for this mode."}, status=status.HTTP_404_NOT_FOUND)

        return Response(ConversationDetailSerializer(conversation).data)


class GeneralChatView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = GeneralChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        conversation_id = serializer.validated_data.get("conversation_id")
        question = serializer.validated_data["question"]
        conversation = get_conversation(conversation_id, Conversation.MODE_GENERAL) if conversation_id else None

        try:
            messages = build_general_context_messages(
                question,
                conversation=conversation,
                fallback_messages=serializer.validated_data.get("messages"),
            )
            if settings.UI_E2E_TEST_MODE:
                answer = complete_general_chat_for_e2e(messages)
            else:
                client = OpenAICompatibleChatClient()
                answer = client.complete_chat(
                    [{"role": "system", "content": GENERAL_SYSTEM_PROMPT}, *messages],
                    temperature=0.4,
                    max_tokens=220,
                    extra_body={"chat_template_kwargs": {"enable_thinking": False}},
                )
        except LLMServiceError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        conversation, _turn = save_turn(
            conversation,
            mode=Conversation.MODE_GENERAL,
            question=question,
            answer=answer,
        )

        return Response({"answer": answer, "conversation_id": conversation.id})


class QueryChatView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = QueryChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        conversation_id = serializer.validated_data.get("conversation_id")
        conversation = get_conversation(conversation_id, Conversation.MODE_QUERY) if conversation_id else None

        try:
            if settings.UI_E2E_TEST_MODE:
                result = answer_query_for_e2e(serializer.validated_data["question"])
            else:
                result = QueryAgentService(OpenAICompatibleChatClient()).answer_question(serializer.validated_data["question"])
        except QueryAgentError as exc:
            return Response({"detail": str(exc), "sql": exc.raw_sql}, status=status.HTTP_400_BAD_REQUEST)
        except LLMServiceError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        conversation, _turn = save_turn(
            conversation,
            mode=Conversation.MODE_QUERY,
            question=serializer.validated_data["question"],
            answer=result["answer"],
            raw_sql=result.get("raw_sql", ""),
            sql=result.get("sql", ""),
            rows=result.get("rows") or [],
        )

        return Response({**result, "conversation_id": conversation.id})
