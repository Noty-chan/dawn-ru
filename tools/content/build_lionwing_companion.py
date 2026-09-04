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
         "Health equals 10 + Body + twice Tier. Speed equals 2 + half Talent, rounded up; Focus equals 1 + half Spirit, rounded up. LionWing has no Guts statistic.", 24),
    ]
    return [{
        "id": f"lionwing.reference.{card_id}",
        "name": name,
        "kind": "Builder Reference",
        "tags": tags,
        "text": text,
        "source": {"editionId": NEW_ID, "pdfPage": page_number},
    } for card_id, name, tags, text, page_number in cards]


def core_rules() -> dict:
    effect_source = {"editionId": NEW_ID, "locale": "en", "pdfPage": 61}
    positive_effects = [
        ("positive.изгнан", "Banished", ["Banish"], "Non-Banished characters don't count as a target to you, you don't count as a target to them, and you can take up the same space as another object. Lose this Effect at the beginning of your Turn. When a character applies Banished, all other characters that have been Banished by them lose it."),
        ("positive.ускорен", "Hastened", ["Hasten"], "Your Speed is doubled. When moving in a way that doesn't rely on Speed, you may move twice as far."),
        ("positive.исчез", "Disappeared", ["Disappear"], "You're removed from the board. You lose this Effect as you take any Action, start your Turn, or if an enemy spends 2 AP to search for you. After you lose this Effect, reappear on any space that isn't adjacent to a character. This does not count as movement."),
        ("positive.невидим", "Invisible", ["Invisibility"], "You may lose this to Disappear as a free Action or Reaction. This is not removed at the end of your Turn."),
        ("positive.регенерирует", "Regenerating", ["Regenerate"], "Restore 4 + [Tier] Health as you end your Turn. This is not removed at the end of your Turn."),
        ("positive.укреплен", "Reinforced", ["Reinforce"], "You gain [Tier] Armor."),
        ("positive.устойчив", "Steady", [], "You can't be moved unwillingly."),
        ("positive.усилен", "Strengthened", ["Strengthen"], "Your Attacks deal [Tier / 2] additional damage."),
    ]
    negative_effects = [
        ("negative.порчен", "Blighted", ["Blight"], "Lose [Tier] Health after you use an Attack. This is not removed at the end of your Turn."),
        ("negative.ошеломлен", "Dazed", ["Daze"], "You start your Turn with 1 less AP."),
        ("negative.испуган", "Feared", ["Fear"], "Your Attacks that target the character who applied Fear to you have [Tier] Disadvantage. This is also removed when the Fearing character is Knocked Out."),
        ("negative.обездвижен", "Immobilized", ["Immobilize"], "You can't willingly move. You can't benefit from Evasion."),
        ("negative.подброшен", "Launched", ["Launch"], "You can't take your Turn immediately after being Launched if an ally could take one instead, and you can't willingly move. When a Launched character is an Attack's target, the Attacker may Spike them, giving them [Tier] Advantage and removing Launched. This is removed after you start your Turn."),
        ("negative.помечен", "Marked", ["Mark"], "The first Attack that deals damage to you and can have its damage increased deals [Tier] additional damage and removes this. This is not removed at the end of your Turn."),
        ("negative.замедлен", "Slowed", ["Slow"], "Your Speed is halved. When moving in a way that doesn't rely on Speed, you may move half as far."),
        ("negative.разорван", "Shredded", ["Shred"], "You can't benefit from Armor."),
        ("negative.пойман", "Snared", ["Snare"], "When a character applies this, you're pulled adjacent to them. While your ensnarer is on the board, you can't willingly move; when they move, you are moved adjacent. You can't benefit from Evasion."),
        ("negative.спровоцирован", "Taunted", ["Taunt"], "Your Attacks that don't target a character who applied Taunt to you have [Tier] Disadvantage. This is removed when the Taunting character is Knocked Out."),
        ("negative.ослаблен", "Weakened", ["Weaken"], "Your Attacks deal [Tier / 2] less damage."),
    ]
    effect = lambda item: {"id": item[0], "name": item[1], "aliases": item[2], "text": item[3], "source": effect_source}
    action_rows = [
        ("action.движение.прыжок", "Movement", "Jump", "action", "ap", 1, "Move up to [Talent] spaces in a Line. This ignores opponents and Difficult Terrain.", 62),
        ("action.движение.шаг", "Movement", "Stride", "action", "ap", 1, "Move up to [Speed] spaces. This movement can be saved and used after taking other Actions.", 62),
        ("action.атаки.заклинание", "Attacks", "Cast", "action", "ap", 1, "Choose a target within 5 range. Roll Spirit. Reward: Deal [Hits] damage.", 63),
        ("action.атаки.стычка", "Attacks", "Skirmish", "action", "ap", 1, "Choose up to 2 adjacent targets. Roll Body or Talent. Reward: Deal [Hits] damage.", 63),
        ("action.атаки.завершение", "Attacks", "Finisher", "action", "ap", 2, "Choose an adjacent target, spend up to [Tension] Focus, and roll any Attribute at that much Advantage. Reward: Deal [Hits] + [Tension] damage.", 63),
        ("action.атаки.дуэль", "Attacks", "Duel", "action", "influence", 4, "The Cost is reduced by [Tension], to a minimum of 1. Remove yourself and an adjacent enemy from the board; resolve the Duel (as described on page 38) when a participant starts their next Turn. Reward: The loser takes 2 Wounds if they're a player, or [Tension × 2] + [Tier × 5] damage if they're an NPC. The initiator Teleports both participants to spaces on the board's edge.", 63),
        ("action.защита.блок", "Defense", "Block", "reaction", "focus", 2, "As a Reaction to being Attacked, gain [Body] Armor for the duration of the Attack and get pushed one space away from the attacker.", 64),
        ("action.защита.уворот", "Defense", "Dodge", "reaction", "focus", 2, "As a Reaction to being Attacked, gain [Talent / 2] or [Mind / 2] Evasion, move 1 or 2 spaces, and stop all forced movement from that Attack. You're still the target of that Attack if you move out of its range.", 64),
        ("action.защита.столкновение", "Defense", "Clash", "reaction", "focus", 2, "As a Reaction to being Attacked, start an Opposed Roll with the attacker, with both rolling 3 + [Tier]. If the player loses, they may take 5 damage to redo the roll, or take the Attack. If the player wins, they deal [Spirit] damage to the attacker and reduce the incoming Attack's damage by the same amount.", 64),
        ("action.защита.наказание", "Defense", "Punish", "reaction", "ap", 0, "As a Reaction to a target leaving adjacency with you, you may Swiftly Skirmish that target at no Cost.", 64),
        ("action.утилитарные-действия.передышка", "Utility", "Breathe", "action", "ap", 1, "Gain one Focus.", 65),
        ("action.утилитарные-действия.зарядка", "Utility", "Charge", "action", "ap", 2, "Roll Spirit with [Tension] Advantage. Reward: Gain [Hits] Focus (minimum 2).", 65),
        ("action.утилитарные-действия.скрыться", "Utility", "Hide", "action", "ap", 1, "If you are on the board's edge and didn't start this Turn already Disappeared, you Disappear.", 65),
        ("action.утилитарные-действия.толчок", "Utility", "Shove", "action", "ap", 1, "Move an adjacent character 1 space.", 65),
        ("action.утилитарные-действия.изучение", "Utility", "Investigate", "action", "ap", 1, "Mark an NPC in [Mind] range. The Narrator must tell you the effects or value of one of the following: their Health; their Armor and/or Evasion; their Speed; their Passive(s); their Actions; or their Ace(s).", 65),
        ("action.утилитарные-действия.взаимодействие", "Utility", "Interact", "action", "ap", 1, "Use an adjacent object or objective.", 65),
        ("action.утилитарные-действия.импровизация", "Utility", "Improvise", "action", "ap", 2, "Create a 10 Health Obstacle adjacent to you or apply any non-Banish Effect to a character adjacent to you. Before using this Action, you may remove an Obstacle adjacent to you to reduce its Cost to 1.", 65),
    ]
    actions = [{
        "id": item[0], "group": item[1], "name": item[2], "type": item[3],
        "cost": {"resource": item[4], "amount": item[5]}, "text": item[6],
        "source": {"editionId": NEW_ID, "locale": "en", "pdfPage": item[7]},
    } for item in action_rows]
    rule_rows = [
        ("lionwing.narrator.edges.overview", "Antagonist Edges", "Antagonist NPCs", "rule", "An Antagonist NPC may use Improvise for 2 AP to give an adjacent character any non-Banish Effect and has one Antagonist Edge. An Edge's three abilities share 3 free uses per Scene; each additional use costs 1 Antagonism. The Narrator may change an Antagonist's Edge as the story or gameplay changes.", 111),
        ("lionwing.narrator.edges.all-seeing", "Antagonist Edges", "All-Seeing", "antagonist-edge", "Predictable (Defense Reaction): gain [Tier × 2] Evasion when Attacked; on a miss, move up to 3 spaces. Piercing Vision (Misc Reaction): when at least 4 spaces from an Attacked player, Mark them before the roll. Phase Change: spend 2 Antagonism, give all players 1 Influence, Deploy 2 equal-Tier Artillery NPCs, and restore [Tier × 5] Health.", 111),
        ("lionwing.narrator.edges.back-stabbing", "Antagonist Edges", "Back-Stabbing", "antagonist-edge", "Honorable Sacrifice (Defense Reaction): when any NPC is Attacked, teleport an ally adjacent and make it the target. Shirk the Blame (Turn Start): if another NPC is adjacent to a player, have it Taunt them. Phase Change: spend 2 Antagonism, give all players 1 Influence, Deploy 2 equal-Tier Bodyguards, restore [Tier × 5] Health, and gain [Tier × 3] Evasion.", 111),
        ("lionwing.narrator.edges.cruel-hearted", "Antagonist Edges", "Cruel-Hearted", "antagonist-edge", "Body of Thorns (Defense Reaction): gain [Tier × 2] Armor when Attacked; if damage falls to 1, Blight the attacker. Sadist (Turn Start): clear Blight from any number of characters, Strengthen this NPC, and deal [Tier × 2] damage to each affected character. Phase Change: spend 2 Antagonism, give all players 1 Influence, attach equal-Tier Contagion and Isolation Modifiers, and restore [Tier × 5] Health.", 111),
        ("lionwing.narrator.edges.god-like", "Antagonist Edges", "God-Like", "antagonist-edge", "BREAK (Defense Reaction): gain [Tier × 2] Armor when Attacked; if damage falls to 1, push the attacker 3 spaces and Slow them. BEHOLD (Turn Start): pull a non-adjacent player 2 spaces; Daze them if they become adjacent. Phase Change: spend 2 Antagonism, give all players 1 Influence, Deploy 2 equal-Tier Paladins, and restore [Tier × 5] Health.", 112),
        ("lionwing.narrator.edges.iron-willed", "Antagonist Edges", "Iron-Willed", "antagonist-edge", "Guardian (Defense Reaction): when any NPC is Attacked, teleport adjacent to the attacker, gain [Tier × 2] Armor, and become the target. Jabbing Insults (Turn Start): Taunt an adjacent player. Phase Change: spend 2 Antagonism, give all players 1 Influence, Deploy 2 equal-Tier Swarms, restore [Tier × 5] Health, and gain [Tier] Armor.", 112),
        ("lionwing.narrator.edges.over-confident", "Antagonist Edges", "Over-Confident", "antagonist-edge", "Go On and Try (Defense Reaction): Mark yourself when Attacked to gain [Tier × 2] Evasion after the Attack. Drop the Weight (Turn Start): lose any Evasion to move 4 spaces through characters; each opponent crossed takes damage equal to the Evasion spent. Phase Change: spend 2 Antagonism, give all players 1 Influence, clear all negative Effects, become immune to them for the Scene, and restore [Tier × 5] Health.", 112),
        ("lionwing.narrator.edges.swift-stepping", "Antagonist Edges", "Swift-Stepping", "antagonist-edge", "Enter Shadow (Defense Reaction): gain [Tier × 2] Evasion when Attacked; on a miss, Teleport to the board edge and Disappear. Dominate (Turn Start): choose someone not Attacked since this NPC's last Turn and Mark them for Death; Attacks against them deal [Tier × 2] extra damage and remove it. Phase Change: spend 2 Antagonism, give all players 1 Influence, Disappear, Strengthen, restore [Tier × 5] Health, and gain [Tier × 3] Evasion.", 112),
        ("lionwing.narrator.edges.wild-eyed", "Antagonist Edges", "Wild-Eyed", "antagonist-edge", "Vicious Interception (Defense Reaction): Clash with the attacker as a player would. Beastly Roar (Turn Start): clear all Effects on this NPC, Daze opponents within 3 spaces, and push them to the nearest space 4 spaces away. Phase Change: spend 2 Antagonism, give all players 1 Influence, attach equal-Tier Giant and Earthquake Modifiers, and restore [Tier × 5] Health.", 112),
        ("lionwing.narrator.edges.world-renowned", "Antagonist Edges", "World-Renowned", "antagonist-edge", "Hero's Interception (Defense Reaction): when any NPC is Attacked, Clash with the attacker as a player would. Inspiring Presence (Ally Turn Start): when another NPC starts its Turn, have it Attack or move one additional time. Phase Change: spend 2 Antagonism, give all players 1 Influence, force a player into a Duel, restore [Tier × 5] Health, and gain [Tier × 3] Evasion.", 112),
        ("lionwing.narrator.chapters.hook", "Narrator Tools", "Preparing the Hook", "narrator-guidance", "A Chapter hook should establish where and when play begins, why the player characters are together, what local NPCs want from them, and how the situation connects to at least one character's ambition. The answers may remain implicit, but the Narrator should have them ready.", 104),
        ("lionwing.narrator.chapters.goals-drama", "Narrator Tools", "Goals and Drama", "narrator-guidance", "Give the group a larger goal beyond individual motivations, then prepare at least one meaningful obstacle on the path of least resistance. In DAWN, some obstacles should lead to physical conflict with named, important characters.", 104),
        ("lionwing.narrator.antagonists.creation", "Antagonists", "Creating Antagonists", "narrator-guidance", "An Antagonist is always a named NPC who creates Threats as the Narrator's proxy and serves as a target for Bond-based play. Build one from an Ambition grand enough to drive the Series, a Rejection that made ordinary progress impossible, and a Method that gives them unusual authority over the world.", 105),
        ("lionwing.narrator.antagonism.pool", "Antagonism", "Antagonism", "rule", "At the start of a Series, the Narrator gains Antagonism equal to the number of players and gains 1 more whenever players spend Influence. Antagonism is spent on Antagonist Actions.", 106),
        ("lionwing.narrator.antagonism.foil", "Antagonist Actions", "Foil", "antagonist-action", "Cost: 1 Antagonism. When a player's reward would directly prevent or hinder an Antagonist's action, give that player 1 Influence and delay the reward behind a 4-segment Clock that lasts until the end of the Scene. The reward occurs if the players fill the Clock.", 106),
        ("lionwing.narrator.antagonism.bargain", "Antagonist Actions", "Bargain", "antagonist-action", "Cost: 1 Antagonism. When a player would receive a reward affecting an Antagonist, present an additional Threat that will affect that player if they accept it. They may give up the reward and gain 1 Influence, or take the reward and the Threat.", 106),
        ("lionwing.narrator.antagonism.all-out", "Antagonist Actions", "All Out", "antagonist-action", "Cost: 1 Antagonism. In structured combat, reroll an enemy's Roll; it produces Hits on 3 or higher. The Roll's targets gain 1 Influence.", 106),
        ("lionwing.narrator.antagonism.break-out", "Antagonist Actions", "Break Out", "antagonist-action", "Cost: 1 Antagonism. In structured combat, have an enemy move or Attack outside the normal Turn order. Any player who is Attacked gains 1 Influence.", 106),
        ("lionwing.narrator.antagonism.escape", "Antagonist Actions", "Escape", "antagonist-action", "Cost: 1 Antagonism. In any mode, an NPC leaves the Scene with one of the following: a new plan, a permanent injury, or a new power.", 106),
        ("lionwing.narrator.antagonism.awaken", "Antagonist Actions", "Awaken", "antagonist-action", "Cost: 1 Antagonism. Reveal a previously unknown plan or element of an Antagonist. An Antagonist may use this only once per Series; after doing so, they gain [Tier × 2] Antagonism.", 106),
        ("lionwing.narrator.antagonism.duel", "Antagonist Actions", "Duel", "antagonist-action", "Cost: 1 Antagonism. Instead of an Attack on their Turn in combat, or at any time in unstructured play, an Antagonist forces an adjacent player character into a Duel and has [Tier] additional Advantage in it.", 106),
        ("lionwing.narrator.threats.procedure", "Narrator Tools", "Introducing Threats", "narrator-guidance", "Present a Threat in four beats: First Look, describing it before mechanics; Push, naming the targeted characters, asking how they respond, and stating the consequence of failure; Fall or Rise, resolving consequences and showing what changes; Take Inventory, checking Stress, pacing, purpose, and player comfort before moving on.", 107),
        ("lionwing.narrator.threats.difficulty", "Narrator Tools", "Threat Difficulty", "narrator-guidance", "After a player chooses their response, state what failure will cause—usually 1 Stress, or 2 Stress in extreme danger. Use standard difficulty above [Tier] Hits, adjusted 1 or 2 higher or lower when the situation calls for it.", 107),
        ("lionwing.narrator.conflicts.escalation", "Conflicts", "Conflict Escalation", "narrator-guidance", "Begin physical conflict in unstructured play by establishing stakes and using Duels or other contested Rolls. If the sides are not drastically unequal and the struggle deserves a tactical back-and-forth, move into structured combat. A Clock or unstructured puzzle may extend the conflict instead when more suitable.", 108),
        ("lionwing.narrator.conflicts.pvp", "Conflicts", "Player versus Player", "safety-rule", "Do not resolve player-character conflict with mechanics that bypass either player's consent. The acting player states a Threat; the defending player answers 'No' (it does not happen), 'Yes' (it happens as stated), or 'Yes, but...' (it happens with an amendment).", 108),
        ("lionwing.narrator.npcs.turns", "NPC Rules", "NPC Turns", "rule", "NPCs alternate with players under the normal Turn order. An NPC starts its Turn with 3 AP, may spend AP on its Actions or to Swiftly Stride, and cannot use the same Action multiple times in one Turn.", 109),
        ("lionwing.narrator.npcs.aces", "NPC Rules", "NPC Aces", "rule", "An Ace is formatted '[Ace:TX] Name: Effect', where X is the required Tension. Once per Scene while Tension meets that value, the NPC may use the Ace for 2 AP. An Ace always ends its user's Turn.", 109),
        ("lionwing.narrator.npcs.tiers", "NPC Rules", "NPC Tiers", "rule", "An NPC is roughly as strong as a player character of the same Tier before Technique synergies. NPC profiles list Tier 0 values followed by scaling bonuses in square brackets; add those bonuses once for each Tier assigned to the NPC.", 109),
        ("lionwing.narrator.npcs.summons", "NPC Rules", "Summons", "rule", "A Summon acts immediately after its Summoner with no intervening Turns, cannot take Turns otherwise, cannot use Aces, grants no Tension when Knocked Out, and is Knocked Out with its Summoner. For player-controlled Summons, swap profile references to players and enemies as appropriate.", 109),
        ("lionwing.narrator.npcs.wounds", "NPC Rules", "NPC Wounds", "rule", "NPCs normally do not take Wounds. If an effect makes an NPC take a Wound, it takes 10 damage that cannot be reduced instead.", 109),
        ("lionwing.narrator.npcs.fodder", "NPC Rules", "Fodder Zones", "rule", "A Fodder Zone is Difficult Terrain for enemies, has 1 Health, is a valid target, takes no Turns, and may overlap characters. After NPC Turns, move each Narrator-controlled Zone up to 2 spaces; at Round end it may deal 2 damage to one player within 1 space. Player-created Zones instead move after each player Turn and damage enemies.", 109),
        ("lionwing.narrator.encounters.basic", "Encounter Design", "Basic Encounter Budget", "guidance", "For a basic encounter, Deploy NPCs whose total Tiers equal the player characters' total Tiers. A tough encounter uses about 1.5 times that total plus one equal-Tier Modifier NPC; a brutal encounter uses about twice the total plus two equal-Tier Modifier NPCs.", 110),
        ("lionwing.narrator.encounters.fodder", "Encounter Design", "Using Fodder", "guidance", "As a rough budget, one NPC is worth a number of Fodder Zones equal to 3 plus that NPC's Tier.", 110),
        ("lionwing.narrator.compound.overview", "Compound NPCs", "Compound NPCs", "rule", "A Compound NPC represents one character using two or more NPC profiles as Parts in one shared space. Each Part takes a separate Turn, while all Parts share Tier, NPC Techniques, Effects, movement, and a single Health total equal to the sum of their Health.", 110),
        ("lionwing.narrator.compound.gates", "Compound NPCs", "Health Gates", "rule", "Divide a Compound NPC's maximum Health by its number of Parts. That value and its multiples are Health Gates. Damage cannot carry past a crossed Gate; excess becomes 0 and Tension rises by 1. Healing cannot raise Health back past a Gate.", 110),
        ("lionwing.narrator.compound.statistics", "Compound NPCs", "Compound Statistics", "rule", "A Compound NPC uses the most common Speed among its Parts, taking the higher value if tied, and inherits the highest Armor or Evasion, choosing one if equal. It inherits all Passives, but a Passive that changes statistics applies only to its Part and cannot remove that Part from Deployment.", 110),
        ("lionwing.narrator.compound.effects", "Compound NPCs", "Compound Movement and Effects", "rule", "When any Part moves, all Parts move and remain in the same space. Effects that would clear at the end of a Compound NPC's Turn instead clear at the end of the Round.", 110),
        ("lionwing.core.abilities.overview", "Abilities", "Abilities", "rule", "An Ability is a supernatural thing a character can always do that would be impossible for a mundane person. Its explanation should use the setting's supernatural element. A character can only ever have one Ability.", 45),
        ("lionwing.core.abilities.creation", "Abilities", "Creating an Ability", "rule", "An Ability follows the form: 'You can [Verb] [Noun], so long as [Condition].' Add the costs of the three chosen words and spend that many Character Ranks, to a minimum of 1; the Ability then begins at Rank 1.", 45),
        ("lionwing.core.abilities.progression", "Abilities", "Progressing Abilities", "rule", "Spend 1 Character Rank to increase an Ability's Rank, to a maximum of 3. An Ability can also be expanded by adding a new Verb, Noun, and/or Condition and paying the added words' total cost in Character Ranks, to a minimum of 1.", 45),
        ("lionwing.core.abilities.expansion", "Abilities", "Using an Expanded Ability", "rule", "When using an expanded Ability, choose any purchased words that still form 'You can [Verb] [Noun], so long as [Condition].' The use must contain at least one word from the Ability's original form.", 45),
        ("lionwing.core.abilities.opposition", "Abilities", "Not Always Effortless", "rule", "Abilities normally work at will without a roll, but the Narrator may oppose an action that would dramatically change the story or seems far-fetched under their understanding of the Ability, usually by requiring a Roll.", 45),
        ("lionwing.core.abilities.custom-words", "Abilities", "Creating Unique Words", "rule", "Players may propose words outside the glossary, but must explain them to the Narrator and receive approval. Set each custom word's cost by comparing its Impact at its most extreme and its Access: how many and how important the things it can affect are.", 45),
        ("lionwing.core.abilities.setting-options", "Abilities", "Tight and Universal Ability Systems", "optional-rule", "For a setting with only a few available effects, the Narrator may limit Nouns to 1–4 options and reduce each one's cost by 1. If some supernatural capabilities are available to anyone willing to learn them, the Narrator may define them as Skills instead.", 45),
        ("lionwing.core.bonds.overview", "Bonds", "Bonds", "rule", "Bonds are Ranked features that represent one character's feelings and connection toward another and can grant Advantage on Rolls. They are one-way relationships, are not bought with Character Ranks, and emerge as the Series progresses.", 47),
        ("lionwing.core.bonds.forming", "Bonds", "Forming Bonds", "rule", "During an Intermission, a player character may form any number of Rank 1 Bonds with named characters they can speak to or have spoken to since the last Intermission.", 47),
        ("lionwing.core.bonds.tags", "Bonds", "Bond Tags", "rule", "As the relationship develops, add one-word Bond Tags that describe it. A Bond can have no more Tags than its Rank. Its first Tag must be Partner, Rival, Student, Teacher, or Enemy. Player characters may only be Enemy Bonds with explicit permission from both players.", 47),
        ("lionwing.core.bonds.quick", "Bonds", "Quick Bonds", "rule", "Once during a Chapter, a player may form one Quick Bond at will. It is Rank 1, cannot be used to gain Influence, and disappears at the end of the Chapter unless the player spends 1 Influence to sustain it as a normal Bond.", 47),
        ("lionwing.core.bonds.ranking", "Bonds", "Ranking Up Bonds", "rule", "During an Intermission, a Bond may increase Rank if its user can speak to or has spoken to that character since the last Intermission and it has a number of Tags equal to its current Rank. A Bond cannot increase Rank in the same Intermission in which it was formed or already increased Rank.", 47),
        ("lionwing.core.bonds.returning", "Bonds", "Returning Characters", "narrator-guidance", "Once a player forms a Bond with an NPC, the Narrator should treat that NPC as an important recurring part of the story and look for natural reasons to bring them back, seed hooks, and reveal setting details.", 47),
        ("lionwing.core.bond-actions.cost", "Bond Actions", "Using Bond Actions", "rule", "A character with a Bond may use Bond Actions in addition to gaining normal Advantage from the Bond. Each Bond Action costs either 1 Influence or 1 Stress unless that Action says otherwise.", 48),
        ("lionwing.core.bond-actions.help", "Bond Actions", "Help", "bond-action", "Give the Bond [Tier] Advantage on their current or next Roll; a Roll can benefit from Help only once. Partner: push forward through a challenge together. Rival: challenge them to do better. Student: begin a task with them following. Teacher: express trust that they will succeed.", 48),
        ("lionwing.core.bond-actions.protect", "Bond Actions", "Protect", "bond-action", "Remove 1 Stress from the Bond. Partner: defend or console them while vulnerable. Rival: push against what is harming them. Student: call out to inspire self-defense. Teacher: do something risky to ensure they are safe.", 48),
        ("lionwing.core.bond-actions.study", "Bond Actions", "Study", "bond-action", "This Action cannot be paid for with Stress. Explain the Bond's actions aloud. If they are a player, they gain 1 Influence; otherwise a listening player gains it. Partner: tell a glowing relevant story. Rival: begrudgingly acknowledge their skill. Student: explain how you would do what they are doing, or admit you could not. Teacher: explain how you could never do what they are doing, even if you could.", 48),
        ("lionwing.core.bond-actions.teach", "Bond Actions", "Teach", "bond-action", "Choose a Skill in which you have at least 1 Rank. The Bond increases that Skill's Rank by 1 for the rest of the Chapter. Partner: reinforce something good about them. Rival: challenge a perceived flaw. Student: explain something they lack experience with. Teacher: make them think in a different way.", 48),
        ("lionwing.core.bond-actions.hate", "Bond Actions", "Hate", "antagonistic-bond-action", "Requires an Enemy Bond and permission for player-to-player use. When the user decides they will no longer stand for their Enemy, gain [Tier] Advantage on the current Roll. If the Enemy Bond is Rank 2 or higher, this also provides 1 Influence.", 48),
        ("lionwing.core.bond-actions.abandon", "Bond Actions", "Abandon", "antagonistic-bond-action", "Requires permission for player-to-player use. When the user's perception of their Bond changes, remove that Bond and give the user Influence equal to its Rank. A player character can gain Influence by Abandoning a given character only once.", 48),
        ("lionwing.core.creation.modes", "Character Creation", "Modes of Play", "rule", "DAWN alternates between unstructured play and structured combat. Skills, Abilities, Outlooks, and Boons primarily support unstructured play; Action Points, Techniques, and combat statistics primarily support structured combat. A feature does not automatically carry its effect between modes unless a rule explicitly connects them.", 22),
        ("lionwing.core.progression.tier", "Progression", "Increasing Tier", "rule", "Characters start at Tier 1 and can advance to Tier 6. On a Tier increase, add 1 to two different Attributes; gain 2 Character Ranks; gain one Boon from the starting Outlook or branch into up to two other Outlooks; and gain 2 Technique Levels. Instead of the Technique Levels, the character may add 1 to their highest Attribute.", 32),
        ("lionwing.core.progression.experience", "Progression", "Experience", "rule", "At the end of each Chapter, every player character gains 2 Experience plus 1 Experience for each unique way the party spent Influence during that Chapter, to a maximum of 4 Experience per Chapter. At 15 Experience, the character increases their Tier.", 32),
        ("lionwing.core.progression.awakening", "Progression", "Awakening", "rule", "A character does not have to take new Techniques, Character Ranks, or Boons immediately when Tiering up. They may save those rewards and Awaken while acting in a Scene, gaining any saved feature immediately and explaining the transformation in the fiction.", 32),
        ("lionwing.core.progression.scale", "Progression", "Campaign Scale", "guidance", "Tier suggests a campaign's fictional scale but does not mechanically force it. Tiers 1–2 suit underdog stories, Tier 3 emerging heroes, Tier 4 established elites, Tier 5 the best in the setting, and Tier 6 legendary characters. The table may change scale whenever the story calls for it.", 33),
        ("lionwing.core.general.rule-zero", "Universal Rules", "Rule Zero", "rule", "Everyone at the table should feel safe and comfortable. Before play, discuss boundaries and use consent and safety tools that suit the group. Any participant may pause or redirect play when needed; the game's other rules never override this responsibility.", 35),
        ("lionwing.core.general.rounding", "Universal Rules", "Rounding", "rule", "Whenever a rule divides a number, round the result up unless that rule says otherwise.", 35),
        ("lionwing.core.general.specific-overrides", "Universal Rules", "Specific Overrides General", "rule", "When a specific rule contradicts a general rule, follow the specific rule.", 35),
        ("lionwing.core.rolls.challenge", "Rolls", "Challenge Rolls", "rule", "When an outcome is uncertain and meaningful, roll a number of d6 equal to the relevant Attribute. Each die showing 4 or higher is a Hit. The Narrator sets the number of Hits needed for success according to the challenge and the group's Tier.", 36),
        ("lionwing.core.rolls.difficulty", "Rolls", "Difficulty", "rule", "A roll that needs no more Hits than the group's Tier is a low difficulty. A minimum difficulty needs more Hits than Tier, while an extreme difficulty needs at least twice Tier. The Narrator should state the required Hits before the roll.", 36),
        ("lionwing.core.rolls.critical", "Rolls", "Critical Hits", "rule", "Each die showing 6 is a Critical Hit: count it as a Hit, then roll one additional die. Additional dice can also produce Critical Hits.", 36),
        ("lionwing.core.rolls.advantage", "Rolls", "Advantage and Disadvantage", "rule", "Advantage adds dice to a roll and Disadvantage removes dice. Add all sources of each, then cancel them one for one before rolling.", 36),
        ("lionwing.core.rolls.opposed", "Rolls", "Opposed Rolls", "rule", "For an Opposed Roll, both sides roll their stated dice. The side with more Hits wins; resolve a tie according to the rule that started the Opposed Roll or by the Narrator's ruling when none is given.", 36),
        ("lionwing.core.rolls.group", "Rolls", "Group Rolls", "rule", "When characters act as a group, each participating character rolls and the group combines its result as the rule or Narrator directs. The Narrator decides who can contribute before dice are rolled.", 36),
        ("lionwing.core.rolls.quick", "Rolls", "Quick Rolls", "rule", "For a Quick Roll, roll one die for each relevant source of dice. A source that would provide 3 or more dice provides two dice instead. Quick Rolls do not generate additional dice from Critical Hits.", 36),
        ("lionwing.core.story.scenes", "Story Structure", "Scenes", "rule", "A Scene is a continuous stretch of play focused on one situation. Effects that last for a Scene end with it, and Tension resets to 0 when a Scene ends.", 37),
        ("lionwing.core.story.chapters-series", "Story Structure", "Chapters and Series", "rule", "A Chapter is a complete play session or comparable story unit made of Scenes. A Series is the continuing story formed by multiple Chapters.", 37),
        ("lionwing.core.story.intermissions", "Story Structure", "Intermissions", "rule", "Intermissions are periods of safety and downtime between adventures. During an Intermission, characters remove their Wounds and Stress and may develop their Bonds.", 37),
        ("lionwing.core.story.clocks", "Clocks", "Set and Story Clocks", "rule", "Clocks track approaching events with an even number of segments and should be visible to the players. A Set Clock advances through a prepared situation. A Story Clock records progress toward or delay before a continuing consequence and remains relevant across Scenes as fiction requires.", 37),
        ("lionwing.core.influence.overview", "Influence", "Influence", "rule", "Influence is a shared player resource used in structured and unstructured play. It has no maximum. Players begin a Chapter with no Influence unless a rule says otherwise.", 38),
        ("lionwing.core.influence.gaining", "Influence", "Gaining Influence", "rule", "Players gain Influence when a player character receives non-self-inflicted Stress or a Wound, when Studied grants it, and when an Antagonist targets them as described by that enemy's rules.", 38),
        ("lionwing.core.influence.spending", "Influence", "Spending Influence", "rule", "Influence powers All Out after a failed Challenge Roll, Break Out in structured combat, and player-initiated Duels. Pay the Cost when the option is declared unless its rule refunds it.", 38),
        ("lionwing.core.knockouts.resisting", "Knockouts", "Resisting a Knockout", "rule", "When a player character would be Knocked Out, their player may Resist. The character remains in the Scene with 1 Stress or 1 Wound, according to which track caused the Knockout; in structured combat they also restore all Health. They become Vulnerable until the Scene ends.", 38),
        ("lionwing.core.knockouts.vulnerable", "Knockouts", "Vulnerable", "rule", "A Vulnerable character can't Resist another Knockout and their player gains no Influence when that character receives Stress or Wounds. Vulnerable lasts until the Scene ends.", 38),
        ("lionwing.core.knockouts.consequences", "Knockouts", "Knockout Consequences", "rule", "If a Vulnerable player character is Knocked Out, the players gain 3 Influence and that character chooses one lasting consequence: lose Ranks from a Skill of Rank 2 or higher; lose part of their Ability; lose a Boon; lose two Technique Levels; or die and create a new character. Each consequence may be chosen only once for that character.", 38),
        ("lionwing.core.duels.initiating", "Duels", "Initiating a Duel", "rule", "A player may spend 1 Influence to Duel a named NPC; an Antagonist may spend 1 Antagonism to Duel a player character. The participants leave the current situation for a new unstructured Scene that carries over the current Tension.", 39),
        ("lionwing.core.duels.roll", "Duels", "Resolving a Duel", "rule", "Resolve a Duel as an Opposed Roll. The player uses the relevant Attribute and the NPC rolls [Tension + Tier] dice. In unstructured play, a losing player receives 2 Stress; a losing NPC is Knocked Out or Resists by creating an 8-segment Story Clock with [Tension] segments filled.", 39),
        ("lionwing.core.duels.combat", "Duels", "Duels in Structured Combat", "rule", "In structured combat a Duel costs 4 Influence minus Tension, to a minimum of 1, removes both participants from the board, and resolves when either participant would start their next Turn. The printed combat consequences conflict between pages 39 and 63, so automation must leave that result to the Narrator until the source is clarified.", 39),
        ("lionwing.core.duels.failure", "Duels", "Failed Duel Choices", "rule", "After losing a Duel roll, the initiating player may Bail and accept the loss; Take It and regain the spent Influence; or Double Down to reroll, increase Tension by 2, and be forced to Take It if the reroll loses. A Duel's target cannot choose these options.", 39),
        ("lionwing.core.unstructured.challenge", "Unstructured Play", "Unstructured Challenges", "rule", "In unstructured play, the Narrator presents a Challenge and states its Risk and required Hits before the roll. A character may normally draw Advantage from at most one relevant Skill, one relevant Ability, and one relevant Bond.", 41),
        ("lionwing.core.unstructured.tier-difficulty", "Unstructured Play", "Tier Difficulty Benchmarks", "rule", "The standard success thresholds by Tier are: Tier 1 needs 2 Hits; Tier 2 needs 3; Tier 3 needs 5; Tier 4 needs 6; Tier 5 needs 8; and Tier 6 needs 9. The Narrator may modify a threshold to fit the fiction.", 41),
        ("lionwing.core.risks.stress", "Risks", "Stress", "rule", "Stress measures mounting pressure in unstructured play. A character who receives non-self-inflicted Stress grants the players Influence. Reaching the track's limit can Knock the character Out, subject to Resisting and Vulnerable.", 42),
        ("lionwing.core.risks.alternatives", "Risks", "Alternative Risks", "rule", "Instead of Stress, a failed Challenge can Escalate (+1 Tension and +1 difficulty on this character's next roll), create Strange Ties (a Rank [Tier / 2] Bond for 1 Influence), cause a Compromise, make the character Falter, take a consent-sensitive Memento, Change the Scene and increase Tension by 1, or Trip Up a consenting player character and grant 1 Influence. The Narrator chooses only consequences appropriate to the fiction and table boundaries.", 42),
        ("lionwing.core.risks.all-out", "Risks", "All Out", "rule", "Immediately after failing a Challenge Roll, a player may spend 1 Influence to go All Out. The attempt succeeds if its final result has at least 3 Hits, subject to the option's stated consequences.", 42),
        ("lionwing.core.threats.overview", "Threats", "Threats", "rule", "A Threat tells the players what will happen if they don't respond. When a character answers it with a Challenge Roll, the Threat itself becomes that roll's Risk. Any character may respond unless the Threat explicitly restricts who can act.", 43),
        ("lionwing.core.threats.delay", "Threats", "Delaying Threats", "rule", "If the characters block or delay rather than resolve a Threat, create a Story Clock that brings the Threat back when it fills. Keep the consequence public so players can make informed choices.", 43),
        ("lionwing.core.ranks.overview", "Character Ranks", "Skills, Abilities, and Bonds", "rule", "Skills, Abilities, and Bonds have Ranks from 1 to 3. A new character receives 8 Character Ranks and must spend at least 4 on Skills. Unspent starting Ranks are lost; the 2 Ranks gained at each Tier increase may be saved.", 44),
        ("lionwing.core.ranks.custom-skills", "Character Ranks", "Custom Skills", "rule", "A custom Skill should be a mundane specialty described in 2 to 5 words. It must not be so broad that it replaces several standard Skills and cannot grant supernatural capability by itself.", 44),
        ("lionwing.core.combat.structured", "Combat", "Structured Combat", "rule", "The tactical, most game-like element of DAWN is used when two evenly or almost evenly matched groups face each other in battle. Its risks create tension, but it is mostly played for fun and to reinforce player-character aesthetics that can only be shown in combat. Players optimize builds, handle threats, and control variables to defeat enemies efficiently. Their Actions and Techniques determine whether they live or die while enforcing character themes and aesthetics.", 56),
        ("lionwing.core.combat.action-points", "Combat", "Actions and Action Points", "rule", "When a character's Turn starts, they receive 3 Action Points (AP). Players spend AP on Basic Actions, each of which has a listed AP Cost. Each NPC has a unique set of Actions based on their Type, all with a Cost of 1. Both lose all Action Points at the end of their Turn.", 56),
        ("lionwing.core.combat.action-limit", "Combat", "Action Limit and Swift Actions", "rule", "A character can't use the same Basic Action more than once each Round unless all but one use of that Action was Swift. Swift use is often granted by Techniques.", 56),
        ("lionwing.core.combat.reactions", "Combat", "Reactions", "rule", "Reactions can be used outside a Turn when their conditions are met. Reactions are still Actions, but don't obey the once-per-Round limit; all Reactions count as Swift by default.", 56),
        ("lionwing.core.combat.break-out", "Combat", "Break Out", "rule", "In addition to normal Reactions, all non-Attack Actions can be taken as a Reaction to another character ending their Turn by spending 1 Influence to Break Out. Actions from Break Out have no AP Cost.", 56),
        ("lionwing.core.combat.turn-order", "Combat", "Taking Turns", "rule", "When a Round starts, the players decide who takes the first Turn. After that player ends their Turn, a Narrator-chosen enemy that hasn't acted this Round may take its Turn. If all enemies have acted, the Narrator may choose any enemy. After the enemy's Turn, the last player who acted chooses a player who hasn't acted this Round. This repeats until all players have acted. Once an enemy acts after the last player, a new Round starts, and the last acting player chooses who takes the first Turn.", 56),
        ("lionwing.core.combat.assisting", "Combat", "Assisting", "rule", "If combat starts while a player is at the table but their character isn't in the Scene, that player may Assist. While Assisting, the player can use Break Out to take an Action while controlling a consenting ally. They may Break Out without spending Influence up to three times in each Combat Scene. Any statistic used during an Assisted Break Out is replaced with the assistant's highest Attribute, including roll Attributes and passive statistics such as Speed.", 56),
        ("lionwing.core.statistics.health", "Statistics", "Health", "rule", "Characters have Health, which determines durability. As they take damage, they lose that much Health. A player character's maximum Health is 10 + [Body] + [Tier × 2]. Health resets at the end of each Scene.", 57),
        ("lionwing.core.statistics.wounds", "Statistics", "Wounds and Knockouts", "rule", "A Wound is a lasting injury. When a character is reduced to or below 0 Health, they receive a Wound and reset Health to its maximum. Health resets even if the Wound wasn't caused by reaching 0 Health. At 3 Wounds, a character loses one Wound and is Knocked Out of the Scene. NPCs are Knocked Out as soon as their Health reaches 0. Characters lose Wounds during Intermissions. When a character takes a Wound that isn't self-inflicted, their controller receives 1 Influence.", 57),
        ("lionwing.core.statistics.armor", "Statistics", "Armor", "rule", "If a character has Armor, damage they take from Attacks is reduced by that value, to a minimum of 1 damage. Armor applies after all other damage reduction.", 57),
        ("lionwing.core.statistics.evasion", "Statistics", "Evasion", "rule", "If a character has Evasion, incoming damage reduces Evasion instead of Health; this doesn't count as taking damage. If this reduces an Attack's damage to 0, the defender ignores that Attack's secondary effects. Evasion is lost at the end of a Scene.", 57),
        ("lionwing.core.statistics.focus", "Statistics", "Focus", "rule", "Focus is a resource used for powerful Attacks and other features. When combat starts, player characters set their Focus to 1 plus half their Spirit. They can regain Focus through specific Actions, and it has no upper maximum.", 58),
        ("lionwing.core.statistics.alternative-foci", "Statistics", "Alternative Foci", "rule", "Some Techniques replace Focus with an alternate resource under a different name. These resources have unique effects and conditions, but unless stated otherwise they can be spent and gained as if they were Focus.", 58),
        ("lionwing.core.statistics.speed", "Statistics", "Speed", "rule", "Speed determines how far a character can move with an Action. A player character's Speed is 2 + [Talent / 2].", 58),
        ("lionwing.core.statistics.tension", "Statistics", "Tension", "rule", "Tension is a shared resource that starts at 0 at the beginning of every combat. As it rises, characters become more powerful and gain options. Tension increases by 1 when a Round ends, an NPC is Knocked Out, or a player character is Knocked Out.", 58),
        ("lionwing.core.statistics.low-tension", "Statistics", "Low-Tension Combat", "optional-rule", "For longer combats, Narrators may remove the Tension increase caused by a character being Knocked Out, so Tension increases only at the end of a Round.", 58),
        ("lionwing.core.spatial.setting-up", "Spaces, Movement, and Targeting", "Setting Up", "rule", "Combat takes place on a 7 × 7 space board, no smaller and no larger. Players Deploy on the outermost spaces opposite their enemies.", 58),
        ("lionwing.core.spatial.scale", "Spaces, Movement, and Targeting", "Realizing Spaces", "note", "At Tier 1, a space can represent roughly 3 × 3 meters in the fiction. Spaces should become larger at higher Tiers. A Narrator may change the scale to fit the Scene.", 58),
        ("lionwing.core.spatial.movement-range", "Spaces, Movement, and Targeting", "Movement and Drawing Range", "rule", "Movement and range are measured orthogonally using Manhattan distance. Characters can't move through opponents or Obstacles and can't end movement in a space occupied by another character.", 58),
        ("lionwing.core.spatial.adjacency", "Spaces, Movement, and Targeting", "Adjacency", "rule", "The orthogonally closest spaces are adjacent. Entering those spaces means entering adjacency. A character can't be adjacent to themselves even if they occupy multiple spaces. Characters are always adjacent to other characters in the same space.", 58),
        ("lionwing.core.spatial.push-pull", "Spaces, Movement, and Targeting", "Push and Pull", "rule", "A pulled target moves directly toward the puller in a Line. A pushed target moves directly away from the pusher in a Line. If the target isn't in a Line relative to the user, use the closest Line.", 58),
        ("lionwing.core.spatial.teleporting", "Spaces, Movement, and Targeting", "Teleporting", "rule", "Teleporting moves a character from one space to another without passing through the spaces between. It still counts as movement. A character can't Teleport to an occupied space.", 58),
        ("lionwing.core.spatial.targeting-allies", "Spaces, Movement, and Targeting", "Targeting Allies", "rule", "When an Action must target an ally, it means a player character or NPC working with the user, but not the user themselves.", 58),
        ("lionwing.core.spatial.special-targeting", "Spaces, Movement, and Targeting", "Special Targeting", "rule", "Some effects target something other than one target in a range. With this and any other multi-character targeting, an Attack is rolled once and that roll is shared by all targets. If a source of Advantage or Disadvantage applies to some but not all targets, first roll the lowest number of dice and apply it to all targets, then roll the additional dice separately for each affected target and add those Hits to the Hits that target takes.", 59),
        ("lionwing.core.spatial.zones", "Spaces, Movement, and Targeting", "Zones", "rule", "A Zone is a shape written as X × Y, with X and Y showing how many spaces wide or tall it can be; width and height may be swapped freely. When creating a Zone in a targeted space, the user may place any part of the Zone within that space.", 59),
        ("lionwing.core.spatial.centered-zones", "Spaces, Movement, and Targeting", "Centered Zones", "rule", "When a Zone must be centered on a character or space, as many spaces of the Zone as possible must be adjacent to the centered space and, if possible, the centered space must be at the exact center of the Zone. If several placements are valid, the creator chooses.", 59),
        ("lionwing.core.spatial.lines", "Spaces, Movement, and Targeting", "Lines", "rule", "A Line extends from its user in an orthogonal or diagonal direction. Unlike normal range, Lines count diagonal spaces as one space apart.", 59),
        ("lionwing.core.spatial.straight-lines", "Spaces, Movement, and Targeting", "Moving in Straight Lines", "rule", "Straight Lines may be drawn orthogonally or diagonally, counting diagonal spaces as one space apart. Movement that must follow a straight Line uses the same rule.", 59),
        ("lionwing.core.terrain.overview", "Terrain", "Terrain", "rule", "Terrain is an object or area on the battlefield that changes how characters act when moving to it. Obstacles can't be moved through unless stated otherwise, have Health (10 Health per space by default), and are destroyed at 0 Health. Fields affect characters according to their type.", 60),
        ("lionwing.core.terrain.curios", "Terrain", "Curios", "rule", "A Curio is an Obstacle that can be used in a unique way. A player or Antagonist enemy may use Improvise and remove the Curio from the board. A Curio can have any Scene-specific effect assigned by the Narrator. A simple option is to let its user apply a bonus to one Action, such as a Hastened Jump, a Strengthened Attack, or an Investigate with 2 targets.", 60),
        ("lionwing.core.terrain.walls", "Terrain", "Walls", "rule", "Walls are Obstacles placed on the borders between spaces rather than in spaces. Movement and targeting can't be drawn between spaces separated by a Wall.", 60),
        ("lionwing.core.terrain.difficult", "Terrain", "Difficult Terrain", "rule", "Difficult Terrain is a Field. When a character enters it, their Speed becomes 0 until the end of the Turn and their current movement ends immediately. A character who started their Turn in Difficult Terrain is unaffected by all connected pieces of it until the end of that Turn.", 60),
        ("lionwing.core.terrain.height", "Terrain", "High and Low Ground", "rule", "When height matters, use High, Standard, and Low Terrain. Moving from one height level to the next higher level ends all movement and reduces Speed to 0 until the end of the user's Turn. Moving from Low to High is possible only if the user started the movement on the edge of the High Ground. Attacks have [Tier / 2] Advantage against lower targets and [Tier / 2] Disadvantage against higher targets.", 60),
        ("lionwing.core.combat.cinematic", "Combat", "Cinematic Combat", "alternate-rule", "Cinematic Combat is recommended for smaller groups or shorter fights. All characters are placed on a 7-space line; allies Deploy in the 2 leftmost spaces and enemies in the opposite 2 spaces. Any number of characters may occupy one space, and characters may move through opponents, but entering an enemy's space counts as Difficult Terrain unless that movement could normally pass through enemies. Standard and Line targeting can target only one character in each targeted space; other multi-space targeting affects every target in its area.", 60),
        ("lionwing.core.spatial.choosing-targets", "Spaces, Movement, and Targeting", "Choosing Targets", "note", "When instructed to choose a target, you may target characters, Obstacles, or empty spaces within the allowed range.", 63),
        ("lionwing.core.combat.contextual-actions", "Combat", "Contextual Actions", "note", "Structured combat describes an average fight, but contextually sensible actions aren't forbidden just because the standard rules don't define them. Duel moves play into unstructured rules and can justify such attempts. Narrators may also prepare custom Terrain or NPCs that players can affect with Interact.", 65),
    ]
    rules = [{
        "id": item[0], "category": item[1], "name": item[2], "kind": item[3], "text": item[4],
        "source": {"editionId": NEW_ID, "locale": "en", "pdfPage": item[5]},
    } for item in rule_rows]
    return {
        "schemaVersion": 1,
        "editionId": NEW_ID,
        "effects": {
            "intro": "Effects represent ongoing benefits and statuses. Characters lose their Effects when they end their Turn unless stated otherwise. Effects can't be removed this way on the Turn they're applied. Applying an Effect a character already has counts as applying it on that Turn.",
            "positive": [effect(item) for item in positive_effects],
            "negative": [effect(item) for item in negative_effects],
        },
        "actions": {
            "intro": "These Basic Actions and Reactions are used in structured combat. Actions can only be used on your Turn; Reactions can be triggered when specified.",
            "combos": "A Combo is a string of two or more Actions formatted as [X → Y] that grants a bonus when performed with no other Actions in between. Only one Combo can be executed per Action. If a Technique Level starts with a Combo, its effects only happen if that Combo is used. Combos can start off your Turn as long as you don't take an Action that would break them. After use, a Combo is on Cooldown until the end of your next Turn and can't be used while on Cooldown.",
            "list": actions,
        },
        "rules": rules,
        "source": {"editionId": NEW_ID, "locale": "en", "pdfPages": list(range(22, 66)) + list(range(104, 111))},
    }


def builder_rules() -> dict:
    skill_rows = [
        ("body", "Break"), ("body", "Endure"), ("body", "Menace"), ("body", "Defend"),
        ("talent", "Finesse"), ("talent", "Lurk"), ("talent", "Move"), ("talent", "React"),
        ("spirit", "Absorb"), ("spirit", "Intuit"), ("spirit", "Connect"), ("spirit", "Luck"),
        ("mind", "Deceive"), ("mind", "Command"), ("mind", "Unveil"), ("mind", "Tinker"),
    ]
    return {
        "schemaVersion": 1,
        "editionId": NEW_ID,
        "sourceLocale": "en",
        "tier": {"minimum": 1, "maximum": 6},
        "progression": {"experienceToTier": 15, "chapterBaseExperience": 2, "chapterMaximumExperience": 4, "rewardsMayBeSavedForAwakening": True},
        "attributes": {"startingValues": [4, 3, 2, 2], "growthPerTier": 2, "sameAttributeGrowthPerTier": 1},
        "ranks": {"starting": 8, "perTier": 2, "minimumStartingSkillRanks": 4},
        "skills": {
            "minimumRank": 1, "maximumRank": 3, "customAllowed": True,
            "canonical": [{
                "id": f"lionwing.skill.{attribute}.{slugify(name)}", "attribute": attribute, "name": name,
                "source": {"editionId": NEW_ID, "locale": "en", "pdfPage": 44},
            } for attribute, name in skill_rows],
        },
        "abilities": {"maximum": 1, "minimumCost": 1, "maximumRank": 3, "customWordsRequireNarratorApproval": True, "expandedUsesRequireOriginalWord": True},
        "bonds": {"maximumRank": 3, "quickPerChapter": 1, "quickRank": 1, "quickSustainInfluenceCost": 1, "actionInfluenceCost": 1, "actionStressCost": 1},
        "outlooks": {"starting": 1, "maximum": 3},
        "boons": {"startingChoices": 2, "perTier": 1, "primaryInherentBoonIsFree": True},
        "techniques": {"startingLevels": 5, "levelsPerTier": 2, "maximumArchetypes": 3, "levelsPerAttributeConversion": 2},
        "derivedStatistics": {"health": "10 + Body + Tier * 2", "speed": "2 + ceil(Talent / 2)", "focus": "1 + ceil(Spirit / 2)", "guts": None},
        "source": {"editionId": NEW_ID, "locale": "en", "pdfPages": [22, 23, 24, 32]},
    }


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
        ("builder-rules.json", overlay["builderRules"]),
        ("core-rules.json", overlay["coreRules"]),
        ("id-map.json", {"mappedIds": overlay["mappedIds"], "migrationEvidence": overlay["migrationEvidence"], "removedIds": overlay["removedIds"]}),
    ):
        (canonical / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        files.append(name)
    manifest = {
        "schemaVersion": 1,
        "editionId": overlay["editionId"],
        "locale": overlay["locale"],
        "tableMechanicsStatus": overlay["tableMechanicsStatus"],
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
            "coreEffects": sum(len(items) for items in overlay["coreRules"]["effects"].values() if isinstance(items, list)),
            "coreActions": len(overlay["coreRules"]["actions"]["list"]),
            "coreRuleCards": len(overlay["coreRules"]["rules"]),
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
        "scope": ["builder", "reference", "techniques", "core-rules"],
        "tableMechanicsStatus": "not-ported",
        "builderRules": builder_rules(),
        "archetypes": [
            {"id": archetype_id, "name": name, "techniques": [item for item in techniques if item["archetypeId"] == archetype_id]}
            for archetype_id, name in archetype_names.items()
        ],
        "outlooks": new_outlooks,
        "abilityWords": new_ability_words,
        "reference": parse_reference_sections(),
        "coreRules": core_rules(),
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
