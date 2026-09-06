import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const source=read('source/editions/dawn-en-lionwing-cb2f8e67/extracted-companion.json');
const review=read('docs/tasks/lionwing-technique-requirements.review.json');
const families=read('docs/tasks/lionwing-rule-families.json').families;
const fail=message=>{throw new Error(message)};
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const levels=source.archetypes.flatMap(a=>a.techniques.flatMap(t=>t.levels.map(l=>({id:`${t.id}.${l.n}`,archetypeId:a.id,techniqueId:t.id,name:l.name,text:l.text,notes:t.notes,source:t.source}))));
if(levels.length!==333||new Set(levels.map(l=>l.id)).size!==333)fail('Expected 333 distinct LionWing levels');
if(review.editionId!==source.editionId)fail('Wrong review edition');
const byId=new Map(levels.map(l=>[l.id,l])),familyById=new Map(families.map(f=>[f.id,f]));
if(familyById.size!==families.length)fail('Duplicate family');
const visited=new Set(),visiting=new Set();
function visit(id){if(visited.has(id))return;if(visiting.has(id))fail(`Family dependency cycle: ${id}`);const f=familyById.get(id);if(!f)fail(`Unknown family: ${id}`);visiting.add(id);f.dependsOn.forEach(visit);visiting.delete(id);visited.add(id)}
families.forEach(f=>visit(f.id));
const drafts=new Map();
for(const row of review.levels){
 if(drafts.has(row.id))fail(`Duplicate requirement: ${row.id}`);
 if(!byId.has(row.id)||row.sourceDigest!==digest(byId.get(row.id)))fail(`Stale or unknown source: ${row.id}`);
 if(row.status!=='requirements-draft')fail(`Unsupported readiness claim: ${row.id}`);
 for(const key of ['trigger','conditions','cost','lifetime','inheritance'])if(typeof row[key]!=='string'||!row[key].trim())fail(`Missing ${key}: ${row.id}`);
 for(const key of ['families','orderedSteps','tests'])if(!Array.isArray(row[key])||!row[key].length)fail(`Missing ${key}: ${row.id}`);
 if(!Array.isArray(row.openQuestions))fail(`Missing open questions: ${row.id}`);
 row.families.forEach(id=>{if(!familyById.has(id))fail(`Unknown family ${id}: ${row.id}`)});
 drafts.set(row.id,row);
}
const esc=s=>String(s).replaceAll('|','\\|').replace(/\s+/g,' ').trim();
const lines=['# LionWing: реестр требований и семейства','',
'> Генерируется `node tools/content/build_lionwing_requirements.mjs`. Проверка: та же команда с `--check`.',
'> Черновик требований не означает сверку всех неоднозначностей, реализацию контракта или автоматизацию Техники.','',
`Всего: ${levels.length} Уровня. Подробный ручной черновик: ${drafts.size}. Ещё не разобраны в этом реестре: ${levels.length-drafts.size}.`,
'','Источники: `lionwing-technique-requirements.review.json` и `lionwing-rule-families.json` рядом с этим файлом. SHA-256 каждой разобранной строки фиксирует исходный текст, примечания и источник. Генератор не классифицирует Техники по ключевым словам.',
'','## Семейства — предварительный план','',
'Число потребителей ниже относится только к разобранным строкам, не ко всем 333 Уровням. Зависимости — порядок разработки контрактов; событийные связи между ними могут быть двусторонними.','',
'| ID | Контракт | Зависимости | Разобранных потребителей |','| --- | --- | --- | ---: |',
...families.map(f=>`| ${f.id} | ${esc(f.contract)} | ${f.dependsOn.join(', ')||'—'} | ${review.levels.filter(r=>r.families.includes(f.id)).length} |`),
'','## Все Уровни','',
'| Уровень | Название | PDF | Разбор требований | Семейства |','| --- | --- | ---: | --- | --- |',
...levels.map(l=>{const r=drafts.get(l.id);return `| ${l.id} | ${esc(l.name)} | ${l.source.pdfPage} | ${r?'черновик':'ожидает разбора'} | ${r?.families.join(', ')||'—'} |`}),
'','## Неразрешённые вопросы черновика','',
...review.levels.flatMap(r=>r.openQuestions.map(q=>`- **${r.id}**: ${q}`)),
'','Статусы автоматизации в `apps/companion/LIONWING-AUTOMATION-MAP.md` этот реестр не меняет.',''];
const output=path.join(root,'docs/tasks/LIONWING_TECHNIQUE_REQUIREMENTS.md'),text=lines.join('\n');
if(process.argv.includes('--check')){if(!fs.existsSync(output)||fs.readFileSync(output,'utf8').replace(/\r\n/g,'\n')!==text)fail('Requirements inventory is stale')}else fs.writeFileSync(output,text);
console.log(`LionWing requirements: ${levels.length} indexed, ${drafts.size} manual drafts, ${families.length} planned families; source digests and dependency graph valid`);
