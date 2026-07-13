# -*- coding: utf-8 -*-
"""Генератор данных для компаньона DAWN.

Читает канонические файлы из ../../source/translation и собирает data.js:
- шесть Архетипов с Техниками (название, звёзды, теги, флавор, 3 уровня);
- десять Мировоззрений с Дарами и избранными действиями Связи;
- базовые действия и Эффекты с поисковыми формами терминов.

Запуск:  python build_data.py
Выход:   data.js  (window.DAWN_DATA = {...})
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parents[1]
TR = PROJECT_ROOT / "source" / "translation"

TECH_FILES = [
    ("powerhouse", "pages-065-070-powerhouse-techniques.md"),
    ("vagabond", "pages-071-076-vagabond-techniques.md"),
    ("bulwark", "pages-077-081-bulwark-techniques.md"),
    ("altruist", "pages-082-087-altruist-techniques.md"),
    ("disruptor", "pages-088-093-disruptor-techniques.md"),
    ("ruiner", "pages-094-099-ruiner-techniques.md"),
]

OUTLOOK_FILE = "pages-037-051-unstructured-play.md"
COMBAT_FILE = "pages-052-064-structured-combat-core.md"
ENEMY_FILE = "pages-109-119-general-enemy-types.md"
MODIFIER_FILE = "pages-120-124-combat-stakes-modifiers-credits.md"

RE_TECH_HEAD = re.compile(r"^### (.+?)(?: \(([^)]+)\))? \| (★+) \| (.+)$")
RE_LEVEL = re.compile(r"^\*\*(\d):\s*(.+):\*\*\s*(.*)$")
RE_GIFT = re.compile(r"^\*\*(.+?):\*\*\s+(.*)$")
RE_ENEMY_HEAD = re.compile(r"^### (.+?)(?: \(([^)]+)\))? \| (.+)$")

OUTLOOK_IDS = {
    "Мятежник": "rebel",
    "Верный": "loyalist",
    "Светоч": "beacon",
    "Волк": "wolf",
    "Наставник": "mentor",
    "Ученик": "student",
    "Проклятый": "cursed",
    "Благословенный": "blessed",
    "Тихий": "quiet",
    "Уверенный": "confident",
}

# Канонические названия Эффектов остаются неизменными. Эти формы нужны только
# справочнику, чтобы запрос действия (например, «Исчезнуть») находил состояние
# («Исчез») и его полное определение.
EFFECT_ALIASES = {
    "Изгнан": ["Изгнать", "Изгнание"],
    "Ускорен": ["Ускорить", "Ускорение"],
    "Исчез": ["Исчезнуть", "Исчезает", "Исчезновение"],
    "Невидим": ["Невидимость", "Стать невидимым"],
    "Регенерирует": ["Регенерировать", "Регенерация"],
    "Укреплен": ["Укрепить", "Укрепление"],
    "Устойчив": ["Устойчивость"],
    "Усилен": ["Усилить", "Усиление"],
    "Порчен": ["Портить", "Порча"],
    "Ошеломлен": ["Ошеломить", "Ошеломление"],
    "Испуган": ["Испугать", "Страх"],
    "Обездвижен": ["Обездвижить", "Обездвиживание"],
    "Подброшен": ["Подбросить", "Подбрасывание"],
    "Помечен": ["Пометить", "Метка"],
    "Замедлен": ["Замедлить", "Замедление"],
    "Разорван": ["Разорвать", "Разрыв"],
    "Пойман": ["Поймать"],
    "Спровоцирован": ["Спровоцировать", "Провокация"],
    "Ослаблен": ["Ослабить", "Ослабление"],
}


def slugify(value: str) -> str:
    value = value.lower().replace("ё", "е")
    value = re.sub(r"[^a-z0-9а-я]+", "-", value, flags=re.IGNORECASE)
    return value.strip("-")


def split_bilingual(value: str) -> tuple[str, str]:
    match = re.match(r"^(.+?)\s+\(([^()]+)\)$", value.strip())
    return (match.group(1).strip(), match.group(2).strip()) if match else (value.strip(), "")


def parse_techniques(slug: str, fname: str) -> dict:
    lines = (TR / fname).read_text(encoding="utf-8").splitlines()
    arch = {"id": slug, "name": "", "desc": "", "techniques": []}
    tech = None
    level = None
    seen_h1 = 0
    for raw in lines:
        line = raw.rstrip()
        if line.startswith("# ") and not line.startswith("## "):
            seen_h1 += 1
            if seen_h1 == 2:
                arch["name"] = line[2:].strip()
            continue
        if line.startswith("## Заметки переводчика"):
            break
        m = RE_TECH_HEAD.match(line)
        if m:
            tech = {
                "id": f"{slug}.{slugify((m.group(2) or m.group(1)).strip())}",
                "name": m.group(1).strip(),
                "en": (m.group(2) or "").strip(),
                "stars": len(m.group(3)),
                "tags": m.group(4).strip(),
                "flavor": [],
                "levels": [],
            }
            arch["techniques"].append(tech)
            level = None
            continue
        if tech is None:
            # описание архетипа: первый содержательный абзац после его заголовка
            if arch["name"] and not arch["desc"] and line and not line.startswith("#"):
                arch["desc"] = re.sub(r"\*\*(.+?)\*\*", r"\1", line)
            continue
        m = RE_LEVEL.match(line)
        if m:
            level = {"n": int(m.group(1)), "name": m.group(2).strip(), "text": m.group(3).strip()}
            tech["levels"].append(level)
            continue
        if not line:
            continue
        if level is not None:
            level["text"] += "\n" + line
        else:
            tech["flavor"].append(line.strip("_ "))
    for t in arch["techniques"]:
        t["flavor"] = "\n\n".join(t["flavor"])
    return arch


def parse_outlooks() -> list:
    lines = (TR / OUTLOOK_FILE).read_text(encoding="utf-8").splitlines()
    outlooks = []
    category = None
    ol = None
    gift = None
    zone = None  # None | desc | builtin | gifts
    for raw in lines:
        line = raw.rstrip()
        m = re.match(r"^## Мировоззрения (.+)$", line)
        if m:
            category = m.group(1).strip()
            ol = None
            gift = None
            continue
        if line.startswith("## Заметки переводчика"):
            break
        if category is None:
            continue
        if line.startswith("## "):
            category = None
            continue
        if line.startswith("### "):
            ol = {
                "id": OUTLOOK_IDS.get(line[4:].strip(), slugify(line[4:].strip())),
                "name": line[4:].strip(),
                "category": category,
                "desc": "",
                "bondActions": "",
                "builtin": None,
                "gifts": [],
            }
            outlooks.append(ol)
            gift = None
            zone = "desc"
            continue
        if ol is None:
            continue
        if line.startswith("#### Встроенный Дар"):
            zone = "builtin"
            gift = None
            continue
        if line.startswith("#### Дары"):
            zone = "gifts"
            gift = None
            continue
        m = re.match(r"^\*\*Избранные действия Связи:\*\*\s*(.*)$", line)
        if m:
            ol["bondActions"] = re.sub(r"\*\*(.+?)\*\*", r"\1", m.group(1)).rstrip(".")
            continue
        m = RE_GIFT.match(line)
        if m and zone in ("builtin", "gifts"):
            name, en = split_bilingual(m.group(1))
            gift = {
                "id": f"{ol['id']}.{slugify(en or name)}",
                "name": name,
                "en": en,
                "text": m.group(2).strip(),
            }
            if zone == "builtin":
                ol["builtin"] = gift
            else:
                ol["gifts"].append(gift)
            continue
        if not line:
            continue
        if zone == "desc" and not line.startswith("#"):
            plain = re.sub(r"\*\*(.+?)\*\*", r"\1", line)
            ol["desc"] = (ol["desc"] + " " + plain).strip()
        elif gift is not None:
            gift["text"] += "\n" + line
    return outlooks


def parse_effects() -> dict:
    lines = (TR / COMBAT_FILE).read_text(encoding="utf-8").splitlines()
    effects = {"positive": [], "negative": []}
    zone = None
    for raw in lines:
        line = raw.rstrip()
        if line.startswith("## Список Эффектов"):
            zone = "wait"
            continue
        if zone is None:
            continue
        if line.startswith("### Положительные"):
            zone = "positive"
            continue
        if line.startswith("### Отрицательные"):
            zone = "negative"
            continue
        if line.startswith("## "):
            break
        m = RE_GIFT.match(line)
        if m and zone in ("positive", "negative"):
            name, en = split_bilingual(m.group(1))
            effects[zone].append({
                "id": f"{zone}.{slugify(en or name)}",
                "name": name,
                "en": en,
                "aliases": EFFECT_ALIASES.get(name, []),
                "text": m.group(2).strip(),
            })
    return effects


ACTION_GROUPS = {"Движение", "Атаки", "Защита", "Утилитарные действия"}


def parse_actions() -> dict:
    """Базовые действия боя + вводные заметки (Комбо и общие правила)."""
    lines = (TR / COMBAT_FILE).read_text(encoding="utf-8").splitlines()
    actions = []
    intro = []
    group = None
    act = None
    zone = None  # None | intro | groups
    for raw in lines:
        line = raw.rstrip()
        stripped = line.strip()
        if stripped.startswith("## Базовые действия"):
            zone = "intro"
            continue
        if zone is None:
            continue
        if stripped.startswith("### Заметки Джоэла"):
            break
        if stripped.startswith("## "):
            name = stripped[3:].strip()
            if name in ACTION_GROUPS:
                group = name
                zone = "groups"
                act = None
                continue
            break
        if zone == "intro":
            if stripped.startswith("### "):
                intro.append("**" + stripped[4:].strip() + "**")
            elif stripped:
                intro.append(stripped)
            continue
        # внутри групп
        m = re.match(r"^\*\*([^*]+)\*\*\s*$", stripped)
        if m:
            name, en = split_bilingual(m.group(1))
            act = {
                "id": f"action.{slugify(group or 'action')}.{slugify(name)}",
                "group": group,
                "name": name,
                "en": en,
                "cost": "",
                "text": "",
            }
            actions.append(act)
            continue
        if act is None:
            if stripped and not stripped.startswith("#"):
                # вводный текст группы — пропускаем, он художественный
                pass
            continue
        m = re.match(r"^\*\*Стоимость ([^:]+):\*\*\s*(.*)$", stripped)
        if m:
            act["cost"] = f"{m.group(2).strip()} {m.group(1).strip()}"
            continue
        if stripped:
            act["text"] = (act["text"] + "\n" + stripped).strip()
    return {"intro": "\n".join(intro), "list": actions}


def parse_ability_words() -> dict:
    """Глоссарий слов Способности с числовой либо переменной стоимостью."""
    lines = (TR / OUTLOOK_FILE).read_text(encoding="utf-8").splitlines()
    rows = []
    in_table = False
    for raw in lines:
        line = raw.strip()
        if line.startswith("| Глагол | Стоимость | Существительное |"):
            in_table = True
            continue
        if not in_table:
            continue
        if line.startswith("| ---"):
            continue
        if not line.startswith("|"):
            break
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        if len(cells) == 6:
            rows.append(cells)

    groups = {"verbs": [], "nouns": [], "conditions": []}
    seen = {key: set() for key in groups}

    def add(group: str, label: str, raw_cost: str) -> None:
        for variant in [part.strip() for part in label.split(" / ") if part.strip()]:
            clean = re.sub(r"\s*[✢✝☾]+\s*$", "", variant).strip()
            marks = "".join(re.findall(r"[✢✝☾]", variant))
            item_id = f"ability.{group}.{slugify(clean)}"
            if item_id in seen[group]:
                continue
            seen[group].add(item_id)
            try:
                cost = int(raw_cost)
            except ValueError:
                cost = None
            groups[group].append({
                "id": item_id,
                "name": clean,
                "cost": cost,
                "costLabel": raw_cost,
                "marks": marks,
            })

    for verb, verb_cost, noun, noun_cost, condition, condition_cost in rows:
        add("verbs", verb, verb_cost)
        add("nouns", noun, noun_cost)
        add("conditions", condition, condition_cost)
    return groups


def parse_enemy_stats(raw: str) -> dict:
    stats = {}
    labels = {
        "Здоровья": "health",
        "Скорости": "speed",
        "Брони": "armor",
        "Уклонения": "evasion",
    }
    for label, key in labels.items():
        match = re.search(rf"(?:`([^`]+)`|([*Xx0-9+()/.-]+))\s+\*\*{label}\*\*", raw)
        if match:
            stats[key] = (match.group(1) or match.group(2)).lstrip("*")
    return stats


def parse_enemies(fname: str, kind: str) -> list:
    """Канонические профили врагов без потери текста их меняющих правила особенностей."""
    lines = (TR / fname).read_text(encoding="utf-8").splitlines()
    enemies = []
    enemy = None
    enabled = kind == "common"
    for raw in lines:
        line = raw.rstrip()
        if kind == "modifier" and line == "## Враги-Модификаторы":
            enabled = True
            enemy = None
            continue
        if not enabled:
            continue
        if line.startswith("## Заметки переводчика") or (kind == "modifier" and line.startswith("# Примеры боевых сценариев")):
            break
        match = RE_ENEMY_HEAD.match(line)
        if match:
            name, en, tags = match.group(1).strip(), (match.group(2) or "").strip(), match.group(3).strip()
            enemy = {
                "id": f"enemy.{kind}.{slugify(en or name)}",
                "kind": kind,
                "name": name,
                "en": en,
                "tags": tags,
                "examples": "",
                "statsRaw": "",
                "stats": {},
                "text": "",
            }
            enemies.append(enemy)
            continue
        if enemy is None:
            continue
        if line.startswith("## ") or line.startswith("# "):
            enemy = None
            continue
        if not line:
            continue
        if line.startswith("_Напр.:"):
            enemy["examples"] = line.strip("_ ").removeprefix("Напр.:").strip()
            continue
        if line.startswith("**Параметры:**"):
            enemy["statsRaw"] = line.removeprefix("**Параметры:**").strip()
            enemy["stats"] = parse_enemy_stats(line)
            continue
        enemy["text"] = (enemy["text"] + "\n" + line.replace("\\*", "*")).strip()
    return enemies


def main():
    data = {
        "schemaVersion": 2,
        "archetypes": [parse_techniques(slug, fname) for slug, fname in TECH_FILES],
        "outlooks": parse_outlooks(),
        "effects": parse_effects(),
        "actions": parse_actions(),
        "abilityWords": parse_ability_words(),
        "enemies": {
            "common": parse_enemies(ENEMY_FILE, "common"),
            "modifiers": parse_enemies(MODIFIER_FILE, "modifier"),
        },
    }
    n_tech = sum(len(a["techniques"]) for a in data["archetypes"])
    n_gifts = sum(len(o["gifts"]) + (1 if o["builtin"] else 0) for o in data["outlooks"])
    for a in data["archetypes"]:
        bad = [t["name"] for t in a["techniques"] if len(t["levels"]) != 3]
        if bad:
            print(f"  ! {a['name']}: техники не с 3 уровнями: {bad}")
    ids = []
    ids.extend(t["id"] for a in data["archetypes"] for t in a["techniques"])
    ids.extend(o["id"] for o in data["outlooks"])
    ids.extend(g["id"] for o in data["outlooks"] for g in ([o["builtin"]] if o["builtin"] else []) + o["gifts"])
    ids.extend(e["id"] for group in data["effects"].values() for e in group)
    ids.extend(a["id"] for a in data["actions"]["list"])
    ids.extend(e["id"] for group in data["enemies"].values() for e in group)
    if len(ids) != len(set(ids)):
        raise ValueError("Обнаружены повторяющиеся стабильные id в данных компаньона")
    out = ROOT / "data.js"
    out.write_text(
        "// Автогенерация: python build_data.py — не редактировать вручную.\n"
        "window.DAWN_DATA = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n",
        encoding="utf-8",
    )
    print(f"OK: {len(data['archetypes'])} архетипов, {n_tech} техник, "
          f"{len(data['outlooks'])} мировоззрений, {n_gifts} даров, "
          f"{len(data['effects']['positive'])}+{len(data['effects']['negative'])} эффектов, "
          f"{len(data['actions']['list'])} действий, "
          f"{len(data['enemies']['common'])}+{len(data['enemies']['modifiers'])} врагов -> {out.name}")


if __name__ == "__main__":
    main()
