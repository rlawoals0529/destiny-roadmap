import data from './data.js';
import { STORAGE_KEY, MAX_IMPORT_BYTES, freshState, loadState, saveState, exportState, parseBackup, complete, prerequisites, progress, nextTask, setTask, filterTasks } from './core.js';

const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let storage;
try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error('unavailable'); }, setItem() { throw new Error('unavailable'); } }; }
const loaded = loadState(storage, data);
let state = loaded.state;
let recovery = loaded.recovery;
let section = 'now';
let view = 'journey';
let suggested = null;
let saveMessage = loaded.error ? 'Not saved · export a backup' : 'Saved on this browser';

function sourceLinks(ids) {
  return ids.map(id => { const s = data.sources[id]; return `<a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.title)} ↗</a>`; }).join('');
}

function warn(text) {
  $('storage-warning').hidden = false;
  $('storage-warning').textContent = text;
  if (recovery) {
    const button = document.createElement('button');
    button.textContent = 'Export recovery copy';
    button.onclick = () => download(recovery, 'destiny-roadmap-recovery.json');
    $('storage-warning').append(button);
  }
}

function notify(text) { $('message').textContent = text; }

function persist(next) {
  state = next;
  if (recovery) {
    saveMessage = 'Recovery needed · changes kept for this visit';
    warn('The unreadable saved copy is preserved. Export its recovery copy, then import a valid backup or reset to resume saving.');
  } else {
    try {
      saveState(storage, state);
      saveMessage = 'Saved on this browser';
      $('storage-warning').hidden = true;
    } catch {
      saveMessage = 'Not saved · export a backup';
      warn('Your browser could not save progress. Changes are kept for this visit. Export a backup before closing the page.');
    }
  }
  renderProgress();
}

function replaceState(next) {
  // Write first: a failed import or reset must leave the existing state intact.
  saveState(storage, next);
  state = next;
  recovery = null;
  saveMessage = 'Saved on this browser';
  $('storage-warning').hidden = true;
  $('route').value = state.route;
  renderAll();
}

function renderProgress() {
  const overall = progress(data.tasks.filter(t => data.paths[0].tasks.includes(t.id)), state);
  const build = progress(data.tasks.filter(t => t.tags.includes('Build Critical')), state);
  $('overall-percent').textContent = overall.percent + '%';
  $('overall-bar').value = overall.percent;
  $('overall-count').textContent = `${overall.done}/${overall.total} route steps`;
  $('build-percent').textContent = build.percent + '%';
  $('save-status').textContent = saveMessage;
  suggested = nextTask(data, state);
  $('next-heading').textContent = suggested?.title || 'Your selected route is complete.';
  const step = suggested?.steps.find(s => !state.checks[s.id]);
  $('next-description').textContent = step ? step.short || step.text : 'Choose an optional goal or the next campaign.';
  $('next-meta').textContent = suggested ? data.needs[suggested.id] || `${suggested.time} · ${suggested.team}` : '';
  $('open-next').disabled = !suggested;
  renderNav();
}

function renderNav() {
  const navButton = s => {
    const tasks = filterTasks(data, state, { section: s.id });
    const p = progress(tasks, state);
    return `<button data-section="${esc(s.id)}" class="${section === s.id ? 'active' : ''}" ${section === s.id ? 'aria-current="true"' : ''}><span>${esc(s.title)}</span><span class="nav-count">${p.percent}%</span></button>`;
  };
  $('section-nav').innerHTML = [...data.paths, { id: 'all', title: 'All sections' }].map(navButton).join('') +
    `<details class="section-library"><summary>Individual sections</summary>${data.sections.map(navButton).join('')}</details>`;
}

function taskCard(task) {
  const p = progress([task], state);
  const ready = prerequisites(task, data, state);
  const done = complete(task, state);
  const dependency = task.requires.length ? `<p class="dependency-note">${ready ? 'Done first:' : 'Do first:'} ${task.requires.map(id => {
    const t = data.tasks.find(t => t.id === id);
    return `<button data-task="${esc(id)}">${esc(t.title)}</button>`;
  }).join(' · ')}</p>` : '';
  const need = data.needs[task.id];
  return `<article class="task ${done ? 'done' : ''}" id="task-${esc(task.id)}"><div class="task-head"><label class="task-check" title="Check or uncheck all steps"><input type="checkbox" id="check-${esc(task.id)}" data-whole="${esc(task.id)}" aria-label="Complete task: ${esc(task.title)}" ${done ? 'checked' : ''}></label><details id="details-${esc(task.id)}"><summary><span><span class="task-title">${esc(task.title)}</span><span class="task-brief">${p.done}/${p.total} · ${esc(task.time)} · ${done ? 'Done' : ready ? task.team : 'Locked'}${task.tags.includes('Optional') ? ' · Optional' : ''}</span>${need ? `<span class="task-need">Need: ${esc(need)}</span>` : ''}</span></summary><div class="task-body">${!ready ? dependency : ''}<div class="step-list">${task.steps.map(s => `<label class="step" for="step-${esc(s.id)}"><input type="checkbox" id="step-${esc(s.id)}" data-step="${esc(s.id)}" aria-label="${esc(s.short || s.text)}" ${state.checks[s.id] ? 'checked' : ''}><span>${esc(s.short || s.text)}</span></label>`).join('')}</div><details class="task-reference"><summary>Details & sources</summary><p>${esc(task.why)}</p>${ready ? dependency : ''}<dl class="task-meta"><div><dt>Where / reward</dt><dd>${esc(task.location)} · ${esc(task.reward)}</dd></div><div><dt>RNG / schedule</dt><dd>${esc(task.gate)}</dd></div></dl>${task.steps.some(s => s.short) ? `<ol>${task.steps.map(s => `<li>${esc(s.text)}</li>`).join('')}</ol>` : ''}${task.note ? `<p>${esc(task.note)}</p>` : ''}<div class="source-links">${sourceLinks(task.sources)}</div></details></div></details></div></article>`;
}

function groups(tasks) {
  const first = data.sections.find(s => tasks.some(t => t.section === s.id && !complete(t, state)));
  return data.sections.map(s => {
    const items = tasks.filter(t => t.section === s.id);
    if (!items.length) return '';
    const p = progress(data.tasks.filter(t => t.section === s.id), state);
    return `<details class="chapter" id="chapter-${esc(s.id)}" ${s.id === first?.id ? 'open' : ''}><summary><span>${esc(s.title)}</span><span class="chapter-count">${p.percent}%</span></summary><div>${items.map(taskCard).join('')}</div></details>`;
  }).join('');
}

function renderTasks() {
  const open = [...document.querySelectorAll('#task-list details[open], #record-list details[open]')].map(d => d.id);
  const focus = document.activeElement?.id;
  const tasks = filterTasks(data, state, { section, search: $('search').value, tag: $('tag').value, status: $('status').value });
  $('list-title').textContent = section === 'all' ? 'All sections' : [...data.paths, ...data.sections].find(s => s.id === section).title;
  $('list-count').textContent = `${tasks.length} tasks shown`;
  $('task-list').innerHTML = view !== 'journey' ? '' : tasks.length ? groups(tasks) : '<p class="empty">No steps match these filters. Clear the filters to see the route again.</p>';
  $('record-list').innerHTML = view === 'record' ? groups(data.tasks.filter(t => ['raids', 'dungeons'].includes(t.section))) : '';
  for (const id of open) { const el = $(id); if (el) el.open = true; }
  for (const input of document.querySelectorAll('input[data-whole]')) {
    const t = data.tasks.find(t => t.id === input.dataset.whole);
    const p = progress([t], state);
    input.indeterminate = p.done > 0 && p.done < p.total;
  }
  if (focus) $(focus)?.focus({ preventScroll: true });
}

function renderResources() {
  $('resource-list').innerHTML = data.resources.map(r => {
    const value = state.quantities[r.id] ?? '';
    const target = r.target == null ? 'No fixed target' : 'Suggested goal: ' + r.target.toLocaleString();
    return `<article class="resource-card"><label for="quantity-${esc(r.id)}">${esc(r.name)}</label><input id="quantity-${esc(r.id)}" data-quantity="${esc(r.id)}" type="number" inputmode="numeric" min="0" step="1" placeholder="Unknown" value="${value}"><small class="quantity-status" data-resource-status="${esc(r.id)}">${quantityStatus(r, value)}</small><details><summary>Use & target</summary><p>${esc(r.use)}</p><small>${esc(target)} · ${r.cap == null ? 'Cap: confirm in-game' : 'Cap: ' + r.cap.toLocaleString()}</small>${sourceLinks([r.source])}</details></article>`;
  }).join('');
  $('needed-list').innerHTML = ['ciphers', 'exotic-engrams', 'credits', 'ingots'].map(id => {
    const r = data.resources.find(r => r.id === id);
    const value = state.quantities[id] ?? '';
    const goal = id === 'ciphers' || id === 'exotic-engrams' ? (complete(data.tasks.find(t => t.id === 'nighthawk-owned'), state) ? 'Nighthawk owned · no purchase needed' : 'Need 1 · only if Nighthawk is missing') : id === 'credits' ? 'A499 · check the Piker shop price' : 'Piker reputation · reach Rank 2';
    return `<label class="needed-field" for="need-${id}"><span>${esc(r.name)}</span><input id="need-${id}" data-quantity="${id}" type="number" min="0" step="1" inputmode="numeric" placeholder="Have?" value="${value}"><small>${esc(goal)}</small></label>`;
  }).join('');
}

function quantityStatus(resource, value) {
  if (value === '' || value === null || value === undefined) return 'Not checked yet';
  if (resource.cap != null && value > resource.cap) return 'Above listed cap · check this value';
  if (resource.target == null) return 'Recorded manually';
  return value >= resource.target ? 'Suggested goal reached' : (resource.target - value).toLocaleString() + ' below suggested goal';
}

function renderAll() { renderProgress(); renderTasks(); renderResources(); }

function selectView(name) {
  view = ['journey', 'loadouts', 'inventory', 'record', 'sources'].includes(name) ? name : 'journey';
  for (const element of document.querySelectorAll('.view')) element.hidden = element.id !== 'view-' + view;
  for (const element of document.querySelectorAll('[data-view]')) {
    element.classList.toggle('active', element.dataset.view === view);
    if (element.dataset.view === view) element.setAttribute('aria-current', 'page'); else element.removeAttribute('aria-current');
  }
  renderTasks();
}

function openSection(id) {
  if (id !== 'all' && ![...data.paths, ...data.sections].some(s => s.id === id)) return;
  section = id;
  $('search').value = '';
  $('tag').value = 'All';
  $('status').value = 'all';
  if (location.hash !== '#journey') history.replaceState(null, '', '#journey');
  selectView('journey');
  renderNav();
}

function openTask(id) {
  const t = data.tasks.find(t => t.id === id);
  if (!t) return;
  openSection(t.section);
  $('chapter-' + t.section).open = true;
  $('details-' + id).open = true;
  $('task-' + id).scrollIntoView({ block: 'start' });
  $('details-' + id).querySelector('summary').focus({ preventScroll: true });
}

function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-section], [data-task]');
  if (button?.dataset.section) { openSection(button.dataset.section); $('view-journey').scrollIntoView({ block: 'start' }); }
  if (button?.dataset.task) openTask(button.dataset.task);
});

document.addEventListener('change', event => {
  const input = event.target;
  if (input.dataset.step) { persist({ ...state, checks: { ...state.checks, [input.dataset.step]: input.checked } }); renderTasks(); renderResources(); }
  if (input.dataset.whole) { persist(setTask(state, data.tasks.find(t => t.id === input.dataset.whole), input.checked)); renderTasks(); renderResources(); }
  if (input.dataset.quantity) {
    const value = input.value.trim() === '' ? null : Number(input.value);
    if (value !== null && (!Number.isSafeInteger(value) || value < 0 || value > 1e9)) {
      input.value = state.quantities[input.dataset.quantity] ?? '';
      notify('Use a whole, non-negative number. The previous value was kept.');
      return;
    }
    persist({ ...state, quantities: { ...state.quantities, [input.dataset.quantity]: value } });
    const resource = data.resources.find(r => r.id === input.dataset.quantity);
    for (const status of document.querySelectorAll('[data-resource-status]')) if (status.dataset.resourceStatus === resource.id) status.textContent = quantityStatus(resource, value);
    for (const field of document.querySelectorAll('[data-quantity]')) if (field.dataset.quantity === resource.id) field.value = value ?? '';
  }
});

$('search').addEventListener('input', renderTasks);
$('tag').addEventListener('change', renderTasks);
$('status').addEventListener('change', renderTasks);
$('clear-filters').onclick = () => { $('search').value = ''; $('tag').value = 'All'; $('status').value = 'all'; renderTasks(); };
$('route').value = state.route;
$('route').onchange = () => { persist({ ...state, route: $('route').value }); notify('Later-route preference saved.'); };
$('open-next').onclick = () => { if (suggested) openTask(suggested.id); };
$('export').onclick = () => { download(exportState(state), `destiny-roadmap-progress-${new Date().toISOString().slice(0, 10)}.json`); notify('Backup download started. Keep it somewhere you can find later.'); };
$('import').onclick = () => { $('import-error').textContent = ''; $('import-file').value = ''; $('import-dialog').showModal(); };
$('confirm-import').onclick = async () => {
  const file = $('import-file').files[0];
  try {
    if (!file) throw new Error('Choose a JSON backup first.');
    if (file.size > MAX_IMPORT_BYTES) throw new Error('Backup is too large (maximum 1 MB).');
    const next = parseBackup(await file.text(), data);
    replaceState(next);
    $('import-dialog').close();
    notify('Backup imported. Checklist and inventory restored.');
  } catch (error) { $('import-error').textContent = error.message + ' Existing progress has not changed.'; }
};
$('reset').onclick = () => $('reset-dialog').showModal();
$('reset-dialog').addEventListener('close', () => {
  if ($('reset-dialog').returnValue !== 'reset') return;
  try { replaceState(freshState(data)); notify('Progress reset to the reported starting point.'); }
  catch { notify('Reset could not be saved. Existing progress has not changed.'); }
});

try { if (storage.getItem('destiny-roadmap:theme') === 'dark') document.documentElement.dataset.theme = 'dark'; } catch { /* preferences are optional */ }
function themeLabel() { const dark = document.documentElement.dataset.theme === 'dark'; $('theme').textContent = dark ? 'Day view' : 'Night view'; $('theme').setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'); }
$('theme').onclick = () => { const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; try { storage.setItem('destiny-roadmap:theme', theme); } catch { /* progress warning handles persistence */ } themeLabel(); };
themeLabel();

$('glossary').innerHTML = Object.entries(data.glossary).map(([term, meaning]) => `<details><summary>${esc(term)}</summary><p>${esc(meaning)}</p></details>`).join('');
$('source-list').innerHTML = Object.values(data.sources).map(s => `<article class="source-card"><a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.title)} ↗</a><p>${esc(s.kind)} · ${esc(s.date)}</p></article>`).join('');
window.addEventListener('hashchange', () => selectView(location.hash.slice(1)));
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY) return;
  try { state = event.newValue ? parseBackup(event.newValue, data) : freshState(data); recovery = null; saveMessage = 'Updated from another tab'; $('storage-warning').hidden = true; $('route').value = state.route; renderAll(); notify('Progress updated from another tab.'); }
  catch { recovery = event.newValue; saveMessage = 'Recovery needed · export a backup'; warn('Another tab saved an unreadable progress file. Export the recovery copy and your current progress before replacing it.'); renderProgress(); }
});
if (loaded.error) warn(loaded.error);
renderAll();
selectView(location.hash.slice(1) || 'journey');
