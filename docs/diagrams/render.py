#!/usr/bin/env python3
"""Render every Mermaid source in docs/diagrams/src to a light and a dark SVG.

Usage (from anywhere, needs Node.js):
    python3 docs/diagrams/render.py            # all diagrams
    python3 docs/diagrams/render.py context    # only sources whose name contains "context"

Each source is written for the light theme. The dark variant is produced by
swapping the node colours below and rendering with theme.dark.json.
"""
import pathlib
import re
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE / "src"
THEMES = {"": HERE / "theme.light.json", ".dark": HERE / "theme.dark.json"}

# light colour -> dark colour, one entry per (fill, stroke, text) of every layer
PALETTE = {
    "#FFEDD5": "#7C2D12", "#EA580C": "#FB923C", "#7C2D12": "#FFEDD5",  # client (orange)
    "#E0E7FF": "#312E81", "#4F46E5": "#818CF8", "#1E1B4B": "#E0E7FF",  # host / Api project (indigo)
    "#FEF3C7": "#78350F", "#D97706": "#FBBF24", "#78350F": "#FEF3C7",  # identity (amber)
    "#D1FAE5": "#064E3B", "#059669": "#34D399", "#064E3B": "#D1FAE5",  # wallets (emerald)
    "#E0F2FE": "#0C4A6E", "#0284C7": "#38BDF8", "#0C4A6E": "#E0F2FE",  # auctions (sky)
    "#FFE4E6": "#881337", "#E11D48": "#FB7185", "#881337": "#FFE4E6",  # inventory (rose)
    "#E2E8F0": "#334155", "#475569": "#94A3B8", "#0F172A": "#F1F5F9",  # shared (slate)
    "#F4F4F5": "#27272A", "#71717A": "#A1A1AA", "#27272A": "#F4F4F5",  # planned (zinc, dashed)
    "#F3E8FF": "#581C87", "#9333EA": "#C084FC", "#581C87": "#F3E8FF",  # db (purple)
    "#EEF2FF": "#1E1B4B", "#FFFBEB": "#451A03", "#F0FDF4": "#022C22",  # subgraph fills: host, identity, wallets
    "#F0F9FF": "#082F49", "#FFF1F2": "#4C0519", "#F8FAFC": "#1E293B", "#FAFAFA": "#18181B",  # subgraph fills: auctions, inventory, shared, planned
}
HEX = re.compile(r"#[0-9A-Fa-f]{6}")


def to_dark(text: str) -> str:
    return HEX.sub(lambda m: PALETTE.get(m.group(0).upper(), m.group(0)), text)


def render(source: str, theme: pathlib.Path, out: pathlib.Path) -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".mmd", delete=False, encoding="utf-8") as tmp:
        tmp.write(source)
        tmp_path = tmp.name
    cmd = ["npx", "-y", "@mermaid-js/mermaid-cli", "-i", tmp_path, "-o", str(out),
           "-c", str(theme), "-b", "transparent", "-q"]
    subprocess.run(cmd, check=True)
    pathlib.Path(tmp_path).unlink()


def main() -> int:
    needle = sys.argv[1] if len(sys.argv) > 1 else ""
    sources = sorted(p for p in SRC.glob("*.mmd") if needle in p.name)
    if not sources:
        print("no sources matched", file=sys.stderr)
        return 1
    for src in sources:
        text = src.read_text(encoding="utf-8")
        for suffix, theme in THEMES.items():
            out = HERE / f"{src.stem}{suffix}.svg"
            render(text if suffix == "" else to_dark(text), theme, out)
            print(f"rendered {out.relative_to(HERE.parent.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
