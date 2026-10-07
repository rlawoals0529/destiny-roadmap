import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data.js';
import { STORAGE_KEY, freshState, loadState, saveState, parseBackup, exportState, validateState, complete, prerequisites, progress, nextTask, setTask, filterTasks } from '../core.js';
const task = id => data.tasks.find(t => t.id === id);
function memoryStorage() { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) }; }

test('starting state records only the user-reported completed mission; resources are unknown', () => {
  const s = freshState(data);
  assert.deepEqual(s.checks, { 'iconoclasm.1': true });
  assert.deepEqual(s.quantities, {});
  assert.equal(nextTask(data, s).id, 'audit');
});
test('checkboxes, counts and route survive save/reload', () => {
  const storage = memoryStorage();
  const s = setTask(freshState(data), task('audit'), true);
  s.quantities.ciphers = 0; s.quantities.credits = 12000; s.route = 'story';
  saveState(storage, s);
  assert.deepEqual(loadState(storage, data).state, s);
  assert.equal(complete(task('audit'), s), true);
});
test('export/import round-trip preserves unknown, zero and positive values', () => {
  const s = freshState(data); s.quantities = { glimmer: null, ciphers: 0, credits: 50000 };
  assert.deepEqual(parseBackup(exportState(s), data), s);
});
test('a farm stays blocked until every prerequisite in the full chain is checked', () => {
  let s = freshState(data);
  s = setTask(s, task('ren-welcome'), true);
  assert.equal(prerequisites(task('piker-rank'), data, s), false);
  for (const id of ['audit','heroes-radio','queens-one','wild-accept','still-hunt','prism-core','prism-facets','nighthawk-owned','temporary','ren-start','ren-cantina']) s = setTask(s, task(id), true);
  assert.equal(prerequisites(task('piker-rank'), data, s), true);
  s = setTask(s, task('audit'), false);
  assert.equal(prerequisites(task('piker-rank'), data, s), false);
});
test('next recommendation advances through the critical path without jumping to a farm', () => {
  let s = freshState(data);
  const recommended = [];
  for (let i = 0; i < 35; i++) {
    const next = nextTask(data, s);
    if (!next) break;
    assert(prerequisites(next, data, s));
    recommended.push(next.id);
    s = setTask(s, next, true);
    if (next.id === 'after-choice') break;
  }
  assert(recommended.indexOf('ren-welcome') < recommended.indexOf('piker-rank'));
  assert(recommended.indexOf('a499-first') < recommended.indexOf('finished-loadout'));
  assert(recommended.includes('dps-recover'));
  assert(recommended.indexOf('excision') > recommended.indexOf('still-hunt'));
  assert(recommended.indexOf('excision') < recommended.indexOf('dps-recover'));
});
test('route preference changes later branch without bypassing critical tasks', () => {
  const fixture = { ...data, tasks: [
    { ...task('audit'), id: 'critical', steps: [{ id: 'a' }], requires: [] },
    { ...task('story-start'), id: 'story', steps: [{ id: 'b' }], requires: [], priority: 100 },
    { ...task('after-choice'), id: 'endgame', steps: [{ id: 'c' }], requires: [], priority: 100 }
  ] };
  let s = freshState(fixture); s.route = 'story';
  assert.equal(nextTask(fixture, s).id, 'critical');
  s.checks.a = true;
  assert.equal(nextTask(fixture, s).id, 'story');
  s.route = 'endgame'; assert.equal(nextTask(fixture, s).id, 'endgame');
});
test('invalid backups are rejected before a storage mutation', () => {
  const s = freshState(data);
  for (const text of ['not json', '{}', JSON.stringify({ ...s, version: 2 }), JSON.stringify({ ...s, checks: [] }), JSON.stringify({ ...s, checks: { 'audit.1': 'true' } }), JSON.stringify({ ...s, quantities: { glimmer: -1 } }), JSON.stringify({ ...s, quantities: { glimmer: 2.5 } }), JSON.stringify({ ...s, quantities: { credits: '2000' } }), ' '.repeat(1024 * 1024 + 1)]) assert.throws(() => parseBackup(text, data));
});
test('unknown future IDs are ignored and hostile object keys cannot pollute prototypes', () => {
  const text = '{"app":"destiny-roadmap","version":1,"checks":{"__proto__":true,"unknown":true,"audit.1":true},"quantities":{"unknown":1,"glimmer":0}}';
  const s = parseBackup(text, data);
  assert.deepEqual(s.checks, { 'audit.1': true }); assert.deepEqual(s.quantities, { glimmer: 0 });
  assert.equal({}.polluted, undefined);
});
test('corrupt local state is preserved for recovery rather than overwritten', () => {
  const storage = memoryStorage(); storage.setItem(STORAGE_KEY, '{broken');
  const loaded = loadState(storage, data);
  assert(loaded.error); assert.equal(loaded.recovery, '{broken');
  assert.equal(storage.getItem(STORAGE_KEY), '{broken');
});
test('unavailable storage reports failure, not a false saved state', () => {
  const storage = { getItem() { throw Error('blocked'); }, setItem() { throw Error('full'); } };
  assert(loadState(storage, data).error);
  assert.throws(() => saveState(storage, freshState(data)));
});
test('reset recreates the seed and clears old checks and counts', () => {
  const storage = memoryStorage(); const s = freshState(data); s.checks['audit.1'] = true; s.quantities.glimmer = 99;
  saveState(storage, s); saveState(storage, freshState(data));
  assert.deepEqual(loadState(storage, data).state, freshState(data));
});
test('progress counts partial steps and toggling whole tasks is reversible', () => {
  let s = freshState(data); s.checks['audit.1'] = true;
  assert.equal(progress([task('audit')], s).done, 1);
  assert.equal(complete(task('audit'), s), false);
  s = setTask(s, task('audit'), true); assert.equal(progress([task('audit')], s).percent, 100);
  s = setTask(s, task('audit'), false); assert.equal(progress([task('audit')], s).done, 0);
});
test('search, category and readiness filters respect prerequisites', () => {
  const s = freshState(data);
  assert(filterTasks(data, s, { search: 'Aggregate' }).some(t => t.id === 'a499-roll'));
  assert(filterTasks(data, s, { tag: 'Build Critical' }).every(t => t.tags.includes('Build Critical')));
  assert(!filterTasks(data, s, { status: 'ready' }).some(t => t.id === 'a499-first'));
  assert(filterTasks(data, s, { section: 'raids' }).every(t => t.section === 'raids'));
});
test('cyclic or absent dependencies fail closed', () => {
  const a = { id: 'a', steps: [{ id: 'a.1' }], requires: ['b'] }, b = { id: 'b', steps: [{ id: 'b.1' }], requires: ['a'] };
  const d = { tasks: [a, b] }, s = { checks: { 'a.1': true, 'b.1': true } };
  assert.equal(prerequisites(a, d, s), false);
  assert.equal(prerequisites({ ...a, requires: ['missing'] }, d, s), false);
});
