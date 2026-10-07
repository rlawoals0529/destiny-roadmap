import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import data from '../data.js';
const ids = new Set();
const steps = new Set();
for (const t of data.tasks) {
  assert(!ids.has(t.id), 'Duplicate task: ' + t.id); ids.add(t.id);
  assert(data.sections.some(s => s.id === t.section));
  assert(t.steps.length && t.title && t.why && t.team && t.time && t.gate && t.reward);
  for (const s of t.steps) { assert(!steps.has(s.id), 'Duplicate step: ' + s.id); steps.add(s.id); assert(s.text); }
  for (const source of t.sources) assert(data.sources[source], 'Unknown source: ' + source);
}
function visit(t, chain = []) {
  assert(!chain.includes(t.id), 'Dependency cycle: ' + [...chain, t.id].join(' → '));
  for (const id of t.requires) { assert(ids.has(id), 'Unknown prerequisite: ' + id); visit(data.tasks.find(p => p.id === id), [...chain, t.id]); }
}
for (const t of data.tasks) visit(t);
for (const r of data.resources) assert(data.sources[r.source]);
for (const source of Object.values(data.sources)) assert(new URL(source.url).protocol === 'https:');
for (const file of ['index.html','app.js','core.js','data.js','style.css','README.md']) {
  const body = await readFile(file, 'utf8');
  assert(!/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]+|AKIA[0-9A-Z]{16}|BEGIN (RSA |OPENSSH )?PRIVATE KEY|C:\\Users\\|jamin@|rlawoals00529@gmail/i.test(body), 'Privacy pattern in ' + file);
}
console.log(`Content validated: ${ids.size} tasks, ${steps.size} steps, ${data.resources.length} counters. Dependency graph and public-file privacy scan passed.`);
