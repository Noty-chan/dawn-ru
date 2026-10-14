import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {runtime,fixture,clone} from './helpers/scene-contract-harness.mjs';

const source=(process.env.DAWN_INPUT_BASELINE_REF?execFileSync('git',['show',`${process.env.DAWN_INPUT_BASELINE_REF}:apps/companion/lionwing-ui.js`],{encoding:'utf8'}):fs.readFileSync(new URL('../lionwing-ui.js',import.meta.url),'utf8')).replaceAll('\r\n','\n');
const {context,core}=runtime(),scene=fixture();scene.targetIds=['enemy'];scene.artworks=[{image:'A'.repeat(100000)}];
const snapshot=clone(scene);scene.undo=Array.from({length:20},()=>({state:snapshot}));scene.turnUndo=Array.from({length:10},()=>({state:snapshot}));
const before=clone(scene),output={textContent:''},inputs=[];let callback,previews=0,actionRefreshes=0;
const root={dataset:{lwActor:'hero'},className:'lw-console',closest:()=>null,querySelector:selector=>selector==='[data-lw-preview]'?output:selector==='[data-lw-amount]'?amount:null,querySelectorAll:selector=>inputs.filter(input=>input.matches(selector))};
function input(name,value){const element={value,type:'text',attributes:[{name,value:''}],matches:selector=>selector===`[${name}]`,closest:selector=>selector==='.lw-console'||selector==='[data-lw-root]'?root:selector===`[${name}]`?element:null};inputs.push(element);return element;}
const amount=input('data-lw-amount','3');
Object.assign(context,{Scene:scene,LionwingEngine:{...core,previewEvents(...args){previews++;return core.previewEvents(...args);}},lwActive:()=>true,lwOwns:()=>true,activeSceneView:()=> 'gm',
 lwRefreshCunningActions(){actionRefreshes++;},document:{addEventListener(type,handler){if(type==='input')callback=handler;}},
});
vm.runInContext(source.slice(source.indexOf('const lwFormDraft ='),source.indexOf('let lwDraftEnabled=')),context);
const start=source.indexOf('document.addEventListener("input",event=>{'),end=source.indexOf('\ndocument.addEventListener("change", event => {',start);vm.runInContext(source.slice(start,end),context);
callback({target:amount});assert.equal(previews,1);const firstSummary=output.textContent;assert.ok(firstSummary.includes('enemy: 30 →'));
const samples=[];
for(const name of ['data-lw-general-note','data-lw-custom-label','data-lw-focus','data-lw-dice-label']){
 const field=input(name,'initial'),initial=previews,t0=performance.now();
 for(let i=0;i<8;i++){field.value=`typed ${i}`;callback({target:field});}
 samples.push({field:name,keystrokes:8,damagePreviews:previews-initial,ms:+(performance.now()-t0).toFixed(2)});
 const key=context.lwDraftKey(field);assert.equal(vm.runInContext('lwFormDraft',context).get(key),'typed 7','Unrelated form edits still retain the actual field draft');
 assert.equal(output.textContent,firstSummary,'An unchanged amount is not recomputed when another field is typed');
}
if(process.env.DAWN_INPUT_MEASURE_ONLY!=='1')assert.equal(previews,1,'Unrelated typing cannot launch the mechanics pipeline');
assert.equal(actionRefreshes,8,'Focus typing still refreshes its existing action controls');
amount.value='6';callback({target:amount});assert.equal(previews,process.env.DAWN_INPUT_MEASURE_ONLY==='1'?34:2);
const expected=core.previewEvents(scene,[core.command('hero',{kind:'batch',operations:[{kind:'damage',targetId:'enemy',amount:6}]})]);assert.equal(expected.ok,true,expected.errors?.join(' '));
assert.ok(output.textContent.includes(`enemy: 30 → ${expected.scene.actors[1].hp} ЗД`));assert.notEqual(output.textContent,firstSummary);assert.deepEqual(clone(scene),before,'Every damage preview preserves all canonical state and UI history');
scene.targetIds=[];callback({target:amount});assert.equal(output.textContent,'Выберите цели для предпросмотра.');
console.log(JSON.stringify({suite:'LionWing production input listener',samples,actualDamageAmountEdits:2,canonicalStateUnchanged:true,codecAndDOM:'DOM mocked; production bookkeeping/listener/core preview executed'}));
