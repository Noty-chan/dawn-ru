"use strict";

const D = window.DAWN_DATA;
if (!D || D.schemaVersion !== 2) document.body.innerHTML = "<p style='padding:2rem'>Не удалось загрузить данные правил. Запустите build_data.py.</p>";

const STORAGE_KEY = "dawn-ru-companion-v2";
const LEGACY_KEY = "dawn-heroes";
const APP_SCHEMA = 2;
const ATTRS = [
  ["body", "Тело", "Здоровье, Стойкость и физическая мощь"],
  ["talent", "Талант", "Скорость, движение и трюки"],
  ["spirit", "Дух", "Фокус, магия и интуиция"],
  ["mind", "Разум", "Знания и утилитарные действия"],
];
const RULES = [
  {id:"rule.xd6",kind:"Памятка",name:"Система XD6",text:"Бросьте D6, равные Атрибуту, с учётом Преимущества и Помехи. Результат 4+ — Успех. Каждая 6 — Критический успех: она считается Успехом и добавляет новую кость; новая 6 снова взрывается."},
  {id:"rule.rounding",kind:"Памятка",name:"Округление",text:"Любую дробь всегда округляйте вверх до ближайшего целого числа."},
  {id:"rule.challenge",kind:"Памятка",name:"Бросок испытания",text:"Обычная цель — Ступень + 1 Успехов. Меньше — Провал; цель достигнута — Минимальный успех; удвоенная цель — Крайний успех."},
  {id:"rule.advantage",kind:"Памятка",name:"Преимущество и Помеха",text:"Преимущество добавляет кости, Помеха убирает. В свободной игре можно суммировать применимые Ранги одного Навыка, одной Способности и одной Связи."},
  {id:"rule.all-in",kind:"Памятка",name:"Ва-банк ❂",text:"Потратьте 1 Влияние и перебросьте сделанный бросок: теперь результаты 3+ считаются Успехами."},
  {id:"rule.influence",kind:"Памятка",name:"Влияние",text:"Влияние получают за принятые Риски, в том числе Стресс, и за Раны от источников вне самого персонажа. Оно оплачивает действия Связи и Ва-банк."},
  {id:"rule.wounds",kind:"Памятка",name:"Раны",text:"При 0 Здоровья получите Рану и восстановите Здоровье до Стойкости. Если источник Раны не вы сами, получите 1 Влияние. Когда Раны достигают Стойкости, герой выводится из строя либо ставит Влияние на кон."},
  {id:"rule.tension",kind:"Памятка",name:"Напряжение",text:"Начинается с 0 и общее для боя. Увеличьте на 1 в конце Раунда и каждый раз, когда враг или персонаж игрока выведен из строя."},
  {id:"rule.round",kind:"Памятка",name:"Раунд и ОД",text:"В начале Раунда каждый персонаж игрока получает 3 ОД. ОД тратятся в Ход и на Реакции вне Хода; неиспользованные ОД не переносятся."},
  {id:"rule.focus",kind:"Памятка",name:"Фокус",text:"В начале боя Фокус равен 1 + половина Духа с округлением вверх. Это стартовое значение, а не жёсткий максимум."},
  {id:"rule.techniques",kind:"Памятка",name:"Рост Ступени",text:"При новой Ступени: +1 к двум разным Атрибутам; 2 Уровня Техник или +1 к высшему Атрибуту; 2 Ранга персонажа; 1 Дар; перерасчёт показателей."},
  {id:"rule.specific",kind:"Памятка",name:"Частное важнее общего",text:"Конкретная особенность перекрывает общее правило. Если два конкретных правила конфликтуют, игрок выбирает, какое применить."},
];

const $ = id => document.getElementById(id);
const $$ = selector => [...document.querySelectorAll(selector)];
const esc = value => String(value ?? "").replace(/[&<>"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
const md = value => esc(value).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/`(.+?)`/g,"<code>$1</code>").replace(/\n- /g,"<br>• ").replace(/\n/g,"<br>");
const uid = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const clamp = (n,min,max) => Math.max(min,Math.min(max,Number(n)||0));
const download = (name, content, type="application/json") => { const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); };
let toastTimer;
function toast(message){ const el=$("toast"); el.textContent=message; el.classList.add("on"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("on"),2600); }

function blankHero(){
  return {
    schema:APP_SCHEMA,id:uid(),name:"",player:"",concept:"",tier:1,
    attrs:{body:4,talent:3,spirit:2,mind:2},attrBonus:{body:0,talent:0,spirit:0,mind:0},
    techConversions:0,conversionAttr:"body",primaryOutlook:null,outlooks:[],gifts:[],
    skills:[{id:uid(),name:"",rank:1}],
    ability:{enabled:false,name:"",desc:"",rank:1,words:{verbs:[],nouns:[],conditions:[]},variableCost:0},
    techniques:{},mods:{taintedBody:false,gadgetSpent:0},
    runtime:{hp:null,wounds:0,focus:null,influence:1,stress:0,ap:3,tension:0,notes:"",effects:[],clocks:[],diceHistory:[]}
  };
}

function cleanArray(value){ return Array.isArray(value) ? value.filter(v=>typeof v==="string") : []; }
function normalizeHero(raw){
  const base=blankHero(), h=raw && typeof raw==="object" ? raw : {};
  base.id=typeof h.id==="string"?h.id:base.id;
  for(const key of ["name","player","concept"]) base[key]=typeof h[key]==="string"?h[key].slice(0,500):"";
  base.tier=clamp(h.tier,1,6);
  for(const [key] of ATTRS){ base.attrs[key]=clamp(h.attrs?.[key] ?? base.attrs[key],2,4); base.attrBonus[key]=clamp(h.attrBonus?.[key],0,5); }
  base.techConversions=clamp(h.techConversions,0,5); base.conversionAttr=ATTRS.some(a=>a[0]===h.conversionAttr)?h.conversionAttr:"body";
  base.primaryOutlook=typeof h.primaryOutlook==="string"?h.primaryOutlook:null; base.outlooks=cleanArray(h.outlooks).slice(0,3); base.gifts=cleanArray(h.gifts);
  if(base.primaryOutlook&&!base.outlooks.includes(base.primaryOutlook)) base.outlooks.unshift(base.primaryOutlook);
  base.skills=Array.isArray(h.skills)?h.skills.slice(0,30).map(s=>({id:typeof s.id==="string"?s.id:uid(),name:typeof s.name==="string"?s.name.slice(0,180):"",rank:clamp(s.rank,1,3)})):base.skills;
  const a=h.ability||{}; base.ability={enabled:Boolean(a.enabled),name:typeof a.name==="string"?a.name.slice(0,180):"",desc:typeof a.desc==="string"?a.desc.slice(0,1500):"",rank:clamp(a.rank||1,1,3),words:{verbs:cleanArray(a.words?.verbs),nouns:cleanArray(a.words?.nouns),conditions:cleanArray(a.words?.conditions)},variableCost:clamp(a.variableCost,0,20)};
  base.techniques={}; if(h.techniques&&typeof h.techniques==="object") for(const [id,level] of Object.entries(h.techniques)) base.techniques[id]=clamp(level,0,3);
  base.mods={taintedBody:Boolean(h.mods?.taintedBody),gadgetSpent:clamp(h.mods?.gadgetSpent,0,99)};
  const rt=h.runtime||{}; base.runtime={hp:Number.isFinite(+rt.hp)?+rt.hp:null,wounds:clamp(rt.wounds,0,99),focus:Number.isFinite(+rt.focus)?+rt.focus:null,influence:clamp(rt.influence,0,999),stress:clamp(rt.stress,0,3),ap:clamp(rt.ap??3,0,99),tension:clamp(rt.tension,0,99),notes:typeof rt.notes==="string"?rt.notes.slice(0,10000):"",effects:cleanArray(rt.effects),clocks:Array.isArray(rt.clocks)?rt.clocks.slice(0,30).map(c=>({id:typeof c.id==="string"?c.id:uid(),name:typeof c.name==="string"?c.name.slice(0,120):"Часы",size:[4,6,8].includes(+c.size)?+c.size:6,value:clamp(c.value,0,[4,6,8].includes(+c.size)?+c.size:6)})):[],diceHistory:Array.isArray(rt.diceHistory)?rt.diceHistory.slice(0,20).map(row=>({at:typeof row.at==="string"?row.at.slice(0,20):"",count:clamp(row.count,1,300),successes:clamp(row.successes,0,300),crits:clamp(row.crits,0,300),outcome:typeof row.outcome==="string"?row.outcome.slice(0,80):""})):[]};
  return base;
}

function migrateLegacy(raw){
  const techByName=new Map(D.archetypes.flatMap(a=>a.techniques.map(t=>[t.name,t.id])));
  const outlookByName=new Map(D.outlooks.map(o=>[o.name,o.id]));
  const giftByName=new Map(D.outlooks.flatMap(o=>(o.builtin?[o.builtin]:[]).concat(o.gifts).map(g=>[g.name,g.id])));
  const heroes=(raw?.heroes||[]).map(old=>{
    const h=blankHero(); Object.assign(h,{name:old.name||"",player:old.player||"",concept:old.concept||"",tier:old.tier||1});
    h.attrs=old.attrs||h.attrs; h.attrBonus=old.bonus||old.attrBonus||h.attrBonus;
    const ol=outlookByName.get(old.outlook); if(ol){h.primaryOutlook=ol;h.outlooks=[ol];}
    h.gifts=(old.gifts||[]).map(name=>giftByName.get(name)).filter(Boolean);
    h.skills=(old.skills||[]).map(s=>({id:uid(),name:s.name||"",rank:s.rank||1}));
    h.ability={...h.ability,enabled:Boolean(old.ability?.name||old.ability?.rank),name:old.ability?.name||"",desc:old.ability?.desc||"",rank:clamp(old.ability?.rank||1,1,3)};
    for(const [name,level] of Object.entries(old.techniques||old.techs||{})){const id=techByName.get(name)||name;if(id)h.techniques[id]=level;}
    h.runtime={...h.runtime,...(old.rt||{})}; return normalizeHero(h);
  });
  return {schema:APP_SCHEMA,current:clamp(raw?.current,0,Math.max(0,heroes.length-1)),mode:raw?.mode||"build",theme:"dark",heroes:heroes.length?heroes:[blankHero()]};
}

function loadStore(){
  try{const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");if(parsed?.schema===APP_SCHEMA&&Array.isArray(parsed.heroes))return {...parsed,heroes:parsed.heroes.map(normalizeHero)};}catch(e){console.warn(e)}
  try{const legacy=JSON.parse(localStorage.getItem(LEGACY_KEY)||"null");if(legacy){const migrated=migrateLegacy(legacy);localStorage.setItem(STORAGE_KEY,JSON.stringify(migrated));return migrated;}}catch(e){console.warn(e)}
  return {schema:APP_SCHEMA,current:0,mode:"build",theme:"dark",heroes:[blankHero()]};
}
let store=loadStore(); let S=store.heroes[store.current]||store.heroes[0]; let activeArch=D.archetypes[0]?.id; let refKind="all";
function persist(){ store.heroes[store.current]=S; try{localStorage.setItem(STORAGE_KEY,JSON.stringify(store));}catch(e){toast("Не удалось сохранить: хранилище браузера заполнено");} }

const allGifts=()=>D.outlooks.flatMap(o=>(o.builtin?[o.builtin]:[]).concat(o.gifts));
const giftById=id=>allGifts().find(g=>g.id===id);
const hasGift=(enOrName)=>allGifts().some(g=>S.gifts.includes(g.id)&&(g.en===enOrName||g.name===enOrName));
const outlookById=id=>D.outlooks.find(o=>o.id===id);
const techById=id=>D.archetypes.flatMap(a=>a.techniques).find(t=>t.id===id);
const wordById=id=>{const known=Object.values(D.abilityWords).flat().find(w=>w.id===id);if(known)return known;if(typeof id==="string"&&id.startsWith("custom:")){const [,group,...parts]=id.split(":");return{id,name:decodeURIComponent(parts.join(":")),cost:0,costLabel:"своё",marks:"",group}}};
function attrValue(key,includeConversion=true){return S.attrs[key]+S.attrBonus[key]+(includeConversion&&S.conversionAttr===key?S.techConversions:0)}
function derived(){return {hp:attrValue("body")*2+S.tier*2,guts:1+attrValue("body"),speed:2+Math.ceil(attrValue("talent")/2),focus:1+Math.ceil(attrValue("spirit")/2)}}
function ensureRuntime(){const d=derived();if(S.runtime.hp===null)S.runtime.hp=d.hp;if(S.runtime.focus===null)S.runtime.focus=d.focus;}

function abilityCost(){
  if(!S.ability.enabled)return 0;
  const ids=Object.values(S.ability.words).flat(); let variable=false;
  let words=ids.reduce((sum,id)=>{const w=wordById(id);if(!w)return sum;if(w.cost===null){variable=true;return sum;}return sum+w.cost;},0);
  if(variable)words+=S.ability.variableCost;
  return Math.max(1,words)+(S.ability.rank-1);
}
function budgets(){
  const t=S.tier, skillSpent=S.skills.reduce((n,s)=>n+s.rank,0), aCost=abilityCost();
  let rankPool=8+2*(t-1),skillMin=4;
  if(hasGift("Past Your Prime")){rankPool=12+(t-1);skillMin=8;}
  if(hasGift("Amazing Potential")){rankPool=6+3*(t-1);skillMin=2;}
  if(hasGift("Supernatural Deafness"))rankPool+=3;
  let abilityExtra=(hasGift("Dark Urge")?4:0)+(hasGift("Uncontrollable Power")?4:0)+(hasGift("Tainted Body")&&S.mods.taintedBody?3+t:0);
  const rankSpent=skillSpent+Math.max(0,aCost-abilityExtra);
  const giftPool=t+1,giftSpent=S.gifts.length;
  const techPool=5+2*(t-1)-2*S.techConversions,techSpent=Object.values(S.techniques).reduce((n,v)=>n+v,0);
  const archUsed=D.archetypes.filter(a=>a.techniques.some(tech=>(S.techniques[tech.id]||0)>0)).length;
  const attrPool=2*(t-1),attrSpent=Object.values(S.attrBonus).reduce((n,v)=>n+v,0);
  return {skillSpent,aCost,rankPool,rankSpent,skillMin,abilityExtra,giftPool,giftSpent,techPool,techSpent,archUsed,attrPool,attrSpent,gadgetPool:hasGift("Gearhead")?3:0};
}
function issues(){
  const b=budgets(),t=S.tier,problems=[]; const bases=Object.values(S.attrs).sort().join(",");
  if(bases!=="2,2,3,4")problems.push(["bad","Стартовые Атрибуты должны образовывать набор 4 / 3 / 2 / 2."]);
  if(b.attrSpent!==b.attrPool)problems.push(["",`Распределите ровно ${b.attrPool} бонусов Атрибутов за Ступени (сейчас ${b.attrSpent}).`]);
  if(Object.values(S.attrBonus).some(v=>v>t-1))problems.push(["bad","Один Атрибут не может получать оба обычных бонуса одной Ступени."]);
  const highest=Math.max(...ATTRS.map(([k])=>attrValue(k,false)));if(S.techConversions&&attrValue(S.conversionAttr,false)<highest)problems.push(["bad","Обмен Уровней должен повышать один из текущих высших Атрибутов."]);
  if(!S.primaryOutlook)problems.push(["","Выберите Основное Мировоззрение."]);
  if(S.outlooks.length>Math.min(3,t))problems.push(["bad",`На ${t}-й Ступени доступно не более ${Math.min(3,t)} Мировоззрений.`]);
  if(b.giftSpent>b.giftPool)problems.push(["bad","Перерасход Даров."]);
  if(b.skillSpent<b.skillMin)problems.push(["bad",`В Навыки нужно вложить минимум ${b.skillMin} Рангов.`]);
  if(b.rankSpent>b.rankPool)problems.push(["bad","Перерасход Рангов персонажа."]);
  if(S.skills.some(s=>!s.name.trim()))problems.push(["","У одного из Навыков нет названия."]);
  if(S.ability.enabled&&(!S.ability.words.verbs.length||!S.ability.words.nouns.length))problems.push(["","Для формулы Способности выберите хотя бы Глагол и Существительное."]);
  if(hasGift("Supernatural Deafness")&&S.ability.enabled)problems.push(["bad","«Глухота к сверхъестественному» запрещает Способность."]);
  if(hasGift("Past Your Prime")&&hasGift("Amazing Potential"))problems.push(["bad","«Лучшие годы позади» и «Невероятный потенциал» задают несовместимые стартовые бюджеты."]);
  if(b.techSpent>b.techPool)problems.push(["bad","Перерасход Уровней Техник."]);
  if(b.archUsed>3)problems.push(["bad","Техники взяты более чем из трёх Архетипов."]);
  return problems;
}

function budgetRow(label,spent,total){const pct=total?Math.min(100,spent/total*100):0;return `<div class="budget-row ${spent>total?"over":""}"><span>${esc(label)}</span><strong>${spent}/${total}</strong><span class="bar"><i style="--pct:${pct}%"></i></span></div>`}
function renderSidebar(){
  const d=derived(),b=budgets(); ensureRuntime();
  $("derived").innerHTML=[["Здоровье",d.hp],["Стойкость",d.guts],["Скорость",d.speed],["Фокус",d.focus]].map(([n,v])=>`<div class="derived"><span>${n}</span><strong>${v}</strong></div>`).join("");
  $("budgets").innerHTML=budgetRow("Атрибуты",b.attrSpent,b.attrPool)+budgetRow("Дары",b.giftSpent,b.giftPool)+budgetRow("Ранги",b.rankSpent,b.rankPool)+budgetRow("Техники",b.techSpent,b.techPool);
  const list=issues();$("warnings").innerHTML=list.map(([kind,text])=>`<div class="warning ${kind}">${esc(text)}</div>`).join("")||`<div class="warning" style="border-color:var(--good)">Сборка согласована с базовыми бюджетами.</div>`;
  const completed=[S.name.trim(),Object.values(S.attrs).sort().join(",")==="2,2,3,4",S.primaryOutlook,b.giftSpent===b.giftPool,b.skillSpent>=b.skillMin,b.rankSpent<=b.rankPool,b.techSpent===b.techPool].filter(Boolean).length;
  $("build-progress").textContent=`${completed}/7 ключевых шагов · ${list.filter(i=>i[0]==="bad").length?"нужна проверка":"механика сходится"}`;
}
function renderHeroSelect(){
  $("hero-select").innerHTML=store.heroes.map((h,i)=>`<option value="${i}" ${i===store.current?"selected":""}>${esc(h.name||"Безымянный")} · Ст.${h.tier}</option>`).join("");
}
function renderProfile(){for(const key of ["name","player","concept"])$("f-"+key).value=S[key];$("f-tier").value=S.tier;}
function renderAttrs(){
  const maxBonus=S.tier-1;
  $("attrs").innerHTML=ATTRS.map(([key,name,desc])=>`<div class="attribute"><span class="score">${attrValue(key)}</span><h3>${name}</h3><p>${desc}</p><div class="attr-controls"><label>База<select data-attr-base="${key}">${[2,3,4].map(v=>`<option ${S.attrs[key]===v?"selected":""}>${v}</option>`).join("")}</select></label><label>Рост<select data-attr-bonus="${key}">${Array.from({length:maxBonus+1},(_,v)=>`<option ${S.attrBonus[key]===v?"selected":""}>+${v}</option>`).join("")}</select></label></div></div>`).join("");
  $("tech-conversions").innerHTML=Array.from({length:S.tier},(_,v)=>`<option value="${v}" ${S.techConversions===v?"selected":""}>${v} (${v*2} Ур.)</option>`).join("");
  $("conversion-attr").innerHTML=ATTRS.map(([k,n])=>`<option value="${k}" ${S.conversionAttr===k?"selected":""}>${n}</option>`).join("");
}
function renderOutlooks(){
  $("outlook-description")?.remove();
  $("outlooks").innerHTML=D.outlooks.map(o=>{const selected=S.outlooks.includes(o.id),primary=S.primaryOutlook===o.id;return `<button type="button" class="choice ${selected?"selected":""} ${primary?"primary-choice":""}" data-outlook="${o.id}" aria-pressed="${selected}"><strong>${esc(o.name)}</strong><small>${esc(o.category)}</small></button>`}).join("");
  const selected=D.outlooks.filter(o=>S.outlooks.includes(o.id));
  const open=D.outlooks.find(o=>o.id===S.primaryOutlook)||selected[0];
  $("outlooks").insertAdjacentHTML("afterend",`<div id="outlook-description" class="outlook-description" ${open?"":"hidden"}>${open?`<strong>${esc(open.name)}</strong><p>${md(open.desc)}</p><small>Действия Связи: ${esc(open.bondActions||"—")}</small>`:""}</div>`);
  $("gifts").innerHTML=selected.flatMap(o=>o.gifts.map(g=>`<article class="catalog-card gift-card ${S.gifts.includes(g.id)?"selected":""}"><button type="button" data-gift="${g.id}" aria-pressed="${S.gifts.includes(g.id)}"><header><h3>${esc(g.name)}</h3><span class="meta">${esc(o.name)}</span></header><p>${md(g.text)}</p></button></article>`)).join("")||`<p class="autosave">Сначала выберите Мировоззрение.</p>`;
}
function wordOptions(group){return `<option value="">Выберите слово…</option>`+D.abilityWords[group].map(w=>`<option value="${w.id}">${esc(w.name)} · ${esc(w.costLabel)}${w.marks?" "+esc(w.marks):""}</option>`).join("")}
function renderSkillsAbility(){
  $("skills").innerHTML=S.skills.map(s=>`<div class="skill-row"><label>Навык<input data-skill-name="${s.id}" value="${esc(s.name)}" placeholder="Паркур по крышам"></label><label>Ранг<select class="rank-select" data-skill-rank="${s.id}">${[1,2,3].map(v=>`<option ${s.rank===v?"selected":""}>${v}</option>`).join("")}</select></label><button type="button" class="remove" data-skill-remove="${s.id}" aria-label="Удалить Навык">×</button></div>`).join("");
  $("ability-enabled").checked=S.ability.enabled;
  const groups=[["verbs","Глаголы"],["nouns","Существительные"],["conditions","Условия"]];
  const selectedWords=group=>S.ability.words[group].map(id=>{const w=wordById(id);return w?`<span class="word">${esc(w.name)} <small>${esc(w.costLabel)}</small><button type="button" data-word-remove="${id}" data-word-group="${group}" aria-label="Убрать ${esc(w.name)}">×</button></span>`:""}).join("");
  $("ability-builder").innerHTML=`<div class="ability-grid" ${S.ability.enabled?"":"hidden"}><label>Название<input id="ability-name" value="${esc(S.ability.name)}" placeholder="Повелитель теней"></label>${groups.map(([group,label])=>`<div class="word-picker"><label for="word-${group}">${label}</label><div class="word-group"><select id="word-${group}" data-word-select="${group}">${wordOptions(group)}</select><button type="button" data-word-add="${group}">Добавить выбранное</button></div><div class="custom-word"><input id="custom-${group}" maxlength="80" placeholder="Своё слово"><button type="button" data-custom-word-add="${group}">Добавить своё</button></div><div class="selected-words">${selectedWords(group)}</div></div>`).join("")}<div class="field-grid three"><label>Ранг<select id="ability-rank">${[1,2,3].map(v=>`<option ${S.ability.rank===v?"selected":""}>${v}</option>`).join("")}</select></label><label>Стоимость X<input id="ability-variable" type="number" min="0" max="20" value="${S.ability.variableCost}"></label><label>Итоговая цена<input value="${abilityCost()}" disabled></label></div><label>Пояснение<textarea id="ability-desc" rows="3" placeholder="Границы и эстетика Способности">${esc(S.ability.desc)}</textarea></label><div class="formula">${abilityFormula()}</div></div>`;
  const b=budgets();$("rank-modifiers").innerHTML=`Основной бюджет: <strong>${b.rankPool}</strong>. На Способность отдельно доступно: <strong>${b.abilityExtra}</strong>. ${b.gadgetPool?`«Технарь» даёт ещё ${b.gadgetPool} Ранга только на гаджеты.`:""}${hasGift("Tainted Body")?`<br><label class="switch"><input id="tainted-toggle" type="checkbox" ${S.mods.taintedBody?"checked":""}><span>Применить разовый резерв «Порченого тела» (${3+S.tier})</span></label>`:""}`;
}
function abilityFormula(){if(!S.ability.enabled)return "Способность не выбрана.";const first=g=>(wordById(S.ability.words[g][0])?.name||`[${g==="verbs"?"Глагол":g==="nouns"?"Существительное":"Условие"}]`);const noCondition=S.ability.words.verbs.concat(S.ability.words.nouns).some(id=>wordById(id)?.marks.includes("✢"));const verb=first("verbs"),noun=first("nouns"),condition=first("conditions");return `${hasGift("Uncontrollable Power")?"Вы":"Вы можете"} ${verb.toLowerCase()} ${noun.toLowerCase()}${noCondition?".":hasGift("Uncontrollable Power")?`, когда ${condition.toLowerCase()}.`:` пока ${condition.toLowerCase()}.`}`;}

function renderTechniques(){
  $("arch-tabs").innerHTML=D.archetypes.map(a=>`<button type="button" class="${activeArch===a.id?"on":""}" data-arch="${a.id}">${esc(a.name)}</button>`).join("");
  const arch=D.archetypes.find(a=>a.id===activeArch)||D.archetypes[0],q=$("tech-search").value.trim().toLowerCase();
  $("tech-list").innerHTML=arch.techniques.filter(t=>!q||`${t.name} ${t.en} ${t.tags} ${t.flavor} ${t.levels.map(l=>l.text).join(" ")}`.toLowerCase().includes(q)).map(t=>{const level=S.techniques[t.id]||0;return `<article class="catalog-card ${level?"selected":""}"><header><div><h3>${esc(t.name)} <small>${"★".repeat(t.stars)}</small></h3><div class="meta">${esc(t.tags)}</div></div><div class="pips"><button type="button" class="pip ${level>=1?"on":""}" data-tech="${t.id}" data-level="1">1</button><button type="button" class="pip ${level>=2?"on":""}" data-tech="${t.id}" data-level="2">2</button><button type="button" class="pip ${level>=3?"on":""}" data-tech="${t.id}" data-level="3">3</button></div></header><p>${md(t.flavor)}</p><div class="tech-levels">${t.levels.map(l=>`<div class="tech-level ${level<l.n?"locked":""}"><strong>${l.n}: ${esc(l.name)}</strong><br>${md(l.text)}</div>`).join("")}</div></article>`}).join("")||`<p>Ничего не найдено.</p>`;
}
function selectedOutlookGifts(){return D.outlooks.filter(o=>S.outlooks.includes(o.id)).map(o=>({outlook:o,gifts:(o.builtin&&o.id===S.primaryOutlook?[o.builtin]:[]).concat(o.gifts.filter(g=>S.gifts.includes(g.id)))}));}
function renderSheet(){
  const d=derived(); const techs=Object.entries(S.techniques).filter(([,v])=>v>0).map(([id,level])=>({tech:techById(id),level})).filter(x=>x.tech);
  $("sheet").innerHTML=`<header><h2>${esc(S.name||"Безымянный герой")}</h2><div class="sheet-sub">${esc(S.concept||"Концепция не записана")}${S.player?` · игрок: ${esc(S.player)}`:""} · Ступень ${S.tier}</div></header><div class="sheet-stats">${[["Здоровье",d.hp],["Стойкость",d.guts],["Скорость",d.speed],["Фокус",d.focus]].map(([n,v])=>`<div class="sheet-stat"><span>${n}</span><strong>${v}</strong></div>`).join("")}</div><div class="sheet-columns"><section class="sheet-block"><h3>Атрибуты</h3><p>${ATTRS.map(([k,n])=>`${n} ${attrValue(k)}`).join(" · ")}</p></section><section class="sheet-block"><h3>Мировоззрения и Дары</h3>${selectedOutlookGifts().map(({outlook,gifts})=>`<h4>${esc(outlook.name)}${outlook.id===S.primaryOutlook?" · Основное":""}</h4><ul>${gifts.map(g=>`<li><strong>${esc(g.name)}</strong> — ${md(g.text)}</li>`).join("")||"<li>—</li>"}</ul>`).join("")||"<p>—</p>"}</section><section class="sheet-block"><h3>Навыки</h3><ul>${S.skills.filter(s=>s.name.trim()).map(s=>`<li>${esc(s.name)} · Ранг ${s.rank}</li>`).join("")||"<li>—</li>"}</ul>${S.ability.enabled?`<h3>Способность · Ранг ${S.ability.rank}</h3><p><strong>${esc(S.ability.name||abilityFormula())}</strong><br>${esc(abilityFormula())}<br>${md(S.ability.desc)}</p>`:""}</section><section class="sheet-block"><h3>Техники</h3>${techs.map(({tech,level})=>`<h4>${esc(tech.name)} · Уровень ${level}</h4>${tech.levels.slice(0,level).map(l=>`<p><strong>${l.n}: ${esc(l.name)}</strong> — ${md(l.text)}</p>`).join("")}`).join("")||"<p>—</p>"}</section></div>`;
}

function counter(key,label,value,max=null){return `<article class="counter"><header><span>${label}</span><span>${max===null?"":`макс. ${max}`}</span></header><input type="number" data-counter-input="${key}" value="${value}" min="0" ${max!==null?`max="${max}"`:""}><div class="counter-controls"><button type="button" data-counter="${key}" data-delta="-1">−</button><button type="button" data-counter="${key}" data-delta="1">+</button></div></article>`}
function renderPlay(){
  ensureRuntime();const d=derived(),rt=S.runtime;
  $("ko-banner").innerHTML=rt.wounds>=d.guts?`<div class="ko"><strong>Раны догнали Стойкость.</strong> Герой выводится из строя: снимите одну Рану и увеличьте Напряжение — либо поставьте Влияние на кон и вернитесь с 2 Стресса и Здоровьем, равным Стойкости.<div class="button-row"><button type="button" id="ko-yield">Выведен из строя</button><button type="button" id="ko-stake">Поставить на кон</button></div></div>`:"";
  $("play-counters").innerHTML=counter("hp","Здоровье",rt.hp,d.hp)+counter("wounds","Раны",rt.wounds,d.guts)+counter("focus","Фокус",rt.focus)+counter("ap","ОД",rt.ap)+counter("influence","Влияние",rt.influence)+counter("stress","Стресс",rt.stress,3)+counter("tension","Напряжение",rt.tension);
  const techs=Object.entries(S.techniques).filter(([,v])=>v>0).map(([id,level])=>({tech:techById(id),level})).filter(x=>x.tech);
  $("play-kit").innerHTML=`<h3>${esc(S.name||"Безымянный")} · Ступень ${S.tier}</h3>${selectedOutlookGifts().flatMap(x=>x.gifts).map(g=>`<div class="kit-item"><strong>${esc(g.name)}</strong><p>${md(g.text)}</p></div>`).join("")}${S.ability.enabled?`<div class="kit-item"><strong>${esc(S.ability.name||"Способность")} · Ранг ${S.ability.rank}</strong><p>${esc(abilityFormula())}<br>${md(S.ability.desc)}</p></div>`:""}${techs.map(({tech,level})=>`<div class="kit-item"><strong>${esc(tech.name)} · ${level}</strong>${tech.levels.slice(0,level).map(l=>`<p><b>${l.n}: ${esc(l.name)}</b> — ${md(l.text)}</p>`).join("")}</div>`).join("")}`;
  $("scene-notes").value=rt.notes;
  $("effect-tracker").innerHTML=`<div class="effect-groups">${[["Положительные",D.effects.positive],["Отрицательные",D.effects.negative]].map(([name,list])=>`<div><h4>${name}</h4><div class="chip-row">${list.map(e=>`<button type="button" class="effect-chip ${rt.effects.includes(e.id)?"on":""}" data-effect="${e.id}" title="${esc(e.text)}">${esc(e.name)}</button>`).join("")}</div></div>`).join("")}</div>`;
  $("ko-yield")?.addEventListener("click",()=>{rt.wounds=Math.max(0,rt.wounds-1);rt.tension++;persist();renderPlay();});
  $("ko-stake")?.addEventListener("click",()=>{rt.stress=2;rt.hp=d.guts;rt.wounds=Math.max(0,rt.wounds-1);persist();renderPlay();});
}

function rollDice(){
  const base=clamp($("dice-count").value,1,40),adv=clamp($("dice-adv").value,0,30),dis=clamp($("dice-dis").value,0,30),count=Math.max(1,base+adv-dis),threshold=$("all-in").checked?3:4;
  const rolls=[];let pending=count,guard=0;while(pending>0&&guard<300){pending--;guard++;const value=1+Math.floor(Math.random()*6);rolls.push(value);if(value===6)pending++;}
  const successes=rolls.filter(v=>v>=threshold).length,crits=rolls.filter(v=>v===6).length,target=S.tier+1,outcome=successes>=target*2?"Крайний успех":successes>=target?"Минимальный успех":"Провал";
  $("dice-result").innerHTML=`<div class="dice">${rolls.map(v=>`<span class="die ${v===6?"crit":v>=threshold?"success":""}">${v}</span>`).join("")}</div><strong>${successes} Успехов · ${crits} Критов · ${outcome}</strong><div class="autosave">Брошено ${count} базовых костей; цель Ступени ${S.tier}: ${target} / ${target*2}.</div>`;
  S.runtime.diceHistory.unshift({at:new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}),count,successes,crits,outcome});S.runtime.diceHistory=S.runtime.diceHistory.slice(0,20);persist();renderDiceHistory();
}
function renderDiceHistory(){$("dice-history").innerHTML=S.runtime.diceHistory.map(h=>`<li>${esc(h.at)} · ${esc(h.count)}D6 → ${esc(h.successes)} успех., ${esc(h.crits)} крит. · ${esc(h.outcome)}</li>`).join("")}
function renderClocks(){
  $("clocks").innerHTML=S.runtime.clocks.map(c=>`<article class="clock"><div class="clock-head"><input data-clock-name="${c.id}" value="${esc(c.name)}"><button type="button" class="remove" data-clock-remove="${c.id}">×</button></div><div class="segments">${Array.from({length:c.size},(_,i)=>`<button type="button" class="segment ${i<c.value?"on":""}" data-clock="${c.id}" data-value="${i+1}" aria-label="${i+1} из ${c.size}"></button>`).join("")}</div></article>`).join("")||`<p class="autosave">Добавьте часы угрозы, ритуала или погони.</p>`;
}

function referenceItems(){
  const items=[...RULES,...D.actions.list.map(x=>({...x,kind:"Действие"})),...D.effects.positive.map(x=>({...x,kind:"Положительный эффект"})),...D.effects.negative.map(x=>({...x,kind:"Отрицательный эффект"})),...D.archetypes.flatMap(a=>a.techniques.map(t=>({...t,kind:`Техника · ${a.name}`,text:[t.flavor,...t.levels.map(l=>`${l.n}: ${l.name} — ${l.text}`)].join("\n")}))),...D.outlooks.flatMap(o=>(o.builtin?[o.builtin]:[]).concat(o.gifts).map(g=>({...g,kind:`Дар · ${o.name}`})))];
  return items;
}
function renderReference(){
  const q=$("ref-search").value.trim().toLowerCase(),filters=["all","Памятка","Действие","Эффект","Техника","Дар"];
  $("ref-filters").innerHTML=filters.map(f=>`<button type="button" class="${refKind===f?"on":""}" data-ref-kind="${f}">${f==="all"?"Всё":f}</button>`).join("");
  const matchKind=item=>refKind==="all"||item.kind.toLowerCase().includes(refKind.toLowerCase()); const list=referenceItems().filter(item=>matchKind(item)&&(!q||`${item.name} ${item.en||""} ${item.kind} ${item.text||""} ${item.tags||""}`.toLowerCase().includes(q)));
  $("reference-list").innerHTML=list.slice(0,250).map(item=>`<article class="catalog-card"><span class="kind">${esc(item.kind)}</span><h3>${esc(item.name)}${item.cost?` · ${esc(item.cost)}`:""}</h3>${item.tags?`<div class="meta">${esc(item.tags)}</div>`:""}<p>${md(item.text||"")}</p></article>`).join("")||`<p>Ничего не найдено.</p>`;
}

function renderAll(){renderHeroSelect();renderProfile();renderAttrs();renderOutlooks();renderSkillsAbility();renderTechniques();renderSheet();renderSidebar();if(store.mode==="play")renderPlay();if(store.mode==="tools"){renderDiceHistory();renderClocks();}if(store.mode==="reference")renderReference();persist();}
function setMode(mode){store.mode=["build","play","tools","reference"].includes(mode)?mode:"build";$$('[data-page]').forEach(p=>p.classList.toggle("active",p.dataset.page===store.mode));$$('[data-mode]').forEach(b=>b.setAttribute("aria-current",b.dataset.mode===store.mode?"page":"false"));if(store.mode==="play")renderPlay();if(store.mode==="tools"){renderDiceHistory();renderClocks();}if(store.mode==="reference")renderReference();persist();window.scrollTo({top:0,behavior:"smooth"});}

$$('[data-mode]').forEach(button=>button.addEventListener("click",()=>setMode(button.dataset.mode)));
$("theme-toggle").onclick=()=>{store.theme=store.theme==="light"?"dark":"light";document.documentElement.classList.toggle("light",store.theme==="light");persist();};
for(const key of ["name","player","concept"])$("f-"+key).addEventListener("input",event=>{S[key]=event.target.value;renderHeroSelect();renderSheet();renderSidebar();persist();});
$("f-tier").onchange=event=>{S.tier=+event.target.value;S.techConversions=Math.min(S.techConversions,S.tier-1);for(const [k]of ATTRS)S.attrBonus[k]=Math.min(S.attrBonus[k],S.tier-1);renderAll();};
$("attrs").addEventListener("change",event=>{if(event.target.dataset.attrBase)S.attrs[event.target.dataset.attrBase]=+event.target.value;if(event.target.dataset.attrBonus)S.attrBonus[event.target.dataset.attrBonus]=+event.target.value;renderAttrs();renderSheet();renderSidebar();persist();});
$("tech-conversions").onchange=e=>{S.techConversions=+e.target.value;renderAll();};$("conversion-attr").onchange=e=>{S.conversionAttr=e.target.value;renderAll();};
$("outlooks").addEventListener("click",event=>{const b=event.target.closest("[data-outlook]");if(!b)return;const id=b.dataset.outlook;if(!S.outlooks.includes(id)){const maximum=Math.min(3,S.tier);if(S.outlooks.length>=maximum){if(S.tier===1){S.outlooks=[id];S.primaryOutlook=id;S.gifts=[];}else return toast(`На ${S.tier}-й Ступени доступно Мировоззрений: ${maximum}`);}else{S.outlooks.push(id);if(!S.primaryOutlook)S.primaryOutlook=id;}}else if(S.primaryOutlook!==id){S.primaryOutlook=id;}else{S.outlooks=S.outlooks.filter(x=>x!==id);S.primaryOutlook=S.outlooks[0]||null;const allowed=new Set(D.outlooks.filter(o=>S.outlooks.includes(o.id)).flatMap(o=>o.gifts.map(g=>g.id)));S.gifts=S.gifts.filter(g=>allowed.has(g));}renderAll();});
$("gifts").addEventListener("click",event=>{const b=event.target.closest("[data-gift]");if(!b)return;const id=b.dataset.gift;S.gifts=S.gifts.includes(id)?S.gifts.filter(x=>x!==id):S.gifts.concat(id);renderAll();});
$("skill-add").onclick=()=>{S.skills.push({id:uid(),name:"",rank:1});renderSkillsAbility();renderSidebar();persist();};
$("skills").addEventListener("input",event=>{const id=event.target.dataset.skillName;if(id){const skill=S.skills.find(s=>s.id===id);if(skill)skill.name=event.target.value;renderSheet();renderSidebar();persist();}});
$("skills").addEventListener("change",event=>{const id=event.target.dataset.skillRank;if(id){const skill=S.skills.find(s=>s.id===id);if(skill)skill.rank=+event.target.value;renderSheet();renderSidebar();persist();}});
$("skills").addEventListener("click",event=>{const id=event.target.dataset.skillRemove;if(id){S.skills=S.skills.filter(s=>s.id!==id);renderAll();}});
$("ability-enabled").onchange=e=>{S.ability.enabled=e.target.checked;renderAll();};
function addAbilityWord(group,id){if(id&&!S.ability.words[group].includes(id))S.ability.words[group].push(id);renderAll()}
$("ability-builder").addEventListener("click",event=>{const add=event.target.dataset.wordAdd;if(add){addAbilityWord(add,$("word-"+add).value);return;}const custom=event.target.dataset.customWordAdd;if(custom){const name=$("custom-"+custom).value.trim();if(name)addAbilityWord(custom,`custom:${custom}:${encodeURIComponent(name)}`);return;}const remove=event.target.dataset.wordRemove,group=event.target.dataset.wordGroup;if(remove&&group){S.ability.words[group]=S.ability.words[group].filter(id=>id!==remove);renderAll();}});
$("ability-builder").addEventListener("input",event=>{if(event.target.id==="ability-name")S.ability.name=event.target.value;if(event.target.id==="ability-desc")S.ability.desc=event.target.value;if(event.target.id==="ability-variable")S.ability.variableCost=+event.target.value;renderSheet();renderSidebar();persist();});
$("ability-builder").addEventListener("change",event=>{const group=event.target.dataset.wordSelect;if(group&&event.target.value){addAbilityWord(group,event.target.value);return;}if(event.target.id==="ability-rank")S.ability.rank=+event.target.value;renderAll();});
$("rank-modifiers").addEventListener("change",event=>{if(event.target.id==="tainted-toggle"){S.mods.taintedBody=event.target.checked;renderAll();}});
$("arch-tabs").addEventListener("click",event=>{const b=event.target.closest("[data-arch]");if(b){activeArch=b.dataset.arch;renderTechniques();}});$("tech-search").addEventListener("input",renderTechniques);
$("tech-list").addEventListener("click",event=>{const b=event.target.closest("[data-tech]");if(!b)return;const id=b.dataset.tech,level=+b.dataset.level;S.techniques[id]=(S.techniques[id]||0)===level?level-1:level;if(!S.techniques[id])delete S.techniques[id];renderAll();});
$("hero-select").onchange=e=>{store.heroes[store.current]=S;store.current=+e.target.value;S=normalizeHero(store.heroes[store.current]);renderAll();};
$("hero-new").onclick=()=>{store.heroes.push(blankHero());store.current=store.heroes.length-1;S=store.heroes[store.current];renderAll();};
$("hero-copy").onclick=()=>{const copy=normalizeHero(JSON.parse(JSON.stringify(S)));copy.id=uid();copy.name=(copy.name||"Безымянный")+" · копия";store.heroes.push(copy);store.current=store.heroes.length-1;S=copy;renderAll();};
$("hero-delete").onclick=()=>{if(store.heroes.length===1)return toast("Нельзя удалить единственного героя");if(!confirm(`Удалить «${S.name||"Безымянный"}»?`))return;store.heroes.splice(store.current,1);store.current=Math.max(0,store.current-1);S=store.heroes[store.current];renderAll();};
$("export-hero").onclick=()=>download(`DAWN-${(S.name||"hero").replace(/[^a-zа-я0-9_-]+/gi,"-")}.json`,JSON.stringify({format:"dawn-ru-hero",schema:APP_SCHEMA,hero:S},null,2));
$("import-hero").onchange=async event=>{const file=event.target.files[0];event.target.value="";if(!file)return;if(file.size>2_000_000)return toast("Файл слишком велик");try{const data=JSON.parse(await file.text());const raw=data?.format==="dawn-ru-hero"?data.hero:data;if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error();const hero=normalizeHero(raw);hero.id=uid();store.heroes.push(hero);store.current=store.heroes.length-1;S=hero;renderAll();toast("Герой импортирован");}catch{toast("Это не поддерживаемый JSON героя");}};
$("print-sheet").onclick=()=>window.print();

$("play-counters").addEventListener("click",event=>{const b=event.target.closest("[data-counter]");if(!b)return;const key=b.dataset.counter;S.runtime[key]=Math.max(0,(+S.runtime[key]||0)+(+b.dataset.delta));if(key==="stress")S.runtime[key]=Math.min(3,S.runtime[key]);persist();renderPlay();});
$("play-counters").addEventListener("change",event=>{const key=event.target.dataset.counterInput;if(key){S.runtime[key]=Math.max(0,+event.target.value||0);if(key==="stress")S.runtime[key]=Math.min(3,S.runtime[key]);persist();renderPlay();}});
$("new-round").onclick=()=>{S.runtime.ap=3;S.runtime.tension++;persist();renderPlay();toast("Раунд завершён: Напряжение +1, ОД восстановлены")};
$("new-scene").onclick=()=>{const d=derived();S.runtime.hp=d.hp;S.runtime.focus=d.focus;S.runtime.ap=3;S.runtime.tension=0;S.runtime.effects=[];persist();renderPlay();};
function takeWound(external){const d=derived();S.runtime.wounds++;S.runtime.hp=d.guts;if(external)S.runtime.influence++;persist();renderPlay();}
$("wound-external").onclick=()=>takeWound(true);$("wound-self").onclick=()=>takeWound(false);$("intermission").onclick=()=>{S.runtime.wounds=0;S.runtime.stress=0;persist();renderPlay();};
$("scene-notes").addEventListener("input",e=>{S.runtime.notes=e.target.value;persist();});
$("effect-tracker").addEventListener("click",event=>{const b=event.target.closest("[data-effect]");if(!b)return;const id=b.dataset.effect;S.runtime.effects=S.runtime.effects.includes(id)?S.runtime.effects.filter(x=>x!==id):S.runtime.effects.concat(id);persist();renderPlay();});
$("focus-mode").onclick=()=>document.body.classList.toggle("focus-mode");

$("roll-dice").onclick=rollDice;$("clock-add").onclick=()=>{S.runtime.clocks.push({id:uid(),name:"Новые часы",size:6,value:0});persist();renderClocks();};
$("clocks").addEventListener("click",event=>{const remove=event.target.dataset.clockRemove;if(remove){S.runtime.clocks=S.runtime.clocks.filter(c=>c.id!==remove);persist();renderClocks();return;}const id=event.target.dataset.clock;if(id){const c=S.runtime.clocks.find(c=>c.id===id);const v=+event.target.dataset.value;c.value=c.value===v?v-1:v;persist();renderClocks();}});
$("clocks").addEventListener("input",event=>{const id=event.target.dataset.clockName;if(id){const c=S.runtime.clocks.find(c=>c.id===id);if(c)c.name=event.target.value;persist();}});
$("ref-search").addEventListener("input",renderReference);$("ref-filters").addEventListener("click",event=>{const b=event.target.closest("[data-ref-kind]");if(b){refKind=b.dataset.refKind;renderReference();}});

document.documentElement.classList.toggle("light",store.theme==="light");setMode(store.mode||"build");renderAll();
if(location.protocol.startsWith("http")&&"serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
