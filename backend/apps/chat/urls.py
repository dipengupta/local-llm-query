from django.urls import path

from apps.chat.views import (
    ConversationDetailView,
    ConversationLatestView,
    ConversationListView,
    ConversationTurnListView,
    GeneralChatView,
    QueryChatView,
)


urlpatterns = [
    path("conversations/", ConversationListView.as_view(), name="conversation-list"),
    path("conversations/latest/", ConversationLatestView.as_view(), name="conversation-latest"),
    path("conversations/<int:conversation_id>/", ConversationDetailView.as_view(), name="conversation-detail"),
    path("turns/", ConversationTurnListView.as_view(), name="conversation-turn-list"),
    path("general/", GeneralChatView.as_view(), name="chat-general"),
    path("query/", QueryChatView.as_view(), name="chat-query"),
]
