from pathlib import Path

from auction_bots.secrets import read_secret


def test_read_secret_strips_the_trailing_newline(tmp_path: Path) -> None:
    secret_file = tmp_path / "api-key.secret"
    secret_file.write_text("secret-value-123\n")

    assert read_secret(secret_file) == "secret-value-123"
