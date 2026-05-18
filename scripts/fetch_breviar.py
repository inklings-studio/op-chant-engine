#!/usr/bin/env python3
"""
Fetches psalm and canticle texts from breviar.sk/include/ and converts them
to the format used by js/languages/sk/psalms/*.txt

Each output line is one verse with inline markers:
  †  = flex (three-clause verse only)
  *  = mediant (required in every verse)

Output naming:
  Single-part psalm:        z_001.txt
  Multi-part psalm:         z_035_1.txt, z_035_2.txt, z_035_3.txt
  Part with {full-text}:    z_035_1.txt + z_035_1_full.txt (optional verses included)
  Canticle:                 ch_dan3_52.txt  (unchanged)

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
from bs4 import BeautifulSoup, Comment
from pathlib import Path

BASE_URL = "https://breviar.sk/include/"

# Valid psalm section suffixes (Roman numerals + Hebrew letters for Ps 119).
# Keys ending in anything else (CELY = whole psalm, PC = per choros,
# ANJ = Anglican variant, OCD = Carmelite variant, …) are skipped.
_VALID_SUFFIXES = {
    "",
    "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
    "ALEF", "BET", "GIMEL", "DALET", "HE", "VAU", "ZAJIN", "CHET",
    "TET", "JOD", "KAF", "LAMED", "MEM", "NUN", "SAMECH", "AIN",
    "PE", "SADE", "KOF", "RES", "SIN", "TAU",
}


def list_canticles():
    """Discover canticle stems by scraping the directory index for ch_*.htm links."""
    r = requests.get(BASE_URL, timeout=15)
    r.raise_for_status()
    stems = sorted(set(re.findall(r'href="(ch_[^"]+)\.htm"', r.text)))
    if not stems:
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
    # {v}\w+{/v} handles alphanumeric labels like 3c, 3b, etc.
    text = re.sub(r"\{v\}\w+\{/v\}", "", text)
    text = text.replace("{+}", " †").replace("{x}", " *")
    text = re.sub(r"\{[^}]*\}", "", text)
    text = text.replace("_", " ").replace("[", "").replace("]", "")
    return re.sub(r"\s+", " ", text).strip()


def split_parts(raw):
    """
    Return list of (key, suffix, content) for each canonical psalm section.

    Accepts:
      ZALM{n}          → single-part psalm, suffix ""
      ZALM{n}_I/II/…   → Roman-numeral parts
      ZALM{n}_ALEF/…   → Hebrew-letter parts (Ps 119)

    Skips variant-only blocks: CELY (whole psalm), PC (per choros),
    ANJ (Anglican), OCD (Carmelite), OFM, etc.
    Duplicate keys (nested or repeated blocks) are deduplicated.
    """
    pattern = r'<!--\{BEGIN:([A-Z0-9_]+)\}-->(.*?)<!--\{END:\1\}-->'
    seen = set()
    result = []
    for key, content in re.findall(pattern, raw, re.DOTALL):
        if key in seen:
            continue
        m = re.match(r'ZALM\d+(?:_([A-Z]+))?$', key)
        if not m:
            continue
        suffix = m.group(1) or ""
        if suffix not in _VALID_SUFFIXES:
            continue
        # Always mark as seen first so a later duplicate of the same key is
        # ignored — e.g. z33 has two ZALM33 blocks, the first empty, the second
        # with verse content; we want only whichever comes first to be evaluated.
        seen.add(key)
        # Skip blocks with no verse paragraphs — empty wrappers or metadata-only
        # containers (e.g. the first ZALM17 block that only holds PSALMODIA tags).
        if not re.search(r'<p [^>]*class="[^"]*\bverse\b', content):
            continue
        result.append((key, suffix, content))
    return result


_FT_SENTINEL = "__FT_STRIPPED__"


def parse_verses(chunk, include_full_text=True):
    """
    Parse breviar.sk HTML chunk into a list of pointing-unit strings.

    Each <p class="verse start"> begins a new pointing unit; its following
    <p class="verse cont*"> elements are the remaining clauses of that unit.

    When include_full_text=False, {full-text}...{/full-text} blocks are replaced
    with a sentinel HTML comment before parsing. The sentinel is detected during
    traversal so that any cont element immediately following a stripped block is
    treated as an orphaned start (its original start was inside the stripped block).
    """
    if not include_full_text:
        chunk = re.sub(
            r'\{full-text\}.*?\{/full-text\}',
            f'<!--{_FT_SENTINEL}-->',
            chunk,
            flags=re.DOTALL,
        )

    soup = BeautifulSoup(chunk, "html.parser")
    body = soup.body or soup
    groups = []
    current = []
    after_stripped_ft = False

    for node in body.children:
        if isinstance(node, Comment) and _FT_SENTINEL in node:
            # Stripped full-text block: close the current group so the next
            # cont (whose start was inside the block) starts fresh.
            after_stripped_ft = True
            if current:
                groups.append(current)
                current = []
            continue

        if not (hasattr(node, "get") and "verse" in node.get("class", [])):
            continue

        classes = node.get("class", [])
        text = _clause_text(node)
        if not text:
            continue

        if "start" in classes:
            if current:
                groups.append(current)
            current = [text]
            after_stripped_ft = False
        else:
            if after_stripped_ft or not current:
                # Orphaned cont: its start was stripped; treat as new unit
                if current:
                    groups.append(current)
                current = [text]
                after_stripped_ft = False
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


def validate_verses(verses):
    """Return list of issue descriptions for verses missing or doubling the * marker."""
    issues = []
    for i, v in enumerate(verses, 1):
        count = v.count("*")
        if count == 0:
            issues.append(f"line {i}: no mediant (*) — {v[:70]}")
        elif count > 1:
            issues.append(f"line {i}: {count}× mediant (*) — {v[:70]}")
    return issues


def write_file(path, verses):
    path.write_text("\n".join(verses) + "\n", encoding="utf-8")


def process_psalm(n, out_dir):
    """
    Fetch psalm n, split by part, handle {full-text} blocks, write files.
    Returns (all_ok, [generated filenames], [warning strings]).
    """
    raw = fetch_raw(f"z{n}")
    parts = split_parts(raw)

    if not parts:
        parts = [("ZALM", "", raw)]

    is_multi = len(parts) > 1
    generated = []
    warnings = []

    for part_idx, (key, suffix, content) in enumerate(parts, 1):
        has_ft = bool(re.search(r'\{full-text\}', content))

        stem = f"z_{n:03d}_{part_idx}" if is_multi else f"z_{n:03d}"

        # Base version (full-text blocks stripped when present)
        verses = parse_verses(content, include_full_text=False)
        issues = validate_verses(verses)
        write_file(out_dir / f"{stem}.txt", verses)
        generated.append(f"{stem}.txt")
        if issues:
            warnings.extend(f"  {stem}: {iss}" for iss in issues)

        # Full version only when this part actually contains {full-text} blocks
        if has_ft:
            verses_full = parse_verses(content, include_full_text=True)
            issues_full = validate_verses(verses_full)
            write_file(out_dir / f"{stem}_full.txt", verses_full)
            generated.append(f"{stem}_full.txt")
            if issues_full:
                warnings.extend(f"  {stem}_full: {iss}" for iss in issues_full)

    return not warnings, generated, warnings


def process_canticle(stem, out_dir):
    """Fetch a canticle, parse verses, write file. Returns (ok, warnings)."""
    raw = fetch_raw(stem)
    verses = parse_verses(raw)
    issues = validate_verses(verses)
    write_file(out_dir / f"{stem}.txt", verses)
    warnings = [f"  {stem}: {iss}" for iss in issues]
    return not warnings, warnings


def main():
    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("js/languages/sk/psalms")
    out_dir.mkdir(parents=True, exist_ok=True)

    errors = []
    all_warnings = []
    ok_names = []
    warn_names = []

    print("Fetching psalms 1–150…")
    for n in range(1, 151):
        try:
            ok, generated, warnings = process_psalm(n, out_dir)
            if ok:
                ok_names.extend(generated)
                print(f"  OK   {', '.join(generated)}")
            else:
                warn_names.extend(generated)
                print(f"  WARN {', '.join(generated)}")
                all_warnings.extend(warnings)
        except Exception as exc:
            msg = f"psalm {n}: {exc}"
            errors.append(msg)
            print(f"  ERROR {msg}", file=sys.stderr)
        time.sleep(0.05)

    print("\nDiscovering canticles…")
    try:
        canticles = list_canticles()
        print(f"  Found {len(canticles)}: {', '.join(canticles)}")
    except Exception as exc:
        print(f"  ERROR listing canticles: {exc}", file=sys.stderr)
        canticles = []

    print("\nFetching canticles…")
    for stem in canticles:
        try:
            ok, warnings = process_canticle(stem, out_dir)
            if ok:
                ok_names.append(f"{stem}.txt")
                print(f"  OK   {stem}.txt")
            else:
                warn_names.append(f"{stem}.txt")
                print(f"  WARN {stem}.txt")
                all_warnings.extend(warnings)
        except Exception as exc:
            msg = f"{stem}: {exc}"
            errors.append(msg)
            print(f"  ERROR {msg}", file=sys.stderr)
        time.sleep(0.05)

    print(f"\n{'─' * 60}")
    print(f"Done → {out_dir}/")
    print(f"  OK:      {len(ok_names)} file(s)")
    print(f"  Warned:  {len(warn_names)} file(s)")
    print(f"  Errors:  {len(errors)}")

    if warn_names:
        print(f"\nFiles with verse structure warnings:")
        for name in warn_names:
            print(f"  {name}")
        print("\nDetails:")
        for w in all_warnings:
            print(w)

    if errors:
        print(f"\nFailed:")
        for e in errors:
            print(f"  {e}")


if __name__ == "__main__":
    main()
