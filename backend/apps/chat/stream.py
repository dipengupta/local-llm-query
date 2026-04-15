from __future__ import annotations

from queue import Empty, Queue
from threading import Lock


class TurnStreamBroker:
    def __init__(self) -> None:
        self._lock = Lock()
        self._next_subscriber_id = 1
        self._subscribers: dict[int, Queue] = {}

    def subscribe(self) -> tuple[int, Queue]:
        queue: Queue = Queue()
        with self._lock:
            subscriber_id = self._next_subscriber_id
            self._next_subscriber_id += 1
            self._subscribers[subscriber_id] = queue
        return subscriber_id, queue

    def unsubscribe(self, subscriber_id: int) -> None:
        with self._lock:
            self._subscribers.pop(subscriber_id, None)

    def publish(self, event: dict) -> None:
        with self._lock:
            subscribers = list(self._subscribers.values())

        for queue in subscribers:
            queue.put(event)

    @staticmethod
    def get_next_event(queue: Queue, *, timeout: float) -> dict | None:
        try:
            return queue.get(timeout=timeout)
        except Empty:
            return None


turn_stream_broker = TurnStreamBroker()
