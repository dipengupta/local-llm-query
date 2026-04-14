from rest_framework import serializers


class ChatMessageSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=["system", "user", "assistant"])
    content = serializers.CharField()


class GeneralChatRequestSerializer(serializers.Serializer):
    messages = ChatMessageSerializer(many=True)


class QueryChatRequestSerializer(serializers.Serializer):
    question = serializers.CharField()
