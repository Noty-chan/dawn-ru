from __future__ import annotations

import html
import math
import os
import re
import sys
from io import BytesIO
from dataclasses import dataclass
from pathlib import Path

import fitz
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
TRANSLATION = ROOT / "source" / "translation"
OUT_DIR = ROOT / "build" / "pdf"
RELEASE_DIR = ROOT / "release"
TMP_ROOT = ROOT / "build" / "tmp" / "pdfs"
TMP_DIR = TMP_ROOT / "layout-pilot"
DRAFT_TMP_DIR = TMP_ROOT / "layout-draft"
BEAUTY_TMP_DIR = TMP_ROOT / "layout-beauty-draft"
FINAL_TMP_DIR = TMP_ROOT / "layout-final"
DESIGN_PILOT_INTRO_TMP_DIR = TMP_ROOT / "design-pilot-intro-v1"
DESIGN_PILOT_INTRO_ORIGINAL_DIR = TMP_ROOT / "design-pilot-intro-original"
DESIGN_PILOT_SPECIAL_TMP_DIR = TMP_ROOT / "design-pilot-special-v1"
DESIGN_PILOT_SPECIAL_ORIGINAL_DIR = TMP_ROOT / "design-pilot-special-original"
WORK_DIR = TMP_ROOT / "layout-work"
ORIGINAL_PDF = ROOT / "source" / "original" / "Dawn - A Diceless Fantasy TTRPG.pdf"

PAGE_W = 594.95996
PAGE_H = 841.91998
TOP = 47
BOTTOM = 54
LEFT_RAIL = 18
RIGHT_RAIL = 18
INNER_MARGIN = 38
GUTTER = 25
COL_W = (PAGE_W - LEFT_RAIL - RIGHT_RAIL - INNER_MARGIN * 2 - GUTTER) / 2
COL_H = PAGE_H - TOP - BOTTOM
WINE_HEX = "#6f1d2b"
RED = (0.44, 0.11, 0.17)
BLACK = (0, 0, 0)
LIGHT_GRAY = (0.94, 0.94, 0.94)
WHITE = (1, 1, 1)
BLUE = (0.38, 0.59, 0.86)
SCENARIO_RED = (0.62, 0.20, 0.25)
GOLD = (0.78, 0.58, 0.02)
BOARD_GRAY = (0.72, 0.72, 0.72)
FONT_DIR = Path("C:/Windows/Fonts")
FONT_ARIAL = str(FONT_DIR / "arial.ttf")
FONT_ARIAL_BOLD = str(FONT_DIR / "arialbd.ttf")
FONT_ARIAL_ITALIC = str(FONT_DIR / "ariali.ttf")
FONT_IMPACT = str(FONT_DIR / "impact.ttf")
FONT_SEGOE_SYMBOL = str(FONT_DIR / "seguisym.ttf")
LOCAL_FONT_DIR = ROOT / "tools" / "layout" / "fonts"
FONT_RUSSO = str(LOCAL_FONT_DIR / "RussoOne-Regular.ttf")
FONT_RUBIK_MONO = str(LOCAL_FONT_DIR / "RubikMonoOne-Regular.ttf")
FONT_OSWALD = str(LOCAL_FONT_DIR / "Oswald-wght.ttf")
FONT_BALSAMIQ_BOLD = str(LOCAL_FONT_DIR / "BalsamiqSans-Bold.ttf")
FONT_BALSAMIQ_BOLD_ITALIC = str(LOCAL_FONT_DIR / "BalsamiqSans-BoldItalic.ttf")
CLOCK_EXAMPLES_IMG = LOCAL_FONT_DIR / "dawn-clock-examples.png"
PAGE_REFERENCE_TARGETS: dict[str, int] = {}

ABILITY_GLOSSARY_ROWS = [
    ("Дышать ✢", "0", "Призраки / Иллюзии", "0", "Вы выигрываете игру ✝", "-1"),
    ("Есть ✢", "0", "Погода ✢", "0", "Ваша жизнь в опасности", "-1"),
    ("Видеть ✢", "0", "Еда", "0", "Настает конкретное время", "-1"),
    ("Стать ✢", "1", "Барьеры / Ловушки", "0", "На вас надето X ☾", "0"),
    ("Усилить", "1", "Растения ✝", "1", "Вы жертвуете X ☾", "0"),
    ("Запустить / Притянуть", "1", "Оружие ближнего боя ✝", "1", "Вы сами создали цель", "0"),
    ("Починить / Исцелить", "1", "Звук", "1", "Вы несете это", "0"),
    ("Остановить / Обездвижить", "2", "Свет / Тень", "1", "Вы слышите / чуете это", "1"),
    ("Дублировать / Воссоздать", "2", "Животные / Чудовища", "1", "Вы танцуете", "1"),
    ("Разрезать / Сломать / Расплавить", "2", "Мана / Электричество", "1", "Вы говорите с целью", "1"),
    ("Повредить / Ушибить", "1", "Люди ✝", "2", "Вы пишете на цели", "0"),
    ("Скрыть / Раскрыть", "2", "Машины ✝", "2", "Вас не видят", "0"),
    ("Контролировать / Управлять", "2", "Четыре стихии ✝", "2", "Вы касаетесь цели", "0"),
    ("Увеличить / Уменьшить", "2", "Жар ✢", "2", "Вы понимаете это", "1"),
    ("Телепортировать / Поменять местами", "2", "Плоть / Кости / Души", "2", "Вы рисуете цель", "1"),
    ("Найти", "2", "Оружие дальнего боя ✝", "2", "Вы объясняете это", "1"),
    ("Создать ✢", "4", "Себя ✢", "2", "Вы задерживаете дыхание", "1"),
    ("Отменить / Обратить", "4", "Гравитация", "3", "Цель слышит вас", "1"),
    ("Слить X с ☾", "X", "Жидкости / Твердые тела / Газы", "4", "Вы видите цель", "2"),
    ("Превратить X в ☾", "X", "Дистанция / Скорость", "4", "Вы помните цель", "3"),
]

INLINE_ART_CROPS: dict[str, tuple[int, tuple[float, float, float, float]]] = {
    "world_sand_stars": (12, (300, 76, 555, 765)),
    "world_daggers_dusk": (15, (42, 76, 292, 765)),
    "world_fae_frost": (18, (318, 118, 560, 765)),
    "universal_titania": (23, (316, 262, 570, 765)),
    "universal_pylana": (26, (314, 244, 568, 735)),
    "duel_acord_yvon": (28, (314, 286, 552, 755)),
    "freeplay_morgan": (40, (340, 270, 552, 670)),
    "bonds_yvon_anise": (45, (306, 442, 578, 755)),
    "combat_mainspring": (55, (300, 58, 568, 650)),
    "combat_zone_diagrams": (57, (78, 260, 548, 715)),
    "combat_basic_actions": (60, (30, 360, 565, 696)),
    "combat_attacks": (61, (282, 94, 568, 644)),
    "combat_defense": (62, (32, 104, 300, 724)),
    "powerhouse_jagen": (68, (318, 348, 550, 730)),
    "powerhouse_yvonne": (71, (314, 222, 552, 572)),
    "vagabond_glance": (75, (316, 348, 550, 735)),
    "bulwark_divinara": (79, (88, 402, 310, 724)),
    "altruist_board": (85, (336, 66, 552, 465)),
    "disruptor_mafiya": (90, (305, 73, 570, 765)),
    "ruiner_table": (99, (310, 445, 548, 700)),
    "narrator_demetrius": (104, (32, 266, 310, 780)),
    "narrator_incoming": (107, (318, 296, 552, 718)),
    "enemy_paladin": (112, (310, 384, 555, 778)),
    "enemy_zohar": (114, (28, 342, 312, 724)),
    "enemy_mochi": (118, (300, 44, 578, 448)),
}

INLINE_ART_LABELS: dict[str, tuple[tuple[float, float, float, float], str]] = {
    "world_sand_stars": ((360, 638, 550, 764), "ГЛАВА ПЕРВАЯ:\nЯРКИЕ НОЧИ"),
    "world_daggers_dusk": ((82, 626, 292, 760), "ГЛАВА ПЕРВАЯ:\nВРЕМЯ ШОУ"),
    "world_fae_frost": ((360, 606, 560, 760), "ГЛАВА ПЕРВАЯ:\nШАГ СЛИШКОМ\nДАЛЕКО"),
    "universal_titania": ((372, 642, 570, 762), "ТИТАНИЯ,\nОТВАЖНАЯ\nИССЛЕДОВАТЕЛЬНИЦА"),
    "universal_pylana": ((362, 606, 568, 728), "ФРЭНСИС,\nМАСТЕР\nПАВИЛЬОНОВ"),
    "duel_acord_yvon": ((350, 636, 550, 752), "АКОРД И ИВОН,\nВНЕЗАПНАЯ\nНЕНАВИСТЬ"),
    "bonds_yvon_anise": ((422, 650, 574, 750), "ИВОН И АНСЕЙС,\nРЫЦАРИ-СОПЕРНИКИ"),
    "combat_mainspring": ((350, 570, 500, 645), "МОРГИАНА КАСС,\nЧЕМПИОН\nАРЕНЫ"),
    "combat_basic_actions": ((30, 356, 196, 426), "АЛИ ШАР,\nБЕЛАЯ ГОНЧАЯ"),
    "combat_attacks": ((286, 520, 452, 642), "КВИНС,\nФЕЙСКИЙ\nИЗГОЙ"),
    "combat_defense": ((68, 548, 274, 718), "ЛИСАНДЕР,\nНЕСЛОМИМЫЙ"),
    "powerhouse_jagen": ((350, 560, 545, 710), "ДЖАГЕН ПОЛЛАПС,\nИНОМИРЕЦ"),
    "powerhouse_yvonne": ((344, 392, 552, 560), "МОРГИАНА КАСС,\nОСВОБОДИТЕЛЬНИЦА\nДЮН"),
    "vagabond_glance": ((364, 526, 550, 692), "КВИНС,\nИЗГНАННЫЙ\nИЗОБРЕТАТЕЛЬ"),
    "bulwark_divinara": ((88, 582, 308, 718), "ДУНЬЯЗАД,\nСТРАЖ\nИМПЕРАТРИЦЫ"),
    "disruptor_mafiya": ((354, 642, 524, 762), "ИППОЛИТА,\nНОВАЯ\nУЧЕНИЦА"),
    "narrator_demetrius": ((32, 684, 308, 778), "ДЕМЕТРИЙ,\nОТРЕЧЕННЫЙ"),
    "narrator_incoming": ((320, 588, 548, 716), "МУШИР ХУССЕЙН,\nВЛАДЫКА\nБАТАЛЬОНА"),
    "enemy_paladin": ((310, 638, 552, 770), "ФИЛОСТРАТ,\nКАПИТАН\nМЭЙФЛАЙ"),
    "enemy_zohar": ((134, 602, 310, 718), "ЗЕЙН АЛЬ-АСНАМ,\nИМПЕРСКИЙ\nСТРАЖ"),
    "enemy_mochi": ((442, 312, 570, 436), "ХУОН СЕНЬОР,\nГЛАВА\nСИНДИКАТА"),
}

INLINE_ART_CLEAR_RECTS: dict[str, tuple[float, float, float, float]] = {
    "world_sand_stars": (300, 620, 555, 765),
    "world_daggers_dusk": (42, 600, 292, 765),
    "world_fae_frost": (320, 590, 560, 765),
    "universal_titania": (316, 620, 570, 765),
    "universal_pylana": (314, 560, 568, 728),
    "duel_acord_yvon": (314, 610, 552, 755),
    "bonds_yvon_anise": (306, 620, 578, 755),
    "combat_mainspring": (350, 575, 500, 642),
    "combat_basic_actions": (30, 356, 196, 426),
    "combat_attacks": (282, 500, 568, 644),
    "combat_defense": (32, 548, 300, 724),
    "powerhouse_jagen": (318, 540, 550, 724),
    "powerhouse_yvonne": (314, 392, 552, 560),
    "vagabond_glance": (316, 520, 550, 735),
    "bulwark_divinara": (88, 560, 310, 724),
    "disruptor_mafiya": (348, 626, 570, 742),
    "narrator_demetrius": (32, 684, 310, 780),
    "narrator_incoming": (318, 560, 552, 718),
    "enemy_paladin": (310, 638, 555, 778),
    "enemy_zohar": (28, 590, 312, 724),
    "enemy_mochi": (420, 292, 578, 448),
}

INLINE_ART_INSERTS: dict[str, list[dict[str, object]]] = {
    "pages-009-019-worlds-of-dawn.md": [
        {"heading": "Мир Песка и Звезд", "kind": "h2", "art": "world_sand_stars", "class": "portrait", "after": 1},
        {"heading": "Мир Кинжалов и Сумерек", "kind": "h2", "art": "world_daggers_dusk", "class": "portrait", "after": 1},
        {"heading": "Мир Фей и Мороза", "kind": "h2", "art": "world_fae_frost", "class": "compact", "after": 1},
    ],
    "pages-020-028-universal-rules.md": [
        {"heading": "Ступени", "kind": "h2", "art": "universal_titania", "class": "portrait", "after": 2},
        {"heading": "Выведение из строя", "kind": "h2", "art": "universal_pylana", "class": "compact", "after": 1},
        {"heading": "Пример игры: Дуэли", "kind": "h2", "art": "duel_acord_yvon", "class": "compact", "after": 1},
    ],
    "pages-037-051-unstructured-play.md": [
        {"heading": "Провал бросков испытания", "kind": "h2", "art": "freeplay_morgan", "class": "compact", "after": 2},
        {"heading": "Связи", "kind": "h2", "art": "bonds_yvon_anise", "class": "wide", "after": 3},
    ],
    "pages-052-064-structured-combat-core.md": [
        {"heading": "Зоны", "kind": "h3", "art": "combat_zone_diagrams", "class": "diagram", "after": 1},
        {"heading": "Базовые действия", "kind": "h2", "art": "combat_basic_actions", "class": "wide", "after": 2},
        {"heading": "Атаки", "kind": "h2", "art": "combat_attacks", "class": "portrait", "after": 0},
        {"heading": "Защита", "kind": "h2", "art": "combat_defense", "class": "compact", "after": 1},
    ],
    "pages-065-070-powerhouse-techniques.md": [
        {"heading": "Техники сложности ★★", "kind": "h2", "art": "powerhouse_jagen", "class": "compact", "after": 0},
        {"heading": "Техники сложности ★★★", "kind": "h2", "art": "powerhouse_yvonne", "class": "wide", "after": 0},
    ],
    "pages-071-076-vagabond-techniques.md": [
        {"heading": "Техники сложности ★★", "kind": "h2", "art": "vagabond_glance", "class": "thumb", "after": 0},
    ],
    "pages-077-081-bulwark-techniques.md": [
        {"heading": "Техники сложности ★", "kind": "h2", "art": "bulwark_divinara", "class": "compact", "after": 0},
    ],
    "pages-082-087-altruist-techniques.md": [
        {"heading": "Техники сложности ★", "kind": "h2", "art": "altruist_board", "class": "compact", "after": 0},
    ],
    "pages-088-093-disruptor-techniques.md": [
        {"heading": "Техники сложности ★", "kind": "h2", "art": "disruptor_mafiya", "class": "portrait", "after": 0},
    ],
    "pages-094-099-ruiner-techniques.md": [
        {"heading": "Техники сложности ★★★", "kind": "h2", "art": "ruiner_table", "class": "wide", "after": 0},
    ],
    "pages-100-108-narrator-tools.md": [
        {"heading": "Правила Антагонистов", "kind": "h2", "art": "narrator_demetrius", "class": "compact", "after": 1},
        {"heading": "Дизайн столкновений", "kind": "h2", "art": "narrator_incoming", "class": "wide", "after": 1},
    ],
    "pages-109-119-general-enemy-types.md": [
        {"heading": "Враги-Танки", "kind": "h2", "art": "enemy_paladin", "class": "wide", "after": 0},
        {"heading": "Враги Поддержки", "kind": "h2", "art": "enemy_zohar", "class": "wide", "after": 0},
        {"heading": "Враги-Движки", "kind": "h2", "art": "enemy_mochi", "class": "wide", "after": 0},
    ],
}

FORCED_CARD_COLUMN_BREAKS = {
    "Хитроумный боец",
}


PILOT_FILES = [
    "pages-005-008-introduction.md",
    "pages-029-036-character-creation.md",
    "pages-065-070-powerhouse-techniques.md",
    "pages-109-119-general-enemy-types.md",
]

BOOK_FILES = [
    "pages-001-004-front-matter-toc.md",
    "pages-005-008-introduction.md",
    "pages-009-019-worlds-of-dawn.md",
    "pages-020-028-universal-rules.md",
    "pages-029-036-character-creation.md",
    "pages-037-051-unstructured-play.md",
    "pages-052-064-structured-combat-core.md",
    "pages-065-070-powerhouse-techniques.md",
    "pages-071-076-vagabond-techniques.md",
    "pages-077-081-bulwark-techniques.md",
    "pages-082-087-altruist-techniques.md",
    "pages-088-093-disruptor-techniques.md",
    "pages-094-099-ruiner-techniques.md",
    "pages-100-108-narrator-tools.md",
    "pages-109-119-general-enemy-types.md",
    "pages-120-124-combat-stakes-modifiers-credits.md",
]

MAJOR_OPENERS = {
    "pages-005-008-introduction.md": {
        "source_page": 6,
        "title": "Введение",
        "caption": "Путь начинается.",
    },
    "pages-009-019-worlds-of-dawn.md": {
        "source_page": 10,
        "title": "Миры DAWN",
        "caption": "Земля простирается перед вами: тайна, чудо и мир, созданный вами самими.",
    },
    "pages-020-028-universal-rules.md": {
        "source_page": 21,
        "title": "Универсальные правила",
        "caption": "Эти правила применяются ко всем разделам игры. Обратите на них внимание.",
    },
    "pages-029-036-character-creation.md": {
        "source_page": 30,
        "title": "Создание персонажа",
        "caption": "Полное руководство по созданию персонажей для свободной игры и структурированного боя.",
    },
    "pages-037-051-unstructured-play.md": {
        "source_page": 38,
        "title": "Свободная игра",
        "caption": "Правила, которые ведут нетактические элементы DAWN: погружение, напряжение и история.",
    },
    "pages-052-064-structured-combat-core.md": {
        "source_page": 53,
        "title": "Структурированный бой",
        "caption": "Тактический слой DAWN: создавайте сильных персонажей и сражайтесь с угрозами своего мира.",
    },
    "techniques": {
        "source_page": 64,
        "title": "Техники",
        "caption": "Глоссарий каждой Техники, вынесенный отдельно от остальной книги для удобного доступа.",
    },
    "pages-100-108-narrator-tools.md": {
        "source_page": 101,
        "title": "Инструменты Нарратора",
        "caption": "Этот раздел для тех, кто хочет самостоятельно провести Приключение. Удачи!",
    },
    "pages-109-119-general-enemy-types.md": {
        "source_page": 110,
        "title": "Общие типы врагов",
        "caption": "Перечень всех типов врагов, распределенных по их роли в среднем бою.",
    },
}

ARCHETYPE_OPENERS = {
    "pages-065-070-powerhouse-techniques.md": {
        "source_page": 66,
        "label": "КАИД АЛЬ-РАШИД,\nДВУДУШНЫЙ",
        "label_rect": (22, 318, 196, 452),
    },
    "pages-071-076-vagabond-techniques.md": {
        "source_page": 72,
        "label": "ИВОН ШЕВАЛЬЕ,\nПОСЫЛЬНЫЙ",
        "label_rect": (385, 176, 575, 322),
    },
    "pages-077-081-bulwark-techniques.md": {
        "source_page": 78,
        "label": "ЛИСАНДЕР,\nСТРАЖ СТЕНЫ",
        "label_rect": (22, 532, 190, 666),
    },
    "pages-082-087-altruist-techniques.md": {
        "source_page": 83,
        "label": "КАИРО МАРУФ,\nВЕСЕЛЫЙ\nКОЧЕВНИК",
        "label_rect": (405, 548, 576, 670),
    },
    "pages-088-093-disruptor-techniques.md": {
        "source_page": 89,
        "label": "АНСЕЙС ГАРРИСОН,\nНАЕМНЫЙ РЫЦАРЬ",
        "label_rect": (28, 190, 200, 276),
    },
    "pages-094-099-ruiner-techniques.md": {
        "source_page": 95,
        "label": "ТИТАНИЯ,\nВУНДЕРКИНД",
        "label_rect": (410, 462, 578, 620),
    },
}


CSS = """
@font-face { font-family: DawnBody; src: url(arial.ttf); }
@font-face { font-family: DawnBody; font-weight: 700; src: url(arialbd.ttf); }
@font-face { font-family: DawnBody; font-style: italic; src: url(ariali.ttf); }
@font-face { font-family: DawnBody; font-weight: 700; font-style: italic; src: url(arialbi.ttf); }
@font-face { font-family: DawnHead; src: url(impact.ttf); }
@font-face { font-family: DawnSubhead; src: url(arialbi.ttf); }
@font-face { font-family: DawnMono; src: url(consola.ttf); }
body {
  font-family: DawnBody, sans-serif;
  font-size: 9.15pt;
  line-height: 1.16;
  color: #111;
}
p { margin: 0 0 3.6pt 0; text-align: left; }
strong {
  color: #6f1d2b;
  font-weight: 400;
}
em { font-style: italic; }
.influence-icon {
  color: #6f1d2b;
  font-family: DawnBody, sans-serif;
  font-style: normal;
  font-weight: 900;
  vertical-align: 0.02em;
  font-size: 0.9em;
  letter-spacing: 0;
}
.influence-group {
  white-space: nowrap;
  font-style: normal;
}
h2 .influence-icon,
h3 .influence-icon {
  font-size: 0.78em;
}
code {
  font-family: DawnMono, monospace;
  font-size: 7.9pt;
  background-color: #eeeeee;
  padding: 0.2pt 1pt;
}
h1 {
  font-family: DawnHead, sans-serif;
  font-size: 31pt;
  font-weight: 400;
  text-transform: uppercase;
  margin: 0 0 9pt 0;
  letter-spacing: 0;
}
h2 {
  font-family: DawnSubhead, sans-serif;
  font-size: 13.6pt;
  font-weight: 900;
  font-style: italic;
  text-transform: uppercase;
  margin: 6pt 0 5.5pt 0;
  border-bottom: 2pt solid #6f1d2b;
  page-break-after: avoid;
}
h3 {
  font-family: DawnSubhead, sans-serif;
  font-size: 9.6pt;
  font-weight: 900;
  margin: 3.6pt 0 4.4pt 0;
  page-break-after: avoid;
  break-after: avoid;
}
h4 {
  font-family: DawnSubhead, sans-serif;
  font-size: 9.1pt;
  font-weight: 900;
  margin: 2.4pt 0 3.4pt 0;
  page-break-after: avoid;
}
.tech-title {
  font-family: DawnSubhead, sans-serif;
  background: #151515;
  color: white;
  padding: 3.4pt 4.8pt;
  border: 0;
  margin: 0;
  font-weight: 900;
  page-break-after: avoid;
  break-after: avoid;
}
.flavor {
  font-style: italic;
  color: #333;
  border-left: 1.8pt solid #111;
  padding-left: 5pt;
  margin: 3.5pt 0 4.5pt 0;
  page-break-inside: avoid;
  break-inside: avoid;
}
.example {
  font-style: italic;
  color: #333;
  border-left: 1.2pt dotted #555;
  padding-left: 4pt;
  page-break-inside: avoid;
  break-inside: avoid;
}
.ruleline {
  border-left: 2pt solid #111;
  padding-left: 4pt;
  page-break-inside: avoid;
  break-inside: avoid;
}
.reward {
  border-left: 2pt solid #6f1d2b;
  padding-left: 4pt;
  page-break-inside: avoid;
  break-inside: avoid;
}
.callout {
  border: 1pt solid #6f1d2b;
  padding: 5.5pt;
  background-color: #fffdfd;
}
.small-heading {
  font-family: DawnSubhead, sans-serif;
  font-weight: 900;
}
.card {
  border-left: 0.65pt solid #222;
  border-right: 0.65pt solid #222;
  border-bottom: 0.65pt solid #222;
  margin: 4pt 0 7.2pt 0;
  padding: 0 0 2.6pt 0;
  page-break-inside: avoid;
  break-inside: avoid;
}
.card.force-card-break {
  page-break-before: always;
  break-before: page;
}
.card .flavor,
.card .example {
  border-left: 0;
  border-top: 0.45pt dotted #999;
  border-bottom: 0.45pt solid #bbb;
  background-color: #f7f7f7;
  margin: 0 0 2.6pt 0;
  padding: 3.4pt 4.8pt;
}
.card .ruleline,
.card .reward {
  margin: 0;
  padding: 2.4pt 4.8pt 2.4pt 4.2pt;
}
.card p:not(.flavor):not(.example):not(.ruleline):not(.reward),
.card ul {
  padding-left: 4.5pt;
  padding-right: 4.5pt;
}
ul { margin: 0 0 5pt 11pt; padding: 0; }
li { margin: 0 0 3.2pt 0; }
table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 2.5pt 0 6pt 0;
  font-size: 8.05pt;
  page-break-inside: avoid;
  break-inside: avoid;
}
thead,
tbody,
tr {
  page-break-inside: avoid;
  break-inside: avoid;
}
td, th {
  border: 0.45pt solid #333;
  padding: 2.3pt 2.6pt;
  vertical-align: top;
}
th {
  background: #111;
  color: white;
  font-weight: 800;
}
table.card {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: inherit;
  page-break-inside: avoid;
  break-inside: avoid;
}
table.card tr,
table.card td.card-cell {
  page-break-inside: avoid;
  break-inside: avoid;
}
table.card td.card-cell {
  border: 0;
  padding: 0;
}
.note {
  border: 1pt solid #6f1d2b;
  padding: 5pt;
  background: #fff;
}
.smallcap {
  font-weight: 900;
  text-transform: uppercase;
}
"""

CSS_ARCHETYPE = (
    CSS.replace("font-size: 9.15pt;", "font-size: 8.95pt;")
    .replace("line-height: 1.16;", "line-height: 1.13;")
    .replace("margin: 0 0 3.6pt 0;", "margin: 0 0 3.0pt 0;")
)

CSS_DESIGN_INTRO = """
@font-face { font-family: DawnBody; src: url(Rubik-wght.ttf); }
@font-face { font-family: DawnBody; font-style: italic; src: url(Rubik-Italic-wght.ttf); }
@font-face { font-family: DawnDisplay; src: url(RussoOne-Regular.ttf); }
@font-face { font-family: DawnComic; src: url(BalsamiqSans-BoldItalic.ttf); }
@font-face { font-family: DawnHand; src: url(BalsamiqSans-Regular.ttf); }
@font-face { font-family: DawnMono; src: url(RubikMonoOne-Regular.ttf); }
body {
  font-family: DawnBody, sans-serif;
  font-size: 10.35pt;
  line-height: 1.22;
  color: #080808;
}
p { margin: 0 0 6.4pt 0; text-align: left; }
strong {
  color: #6f1d2b;
  font-weight: 400;
}
em { font-style: italic; }
.influence-icon {
  color: #6f1d2b;
  font-family: DawnBody, sans-serif;
  font-style: normal;
  font-weight: 900;
  vertical-align: 0.02em;
  font-size: 0.9em;
  letter-spacing: 0;
}
.influence-group {
  white-space: nowrap;
  font-style: normal;
}
h2 .influence-icon,
h3 .influence-icon {
  font-size: 0.78em;
}
code {
  font-family: DawnMono, monospace;
  font-size: 7.4pt;
  background-color: #eeeeee;
  padding: 0.2pt 1pt;
}
h1 {
  font-family: DawnDisplay, sans-serif;
  font-size: 37pt;
  font-weight: 900;
  margin: 0 0 10pt 0;
  letter-spacing: 0;
  text-align: center;
  text-transform: uppercase;
}
h2 {
  font-family: DawnComic, sans-serif;
  font-size: 18.2pt;
  font-weight: 900;
  font-style: italic;
  line-height: 1.05;
  margin: 10pt 0 5pt 0;
  border-bottom: 3pt solid #6f1d2b;
  page-break-after: avoid;
  break-after: avoid;
}
h3 {
  font-family: DawnComic, sans-serif;
  font-size: 14.8pt;
  font-weight: 900;
  font-style: italic;
  margin: 11pt 0 4pt 0;
  border-bottom: 1.5pt dotted #6f1d2b;
  padding-bottom: 1.2pt;
  page-break-after: avoid;
  break-after: avoid;
}
h4 {
  font-family: DawnComic, sans-serif;
  font-size: 11.7pt;
  font-weight: 900;
  font-style: italic;
  margin: 12pt 0 2.8pt 0;
  page-break-after: avoid;
  break-after: avoid;
}
.intro-callout {
  border: 2pt solid #6f1d2b;
  padding: 8.5pt 9.5pt 5.5pt 9.5pt;
  margin: 1pt 0 14pt 0;
  page-break-inside: avoid;
  break-inside: avoid;
}
.intro-callout p {
  text-align: center;
  font-size: 10.75pt;
  line-height: 1.23;
  margin: 0 0 11pt 0;
}
.intro-callout p:last-child { margin-bottom: 0; }
.joel-note {
  width: 100%;
  border-collapse: collapse;
  border-spacing: 0;
  margin: 8pt 0 8pt 0;
  font-size: 9.7pt;
  line-height: 1.14;
  page-break-inside: avoid;
  break-inside: avoid;
}
.joel-note tr,
.joel-note td {
  page-break-inside: avoid;
  break-inside: avoid;
}
.joel-note td {
  border: 1.8pt solid #6f1d2b;
  padding: 6.5pt 7.5pt 4.5pt 7.5pt;
  background: #fff;
  vertical-align: top;
}
.joel-note h3 {
  border-bottom: 0;
  margin: 0 0 5pt 0;
  padding: 0;
}
.joel-note p:last-child { margin-bottom: 0; }
.clock-examples {
  margin: 3.5pt 0 8pt 0;
  text-align: center;
  page-break-inside: avoid;
  break-inside: avoid;
}
.clock-examples img {
  width: 100%;
  max-width: 100%;
}
.inline-art {
  margin: 4pt 0 9pt 0;
  text-align: center;
  page-break-inside: avoid;
  break-inside: avoid;
}
.inline-art.portrait,
.inline-art.compact,
.inline-art.wide {
  break-before: column;
}
.inline-art img {
  display: block;
  margin: 0 auto;
  width: 100%;
  max-width: 100%;
  height: auto;
}
.inline-art.compact img,
.inline-art.portrait img {
  width: 100%;
}
.inline-art.portrait img {
  height: 610pt;
  width: auto;
}
.inline-art.wide img,
.inline-art.diagram img {
  width: 100%;
}
.inline-art.thumb img {
  width: 72%;
}
.flavor {
  font-family: DawnHand, sans-serif;
  font-size: 10.1pt;
  color: #444;
  background-color: #f3f3f3;
  border: 0.9pt dotted #555;
  padding: 6pt 7pt;
  margin: 5pt 0 8pt 0;
  page-break-inside: avoid;
  break-inside: avoid;
}
blockquote {
  font-family: DawnHand, sans-serif;
  font-size: 10.9pt;
  line-height: 1.25;
  color: #444;
  background-color: #f2f2f2;
  border: 1.2pt dotted #555;
  margin: 6pt 0 8pt 0;
  padding: 7pt 8pt;
  page-break-inside: avoid;
  break-inside: avoid;
}
blockquote p { margin: 0 0 7pt 0; }
.quote-card {
  break-before: column;
  page-break-inside: avoid;
  break-inside: avoid;
}
.quote-card h4 { margin-top: 6pt; }
ul { margin: 0 0 7pt 13pt; padding: 0; }
li { margin: 0 0 4.8pt 0; }
table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 4pt 0 8pt 0;
  font-size: 8.7pt;
}
td, th {
  border: 0.5pt solid #333;
  padding: 3pt 3.2pt;
  vertical-align: top;
}
th {
  background: #111;
  color: white;
  font-weight: 900;
}
"""

CSS_DESIGN_BOOK = CSS_DESIGN_INTRO + """
body {
  font-size: 10.15pt;
  line-height: 1.17;
}
p { margin: 0 0 5.1pt 0; text-align: left; }
h2 {
  font-size: 16.4pt;
  margin: 8pt 0 4.5pt 0;
}
h3 {
  font-size: 13.1pt;
  margin: 8pt 0 3pt 0;
}
h4 {
  font-size: 10.9pt;
  margin: 9pt 0 2.5pt 0;
}
.intro-callout p {
  font-size: 10.45pt;
  line-height: 1.2;
  margin: 0 0 9pt 0;
}
.flavor,
blockquote {
  font-size: 10.2pt;
}
.tech-title {
  font-family: DawnComic, sans-serif;
  font-size: 12.3pt;
  line-height: 1.04;
  background: #151515;
  color: white;
  padding: 3.1pt 4.5pt;
  border: 0;
  margin: 0;
  font-weight: 900;
}
.card {
  border-left: 0.8pt solid #222;
  border-right: 0.8pt solid #222;
  border-bottom: 0.8pt solid #222;
  margin: 3.4pt 0 6pt 0;
  padding: 0 0 2.2pt 0;
  page-break-inside: avoid;
  break-inside: avoid;
}
.card .flavor,
.card .example {
  border-left: 0;
  border-top: 0.6pt dotted #6f1d2b;
  border-bottom: 0.45pt solid #bbb;
  background-color: #f3f3f3;
  margin: 0 0 2.2pt 0;
  padding: 3pt 4.5pt;
}
.card .ruleline,
.card .reward {
  margin: 0;
  padding: 2.3pt 4.5pt 2.3pt 4.1pt;
}
.card p:not(.flavor):not(.example):not(.ruleline):not(.reward),
.card ul {
  padding-left: 4.5pt;
  padding-right: 4.5pt;
}
.ruleline {
  border-left: 2pt solid #111;
  padding-left: 5pt;
  page-break-inside: avoid;
  break-inside: avoid;
}
.reward {
  border-left: 2pt solid #6f1d2b;
  padding-left: 5pt;
  page-break-inside: avoid;
  break-inside: avoid;
}
.joel-note {
  font-size: 9.35pt;
  line-height: 1.12;
  width: 100%;
  border-collapse: collapse;
  border-spacing: 0;
  margin: 6pt 0 7pt 0;
  page-break-inside: avoid;
  break-inside: avoid;
}
.joel-note tr,
.joel-note td {
  page-break-inside: avoid;
  break-inside: avoid;
}
.joel-note td {
  border: 1.8pt solid #6f1d2b;
  padding: 5.2pt 6.2pt 4.2pt 6.2pt;
  background: #fff;
  vertical-align: top;
}
.joel-note h3 {
  font-size: 12.3pt;
  line-height: 1.05;
  border-bottom: 0;
  margin: 0 0 4pt 0;
  padding: 0;
}
.joel-note p {
  margin: 0 0 3.6pt 0;
}
.joel-note p:last-child {
  margin-bottom: 0;
}
.note {
  border: 1.8pt solid #6f1d2b;
  padding: 6.5pt 7.5pt 4.5pt 7.5pt;
  background: #fff;
  margin: 8pt 0;
  page-break-inside: avoid;
  break-inside: avoid;
}
table.card {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: inherit;
  page-break-inside: avoid;
  break-inside: avoid;
}
table.card tr,
table.card td.card-cell {
  page-break-inside: avoid;
  break-inside: avoid;
}
table.card td.card-cell {
  border: 0;
  padding: 0;
}
p,
li {
  orphans: 2;
  widows: 2;
}
.card.deployment-card {
  page-break-inside: avoid;
  break-inside: avoid;
}
.card.deployment-card + .card.deployment-card {
  break-before: column;
}
.card.enemy-card {
  min-height: 190pt;
}
.card.enemy-card + .card.enemy-card {
  break-before: column;
}
.card.enemy-card-break {
  break-before: column;
}
"""

CSS_ENEMY_CARDS = CSS_DESIGN_BOOK + """
body {
  font-size: 9.75pt;
  line-height: 1.12;
}
p { margin: 0 0 3.5pt 0; }
h2 {
  font-size: 15.6pt;
  margin: 6.4pt 0 3.7pt 0;
}
h3 {
  font-size: 12pt;
  margin: 6.2pt 0 2.5pt 0;
}
.tech-title {
  font-size: 11.45pt;
  line-height: 1.02;
  padding: 2.45pt 4.1pt;
}
.card {
  margin: 2.6pt 0 5.2pt 0;
  padding: 0 0 1.7pt 0;
}
.card .flavor,
.card .example {
  margin: 0 0 1.8pt 0;
  padding: 2.25pt 4.1pt;
}
.card .ruleline,
.card .reward {
  padding: 1.85pt 4.1pt 1.85pt 3.8pt;
}
.card p:not(.flavor):not(.example):not(.ruleline):not(.reward),
.card ul {
  padding-left: 4.1pt;
  padding-right: 4.1pt;
}
ul { margin: 0 0 4.6pt 12pt; padding: 0; }
li { margin: 0 0 2.9pt 0; }
"""

DESIGN_RAIL = 15
DESIGN_RAIL_OUTER = 1
DESIGN_TOP = 45
DESIGN_BOTTOM = 58
DESIGN_INNER_MARGIN = 30
DESIGN_GUTTER = 22
DESIGN_RAIL_INNER_X = DESIGN_RAIL_OUTER + DESIGN_RAIL
DESIGN_COL_W = (PAGE_W - DESIGN_RAIL_INNER_X * 2 - DESIGN_INNER_MARGIN * 2 - DESIGN_GUTTER) / 2
DESIGN_COL_H = PAGE_H - DESIGN_TOP - DESIGN_BOTTOM

FINAL_SECTION_CSS = {
    "pages-009-019-worlds-of-dawn.md": CSS_ARCHETYPE,
}


@dataclass
class Block:
    html: str
    kind: str = "p"
    section: str = "DAWN"


def normalize_text(text: str) -> str:
    text = text.replace("\u00a0", " ")
    text = re.sub(r"[\u200b\u200c\u200d]", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    text = re.sub(r"([(\[])\s+", r"\1", text)
    text = re.sub(r"\s+([)\]])", r"\1", text)
    return text.strip()


def replace_page_references(text: str) -> str:
    if not PAGE_REFERENCE_TARGETS or not re.search(r"стр\.\s*[XХ]", text):
        return text

    rules = [
        ("Потратьте Ранги персонажа", "Ранги"),
        ("Выберите Мировоззрение", "Мировоззрения"),
        ("Назначьте Атрибуты", "Атрибуты"),
        ("Выберите Техники", "Техники"),
        ("Определите базовые показатели", "Урон и Здоровье"),
        ("базовые действия", "Базовые действия"),
        ("правилами врагов", "Общие типы врагов"),
        ("правила врагов", "Общие типы врагов"),
    ]
    folded = text.casefold()
    for needle, target in rules:
        page_no = PAGE_REFERENCE_TARGETS.get(toc_key(target))
        if page_no is None or needle.casefold() not in folded:
            continue
        return re.sub(r"стр\.\s*[XХ]", f"стр. {page_no}", text)
    return text


def inline_art_path(art_id: str) -> Path:
    return LOCAL_FONT_DIR / f"dawn-art-ru-{art_id}.png"


def expand_rect(
    rect: tuple[float, float, float, float],
    bounds: tuple[float, float, float, float],
    pad: float,
) -> tuple[float, float, float, float]:
    x0, y0, x1, y1 = rect
    bx0, by0, bx1, by1 = bounds
    return (
        max(bx0, x0 - pad),
        max(by0, y0 - pad),
        min(bx1, x1 + pad),
        min(by1, y1 + pad),
    )


def fit_label_font(draw: ImageDraw.ImageDraw, lines: list[str], box_w: int, box_h: int) -> ImageFont.FreeTypeFont:
    font_path = FONT_BALSAMIQ_BOLD_ITALIC if Path(FONT_BALSAMIQ_BOLD_ITALIC).exists() else FONT_BALSAMIQ_BOLD
    for size in range(52, 13, -1):
        font = ImageFont.truetype(font_path, size)
        line_boxes = [draw.textbbox((0, 0), line, font=font) for line in lines]
        text_w = max((box[2] - box[0] for box in line_boxes), default=0)
        line_h = max((box[3] - box[1] for box in line_boxes), default=0)
        gap = max(1, int(size * 0.10))
        text_h = line_h * len(lines) + gap * max(0, len(lines) - 1)
        if text_w <= box_w and text_h <= box_h:
            return font
    return ImageFont.truetype(font_path, 14)


def overlay_translated_art_label(
    image: Image.Image,
    crop_rect: tuple[float, float, float, float],
    label_rect: tuple[float, float, float, float],
    text: str,
) -> None:
    draw_scaled_rect(image, crop_rect, label_rect, fill="white", outline="black")

    crop_x0, crop_y0, crop_x1, crop_y1 = crop_rect
    scale_x = image.width / (crop_x1 - crop_x0)
    scale_y = image.height / (crop_y1 - crop_y0)
    x0, y0, x1, y1 = label_rect
    box = (
        int(round((x0 - crop_x0) * scale_x)),
        int(round((y0 - crop_y0) * scale_y)),
        int(round((x1 - crop_x0) * scale_x)),
        int(round((y1 - crop_y0) * scale_y)),
    )

    draw = ImageDraw.Draw(image)
    pad_x = max(8, int(round(8 * scale_x)))
    pad_y = max(6, int(round(6 * scale_y)))
    inner_w = max(1, box[2] - box[0] - pad_x * 2)
    inner_h = max(1, box[3] - box[1] - pad_y * 2)
    lines = [line.strip().upper() for line in text.splitlines() if line.strip()]
    font = fit_label_font(draw, lines, inner_w, inner_h)

    line_boxes = [draw.textbbox((0, 0), line, font=font) for line in lines]
    line_h = max((line_box[3] - line_box[1] for line_box in line_boxes), default=0)
    gap = max(1, int(font.size * 0.10))
    text_h = line_h * len(lines) + gap * max(0, len(lines) - 1)
    y = box[1] + (box[3] - box[1] - text_h) / 2
    for line, line_box in zip(lines, line_boxes):
        line_w = line_box[2] - line_box[0]
        x = box[0] + (box[2] - box[0] - line_w) / 2
        draw.text((x, y - line_box[1]), line, fill="black", font=font)
        y += line_h + gap


def draw_label_text_only(
    image: Image.Image,
    crop_rect: tuple[float, float, float, float],
    text_rect: tuple[float, float, float, float],
    text: str,
) -> None:
    crop_x0, crop_y0, crop_x1, crop_y1 = crop_rect
    scale_x = image.width / (crop_x1 - crop_x0)
    scale_y = image.height / (crop_y1 - crop_y0)
    x0, y0, x1, y1 = text_rect
    box = (
        int(round((x0 - crop_x0) * scale_x)),
        int(round((y0 - crop_y0) * scale_y)),
        int(round((x1 - crop_x0) * scale_x)),
        int(round((y1 - crop_y0) * scale_y)),
    )

    draw = ImageDraw.Draw(image)
    pad_x = max(5, int(round(5 * scale_x)))
    pad_y = max(4, int(round(4 * scale_y)))
    inner_w = max(1, box[2] - box[0] - pad_x * 2)
    inner_h = max(1, box[3] - box[1] - pad_y * 2)
    lines = [line.strip().upper() for line in text.splitlines() if line.strip()]
    font = fit_label_font(draw, lines, inner_w, inner_h)

    line_boxes = [draw.textbbox((0, 0), line, font=font) for line in lines]
    line_h = max((line_box[3] - line_box[1] for line_box in line_boxes), default=0)
    gap = max(1, int(font.size * 0.10))
    text_h = line_h * len(lines) + gap * max(0, len(lines) - 1)
    y = box[1] + (box[3] - box[1] - text_h) / 2
    for line, line_box in zip(lines, line_boxes):
        line_w = line_box[2] - line_box[0]
        x = box[0] + (box[2] - box[0] - line_w) / 2
        draw.text((x, y - line_box[1]), line, fill="black", font=font)
        y += line_h + gap


def restore_large_dark_components(
    image: Image.Image,
    source_image: Image.Image,
    crop_rect: tuple[float, float, float, float],
    restore_rect: tuple[float, float, float, float],
    *,
    threshold: int = 96,
    min_area: int = 1200,
) -> None:
    crop_x0, crop_y0, crop_x1, crop_y1 = crop_rect
    scale_x = source_image.width / (crop_x1 - crop_x0)
    scale_y = source_image.height / (crop_y1 - crop_y0)
    x0, y0, x1, y1 = restore_rect
    left = int(round((x0 - crop_x0) * scale_x))
    top = int(round((y0 - crop_y0) * scale_y))
    right = int(round((x1 - crop_x0) * scale_x))
    bottom = int(round((y1 - crop_y0) * scale_y))
    width = max(0, right - left)
    height = max(0, bottom - top)
    if width == 0 or height == 0:
        return

    source_pixels = source_image.load()
    dark = bytearray(width * height)
    for yy in range(height):
        for xx in range(width):
            r, g, b = source_pixels[left + xx, top + yy]
            if (r + g + b) // 3 < threshold:
                dark[yy * width + xx] = 1

    seen = bytearray(width * height)
    mask = Image.new("L", image.size, 0)
    directions = ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1))
    for idx, is_dark in enumerate(dark):
        if not is_dark or seen[idx]:
            continue
        stack = [idx]
        seen[idx] = 1
        component: list[int] = []
        while stack:
            current = stack.pop()
            component.append(current)
            cy = current // width
            cx = current % width
            for dx, dy in directions:
                nx = cx + dx
                ny = cy + dy
                if nx < 0 or ny < 0 or nx >= width or ny >= height:
                    continue
                next_idx = ny * width + nx
                if dark[next_idx] and not seen[next_idx]:
                    seen[next_idx] = 1
                    stack.append(next_idx)
        if len(component) < min_area:
            continue
        for current in component:
            cy = current // width
            cx = current % width
            mask.putpixel((left + cx, top + cy), 255)

    image.paste(source_image, (0, 0), mask)


def overlay_enemy_paladin_label(
    image: Image.Image,
    source_image: Image.Image,
    crop_rect: tuple[float, float, float, float],
) -> None:
    label_rect = (310, 650, 466, 735)
    draw_scaled_rect(image, crop_rect, label_rect, fill="white", outline="black")
    draw_label_text_only(
        image,
        crop_rect,
        (314, 666, 425, 724),
        "ФИЛОСТРАТ,\nКАПИТАН\nМЭЙФЛАЙ",
    )
    restore_large_dark_components(image, source_image, crop_rect, (390, 620, 555, 778))


def overlay_bonds_label(image: Image.Image, crop_rect: tuple[float, float, float, float]) -> None:
    draw_scaled_rect(image, crop_rect, (306, 746, 386, 755), fill="white")
    draw_scaled_rect(image, crop_rect, (386, 672, 564, 734), fill="white")
    draw_label_text_only(
        image,
        crop_rect,
        (392, 677, 558, 728),
        "ИВОН И АНСЕЙС,\nРЫЦАРИ-СОПЕРНИКИ",
    )


def overlay_combat_mainspring_label(image: Image.Image, crop_rect: tuple[float, float, float, float]) -> None:
    draw_scaled_rect(image, crop_rect, (356, 584, 500, 638), fill="white")
    draw_label_text_only(
        image,
        crop_rect,
        (358, 587, 492, 636),
        "МОРГИАНА КАСС,\nЧЕМПИОН\nАРЕНЫ",
    )


def draw_scaled_rect(
    image: Image.Image,
    crop_rect: tuple[float, float, float, float],
    rect: tuple[float, float, float, float],
    *,
    fill: str,
    outline: str | None = None,
) -> None:
    crop_x0, crop_y0, crop_x1, crop_y1 = crop_rect
    scale_x = image.width / (crop_x1 - crop_x0)
    scale_y = image.height / (crop_y1 - crop_y0)
    x0, y0, x1, y1 = rect
    box = (
        int(round((x0 - crop_x0) * scale_x)),
        int(round((y0 - crop_y0) * scale_y)),
        int(round((x1 - crop_x0) * scale_x)),
        int(round((y1 - crop_y0) * scale_y)),
    )

    draw = ImageDraw.Draw(image)
    border = max(3, int(round(1.8 * scale_x)))
    draw.rectangle(box, fill=fill, outline=outline, width=border)


def draw_wrapped_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    x: int,
    y: int,
    width: int,
    font: ImageFont.FreeTypeFont,
    *,
    fill: str = "black",
    line_gap: int = 4,
) -> int:
    words = text.split()
    line = ""
    for word in words:
        candidate = word if not line else f"{line} {word}"
        bbox = draw.textbbox((0, 0), candidate, font=font)
        if bbox[2] - bbox[0] <= width:
            line = candidate
            continue
        draw.text((x, y), line, fill=fill, font=font)
        y += bbox[3] - bbox[1] + line_gap
        line = word
    if line:
        bbox = draw.textbbox((0, 0), line, font=font)
        draw.text((x, y), line, fill=fill, font=font)
        y += bbox[3] - bbox[1] + line_gap
    return y


def draw_zone_grid(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    rows: int,
    cols: int,
    cell: int,
    red_cells: set[tuple[int, int]],
    blue_cells: set[tuple[int, int]],
) -> None:
    for row in range(rows):
        for col in range(cols):
            fill = "white"
            if (row, col) in red_cells:
                fill = "#d71920"
            if (row, col) in blue_cells:
                fill = "#2448d8"
            draw.rectangle(
                (x + col * cell, y + row * cell, x + (col + 1) * cell, y + (row + 1) * cell),
                fill=fill,
                outline="black",
                width=2,
            )


def draw_combat_zone_diagram_asset(path: Path) -> None:
    width, height = 960, 760
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    head_font = ImageFont.truetype(FONT_BALSAMIQ_BOLD_ITALIC, 46)
    sub_font = ImageFont.truetype(FONT_BALSAMIQ_BOLD_ITALIC, 28)
    body_font = ImageFont.truetype(str(LOCAL_FONT_DIR / "Rubik-Medium-static.ttf"), 22)

    draw.text((36, 28), "ЗОНЫ", fill="black", font=head_font)
    draw.line((36, 82, width - 36, 82), fill=WINE_HEX, width=7)
    y = draw_wrapped_text(
        draw,
        "Зона 2x2 вокруг выбранного пространства. Красные клетки - сама Зона; синяя клетка - выбранное пространство.",
        36,
        102,
        420,
        body_font,
        line_gap=6,
    )
    draw_zone_grid(draw, 86, y + 18, 5, 5, 52, {(1, 2), (1, 3), (2, 2), (2, 3)}, {(2, 2)})

    draw.text((520, 102), "ЛИНИИ", fill="black", font=sub_font)
    y2 = draw_wrapped_text(
        draw,
        "Линия идет по ортогонали или диагонали от пользователя. В отличие от обычной дальности, диагонали считаются за 1 пространство.",
        520,
        142,
        380,
        body_font,
        line_gap=6,
    )
    center = (4, 4)
    red_cells: set[tuple[int, int]] = set()
    for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]:
        for step in range(1, 4):
            red_cells.add((center[0] + dr * step, center[1] + dc * step))
    draw_zone_grid(draw, 520, y2 + 22, 9, 9, 38, red_cells, {center})

    draw.text((36, 500), "ДВИЖЕНИЕ ПО ПРЯМОЙ", fill="black", font=sub_font)
    draw.line((36, 536, 456, 536), fill=WINE_HEX, width=4)
    draw_wrapped_text(
        draw,
        "Когда персонаж движется по прямой, диагональные пространства также считаются за 1 пространство.",
        36,
        558,
        420,
        body_font,
        line_gap=7,
    )
    draw.rectangle((36, height - 78, 56, height - 58), fill="#2448d8", outline="black", width=2)
    draw.text((66, height - 81), "выбранное пространство / пользователь", fill="black", font=body_font)
    draw.rectangle((36, height - 44, 56, height - 24), fill="#d71920", outline="black", width=2)
    draw.text((66, height - 47), "пространства эффекта", fill="black", font=body_font)

    image.save(path, optimize=True)


def ensure_design_assets() -> None:
    LOCAL_FONT_DIR.mkdir(parents=True, exist_ok=True)
    if not CLOCK_EXAMPLES_IMG.exists():
        scale = 4
        width, height = 820, 210
        image = Image.new("RGB", (width * scale, height * scale), "white")
        draw = ImageDraw.Draw(image)
        centers = [(142, 106, 4), (410, 106, 6), (678, 106, 8)]
        radius = 70
        stroke = 5

        for cx, cy, segments in centers:
            cxs = cx * scale
            cys = cy * scale
            rs = radius * scale
            box = (cxs - rs, cys - rs, cxs + rs, cys + rs)
            draw.ellipse(box, outline="black", width=stroke * scale)
            for segment in range(segments):
                angle = math.radians(-90 + 360 * segment / segments)
                ex = cxs + math.cos(angle) * rs
                ey = cys + math.sin(angle) * rs
                draw.line((cxs, cys, ex, ey), fill="black", width=stroke * scale)

        image = image.resize((width, height), Image.Resampling.LANCZOS)
        image.save(CLOCK_EXAMPLES_IMG)

    draw_combat_zone_diagram_asset(inline_art_path("combat_zone_diagrams"))

    missing_art_ids = [
        art_id
        for art_id in INLINE_ART_CROPS
        if not inline_art_path(art_id).exists() or inline_art_path(art_id).stat().st_size == 0
    ]
    if "combat_zone_diagrams" in missing_art_ids:
        missing_art_ids.remove("combat_zone_diagrams")
    if not missing_art_ids:
        return
    if not ORIGINAL_PDF.exists():
        raise FileNotFoundError(f"Original PDF not found: {ORIGINAL_PDF}")

    source = fitz.open(ORIGINAL_PDF)
    try:
        for art_id in missing_art_ids:
            source_page, rect = INLINE_ART_CROPS[art_id]
            pix = source[source_page - 1].get_pixmap(
                matrix=fitz.Matrix(2.5, 2.5),
                clip=fitz.Rect(*rect),
                alpha=False,
            )
            image = Image.open(BytesIO(pix.tobytes("png"))).convert("RGB")
            source_image = image.copy()
            if art_id == "enemy_paladin":
                draw_scaled_rect(image, rect, expand_rect((310, 650, 466, 735), rect, 4), fill="white")
                overlay_enemy_paladin_label(image, source_image, rect)
            elif art_id == "bonds_yvon_anise":
                overlay_bonds_label(image, rect)
            elif art_id == "combat_mainspring":
                overlay_combat_mainspring_label(image, rect)
            elif art_id in INLINE_ART_CLEAR_RECTS:
                clean_base = INLINE_ART_LABELS.get(art_id, (INLINE_ART_CLEAR_RECTS[art_id], ""))[0]
                clear_rect = expand_rect(clean_base, rect, 4)
                draw_scaled_rect(image, rect, clear_rect, fill="white")
            if art_id in INLINE_ART_LABELS and art_id not in {"enemy_paladin", "bonds_yvon_anise", "combat_mainspring"}:
                label_rect, label_text = INLINE_ART_LABELS[art_id]
                overlay_translated_art_label(image, rect, label_rect, label_text)
            image.save(inline_art_path(art_id), optimize=True)
    finally:
        source.close()


def toc_key(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    text = text.replace("❂", "").replace("*", "")
    text = text.split("|", 1)[0]
    return re.sub(r"\s+", "", normalize_text(text).casefold())


def inline_md(text: str) -> str:
    text = replace_page_references(text)
    star = "\ue000"
    influence = "\ue001"
    text = re.sub(r"\*\*\\\*", "**", text)
    text = re.sub(r"(\*\*\d+)\\?\*", rf"\1{star}", text)
    text = text.replace(r"\*", star)
    text = html.escape(normalize_text(text))
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"_([^_]+)_", r"<em>\1</em>", text)
    text = text.replace(star, "*")
    text = re.sub(
        r"([^\s<>]+)\s+\(❂\)",
        rf'<span class="influence-group">\1 (<span class="influence-icon">{influence}</span>)</span>',
        text,
    )
    text = text.replace(
        "(❂)",
        f"<span class=\"influence-group\">(<span class=\"influence-icon\">{influence}</span>)</span>",
    )
    text = text.replace("❂", f"<span class=\"influence-icon\">{influence}</span>")
    text = text.replace(influence, "❂")
    return text


def is_table_start(lines: list[str], i: int) -> bool:
    return i + 1 < len(lines) and lines[i].lstrip().startswith("|") and lines[i + 1].lstrip().startswith("|")


def table_to_html(rows: list[str]) -> str:
    parsed: list[list[str]] = []
    for row in rows:
        cells = [normalize_text(c.strip()) for c in row.strip().strip("|").split("|")]
        if cells and all(re.fullmatch(r":?-{3,}:?", c) for c in cells):
            continue
        parsed.append(cells)
    if not parsed:
        return ""
    head = parsed[0]
    body = parsed[1:]
    out = ["<table><thead><tr>"]
    out.extend(f"<th>{inline_md(c)}</th>" for c in head)
    out.append("</tr></thead><tbody>")
    for row in body:
        out.append("<tr>")
        out.extend(f"<td>{inline_md(c)}</td>" for c in row)
        out.append("</tr>")
    out.append("</tbody></table>")
    return "".join(out)


def strip_working_sections(lines: list[str]) -> list[str]:
    cleaned: list[str] = []
    skip_rest = False
    for line in lines:
        if line.startswith("# DAWN - перевод"):
            continue
        if line.startswith("## Печатные стр."):
            continue
        if line.startswith("## Заметки переводчика"):
            skip_rest = True
            continue
        if skip_rest:
            continue
        cleaned.append(line.rstrip())
    return cleaned


def parse_markdown(path: Path, max_blocks: int | None = None, stop_h1: str | None = None) -> list[Block]:
    lines = strip_working_sections(path.read_text(encoding="utf-8").splitlines())
    blocks: list[Block] = []
    section = "DAWN"
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        if not line:
            i += 1
            continue

        if line.startswith("# "):
            title = line[2:].strip()
            if stop_h1 and title == stop_h1:
                break
            section = title
            blocks.append(Block(f"<h1>{inline_md(title)}</h1>", "h1", section))
            i += 1
        elif line.startswith("## "):
            title = line[3:].strip()
            section = title
            blocks.append(Block(f"<h2>{inline_md(title)}</h2>", "h2", section))
            i += 1
        elif line.startswith("### "):
            title = line[4:].strip()
            cls = "tech-title" if "|" in title else ""
            blocks.append(Block(f"<h3 class='{cls}'>{inline_md(title)}</h3>", "h3", section))
            i += 1
        elif line.startswith("#### "):
            title = line[5:].strip()
            blocks.append(Block(f"<h4>{inline_md(title)}</h4>", "h4", section))
            i += 1
        elif is_table_start(lines, i):
            table_rows = []
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                table_rows.append(lines[i])
                i += 1
            html_table = table_to_html(table_rows)
            if html_table:
                blocks.append(Block(html_table, "table", section))
        elif line.startswith(">"):
            quote_lines: list[str] = []
            while i < len(lines):
                raw = lines[i].rstrip()
                if raw.startswith(">"):
                    quote_lines.append(raw[1:].strip())
                    i += 1
                    continue
                if not raw.strip() and i + 1 < len(lines) and lines[i + 1].startswith(">"):
                    quote_lines.append("")
                    i += 1
                    continue
                break
            paragraphs: list[str] = []
            current: list[str] = []
            for raw in quote_lines:
                if raw:
                    current.append(raw)
                elif current:
                    paragraphs.append(" ".join(current))
                    current = []
            if current:
                paragraphs.append(" ".join(current))
            quote_html = "".join(f"<p>{inline_md(text)}</p>" for text in paragraphs)
            blocks.append(Block(f"<blockquote>{quote_html}</blockquote>", "blockquote", section))
        elif line.startswith("- "):
            items = []
            while i < len(lines) and lines[i].startswith("- "):
                items.append(f"<li>{inline_md(lines[i][2:].strip())}</li>")
                i += 1
            blocks.append(Block("<ul>" + "".join(items) + "</ul>", "ul", section))
        else:
            para = [line]
            i += 1
            while i < len(lines):
                nxt = lines[i].rstrip()
                if not nxt or nxt.startswith("#") or nxt.startswith("- ") or nxt.lstrip().startswith("|"):
                    break
                para.append(nxt)
                i += 1
            text = normalize_text(" ".join(p.strip() for p in para))
            cls = "flavor" if text.startswith("_") and text.endswith("_") else ""
            if cls:
                text = text[1:-1]
            elif text.startswith("**[") or text.startswith("**Пассив:**") or text.startswith("**Параметры:**"):
                cls = "ruleline"
            elif text.startswith("**Награда:**"):
                cls = "reward"
            elif text.startswith("_Напр.:") or text.startswith("Напр.:"):
                cls = "example"
            tag = "p"
            class_attr = f" class='{cls}'" if cls else ""
            blocks.append(Block(f"<{tag}{class_attr}>{inline_md(text)}</{tag}>", "p", section))

        if max_blocks and len(blocks) >= max_blocks:
            break
    return blocks


def parse_front_matter() -> dict[str, list[str] | list[tuple[int, str, str]]]:
    lines = strip_working_sections((TRANSLATION / BOOK_FILES[0]).read_text(encoding="utf-8").splitlines())
    sections: dict[str, list[str] | list[tuple[int, str, str]]] = {
        "cover": [],
        "service": [],
        "toc": [],
    }
    current = ""
    for line in lines:
        if line.startswith("# "):
            title = line[2:].strip()
            current = {
                "Обложка": "cover",
                "Служебная страница": "service",
                "Оглавление": "toc",
            }.get(title, "")
            continue
        if current:
            sections[current].append(line.rstrip())  # type: ignore[union-attr]

    toc_entries: list[tuple[int, str, str]] = []
    for raw in sections["toc"]:  # type: ignore[assignment]
        line = str(raw).strip()
        if not line:
            continue
        level = 0 if line.startswith("## ") else 1 if line.startswith("- ") else -1
        if level < 0:
            continue
        text = line[3:].strip() if level == 0 else line[2:].strip()
        page = ""
        match = re.match(r"(.+?)\s+-\s+(\d+)$", text)
        if match:
            text, page = match.group(1), match.group(2)
        toc_entries.append((level, text, page))
    sections["toc"] = toc_entries
    return sections


def extract_archetype_intro(path: Path) -> tuple[str, str]:
    lines = strip_working_sections(path.read_text(encoding="utf-8").splitlines())
    title = "DAWN"
    for idx, line in enumerate(lines):
        if not line.startswith("# "):
            continue
        title = line[2:].strip()
        para: list[str] = []
        for nxt in lines[idx + 1 :]:
            if not nxt.strip():
                if para:
                    break
                continue
            if nxt.startswith("#"):
                break
            para.append(nxt.strip())
        return title, normalize_text(" ".join(para))
    return title, ""


def drop_leading_title_intro(blocks: list[Block]) -> list[Block]:
    if not blocks or blocks[0].kind != "h1":
        return blocks
    start = 1
    if len(blocks) > 1 and blocks[1].kind == "p":
        start = 2
    return blocks[start:]


def drop_opener_title_caption(blocks: list[Block]) -> list[Block]:
    if not blocks or blocks[0].kind != "h1":
        return blocks
    start = 1
    if len(blocks) > start and blocks[start].kind == "p":
        start += 1
    return blocks[start:]


def demote_leading_h1_to_h2(blocks: list[Block]) -> list[Block]:
    if not blocks or blocks[0].kind != "h1":
        return blocks
    title = plain_block_text(blocks[0])
    return [Block(f"<h2>{inline_md(title)}</h2>", "h2", title), *blocks[1:]]


def drop_first_flavor_after_heading(blocks: list[Block]) -> list[Block]:
    cleaned = list(blocks)
    for idx, block in enumerate(cleaned[:3]):
        if block.kind in {"h1", "h2"} and idx + 1 < len(cleaned) and "class='flavor'" in cleaned[idx + 1].html:
            del cleaned[idx + 1]
            break
    return cleaned


def intro_design_pilot_blocks() -> list[Block]:
    blocks = drop_first_flavor_after_heading(parse_markdown(TRANSLATION / "pages-005-008-introduction.md"))
    stop_marker = f"<h2>{inline_md('Нулевое правило: согласие')}</h2>"
    for idx, block in enumerate(blocks):
        if block.kind == "h2" and block.html == stop_marker:
            return blocks[:idx]
    return blocks


def intro_design_special_blocks() -> list[Block]:
    blocks = parse_markdown(TRANSLATION / "pages-005-008-introduction.md")
    start_marker = f"<h3 class=''>{inline_md('X-карта')}</h3>"
    for idx, block in enumerate(blocks):
        if block.kind == "h2" and block.html == start_marker:
            return blocks[idx:]
        if block.kind == "h3" and block.html == start_marker:
            return blocks[idx:]
    return blocks


def split_blocks_at_h2(blocks: list[Block], title: str) -> tuple[list[Block], list[Block]]:
    marker = f"<h2>{inline_md(title)}</h2>"
    for idx, block in enumerate(blocks):
        if block.kind == "h2" and block.html == marker:
            return blocks[:idx], blocks[idx:]
    return blocks, []


def split_out_ability_glossary(blocks: list[Block]) -> tuple[list[Block], list[Block]]:
    start = next(
        (idx for idx, block in enumerate(blocks) if block.kind == "h2" and toc_key(plain_block_text(block)) == toc_key("Глоссарий Способностей")),
        None,
    )
    if start is None:
        return blocks, []
    end = next(
        (idx for idx in range(start + 1, len(blocks)) if blocks[idx].kind == "h2" and toc_key(plain_block_text(blocks[idx])) == toc_key("Связи")),
        len(blocks),
    )
    return blocks[:start], blocks[end:]


def blocks_from_h2(blocks: list[Block], title: str) -> list[Block]:
    key = toc_key(title)
    for idx, block in enumerate(blocks):
        if block.kind == "h2" and toc_key(plain_block_text(block)) == key:
            return blocks[idx:]
    return []


def opener_meta(key: str) -> dict[str, object]:
    return MAJOR_OPENERS[key]


def credit_sections() -> list[tuple[str, list[str]]]:
    lines = strip_working_sections((TRANSLATION / BOOK_FILES[-1]).read_text(encoding="utf-8").splitlines())
    try:
        start = lines.index("# Титры") + 1
    except ValueError:
        return []

    sections: list[tuple[str, list[str]]] = []
    current_title = ""
    current_items: list[str] = []
    for raw in lines[start:]:
        line = raw.strip()
        if not line:
            continue
        match = re.match(r"\*\*(.+?):\*\*", line)
        if match:
            if current_title:
                sections.append((current_title, current_items))
            current_title = match.group(1)
            current_items = []
            continue
        if current_title:
            current_items.append(line.strip('"'))
    if current_title:
        sections.append((current_title, current_items))
    return sections


def column_rect(col: int, y: float) -> fitz.Rect:
    x0 = LEFT_RAIL + INNER_MARGIN + col * (COL_W + GUTTER)
    return fitz.Rect(x0, y, x0 + COL_W, TOP + COL_H)


def column_rect_design(col: int) -> fitz.Rect:
    x0 = DESIGN_RAIL_INNER_X + DESIGN_INNER_MARGIN + col * (DESIGN_COL_W + DESIGN_GUTTER)
    return fitz.Rect(x0, DESIGN_TOP, x0 + DESIGN_COL_W, DESIGN_TOP + DESIGN_COL_H)


def html_document(blocks: list[Block]) -> str:
    body = []
    seen_enemy_sections: set[str] = set()
    i = 0
    while i < len(blocks):
        block = blocks[i]
        if is_joel_note(block):
            note_html, i = joel_note_group_html(blocks, i, block_html)
            body.append(note_html)
            continue
        if block.kind == "h3" and "tech-title" in block.html:
            card_classes = ["card"]
            card_title = plain_block_text(block)
            if any(toc_key(card_title).startswith(toc_key(title)) for title in FORCED_CARD_COLUMN_BREAKS):
                card_classes.append("force-card-break")
            if toc_key(block.section) == toc_key("Примеры Развертываний"):
                card_classes.append("deployment-card")
            if is_enemy_card(block):
                card_classes.append("enemy-card")
                section_key = toc_key(block.section)
                if section_key in seen_enemy_sections:
                    card_classes.append("enemy-card-break")
                seen_enemy_sections.add(section_key)
            card_parts = [block_html(block)]
            i += 1
            while i < len(blocks) and blocks[i].kind not in {"h1", "h2", "h3"}:
                card_parts.append(block_html(blocks[i]))
                i += 1
            card_class_attr = " ".join(card_classes)
            if uses_table_card(block):
                body.append(
                    f"<table class='{card_class_attr}'><tr><td class='card-cell'>"
                    + "\n".join(card_parts)
                    + "</td></tr></table>"
                )
            else:
                body.append(f"<div class='{card_class_attr}'>" + "\n".join(card_parts) + "</div>")
            continue
        body.append(block_html(block))
        i += 1
    return "<html><body>" + "\n".join(body) + "</body></html>"


def plain_block_text(block: Block) -> str:
    text = re.sub(r"<[^>]+>", "", block.html)
    return html.unescape(normalize_text(text))


def add_clock_examples(blocks: list[Block]) -> list[Block]:
    result: list[Block] = []
    in_clocks = False
    clock_paragraphs = 0
    inserted = False

    for block in blocks:
        if in_clocks and block.kind in {"h1", "h2", "h3"}:
            in_clocks = False

        result.append(block)

        if block.kind == "h2" and toc_key(plain_block_text(block)) == toc_key("Часы"):
            in_clocks = True
            clock_paragraphs = 0
            continue

        if not in_clocks or inserted:
            continue

        if block.kind == "p":
            clock_paragraphs += 1
            if clock_paragraphs == 2:
                result.append(
                    Block(
                        f"<div class='clock-examples'><img src='{CLOCK_EXAMPLES_IMG.name}' /></div>",
                        "html",
                        "Часы",
                    )
                )
                inserted = True

    return result


def add_inline_arts(blocks: list[Block], file_name: str) -> list[Block]:
    inserts = INLINE_ART_INSERTS.get(file_name)
    if not inserts:
        return blocks

    result = list(blocks)
    for insert in inserts:
        heading = str(insert["heading"])
        heading_kind = str(insert.get("kind", "h2"))
        art_id = str(insert["art"])
        class_name = str(insert.get("class", "portrait"))
        after_paragraphs = int(insert.get("after", 0))
        target_key = toc_key(heading)

        for idx, block in enumerate(result):
            if block.kind != heading_kind:
                continue
            if toc_key(plain_block_text(block)) != target_key:
                continue

            insert_at = idx + 1
            if after_paragraphs:
                paragraphs = 0
                cursor = idx + 1
                while cursor < len(result) and result[cursor].kind not in {"h1", "h2", "h3"}:
                    if result[cursor].kind == "p":
                        paragraphs += 1
                    cursor += 1
                    if paragraphs >= after_paragraphs:
                        insert_at = cursor
                        break
                else:
                    insert_at = cursor

            section = plain_block_text(block)
            result.insert(
                insert_at,
                Block(
                    f"<div class='inline-art {class_name}'><img src='{inline_art_path(art_id).name}' /></div>",
                    "html",
                    section,
                ),
            )
            break

    return result


def block_html_design(block: Block) -> str:
    if block.kind == "h1":
        return f"<div><h1>{inline_md(plain_block_text(block).upper())}</h1></div>"
    return f"<div>{block.html}</div>"


def is_joel_note(block: Block) -> bool:
    return block.kind == "h3" and plain_block_text(block).startswith("Заметки Джоэла:")


def uses_table_card(block: Block) -> bool:
    return False


def is_enemy_card(block: Block) -> bool:
    enemy_sections = {
        "Враги-дамагеры",
        "Враги-Танки",
        "Враги Поддержки",
        "Враги-Движки",
        "Враги-Модификаторы",
    }
    return toc_key(block.section) in {toc_key(section) for section in enemy_sections}


def joel_note_group_html(blocks: list[Block], start: int, renderer) -> tuple[str, int]:
    parts = [renderer(blocks[start])]
    i = start + 1
    while i < len(blocks) and blocks[i].kind not in {"h1", "h2", "h3"}:
        parts.append(renderer(blocks[i]))
        i += 1
    return "<table class='joel-note'><tr><td>" + "\n".join(parts) + "</td></tr></table>", i


def html_document_design_intro(blocks: list[Block]) -> str:
    body: list[str] = []
    i = 0
    while i < len(blocks):
        block = blocks[i]
        text = plain_block_text(block)

        if block.kind == "h2" and toc_key(text) == toc_key("Введение"):
            i += 1
            intro_parts: list[str] = []
            while i < len(blocks) and blocks[i].kind == "p":
                intro_parts.append(block_html_design(blocks[i]))
                i += 1
            if intro_parts:
                body.append("<div class='intro-callout'>" + "\n".join(intro_parts) + "</div>")
            continue

        if is_joel_note(block):
            note_html, i = joel_note_group_html(blocks, i, block_html_design)
            body.append(note_html)
            continue

        if block.kind == "h4" and text.startswith("Чтобы использовать X-карту"):
            quote_parts = [block_html_design(block)]
            i += 1
            while i < len(blocks) and blocks[i].kind == "blockquote":
                quote_parts.append(block_html_design(blocks[i]))
                i += 1
            body.append("<div class='quote-card'>" + "\n".join(quote_parts) + "</div>")
            continue

        body.append(block_html_design(block))
        i += 1
    return "<html><body>" + "\n".join(body) + "</body></html>"


def draw_page_chrome(page: fitz.Page, page_no: int, section: str) -> None:
    page.draw_rect(fitz.Rect(0, 0, LEFT_RAIL, PAGE_H), color=BLACK, fill=BLACK)
    page.draw_rect(fitz.Rect(PAGE_W - RIGHT_RAIL, 0, PAGE_W, PAGE_H), color=BLACK, fill=BLACK)

    rail_css = """
    @font-face { font-family: DawnRail; src: url(arialbi.ttf); }
    body {font-family: DawnRail, sans-serif; font-size: 7pt; font-weight: 900; color: white;}
    """
    base_label = re.sub(r"\s+", " ", section or "DAWN").strip().upper()
    label = html.escape(("  " + base_label) * 18)
    page.insert_htmlbox(fitz.Rect(2, 24, LEFT_RAIL - 2, PAGE_H - 24), label, css=rail_css, rotate=90, archive="C:/Windows/Fonts")
    page.insert_htmlbox(fitz.Rect(PAGE_W - RIGHT_RAIL + 2, 24, PAGE_W - 2, PAGE_H - 24), label, css=rail_css, rotate=270, archive="C:/Windows/Fonts")

    y = PAGE_H - 37
    page.insert_htmlbox(
        fitz.Rect(PAGE_W / 2 - 18, y - 10, PAGE_W / 2 + 18, y + 3),
        f"<p>{page_no}</p>",
        css="@font-face { font-family: DawnPage; src: url(arialbi.ttf); } body {font-family: DawnPage, sans-serif; font-size: 8pt; font-weight: 900; text-align: center;}",
        archive="C:/Windows/Fonts",
    )
    draw_dawn_mark(page, PAGE_W / 2, y + 9)


RAIL_STRIP_CACHE: dict[tuple[str, str], bytes] = {}


def rail_strip_image(label: str, side: str) -> bytes:
    key = (label, side)
    if key in RAIL_STRIP_CACHE:
        return RAIL_STRIP_CACHE[key]

    scale = 5
    strip_w = int(round(DESIGN_RAIL * scale))
    strip_h = int(round(PAGE_H * scale))
    image = Image.new("RGB", (strip_w, strip_h), "black")

    font_size = int(strip_w * 1.34)
    font = ImageFont.truetype(FONT_RUBIK_MONO, font_size)
    probe = Image.new("L", (1, 1))
    probe_draw = ImageDraw.Draw(probe)
    bbox = probe_draw.textbbox((0, 0), label, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    pad = int(strip_w * 0.32)
    raw_w = text_w + pad * 2
    raw_h = text_h + pad * 2

    raw = Image.new("RGBA", (raw_w, raw_h), (0, 0, 0, 0))
    raw_draw = ImageDraw.Draw(raw)
    raw_draw.text((pad - bbox[0], pad - bbox[1]), label, fill=(255, 255, 255, 255), font=font)

    shear = -0.30
    sheared_w = int(raw_w + raw_h * abs(shear))
    sheared = raw.transform(
        (sheared_w, raw_h),
        Image.Transform.AFFINE,
        (1, -shear, 0, 0, 1, 0),
        resample=Image.Resampling.BICUBIC,
    )
    content = sheared.getbbox()
    if content:
        sheared = sheared.crop(content)

    rotation = 90 if side == "left" else 270
    word = sheared.rotate(rotation, expand=True, resample=Image.Resampling.BICUBIC)
    target_w = int(strip_w * 0.90)
    if word.width != target_w:
        ratio = target_w / word.width
        word = word.resize((target_w, max(1, int(word.height * ratio))), Image.Resampling.LANCZOS)

    gap = int(strip_w * 0.65)
    optical_shift = max(1, int(strip_w * 0.04))
    x = (strip_w - word.width) // 2 + (optical_shift if side == "left" else -optical_shift)
    x = max(0, min(x, strip_w - word.width))
    step = word.height + gap
    repeat_count = max(1, int((strip_h + gap) // step) + 2)
    total_h = repeat_count * word.height + (repeat_count - 1) * gap
    y = (strip_h - total_h) // 2
    for _ in range(repeat_count):
        image.paste(word, (x, y), word)
        y += word.height + gap

    out = BytesIO()
    image.save(out, format="PNG", optimize=True)
    data = out.getvalue()
    RAIL_STRIP_CACHE[key] = data
    return data


def draw_page_chrome_design(page: fitz.Page, page_no: int, section: str) -> None:
    base_label = re.sub(r"\s+", " ", section or "DAWN").strip().upper()
    page.draw_rect(fitz.Rect(0, 0, DESIGN_RAIL_INNER_X, PAGE_H), color=WHITE, fill=WHITE)
    page.draw_rect(
        fitz.Rect(PAGE_W - DESIGN_RAIL_INNER_X, 0, PAGE_W, PAGE_H),
        color=WHITE,
        fill=WHITE,
    )
    page.insert_image(
        fitz.Rect(DESIGN_RAIL_OUTER, 0, DESIGN_RAIL_OUTER + DESIGN_RAIL, PAGE_H),
        stream=rail_strip_image(base_label, "left"),
    )
    page.insert_image(
        fitz.Rect(PAGE_W - DESIGN_RAIL_OUTER - DESIGN_RAIL, 0, PAGE_W - DESIGN_RAIL_OUTER, PAGE_H),
        stream=rail_strip_image(base_label, "right"),
    )

    y = PAGE_H - 36
    page.insert_htmlbox(
        fitz.Rect(PAGE_W / 2 - 20, y - 12, PAGE_W / 2 + 20, y + 4),
        f"<p>{page_no}</p>",
        css="""
        @font-face { font-family: DawnPage; src: url(BalsamiqSans-Bold.ttf); }
        body {font-family: DawnPage, sans-serif; font-size: 10pt; font-weight: 900; text-align: center;}
        """,
        archive=str(LOCAL_FONT_DIR),
    )
    draw_dawn_mark(page, PAGE_W / 2, y + 10)


def draw_dawn_mark(page: fitz.Page, cx: float, cy: float) -> None:
    r = 7
    page.draw_line(fitz.Point(cx - 13, cy), fitz.Point(cx + 13, cy), color=BLACK, width=0.7)
    page.draw_circle(fitz.Point(cx, cy), r, color=BLACK, fill=BLACK)
    page.draw_rect(fitz.Rect(cx - r - 1, cy - r - 1, cx + r + 10, cy), color=(1, 1, 1), fill=(1, 1, 1))
    page.draw_line(fitz.Point(cx - 13, cy), fitz.Point(cx + 13, cy), color=BLACK, width=0.7)
    for dx, length in [(0, 12), (-7, 28), (7, 28), (-12, 24), (12, 24)]:
        page.draw_line(fitz.Point(cx + dx * 0.55, cy + r + 1), fitz.Point(cx + dx, cy + r + 5), color=BLACK, width=0.55)


def display_css(size: float, align: str = "left", family: str = "DawnBody", weight: int = 400, style: str = "normal") -> str:
    return f"""
    @font-face {{ font-family: DawnBody; src: url(arial.ttf); }}
    @font-face {{ font-family: DawnBody; font-weight: 700; src: url(arialbd.ttf); }}
    @font-face {{ font-family: DawnBody; font-style: italic; src: url(ariali.ttf); }}
    @font-face {{ font-family: DawnHead; src: url(impact.ttf); }}
    body {{
      font-family: {family}, sans-serif;
      font-size: {size}pt;
      font-weight: {weight};
      font-style: {style};
      line-height: 1.08;
      color: #050505;
      text-align: {align};
    }}
    p {{ margin: 0; }}
    strong {{ color: #6f1d2b; font-weight: 400; }}
    em {{ font-style: italic; }}
    .influence-icon {{
      color: #6f1d2b;
      font-style: normal;
      font-weight: 900;
    }}
    .influence-group {{
      white-space: nowrap;
      font-style: normal;
    }}
    """


def draw_html_text(
    page: fitz.Page,
    rect: fitz.Rect,
    text: str,
    *,
    size: float,
    align: str = "left",
    family: str = "DawnBody",
    weight: int = 400,
    style: str = "normal",
    rotate: int = 0,
) -> None:
    body = "<p>" + inline_md(text).replace("\n", "<br>") + "</p>"
    page.insert_htmlbox(
        rect,
        body,
        css=display_css(size, align=align, family=family, weight=weight, style=style),
        archive="C:/Windows/Fonts",
        rotate=rotate,
    )


def display_css_design(
    size: float,
    align: str = "left",
    family: str = "DawnBody",
    weight: int = 400,
    style: str = "normal",
) -> str:
    return f"""
    @font-face {{ font-family: DawnBody; src: url(Rubik-wght.ttf); }}
    @font-face {{ font-family: DawnBody; font-style: italic; src: url(Rubik-Italic-wght.ttf); }}
    @font-face {{ font-family: DawnDisplay; src: url(RussoOne-Regular.ttf); }}
    @font-face {{ font-family: DawnComic; src: url(BalsamiqSans-BoldItalic.ttf); }}
    body {{
      font-family: {family}, sans-serif;
      font-size: {size}pt;
      font-weight: {weight};
      font-style: {style};
      line-height: 1.04;
      color: #050505;
      text-align: {align};
    }}
    p {{ margin: 0; }}
    strong {{ color: #6f1d2b; font-weight: 400; }}
    em {{ font-style: italic; }}
    .influence-icon {{
      color: #6f1d2b;
      font-style: normal;
      font-weight: 900;
    }}
    .influence-group {{
      white-space: nowrap;
      font-style: normal;
    }}
    """


def draw_html_text_design(
    page: fitz.Page,
    rect: fitz.Rect,
    text: str,
    *,
    size: float,
    align: str = "left",
    family: str = "DawnBody",
    weight: int = 400,
    style: str = "normal",
    rotate: int = 0,
) -> None:
    body = "<p>" + inline_md(text).replace("\n", "<br>") + "</p>"
    page.insert_htmlbox(
        rect,
        body,
        css=display_css_design(size, align=align, family=family, weight=weight, style=style),
        archive=str(LOCAL_FONT_DIR),
        rotate=rotate,
    )


def draw_white_rect(page: fitz.Page, rect: fitz.Rect, border: float = 1.4) -> None:
    page.draw_rect(rect, color=BLACK, fill=WHITE, width=border)


def draw_dotted_leader(page: fitz.Page, x0: float, x1: float, y: float) -> None:
    if x1 <= x0:
        return
    page.draw_line(fitz.Point(x0, y), fitz.Point(x1, y), color=BLACK, dashes="[1 3] 0", width=0.8)


def draw_red_rule(page: fitz.Page, y: float, x0: float = 48, x1: float = PAGE_W - 48, width: float = 2.4) -> None:
    page.draw_line(fitz.Point(x0, y), fitz.Point(x1, y), color=RED, width=width)


def fill_original_page(page: fitz.Page, source: fitz.Document, page_number: int) -> None:
    pix = source[page_number - 1].get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    page.insert_image(page.rect, pixmap=pix)


def draw_native_text(
    page: fitz.Page,
    rect: fitz.Rect,
    text: str,
    *,
    size: float,
    fontfile: str | None = FONT_ARIAL,
    fontname: str = "DawnNative",
    align: int = fitz.TEXT_ALIGN_LEFT,
    color: tuple[float, float, float] = BLACK,
) -> None:
    kwargs = {"fontname": fontname, "fontsize": size, "color": color, "align": align}
    if fontfile:
        kwargs["fontfile"] = fontfile
    page.insert_textbox(
        rect,
        text,
        **kwargs,
    )


def ensure_native_page_fonts(page: fitz.Page) -> None:
    page.insert_font(fontname="DawnArial", fontfile=FONT_ARIAL)
    page.insert_font(fontname="DawnArialBold", fontfile=FONT_ARIAL_BOLD)
    page.insert_font(fontname="DawnImpact", fontfile=FONT_IMPACT)
    if Path(FONT_SEGOE_SYMBOL).exists():
        page.insert_font(fontname="DawnSymbol", fontfile=FONT_SEGOE_SYMBOL)


def add_page(doc: fitz.Document, page_no: int, section: str) -> fitz.Page:
    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    draw_page_chrome(page, page_no, section)
    return page


def draw_cover_page(source: fitz.Document) -> fitz.Document:
    doc = fitz.open()
    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    fill_original_page(page, source, 1)

    draw_white_rect(page, fitz.Rect(78, 660, 520, 744), border=1.8)
    draw_html_text(
        page,
        fitz.Rect(94, 678, 504, 730),
        "Настольная игра в жанре боевой манги\nот Joel Vreugdenhil",
        size=18,
        align="center",
        family="DawnHead",
    )

    draw_white_rect(page, fitz.Rect(536, 34, PAGE_W, 226), border=1.1)
    cover_bits = [
        ("2-5", "игроков"),
        ("ТАКТИКА", ""),
        ("ПУЛ", "костей"),
    ]
    y = 48
    for top, bottom in cover_bits:
        draw_html_text(page, fitz.Rect(542, y, PAGE_W - 6, y + 38), top, size=9.5, align="center", family="DawnHead")
        if bottom:
            draw_html_text(page, fitz.Rect(542, y + 24, PAGE_W - 6, y + 50), bottom, size=6.8, align="center", weight=700)
        y += 58

    draw_white_rect(page, fitz.Rect(536, 676, PAGE_W, 760), border=1.1)
    draw_html_text(page, fitz.Rect(544, 698, PAGE_W - 8, 736), f"RU\n{VERSION}", size=8.8, align="center", weight=700)
    return doc


def draw_service_page() -> fitz.Document:
    doc = fitz.open()
    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    draw_html_text(page, fitz.Rect(72, 78, PAGE_W - 72, 135), "DAWN", size=48, align="center", family="DawnHead")
    draw_red_rule(page, 146)
    draw_html_text(page, fitz.Rect(80, 180, PAGE_W - 80, 220), "Служебная страница", size=18, align="center", family="DawnHead")

    service_lines = [line for line in parse_front_matter()["service"] if str(line).strip()]  # type: ignore[index]
    body = "\n\n".join(str(line) for line in service_lines)
    draw_html_text(page, fitz.Rect(82, 250, PAGE_W - 82, 420), body, size=10.8, align="center")

    page.draw_line(fitz.Point(95, 484), fitz.Point(PAGE_W - 95, 484), color=BLACK, width=1.2)
    draw_html_text(
        page,
        fitz.Rect(92, 505, PAGE_W - 92, 585),
        (
            "Русская локализация: неофициальный перевод DAWN RU.\n"
            f"Версия {VERSION} · 11 июля 2026 года.\n"
            "Перевод, редактура и русская верстка: проект DAWN RU.\n"
            "Изменения внесены в соответствии с условиями CC BY 4.0."
        ),
        size=10,
        align="center",
        style="italic",
    )
    return doc


def draw_toc_pages(page_overrides: dict[str, str] | list[str] | None = None) -> fitz.Document:
    entries = parse_front_matter()["toc"]  # type: ignore[assignment]
    page_overrides = page_overrides or {}
    regular_font = fitz.Font(fontfile=FONT_ARIAL)
    bold_font = fitz.Font(fontfile=FONT_ARIAL_BOLD)
    symbol_fontfile = FONT_SEGOE_SYMBOL if Path(FONT_SEGOE_SYMBOL).exists() else FONT_ARIAL
    symbol_font = fitz.Font(fontfile=symbol_fontfile)
    doc = fitz.open()
    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    ensure_native_page_fonts(page)
    draw_native_text(
        page,
        fitz.Rect(70, 58, PAGE_W - 70, 111),
        "ОГЛАВЛЕНИЕ",
        size=35,
        fontfile=None,
        fontname="DawnImpact",
        align=fitz.TEXT_ALIGN_CENTER,
    )
    draw_red_rule(page, 116, 45, PAGE_W - 45, 2.8)

    x_title = 48
    x_page = PAGE_W - 70
    y = 143
    line_h = 11.8
    max_y = PAGE_H - 74

    for entry_idx, (level, title, page_no) in enumerate(entries):
        if isinstance(page_overrides, list):
            if entry_idx < len(page_overrides) and page_overrides[entry_idx]:
                page_no = page_overrides[entry_idx]
        else:
            page_no = page_overrides.get(toc_key(title), page_no)
        if y > max_y:
            page = doc.new_page(width=PAGE_W, height=PAGE_H)
            ensure_native_page_fonts(page)
            draw_native_text(
                page,
                fitz.Rect(70, 52, PAGE_W - 70, 91),
                "ОГЛАВЛЕНИЕ",
                size=22,
                fontfile=None,
                fontname="DawnImpact",
                align=fitz.TEXT_ALIGN_CENTER,
            )
            draw_red_rule(page, 96, 52, PAGE_W - 52, 2.2)
            y = 122

        indent = 0 if level == 0 else 18
        size = 8.9 if level == 0 else 8.4
        fontfile = None
        fontname = "DawnArialBold" if level == 0 else "DawnArial"
        has_influence = "❂" in title
        safe_title = normalize_text(title.replace("❂", ""))
        draw_native_text(page, fitz.Rect(x_title + indent, y - 1, x_page - 4, y + line_h), safe_title, size=size, fontfile=fontfile, fontname=fontname)
        if page_no:
            font = bold_font if level == 0 else regular_font
            text_width = font.text_length(safe_title, fontsize=size)
            if has_influence:
                icon_size = size + 0.4
                icon_width = symbol_font.text_length("❂", fontsize=icon_size)
                icon_x = min(x_page - 30, x_title + indent + text_width + 4)
                symbol_fontname = "DawnSymbol" if Path(FONT_SEGOE_SYMBOL).exists() else fontname
                draw_native_text(
                    page,
                    fitz.Rect(icon_x, y - 1.5, icon_x + icon_width + 4, y + line_h + 1),
                    "❂",
                    size=icon_size,
                    fontfile=None,
                    fontname=symbol_fontname,
                    color=RED,
                )
                text_width += 4 + icon_width
            rough_end = min(x_page - 24, x_title + indent + text_width + 7)
            draw_dotted_leader(page, rough_end, x_page - 8, y + 7.6)
            draw_native_text(
                page,
                fitz.Rect(x_page - 3, y - 1, x_page + 26, y + line_h),
                page_no,
                size=size,
                fontfile=fontfile,
                fontname=fontname,
                align=fitz.TEXT_ALIGN_RIGHT,
            )
        y += line_h
    return doc


def draw_design_html_box(
    page: fitz.Page,
    rect: fitz.Rect,
    text: str,
    *,
    size: float,
    align: str = "left",
    family: str = "DawnBody",
    color: str = "#050505",
    line_height: float = 1.08,
) -> None:
    page.insert_htmlbox(
        rect,
        "<p>" + inline_md(text).replace("\n", "<br>") + "</p>",
        css=f"""
        @font-face {{ font-family: DawnBody; src: url(Rubik-wght.ttf); }}
        @font-face {{ font-family: DawnComic; src: url(BalsamiqSans-BoldItalic.ttf); }}
        @font-face {{ font-family: DawnDisplay; src: url(RussoOne-Regular.ttf); }}
        body {{
          font-family: {family}, sans-serif;
          font-size: {size}pt;
          line-height: {line_height};
          color: {color};
          text-align: {align};
        }}
        p {{ margin: 0; }}
        strong {{ color: #6f1d2b; font-weight: 400; }}
        em {{ font-style: italic; }}
        """,
        archive=str(LOCAL_FONT_DIR),
    )


def draw_ability_glossary_page() -> fitz.Document:
    doc = fitz.open()
    page = doc.new_page(width=PAGE_W, height=PAGE_H)

    draw_design_html_box(
        page,
        fitz.Rect(34, 41, PAGE_W - 34, 66),
        "ГЛОССАРИЙ СПОСОБНОСТЕЙ",
        size=14.5,
        family="DawnComic",
    )
    draw_red_rule(page, 72, 34, PAGE_W - 34, 2.5)
    draw_design_html_box(
        page,
        fitz.Rect(50, 94, PAGE_W - 50, 126),
        "ВЫ МОЖЕТЕ [ГЛАГОЛ] [СУЩЕСТВИТЕЛЬНОЕ], ПОКА [УСЛОВИЕ].",
        size=20.5,
        align="center",
        family="DawnComic",
    )

    table_x = 36
    table_y = 162
    table_w = PAGE_W - 72
    group_gap = 14
    group_w = (table_w - group_gap * 2) / 3
    term_w = group_w - 38
    header_h = 28
    row_h = 22.65
    headers = [("ГЛАГОЛ", "СТОИМОСТЬ"), ("СУЩЕСТВИТЕЛЬНОЕ", "СТОИМОСТЬ"), ("УСЛОВИЕ", "СТОИМОСТЬ")]

    for group_idx, (term_head, cost_head) in enumerate(headers):
        gx = table_x + group_idx * (group_w + group_gap)
        page.draw_rect(fitz.Rect(gx, table_y, gx + term_w, table_y + header_h), color=BLACK, fill=BLACK, width=0.8)
        page.draw_rect(fitz.Rect(gx + term_w, table_y, gx + group_w, table_y + header_h), color=BLACK, fill=BLACK, width=0.8)
        draw_design_html_box(
            page,
            fitz.Rect(gx + 5, table_y + 6, gx + term_w - 3, table_y + header_h - 2),
            term_head,
            size=9.4,
            family="DawnComic",
            color="#ffffff",
        )
        draw_design_html_box(
            page,
            fitz.Rect(gx + term_w + 4, table_y + 6, gx + group_w - 2, table_y + header_h - 2),
            cost_head,
            size=8.7,
            family="DawnComic",
            color="#ffffff",
        )

    y = table_y + header_h
    for row_idx, row in enumerate(ABILITY_GLOSSARY_ROWS):
        fill = (0.94, 0.94, 0.94) if row_idx % 2 == 0 else WHITE
        for group_idx in range(3):
            gx = table_x + group_idx * (group_w + group_gap)
            term = row[group_idx * 2]
            cost = row[group_idx * 2 + 1]
            page.draw_rect(fitz.Rect(gx, y, gx + term_w, y + row_h), color=BLACK, fill=fill, width=0.45)
            page.draw_rect(fitz.Rect(gx + term_w, y, gx + group_w, y + row_h), color=BLACK, fill=fill, width=0.45)
            draw_design_html_box(
                page,
                fitz.Rect(gx + 4, y + 4, gx + term_w - 3, y + row_h - 1),
                term,
                size=7.9,
                family="DawnBody",
                line_height=1.02,
            )
            draw_design_html_box(
                page,
                fitz.Rect(gx + term_w + 4, y + 4, gx + group_w - 3, y + row_h - 1),
                cost,
                size=8.2,
                family="DawnBody",
                line_height=1.0,
            )
        y += row_h

    notes_y = y + 18
    notes = [
        "✢ Если вы выбираете любую часть, отмеченную так, Способность заканчивается после Существительного, не включая Условие.",
        "✝ Эти слова представляют категорию; вы можете снизить стоимость на 1, выбрав только одну вещь в этой категории.",
        "☾ Вы должны выбрать другое Существительное, представляющее X. Если стоимость равна X, она становится равна стоимости выбранного Существительного.",
    ]
    for note in notes:
        draw_design_html_box(
            page,
            fitz.Rect(38, notes_y, PAGE_W - 38, notes_y + 26),
            note,
            size=8.9,
            family="DawnBody",
            line_height=1.1,
        )
        notes_y += 34

    return doc


def page_ref_text(target: str) -> str:
    page_no = PAGE_REFERENCE_TARGETS.get(toc_key(target))
    return str(page_no) if page_no is not None else "X"


def draw_structured_combat_rules_page() -> fitz.Document:
    doc = fitz.open()
    page = doc.new_page(width=PAGE_W, height=PAGE_H)

    draw_design_html_box(
        page,
        fitz.Rect(42, 50, PAGE_W - 42, 105),
        "СТРУКТУРИРОВАННЫЙ БОЙ",
        size=33.5,
        align="center",
        family="DawnComic",
        line_height=1.0,
    )
    draw_red_rule(page, 116, 45, PAGE_W - 45, 2.6)
    callout = fitz.Rect(48, 138, PAGE_W - 48, 236)
    page.draw_rect(callout, color=RED, fill=WHITE, width=1.8)
    draw_design_html_box(
        page,
        fitz.Rect(callout.x0 + 14, callout.y0 + 11, callout.x1 - 14, callout.y1 - 10),
        "Тактический элемент, самая игровая часть DAWN, предназначен для ситуаций, когда две равные или почти равные по силе группы встречаются в бою. И хотя риски боя могут создавать напряжение, в основном он существует ради удовольствия и ради того, чтобы подкреплять эстетику персонажей игроков способами, которые можно показать только в бою.\n\nВ структурированном бою от игроков ожидается оптимизация сборок, работа с угрозами и контроль любых переменных, которые можно контролировать, чтобы побеждать врагов как можно эффективнее. То, как они используют свои действия и выбирают Техники, определяет, будут ли они жить или умрут, а также неявно закрепляет темы и эстетику их персонажей.",
        size=8.2,
        align="center",
        family="DawnBody",
        line_height=1.12,
    )

    left_html = f"""
    <h2>Порядок ходов</h2>
    <p>Структурированный бой состоит из <strong>действий</strong>, <strong>Реакций</strong>, <strong>Ходов</strong> и <strong>Раундов</strong>. <strong>Раунд</strong> состоит из <strong>Ходов</strong> всех участвующих игроков и как минимум одного <strong>Хода врага</strong> на каждого из них; эти <strong>Ходы</strong> содержат <strong>действия</strong> игрока.</p>
    <h3>Действия и очки действий</h3>
    <p>Когда начинается <strong>Раунд</strong>, все персонажи игроков получают 3 <strong>очка действий</strong>, или <strong>ОД</strong>, теряя все ОД, которые у них были. Их можно тратить на <strong>базовые действия</strong>, подробно описанные на стр. {page_ref_text('Базовые действия')}. У каждого <strong>действия</strong> указана <strong>Стоимость ОД</strong>, иногда сокращаемая до <strong>Стоимости</strong>, которую нужно заплатить, чтобы совершить это <strong>действие</strong>.</p>
    <h3>Лимит действий и Быстрые действия</h3>
    <p><strong>Персонаж не может использовать одно и то же базовое действие больше одного раза за Раунд</strong>, если только это <strong>действие</strong> не было <strong>Быстрым</strong> - свойством, которое часто дают эффекты <strong>Техник</strong>.</p>
    <h3>Реакции</h3>
    <p><strong>Реакции</strong> можно использовать вне <strong>Хода</strong>, когда выполняются определенные условия, и они тоже могут стоить <strong>ОД</strong>. Именно поэтому <strong>ОД</strong> получают в начале <strong>Раунда</strong>, а не в начале <strong>Хода</strong>. <strong>Реакции</strong> все еще являются <strong>действиями</strong>, но не подчиняются ограничению "один раз за Раунд" и по умолчанию все считаются <strong>Быстрыми</strong>.</p>
    <h3>Прорыв <span class="influence-icon">❂</span></h3>
    <p>Помимо обычных Реакций, <strong>все действия не-Атаки можно совершать как Реакцию на завершение Хода персонажа</strong>, потратив 1 <strong>Влияние</strong> на <strong>Прорыв</strong>.</p>
    <p><strong>Действия</strong>, совершенные через <strong>Прорыв</strong>, не имеют <strong>Стоимости ОД</strong>.</p>
    """
    right_html = """
    <h3>Совершение Ходов</h3>
    <p>Игроки и NPC по-разному относятся к порядку <strong>Ходов</strong>. Каждый метод будет описан ниже. Когда начинается бой, <strong>все игроки должны между собой решить, кто совершает первый Ход</strong>. После этого выбранный игрок совершает свой первый <strong>Ход</strong>, выполняя <strong>действия</strong>, пока больше не может или не хочет.</p>
    <p>Когда игрок заканчивает свой <strong>Ход</strong>, враг по выбору <strong>Нарратора</strong>, который еще не совершал <strong>Ход</strong>, совершает свой. Если все враги уже совершили <strong>Ход</strong>, вместо этого <strong>Ход</strong> может совершить враг, который уже действовал.</p>
    <p>После завершения этого <strong>Хода</strong> последний действовавший игрок может выбрать игрока, который еще не совершал <strong>Ход</strong>; затем этот игрок совершает свой. Это повторяется, пока все игроки не совершат свои <strong>Ходы</strong>.</p>
    <h3>Помощь <span class="influence-icon">❂</span></h3>
    <p>Иногда бой начинается, а игрок присутствует за столом, но его персонажа нет в <strong>Сцене</strong>. Бой длится долго, и полностью исключать игроков из него из-за того, что их персонаж не может участвовать, слишком сурово. Поэтому такие игроки могут выбрать <strong>"Помогать"</strong> другим игрокам, когда начинается бой.</p>
    <p>Пока игрок <strong>Помогает</strong>, он может использовать <strong>Прорыв</strong>, чтобы совершить <strong>действие</strong>, контролируя согласного союзника. Он также может совершить <strong>Прорыв</strong> без стоимости <strong>Влияния</strong> до трех раз в каждой <strong>боевой Сцене</strong>.</p>
    <p>Любые показатели, на которые ссылается <strong>Прорыв с Помощью</strong>, заменяются <strong>вторичным Атрибутом Помощника</strong>. Это включает замену <strong>Атрибутов</strong> для бросков, но также замену других пассивных показателей вроде <strong>Скорости</strong> и <strong>Стойкости</strong>.</p>
    """
    column_css = """
    @font-face { font-family: DawnBody; src: url(Rubik-wght.ttf); }
    @font-face { font-family: DawnBody; font-style: italic; src: url(Rubik-Italic-wght.ttf); }
    @font-face { font-family: DawnComic; src: url(BalsamiqSans-BoldItalic.ttf); }
    body { font-family: DawnBody, sans-serif; font-size: 8.95pt; line-height: 1.12; color: #080808; }
    p { margin: 0 0 5.2pt 0; }
    strong { color: #6f1d2b; font-weight: 400; }
    em { font-style: italic; }
    h2, h3 { font-family: DawnComic, sans-serif; font-weight: 900; font-style: italic; margin: 8pt 0 3.3pt 0; border-bottom: 1.6pt dotted #6f1d2b; padding-bottom: 1pt; }
    h2 { font-size: 15.2pt; border-bottom: 2.4pt solid #6f1d2b; }
    h3 { font-size: 10.7pt; }
    .influence-icon { color: #6f1d2b; font-style: normal; }
    """
    left = DESIGN_RAIL_INNER_X + DESIGN_INNER_MARGIN
    right = left + DESIGN_COL_W + DESIGN_GUTTER
    page.insert_htmlbox(fitz.Rect(left, 258, left + DESIGN_COL_W, PAGE_H - 66), left_html, css=column_css, archive=str(LOCAL_FONT_DIR))
    page.insert_htmlbox(fitz.Rect(right, 258, right + DESIGN_COL_W, PAGE_H - 66), right_html, css=column_css, archive=str(LOCAL_FONT_DIR))
    return doc


def draw_damage_health_page() -> fitz.Document:
    doc = fitz.open()
    page = doc.new_page(width=PAGE_W, height=PAGE_H)

    left = DESIGN_RAIL_INNER_X + DESIGN_INNER_MARGIN
    right = left + DESIGN_COL_W + DESIGN_GUTTER
    body_html = """
    <h2>Урон и Здоровье</h2>
    <p>Все взаимодействия в структурированном бою будут мотивированы <strong>уроном</strong>: желанием избежать его или нанести. <strong>Урон</strong> - способ, которым эта игра отслеживает прогресс в боях.</p>
    <h3>Здоровье</h3>
    <p>У всех персонажей есть значение <strong>Здоровья</strong>, определяющее их стойкость в бою. <strong>Здоровье</strong> сбрасывается в конце каждой <strong>Сцены</strong>. Когда персонажи получают урон, они теряют <strong>Здоровье</strong>. <strong>Здоровье</strong> может опуститься до 0.</p>
    <p>Максимальное <strong>Здоровье</strong> персонажа равно:</p>
    <p><code>[Тело x 2] + [Ступень x 2]</code></p>
    <h3>Стойкость</h3>
    <p><strong>Стойкость</strong> вашего персонажа - показатель, равный <code>1 + [Тело]</code>, который увеличивает число <strong>Ран</strong>, которые вы можете получить, прежде чем будете <strong>выведены из строя</strong>.</p>
    <h3>Раны и выведение из строя</h3>
    <p><strong>Рана</strong> символизирует длительную травму, ослабляющую тех, у кого она есть. Когда ваше <strong>Здоровье</strong> снижено до 0, вы получаете <strong>Рану</strong>, а ваше <strong>Здоровье</strong> устанавливается на <code>[Стойкость]</code>.</p>
    <p>Когда персонаж достигает числа <strong>Ран</strong>, равного его <strong>Стойкости</strong>, он теряет одну <strong>Рану</strong> и <strong>выводится из строя</strong> из <strong>Сцены</strong>. Персонаж с 0 <strong>Стойкости</strong>, включая всех <strong>врагов</strong>, <strong>выводится из строя</strong>, как только его <strong>Здоровье</strong> падает до нуля. Персонажи теряют свои <strong>Раны</strong>, когда проходят <strong>Интермиссию</strong>.</p>
    <h3>Получение Влияния через Раны <span class="influence-icon">❂</span></h3>
    <p>Когда вы получаете <strong>Рану</strong> из источника, отличного от вас самих, вы также получаете <strong>Влияние</strong>.</p>
    <h3>Броня и Уклонение</h3>
    <p>Хотя у большинства персонажей по умолчанию нет к ним доступа, у некоторых есть один из следующих защитных показателей.</p>
    <h3>Броня</h3>
    <p>Если у персонажа есть значение <strong>Брони</strong>, урон, который он получает от <strong>Атак</strong>, уменьшается на это значение, минимум до 1.</p>
    <h3>Уклонение</h3>
    <p>Если у персонажа есть значение <strong>Уклонения</strong>, получаемый урон перенаправляется в это <strong>Уклонение</strong>, снижая его так, как если бы это было <strong>Здоровье</strong>. Если это снижает урон <strong>Атаки</strong> до 0, защитник также игнорирует любые вторичные эффекты этой <strong>Атаки</strong>.</p>
    """
    css = """
    @font-face { font-family: DawnBody; src: url(Rubik-wght.ttf); }
    @font-face { font-family: DawnBody; font-style: italic; src: url(Rubik-Italic-wght.ttf); }
    @font-face { font-family: DawnComic; src: url(BalsamiqSans-BoldItalic.ttf); }
    @font-face { font-family: DawnMono; src: url(RubikMonoOne-Regular.ttf); }
    body { font-family: DawnBody, sans-serif; font-size: 8.9pt; line-height: 1.11; color: #080808; }
    p { margin: 0 0 5pt 0; }
    strong { color: #6f1d2b; font-weight: 400; }
    code { font-family: DawnMono, monospace; font-size: 7.2pt; background: #eeeeee; padding: 0.2pt 1pt; }
    h2, h3 { font-family: DawnComic, sans-serif; font-weight: 900; font-style: italic; margin: 8pt 0 3.2pt 0; border-bottom: 1.5pt dotted #6f1d2b; padding-bottom: 1pt; }
    h2 { font-size: 15.2pt; border-bottom: 2.4pt solid #6f1d2b; }
    h3 { font-size: 10.4pt; }
    .influence-icon { color: #6f1d2b; font-style: normal; }
    """
    page.insert_htmlbox(fitz.Rect(left, 50, left + DESIGN_COL_W, PAGE_H - 62), body_html, css=css, archive=str(LOCAL_FONT_DIR))

    art_path = inline_art_path("combat_mainspring")
    if art_path.exists():
        page.insert_image(fitz.Rect(right - 6, 82, PAGE_W - DESIGN_RAIL_INNER_X - DESIGN_INNER_MARGIN + 6, 744), filename=str(art_path), keep_proportion=True)
    return doc


def draw_major_opener(source: fitz.Document, meta: dict[str, object]) -> tuple[fitz.Document, str]:
    title = str(meta["title"])
    caption = str(meta["caption"])
    doc = fitz.open()
    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    fill_original_page(page, source, int(meta["source_page"]))

    title_size = 35
    if len(title) > 17:
        title_size = 30
    if len(title) > 24:
        title_size = 26

    page.draw_rect(fitz.Rect(42, 32, PAGE_W - 42, 108), color=WHITE, fill=WHITE)
    draw_html_text(
        page,
        fitz.Rect(56, 42, PAGE_W - 56, 102),
        title.upper(),
        size=title_size,
        align="center",
        family="DawnHead",
    )

    page.draw_rect(fitz.Rect(36, 678, PAGE_W - 36, 790), color=WHITE, fill=WHITE)
    draw_html_text(
        page,
        fitz.Rect(52, 688, PAGE_W - 52, 718),
        caption,
        size=8.8,
        align="center",
        family="DawnBody",
        weight=700,
        style="italic",
    )
    return doc, title


def draw_major_opener_design(source: fitz.Document, meta: dict[str, object]) -> tuple[fitz.Document, str]:
    title = str(meta["title"])
    caption = str(meta["caption"]).upper()
    doc = fitz.open()
    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    fill_original_page(page, source, int(meta["source_page"]))

    title_size = 45
    if len(title) > 17:
        title_size = 39
    if len(title) > 24:
        title_size = 34

    page.draw_rect(fitz.Rect(34, 26, PAGE_W - 34, 132), color=WHITE, fill=WHITE)
    draw_html_text_design(
        page,
        fitz.Rect(42, 46, PAGE_W - 42, 126),
        title.upper(),
        size=title_size,
        align="center",
        family="DawnDisplay",
        weight=900,
    )

    page.draw_rect(fitz.Rect(34, 674, PAGE_W - 34, 790), color=WHITE, fill=WHITE)
    page.draw_line(fitz.Point(40, 674), fitz.Point(PAGE_W - 40, 674), color=RED, width=2.6)
    draw_html_text_design(
        page,
        fitz.Rect(52, 684, PAGE_W - 52, 716),
        caption,
        size=13.2,
        align="center",
        family="DawnComic",
        weight=900,
        style="italic",
    )
    return doc, title


def draw_archetype_opener(source: fitz.Document, file_name: str) -> tuple[fitz.Document, str]:
    meta = ARCHETYPE_OPENERS[file_name]
    title, intro = extract_archetype_intro(TRANSLATION / file_name)
    doc = fitz.open()
    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    fill_original_page(page, source, int(meta["source_page"]))

    page.draw_rect(fitz.Rect(58, 28, PAGE_W - 58, 86), color=WHITE, fill=WHITE)
    draw_html_text(page, fitz.Rect(72, 37, PAGE_W - 72, 84), title.upper(), size=30, align="center", family="DawnHead")

    label_rect = fitz.Rect(*meta["label_rect"])
    draw_white_rect(page, label_rect, border=1.6)
    label_lines = [line for line in str(meta["label"]).splitlines() if line.strip()]
    label_size = 13.8 if len(label_lines) > 2 else 15.2
    text_h = max(24, len(label_lines) * label_size * 1.18)
    text_top = label_rect.y0 + max(7, (label_rect.height - text_h) / 2)
    text_bottom = min(label_rect.y1 - 7, text_top + text_h + 4)
    draw_html_text_design(
        page,
        fitz.Rect(label_rect.x0 + 5, text_top, label_rect.x1 - 5, text_bottom),
        str(meta["label"]),
        size=label_size,
        align="center",
        family="DawnComic",
        weight=900,
        style="italic",
    )

    page.draw_rect(fitz.Rect(36, 682, PAGE_W - 36, 792), color=WHITE, fill=WHITE)
    draw_html_text(page, fitz.Rect(62, 726, PAGE_W - 62, 782), intro, size=9.2, align="center", family="DawnBody", weight=700, style="italic")

    page.draw_rect(fitz.Rect(32, 104, PAGE_W - 32, 704), color=BLACK, width=1.2)
    page.draw_line(fitz.Point(32, 104), fitz.Point(PAGE_W - 32, 104), color=RED, width=2.4)
    return doc, title


def draw_board(page: fitz.Page, x: float, y: float, cell: float, rows: list[str]) -> None:
    colors = {
        "W": WHITE,
        "B": BLUE,
        "R": SCENARIO_RED,
        "G": BOARD_GRAY,
        "Y": GOLD,
    }
    for row_idx, row in enumerate(rows):
        for col_idx, token in enumerate(row.split()):
            rect = fitz.Rect(x + col_idx * cell, y + row_idx * cell, x + (col_idx + 1) * cell, y + (row_idx + 1) * cell)
            page.draw_rect(rect, color=BLACK, fill=colors[token], width=0.8)
    page.draw_rect(fitz.Rect(x, y, x + len(rows[0].split()) * cell, y + len(rows) * cell), color=BLACK, width=1.2)


def draw_scenarios_page() -> fitz.Document:
    doc = fitz.open()
    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    left = 48
    right = 316

    draw_html_text(page, fitz.Rect(left, 48, 286, 76), "ПРИМЕРЫ БОЕВЫХ СЦЕНАРИЕВ", size=15.5, family="DawnHead")
    draw_red_rule(page, 82, left, 286, 2)
    draw_html_text(
        page,
        fitz.Rect(left, 90, 286, 220),
        "Стандартная цель в боевой Сцене - вывести из строя всех врагов до того, как персонажи игроков будут выведены из строя. Но это не жесткое требование: Нарратор может менять условие победы в отдельном бою ради истории или темпа игры.\n\nНиже - несколько базовых схем, которые легко адаптировать к своей сцене.",
        size=9.3,
    )

    draw_html_text(page, fitz.Rect(left, 250, 286, 274), "ЛЕГЕНДА", size=13, family="DawnHead")
    draw_red_rule(page, 278, left, 210, 1.4)
    legend = [
        (BLUE, "Синие пространства:", "зона Развертывания игроков."),
        (SCENARIO_RED, "Красные пространства:", "зона Развертывания врагов."),
        (BOARD_GRAY, "Серые пространства:", "стандартная Местность."),
        (GOLD, "Золотые пространства:", "уникальная Местность."),
    ]
    y = 304
    for color, label, text in legend:
        page.draw_rect(fitz.Rect(left, y, left + 13, y + 13), color=BLACK, fill=color, width=0.7)
        draw_html_text(page, fitz.Rect(left + 19, y - 1, 286, y + 18), f"**{label}** {text}", size=8.8)
        y += 32
    draw_html_text(
        page,
        fitz.Rect(left, y + 8, 286, y + 58),
        "Белые пространства составляют остальную часть поля и считаются стандартными пустыми пространствами.",
        size=8.8,
    )

    draw_html_text(page, fitz.Rect(right, 48, PAGE_W - 48, 74), "ЗАЩИТА", size=13, family="DawnHead")
    draw_red_rule(page, 80, right, PAGE_W - 48, 1.4)
    draw_html_text(
        page,
        fitz.Rect(right, 88, PAGE_W - 48, 176),
        "Игроки побеждают, если достигают заданного значения Напряжения, и при этом ни один враг не начинает свой Ход в указанной золотой области.",
        size=8.8,
    )
    draw_board(
        page,
        right,
        190,
        29,
        [
            "W W G R R R R",
            "G W W W W R R",
            "B W G W G W R",
            "B B W W W W R",
            "B B B W G W G",
            "Y Y B B W W W",
            "Y Y B B B G W",
        ],
    )

    draw_html_text(page, fitz.Rect(right, 430, PAGE_W - 48, 456), "ШТУРМ", size=13, family="DawnHead")
    draw_red_rule(page, 462, right, PAGE_W - 48, 1.4)
    draw_html_text(
        page,
        fitz.Rect(right, 470, PAGE_W - 48, 558),
        "Обратный вариант защиты: игроки побеждают, если достигают заданного Напряжения, ни один враг не стоит в золотой области, а хотя бы один персонаж игрока находится в ней.",
        size=8.8,
    )
    draw_board(
        page,
        right,
        576,
        29,
        [
            "W G W R R Y Y",
            "W W W W R Y Y",
            "G W G W W R R",
            "B W W W W W R",
            "B B G W G W W",
            "B B B W W W G",
            "B B B B G W W",
        ],
    )
    return doc


def draw_credits_page() -> fitz.Document:
    doc = fitz.open()
    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    draw_html_text(page, fitz.Rect(70, 62, PAGE_W - 70, 122), "ТИТРЫ", size=38, align="center", family="DawnHead")
    draw_red_rule(page, 128, 50, PAGE_W - 50, 2.8)

    sections = credit_sections()
    y = 154
    for title, items in sections[:3]:
        draw_html_text(page, fitz.Rect(80, y, PAGE_W - 80, y + 20), title.upper() + ":", size=11.5, align="center", family="DawnHead")
        page.draw_line(fitz.Point(68, y + 24), fitz.Point(PAGE_W - 68, y + 24), color=BLACK, width=1.5)
        draw_html_text(page, fitz.Rect(90, y + 31, PAGE_W - 90, y + 78), "\n".join(items), size=9.2, align="center")
        y += 78

    column_slots = {
        "Плейтестеры": (410, 172, 8.6),
        "Художники": (602, 176, 8.15),
    }
    for title, items in sections[3:]:
        y, block_h, size = column_slots.get(title, (410, 172, 8.4))
        draw_html_text(page, fitz.Rect(80, y, PAGE_W - 80, y + 20), title.upper() + ":", size=11.5, align="center", family="DawnHead")
        page.draw_line(fitz.Point(68, y + 24), fitz.Point(PAGE_W - 68, y + 24), color=BLACK, width=1.5)
        half = (len(items) + 1) // 2
        left_items = "\n".join(items[:half])
        right_items = "\n".join(items[half:])
        draw_html_text(page, fitz.Rect(84, y + 36, PAGE_W / 2 - 14, y + block_h), left_items, size=size, align="center")
        draw_html_text(page, fitz.Rect(PAGE_W / 2 + 14, y + 36, PAGE_W - 84, y + block_h), right_items, size=size, align="center")
    return doc


def draw_localization_credits_page() -> fitz.Document:
    doc = fitz.open()
    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    draw_html_text(
        page,
        fitz.Rect(62, 70, PAGE_W - 62, 132),
        "РУССКАЯ ЛОКАЛИЗАЦИЯ",
        size=31,
        align="center",
        family="DawnHead",
    )
    draw_red_rule(page, 142, 50, PAGE_W - 50, 2.8)

    body = (
        f"**DAWN RU · версия {VERSION}**\n\n"
        "Неофициальный перевод, редактура и русская верстка.\n"
        "Канонический текст, глоссарий и история изменений входят в состав проекта DAWN RU.\n\n"
        "**Оригинальная игра**\n"
        "DAWN: The RPG © 2024 Joel Vreugdenhil.\n"
        "Оригинал распространяется по лицензии Creative Commons Attribution 4.0 International.\n"
        "https://creativecommons.org/licenses/by/4.0/\n\n"
        "**Внесенные изменения**\n"
        "Перевод на русский язык, терминологическая адаптация, редактура, русская верстка, "
        "интерактивное оглавление, перекрестные ссылки и PDF-навигация.\n\n"
        "Русская версия не подразумевает одобрения автором оригинала."
    )
    draw_html_text(
        page,
        fitz.Rect(82, 190, PAGE_W - 82, 600),
        body,
        size=11,
        align="center",
    )
    draw_red_rule(page, 650, 120, PAGE_W - 120, 1.2)
    draw_html_text(
        page,
        fitz.Rect(100, 674, PAGE_W - 100, 730),
        "Актуальная версия книги находится в каталоге release проекта.",
        size=9.5,
        align="center",
        style="italic",
    )
    return doc


def block_html(block: Block) -> str:
    return f"<div>{block.html}</div>"


def write_story_pdf(
    blocks: list[Block],
    path: Path,
    css: str = CSS,
    *,
    archive: str | Path = "C:/Windows/Fonts",
    design_layout: bool = False,
    design_intro: bool = False,
    design_intro_first_page: bool = False,
) -> list[tuple[int, int, str, float]]:
    positions: list[tuple[int, int, str, float]] = []
    ensure_design_assets()
    document_html = html_document_design_intro(blocks) if design_intro else html_document(blocks)
    story = fitz.Story(document_html, user_css=css, archive=str(archive))
    writer = fitz.DocumentWriter(str(path))

    def rectfn(rect_num: int, filled: fitz.Rect):
        if design_intro_first_page:
            full_x0 = DESIGN_RAIL_INNER_X + DESIGN_INNER_MARGIN
            full_x1 = PAGE_W - DESIGN_RAIL_INNER_X - DESIGN_INNER_MARGIN
            lower_y = 319

            if rect_num == 0:
                return (
                    fitz.Rect(0, 0, PAGE_W, PAGE_H),
                    fitz.Rect(full_x0, 58, full_x1, 314),
                    None,
                )
            if rect_num == 1:
                return (
                    None,
                    fitz.Rect(full_x0, lower_y, full_x0 + DESIGN_COL_W, DESIGN_TOP + DESIGN_COL_H),
                    None,
                )
            if rect_num == 2:
                return (
                    None,
                    fitz.Rect(full_x0 + DESIGN_COL_W + DESIGN_GUTTER, lower_y, full_x1, DESIGN_TOP + DESIGN_COL_H),
                    None,
                )

            local_rect = rect_num - 3
            col = local_rect % 2
            rect = column_rect_design(col)
            mediabox = fitz.Rect(0, 0, PAGE_W, PAGE_H) if col == 0 else None
            return mediabox, rect, None

        col = rect_num % 2
        rect = column_rect_design(col) if design_layout else column_rect(col, TOP)
        mediabox = fitz.Rect(0, 0, PAGE_W, PAGE_H) if col == 0 else None
        return mediabox, rect, None

    def positionfn(elpos):
        if elpos.heading and elpos.text:
            y0 = float(elpos.rect[1]) if elpos.rect else 0
            positions.append((int(elpos.page_num), int(elpos.heading), str(elpos.text), y0))

    story.write(writer, rectfn, positionfn=positionfn)
    writer.close()
    return positions


def manual_layout_units(blocks: list[Block]) -> list[tuple[str, list[Block]]]:
    units: list[tuple[str, list[Block]]] = []
    i = 0
    while i < len(blocks):
        block = blocks[i]

        if is_joel_note(block):
            note_html, next_i = joel_note_group_html(blocks, i, block_html)
            units.append((note_html, blocks[i:next_i]))
            i = next_i
            continue

        if block.kind == "h3" and "tech-title" in block.html:
            card_classes = ["card"]
            if toc_key(block.section) == toc_key("Примеры Развертываний"):
                card_classes.append("deployment-card")
            if is_enemy_card(block):
                card_classes.append("enemy-card")
            card_blocks = [block]
            card_parts = [block_html(block)]
            i += 1
            while i < len(blocks) and blocks[i].kind not in {"h1", "h2", "h3"}:
                card_blocks.append(blocks[i])
                card_parts.append(block_html(blocks[i]))
                i += 1
            units.append((f"<div class='{' '.join(card_classes)}'>" + "\n".join(card_parts) + "</div>", card_blocks))
            continue

        if block.kind in {"h1", "h2", "h3", "h4"}:
            grouped = [block]
            parts = [block_html(block)]
            i += 1
            had_paragraph = False
            while i < len(blocks) and blocks[i].kind == "p":
                had_paragraph = True
                grouped.append(blocks[i])
                parts.append(block_html(blocks[i]))
                i += 1
            had_inline_art = False
            while (
                block.kind == "h2"
                and not had_paragraph
                and i < len(blocks)
                and blocks[i].kind == "html"
                and "inline-art" in blocks[i].html
            ):
                had_inline_art = True
                grouped.append(blocks[i])
                parts.append(block_html(blocks[i]))
                i += 1
            if (
                block.kind == "h2"
                and not had_paragraph
                and not had_inline_art
                and i < len(blocks)
                and blocks[i].kind == "h3"
                and "tech-title" in blocks[i].html
            ):
                card_block = blocks[i]
                card_classes = ["card"]
                if is_enemy_card(card_block):
                    card_classes.append("enemy-card")
                grouped.append(card_block)
                parts.append(f"<div class='{' '.join(card_classes)}'>")
                parts.append(block_html(card_block))
                i += 1
                while i < len(blocks) and blocks[i].kind not in {"h1", "h2", "h3"}:
                    grouped.append(blocks[i])
                    parts.append(block_html(blocks[i]))
                    i += 1
                parts.append("</div>")
            units.append(("\n".join(parts), grouped))
            continue

        units.append((block_html(block), [block]))
        i += 1
    return units


def measure_htmlbox_height(html_text: str, width: float, css: str, archive: str | Path) -> float | None:
    probe = fitz.open()
    page = probe.new_page(width=width + 12, height=DESIGN_COL_H + 12)
    spare, scale = page.insert_htmlbox(
        fitz.Rect(0, 0, width, DESIGN_COL_H),
        html_text,
        css=css,
        archive=str(archive),
        scale_low=1,
    )
    probe.close()
    if spare < 0 or scale != 1:
        return None
    return max(1.0, DESIGN_COL_H - spare)


def write_manual_story_pdf(
    blocks: list[Block],
    path: Path,
    *,
    css: str,
    archive: str | Path,
) -> list[tuple[int, int, str, float]]:
    positions: list[tuple[int, int, str, float]] = []
    ensure_design_assets()
    units = manual_layout_units(blocks)
    doc = fitz.open()
    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    col = 0
    y = DESIGN_TOP
    bottom = DESIGN_TOP + DESIGN_COL_H

    def current_rect(height: float) -> fitz.Rect:
        base = column_rect_design(col)
        return fitz.Rect(base.x0, y, base.x1, min(bottom, y + height))

    def advance_column() -> None:
        nonlocal page, col, y
        if col == 0:
            col = 1
            y = DESIGN_TOP
            return
        page = doc.new_page(width=PAGE_W, height=PAGE_H)
        col = 0
        y = DESIGN_TOP

    for html_text, unit_blocks in units:
        height = measure_htmlbox_height(html_text, DESIGN_COL_W, css, archive)
        if height is None:
            height = DESIGN_COL_H

        if y > DESIGN_TOP + 0.5 and y + height > bottom:
            advance_column()

        draw_height = min(DESIGN_COL_H, height + 3)
        spare, scale = page.insert_htmlbox(
            current_rect(draw_height),
            html_text,
            css=css,
            archive=str(archive),
            scale_low=1,
        )
        if spare < 0 and y > DESIGN_TOP + 0.5:
            advance_column()
            spare, scale = page.insert_htmlbox(
                current_rect(min(DESIGN_COL_H, height + 3)),
                html_text,
                css=css,
                archive=str(archive),
                scale_low=1,
            )
        if spare < 0:
            # Last resort for unusually tall art or cards: keep it visible instead of dropping content.
            page.insert_htmlbox(
                column_rect_design(col),
                html_text,
                css=css,
                archive=str(archive),
                scale_low=0.92,
            )
            used = DESIGN_COL_H
        else:
            used = draw_height - spare

        page_no = len(doc)
        for block in unit_blocks:
            if block.kind in {"h1", "h2", "h3", "h4"}:
                positions.append((page_no, int(block.kind[1]), plain_block_text(block), y))

        y += max(1.0, used) + 3
        if y > bottom - 8:
            advance_column()

    doc.save(path, garbage=4, deflate=True)
    doc.close()
    return positions


def append_manual_story_blocks(
    combined: fitz.Document,
    blocks: list[Block],
    stem: str,
    positions: list[tuple[int, int, str, float]],
    manual_labels: dict[int, str] | None = None,
    section_label: str | None = None,
    css: str = CSS_ENEMY_CARDS,
    archive: str | Path = LOCAL_FONT_DIR,
) -> None:
    if not blocks:
        return
    section_pdf = WORK_DIR / f"{stem}.pdf"
    section_positions = write_manual_story_pdf(blocks, section_pdf, css=css, archive=archive)
    section_doc = fitz.open(section_pdf)
    page_offset = len(combined)
    combined.insert_pdf(section_doc)
    if manual_labels is not None and section_label:
        for idx in range(len(section_doc)):
            manual_labels[page_offset + idx + 1] = section_label
    positions.extend((page + page_offset, heading, text, y0) for page, heading, text, y0 in section_positions)
    section_doc.close()


def section_labels(page_count: int, positions: list[tuple[int, int, str, float]]) -> dict[int, str]:
    labels: dict[int, str] = {}
    current = "DAWN"
    by_page: dict[int, list[tuple[int, str, float]]] = {}
    for page, heading, text, y0 in positions:
        if heading == 1:
            by_page.setdefault(page, []).append((heading, text, y0))
    for page_no in range(1, page_count + 1):
        heads = sorted(by_page.get(page_no, []), key=lambda item: (item[2], item[0]))
        if heads:
            current = heads[0][1]
        labels[page_no] = current
    return labels


def overlay_chrome(
    pdf_in: Path,
    pdf_out: Path,
    positions: list[tuple[int, int, str, float]],
    manual_labels: dict[int, str] | None = None,
    skip_chrome_pages: set[int] | None = None,
) -> None:
    doc = fitz.open(pdf_in)
    labels = section_labels(len(doc), positions)
    labels.update(manual_labels or {})
    skip_chrome_pages = skip_chrome_pages or set()
    for index, page in enumerate(doc, start=1):
        if index in skip_chrome_pages:
            continue
        draw_page_chrome(page, index, labels.get(index, "DAWN"))
    doc.save(pdf_out, garbage=4, deflate=True)
    doc.close()


def overlay_chrome_design(
    pdf_in: Path,
    pdf_out: Path,
    positions: list[tuple[int, int, str, float]],
    manual_labels: dict[int, str] | None = None,
    skip_chrome_pages: set[int] | None = None,
) -> None:
    doc = fitz.open(pdf_in)
    labels = section_labels(len(doc), positions)
    labels.update(manual_labels or {})
    skip_chrome_pages = skip_chrome_pages or set()
    for index, page in enumerate(doc, start=1):
        if index in skip_chrome_pages:
            continue
        draw_page_chrome_design(page, index, labels.get(index, "DAWN"))
    doc.save(pdf_out, garbage=4, deflate=True)
    doc.close()


def append_special_doc(combined: fitz.Document, special: fitz.Document, manual_labels: dict[int, str], section: str) -> None:
    page_offset = len(combined)
    combined.insert_pdf(special)
    for idx in range(len(special)):
        manual_labels[page_offset + idx + 1] = section
    special.close()


def append_story_blocks(
    combined: fitz.Document,
    blocks: list[Block],
    stem: str,
    positions: list[tuple[int, int, str, float]],
    manual_labels: dict[int, str] | None = None,
    section_label: str | None = None,
    css: str = CSS,
    archive: str | Path = "C:/Windows/Fonts",
    design_layout: bool = False,
    design_intro: bool = False,
    design_intro_first_page: bool = False,
) -> None:
    if not blocks:
        return
    section_pdf = WORK_DIR / f"{stem}.pdf"
    section_positions = write_story_pdf(
        blocks,
        section_pdf,
        css=css,
        archive=archive,
        design_layout=design_layout,
        design_intro=design_intro,
        design_intro_first_page=design_intro_first_page,
    )
    section_doc = fitz.open(section_pdf)
    page_offset = len(combined)
    combined.insert_pdf(section_doc)
    if manual_labels is not None and section_label:
        for idx in range(len(section_doc)):
            manual_labels[page_offset + idx + 1] = section_label
    positions.extend((page + page_offset, heading, text, y0) for page, heading, text, y0 in section_positions)
    section_doc.close()


def collect_toc_page_overrides(
    positions: list[tuple[int, int, str, float]],
    manual_starts: dict[str, int],
) -> list[str]:
    entries = parse_front_matter()["toc"]  # type: ignore[assignment]
    occurrences: dict[str, list[tuple[int, float]]] = {}

    def add_occurrence(title: str, page: int, y0: float = 0) -> None:
        key = toc_key(title)
        if key:
            occurrences.setdefault(key, []).append((page, y0))

    for title, page in manual_starts.items():
        add_occurrence(title, page, -1)
    for page, _heading, text, y0 in sorted(positions, key=lambda item: (item[0], item[3])):
        key = toc_key(text)
        if key:
            occurrences.setdefault(key, []).append((page, y0))

    for key in occurrences:
        occurrences[key].sort(key=lambda item: (item[0], item[1]))
    manual_pages = {toc_key(title): page for title, page in manual_starts.items() if toc_key(title)}

    def first_page(title: str, start: int = 1, end: int | None = None) -> int | None:
        for page, _y0 in occurrences.get(toc_key(title), []):
            if page < start:
                continue
            if end is not None and page >= end:
                continue
            return page
        return None

    top_pages: dict[int, int] = {}
    top_indices = [idx for idx, (level, _title, _page_no) in enumerate(entries) if level == 0]
    for idx in top_indices:
        _level, title, page_no = entries[idx]
        page = manual_pages.get(toc_key(title)) or first_page(title)
        if page is None and page_no:
            page = int(page_no)
        if page is not None:
            top_pages[idx] = page

    overrides: list[str] = []
    current_top_idx: int | None = None
    for idx, (level, title, page_no) in enumerate(entries):
        if level == 0:
            current_top_idx = idx
            overrides.append(str(top_pages.get(idx, page_no)))
            continue

        current_idx = current_top_idx if current_top_idx is not None else -1
        start = top_pages.get(current_idx, 1)
        next_top = next((top_pages[top_idx] for top_idx in top_indices if top_idx > current_idx and top_idx in top_pages), None)
        page = first_page(title, start, next_top) or first_page(title, start) or first_page(title)
        overrides.append(str(page) if page is not None else page_no)

    return overrides


def collect_page_reference_targets(
    positions: list[tuple[int, int, str, float]],
    manual_starts: dict[str, int],
) -> dict[str, int]:
    refs = {toc_key(title): page for title, page in manual_starts.items() if toc_key(title)}
    for page, _heading, text, y0 in sorted(positions, key=lambda item: (item[0], item[3])):
        key = toc_key(text)
        if key and key not in refs:
            refs[key] = page
    return refs


def valid_pdf_page_index(doc: fitz.Document, page_no_text: str) -> int | None:
    if not page_no_text or not page_no_text.isdigit():
        return None
    page_index = int(page_no_text) - 1
    if 0 <= page_index < len(doc):
        return page_index
    return None


def rect_signature(page_index: int, rect: fitz.Rect) -> tuple[int, int, int, int, int]:
    return (
        page_index,
        round(rect.x0 * 10),
        round(rect.y0 * 10),
        round(rect.x1 * 10),
        round(rect.y1 * 10),
    )


def add_toc_pdf_links(
    doc: fitz.Document,
    toc_start: int,
    toc_page_count: int,
    toc_overrides: list[str],
) -> int:
    entries = parse_front_matter()["toc"]  # type: ignore[assignment]
    toc_page_indices = range(toc_start - 1, toc_start - 1 + toc_page_count)
    used_rows: set[tuple[int, int]] = set()
    last_page_index = toc_start - 1
    last_y = 0.0
    added = 0

    for entry_idx, (_level, title, page_no) in enumerate(entries):
        if entry_idx < len(toc_overrides) and toc_overrides[entry_idx]:
            page_no = toc_overrides[entry_idx]
        target_page = valid_pdf_page_index(doc, page_no)
        if target_page is None:
            continue

        search_title = normalize_text(title.replace("❂", "")).strip()
        if not search_title:
            continue

        candidates: list[tuple[int, fitz.Rect]] = []
        for page_index in toc_page_indices:
            page = doc[page_index]
            for rect in page.search_for(search_title):
                if rect.y0 < 100 or rect.x0 < 35 or rect.x0 > PAGE_W - 85:
                    continue
                row_key = (page_index, round(rect.y0 * 10))
                if row_key in used_rows:
                    continue
                candidates.append((page_index, rect))
        if not candidates:
            continue

        candidates.sort(key=lambda item: (item[0], item[1].y0, item[1].x0))
        chosen_page_index, chosen_rect = candidates[0]
        for page_index, rect in candidates:
            if page_index > last_page_index or (page_index == last_page_index and rect.y0 >= last_y - 1.5):
                chosen_page_index, chosen_rect = page_index, rect
                break

        row_key = (chosen_page_index, round(chosen_rect.y0 * 10))
        used_rows.add(row_key)
        last_page_index = chosen_page_index
        last_y = chosen_rect.y0

        link_rect = fitz.Rect(42, chosen_rect.y0 - 2, PAGE_W - 44, chosen_rect.y1 + 3)
        doc[chosen_page_index].insert_link(
            {
                "kind": fitz.LINK_GOTO,
                "from": link_rect,
                "page": target_page,
                "to": fitz.Point(0, 0),
            }
        )
        added += 1

    return added


def add_page_reference_pdf_links(doc: fitz.Document, skip_pages: set[int]) -> int:
    reference_pattern = re.compile(r"(?:стр\.|странице)\s*(\d+)", re.IGNORECASE)
    added = 0
    seen_rects: set[tuple[int, int, int, int, int]] = set()

    for page_index, page in enumerate(doc):
        page_number = page_index + 1
        if page_number in skip_pages:
            continue

        page_text = page.get_text("text")
        phrases = sorted({match.group(0) for match in reference_pattern.finditer(page_text)}, key=len, reverse=True)
        for phrase in phrases:
            target_match = reference_pattern.search(phrase)
            if not target_match:
                continue
            target_page = valid_pdf_page_index(doc, target_match.group(1))
            if target_page is None:
                continue

            for rect in page.search_for(phrase):
                if rect.width <= 0 or rect.height <= 0 or rect.height > 24:
                    continue
                signature = rect_signature(page_index, rect)
                if signature in seen_rects:
                    continue
                seen_rects.add(signature)
                link_rect = fitz.Rect(rect.x0 - 1.5, rect.y0 - 1.5, rect.x1 + 1.5, rect.y1 + 1.5)
                page.insert_link(
                    {
                        "kind": fitz.LINK_GOTO,
                        "from": link_rect,
                        "page": target_page,
                        "to": fitz.Point(0, 0),
                    }
                )
                added += 1

    return added


def add_pdf_navigation_links(
    pdf_path: Path,
    toc_start: int,
    toc_page_count: int,
    toc_overrides: list[str],
) -> dict[str, int]:
    doc = fitz.open(pdf_path)
    toc_entries = parse_front_matter()["toc"]  # type: ignore[assignment]
    outline: list[list[int | str]] = []
    for entry_idx, (level, title, page_no) in enumerate(toc_entries):
        if entry_idx < len(toc_overrides) and toc_overrides[entry_idx]:
            page_no = toc_overrides[entry_idx]
        page_index = valid_pdf_page_index(doc, page_no)
        if page_index is not None:
            outline.append([level + 1, title.replace("❂", "").strip(), page_index + 1])

    doc.set_toc(outline, collapse=1)
    doc.set_metadata(
        {
            "title": f"DAWN RU v{VERSION}",
            "author": "Joel Vreugdenhil",
            "subject": "Неофициальная русская локализация бескубиковой фэнтезийной НРИ DAWN",
            "keywords": "DAWN, НРИ, TTRPG, русская локализация, бескубиковая ролевая игра",
            "creator": "Проект DAWN RU",
            "producer": f"DAWN RU build pipeline / PyMuPDF {fitz.VersionBind}",
        }
    )
    catalog = doc.pdf_catalog()
    doc.xref_set_key(catalog, "Lang", "(ru-RU)")
    doc.xref_set_key(catalog, "PageMode", "/UseOutlines")
    toc_pages = set(range(toc_start, toc_start + toc_page_count))
    stats = {
        "bookmarks": len(outline),
        "toc": add_toc_pdf_links(doc, toc_start, toc_page_count, toc_overrides),
        "page_refs": add_page_reference_pdf_links(doc, toc_pages),
    }
    tmp_path = pdf_path.with_name(f"{pdf_path.stem}.links.tmp.pdf")
    doc.save(tmp_path, garbage=4, deflate=True)
    doc.close()
    tmp_path.replace(pdf_path)
    return stats


def build_pdf(
    file_names: list[str],
    out_name: str,
    preview_dir: Path,
    limits: dict[str, int | None] | None = None,
    separate_sections: bool = True,
) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)
    WORK_DIR.mkdir(parents=True, exist_ok=True)

    limits = limits or {}

    out = OUT_DIR / out_name
    story_out = WORK_DIR / f"{Path(out_name).stem}-story.pdf"
    positions: list[tuple[int, int, str, float]] = []

    if separate_sections:
        combined = fitz.open()
        page_offset = 0
        for name in file_names:
            blocks = parse_markdown(TRANSLATION / name, limits.get(name))
            section_pdf = WORK_DIR / f"{Path(name).stem}-story.pdf"
            section_positions = write_story_pdf(blocks, section_pdf)
            section_doc = fitz.open(section_pdf)
            combined.insert_pdf(section_doc)
            positions.extend((page + page_offset, heading, text, y0) for page, heading, text, y0 in section_positions)
            page_offset += len(section_doc)
            section_doc.close()
        combined.save(story_out, garbage=4, deflate=True)
        combined.close()
    else:
        blocks: list[Block] = []
        for name in file_names:
            blocks.extend(parse_markdown(TRANSLATION / name, limits.get(name)))
        positions = write_story_pdf(blocks, story_out)

    overlay_chrome(story_out, out, positions)

    render_pdf(out, preview_dir)
    return out


def build_pilot() -> Path:
    return build_pdf(PILOT_FILES, "dawn-ru-layout-pilot.pdf", TMP_DIR)


def build_design_pilot_intro() -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    DESIGN_PILOT_INTRO_TMP_DIR.mkdir(parents=True, exist_ok=True)
    DESIGN_PILOT_INTRO_ORIGINAL_DIR.mkdir(parents=True, exist_ok=True)
    WORK_DIR.mkdir(parents=True, exist_ok=True)

    out = OUT_DIR / "dawn-ru-design-pilot-intro-v1.pdf"
    story_out = WORK_DIR / "dawn-ru-design-pilot-intro-v1-story.pdf"
    combined = fitz.open()
    positions: list[tuple[int, int, str, float]] = []
    manual_labels: dict[int, str] = {}

    source = fitz.open(ORIGINAL_PDF)
    opener, title = draw_major_opener_design(source, opener_meta("pages-005-008-introduction.md"))
    append_special_doc(combined, opener, manual_labels, title)

    section_pdf = WORK_DIR / "design-pilot-intro-story.pdf"
    blocks = intro_design_pilot_blocks()
    section_positions = write_story_pdf(
        blocks,
        section_pdf,
        css=CSS_DESIGN_INTRO,
        archive=LOCAL_FONT_DIR,
        design_layout=True,
        design_intro=True,
        design_intro_first_page=True,
    )
    section_doc = fitz.open(section_pdf)
    page_offset = len(combined)
    combined.insert_pdf(section_doc)
    for idx in range(len(section_doc)):
        manual_labels[page_offset + idx + 1] = title
    positions.extend((page + page_offset, heading, text, y0) for page, heading, text, y0 in section_positions)
    section_doc.close()

    combined.save(story_out, garbage=4, deflate=True)
    combined.close()
    source.close()

    overlay_chrome_design(story_out, out, positions, manual_labels=manual_labels)
    render_pdf(out, DESIGN_PILOT_INTRO_TMP_DIR)
    render_original_pages(range(6, 10), DESIGN_PILOT_INTRO_ORIGINAL_DIR)
    return out


def build_design_pilot_special() -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    DESIGN_PILOT_SPECIAL_TMP_DIR.mkdir(parents=True, exist_ok=True)
    DESIGN_PILOT_SPECIAL_ORIGINAL_DIR.mkdir(parents=True, exist_ok=True)
    WORK_DIR.mkdir(parents=True, exist_ok=True)

    out = OUT_DIR / "dawn-ru-design-pilot-special-v1.pdf"
    section_pdf = WORK_DIR / "design-pilot-special-story.pdf"
    blocks = intro_design_special_blocks()
    positions = write_story_pdf(
        blocks,
        section_pdf,
        css=CSS_DESIGN_INTRO + "\n.joel-note { page-break-before: always; }\n",
        archive=LOCAL_FONT_DIR,
        design_layout=True,
        design_intro=True,
    )
    section_doc = fitz.open(section_pdf)
    manual_labels = {page_no: "Введение" for page_no in range(1, len(section_doc) + 1)}
    section_doc.close()

    overlay_chrome_design(section_pdf, out, positions, manual_labels=manual_labels)
    render_pdf(out, DESIGN_PILOT_SPECIAL_TMP_DIR)
    render_original_pages(range(9, 11), DESIGN_PILOT_SPECIAL_ORIGINAL_DIR)
    return out


def build_book() -> Path:
    return build_pdf(BOOK_FILES, "dawn-ru-layout-draft.pdf", DRAFT_TMP_DIR, separate_sections=False)


def build_beauty_book() -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    BEAUTY_TMP_DIR.mkdir(parents=True, exist_ok=True)
    WORK_DIR.mkdir(parents=True, exist_ok=True)

    out = OUT_DIR / "dawn-ru-layout-beauty-draft.pdf"
    story_out = WORK_DIR / "dawn-ru-layout-beauty-draft-story.pdf"
    combined = fitz.open()
    positions: list[tuple[int, int, str, float]] = []
    manual_labels: dict[int, str] = {}
    skip_chrome_pages: set[int] = set()

    source = fitz.open(ORIGINAL_PDF)

    append_special_doc(combined, draw_cover_page(source), manual_labels, "DAWN")
    skip_chrome_pages.add(1)
    append_special_doc(combined, draw_service_page(), manual_labels, "DAWN")
    toc = draw_toc_pages()
    append_special_doc(combined, toc, manual_labels, "Оглавление")

    pre_tech_blocks: list[Block] = []
    for name in BOOK_FILES[1:7]:
        pre_tech_blocks.extend(parse_markdown(TRANSLATION / name))
    append_story_blocks(combined, pre_tech_blocks, "beauty-pre-tech-story", positions)

    for name in BOOK_FILES[7:13]:
        opener, title = draw_archetype_opener(source, name)
        append_special_doc(combined, opener, manual_labels, title)
        blocks = drop_leading_title_intro(parse_markdown(TRANSLATION / name))
        append_story_blocks(combined, blocks, f"beauty-{Path(name).stem}-story", positions, manual_labels, title, CSS_ARCHETYPE)

    post_tech_blocks: list[Block] = []
    for name in BOOK_FILES[13:15]:
        post_tech_blocks.extend(parse_markdown(TRANSLATION / name))
    post_tech_blocks.extend(parse_markdown(TRANSLATION / BOOK_FILES[15], stop_h1="Примеры боевых сценариев"))
    append_story_blocks(combined, post_tech_blocks, "beauty-post-tech-story", positions)

    append_special_doc(combined, draw_scenarios_page(), manual_labels, "Примеры боевых сценариев")
    append_special_doc(combined, draw_credits_page(), manual_labels, "Титры")

    source.close()
    combined.save(story_out, garbage=4, deflate=True)
    combined.close()

    overlay_chrome(story_out, out, positions, manual_labels=manual_labels, skip_chrome_pages=skip_chrome_pages)
    render_pdf(out, BEAUTY_TMP_DIR)
    return out


def build_final_book(page_refs: dict[str, int] | None = None) -> Path:
    global PAGE_REFERENCE_TARGETS
    PAGE_REFERENCE_TARGETS = page_refs or {}

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    RELEASE_DIR.mkdir(parents=True, exist_ok=True)
    FINAL_TMP_DIR.mkdir(parents=True, exist_ok=True)
    WORK_DIR.mkdir(parents=True, exist_ok=True)

    output_suffix = os.environ.get("DAWN_PDF_SUFFIX", "")
    out = (
        OUT_DIR / f"dawn-ru-layout-final{output_suffix}.pdf"
        if output_suffix
        else RELEASE_DIR / f"DAWN-RU-v{VERSION}.pdf"
    )
    story_out = WORK_DIR / f"dawn-ru-layout-final{output_suffix}-story.pdf"
    combined = fitz.open()
    positions: list[tuple[int, int, str, float]] = []
    manual_labels: dict[int, str] = {}
    skip_chrome_pages: set[int] = set()
    toc_starts: dict[str, int] = {}

    source = fitz.open(ORIGINAL_PDF)
    design_story_kwargs = {
        "css": CSS_DESIGN_BOOK,
        "archive": LOCAL_FONT_DIR,
        "design_layout": True,
    }

    append_special_doc(combined, draw_cover_page(source), manual_labels, "DAWN")
    skip_chrome_pages.add(1)
    append_special_doc(combined, draw_service_page(), manual_labels, "DAWN")
    toc_doc = draw_toc_pages()
    toc_start = len(combined) + 1
    toc_page_count = len(toc_doc)
    append_special_doc(combined, toc_doc, manual_labels, "Оглавление")

    for name in BOOK_FILES[1:6]:
        opener, title = draw_major_opener_design(source, opener_meta(name))
        toc_starts[title] = len(combined) + 1
        append_special_doc(combined, opener, manual_labels, title)
        parsed_blocks = parse_markdown(TRANSLATION / name)
        blocks = (
            drop_first_flavor_after_heading(parsed_blocks)
            if name == "pages-005-008-introduction.md"
            else drop_opener_title_caption(parsed_blocks)
        )
        blocks = add_inline_arts(blocks, name)
        if name == "pages-020-028-universal-rules.md":
            blocks = add_clock_examples(blocks)
        story_kwargs = dict(design_story_kwargs)
        if name == "pages-005-008-introduction.md":
            story_kwargs.update(
                {
                    "css": CSS_DESIGN_INTRO,
                    "design_intro": True,
                    "design_intro_first_page": True,
                }
            )
        if name == "pages-037-051-unstructured-play.md":
            before_glossary, after_glossary = split_out_ability_glossary(blocks)
            append_story_blocks(
                combined,
                before_glossary,
                f"final-{Path(name).stem}-pre-glossary-story",
                positions,
                manual_labels,
                title,
                **story_kwargs,
            )
            toc_starts["Глоссарий Способностей"] = len(combined) + 1
            append_special_doc(combined, draw_ability_glossary_page(), manual_labels, "Свободная игра")
            append_story_blocks(
                combined,
                after_glossary,
                f"final-{Path(name).stem}-post-glossary-story",
                positions,
                manual_labels,
                title,
                **story_kwargs,
            )
        else:
            append_story_blocks(
                combined,
                blocks,
                f"final-{Path(name).stem}-story",
                positions,
                manual_labels,
                title,
                **story_kwargs,
            )

    structured_name = "pages-052-064-structured-combat-core.md"
    structured_blocks = parse_markdown(TRANSLATION / structured_name)
    combat_blocks, technique_intro_blocks = split_blocks_at_h2(structured_blocks, "Техники")
    opener, title = draw_major_opener_design(source, opener_meta(structured_name))
    toc_starts[title] = len(combined) + 1
    append_special_doc(combined, opener, manual_labels, title)
    append_special_doc(combined, draw_structured_combat_rules_page(), manual_labels, title)
    toc_starts["Урон и Здоровье"] = len(combined) + 1
    append_special_doc(combined, draw_damage_health_page(), manual_labels, title)
    remaining_combat_blocks = add_inline_arts(blocks_from_h2(combat_blocks, "Напряжение"), structured_name)
    append_story_blocks(
        combined,
        remaining_combat_blocks,
        "final-structured-combat-story",
        positions,
        manual_labels,
        title,
        **design_story_kwargs,
    )

    opener, title = draw_major_opener_design(source, opener_meta("techniques"))
    toc_starts[title] = len(combined) + 1
    append_special_doc(combined, opener, manual_labels, title)
    append_story_blocks(
        combined,
        drop_first_flavor_after_heading(technique_intro_blocks),
        "final-techniques-intro-story",
        positions,
        manual_labels,
        title,
        **design_story_kwargs,
    )

    for name in BOOK_FILES[7:13]:
        opener, title = draw_archetype_opener(source, name)
        toc_starts[title] = len(combined) + 1
        append_special_doc(combined, opener, manual_labels, title)
        blocks = drop_leading_title_intro(parse_markdown(TRANSLATION / name))
        blocks = add_inline_arts(blocks, name)
        append_story_blocks(
            combined,
            blocks,
            f"final-{Path(name).stem}-story",
            positions,
            manual_labels,
            title,
            **design_story_kwargs,
        )

    opener, title = draw_major_opener_design(source, opener_meta("pages-100-108-narrator-tools.md"))
    toc_starts[title] = len(combined) + 1
    append_special_doc(combined, opener, manual_labels, title)
    narrator_blocks = add_inline_arts(
        drop_opener_title_caption(parse_markdown(TRANSLATION / "pages-100-108-narrator-tools.md")),
        "pages-100-108-narrator-tools.md",
    )
    narrator_rules_blocks, deployment_blocks = split_blocks_at_h2(narrator_blocks, "Примеры Развертываний")
    append_story_blocks(
        combined,
        narrator_rules_blocks,
        "final-narrator-tools-story",
        positions,
        manual_labels,
        title,
        **design_story_kwargs,
    )
    append_story_blocks(
        combined,
        deployment_blocks,
        "final-narrator-deployments-story",
        positions,
        manual_labels,
        title,
        **design_story_kwargs,
    )

    enemy_type_title = str(opener_meta("pages-109-119-general-enemy-types.md")["title"])
    toc_starts[enemy_type_title] = len(combined) + 1
    general_enemy_blocks = add_inline_arts(
        demote_leading_h1_to_h2(parse_markdown(TRANSLATION / "pages-109-119-general-enemy-types.md")),
        "pages-109-119-general-enemy-types.md",
    )
    append_manual_story_blocks(
        combined,
        general_enemy_blocks,
        "final-general-enemy-types-story",
        positions,
        manual_labels,
        enemy_type_title,
        css=CSS_ENEMY_CARDS,
        archive=LOCAL_FONT_DIR,
    )

    stakes_title = "Ставки в бою"
    toc_starts[stakes_title] = len(combined) + 1
    stakes_blocks = add_inline_arts(
        demote_leading_h1_to_h2(parse_markdown(TRANSLATION / "pages-120-124-combat-stakes-modifiers-credits.md", stop_h1="Примеры боевых сценариев")),
        "pages-120-124-combat-stakes-modifiers-credits.md",
    )
    append_manual_story_blocks(
        combined,
        stakes_blocks,
        "final-stakes-and-modifiers-story",
        positions,
        manual_labels,
        stakes_title,
        css=CSS_ENEMY_CARDS,
        archive=LOCAL_FONT_DIR,
    )

    scenario_page = len(combined) + 1
    toc_starts["Примеры боевых сценариев"] = scenario_page
    toc_starts["Защита"] = scenario_page
    toc_starts["Штурм"] = scenario_page
    append_special_doc(combined, draw_scenarios_page(), manual_labels, "Примеры боевых сценариев")
    toc_starts["Титры"] = len(combined) + 1
    append_special_doc(combined, draw_credits_page(), manual_labels, "Титры")
    toc_starts["Русская локализация"] = len(combined) + 1
    append_special_doc(
        combined,
        draw_localization_credits_page(),
        manual_labels,
        "Русская локализация",
    )

    derived_refs = collect_page_reference_targets(positions, toc_starts)
    if page_refs is None:
        source.close()
        combined.close()
        return build_final_book(derived_refs)

    toc_overrides = collect_toc_page_overrides(positions, toc_starts)
    updated_toc = draw_toc_pages(toc_overrides)
    if len(updated_toc) != toc_page_count:
        updated_toc.close()
        raise RuntimeError("Updated TOC page count changed; rerun layout with adjusted TOC reservation.")
    combined.delete_pages(toc_start - 1, toc_start + toc_page_count - 2)
    combined.insert_pdf(updated_toc, start_at=toc_start - 1)
    updated_toc.close()

    source.close()
    combined.save(story_out, garbage=4, deflate=True)
    combined.close()

    overlay_chrome_design(story_out, out, positions, manual_labels=manual_labels, skip_chrome_pages=skip_chrome_pages)
    link_stats = add_pdf_navigation_links(out, toc_start, toc_page_count, toc_overrides)
    print(
        "Added PDF navigation: "
        f"bookmarks={link_stats['bookmarks']}, "
        f"TOC={link_stats['toc']}, page_refs={link_stats['page_refs']}"
    )
    render_pdf(out, FINAL_TMP_DIR)
    return out


def render_pdf(pdf_path: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("page-*.png"):
        old.unlink()
    doc = fitz.open(pdf_path)
    for idx, page in enumerate(doc, start=1):
        pix = page.get_pixmap(matrix=fitz.Matrix(1.75, 1.75), alpha=False)
        pix.save(out_dir / f"page-{idx:03d}.png")
    doc.close()


def render_original_pages(page_numbers: range, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("original-page-*.png"):
        old.unlink()
    doc = fitz.open(ORIGINAL_PDF)
    for page_number in page_numbers:
        pix = doc[page_number - 1].get_pixmap(matrix=fitz.Matrix(1.75, 1.75), alpha=False)
        pix.save(out_dir / f"original-page-{page_number:03d}.png")
    doc.close()


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "pilot"
    if target == "book":
        print(build_book())
    elif target == "beauty":
        print(build_beauty_book())
    elif target == "final":
        print(build_final_book())
    elif target == "design-pilot-intro":
        print(build_design_pilot_intro())
    elif target == "design-pilot-special":
        print(build_design_pilot_special())
    else:
        print(build_pilot())
