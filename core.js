export const APP_ID = 'destiny-roadmap';
export const STORAGE_KEY = 'destiny-roadmap:progress:v1';
export const MAX_IMPORT_BYTES = 1024 * 1024;

export function freshState(data) {
  return { app: APP_ID, version: 1, checks: Object.fromEntries(data.tasks.flatMap(t => t.steps.filter(s => s.initial).map(s => [s.id, true]))), quantities: {}, route: 'hybrid' };
}

export function validateState(input, data) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.app !== APP_ID || input.version !== 1) throw new Error('This is not a supported Destiny Roadmap backup.');
  for (const field of ['checks', 'quantities']) if (!input[field] || typeof input[field] !== 'object' || Array.isArray(input[field])) throw new Error(`Invalid ${field} in backup.`);
  const ids = new Set(data.tasks.flatMap(t => t.steps.map(s => s.id)));
  const resources = new Map(data.resources.map(r => [r.id, r]));
  const state = { app: APP_ID, version: 1, checks: {}, quantities: {}, route: ['hybrid', 'endgame', 'story'].includes(input.route) ? input.route : 'hybrid' };
  for (const [id, value] of Object.entries(input.checks)) {
    if (typeof value !== 'boolean') throw new Error('Checklist values must be true or false.');
    if (ids.has(id)) state.checks[id] = value;
  }
  for (const [id, value] of Object.entries(input.quantities)) {
    if (value !== null && (!Number.isSafeInteger(value) || value < 0 || value > 1e9)) throw new Error('Quantities must be whole, non-negative numbers.');
    if (resources.has(id)) state.quantities[id] = value;
  }
  return state;
}

export function parseBackup(text, data) {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error('Backup is too large (maximum 1 MB).');
  let input;
  try { input = JSON.parse(text); } catch { throw new Error('The file is not valid JSON.'); }
  return validateState(input, data);
}

export function loadState(storage, data) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { state: freshState(data), error: null };
    try { return { state: parseBackup(raw, data), error: null }; }
    catch { return { state: freshState(data), error: 'Saved progress could not be read. It has been preserved. Export the recovery copy before replacing it.', recovery: raw }; }
  } catch { return { state: freshState(data), error: 'Browser storage is unavailable. Progress will last for this visit only. Export a backup before closing.' }; }
}

export function saveState(storage, state) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportState(state) {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}

export function complete(task, state) {
  return task.steps.every(s => state.checks[s.id] === true);
}

export function prerequisites(task, data, state, trail = new Set()) {
  if (trail.has(task.id)) return false;
  const next = new Set(trail).add(task.id);
  return task.requires.every(id => {
    const parent = data.tasks.find(t => t.id === id);
    return parent && complete(parent, state) && prerequisites(parent, data, state, next);
  });
}

export function progress(tasks, state) {
  const steps = tasks.flatMap(t => t.steps);
  const done = steps.filter(s => state.checks[s.id]).length;
  return { done, total: steps.length, percent: steps.length ? Math.round(done / steps.length * 100) : 0 };
}

export function nextTask(data, state) {
  // ponytail: linear scan of a small static checklist; index only if content grows to thousands of tasks.
  const candidates = data.tasks.filter(t => !complete(t, state) && prerequisites(t, data, state) && !t.tags.includes('Optional') && t.recommend !== false);
  return candidates.sort((a, b) => rank(a, state.route) - rank(b, state.route) || data.tasks.indexOf(a) - data.tasks.indexOf(b))[0] ?? null;
}

function rank(task, route) {
  if (task.tags.includes('Build Critical') || !task.branch) return task.priority;
  const preferred = route === 'story' ? 'story' : 'endgame';
  return task.priority + (task.branch === preferred ? 0 : 1000);
}

export function setTask(state, task, checked) {
  return { ...state, checks: { ...state.checks, ...Object.fromEntries(task.steps.map(s => [s.id, checked])) } };
}

export function filterTasks(data, state, { search = '', tag = 'All', section = 'all', status = 'all' } = {}) {
  const query = search.trim().toLowerCase();
  return data.tasks.filter(t => (section === 'all' || t.section === section) && (tag === 'All' || t.tags.includes(tag)) &&
    (status !== 'incomplete' || !complete(t, state)) && (status !== 'ready' || (!complete(t, state) && prerequisites(t, data, state))) &&
    (!query || JSON.stringify(t).toLowerCase().includes(query)));
}
