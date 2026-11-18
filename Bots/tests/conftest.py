from pathlib import Path

import pytest

BOTS_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def settings_path() -> Path:
    return BOTS_ROOT / "bots.toml"
