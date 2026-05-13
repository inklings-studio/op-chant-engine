#!/usr/bin/env python3
"""
Fetches psalm and canticle texts from breviar.sk/include/ and converts them
to the format used by js/languages/sk/psalms/*.txt

Each output line is one verse with inline markers:
  †  = flex (three-clause verse only)
  *  = mediant (required in every verse)

Usage:
  python scripts/fetch_breviar.py [output_dir]

  output_dir defaults to js/languages/sk/psalms/

Requirements:
  pip install requests beautifulsoup4
"""

import re
import sys
import time
import requests
from bs4 import BeautifulSoup
from pathlib import Path

BASE_URL = "https://breviar.sk/include/"

def list_canticles():
    """Discover canticle stems by scraping the directory index for ch_*.htm links."""
    r = requests.get(BASE_URL, timeout=15)
    r.raise_for_status()
    stems = sorted(set(re.findall(r'href="(ch_[^"]+)\.htm"', r.text)))
    if not stems:
        # Fallback: parse bare filenames if the server returns a plain listing
        stems = sorted(set(re.findall(r'\b(ch_\w+)\.htm\b', r.text)))
    return stems


def fetch_raw(filename):
    url = BASE_URL + filename + ".htm"
    r = requests.get(url, timeout=15)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or "utf-8"
    return r.text


def _clause_text(p):
    """
    Extract clean text from a <p class="verse ..."> element.

    breviar.sk embeds chant markers as custom {tag} strings inside the HTML text:
      {+}  → flex   → †
      {x}  → mediant → *
      _    → word-connector (e.g. v_kruhu) → space
    Everything else ({v}N{/v}, {r:…}, {k:…}, {full-text}, …) is stripped.
    """
    text = p.get_text(" ", strip=False)
    text = re.sub(r"\{v\}\d+\{/v\}", "", text)  # must precede general {…} strip
    text = text.replace("{+}", " †").replace("{x}", " *")
    text = re.sub(r"\{[^}]*\}", "", text)   # strip all remaining {…} tags
    text = text.replace("_", " ").replace("[", "").replace("]", "")
    return re.sub(r"\s+", " ", text).strip()


def parse_verses(raw):
    """
    Parse breviar.sk HTML into a list of pointing-unit strings.

    Each <p class="verse start"> begins a new pointing unit; its following
    <p class="verse cont*"> elements are the remaining clauses of that unit.
    A biblical verse split across two "start" paragraphs therefore yields two
    output lines — each with exactly one * and optionally one †.
    """
    soup = BeautifulSoup(raw, "html.parser")

    groups = []
    current = []

    for p in soup.find_all("p", class_=re.compile(r"\bverse\b")):
        classes = p.get("class", [])
        text = _clause_text(p)
        if not text:
            continue
        if "start" in classes:
            if current:
                groups.append(current)
            current = [text]
        else:
            current.append(text)

    if current:
        groups.append(current)

    verses = []
    for group in groups:
        verse = re.sub(r"\s+", " ", " ".join(group)).strip()
        if len(verse) > 3:
            verses.append(verse)

    return verses


def write_file(path, verses):
    path.write_text("\n".join(verses) + "\n", encoding="utf-8")


def main():
    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("js/languages/sk/psalms")
    out_dir.mkdir(parents=True, exist_ok=True)

    errors = []

    print("Fetching psalms 1–150…")
    for n in range(1, 151):
        try:
            raw = fetch_raw(f"z{n}")
            verses = parse_verses(raw)
            path = out_dir / f"{n:03d}.txt"
            write_file(path, verses)
            print(f"  {path.name}  ({len(verses)} verses)")
        except Exception as exc:
            msg = f"psalm {n}: {exc}"
            errors.append(msg)
            print(f"  ERROR {msg}", file=sys.stderr)
        time.sleep(0.05)

    print("\nDiscovering canticles…")
    canticles = list_canticles()
    print(f"  Found {len(canticles)}: {', '.join(canticles)}")

    print("\nFetching canticles…")
    for stem in canticles:
        try:
            raw = fetch_raw(stem)
            verses = parse_verses(raw)
            path = out_dir / f"{stem}.txt"
            write_file(path, verses)
            print(f"  {path.name}  ({len(verses)} verses)")
        except Exception as exc:
            msg = f"{stem}: {exc}"
            errors.append(msg)
            print(f"  ERROR {msg}", file=sys.stderr)
        time.sleep(0.05)

    print(f"\nDone → {out_dir}/")
    if errors:
        print(f"\n{len(errors)} error(s):")
        for e in errors:
            print(f"  {e}")


if __name__ == "__main__":
    main()
