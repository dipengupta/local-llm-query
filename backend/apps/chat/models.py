from __future__ import annotations

from django.db import models


def build_conversation_title(question: str, *, max_length: int = 80) -> str:
    normalized = " ".join(question.split()).strip()
    if len(normalized) <= max_length:
        return normalized
    return f"{normalized[: max_length - 1].rstrip()}…"


class Conversation(models.Model):
    MODE_GENERAL = "general"
    MODE_QUERY = "query"
    MODE_CHOICES = [
        (MODE_GENERAL, "General"),
        (MODE_QUERY, "Query Agent"),
    ]

    mode = models.CharField(max_length=16, choices=MODE_CHOICES)
    title = models.CharField(max_length=80)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "chat_conversation"
        ordering = ["-updated_at", "-id"]

    def __str__(self) -> str:
        return f"{self.get_mode_display()}: {self.title}"


class ConversationTurn(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="turns")
    question = models.TextField()
    answer = models.TextField()
    raw_sql = models.TextField(blank=True)
    sql = models.TextField(blank=True)
    rows = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chat_conversationturn"
        ordering = ["created_at", "id"]

    def __str__(self) -> str:
        return build_conversation_title(self.question, max_length=60)
