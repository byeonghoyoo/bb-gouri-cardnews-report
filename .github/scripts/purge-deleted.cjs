'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(process.cwd());
const BASE = path.join(ROOT, 'events-2026-12');
if (!path.basename(BASE).includes('events-2026-12')) throw new Error('unsafe base');
const API = process.env.REVIEW_API || 'https://bb-event-review-sync.beautyblossom.workers.dev';
const ORIGIN = process.env.REVIEW_ORIGIN || 'https://byeonghoyoo.github.io';
const HEADER = process.env.REVIEW_HEADER || 'event-review-2026';
const inside = p => { const r = path.resolve(p); return r === BASE || r.startsWith(BASE + path.sep); };
async function main() {
  const res = await fetch(API.replace(/\/$/, '') + '/v1/state', { headers: { Origin: ORIGIN, 'X-BB-Review': HEADER } });
  if (!res.ok) throw new Error(`state HTTP ${res.status}`);
  const state = await res.json();
  const deleted = Array.isArray(state.deleted) ? state.deleted : [];
  const ids = new Set(deleted.map(x => typeof x === 'string' ? x : x && x.id).filter(Boolean));
  if (!ids.size) return console.log('No deleted items.');
  const dataPath = path.join(BASE, 'data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const removed = data.items.filter(i => ids.has(i.id));
  const items = data.items.filter(i => !ids.has(i.id));
  const refs = new Set(items.map(i => i.page && i.page.split('/')[0]).filter(Boolean));
  const folders = [...new Set(removed.map(i => i.page && i.page.split('/')[0]).filter(Boolean))].filter(f => !refs.has(f));
  const next = { ...data, items, groups: (data.groups || []).map(g => ({ ...g, items: (g.items || []).filter(id => !ids.has(id)) })).filter(g => g.items.length) };
  let changed = JSON.stringify(data) !== JSON.stringify(next);
  if (changed) fs.writeFileSync(dataPath, JSON.stringify(next, null, 2) + '\n');
  for (const folder of folders) { const p = path.join(BASE, folder); if (!inside(p)) throw new Error('unsafe folder'); if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); changed = true; } }
  const logPath = path.join(BASE, 'deleted-log.json');
  const old = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf8')) : [];
  const seen = new Set(old.map(x => x.id));
  const now = new Date().toISOString();
  const log = old.concat([...ids].filter(id => !seen.has(id)).map(id => ({ id, at: now })));
  if (JSON.stringify(log) !== JSON.stringify(old)) { fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + '\n'); changed = true; }
  console.log(JSON.stringify({ changed, removed: removed.map(i => i.id), folders }, null, 2));
}
main().catch(e => { console.error(e.stack || e); process.exit(1); });
