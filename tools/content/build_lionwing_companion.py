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

OUTLOOK_COLUMNS = [
    (50, "rebel", "The Rebel"), (50, "loyalist", "The Loyal"),
    (51, "beacon", "The Light"), (51, "wolf", "The Wolf"),
    (52, "mentor", "The Mentor"), (52, "student", "The Apprentice"),
    (53, "cursed", "The Accursed"), (53, "blessed", "The Blessed"),
    (54, "quiet", "The Quiet"), (54, "confident", "The Confident"),
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

HEADER = re.compile(r"^(.+?)\s*\|\s*((?:★\s*)+)\|\s*(.*)$")
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


def legacy_techniques(current: dict) -> list[dict]:
    """Use the shipped 0.9 Russian catalogue as the frozen playable baseline."""
    return [
        {
            "id": technique["id"],
            "archetypeId": archetype["id"],
            "name": technique.get("en") or technique["name"],
            "localizedName": technique["name"],
            "stars": technique["stars"],
            "tags": technique.get("tags", ""),
            "flavor": technique.get("flavor", ""),
            "notes": "",
            "levels": [
                {"n": level["n"], "name": level["name"], "text": level["text"]}
                for level in technique["levels"]
            ],
            "source": {"editionId": OLD_ID, "locale": "ru", "pdfPage": None},
        }
        for archetype in current["archetypes"]
        for technique in archetype["techniques"]
    ]


def legacy_outlooks(current: dict) -> list[dict]:
    def boon(item: dict | None) -> dict | None:
        if item is None:
            return None
        return {**item, "name": item.get("en") or item["name"], "localizedName": item["name"]}

    return [
        {
            "id": outlook["id"],
            "name": outlook["name"],
            "description": outlook["desc"],
            "builtin": boon(outlook.get("builtin")),
            "gifts": [boon(item) for item in outlook["gifts"]],
            "source": {"editionId": OLD_ID, "locale": "ru", "pdfPage": None},
        }
        for outlook in current["outlooks"]
    ]


def legacy_ability_words(current: dict) -> dict:
    return {
        group: [
            {**item, "source": {"editionId": OLD_ID, "locale": "ru", "pdfPage": None}}
            for item in current["abilityWords"][group]
        ]
        for group in ("verbs", "nouns", "conditions")
    }


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
        body = "\n".join(lines[start + 1 : end]).strip()
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
            "stars": match.group(2).count("★"),
            "tags": normalize(match.group(3)),
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
            "source": {"editionId": source_id, "pdfPage": page_number},
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
            question_at = next((i for i in range(title_at + 1, len(lines)) if lines[i].startswith("If this is your Primary")), len(lines))
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
                "source": {"editionId": source_id, "pdfPage": page_number},
            })
    return result


def parse_ability_words(path: Path = NEW_PDF, pdf_page: int = 46, source_id: str = NEW_ID) -> dict:
    groups = {"verbs": [], "nouns": [], "conditions": []}
    with pdfplumber.open(path) as pdf:
        tables = pdf.pages[pdf_page - 1].extract_tables()
    if not tables or len(tables[0]) != 22:
        raise ValueError("LionWing Ability Glossary table was not extracted as expected")
    for row in tables[0][1:]:
        for group, label, raw_cost in (("verbs", row[0], row[1]), ("nouns", row[3], row[4]), ("conditions", row[6], row[7])):
            marks = "".join(mark for mark in "✢✧☾" if mark in label)
            clean = normalize(re.sub(r"[✢✧☾]", "", label))
            for variant in [part.strip() for part in clean.split(" / ") if part.strip()]:
                groups[group].append({
                    "id": f'ability.en.{group}.{slugify(variant)}',
                    "name": variant,
                    "cost": int(raw_cost) if re.fullmatch(r"-?\d+", raw_cost) else None,
                    "costLabel": raw_cost,
                    "marks": marks.replace("✧", "✝"),
                    "source": {"editionId": source_id, "pdfPage": pdf_page},
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
            result.append({"stableId": stable_id, "classification": "added", "old": None, "new": after})
            continue
        if after is None:
            result.append({"stableId": stable_id, "classification": "removed", "old": before, "new": None})
            continue
        fields = []
        for field in ("name", "archetypeId", "stars", "tags", "notes", "flavor"):
            old_value, new_value = before.get(field, ""), after.get(field, "")
            if normalize(str(old_value)) != normalize(str(new_value)):
                change = {"field": field, "old": old_value, "new": new_value}
                if field in {"tags", "notes", "flavor"}:
                    change["reviewType"] = "cross-language-source-review"
                fields.append(change)
        for number in (1, 2, 3):
            old_level, new_level = before["levels"][number - 1], after["levels"][number - 1]
            for field in ("name", "text"):
                old_value, new_value = old_level[field], new_level[field]
                if normalize(old_value) != normalize(new_value):
                    fields.append({
                        "field": f"levels.{number}.{field}",
                        "old": old_value,
                        "new": new_value,
                        "reviewType": "cross-language-source-review",
                    })
        mechanical = any(item["field"] == "stars" for item in fields)
        needs_source_review = any(item.get("reviewType") == "cross-language-source-review" for item in fields)
        classification = "likely-mechanics" if mechanical else "source-review-required" if needs_source_review else "editorial-or-taxonomy" if fields else "unchanged"
        result.append({
            "stableId": stable_id,
            "classification": classification,
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
        count = max(len(old_words[group]), len(new_words[group]))
        for index in range(count):
            before = old_words[group][index] if index < len(old_words[group]) else None
            after = new_words[group][index] if index < len(new_words[group]) else None
            mechanic_fields = [] if before is None or after is None else [field for field in ("costLabel", "marks") if before.get(field) != after.get(field)]
            result.append({
                "group": group,
                "position": index + 1,
                "classification": "added" if before is None else "removed" if after is None else "mechanics-review" if mechanic_fields else "translation-pair",
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
                "classification": "added" if old_boon is None else "removed" if new_boon is None else "source-review-required" if fields else "unchanged",
                "changedFields": fields,
                "reviewType": "cross-language-source-review" if fields else None,
                "old": old_boon,
                "new": new_boon,
            })
        result.append({
            "stableId": after["id"],
            "oldPage": before["source"].get("pdfPage"),
            "newPage": after["source"]["pdfPage"],
            "descriptionReviewType": "cross-language-source-review",
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
            "base": "frozen-playable-implementation-snapshot",
            "baseTextAuthority": False,
            "target": "active-development-canonical-source",
            "targetTextAuthority": True,
            "crossEditionFallback": "display-only-explicit",
            "mutateBase": False,
        },
        "summary": {
            "techniques": dict(Counter(item["classification"] for item in techniques)),
            "abilityWords": dict(Counter(item["classification"] for item in ability_words)),
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
    rows += ["", "## Техники с вероятным изменением механики", "", "| Stable ID | Было -> стало | Страницы | Изменённые поля |", "|---|---|---:|---|"]
    for item in comparison["techniques"]:
        if item["classification"] != "likely-mechanics":
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
    old_techniques = legacy_techniques(current)
    techniques, mapping = assign_ids(extract_new_techniques(), current)
    old_outlooks, new_outlooks = legacy_outlooks(current), parse_outlooks(current)
    old_ability_words, new_ability_words = legacy_ability_words(current), parse_ability_words()
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
    detected = build_detected_changes(current, techniques, mapping, page_change_candidates())
    (EDITION / "detected-changes.json").write_text(json.dumps(detected, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    comparison = build_edition_comparison(old_techniques, techniques, old_outlooks, new_outlooks, old_ability_words, new_ability_words)
    (EDITION / "edition-comparison.json").write_text(json.dumps(comparison, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_report(detected)
    write_migration_report(comparison)
    print(f"OK: {len(techniques)} LionWing techniques; {detected['counts']['mapped']} mapped ids; detailed comparison generated")


if __name__ == "__main__":
    main()
