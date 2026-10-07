"use strict";

// Presentation only: original controls stay inside their original event roots.
(function(global){
  const definitions=[['history','tools-feed','dice-history','tools.feed.title','Лента бросков','.roll-feed-card'],['clocks','tools-clocks','clocks','tools.clocks.title','Часы сцены','.clock'],['bonds','tools-bonds','freeplay-bonds','tools.bonds.title','Связи персонажа','.freeplay-bond-card'],['stress','tools-stress','stress-trackers','tools.stress.title','Стресс героев','.stress-card']];
  const state={active:'history',views:new Map(),opened:new Set()};
  const text=(key,fallback,args={})=>typeof global.DAWN_I18N?.t==='function'?global.DAWN_I18N.t(key,args,{fallback}):fallback;
  const make=(tag,className='')=>{const node=document.createElement(tag);node.className=className;return node};
  // Search and page selection never truncate stored records or alter their order.
  function pageRecords(records,query='',page=0,size=6){
    const needle=String(query).trim().toLocaleLowerCase();
    const matches=records.filter(record=>String(record.search).toLocaleLowerCase().includes(needle));
    const pages=Math.max(1,Math.ceil(matches.length/size)),current=Math.max(0,Math.min(pages-1,Number(page)||0));
    return{matches,visible:matches.slice(current*size,(current+1)*size),page:current,pages,total:records.length};
  }
  let root,tablist,search,status,previous,next,empty,pendingCreate,grid,sheet,action,overview,drawer,opener,enabled=false;
  const homes=new Map();
  const remember=node=>{if(node&&!homes.has(node)){const anchor=document.createComment('classic tools');node.before(anchor);homes.set(node,anchor)}return node};
  const move=(node,parent)=>{if(node){remember(node);parent.append(node)}};
  const isNext=()=>typeof store==='undefined'||Number(store.toolsUi?.rolloutVersion||0)<1||store.toolsUi?.version!=='classic';
  function closeDrawer(){if(!drawer)return;drawer.hidden=true;const target=opener?.isConnected?opener:overview?.querySelector(`[data-tools-open="${state.active}"]`);target?.focus({preventScroll:true})}
  function openDrawer(key,trigger){opener=trigger||document.activeElement;activate(key);drawer.hidden=false;drawer.querySelector('[data-tools-close]')?.focus({preventScroll:true})}
  function build(){
    grid=document.querySelector('.freeplay-grid');if(!grid)return false;
    sheet=make('div','tools-next-sheet');action=make('div','tools-next-action');overview=make('aside','tools-next-overview');sheet.hidden=action.hidden=overview.hidden=true;overview.setAttribute('aria-label',text('tools.support.label','Обзор сцены'));
    drawer=make('section','tools-next-drawer');drawer.hidden=true;drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','false');drawer.setAttribute('aria-label',text('tools.support.label','Записи сцены'));
    const heading=make('header','tools-next-drawer-head'),title=make('strong'),close=make('button');title.textContent=text('tools.support.label','Записи сцены');close.type='button';close.dataset.toolsClose='true';close.textContent='×';close.setAttribute('aria-label',text('tools.support.close','Закрыть записи'));heading.append(title,close);drawer.append(heading);close.addEventListener('click',closeDrawer);
    root=make('div','tools-support-workspace');drawer.append(root);grid.append(sheet,action,overview);grid.after(drawer);
    const toggle=make('label','tools-interface-inline');toggle.textContent=text('tools.version.label','Инструменты · ');const select=make('select');select.id='tools-interface-inline';select.setAttribute('aria-label',text('tools.version.label','Версия Инструментов'));for(const[value,label]of [['next',text('tools.version.next','Новая · тестовая')],['classic',text('tools.version.classic','Старая')]]){const option=make('option');option.value=value;option.textContent=label;select.append(option)}toggle.append(select);document.querySelector('.tools-heading').append(toggle);
    for(const id of ['tools-interface-inline','tools-interface-version'])document.getElementById(id)?.addEventListener('change',event=>setVersion(event.target.value));
    overview.addEventListener('click',event=>{const button=event.target.closest('[data-tools-open]');if(button)openDrawer(button.dataset.toolsOpen,button)});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!drawer.hidden){event.preventDefault();event.stopPropagation();closeDrawer()}});
    return true;
  }
  function mount(){
    move(document.getElementById('tools-sheet'),sheet);move(document.getElementById('tools-context'),action);move(document.getElementById('tools-dice'),action);
    move(document.getElementById('tools-view-switch'),document.querySelector('.tools-heading'));
    move(document.getElementById('freeplay-local-hero-wrap'),document.getElementById('tools-sheet'));
    document.getElementById('tools-sheet').prepend(document.getElementById('freeplay-local-hero-wrap'));
    for(const[,id]of definitions)move(document.getElementById(id),root);
    const dice=document.getElementById('tools-dice'),pool=document.getElementById('dice-pool-total'),target=document.getElementById('freeplay-target-wrap'),result=document.getElementById('dice-result'),roll=document.getElementById('roll-dice');
    let summary=dice.querySelector('.tools-next-pool');if(!summary){summary=make('div','tools-next-pool');roll.before(summary)}move(pool,summary);move(target,summary);remember(result);roll.after(result);
    for(const[key,id]of definitions){const panel=document.getElementById(id);panel.classList.add('tools-support-panel');panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',`tools-support-tab-${key}`)}
    grid.classList.add('tools-next-grid');sheet.hidden=action.hidden=overview.hidden=false;
  }
  function restore(){
    closeDrawer();for(const[node,anchor]of homes)if(anchor.isConnected)anchor.after(node);
    for(const[,id,listId]of definitions){const panel=document.getElementById(id);panel.hidden=false;panel.classList.remove('tools-support-panel');panel.removeAttribute('role');panel.removeAttribute('aria-labelledby');for(const record of document.getElementById(listId).querySelectorAll('[data-tools-record]')){const details=record.querySelector('.tools-record-details');if(details){const body=details.querySelector('.tools-record-body');while(body?.firstChild)record.insertBefore(body.firstChild,details);details.remove()}record.hidden=false;delete record.dataset.toolsRecord;delete record.dataset.toolsSearch}for(const group of panel.querySelectorAll('.clock-group'))group.hidden=false}
    grid.classList.remove('tools-next-grid');sheet.hidden=action.hidden=overview.hidden=true;
  }
  function setVersion(version){
    if(typeof store!=='undefined'){store.toolsUi={version:version==='classic'?'classic':'next',rolloutVersion:1};persist()}
    refresh();window.DAWN_MOBILE_HEADER?.refresh();
  }
  const view=()=>{if(!state.views.has(state.active))state.views.set(state.active,{query:'',page:0});return state.views.get(state.active)};
  function activate(key,focus=false){state.active=key;search.value=view().query;refresh();if(focus)tablist.querySelector(`[data-tools-support-tab="${key}"]`)?.focus()}
  function setup(){
    if(!root&&!build())return false;
    const nextVersion=isNext();document.body.classList.toggle('tools-interface-next',nextVersion);
    for(const id of ['tools-interface-inline','tools-interface-version']){const select=document.getElementById(id);if(select)select.value=nextVersion?'next':'classic'}
    if(nextVersion!==enabled){nextVersion?mount():restore();enabled=nextVersion}
    if(!nextVersion)return false;
    if(root.dataset.toolsSupportReady)return true;
    root.dataset.toolsSupportReady='true';root.classList.add('tools-support-workspace');
    tablist=make('div','tools-support-tabs');tablist.setAttribute('role','tablist');tablist.setAttribute('aria-label',text('tools.support.label','Поддержка сцены'));
    for(const[key,id,,label,fallback]of definitions){const panel=document.getElementById(id);if(!panel)continue;const button=make('button');button.type='button';button.id=`tools-support-tab-${key}`;button.dataset.toolsSupportTab=key;button.setAttribute('role','tab');button.setAttribute('aria-controls',id);button.textContent=text(label,fallback);tablist.append(button);panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);panel.classList.add('tools-support-panel')}
    const toolbar=make('div','tools-support-toolbar');search=make('input');search.type='search';search.placeholder=text('tools.support.search','Найти запись…');search.setAttribute('aria-label',text('tools.support.search','Найти запись…'));toolbar.append(search);
    const footer=make('div','tools-support-pager');previous=make('button');next=make('button');previous.type=next.type='button';previous.textContent='←';next.textContent='→';previous.dataset.toolsSupportPage='previous';next.dataset.toolsSupportPage='next';previous.setAttribute('aria-label',text('tools.support.previous','Предыдущие записи'));next.setAttribute('aria-label',text('tools.support.next','Следующие записи'));status=make('output');status.setAttribute('aria-live','polite');footer.append(previous,status,next);
    empty=make('p','tools-support-empty');empty.textContent=text('tools.support.noMatches','По этому запросу записей нет.');empty.hidden=true;
    root.prepend(tablist,toolbar);root.append(empty,footer);
    root.addEventListener('click',event=>{const tab=event.target.closest('[data-tools-support-tab]'),page=event.target.closest('[data-tools-support-page]');if(tab){activate(tab.dataset.toolsSupportTab);return}if(page){view().page+=page.dataset.toolsSupportPage==='next'?1:-1;refresh();return}if(event.target.closest('[data-bond-use]'))document.getElementById('roll-dice')?.focus({preventScroll:true});if(event.target.closest('#clock-add-progress,#clock-add-danger,#freeplay-bond-add'))pendingCreate=null});
    root.addEventListener('click',event=>{const add=event.target.closest('#clock-add-progress,#clock-add-danger,#freeplay-bond-add');if(!add)return;const key=add.id==='freeplay-bond-add'?'bonds':'clocks',definition=definitions.find(item=>item[0]===key),list=document.getElementById(definition[2]);pendingCreate={key,known:new Set([...list.querySelectorAll('[data-tools-record]')].map(record=>record.dataset.toolsRecord))}},true);
    tablist.addEventListener('keydown',event=>{const buttons=[...tablist.querySelectorAll('button')],index=buttons.indexOf(event.target);if(index<0)return;let target;if(event.key==='ArrowRight')target=buttons[(index+1)%buttons.length];else if(event.key==='ArrowLeft')target=buttons[(index+buttons.length-1)%buttons.length];else if(event.key==='Home')target=buttons[0];else if(event.key==='End')target=buttons.at(-1);if(target){event.preventDefault();activate(target.dataset.toolsSupportTab,true)}});
    search.addEventListener('input',()=>{view().query=search.value;view().page=0;refresh()});
    return true;
  }
  function compact(record,key,index){
    if(record.dataset.toolsRecord)return;
    const nameInput=record.querySelector('[data-clock-name]'),bond=record.querySelector('[data-bond-use]'),stress=record.querySelector('[data-stress-actor]');
    const name=nameInput?.value||record.querySelector('header strong,.clock-readonly-head strong,.stress-card>div>strong')?.textContent||record.querySelector('strong')?.textContent||'';
    const meta=key==='history'?record.querySelector('.roll-feed-result')?.textContent:key==='clocks'?nameInput?`${record.querySelector('[data-clock-current]')?.value} / ${record.querySelector('[data-clock-size]')?.value}`:record.querySelector('.clock-readonly-head small')?.textContent:record.querySelector('small')?.textContent;
    // An empty-history placeholder has no controls and needs no disclosure.
    if(!name){record.dataset.toolsRecord='empty';return}
    const identity=`${key}:${nameInput?.dataset.clockName||bond?.dataset.bondUse||stress?.dataset.stressActor||record.dataset.toolsEntry||`${name}:${record.querySelector('header small')?.textContent||''}:${index}`}`;
    record.dataset.toolsRecord=identity;record.dataset.toolsSearch=`${name} ${meta||''} ${key==='bonds'?record.querySelector('.freeplay-bond-tags')?.textContent||'':''}`;
    if(key==='stress')return;
    const details=make('details','tools-record-details'),summary=make('summary'),title=make('strong'),value=make('small'),body=make('div','tools-record-body');title.textContent=name;value.textContent=meta||'';summary.append(title,value);
    while(record.firstChild)body.append(record.firstChild);
    details.append(summary,body);details.open=state.opened.has(identity);details.addEventListener('toggle',()=>{details.open?state.opened.add(identity):state.opened.delete(identity)});record.append(details);
    if(bond)record.classList.add('tools-bond-row');
  }
  function openCreatedRecord(records,created){
    for(const record of records){const details=record.querySelector('details');if(!details)continue;details.open=record===created;record===created?state.opened.add(record.dataset.toolsRecord):state.opened.delete(record.dataset.toolsRecord)}
  }
  function refresh(){
    if(!setup())return;
    const recordsByKey=new Map();
    for(const[key,id,listId,label,fallback,selector]of definitions){const panel=document.getElementById(id),list=document.getElementById(listId);if(!panel||!list)continue;const records=[...list.querySelectorAll(selector)];records.forEach((record,index)=>compact(record,key,index));recordsByKey.set(key,records.filter(record=>record.dataset.toolsRecord!=='empty'));panel.hidden=key!==state.active;const tab=tablist.querySelector(`[data-tools-support-tab="${key}"]`);if(tab){tab.textContent=`${text(label,fallback)} · ${recordsByKey.get(key).length}`;tab.setAttribute('aria-selected',String(key===state.active));tab.tabIndex=key===state.active?0:-1}}
    if(pendingCreate){const records=recordsByKey.get(pendingCreate.key)||[],created=records.find(record=>!pendingCreate.known.has(record.dataset.toolsRecord));if(created){state.active=pendingCreate.key;const current=view();current.query='';current.page=Math.floor(records.indexOf(created)/6);search.value='';if(pendingCreate.key==='clocks')openCreatedRecord(records,created);else{const details=created.querySelector('details');if(details){details.open=true;state.opened.add(created.dataset.toolsRecord)}}pendingCreate=null;refresh();return}}
    const records=recordsByKey.get(state.active)||[],current=view(),result=pageRecords(records.map(node=>({node,search:node.dataset.toolsSearch||node.textContent})),current.query,current.page);current.page=result.page;
    const visible=new Set(result.visible.map(record=>record.node));for(const record of records)record.hidden=!visible.has(record);
    const active=definitions.find(([key])=>key===state.active),list=active&&document.getElementById(active[2]);if(list)for(const group of list.querySelectorAll('.clock-group'))group.hidden=Boolean(records.length)&&![...group.querySelectorAll('[data-tools-record]')].some(record=>!record.hidden);
    empty.hidden=!records.length||Boolean(result.matches.length);previous.disabled=result.page===0;next.disabled=result.page>=result.pages-1;
    status.textContent=text('tools.support.page','Страница {page} из {pages} · записей: {count}',{page:result.page+1,pages:result.pages,count:result.matches.length}).replace('{page}',result.page+1).replace('{pages}',result.pages).replace('{count}',result.matches.length);
    renderOverview(recordsByKey);
  }
  function renderOverview(recordsByKey){
    const escape=value=>String(value||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
    const html=definitions.map(([key,,listId,label,fallback])=>{const records=recordsByKey.get(key)||[],limit=key==='history'?2:key==='clocks'?3:0;return `<section><header><h2>${escape(text(label,fallback))}</h2><button type="button" data-tools-open="${key}" aria-label="${escape(text(label,fallback))}: ${records.length}">${records.length} →</button></header>${records.slice(0,limit).map(record=>{const summary=record.querySelector('.tools-record-details>summary');const title=summary?.querySelector("strong")?.textContent||"",value=summary?.querySelector("small")?.textContent||"";return `<button type="button" class="tools-overview-record${key==='clocks'?' tools-overview-clock':''}" data-tools-open="${key}">${key==='clocks'&&summary?`<span class="tools-overview-name">${escape(title)}</span><span class="tools-overview-progress">${escape(value)}</span>`:escape(summary?`${title} · ${value}`:record.dataset.toolsSearch||record.textContent)}</button>`}).join('')}${!records.length?`<p>${escape(text('tools.support.empty','Пока нет записей.'))}</p>`:''}<button type="button" class="tools-overview-open" data-tools-open="${key}">${escape(key==='clocks'?text('tools.support.manageClocks','Добавить / изменить'):key==='bonds'?text('tools.support.manageBonds','Создать / использовать'):text('tools.support.open','Открыть'))}</button></section>`}).join('');if(overview.innerHTML!==html)overview.innerHTML=html;
  }
  global.DAWN_TOOLS_WORKSPACE={refresh,pageRecords,setVersion,open:openDrawer,close:closeDrawer};
})(window);
