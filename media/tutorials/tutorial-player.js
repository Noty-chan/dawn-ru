"use strict";
const lessons=window.DAWN_LESSONS||[];
const params=new URLSearchParams(location.search);const lesson=lessons.find(x=>x.id===params.get("lesson"))||lessons[0];
const $=id=>document.getElementById(id),esc=v=>String(v??"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
const BEAT_MS=6800;let elapsed=0,last=0,playing=false,frame=0,current=-1;
document.title=`DAWN · ${lesson.id} · ${lesson.title}`;$("lesson-number").textContent=`УРОК ${lesson.id} / 12`;$("lesson-title").textContent=lesson.title;$("lesson-subtitle").textContent=lesson.subtitle;
function terms(values,cls="v-equation"){return `<div class="${cls}">${values.map(x=>`<span class="term">${esc(x)}</span>`).join("")}</div>`}
function dice(values,cls="v-dice"){return `<div class="${cls}">${values.map((v,i)=>`<span class="die ${v===6?"crit":v>=4?"success":""}" style="--i:${i}">${v}</span>`).join("")}</div>`}
function renderVisual(type,values){
 const simple={equation:"v-equation",flow:"v-flow",burst:"v-burst",threshold:"v-threshold",versus:"v-versus",balance:"v-balance",split:"v-split",interrupt:"v-interrupt"};
 if(simple[type])return terms(values,simple[type]);
 if(type==="dice"||type==="pool")return dice(values,type==="pool"?"v-pool":"v-dice");
 if(type==="attributes")return `<div class="v-attributes">${values.map((v,i)=>`<div class="mini-card" style="--i:${i}"><span>${esc(v)}</span><strong>${[4,3,2,2][i]}</strong></div>`).join("")}</div>`;
 if(type==="stat")return `<div class="v-stat"><b>${esc(values[0])}</b><strong>${esc(values[1])}</strong><small>${esc(values[2])}</small></div>`;
 if(type==="ladder")return `<div class="v-ladder">${values.map((v,i)=>`<span class="step" style="--i:${i}">${v}</span>`).join("")}</div>`;
 if(type==="pips")return `<div class="v-pips">${values.map((v,i)=>`<span class="pip" style="--i:${i}">${esc(v)}</span>`).join("")}</div>`;
 if(["tags","outcomes","sources","rewards","targets"].includes(type))return `<div class="v-${type}">${values.map(v=>`<span class="pill">${esc(v)}</span>`).join("")}</div>`;
 if(type==="source")return terms(values,"v-flow");
 if(type==="card")return `<div class="v-card"><b>${esc(values[0])}</b><p>${esc(values[1])}</p></div>`;
 if(type==="meter"){const [value,max,label]=values;return `<div class="v-meter"><div class="meter-label"><span>${esc(label)}</span><strong>${value} / ${max}</strong></div><div class="meter"><i style="--fill:${Math.max(0,Math.min(100,value/max*100))}%"></i></div></div>`}
 if(type==="orbit")return `<div class="v-orbit"><div class="orbit-core">${esc(values[1])}</div>${values.filter((_,i)=>i!==1).map((v,i)=>`<span class="orb" style="--angle:${i*120}deg">${esc(v)}</span>`).join("")}</div>`;
 if(type==="tree")return `<div class="v-tree"><span class="tree-root">${esc(values[0])}</span><span class="branch" style="--rot:-32deg">${esc(values[1])}</span><span class="branch" style="--rot:32deg">${esc(values[2])}</span></div>`;
 if(type==="timeline")return `<div class="v-timeline">${values.map((v,i)=>`<div class="mini-card" style="--i:${i}"><span>${i+1}</span><strong>${esc(v)}</strong></div>`).join("")}</div>`;
 return terms(values);
}
function showBeat(index){index=Math.max(0,Math.min(lesson.beats.length-1,index));if(index===current)return;current=index;const [title,body,type,values]=lesson.beats[index];$("beat-kicker").textContent=`ШАГ ${index+1} ИЗ ${lesson.beats.length}`;$("beat-title").textContent=title;$("beat-body").textContent=body;const old=$("visual");old.innerHTML=renderVisual(type,values);old.classList.remove("visual");void old.offsetWidth;old.classList.add("visual");const copy=old.previousElementSibling;copy.style.animation="none";void copy.offsetWidth;copy.style.animation="";}
function format(ms){const s=Math.floor(ms/1000);return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}
function paint(){const total=lesson.beats.length*BEAT_MS;elapsed=Math.max(0,Math.min(total,elapsed));showBeat(Math.min(lesson.beats.length-1,Math.floor(elapsed/BEAT_MS)));$("progress").style.width=`${elapsed/total*100}%`;$("time").textContent=`${format(elapsed)} / ${format(total)}`;$("play").textContent=playing?"❚❚":"▶";}
function tick(now){if(!playing)return;elapsed+=now-last;last=now;if(elapsed>=lesson.beats.length*BEAT_MS){elapsed=lesson.beats.length*BEAT_MS;playing=false;}paint();if(playing)frame=requestAnimationFrame(tick)}
function toggle(){playing=!playing;cancelAnimationFrame(frame);if(playing){$("start").classList.add("hidden");last=performance.now();frame=requestAnimationFrame(tick)}paint()}
function seekBeat(delta){elapsed=Math.max(0,Math.min((lesson.beats.length-1)*BEAT_MS,Math.floor(elapsed/BEAT_MS)*BEAT_MS+delta*BEAT_MS));current=-1;paint()}
function restart(){elapsed=0;current=-1;playing=false;cancelAnimationFrame(frame);$("start").classList.remove("hidden");paint()}
$("start").onclick=toggle;$("play").onclick=toggle;$("prev").onclick=()=>seekBeat(-1);$("next").onclick=()=>seekBeat(1);$("restart").onclick=restart;
document.addEventListener("keydown",event=>{if(["Space","ArrowLeft","ArrowRight","KeyR"].includes(event.code))event.preventDefault();if(event.code==="Space")toggle();if(event.code==="ArrowLeft")seekBeat(-1);if(event.code==="ArrowRight")seekBeat(1);if(event.code==="KeyR")restart();});
paint();
