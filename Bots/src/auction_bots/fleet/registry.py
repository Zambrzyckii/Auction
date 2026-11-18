from uuid import UUID


class FleetRegistry:
    def __init__(self, expected: int) -> None:
        self._expected = expected
        self._ids: set[UUID] = set()
        self._done: set[int] = set()

    def add(self, index: int, user_id: UUID) -> None:
        self._ids.add(user_id)
        self._done.add(index)

    def skip(self, index: int) -> None:
        self._done.add(index)

    def is_human(self, user_id: UUID | None) -> bool:
        return user_id is not None and user_id not in self._ids

    @property
    def complete(self) -> bool:
        return len(self._done) >= self._expected

    @property
    def user_ids(self) -> frozenset[UUID]:
        return frozenset(self._ids)
