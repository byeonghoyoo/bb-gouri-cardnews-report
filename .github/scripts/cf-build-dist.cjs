'use strict';
// 2026-11-10: builds dist/ for the Cloudflare Pages project bb-event-review from this repository.
// Same rules as the lead's local tool (ops/cf-pages/build-dist.cjs): copy the board and the language worktree,
// rewrite old GitHub absolute links to site-root paths, add the root redirect, robots.txt and _headers.
const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const ABS = 'https://byeonghoyoo.github.io/bb-gouri-cardnews-report/';
fs.rmSync(DIST, { recursive: true, force: true });
for (const sub of ['events-2026-12', 'langverify-2026']) {
  fs.cpSync(path.join(ROOT, sub), path.join(DIST, sub), { recursive: true, filter: (s) => !/\.sync-conflict-/.test(s) });
}
let files = 0, hits = 0, total = 0;
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    total++;
    if (!/\.(html|js|json|css)$/i.test(e.name)) continue;
    const t = fs.readFileSync(p, 'utf8');
    if (!t.includes(ABS)) continue;
    hits += t.split(ABS).length - 1; files++;
    fs.writeFileSync(p, t.split(ABS).join('/'));
  }
};
walk(DIST);
fs.writeFileSync(path.join(DIST, 'index.html'), '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Beauty Blossom 이벤트 검토</title><script>location.replace("/events-2026-12/"+location.hash)</script><a href="/events-2026-12/">이벤트 검토 보드로 이동</a>\n');
fs.writeFileSync(path.join(DIST, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
fs.writeFileSync(path.join(DIST, '_headers'), '/*\n  Cache-Control: no-cache\n  X-Robots-Tag: noindex, nofollow\n');
console.log(`dist: ${total} files, rewrote ${hits} links in ${files} files`);