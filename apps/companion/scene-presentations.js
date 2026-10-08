"use strict";
// Read-only local board gestures. Shared private transport remains gated;
// it never calls changeSceneTool, commitSceneEvents, persist or the rules engine.
window.DAWN_SCENE_PRESENTATIONS=(()=>{
  const M=window.DAWN_PRESENTATION_MODEL;
  let host=null,board=null,scope=null,spaceId=null,mode=null,draft=null,timer=null,raf=null,ignoreClickUntil=0,lastVersion=0;
  const frames=new Map(),buttons=new Map();let tokens=4,lastRefill=Date.now();
  const copy=(ru,en)=>typeof isEnglishPreview==='function'&&isEnglishPreview()?en:ru;
  const sync=()=>typeof Sync==='undefined'?null:Sync;
  const scene=()=>typeof Scene==='undefined'?null:Scene;
  const room=()=>sync()?.state?.()?.sceneId||'local';
  const activeSpace=()=>scene()?.spaces?.find(row=>row.id===scene()?.activeSpace);
  const labels={ping:['Пинг','Ping'],line:['Линия','Line'],rectangle:['Прямоугольник','Rectangle'],cells:['Клетки','Cells'],cancel:['Завершить показ','Finish showing']};
  function available(){const state=sync()?.state?.()||{};return !state.sceneId;}
  function schedule(){if(raf!==null)return;raf=requestAnimationFrame(()=>{raf=null;paint()});}
  function clear(){draft=null;mode=null;frames.clear();clearTimeout(timer);timer=null;schedule();updateButtons();}
  function updateButtons(){
    board?.classList.toggle('is-presenting',Boolean(mode));
    for(const [kind,button]of buttons){const label=copy(...labels[kind]);button.setAttribute('aria-label',label);button.title=label+copy(' · Только показ. Escape — выход.',' · Presentation only. Escape exits.');button.setAttribute('aria-pressed',String(mode===kind));button.disabled=kind==='cancel'?!mode:!available();button.querySelector('span').textContent=label;}
    const status=document.getElementById('scene-presentation-status');if(!status)return;
    status.textContent=!available()?copy('Общий показ пока недоступен на сервере.','Shared presentation is not available on this server yet.'):mode?copy(mode==='ping'?'Кликните на клетку. Escape — выход.':'Протяните по полю. Escape — выход. Только показ.',mode==='ping'?'Click a cell. Escape exits.':'Drag across the board. Escape exits. Presentation only.') : copy('Временный показ без изменения целей и ресурсов.','Temporary presentation without changing targets or resources.');
  }
  function receive(row){
    const current=scene();if(!current||!host)return false;
    const item=M.frame(current,row,{roomId:room()});if(!item)return false;
    const key=`${item.userId}:${item.kind==='ping'?'ping':'drawing'}`;const prior=frames.get(key);if(prior&&(prior.created>item.created||prior.id===item.id))return false;
    frames.set(key,item);schedule();return true;
  }
  async function publish(kind,cells){
    const current=scene(),space=activeSpace();
    if(!current||!space||!available())return false;
    const now=Date.now();tokens=Math.min(4,tokens+(now-lastRefill)*3/1000);lastRefill=now;if(tokens<1)return false;tokens--;
    const request={clientId:crypto.randomUUID(),issuedAt:new Date().toISOString(),epoch:current.tablePolicy?.epoch||0,spaceId:space.id,kind,cells};
    if(room()==='local'){
      const stamp=Date.now();return receive({id:request.clientId,scene_id:'local',user_id:'local',display_name:copy('Вы','You'),color_slot:0,policy_epoch:request.epoch,space_id:space.id,kind,cells,created_at:new Date(stamp).toISOString(),expires_at:new Date(stamp+(kind==='ping'?M.PING_TTL:M.TTL)).toISOString()});
    }
    return false;
  }
  function setMode(kind){
    if(kind==='cancel'){draft=null;mode=null;schedule();updateButtons();return true;}
    if(!labels[kind]||!available())return false;
    window.DAWN_SCENE_BOARD_TOOLS?.select?.('present');
    window.DAWN_SCENE_TOKEN_HUD?.close?.();
    draft=null;mode=mode===kind?null:kind;schedule();updateButtons();return true;
  }
  function point(event){const cell=event.target.closest?.('[data-scene-cell]');if(!cell||!board.contains(cell))return null;const[x,y]=cell.dataset.sceneCell.split(',').map(Number);return{x,y};}
  function preview(end){
    if(!draft)return;
    try{draft.cells=M.geometry(mode,draft.last||draft.start,end,activeSpace(),draft.cells||[]);if(mode!=='cells')draft.cells=M.geometry(mode,draft.start,end,activeSpace());draft.last=end;schedule();}catch{draft=null;schedule();}
  }
  function paint(){
    if(!board)return;
    clearTimeout(timer);timer=null;
    for(const node of board.querySelectorAll('.scene-presentation-cell'))node.remove();
    const now=Date.now(),current=scene();
    for(const [user,item]of frames){if(item.expires<=now||item.roomId!==room()||item.spaceId!==spaceId&&!current?.spaces?.some(s=>s.id===item.spaceId))frames.delete(user);}
    const visible=[...frames.values()].filter(item=>item.spaceId===spaceId);
    if(draft?.cells?.length)visible.push({kind:mode,cells:draft.cells,colorSlot:0,name:copy('Предпросмотр','Preview'),preview:true});
    for(const item of visible){
      item.cells.forEach((key,index)=>{const cell=board.querySelector(`[data-scene-cell="${CSS.escape(key)}"]`);if(!cell)return;
        const node=document.createElement('span');node.className='scene-presentation-cell'+(item.kind==='ping'?' is-ping':'')+(item.preview?' is-preview':'');node.style.setProperty('--presentation-color',M.COLORS[item.colorSlot]);node.setAttribute('aria-hidden','true');node.title=item.name;
        if(index===0){const tag=document.createElement('small');tag.textContent=item.name;node.append(tag);}cell.append(node);
      });
    }
    if(frames.size){const next=Math.min(...[...frames.values()].map(item=>item.expires));timer=setTimeout(paint,Math.max(20,next-now+1));}
  }
  function init(){
    if(host)return true;
    const toolbar=document.querySelector('.scene-toolbar');board=document.getElementById('scene-board');if(!toolbar||!board||!M)return false;
    host=toolbar;
    for(const kind of Object.keys(labels)){
      const button=document.createElement('button');button.type='button';button.id=`scene-present-${kind}`;button.dataset.presentationMode=kind;button.dataset.boardIcon=({ping:'target',line:'measure',rectangle:'map',cells:'areas',cancel:'close'})[kind];
      button.innerHTML=(window.DAWN_UI_ICONS?.html(button.dataset.boardIcon)||'')+'<span></span>';button.addEventListener('click',()=>setMode(kind));toolbar.append(button);buttons.set(kind,button);
    }
    const status=document.createElement('p');status.id='scene-presentation-status';status.className='scene-presentation-status';status.setAttribute('aria-live','polite');toolbar.append(status);
    window.DAWN_SCENE_BOARD_TOOLS?.enhance?.();
    toolbar.addEventListener('scene-board-category-change',event=>{if(event.detail.id!=='present'){draft=null;mode=null;schedule();updateButtons();}});
    board.addEventListener('pointerdown',event=>{
      if(!mode)return;if(event.button!==0){event.preventDefault();event.stopImmediatePropagation();setMode('cancel');return;}
      const start=point(event);if(!start)return;
      event.preventDefault();event.stopImmediatePropagation();
      if(mode!=='ping'){draft={start,last:start,cells:M.geometry(mode,start,start,activeSpace())};schedule();}
    },true);
    board.addEventListener('pointermove',event=>{if(!mode)return;event.stopImmediatePropagation();const end=point(event);if(draft&&end)preview(end);},true);
    board.addEventListener('mouseover',event=>{if(mode)event.stopImmediatePropagation();},true);
    board.addEventListener('pointerup',event=>{
      if(!mode||event.button!==0)return;event.preventDefault();event.stopImmediatePropagation();
      const end=point(event);if(mode==='ping'){if(end)void publish(mode,M.geometry(mode,end,end,activeSpace()));}
      else if(draft&&end){preview(end);if(draft)void publish(mode,draft.cells);}
      draft=null;ignoreClickUntil=Date.now()+200;schedule();
    },true);
    board.addEventListener('click',event=>{
      if(!mode)return;event.preventDefault();event.stopImmediatePropagation();if(event.detail!==0&&Date.now()<ignoreClickUntil)return;
      const cell=point(event);if(!cell)return;
      if(mode==='ping'||mode==='cells'){void publish(mode,M.geometry(mode,cell,cell,activeSpace()));return;}
      if(!draft){draft={start:cell,last:cell,cells:M.geometry(mode,cell,cell,activeSpace())};schedule();}
      else{preview(cell);if(draft)void publish(mode,draft.cells);draft=null;schedule();}
    },true);
    board.addEventListener('keydown',event=>{if(!mode||!['Enter',' '].includes(event.key)||!point(event))return;event.preventDefault();event.stopImmediatePropagation();event.target.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:0}));},true);
    board.addEventListener('contextmenu',event=>{if(mode){event.preventDefault();event.stopImmediatePropagation();setMode('cancel');}},true);
    board.addEventListener('dragstart',event=>{if(mode){event.preventDefault();event.stopImmediatePropagation();}},true);
    document.addEventListener('pointerup',event=>{if(draft&&!board.contains(event.target)){draft=null;schedule();}},true);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&mode&&!event.target.closest?.('input,select,textarea,[contenteditable]')){event.preventDefault();event.stopImmediatePropagation();setMode('cancel');}},true);
    if(typeof MutationObserver==='function')new MutationObserver(schedule).observe(board,{childList:true});
    sync()?.on?.('status',refresh);
    return true;
  }
  function refresh(){
    if(!init())return;
    const current=scene(),state=sync()?.state?.()||{},next=`${room()}:${state.userId||'local'}:${current?.rulesEdition}:${current?.name}:${current?.tablePolicy?.epoch||0}`;
    if(scope!==next||Number(current?.version||0)<lastVersion){scope=next;clear();}
    if(spaceId!==current?.activeSpace){spaceId=current?.activeSpace;draft=null;mode=null;}
    lastVersion=Number(current?.version||0);
    if(!available()){draft=null;mode=null;}
    updateButtons();schedule();
  }
  return Object.freeze({init,refresh,setMode,receive,publish,isActive:()=>Boolean(mode)});
})();
