import json
import logging
import sys
from collections.abc import Iterable
from datetime import UTC, datetime


class RedactingFilter(logging.Filter):
    def __init__(self, secrets: Iterable[str]) -> None:
        super().__init__()
        self._secrets = tuple(secret for secret in secrets if secret)

    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = self._redact(record.getMessage())
        record.args = None
        extra = getattr(record, "extra", None)
        if isinstance(extra, dict):
            record.extra = {key: self._redact_value(value) for key, value in extra.items()}
        return True

    def _redact(self, text: str) -> str:
        for secret in self._secrets:
            text = text.replace(secret, "***")
        return text

    def _redact_value(self, value: object) -> object:
        if isinstance(value, str):
            return self._redact(value)
        return value


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": datetime.now(UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        extra = getattr(record, "extra", None)
        if isinstance(extra, dict):
            payload["extra"] = extra
        return json.dumps(payload, default=str)


def configure_logging(level: str, secrets: Iterable[str]) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    handler.addFilter(RedactingFilter(secrets))
    root = logging.getLogger()
    for old_handler in list(root.handlers):
        root.removeHandler(old_handler)
    root.addHandler(handler)
    root.setLevel(level.upper())
