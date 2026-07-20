(() => {
  "use strict";

  const presets = [
    {title:"Цепной реагент",role:"Артиллерия · контроль массовки",tone:"#d5ba55",stats:[4,3,2,2],order:["РЗМ","ДУХ","ТЕЛ","ТАЛ"],tech:["Химик III","Бомбардир II"],ids:[["disruptor.chemist",3],["ruiner.bombardier",2]],hook:"Превращает местность в ядовитую цепь взрывов.",play:"Разрушьте элемент местности Завершением и замените его Газом. Облако Ослабляет и наносит урон всем внутри, а добитые «Экспериментальной смесью» враги создают новые облака. Вы выбираете не жертву, а идеальный эпицентр каскада.",growth:"Ступень 2: Бомбардир III, Импровизатор I. Ступень 3: Импровизатор II, Творец заклинаний I.",recommendation:{outlook:"quiet",gifts:["Технарь","Умения и увлечения"]},complexity:"Сложность: высокая · зависит от местности"},
    {title:"Чудотворец передовой",role:"Боевой медик · восстановление",tone:"#91d4b4",stats:[4,3,2,2],order:["РЗМ","ДУХ","ТЕЛ","ТАЛ"],tech:["Хирург III","Небесный святой II"],ids:[["altruist.surgeon",3],["altruist.heavenly-saint",2]],hook:"Лечит союзников ударами и возвращает павших.",play:"Оперируйте союзников Стычкой через Разум: восстанавливайте Здоровье, снимайте Эффекты и расходуйте припасы на исцеление Ран. Заклинания дают безопасное дальнее лечение, а Чудо возвращает выведенного из строя героя прямо в бой.",growth:"Ступень 2: Небесный святой III, Эмпат I. Ступень 3: Эмпат II–III.",recommendation:{outlook:"beacon",gifts:["Святой","Истинный герой"]},complexity:"Сложность: средняя · поддержка в первой линии"},
    {title:"Последний кавалерист",role:"Мобильный танк · питомец",tone:"#df765f",stats:[4,3,2,2],order:["ТЕЛ","ТАЛ","ДУХ","РЗМ"],tech:["Боевой наездник III","Щит авангарда II"],ids:[["bulwark.battle-jockey",3],["bulwark.vanguard-defender",2]],hook:"Сражается в двух местах и закрывает союзников собой.",play:"Скакун провоцирует врагов и раз за Сцену рёвом Ошеломляет и разбрасывает целую группу. Всадник тем временем телепортируется к атакованным союзникам и принимает удары вместо них. Держите два центра давления одновременно.",growth:"Ступень 2: Щит авангарда III, Стойкий часовой I. Ступень 3: Стойкий часовой II–III.",recommendation:{outlook:"loyalist",gifts:["Дюрандаль","Наставления моего учителя"]},complexity:"Сложность: средняя · два активных персонажа"},
    {title:"Картограф ловушек",role:"Ловушки · принудительное движение",tone:"#56bad0",stats:[4,3,2,2],order:["РЗМ","ДУХ","ТАЛ","ТЕЛ"],tech:["Охотник III","Всадник волн II"],ids:[["disruptor.hunter",3],["disruptor.wave-rider",2]],hook:"Рисует на поле маршрут, по которому врагу нельзя идти.",play:"Бесплатно поставьте первую Печать волны, затем Быстрыми Стычками раскладывайте ловушки. Печати толкают и Подбрасывают персонажей прямо на капканы. Квадрат из четырёх ловушек становится Ямой с бесплатным Завершением Разумом.",growth:"Ступень 2: Всадник волн III, Шагающий по буре I. Ступень 3: Шагающий по буре II–III.",recommendation:{outlook:"quiet",gifts:["Технарь","Техноболтовня"]},complexity:"Сложность: очень высокая · головоломка поля"},
    {title:"Игла в тумане",role:"Скрытность · эвакуация",tone:"#a58ad9",stats:[4,3,2,2],order:["ТАЛ","РЗМ","ДУХ","ТЕЛ"],tech:["Ходящий в тумане III","Ассасин II"],ids:[["altruist.fog-walker",3],["vagabond.assassin",2]],hook:"Возит укрытие по полю и атакует из пустоты.",play:"Быстрой Передышкой создайте Туман, спрячьте в нём себя или союзника, затем передвиньте точку возвращения. Появление даёт Уклонение и новую позицию, а атака из Исчезновения получает Преимущество и критует на 5–6.",growth:"Ступень 2: Душа пустоты I–II. Ступень 3: Душа пустоты III, Последняя надежда I.",recommendation:{outlook:"quiet",gifts:["Скрытная суперпозиция","Перемена судьбы"]},complexity:"Сложность: средняя · мобильная зона безопасности"},
    {title:"Король небесного ринга",role:"Захват · комбо-боец",tone:"#ed8f55",stats:[4,3,2,2],order:["ТЕЛ","ТАЛ","ДУХ","РЗМ"],tech:["Борец-захватчик III","Мастер боевых искусств II"],ids:[["bulwark.grappler",3],["powerhouse.martial-artist",2]],hook:"Уносит соперника с поля и возвращает его лицом в землю.",play:"Завершением поймайте цель, затем комбо с Прыжком заставит вас обоих Исчезнуть. Возвращение Подбрасывает окружающих и даёт бесплатное Завершение по исходной жертве. Между приёмами чередуйте захват, толчок и колено.",growth:"Ступень 2: Мастер боевых искусств III, Джаггернаут I. Ступень 3: Джаггернаут II–III.",recommendation:{outlook:"confident",gifts:["Болтливый","И я буду сражаться одной рукой..."]},complexity:"Сложность: средняя · зрелищные двухходовые комбо"},
    {title:"Похититель секунд",role:"Темп · глобальная поддержка",tone:"#74c6ea",stats:[4,3,2,2],order:["ДУХ","РЗМ","ТАЛ","ТЕЛ"],tech:["Хрономант III","Боевой инструктор II"],ids:[["altruist.chronomancer",3],["altruist.battle-instructor",2]],hook:"Разгоняет команду, пока не останавливает время для всех.",play:"Заклинания перемещают союзников и дают Ускорение; каждый положительный Эффект заполняет Поток. На восьми сегментах одно Заклинание охватывает всю Сцену. Изучения и перебросы позволяют дирижировать командой между большими тактами.",growth:"Ступень 2: Боевой инструктор III, Репликатор I. Ступень 3: Репликатор II–III.",recommendation:{outlook:"mentor",gifts:["Упорядоченный стиль","Взгляд учителя"]},complexity:"Сложность: высокая · планирование общего темпа"},
    {title:"Шулер судьбы",role:"Карты · адаптивный контроль",tone:"#e3bf64",stats:[4,3,2,2],order:["РЗМ","ДУХ","ТАЛ","ТЕЛ"],tech:["Сборщик колоды III","Предвидящий II"],ids:[["altruist.deckbuilder",3],["altruist.precognizant",2]],hook:"Меняет смысл Заклинаний картами и заставляет судьбу перебрасывать.",play:"Карта может превратить Заклинание в болезнь, защиту, телепортацию или пять отрицательных Эффектов сразу. Ненужную карту положите на поле ловушкой. Предвидение страхует ключевой бросок — ваш или вражеский.",growth:"Ступень 2: Предвидящий III, Заклинатель талисманов I. Ступень 3: Заклинатель талисманов II–III.",recommendation:{outlook:"confident",gifts:["Злоба","Болтливый"]},complexity:"Сложность: высокая · импровизация от случайной руки"},
    {title:"Пилот двойного контура",role:"Мех · ответный огонь",tone:"#79d0c8",stats:[4,3,2,2],order:["ДУХ","ТЕЛ","РЗМ","ТАЛ"],tech:["Пилот меха III","Рунное возмездие II"],ids:[["bulwark.mecha-pilot",3],["bulwark.runic-retribution",2]],hook:"Одновременно управляет бронёй, дроном и перекрёстным огнём.",play:"Сражайтесь внутри Костюма или выпустите его отдельным Призывом. При полной синхронизации мех ходит сам и перемещает пилота вместе с собой. Попадание по союзнику вызывает бесплатное ответное Заклинание.",growth:"Ступень 2: Рунное возмездие III, Репликатор I. Ступень 3: Репликатор II–III.",recommendation:{outlook:"quiet",gifts:["Технарь","Техноболтовня"]},complexity:"Сложность: высокая · две шкалы позиции и защиты"},
    {title:"Пьяная комета",role:"Хаос · мобильный боец",tone:"#df5c75",stats:[4,3,2,2],order:["ТАЛ","ТЕЛ","ДУХ","РЗМ"],tech:["Пьяница III","Самобичеватель II"],ids:[["vagabond.drunkard",3],["powerhouse.flagellant",2]],hook:"Собирает отрицательные Эффекты, перестаёт их замечать и летит вперёд.",play:"Напейтесь до Замедления, Разорванности, Ослабления и Порчи. После третьего Эффекта их штрафы выключаются, но каждый всё ещё делает вас Усиленным. Случайные движения в начале и конце Хода превращаются в столкновения с врагами.",growth:"Ступень 2: Самобичеватель III, Демон скорости I. Ступень 3: Демон скорости II–III.",recommendation:{outlook:"rebel",gifts:["Перенапряжение","До последнего вздоха"]},complexity:"Сложность: средняя · управляемая непредсказуемость"},
    {title:"Геометр апокалипсиса",role:"Ритуалы · зональная артиллерия",tone:"#bd86e8",stats:[4,3,2,2],order:["ДУХ","РЗМ","ТЕЛ","ТАЛ"],tech:["Магическая схема III","Ритуалист II"],ids:[["disruptor.mage-s-array",3],["ruiner.ritualist",2]],hook:"Чертит на земле многоугольник и взрывает всё внутри.",play:"Передышками размещайте Руны, Зарядкой соединяйте их в фигуру и бесплатно применяйте Завершение ко всей её площади. Границы остаются трудной местностью. Та же Зарядка создаёт круг, усиливающий дальность и точность ритуала.",growth:"Ступень 2: Ритуалист III, Бомбардир I. Ступень 3: Бомбардир II–III.",recommendation:{outlook:"mentor",gifts:["Упорядоченный стиль","Лучшие годы позади"]},complexity:"Сложность: очень высокая · награда за геометрию"},
    {title:"Хозяин невозможной свиты",role:"Призывы · защита",tone:"#83c879",stats:[4,3,2,2],order:["ДУХ","ТАЛ","РЗМ","ТЕЛ"],tech:["Зов слуги III","Эмпат II"],ids:[["bulwark.servant-s-call",3],["altruist.empath",2]],hook:"Призывает слуг, меняется с ними местами и держит строй живым.",play:"Заклинанием в пустую клетку призовите Стража, Слизня или Паладина. Зарядка возвращает слугу к хозяину и заставляет принять следующую Атаку. Эмпат очищает соседей и бесплатно прорывается к раненым союзникам.",growth:"Ступень 2: Эмпат III, Боевой инструктор I. Ступень 3: Боевой инструктор II–III.",recommendation:{outlook:"loyalist",gifts:["Наставления моего учителя","Дюрандаль"]},complexity:"Сложность: высокая · управление свитой"},
    {title:"Катастрофист",role:"Смещение · разрушение поля",tone:"#e58a62",stats:[4,3,2,2],order:["ТЕЛ","ТАЛ","ДУХ","РЗМ"],tech:["Нечеловеческая сила III","Гигантская фигура II"],ids:[["disruptor.inhuman-strength",3],["bulwark.giant-frame",2]],hook:"Использует врагов как снаряды, а стены — как дополнительный урон.",play:"Займите область 2×2, проходите через обычных врагов и местность, толкайте персонажей или объекты на пять клеток. Столкновение со стеной наносит урон обоим; разрушенная стена отправляет жертву лететь дальше.",growth:"Ступень 2: Гигантская фигура III, Сокрушитель I. Ступень 3: Сокрушитель II–III.",recommendation:{outlook:"rebel",gifts:["До последнего вздоха","Перенапряжение"]},complexity:"Сложность: средняя · поле становится оружием"},
    {title:"Танец парных огней",role:"Парная поддержка · мобильная аура",tone:"#ef9ac1",stats:[4,3,2,2],order:["ДУХ","ТАЛ","РЗМ","ТЕЛ"],tech:["Блуждающий огонёк III","Танцор II"],ids:[["altruist.will-o-wisp",3],["altruist.dancer",2]],hook:"Связывает двух героев в один движущийся источник усилений.",play:"Назначьте союзника Партнёром и следуйте за каждым его движением. Когда он получает Фокус или Исчезает, вы повторяете преимущество. Объединённое Доброе и Яростное пламя даёт ближайшим союзникам Регенерацию и Усиление.",growth:"Ступень 2: Танцор III, Репликатор I. Ступень 3: Репликатор II–III.",recommendation:{outlook:"beacon",gifts:["Артист","Дружелюбный и открытый"]},complexity:"Сложность: средняя · синхронизация с одним союзником"},
    {title:"Стрела до рассвета",role:"Подготовка · сверхдальний выстрел",tone:"#c4d977",stats:[4,3,2,2],order:["ТАЛ","ДУХ","ТЕЛ","РЗМ"],tech:["Сильное натяжение III","Ассасин II"],ids:[["ruiner.long-draw",3],["vagabond.assassin",2]],hook:"Тратит весь Ход на один выстрел, прошивающий поле насквозь.",play:"Бесплатно Исчезните после Развертывания, выполните три Быстрые Подготовки и верните одно ОД комбо. Следующая Стычка получает огромную дальность и Преимущество, критует на 5–6 и поражает линию через всё поле — включая неосторожных союзников.",growth:"Ступень 2: Ассасин III, Снайпер I. Ступень 3: Снайпер II–III.",recommendation:{outlook:"wolf",gifts:["Единственное, на что можно положиться","В меньшинстве"]},complexity:"Сложность: низкая · высокая цена ошибки команды"},
    {title:"Вернуть отправителю",role:"Контратаки · копирование",tone:"#79a9ee",stats:[4,3,2,2],order:["ТАЛ","РЗМ","ДУХ","ТЕЛ"],tech:["Злобный подражатель III","Восходящий претендент II"],ids:[["vagabond.malicious-mimic",3],["bulwark.rising-challenger",2]],hook:"Отменяет лучший приём врага, запоминает его и возвращает обратно.",play:"Используйте Столкновение против Атак на себя или союзников. Успех отменяет удар, даёт Фокус и Впечатление. Затем бесплатно повторите соответствующую вражескую Атаку либо заплатите 1 ОД, чтобы скопировать его Козырь.",growth:"Ступень 2: Восходящий претендент III, Отражатель I. Ступень 3: Отражатель II–III.",recommendation:{outlook:"student",gifts:["Никогда не сдавайся!","Еще многому учиться"]},complexity:"Сложность: высокая · сила зависит от противника"}
  ];

  const track = document.querySelector("#build-track");
  const viewport = document.querySelector("#build-viewport");
  const detail = document.querySelector("#build-detail");
  const position = document.querySelector("#build-position");
  const progress = document.querySelector("#build-progress");
  const prev = document.querySelector("#build-prev");
  const next = document.querySelector("#build-next");
  if (!track || !viewport || !detail) return;

  let active = 0;
  const pad = n => String(n).padStart(2, "0");
  const dawn = window.DAWN_DATA || {archetypes:[],outlooks:[]};
  const techniqueById = new Map(dawn.archetypes.flatMap(archetype => archetype.techniques).map(technique => [technique.id, technique]));
  const outlookById = new Map(dawn.outlooks.map(outlook => [outlook.id, outlook]));
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
  const markdown = value => escapeHtml(value).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/`(.+?)`/g,"<code>$1</code>").replace(/\n- /g,"<br>• ").replace(/\n/g,"<br>");
  const normalizedName = value => String(value || "").replace(/[«»"]/g, "").trim().toLocaleLowerCase("ru");

  function renderTechniqueReference(preset) {
    return preset.ids.map(([id, acquiredLevel], index) => {
      const technique = techniqueById.get(id);
      if (!technique) return `<p class="build-data-warning">Описание «${escapeHtml(id)}» временно недоступно.</p>`;
      const levels = technique.levels.slice(0, acquiredLevel).map(level => `
        <article class="build-rule-level"><b>${level.n}. ${escapeHtml(level.name)}</b><p>${markdown(level.text)}</p></article>`).join("");
      return `<details class="build-rule"${index === 0 ? " open" : ""}>
        <summary><span>${escapeHtml(technique.name)}</span><small>${escapeHtml(technique.tags)} · уровень ${acquiredLevel}</small></summary>
        <div>${levels}</div>
      </details>`;
    }).join("");
  }

  function renderRecommendation(preset) {
    const outlook = outlookById.get(preset.recommendation.outlook);
    if (!outlook) return `<p class="build-data-warning">Рекомендация временно недоступна.</p>`;
    const allGifts = (outlook.builtin ? [outlook.builtin] : []).concat(outlook.gifts || []);
    const gifts = preset.recommendation.gifts.map(name => allGifts.find(gift => normalizedName(gift.name) === normalizedName(name))).filter(Boolean);
    return `<div class="build-recommendation-head"><span>Необязательная рекомендация</span><h4>${escapeHtml(outlook.name)}</h4><p>${markdown(outlook.desc)}</p></div>
      <div class="build-gifts">${gifts.map(gift => `<article><b>${escapeHtml(gift.name)}</b><p>${markdown(gift.text)}</p></article>`).join("")}</div>`;
  }

  track.innerHTML = presets.map((preset, index) => `
    <article class="build-card${index === 0 ? " is-active" : ""}" style="--card-accent:${preset.tone}" data-index="${index}" aria-label="${pad(index + 1)}. ${preset.title}">
      <div class="build-card-top"><span>${preset.role}</span><b class="build-card-index">${pad(index + 1)}</b></div>
      <h3>${preset.title}</h3>
      <p class="build-card-hook">${preset.hook}</p>
      <div class="build-techniques">${preset.tech.map(item => `<span>${item}</span>`).join("")}</div>
      <div class="build-stats">${preset.stats.map((value, i) => `<span><small>${preset.order[i]}</small><b>${value}</b></span>`).join("")}</div>
      <button class="build-open" type="button">Смотреть сборку</button>
    </article>`).join("");

  const cards = [...track.querySelectorAll(".build-card")];

  function renderDetail(index, moveFocus = false) {
    active = Math.max(0, Math.min(index, presets.length - 1));
    const preset = presets[active];
    cards.forEach((card, i) => card.classList.toggle("is-active", i === active));
    position.textContent = `${pad(active + 1)} / ${pad(presets.length)}`;
    progress.style.transform = `translateX(${active * 100}%)`;
    detail.style.setProperty("--detail-accent", preset.tone);
    detail.innerHTML = `
      <div>
        <span class="build-detail-kicker">СБОРКА ${pad(active + 1)} · СТУПЕНЬ 1</span>
        <h3>${preset.title}</h3>
        <p class="build-detail-role">${preset.role}<br>${preset.tech.join(" + ")}</p>
      </div>
      <div class="build-detail-content">
        <div class="build-detail-body">
          <section><h4>Как это играется</h4><p>${preset.play}</p></section>
          <aside><div><h4>Путь развития</h4><p>${preset.growth}</p></div><div><h4>Профиль</h4><p>${preset.complexity}</p></div></aside>
        </div>
        <div class="build-reference">
          <section class="build-tech-reference"><h4>Техники в сборке</h4>${renderTechniqueReference(preset)}</section>
          <section class="build-outlook-reference">${renderRecommendation(preset)}</section>
        </div>
      </div>`;
    if (moveFocus) detail.scrollIntoView({behavior:"smooth", block:"nearest"});
  }

  function scrollToCard(index) {
    const target = Math.max(0, Math.min(index, cards.length - 1));
    cards[target].scrollIntoView({behavior:"smooth", block:"nearest", inline:"start"});
    renderDetail(target);
  }

  cards.forEach((card, index) => card.addEventListener("click", event => {
    renderDetail(index, event.target.closest(".build-open") !== null);
  }));
  prev.addEventListener("click", () => scrollToCard(active - 1 < 0 ? presets.length - 1 : active - 1));
  next.addEventListener("click", () => scrollToCard((active + 1) % presets.length));
  viewport.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      scrollToCard(active + (event.key === "ArrowRight" ? 1 : -1));
    }
  });

  let scrollTimer;
  viewport.addEventListener("scroll", () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const viewportLeft = viewport.getBoundingClientRect().left;
      const nearest = cards.reduce((best, card, index) => {
        const distance = Math.abs(card.getBoundingClientRect().left - viewportLeft);
        return distance < best.distance ? {index, distance} : best;
      }, {index:active, distance:Infinity});
      renderDetail(nearest.index);
    }, 80);
  }, {passive:true});

  renderDetail(0);
})();
