import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
const c=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../scene-presentation-model.js',import.meta.url),'utf8'),c);const m=c.DAWN_PRESENTATION_MODEL,plain=v=>JSON.parse(JSON.stringify(v));
const space={id:'main',width:7,height:7},a={x:0,y:0},b={x:3,y:2};
assert.deepEqual(plain(m.geometry('line',a,b,space)),['0,0','1,1','2,1','3,2']);
assert.equal(m.geometry('rectangle',a,b,space).length,12);assert.equal(m.geometry('ping',a,null,space).length,1);
assert.throws(()=>m.geometry('line',a,{x:7,y:0},space));assert.throws(()=>m.geometry('damage',a,b,space));
const now=Date.now(),scene={tablePolicy:{epoch:2},spaces:[space]},row={id:'frame',scene_id:'room',user_id:'u',display_name:'Peer',color_slot:3,policy_epoch:2,space_id:'main',kind:'line',cells:['0,0','1,1'],created_at:new Date(now).toISOString(),expires_at:new Date(now+6000).toISOString()};
assert.equal(m.frame(scene,row,{roomId:'room',now}).colorSlot,3);
for(const patch of [{scene_id:'old'},{policy_epoch:1},{color_slot:12},{expires_at:new Date(now-1).toISOString()},{expires_at:new Date(now+60000).toISOString()},{cells:['0,0','0,0']},{cells:['1,1;delete']},{cells:['00,0']},{cells:['0,01']},{kind:'ping'},{space_id:'other'}])assert.equal(m.frame(scene,{...row,...patch},{roomId:'room',now}),null);
assert.throws(()=>m.validateCells(Array.from({length:129},(_,i)=>`${i%12},${Math.floor(i/12)}`),{width:12,height:12}));
assert.equal(m.frame(scene,{...row,kind:'ping',cells:['0,0'],expires_at:new Date(now+1200).toISOString()},{roomId:'room',now}).kind,'ping');
assert.equal(m.frame(scene,{...row,kind:'ping',cells:['0,0']},{roomId:'room',now}),null,'ping cannot last six seconds');
console.log('Ephemeral presentation model: geometry, clipping guards, scope/epoch/expiry/shape validation passed.');

// Full production module + actual listeners. Geometry/model-only checks cannot
// detect a cancelled pointer or a capture listener swallowing camera pan.
const nodes=new Map(),cells=new Map(),raf=[],windowEvents=new Map(),documentEvents=new Map();
class Node {
  constructor(tag){this.tag=tag;this.dataset={};this.children=[];this.events=new Map();this.className='';this.style={setProperty(){}};this.classList={toggle(){},add(){},remove(){}};}
  append(node){node.parent=this;this.children.push(node);if(node.id)nodes.set(node.id,node);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);}
  setAttribute(){} addEventListener(type,fn){const list=this.events.get(type)||[];list.push(fn);this.events.set(type,list);}
  closest(){return this.dataset.sceneCell?this:null;} matches(){return false;}
  querySelector(selector){if(selector==='span')return this.span||=(new Node('span'));const match=selector.match(/data-scene-cell="([^"]+)"/);return match?cells.get(match[1]):null;}
  querySelectorAll(){return [...cells.values()].flatMap(cell=>cell.children).filter(node=>node.className.includes('scene-presentation-cell'));}
  contains(node){return node===this||[...cells.values()].includes(node);}
}
const board=new Node('board'),toolbar=new Node('toolbar'),wrap=new Node('wrap');wrap.scrollLeft=100;wrap.scrollTop=80;
nodes.set('scene-board',board);nodes.set('scene-board-wrap',wrap);
for(let y=0;y<7;y++)for(let x=0;x<7;x++){const cell=new Node('cell');cell.dataset.sceneCell=`${x},${y}`;cells.set(cell.dataset.sceneCell,cell);}
const register=(map,type,fn)=>{const list=map.get(type)||[];list.push(fn);map.set(type,list);};
const baseline={name:'Table',version:0,rulesEdition:'lionwing',tablePolicy:{epoch:0},activeSpace:'main',spaces:[space],actors:[{id:'h',hp:7,ap:3}],targetIds:['h']};
let serial=0;
const ctx=vm.createContext({window:{addEventListener:(type,fn)=>register(windowEvents,type,fn),DAWN_SCENE_BOARD_TOOLS:{select(){},enhance(){}}},Scene:structuredClone(baseline),store:{mode:'play'},scenePanState:null,sceneSpaceHeld:false,sceneSuppressBoardClickUntil:0,performance:{now:()=>1000},$:id=>nodes.get(id),document:{hidden:false,createElement:tag=>new Node(tag),getElementById:id=>nodes.get(id),querySelector:()=>toolbar,addEventListener:(type,fn)=>register(documentEvents,type,fn)},Date,crypto:{randomUUID:()=>`gesture-${++serial}`},CSS:{escape:v=>v},requestAnimationFrame:fn=>{raf.push(fn);return raf.length;},clearTimeout(){},setTimeout:()=>1});
for(const file of ['scene-presentation-model.js','scene-presentations.js'])vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),ctx);
const api=ctx.window.DAWN_SCENE_PRESENTATIONS;
const emit=(map,type,key='0,0',extra={})=>{const event={type,key,button:0,pointerId:1,isPrimary:true,target:cells.get(key),preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true},...extra};for(const fn of map.get(type)||[]){fn(event);if(event.stopped)break;}return event;};
const flush=()=>{while(raf.length)raf.shift()();};
const overlays=()=>board.querySelectorAll('.scene-presentation-cell');
const reset=()=>{ctx.Scene=structuredClone(baseline);ctx.Scene.name=`Table ${++serial}`;api.refresh();api.setMode('line');flush();};
for(const kind of ['pointercancel','blur','hidden','outside']){
  reset();const original=JSON.stringify(ctx.Scene);emit(board.events,'pointerdown');flush();assert.equal(overlays().length,1);
  if(kind==='pointercancel')emit(board.events,'pointercancel');
  if(kind==='blur')emit(windowEvents,'blur');
  if(kind==='hidden'){ctx.document.hidden=true;emit(documentEvents,'visibilitychange');ctx.document.hidden=false;}
  if(kind==='outside')emit(documentEvents,'pointerup','0,0',{target:new Node('outside')});
  emit(board.events,'pointerup','2,0');flush();assert.equal(overlays().length,0,`${kind} cancels draft and disarms stray release`);
  assert.equal(JSON.stringify(ctx.Scene),original,'presentation cancellation never writes Scene');
}
reset();emit(board.events,'pointerup','2,0');flush();assert.equal(overlays().length,0,'unarmed pointerup cannot publish');
emit(board.events,'pointerdown');emit(board.events,'pointerup','2,0',{pointerId:2});flush();assert.equal(overlays().length,0,'another pointer cannot finish the gesture');
emit(board.events,'pointerdown');emit(board.events,'pointerup','2,0');flush();assert.equal(overlays().length,3,'normal gesture still publishes');
assert.ok(overlays().every(node=>!node.className.includes('is-preview')));

const panSource=fs.readFileSync(new URL('../app-scene-events.js',import.meta.url),'utf8');
vm.runInContext(panSource.slice(panSource.indexOf('function resetScenePanGesture()'),panSource.indexOf('document.addEventListener("keydown",event=>{if(event.key.toLowerCase()==="m"')),ctx);
reset();const panOriginal=JSON.stringify(ctx.Scene);
const spaceKey=emit(board.events,'keydown','0,0',{key:' ',code:'Space'});assert.ok(!spaceKey.stopped,'presentation leaves Space for camera');
emit(documentEvents,'keydown','0,0',{key:' ',code:'Space'});assert.equal(ctx.sceneSpaceHeld,true);
assert.ok(!emit(board.events,'pointerdown').prevented,'Space pointerdown passes through to compatibility mousedown');
emit(wrap.events,'mousedown','0,0',{currentTarget:wrap,clientX:200,clientY:200});
emit(windowEvents,'mousemove','0,0',{clientX:180,clientY:190});assert.equal(wrap.scrollLeft,120);assert.equal(wrap.scrollTop,90);
emit(board.events,'pointerup','2,0');emit(windowEvents,'mouseup');emit(documentEvents,'keyup','0,0',{code:'Space'});
emit(board.events,'click','2,0',{detail:1});flush();assert.equal(overlays().length,0,'camera pan does not publish a drawing or synthetic click');
assert.equal(JSON.stringify(ctx.Scene),panOriginal);
assert.ok(!emit(board.events,'pointerdown','0,0',{button:1}).prevented,'middle-button camera pan remains available');
console.log('Presentation actual listeners: cancelled/stray/mismatched releases, lifecycle cleanup, normal draw and actual Space/middle pan routing passed without Scene changes.');
