import json
import logging

import pytest

from auction_bots.logging import configure_logging


@pytest.fixture(autouse=True)
def reset_root_logger():
    yield
    root = logging.getLogger()
    for handler in list(root.handlers):
        root.removeHandler(handler)


def test_secret_values_never_reach_the_log(capsys: pytest.CaptureFixture[str]) -> None:
    configure_logging("INFO", secrets=["hunter2-very-secret"])

    logging.getLogger("fleet").info("logging in with %s", "hunter2-very-secret")

    line = capsys.readouterr().out.strip()
    assert "hunter2-very-secret" not in line
    assert "***" in line


def test_log_line_is_one_json_object(capsys: pytest.CaptureFixture[str]) -> None:
    configure_logging("INFO", secrets=[])

    logging.getLogger("fleet").info("fleet ready", extra={"logged_in": 10})

    line = capsys.readouterr().out.strip()
    payload = json.loads(line)
    assert payload["level"] == "INFO"
    assert payload["logger"] == "fleet"
    assert payload["msg"] == "fleet ready"
    assert payload["extra"] == {"logged_in": 10}
    assert "ts" in payload


def test_extra_values_are_redacted(capsys: pytest.CaptureFixture[str]) -> None:
    configure_logging("INFO", secrets=["hunter2-very-secret"])

    logging.getLogger("fleet").info("relogin", extra={"token": "hunter2-very-secret"})

    line = capsys.readouterr().out.strip()
    assert "hunter2-very-secret" not in line
    assert json.loads(line)["extra"] == {"token": "***"}


def test_tracebacks_are_rendered_and_redacted(capsys: pytest.CaptureFixture[str]) -> None:
    configure_logging("INFO", secrets=["hunter2-very-secret"])

    try:
        raise ValueError("boom with hunter2-very-secret inside")
    except ValueError:
        logging.getLogger("fleet").exception("tick crashed")

    line = capsys.readouterr().out.strip()
    payload = json.loads(line)
    assert "ValueError" in payload["extra"]["exc"]
    assert "test_logging" in payload["extra"]["exc"]
    assert "hunter2-very-secret" not in line
