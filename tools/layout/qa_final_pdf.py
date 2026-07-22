from __future__ import annotations

import argparse
import re
from pathlib import Path

import fitz


MIN_PAGE_COUNT = 100
MIN_TOC_ENTRIES = 100
REQUIRED_METADATA = ("title", "author", "subject", "creator", "producer")
REQUIRED_TEXT = (
    "ВВЕДЕНИЕ",
    "МИРЫ DAWN",
    "УНИВЕРСАЛЬНЫЕ ПРАВИЛА",
    "СОЗДАНИЕ ПЕРСОНАЖА",
    "СВОБОДНАЯ ИГРА",
    "СТРУКТУРИРОВАННЫЙ БОЙ",
    "ТЕХНИКИ",
    "ИНСТРУМЕНТЫ НАРРАТОРА",
    "ПРИМЕРЫ БОЕВЫХ СЦЕНАРИЕВ",
    "РУССКАЯ ЛОКАЛИЗАЦИЯ",
)
FORBIDDEN_PATTERNS = {
    "page placeholder": re.compile(r"стр\.\s*[XХ]", re.IGNORECASE),
    "replacement glyph": re.compile("�"),
    "tool token": re.compile(r"turn\d+(?:search|fetch|view)\d+", re.IGNORECASE),
    "unfinished marker": re.compile(r"\b(?:TODO|TBD)\b", re.IGNORECASE),
}


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def check_pdf(path: Path) -> None:
    errors: list[str] = []
    doc = fitz.open(path)
    page_count = len(doc)

    if page_count < MIN_PAGE_COUNT:
        fail(errors, f"page count {page_count} is below {MIN_PAGE_COUNT}")

    metadata = doc.metadata or {}
    for field in REQUIRED_METADATA:
        if not str(metadata.get(field, "")).strip():
            fail(errors, f"missing metadata field: {field}")

    toc = doc.get_toc()
    if len(toc) < MIN_TOC_ENTRIES:
        fail(errors, f"TOC has only {len(toc)} entries")
    for _level, title, page_no in toc:
        if not 1 <= page_no <= page_count:
            fail(errors, f"TOC target outside document: {title!r} -> {page_no}")

    all_text: list[str] = []
    blank_pages: list[int] = []
    bad_boxes: list[tuple[int, tuple[float, float, float, float]]] = []
    bad_links: list[tuple[int, int]] = []
    page_sizes: set[tuple[int, int]] = set()
    fonts: set[tuple[int, str, str, str]] = set()

    for page_no, page in enumerate(doc, start=1):
        text = page.get_text()
        all_text.append(text)
        if not text.strip():
            blank_pages.append(page_no)

        page_sizes.add((round(page.rect.width), round(page.rect.height)))
        for block in page.get_text("blocks"):
            rect = fitz.Rect(block[:4])
            if (
                rect.x0 < -0.5
                or rect.y0 < -0.5
                or rect.x1 > page.rect.width + 0.5
                or rect.y1 > page.rect.height + 0.5
            ):
                bad_boxes.append((page_no, tuple(round(value, 1) for value in rect)))

        for link in page.get_links():
            target = link.get("page", -1)
            if target >= page_count:
                bad_links.append((page_no, target + 1))

        for font in page.get_fonts(full=True):
            fonts.add((font[0], font[1], font[2], font[3]))

    if blank_pages:
        fail(errors, f"blank pages: {blank_pages}")
    if len(page_sizes) != 1:
        fail(errors, f"inconsistent page sizes: {sorted(page_sizes)}")
    if bad_boxes:
        fail(errors, f"text blocks outside page: {bad_boxes[:10]}")
    if bad_links:
        fail(errors, f"link targets outside document: {bad_links[:10]}")

    unembedded = sorted(font for font in fonts if font[0] <= 0 or font[1] not in {"ttf", "otf"})
    if unembedded:
        fail(errors, f"fonts not embedded as TTF/OTF: {unembedded}")

    joined_text = "\n".join(all_text)
    folded_text = " ".join(joined_text.casefold().split())
    for required in REQUIRED_TEXT:
        normalized_required = " ".join(required.casefold().split())
        if normalized_required not in folded_text:
            fail(errors, f"required section text not found: {required}")
    for label, pattern in FORBIDDEN_PATTERNS.items():
        matches = pattern.findall(joined_text)
        if matches:
            fail(errors, f"{label}: {matches[:10]}")

    doc.close()

    if errors:
        for error in errors:
            print(f"FAIL: {error}")
        raise SystemExit(1)

    print(
        "PDF QA passed: "
        f"pages={page_count}, toc={len(toc)}, fonts={len(fonts)}, "
        f"size={path.stat().st_size} bytes"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Smoke-check a complete DAWN RU PDF.")
    parser.add_argument("pdf", type=Path)
    args = parser.parse_args()
    check_pdf(args.pdf.resolve())


if __name__ == "__main__":
    main()
