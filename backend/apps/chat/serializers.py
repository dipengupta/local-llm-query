from __future__ import annotations

from rest_framework import serializers

from apps.chat.models import Conversation, ConversationTurn


class ChatMessageSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=["system", "user", "assistant"])
    content = serializers.CharField()


class GeneralChatRequestSerializer(serializers.Serializer):
    question = serializers.CharField(required=False, allow_blank=False)
    messages = ChatMessageSerializer(many=True, required=False)
    conversation_id = serializers.IntegerField(required=False)

    def validate(self, attrs):
        question = attrs.get("question", "").strip()
        messages = attrs.get("messages") or []

        if question:
            attrs["question"] = question
            return attrs

        for message in reversed(messages):
            if message["role"] == "user" and message["content"].strip():
                attrs["question"] = message["content"].strip()
                return attrs

        raise serializers.ValidationError("Provide a question or at least one user message.")


class QueryChatRequestSerializer(serializers.Serializer):
    question = serializers.CharField()
    conversation_id = serializers.IntegerField(required=False)


class ConversationTurnSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConversationTurn
        fields = ["id", "question", "answer", "raw_sql", "sql", "rows", "created_at"]


class ConversationDetailSerializer(serializers.ModelSerializer):
    turns = ConversationTurnSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = ["id", "mode", "title", "created_at", "updated_at", "turns"]


class ConversationSummarySerializer(serializers.ModelSerializer):
    turn_count = serializers.SerializerMethodField()
    latest_question = serializers.SerializerMethodField()
    latest_answer = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id",
            "mode",
            "title",
            "created_at",
            "updated_at",
            "turn_count",
            "latest_question",
            "latest_answer",
        ]

    def _get_latest_turn(self, conversation: Conversation) -> ConversationTurn | None:
        latest_turn = getattr(conversation, "_latest_turn_cache", None)
        if latest_turn is not None:
            return latest_turn

        latest_turn = conversation.turns.order_by("-created_at", "-id").first()
        conversation._latest_turn_cache = latest_turn
        return latest_turn

    def get_turn_count(self, conversation: Conversation) -> int:
        count = getattr(conversation, "turn_count", None)
        if count is not None:
            return count
        return conversation.turns.count()

    def get_latest_question(self, conversation: Conversation) -> str:
        latest_turn = self._get_latest_turn(conversation)
        return latest_turn.question if latest_turn else ""

    def get_latest_answer(self, conversation: Conversation) -> str:
        latest_turn = self._get_latest_turn(conversation)
        return latest_turn.answer if latest_turn else ""


class ConversationTurnListSerializer(serializers.ModelSerializer):
    conversation_id = serializers.IntegerField(source="conversation.id", read_only=True)
    mode = serializers.CharField(source="conversation.mode", read_only=True)
    title = serializers.CharField(source="conversation.title", read_only=True)
    conversation_updated_at = serializers.DateTimeField(source="conversation.updated_at", read_only=True)
    turn_count = serializers.SerializerMethodField()

    class Meta:
        model = ConversationTurn
        fields = [
            "id",
            "conversation_id",
            "mode",
            "title",
            "question",
            "answer",
            "raw_sql",
            "sql",
            "rows",
            "created_at",
            "conversation_updated_at",
            "turn_count",
        ]

    def get_turn_count(self, turn: ConversationTurn) -> int:
        count = getattr(turn.conversation, "turn_count", None)
        if count is not None:
            return count
        return turn.conversation.turns.count()
