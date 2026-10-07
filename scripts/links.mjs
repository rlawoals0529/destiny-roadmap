import data from '../data.js';
const entries = Object.entries(data.sources);
const results = [];
for (let i = 0; i < entries.length; i += 4) {
  await Promise.all(entries.slice(i, i + 4).map(async ([id, source]) => {
    try {
      const response = await fetch(source.url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'DestinyRoadmap-LinkCheck/1.0' } });
      const body = await response.text();
      const status = response.status;
      const checked = status >= 200 && status < 400;
      results.push({ id, status, result: checked ? 'reachable' : [401,403,429].includes(status) ? 'blocked, not classified as broken' : 'needs review', bytes: body.length });
    } catch (error) { results.push({ id, result: 'unavailable: ' + error.name }); }
  }));
}
const reachable = results.filter(r => r.result === 'reachable');
console.log(`${reachable.length}/${results.length} external sources returned a successful HTTP response.`);
for (const r of results.filter(r => r.result !== 'reachable')) console.log(JSON.stringify(r));
if (results.some(r => r.status === 404 || r.status === 410)) process.exitCode = 1;
