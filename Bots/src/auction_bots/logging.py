import json
import logging
import sys
import traceback
from collections.abc import Iterable
from datetime import UTC, datetime

RESERVED_ATTRIBUTES = frozenset(logging.LogRecord("", 0, "", 0, "", (), None).__dict__) | {
    "message",
    "asctime",
}


def _extra_of(record: logging.LogRecord) -> dict[str, object]:
    return {key: value for key, value in record.__dict__.items() if key not in RESERVED_ATTRIBUTES}


class RedactingFilter(logging.Filter):
    def __init__(self, secrets: Iterable[str]) -> None:
        super().__init__()
        self._secrets = tuple(secret for secret in secrets if secret)

    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = self._redact(record.getMessage())
        record.args = None
        if record.exc_info:
            rendered = "".join(traceback.format_exception(*record.exc_info))
            record.exc = self._redact(rendered)
            record.exc_info = None
        for key, value in _extra_of(record).items():
            record.__dict__[key] = self._redact_value(value)
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
        extra = _extra_of(record)
        if extra:
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
