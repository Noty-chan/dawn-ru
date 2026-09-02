# -*- coding: utf-8 -*-
"""Build the English LionWing technique catalogue and a reproducible edition diff.

The generated JS is a presentation-only overlay. It does not replace Russian rule
data or technique automation. The detected JSON/Markdown files are mechanical
candidates; reviewed decisions live in source/editions/.../changes.json.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "apps" / "companion"
EDITION = ROOT / "source" / "editions" / "dawn-en-lionwing-cb2f8e67"
OLD_EDITION = ROOT / "source" / "editions" / "dawn-en-9ce6d8d6"
NEW_PDF = ROOT / "source" / "original" / "DAWN_ The RPG (LionWing Edition) w Bookmarks.pdf"
OLD_PDF = ROOT / "source" / "original" / "Dawn - A Diceless Fantasy TTRPG.pdf"
NEW_ID = "dawn-en-lionwing-cb2f8e67"
OLD_ID = "dawn-en-9ce6d8d6"

ARCHETYPE_RANGES = {
    "powerhouse": (69, 73),
    "vagabond": (75, 80),
    "bulwark": (81, 85),
    "altruist": (86, 91),
    "disruptor": (92, 97),
    "ruiner": (98, 103),
}

OLD_ARCHETYPE_RANGES = {
    "powerhouse": (67, 71),
    "vagabond": (73, 77),
    "bulwark": (79, 82),
    "altruist": (84, 88),
    "disruptor": (90, 94),
    "ruiner": (96, 100),
}

OUTLOOK_COLUMNS = [
    (50, "rebel", "The Rebel"), (50, "loyalist", "The Loyal"),
    (51, "beacon", "The Light"), (51, "wolf", "The Wolf"),
    (52, "mentor", "The Mentor"), (52, "student", "The Apprentice"),
    (53, "cursed", "The Accursed"), (53, "blessed", "The Blessed"),
    (54, "quiet", "The Quiet"), (54, "confident", "The Confident"),
]

OLD_OUTLOOK_COLUMNS = [
    (48, "rebel", "The Rebel"), (48, "loyalist", "The Loyal"),
    (49, "beacon", "The Light"), (49, "wolf", "The Wolf"),
    (50, "mentor", "The Mentor"), (50, "student", "The Apprentice"),
    (51, "cursed", "The Accursed"), (51, "blessed", "The Blessed"),
    (52, "quiet", "The Quiet"), (52, "confident", "The Confident"),
]

# Explicit stable-ID migrations. Some are simple renames; others retain two or
# three Level names and are probable redesigns of the same Technique family.
# The evidence is exported so a reviewer can revise a mapping without relying on
# fuzzy title matching.
NAME_MIGRATIONS = {
    "Monastic Warrior": ("Monastic Sage", "high", "explicit-name-migration"),
    "Bestial Ascendant": ("Beastial Ascendant", "high", "explicit-name-migration"),
    "Talisman Exorcist": ("Talisman Caster", "high", "explicit-name-migration"),
    "Temporal Sage": ("Chronomancer", "high", "explicit-name-migration"),
    "Virtuoso": ("Bardic Savant", "high", "explicit-name-migration"),
    "Strongman": ("Inhuman Strength", "high", "explicit-name-migration"),
    "SwarmKin": ("Swarm Body", "high", "explicit-name-migration"),
    "Poacher": ("Hunter", "high", "explicit-name-migration"),
    "Feral Arcanist": ("Feral Arcana", "high", "explicit-name-migration"),
    "Frost Veiler": ("Cryomancer", "high", "explicit-name-migration"),
    "Ranger": ("Long Draw", "high", "explicit-name-migration"),
    "Creator": ("Creation Ascetic", "high", "explicit-name-migration"),
    "Detective": ("Dim Mak", "medium", "levels-1-and-3-retained"),
    "Mollycoddler": ("Runic Retribution", "high", "all-level-names-retained"),
    "Guard Caller": ("Guardian Angel", "high", "all-level-names-retained"),
    "Analyst": ("Precognizant", "medium", "levels-1-and-2-retained"),
    "Compassionate Sage": ("Heavenly Saint", "high", "all-level-names-retained"),
    "Jailor": ("Mage's Array", "medium", "levels-2-and-3-retained"),
    "Worldsmith": ("Inner World", "high", "all-level-names-retained"),
    "Eradicator": ("Rapid-Fire Sorcery", "high", "all-level-names-retained"),
    "Blade Smith": ("Mana Blades", "medium", "levels-1-and-3-retained"),
    "Sword Caller": ("Sellsword's Call", "medium", "levels-1-and-3-retained"),
}

HEADER = re.compile(r"^(.+?)\s*\|\s*((?:★\s*)*)\|\s*(.*)$")
LEVEL = re.compile(r"(?ms)^([123])(?::\s*|\s+)(?!-)([^:\n]+):\s*(.*?)(?=^[123](?::|\s)|\Z)")


def normalize(value: str) -> str:
    value = value.replace("’", "'").replace("“", '"').replace("”", '"')
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def read_current_data() -> dict:
    raw = (APP / "data.js").read_text(encoding="utf-8")
    return json.loads(raw.split("=", 1)[1].rsplit(";", 1)[0])


def pdf_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extract_columns(page) -> list[str]:
    return [
        page.crop(box).extract_text(x_tolerance=2, y_tolerance=3) or ""
        for box in ((0, 0, page.width / 2, page.height), (page.width / 2, 0, page.width, page.height))
    ]


def parse_technique_column(text: str, archetype_id: str, page_number: int, source_id: str = NEW_ID) -> list[dict]:
    lines = text.splitlines()
    starts = [(index, HEADER.match(line.strip())) for index, line in enumerate(lines)]
    starts = [(index, match) for index, match in starts if match]
    techniques = []
    for position, (start, match) in enumerate(starts):
        end = starts[position + 1][0] if position + 1 < len(starts) else len(lines)
        body_lines = lines[start + 1 : end]
        stars = match.group(2).count("★")
        tags = normalize(match.group(3))
        if not stars and body_lines:
            continuation = re.match(r"^\s*((?:★\s*)+)\s*(.*)$", body_lines[0])
            if continuation:
                stars = continuation.group(1).count("★")
                tags = normalize(continuation.group(2))
                body_lines = body_lines[1:]
        body = "\n".join(body_lines).strip()
        # Some older-layout columns place the next numbered Level after the end
        # of a wrapped sentence instead of at the start of a physical text line.
        body = re.sub(r"(?<=[.!?])\s+(?=[123]:\s*[A-Z])", "\n", body)
        candidates = list(LEVEL.finditer(body))
        first = next((candidate for candidate in candidates if candidate.group(1) == "1"), None)
        third = next((candidate for candidate in reversed(candidates) if candidate.group(1) == "3"), None)
        second = next((candidate for candidate in reversed(candidates) if candidate.group(1) == "2" and third and candidate.start() < third.start()), None)
        level_matches = [first, second, third]
        if any(level is None for level in level_matches) or not (first.start() < second.start() < third.start()):
            missing = next(number for number, level in enumerate(level_matches, 1) if level is None)
            raise ValueError(f"{match.group(1)} on PDF page {page_number}: level {missing} not found")
        first_level = level_matches[0].start()
        intro = body[:first_level].strip()
        notes = []
        flavor_lines = []
        for line in intro.splitlines():
            if line.startswith(("Alt Resource.", "Transformation.", "Can't take", "Can’t take")):
                notes.append(normalize(line))
            else:
                flavor_lines.append(line)
        techniques.append({
            "archetypeId": archetype_id,
            "name": normalize(match.group(1)),
            "stars": stars,
            "tags": tags,
            "flavor": normalize(" ".join(flavor_lines)).strip('"'),
            "notes": " ".join(notes),
            "levels": [
                {
                    "n": int(level.group(1)),
                    "name": normalize(level.group(2)),
                    "text": re.sub(r"\s+\d+$", "", normalize(body[level.start(3) : (level_matches[index + 1].start() if index + 1 < 3 else len(body))])),
                }
                for index, level in enumerate(level_matches)
            ],
            "source": {"editionId": source_id, "locale": "en", "pdfPage": page_number},
        })
    return techniques


def extract_techniques(path: Path, ranges: dict[str, tuple[int, int]], source_id: str, expected: int) -> list[dict]:
    result = []
    with pdfplumber.open(path) as pdf:
        for archetype_id, (first, last) in ranges.items():
            for page_number in range(first, last + 1):
                for column in extract_columns(pdf.pages[page_number - 1]):
                    result.extend(parse_technique_column(column, archetype_id, page_number, source_id))
    if len(result) != expected:
        raise ValueError(f"Expected {expected} techniques for {source_id}, extracted {len(result)}")
    return result


def extract_new_techniques() -> list[dict]:
    return extract_techniques(NEW_PDF, ARCHETYPE_RANGES, NEW_ID, 111)


def extract_old_techniques(current: dict) -> list[dict]:
    techniques = extract_techniques(OLD_PDF, OLD_ARCHETYPE_RANGES, OLD_ID, 107)
    current_by_name = {
        normalize(technique["en"]).lower(): technique["id"]
        for archetype in current["archetypes"]
        for technique in archetype["techniques"]
    }
    for technique in techniques:
        stable_id = current_by_name.get(normalize(technique["name"]).lower())
        if stable_id is None:
            raise ValueError(f'Old English Technique has no stable ID: {technique["name"]}')
        technique["id"] = stable_id
        technique["source"]["locale"] = "en"
    return techniques


def parse_outlooks(current: dict, path: Path = NEW_PDF, columns: list[tuple] = OUTLOOK_COLUMNS, source_id: str = NEW_ID) -> list[dict]:
    old = {item["id"]: item for item in current["outlooks"]}
    result = []
    with pdfplumber.open(path) as pdf:
        for index, (page_number, outlook_id, name) in enumerate(columns):
            page = pdf.pages[page_number - 1]
            column = extract_columns(page)[index % 2]
            lines = [line.strip() for line in column.splitlines() if line.strip()]
            try:
                title_at = lines.index(name)
            except ValueError as error:
                raise ValueError(f"{name} not found on PDF page {page_number}") from error
            question_at = next((
                i for i in range(title_at + 1, len(lines))
                if lines[i].startswith("If this is your Primary") or lines[i] == "Favored Bond Actions"
            ), len(lines))
            description = normalize(" ".join(lines[title_at + 1 : question_at]))
            section_at = next((i for i, line in enumerate(lines) if line in {"Boons", "Inherent Boon"}), None)
            if section_at is None:
                raise ValueError(f"Boons not found for {name} on PDF page {page_number}")
            boon_lines = lines[section_at + 1 :]
            if boon_lines and re.fullmatch(r"\d+", boon_lines[-1]):
                boon_lines.pop()
            inherent_name = None
            if "Inherent Boon" in lines:
                inherent_at = lines.index("Inherent Boon")
                inherent_match = next((re.match(r'^([A-Z“"].{1,69}?):\s+(.*)$', line) for line in lines[inherent_at + 1 :] if re.match(r'^([A-Z“"].{1,69}?):\s+(.*)$', line)), None)
                inherent_name = normalize(inherent_match.group(1)).strip('"') if inherent_match else None
            entries = []
            active = None
            for line in boon_lines:
                if line in {"Boons", "Inherent Boon"}:
                    continue
                match = re.match(r'^([A-Z“"].{1,69}?):\s+(.*)$', line)
                if match and not match.group(1).startswith(("If this", "Also ask")):
                    active = {"name": normalize(match.group(1)).strip('"'), "text": match.group(2)}
                    entries.append(active)
                elif active:
                    active["text"] += " " + line
            old_outlook = old[outlook_id]
            old_gifts = {
                normalize(gift.get("en", "")).strip('"'): gift
                for gift in ([old_outlook.get("builtin")] if old_outlook.get("builtin") else []) + old_outlook["gifts"]
                if gift
            }
            gifts = []
            builtin = None
            for entry in entries:
                previous = old_gifts.get(normalize(entry["name"]).strip('"'))
                gift = {
                    "id": previous["id"] if previous else f'{outlook_id}.{slugify(entry["name"])}',
                    "name": entry["name"],
                    "en": entry["name"],
                    "text": normalize(entry["text"]),
                    "introducedIn": None if previous else source_id,
                }
                if entry["name"] == inherent_name or (old_outlook.get("builtin") and gift["id"] == old_outlook["builtin"]["id"]):
                    builtin = gift
                else:
                    gifts.append(gift)
            result.append({
                "id": outlook_id,
                "name": name.removeprefix("The "),
                "description": description,
                "builtin": builtin,
                "gifts": gifts,
                "source": {"editionId": source_id, "locale": "en", "pdfPage": page_number},
            })
    return result


OLD_ABILITY_TEXT_REPAIRS = {
    "It'sA S pecificT ime": "It's A Specific Time",
    "You'reC arryingI t": "You're Carrying It",
    "Light/ S hadow": "Light / Shadow",
    "YouH ear/ S mellI t": "You Hear / Smell It",
    "Animals/ M onsters": "Animals / Monsters",
    "YouD ance": "You Dance",
    "YouA ren'tS een": "You Aren't Seen",
    "You UnderstandI t": "You Understand It",
    "RangedW eapons✝": "Ranged Weapons✝",
    "YouE xplainI t": "You Explain It",
    "Negate/ R everse": "Negate / Reverse",
    "ItC anH earY ou": "It Can Hear You",
}


def parse_old_ability_rows(page) -> list[list[str]]:
    words = [word for word in page.extract_words() if 135 <= word["top"] <= 585]
    tops = []
    for word in words:
        if not any(abs(top - word["top"]) < 2 for top in tops):
            tops.append(word["top"])
    rows = []
    bounds = ((0, 165), (165, 210), (210, 345), (345, 395), (395, 520), (520, 595))
    for top in tops:
        row_words = [word for word in words if abs(top - word["top"]) < 2]
        cells = [normalize(" ".join(word["text"] for word in row_words if low <= word["x0"] < high)) for low, high in bounds]
        if re.fullmatch(r"-?\d+|X", cells[1]) and re.fullmatch(r"-?\d+|X", cells[3]) and re.fullmatch(r"-?\d+|X", cells[5]):
            rows.append([OLD_ABILITY_TEXT_REPAIRS.get(cell, cell) for cell in cells])
    if len(rows) != 20:
        raise ValueError(f"Expected 20 old Ability Glossary rows, extracted {len(rows)}")
    return rows


def parse_ability_words(path: Path = NEW_PDF, pdf_page: int = 46, source_id: str = NEW_ID) -> dict:
    groups = {"verbs": [], "nouns": [], "conditions": []}
    with pdfplumber.open(path) as pdf:
        page = pdf.pages[pdf_page - 1]
        tables = page.extract_tables()
        rows = tables[0][1:] if tables and len(tables[0]) == 22 else parse_old_ability_rows(page)
    columns = (("verbs", 0, 1), ("nouns", 3, 4), ("conditions", 6, 7)) if len(rows[0]) >= 8 else (("verbs", 0, 1), ("nouns", 2, 3), ("conditions", 4, 5))
    for row in rows:
        for group, label_index, cost_index in columns:
            label, raw_cost = row[label_index], row[cost_index]
            marks = "".join(mark for mark in "✢✧✝☾" if mark in label)
            clean = normalize(re.sub(r"[✢✧✝☾]", "", label))
            for variant in [part.strip() for part in clean.split(" / ") if part.strip()]:
                groups[group].append({
                    "id": f'ability.en.{group}.{slugify(variant)}',
                    "name": variant,
                    "cost": int(raw_cost) if re.fullmatch(r"-?\d+", raw_cost) else None,
                    "costLabel": raw_cost,
                    "marks": marks.replace("✧", "✝"),
                    "source": {"editionId": source_id, "locale": "en", "pdfPage": pdf_page},
                })
    return groups


def parse_reference_sections() -> list[dict]:
    # The companion reference is an index of compact, task-oriented cards. Full
    # chapters stay in the future Rules area instead of being dumped into search.
    cards = [
        ("creation-order", "Character Creation Checklist", "Creation, Checklist",
         "Choose a concept and Tier. Assign Attributes, choose Outlooks and Boons, spend Ranks on Skills and an Ability, then buy Technique Levels. Finish by recording your derived statistics.", 24),
        ("starting-attributes", "Starting Attributes", "Creation, Attributes",
         "Assign 4, 3, 2, and 2 among Body, Talent, Spirit, and Mind. Attribute growth and the Technique-Level conversion are handled by the builder.", 22),
        ("starting-ranks", "Starting Ranks", "Creation, Skills, Ability",
         "A new hero starts with 8 Character Ranks. Spend at least 4 on Skills; the rest may be spent on Skills or an Ability. Ranks range from 1 to 3.", 24),
        ("outlooks-boons", "Outlooks and Boons", "Creation, Outlooks, Boons",
         "Choose a Primary Outlook and its inherent Boon, then choose two additional Boons from your selected Outlooks. Higher-Tier heroes gain more options in the builder.", 23),
        ("technique-levels", "Technique Levels", "Creation, Techniques",
         "A new hero has 5 Technique Levels. Buy Levels in order within a Technique. The searchable Technique catalogue contains the complete LionWing text for every Level.", 24),
        ("ability-formula", "Ability Formula", "Creation, Ability",
         "Build an Ability from Verbs, Nouns, and Conditions. Its cost is calculated from the selected words and Rank. Symbol-specific exceptions are shown beside the Ability editor.", 45),
        ("derived-statistics", "Derived Statistics", "Creation, Statistics",
         "Health, Guts, Speed, and Focus are calculated automatically from the hero's Tier and Attributes. The summary and character sheet always show the current result.", 24),
    ]
    return [{
        "id": f"lionwing.reference.{card_id}",
        "name": name,
        "kind": "Builder Reference",
        "tags": tags,
        "text": text,
        "source": {"editionId": NEW_ID, "pdfPage": page_number},
    } for card_id, name, tags, text, page_number in cards]


def assign_ids(techniques: list[dict], current: dict) -> tuple[list[dict], dict]:
    old_by_name = {
        tech["en"]: {**tech, "archetypeId": archetype["id"]}
        for archetype in current["archetypes"]
        for tech in archetype["techniques"]
    }
    used = set()
    mapping = {}
    evidence = {}
    for tech in techniques:
        migration = NAME_MIGRATIONS.get(tech["name"])
        old_name = tech["name"] if tech["name"] in old_by_name else migration[0] if migration else None
        old = old_by_name.get(old_name)
        if old and old["id"] not in used:
            tech["id"] = old["id"]
            tech["previousName"] = old_name if old_name != tech["name"] else None
            tech["previousArchetypeId"] = old["archetypeId"] if old["archetypeId"] != tech["archetypeId"] else None
            used.add(old["id"])
            mapping[old["id"]] = tech["name"]
            if migration:
                evidence[old["id"]] = {
                    "oldName": migration[0], "newName": tech["name"],
                    "confidence": migration[1], "basis": migration[2],
                }
        else:
            tech["id"] = f'{tech["archetypeId"]}.{slugify(tech["name"])}'
            tech["introducedIn"] = NEW_ID
    return techniques, {
        "mappedIds": mapping,
        "migrationEvidence": evidence,
        "removedIds": sorted(set(item["id"] for item in old_by_name.values()) - used),
    }


def section_page_text(path: Path) -> list[str]:
    with pdfplumber.open(path) as pdf:
        return [normalize(page.extract_text(x_tolerance=2, y_tolerance=3) or "") for page in pdf.pages]


def page_change_candidates() -> list[dict]:
    old_pages = section_page_text(OLD_PDF)
    new_pages = section_page_text(NEW_PDF)
    word_sets = lambda pages: [set(re.findall(r"[a-z]{4,}", page.lower())) for page in pages]
    old_words, new_words = word_sets(old_pages), word_sets(new_pages)
    candidates = []
    for new_index, words in enumerate(new_words):
        scored = []
        for old_index, old in enumerate(old_words):
            union = words | old
            score = len(words & old) / len(union) if union else (1.0 if not words and not old else 0.0)
            scored.append((score, old_index))
        score, old_index = max(scored)
        classification = "minor-or-layout" if score >= 0.82 else "changed" if score >= 0.42 else "new-or-restructured"
        heading = re.sub(r"\s+", " ", new_pages[new_index])[:90]
        candidates.append({
            "newPdfPage": new_index + 1,
            "bestOldPdfPage": old_index + 1,
            "similarity": round(score, 3),
            "classification": classification,
            "headingSample": heading,
        })
    return candidates


def build_detected_changes(current: dict, techniques: list[dict], mapping: dict, page_changes: list[dict]) -> dict:
    old = {tech["id"]: {**tech, "archetypeId": arch["id"]} for arch in current["archetypes"] for tech in arch["techniques"]}
    changes = []
    for tech in techniques:
        previous = old.get(tech["id"])
        if previous is None:
            kind = "addition"
        elif tech.get("previousName") or tech.get("previousArchetypeId"):
            kind = "terminology"
        else:
            kind = "mechanics"
        changes.append({
            "id": f'technique-{slugify(tech["id"])}',
            "stableId": tech["id"],
            "kind": kind,
            "oldName": previous["en"] if previous else None,
            "newName": tech["name"],
            "oldArchetypeId": previous["archetypeId"] if previous else None,
            "newArchetypeId": tech["archetypeId"],
            "newPages": [tech["source"]["pdfPage"]],
            "requiresReview": True,
        })
    for stable_id in mapping["removedIds"]:
        previous = old[stable_id]
        changes.append({
            "id": f'technique-{slugify(stable_id)}-removed',
            "stableId": stable_id,
            "kind": "removal",
            "oldName": previous["en"],
            "newName": None,
            "oldArchetypeId": previous["archetypeId"],
            "newArchetypeId": None,
            "newPages": [],
            "requiresReview": True,
        })
    return {
        "schemaVersion": 1,
        "baseEditionId": OLD_ID,
        "editionId": NEW_ID,
        "generator": "tools/content/build_lionwing_companion.py",
        "counts": {
            "oldTechniques": len(old),
            "newTechniques": len(techniques),
            "mapped": len(mapping["mappedIds"]),
            "additions": sum(item["kind"] == "addition" for item in changes),
            "removals": sum(item["kind"] == "removal" for item in changes),
            "renamesOrMoves": sum(item["kind"] == "terminology" for item in changes),
            "changedPages": sum(item["classification"] != "minor-or-layout" for item in page_changes),
        },
        "pageChanges": page_changes,
        "changes": changes,
    }


def write_report(detected: dict) -> None:
    counts = detected["counts"]
    changes = detected["changes"]
    rows = [
        "# Расхождения старой DAWN и LionWing Edition",
        "",
        "> Автоматически сгенерированный индекс. Он показывает участки для просмотра,",
        "> но не является решением переводчика или подтверждением механики.",
        "",
        f"- Старая редакция: `{OLD_ID}` ({counts['oldTechniques']} Техник).",
        f"- Новая редакция: `{NEW_ID}` ({counts['newTechniques']} Техник).",
        f"- Сопоставлено по стабильным ID: {counts['mapped']}.",
        f"- Кандидаты добавлений: {counts['additions']}; удалений: {counts['removals']}; переименований/переносов: {counts['renamesOrMoves']}.",
        "",
        "## Переименования и переносы",
        "",
        "| Stable ID | Было | Стало | Архетип | Страница новой PDF |",
        "|---|---|---|---|---:|",
    ]
    for item in changes:
        if item["kind"] != "terminology":
            continue
        old_arch = item["oldArchetypeId"] or "—"
        new_arch = item["newArchetypeId"] or "—"
        rows.append(f'| `{item["stableId"]}` | {item["oldName"]} | {item["newName"]} | {old_arch} → {new_arch} | {item["newPages"][0]} |')
    rows += ["", "## Новые Техники-кандидаты", "", "| ID-кандидат | Название | Архетип | Страница |", "|---|---|---|---:|"]
    for item in changes:
        if item["kind"] == "addition":
            rows.append(f'| `{item["stableId"]}` | {item["newName"]} | {item["newArchetypeId"]} | {item["newPages"][0]} |')
    rows += ["", "## Отсутствующие в LionWing кандидаты", "", "| Stable ID | Старое название | Архетип |", "|---|---|---|"]
    for item in changes:
        if item["kind"] == "removal":
            rows.append(f'| `{item["stableId"]}` | {item["oldName"]} | {item["oldArchetypeId"]} |')
    rows += [
        "",
        "## Механическая карта страниц всей книги",
        "",
        "Сходство считается по набору английских слов. Низкий балл означает новый или",
        "сильно перестроенный материал; это указатель для ревью, а не содержательный вывод.",
        "",
        "| LionWing PDF | Лучший кандидат старой PDF | Сходство | Класс | Начало страницы |",
        "|---:|---:|---:|---|---|",
    ]
    for item in detected["pageChanges"]:
        rows.append(f'| {item["newPdfPage"]} | {item["bestOldPdfPage"]} | {item["similarity"]:.3f} | {item["classification"]} | {item["headingSample"].replace("|", "/")} |')
    rows += [
        "",
        "## Как использовать отчёт",
        "",
        "1. Просмотреть кандидата на указанных страницах обеих PDF.",
        "2. Зафиксировать подтверждённое решение в `changes.json`.",
        "3. Отдельно отметить перевод, влияние на механику и готовность компаньона.",
        "4. Не править этот файл вручную: он пересобирается вместе с EN-каталогом.",
        "",
    ]
    (EDITION / "VERSION-DIFFERENCES.md").write_text("\n".join(rows), encoding="utf-8")


def technique_comparison(old_techniques: list[dict], new_techniques: list[dict]) -> list[dict]:
    old = {item["id"]: item for item in old_techniques}
    new = {item["id"]: item for item in new_techniques}
    result = []
    for stable_id in sorted(old.keys() | new.keys()):
        before, after = old.get(stable_id), new.get(stable_id)
        if before is None:
            result.append({"stableId": stable_id, "classification": "added", "translationAction": "translate-new", "oldEnglishHash": None, "newEnglishHash": source_hash(after), "old": None, "new": after})
            continue
        if after is None:
            result.append({"stableId": stable_id, "classification": "removed", "translationAction": "retire", "oldEnglishHash": source_hash(before), "newEnglishHash": None, "old": before, "new": None})
            continue
        fields = []
        for field in ("name", "archetypeId", "stars", "tags", "notes", "flavor"):
            old_value, new_value = before.get(field, ""), after.get(field, "")
            if normalize(str(old_value)) != normalize(str(new_value)):
                fields.append({"field": field, "old": old_value, "new": new_value})
        for number in (1, 2, 3):
            old_level, new_level = before["levels"][number - 1], after["levels"][number - 1]
            for field in ("name", "text"):
                old_value, new_value = old_level[field], new_level[field]
                if normalize(old_value) != normalize(new_value):
                    fields.append({
                        "field": f"levels.{number}.{field}",
                        "old": old_value,
                        "new": new_value,
                    })
        classification = "changed" if fields else "unchanged"
        result.append({
            "stableId": stable_id,
            "classification": classification,
            "translationAction": "retranslate" if fields else "reuse-existing-ru",
            "mechanicsReviewRequired": any(item["field"] == "stars" or item["field"] == "notes" or item["field"].endswith(".text") for item in fields),
            "oldEnglishHash": source_hash(before),
            "newEnglishHash": source_hash(after),
            "oldPage": before["source"].get("pdfPage"),
            "newPage": after["source"]["pdfPage"],
            "oldName": before["name"],
            "newName": after["name"],
            "fields": fields,
        })
    return result


def ability_word_comparison(old_words: dict, new_words: dict) -> list[dict]:
    result = []
    for group in ("verbs", "nouns", "conditions"):
        old = {normalize(item["name"]).lower(): item for item in old_words[group]}
        new = {normalize(item["name"]).lower(): item for item in new_words[group]}
        for key in sorted(old.keys() | new.keys()):
            before, after = old.get(key), new.get(key)
            mechanic_fields = [] if before is None or after is None else [field for field in ("costLabel", "marks") if before.get(field) != after.get(field)]
            result.append({
                "group": group,
                "key": key,
                "classification": "added" if before is None else "removed" if after is None else "mechanics-changed" if mechanic_fields else "unchanged",
                "translationAction": "translate-new" if before is None else "retire" if after is None else "reuse-existing-ru",
                "old": before,
                "new": after,
                "changedFields": mechanic_fields,
            })
    return result


def outlook_comparison(old_outlooks: list[dict], new_outlooks: list[dict]) -> list[dict]:
    old = {item["id"]: item for item in old_outlooks}
    result = []
    for after in new_outlooks:
        before = old[after["id"]]
        flatten = lambda outlook: {item["id"]: {**item, "inherent": item is outlook.get("builtin")} for item in ([outlook.get("builtin")] if outlook.get("builtin") else []) + outlook["gifts"] if item}
        old_boons, new_boons = flatten(before), flatten(after)
        boons = []
        for stable_id in sorted(old_boons.keys() | new_boons.keys()):
            old_boon, new_boon = old_boons.get(stable_id), new_boons.get(stable_id)
            fields = [] if old_boon is None or new_boon is None else [field for field in ("name", "text", "inherent") if old_boon.get(field) != new_boon.get(field)]
            boons.append({
                "stableId": stable_id,
                "classification": "added" if old_boon is None else "removed" if new_boon is None else "changed" if fields else "unchanged",
                "translationAction": "translate-new" if old_boon is None else "retire" if new_boon is None else "retranslate" if fields else "reuse-existing-ru",
                "changedFields": fields,
                "old": old_boon,
                "new": new_boon,
            })
        description_changed = normalize(before["description"]) != normalize(after["description"])
        result.append({
            "stableId": after["id"],
            "oldPage": before["source"].get("pdfPage"),
            "newPage": after["source"]["pdfPage"],
            "description": {
                "classification": "changed" if description_changed else "unchanged",
                "translationAction": "retranslate" if description_changed else "reuse-existing-ru",
                "old": before["description"],
                "new": after["description"],
            },
            "boons": boons,
        })
    return result


def section_comparison() -> list[dict]:
    sections = [
        ("character-creation", "Character Creation", (30, 32), (22, 24), "P0"),
        ("abilities", "Abilities and Ability Glossary", (43, 44), (45, 46), "P0"),
        ("outlooks-boons", "Outlooks and Boons", (47, 52), (49, 54), "P0"),
        ("combat-core", "Combat core, Effects, and Basic Actions", (53, 63), (55, 65), "P1"),
        ("techniques", "Techniques", (64, 100), (67, 103), "P0"),
        ("narrator-tools", "Narrator Tools", (101, 126), (104, 134), "P2"),
    ]
    def corpus(path: Path, first: int, last: int) -> str:
        with pdfplumber.open(path) as pdf:
            return normalize(" ".join((pdf.pages[index - 1].extract_text() or "") for index in range(first, last + 1)))
    words = lambda text: Counter(re.findall(r"[a-z]{4,}", text.lower()))
    result = []
    for section_id, name, old_range, new_range, priority in sections:
        before, after = corpus(OLD_PDF, *old_range), corpus(NEW_PDF, *new_range)
        old_counts, new_counts = words(before), words(after)
        added = [word for word, count in (new_counts - old_counts).most_common(20)]
        removed = [word for word, count in (old_counts - new_counts).most_common(20)]
        old_set, new_set = set(old_counts), set(new_counts)
        union = old_set | new_set
        similarity = len(old_set & new_set) / len(union) if union else 1.0
        result.append({"id": section_id, "name": name, "priority": priority, "oldPages": list(old_range), "newPages": list(new_range), "similarity": round(similarity, 3), "prominentAddedTerms": added, "prominentRemovedTerms": removed})
    return result


def build_edition_comparison(old_techniques: list[dict], new_techniques: list[dict], old_outlooks: list[dict], new_outlooks: list[dict], old_words: dict, new_words: dict) -> dict:
    techniques = technique_comparison(old_techniques, new_techniques)
    ability_words = ability_word_comparison(old_words, new_words)
    outlooks = outlook_comparison(old_outlooks, new_outlooks)
    return {
        "schemaVersion": 1,
        "baseEditionId": OLD_ID,
        "targetEditionId": NEW_ID,
        "policy": {
            "base": "frozen-playable-edition",
            "baseEnglishTextAuthority": True,
            "baseRussianTranslationAuthority": False,
            "target": "active-development-canonical-source",
            "targetTextAuthority": True,
            "crossEditionFallback": "display-only-explicit",
            "mutateBase": False,
        },
        "summary": {
            "techniques": dict(Counter(item["classification"] for item in techniques)),
            "abilityWords": dict(Counter(item["classification"] for item in ability_words)),
            "outlookDescriptions": dict(Counter(item["description"]["classification"] for item in outlooks)),
            "boons": dict(Counter(boon["classification"] for outlook in outlooks for boon in outlook["boons"])),
        },
        "migrationOrder": [
            {"priority": "P0", "domain": "builder-shell", "goal": "Complete LionWing character creation without changing 0.9 saves or budgets."},
            {"priority": "P0", "domain": "techniques", "goal": "Review likely mechanical field changes and create LionWing-specific adapters."},
            {"priority": "P0", "domain": "outlooks-abilities", "goal": "Translate new Boons, inherent Boons, Ability words, symbols, and costs."},
            {"priority": "P1", "domain": "core-rules", "goal": "Port Effects, Basic Actions, combat formulas, and derived statistics into a separate LionWing rules layer."},
            {"priority": "P2", "domain": "narrator-table", "goal": "Upgrade enemies and table automation only after the LionWing core rules are reviewed."},
        ],
        "sections": section_comparison(),
        "techniques": techniques,
        "abilityWords": ability_words,
        "outlooks": outlooks,
    }


def source_hash(value) -> str:
    def content_only(item):
        if isinstance(item, dict):
            ignored = {"source", "introducedIn", "previousName", "previousArchetypeId"}
            return {key: content_only(inner) for key, inner in item.items() if key not in ignored}
        if isinstance(item, list):
            return [content_only(inner) for inner in item]
        return item
    payload = normalize(json.dumps(content_only(value), ensure_ascii=False, sort_keys=True))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def build_translation_worklist(comparison: dict) -> dict:
    units = []
    for item in comparison["techniques"]:
        units.append({
            "id": f'technique:{item["stableId"]}', "domain": "technique", "stableId": item["stableId"],
            "action": item["translationAction"], "status": "pending" if item["translationAction"] in {"retranslate", "translate-new"} else "reusable" if item["translationAction"] == "reuse-existing-ru" else "retired",
            "changedFields": [field["field"] for field in item.get("fields", [])],
            "oldEnglishHash": item["oldEnglishHash"],
            "newEnglishHash": item["newEnglishHash"],
        })
    for outlook in comparison["outlooks"]:
        description = outlook["description"]
        units.append({
            "id": f'outlook:{outlook["stableId"]}:description', "domain": "outlook", "stableId": outlook["stableId"],
            "action": description["translationAction"], "status": "pending" if description["translationAction"] == "retranslate" else "reusable",
            "changedFields": ["description"] if description["classification"] == "changed" else [],
            "oldEnglishHash": source_hash(description["old"]), "newEnglishHash": source_hash(description["new"]),
        })
        for boon in outlook["boons"]:
            units.append({
                "id": f'boon:{boon["stableId"]}', "domain": "boon", "stableId": boon["stableId"],
                "action": boon["translationAction"], "status": "pending" if boon["translationAction"] in {"retranslate", "translate-new"} else "reusable" if boon["translationAction"] == "reuse-existing-ru" else "retired",
                "changedFields": boon["changedFields"],
                "oldEnglishHash": source_hash(boon["old"]) if boon["old"] else None,
                "newEnglishHash": source_hash(boon["new"]) if boon["new"] else None,
            })
    for word in comparison["abilityWords"]:
        units.append({
            "id": f'ability-word:{word["group"]}:{word["key"]}', "domain": "ability-word", "stableId": word["new"]["id"] if word["new"] else word["old"]["id"],
            "action": word["translationAction"], "status": "pending" if word["translationAction"] == "translate-new" else "reusable" if word["translationAction"] == "reuse-existing-ru" else "retired",
            "changedFields": word["changedFields"],
            "oldEnglishHash": source_hash(word["old"]) if word["old"] else None,
            "newEnglishHash": source_hash(word["new"]) if word["new"] else None,
        })
    return {
        "schemaVersion": 1,
        "sourceEditionId": OLD_ID,
        "targetEditionId": NEW_ID,
        "rule": "Reuse the existing Russian translation only when normalized old and new English source text is unchanged.",
        "summary": {domain: dict(Counter(item["action"] for item in units if item["domain"] == domain)) for domain in ("technique", "outlook", "boon", "ability-word")},
        "units": units,
    }


def write_translation_worklist(worklist: dict) -> None:
    (EDITION / "translation-worklist.json").write_text(json.dumps(worklist, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    rows = [
        "# Очередь нового русского перевода LionWing", "",
        "> Старый русский текст разрешено переносить только для записей `reuse-existing-ru`.",
        "> `retranslate` и `translate-new` всегда переводятся с английского LionWing.", "",
        "## Сводка", "",
    ]
    labels = {"technique": "Техники", "outlook": "Мировоззрения", "boon": "Дары", "ability-word": "Слова Способностей"}
    for domain, counts in worklist["summary"].items():
        rows.append(f'- **{labels[domain]}:** {counts}.')
    rows += ["", "## Требуют перевода", "", "| Область | Stable ID | Действие | Изменённые поля |", "|---|---|---|---|"]
    for item in worklist["units"]:
        if item["action"] not in {"retranslate", "translate-new"}:
            continue
        rows.append(f'| {labels[item["domain"]]} | `{item["stableId"]}` | `{item["action"]}` | {", ".join(item["changedFields"]) or "вся новая запись"} |')
    rows.append("")
    (EDITION / "TRANSLATION-WORKLIST.md").write_text("\n".join(rows), encoding="utf-8")


def build_translation_scaffold(current: dict, worklist: dict, old_ability_words: dict) -> dict:
    techniques = {item["id"]: item for archetype in current["archetypes"] for item in archetype["techniques"]}
    outlooks = {item["id"]: item for item in current["outlooks"]}
    boons = {
        item["id"]: item
        for outlook in current["outlooks"]
        for item in ([outlook.get("builtin")] if outlook.get("builtin") else []) + outlook["gifts"]
        if item
    }
    ability_candidates = {}
    for group in ("verbs", "nouns", "conditions"):
        for english, russian in zip(old_ability_words[group], current["abilityWords"][group], strict=True):
            ability_candidates[english["id"]] = russian["name"]

    entries = []
    for unit in worklist["units"]:
        action, domain, stable_id = unit["action"], unit["domain"], unit["stableId"]
        candidate = None
        if action == "reuse-existing-ru":
            if domain == "technique":
                source = techniques[stable_id]
                candidate = {"name": source["name"], "flavor": source.get("flavor", ""), "levels": [{"n": level["n"], "name": level["name"], "text": level["text"]} for level in source["levels"]]}
            elif domain == "outlook":
                candidate = outlooks[stable_id]["desc"]
            elif domain == "boon":
                source = boons[stable_id]
                candidate = {"name": source["name"], "text": source["text"]}
            elif domain == "ability-word":
                candidate = ability_candidates[stable_id]
        entries.append({
            "id": unit["id"], "domain": domain, "stableId": stable_id,
            "sourceHash": unit["newEnglishHash"],
            "status": "reused-needs-review" if candidate is not None else "retired" if action == "retire" else "untranslated",
            "ru": candidate,
        })
    return {
        "schemaVersion": 1,
        "editionId": NEW_ID,
        "locale": "ru",
        "status": "generated-scaffold-not-runtime-data",
        "policy": "Reused Russian strings still require review; untranslated slots must be translated from the canonical LionWing English source.",
        "entries": entries,
    }


def write_migration_report(comparison: dict) -> None:
    summary = comparison["summary"]
    rows = [
        "# Карта миграции DAWN 0.9 -> LionWing", "",
        "> DAWN 0.9 заморожена как рабочая игровая редакция. Ни одно изменение",
        "> LionWing не применяется к ней без явного переключателя редакции.", "",
        "## Сводка машинного сравнения", "",
        f"- Техники: {summary['techniques']}.",
        f"- Слова Способностей: {summary['abilityWords']}.",
        f"- Дары: {summary['boons']}.", "",
        "## Очерёдность переноса", "",
    ]
    for item in comparison["migrationOrder"]:
        rows.append(f"- **{item['priority']} · {item['domain']}** — {item['goal']}")
    rows += ["", "## Крупные разделы", "", "| Приоритет | Раздел | Старые страницы | LionWing | Сходство |", "|---|---|---:|---:|---:|"]
    for item in comparison["sections"]:
        rows.append(f"| {item['priority']} | {item['name']} | {item['oldPages'][0]}-{item['oldPages'][1]} | {item['newPages'][0]}-{item['newPages'][1]} | {item['similarity']:.3f} |")
    rows += ["", "## Техники, которые переводятся заново", "", "| Stable ID | Было -> стало | Страницы | Изменённые поля |", "|---|---|---:|---|"]
    for item in comparison["techniques"]:
        if item["translationAction"] != "retranslate":
            continue
        fields = ", ".join(change["field"] for change in item["fields"])
        rows.append(f"| `{item['stableId']}` | {item['oldName']} -> {item['newName']} | {item['oldPage']} -> {item['newPage']} | {fields} |")
    rows += ["", "Полные значения до/после находятся в `edition-comparison.json`.", ""]
    (EDITION / "MIGRATION-MAP.md").write_text("\n".join(rows), encoding="utf-8")


def write_canonical_corpus(overlay: dict) -> None:
    canonical = EDITION / "canonical"
    archetypes = canonical / "archetypes"
    archetypes.mkdir(parents=True, exist_ok=True)
    files = []
    for archetype in overlay["archetypes"]:
        relative = f'archetypes/{archetype["id"]}.json'
        (canonical / relative).write_text(json.dumps(archetype, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        files.append(relative)
    for name, value in (
        ("outlooks.json", overlay["outlooks"]),
        ("ability-words.json", overlay["abilityWords"]),
        ("builder-reference.json", overlay["reference"]),
        ("id-map.json", {"mappedIds": overlay["mappedIds"], "migrationEvidence": overlay["migrationEvidence"], "removedIds": overlay["removedIds"]}),
    ):
        (canonical / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        files.append(name)
    manifest = {
        "schemaVersion": 1,
        "editionId": overlay["editionId"],
        "locale": overlay["locale"],
        "mechanicsLocale": overlay["mechanicsLocale"],
        "status": "active-development",
        "purpose": "Canonical English translation and companion source; generated from the local licensed PDF.",
        "authority": {"englishText": "LionWing", "russian09": "compatibility-snapshot-only"},
        "generatedBy": "tools/content/build_lionwing_companion.py",
        "counts": {
            "archetypes": len(overlay["archetypes"]),
            "techniques": sum(len(item["techniques"]) for item in overlay["archetypes"]),
            "outlooks": len(overlay["outlooks"]),
            "abilityWords": {group: len(items) for group, items in overlay["abilityWords"].items()},
            "referenceCards": len(overlay["reference"]),
        },
        "files": files,
    }
    (canonical / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    if pdf_sha256(NEW_PDF) != "cb2f8e675dc90152b5d70780262622a42be679853bf289b4c6e80d1ed0ea747d":
        raise ValueError("LionWing PDF fingerprint does not match source/text-sources.json")
    current = read_current_data()
    old_techniques = extract_old_techniques(current)
    techniques, mapping = assign_ids(extract_new_techniques(), current)
    old_outlooks = parse_outlooks(current, OLD_PDF, OLD_OUTLOOK_COLUMNS, OLD_ID)
    new_outlooks = parse_outlooks(current)
    old_ability_words = parse_ability_words(OLD_PDF, 44, OLD_ID)
    new_ability_words = parse_ability_words()
    archetype_names = {
        "powerhouse": "Powerhouse", "vagabond": "Vagabond", "bulwark": "Bulwark",
        "altruist": "Altruist", "disruptor": "Disruptor", "ruiner": "Ruiner",
    }
    overlay = {
        "schemaVersion": 1,
        "editionId": NEW_ID,
        "locale": "en",
        "scope": ["builder", "reference", "techniques"],
        "mechanicsLocale": "ru",
        "archetypes": [
            {"id": archetype_id, "name": name, "techniques": [item for item in techniques if item["archetypeId"] == archetype_id]}
            for archetype_id, name in archetype_names.items()
        ],
        "outlooks": new_outlooks,
        "abilityWords": new_ability_words,
        "reference": parse_reference_sections(),
        **mapping,
    }
    (EDITION / "extracted-companion.json").write_text(
        json.dumps(overlay, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (APP / "edition-lionwing.js").write_text(
        "// Generated by tools/content/build_lionwing_companion.py.\nwindow.DAWN_LIONWING_DATA = "
        + json.dumps(overlay, ensure_ascii=False, indent=1) + ";\n",
        encoding="utf-8",
    )
    write_canonical_corpus(overlay)
    OLD_EDITION.mkdir(parents=True, exist_ok=True)
    (OLD_EDITION / "extracted-comparison-source.json").write_text(json.dumps({
        "schemaVersion": 1, "editionId": OLD_ID, "locale": "en",
        "purpose": "Complete old-English comparison source; not the LionWing translation authority.",
        "techniques": old_techniques, "outlooks": old_outlooks, "abilityWords": old_ability_words,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    detected = build_detected_changes(current, techniques, mapping, page_change_candidates())
    (EDITION / "detected-changes.json").write_text(json.dumps(detected, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    comparison = build_edition_comparison(old_techniques, techniques, old_outlooks, new_outlooks, old_ability_words, new_ability_words)
    (EDITION / "edition-comparison.json").write_text(json.dumps(comparison, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    worklist = build_translation_worklist(comparison)
    write_translation_worklist(worklist)
    (EDITION / "translation-ru.scaffold.json").write_text(
        json.dumps(build_translation_scaffold(current, worklist, old_ability_words), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    write_report(detected)
    write_migration_report(comparison)
    print(f"OK: {len(old_techniques)} old and {len(techniques)} LionWing techniques; {detected['counts']['mapped']} mapped ids; translation worklist generated")


if __name__ == "__main__":
    main()
