from django.urls import path

from apps.chat.views import GeneralChatView, QueryChatView


urlpatterns = [
    path("general/", GeneralChatView.as_view(), name="chat-general"),
    path("query/", QueryChatView.as_view(), name="chat-query"),
]
