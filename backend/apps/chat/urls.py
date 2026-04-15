from django.urls import path

from apps.chat.views import (
    ConversationDetailView,
    ConversationLatestView,
    ConversationListView,
    ConversationTurnListView,
    GeneralChatView,
    QueryChatView,
    conversation_turn_stream_view,
)


urlpatterns = [
    path("conversations/", ConversationListView.as_view(), name="conversation-list"),
    path("conversations/latest/", ConversationLatestView.as_view(), name="conversation-latest"),
    path("conversations/<int:conversation_id>/", ConversationDetailView.as_view(), name="conversation-detail"),
    path("turns/", ConversationTurnListView.as_view(), name="conversation-turn-list"),
    path("turns/stream/", conversation_turn_stream_view, name="conversation-turn-stream"),
    path("general/", GeneralChatView.as_view(), name="chat-general"),
    path("query/", QueryChatView.as_view(), name="chat-query"),
]
