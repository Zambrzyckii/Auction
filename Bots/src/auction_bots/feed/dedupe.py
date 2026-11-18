from collections import OrderedDict


class RecentIds:
    def __init__(self, capacity: int = 10_000) -> None:
        self._capacity = capacity
        self._ids: OrderedDict[str, None] = OrderedDict()

    def seen(self, message_id: str) -> bool:
        if message_id in self._ids:
            self._ids.move_to_end(message_id)
            return True
        self._ids[message_id] = None
        if len(self._ids) > self._capacity:
            self._ids.popitem(last=False)
        return False
