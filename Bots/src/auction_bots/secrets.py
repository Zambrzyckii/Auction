from pathlib import Path


def read_secret(path: Path) -> str:
    return path.read_text(encoding="utf-8").rstrip("\n")
