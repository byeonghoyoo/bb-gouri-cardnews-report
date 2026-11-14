(function (root, factory) {
  'use strict';
  var api = factory(typeof module === 'object' && module.exports ? require('./text-format.js') : root.BBTextFormat);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.ReviewApp = api;
    if (root.document && !root.__REVIEW_NO_AUTOSTART) api.boot(root);
  }
})(typeof self !== 'undefined' ? self : this, function (Format) {
  'use strict';

  /* ------------------------------------------------------------ constants */
  var DEFAULT_API = 'https://bb-event-review-sync.beautyblossom.workers.dev';
  var HEADER_NAME = 'X-BB-Review';
  var HEADER_VALUE = 'event-review-2026';
  var MAX_LEN = 2000;
  var POLL_MS = 15000;
  var AUTHOR_KEY = 'bb-review-author';
  var FOLD_KEY = 'bb-review-folded';
  var EXPECTED_ITEMS = []; /* 2026-11-09: the original 7 test items were deleted and purged from data.json; no item is required any more */
  var PLAN_REQUIRED = ['heroEyebrow', 'title', 'subtitle', 'body'];
  var FIELD_RE = /^[A-Za-z0-9_]+$/;
  var ID_RE = /^[A-Za-z0-9]+$/;
  var LOCALE_RE = /^[A-Z]{2}$/;
  /* v4 (2026-11-04, v4/events/BOARD_V4_PLAN.md): mode tabs, hero/2nd-section A/B, pinned comments, beauty-app tab */
  var BOARD_V = '20261109-type1'; /* 2026-11-06: left review list scrolls on its own and reveals the current item */
  var PAGE_V = '&v=20261109-type1'; /* cache version of the own-page iframes (qa/v2-cache.test.cjs) */
  var VARIANT_SLOTS = [1, 2];
  var COMMENT_SAVE_MS = 800;
  var COMMENT_MAX = 4000;
  /* 2026-11-06 team: "큰 이미지 안 들어감". The file itself is uploaded (no base64) up to 10MB; PNG/JPEG/WebP within 24MP and 16384px a side (tall page captures) go as they are. */
  var IMG_MAX_SIDE = 16384, IMG_MAX_PIXELS = 24000000, IMG_Q = 0.9, IMG_MAX_BYTES = 10 * 1024 * 1024, IMG_KEEP_TYPES = ['image/png', 'image/jpeg', 'image/webp'], IMG_PER_COMMENT = 8;
  /* downloads from the share server are slow from Korea (about 65KB/s): images above 64KB also get a 320px center-square preview for the card */
  var IMG_PREVIEW_SIDE = 320, IMG_PREVIEW_MIN = 64 * 1024;
  /* keep the original file, or the scale to redraw it at (JPEG) */
  function imagePlan(w, h, type, size) {
    if (IMG_KEEP_TYPES.indexOf(type) >= 0 && size <= IMG_MAX_BYTES && w * h <= IMG_MAX_PIXELS && Math.max(w, h) <= IMG_MAX_SIDE) return { keep: true, scale: 1 };
    return { keep: false, scale: Math.min(1, Math.sqrt(IMG_MAX_PIXELS / Math.max(1, w * h)), IMG_MAX_SIDE / Math.max(1, w, h)) };
  }
  var STATUS_COLOR = { open: '#E5484D', question: '#F5A524', done: '#30A46C' };
  var STATUS_NAME = { open: '요청', question: '확인 필요', done: '적용완료' };
  var MB = 1000000;
  /* beauty-app downloads: one design, three download shapes (plan section 1 and 7) */
  var APP_PLATFORMS = [
    { id: 'gangnam', label: '강남언니', width: 1080, thumb: 1080, card: true, maxH: 16000, maxBytes: 5 * MB, thumbMax: 5 * MB, order: 'split' },
    { id: 'babitalk', label: '바비톡', width: 800, thumb: 800, card: false, maxH: 30000 /* no platform limit; browser canvas limit */, maxBytes: 5 * MB, thumbMax: 2 * MB, order: 'quality' },
    { id: 'yeoshin', label: '여신티켓', width: 1080, thumb: 1080, card: false, maxH: 16000, maxBytes: 5 * MB, thumbMax: 5 * MB, order: 'split' },
  ];
  var QUALITY_LADDER = [0.92, 0.85, 0.78, 0.7, 0.62, 0.55];
  var APP_SPEC_ROWS = [
    ['강남언니', '1080×1080 권장', '카드 1080×470 권장 (상세 상단)', '장당 최대 1080×16000px · 5MB, 여러 장', '미용 시술 VAT 포함 필수 · 할인 49% 이하 · 이미지 속 금액 항목은 모두 옵션 등록 · 이미지 속 기간 = 설정 기간'],
    ['바비톡', '800×800 · 2MB 이하', '없음', '800×길이 제한 없음 · 5MB 이하', '정상가·이벤트가 VAT 포함 등록(2025-05-19부터) · 썸네일·상세 이미지에 VAT 포함 표기 · 49% 초과 불가 · 옵션명에 회차 문구 금지'],
    ['여신티켓', '1080×1080 (등록 이미지 실측)', '없음', '가로 1080 (병원 소개 이미지 1080×5000 실측)', '앱이 VAT 포함 가격 표기'],
  ];

  /* ------------------------------------------------------------ pure helpers */
  function cellKey(itemId, locale, field) { return itemId + '.' + locale + '.' + field; }
  function selectedKey(itemId, locale) { return cellKey(itemId, locale, 'selected'); }
  /* 2026-11-06 team: items whose feedback round is finished show a pink title in the list ('done' or '') */
  function feedbackKey(itemId) { return cellKey(itemId, 'KO', 'feedback_done'); }
  /* A/B choice of the hero (1) and the 2nd section (2) is language-common and saved on the KO cell */
  function variantKey(itemId, slot) { return cellKey(itemId, 'KO', 'variant_c' + slot); }
  function normVariant(v) { return v === 'b' ? 'b' : 'a'; }
  function slotName(n) { return n === 1 ? '히어로(1장)' : '2번 섹션(2장)'; }
  function parseHash(hash) {
    var m = /^#?([A-Za-z0-9]+)\/([A-Z]{2})(?:\/(app|dl))?$/.exec(hash || '');
    return m ? { item: m[1], locale: m[2], mode: m[3] === 'app' ? 'app' : m[3] === 'dl' ? 'download' : 'home' } : null;
  }
  /* ?api=http://127.0.0.1:8787 points the board at a local test server; any other host is ignored */
  function apiFromSearch(search) {
    var q, u;
    try { q = new URLSearchParams(search || '').get('api'); } catch (e) { return null; }
    if (!q) return null;
    try { u = new URL(q); } catch (e) { return null; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return null;
    if (u.username || u.password || u.search || u.hash) return null;
    return (u.origin + u.pathname).replace(/\/+$/, '');
  }
  function clamp01(v) { v = Number(v); return isFinite(v) ? Math.min(1, Math.max(0, v)) : 0; }
  function round4(v) { return Math.round(v * 10000) / 10000; }
  function fitLong(w, h, max) { var s = Math.min(1, max / Math.max(w, h, 1)); return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) }; }
  function commentCounts(list) {
    var c = { open: 0, question: 0, done: 0, total: 0 };
    (list || []).forEach(function (x) { if (!x || x.status === 'deleted') return; c.total++; if (typeof c[x.status] === 'number') c[x.status]++; });
    return c;
  }
  function commentAsset(c) { var a = c && c.target && c.target.asset; return a === 'thumb' || a === 'card' ? a : null; }
  function cardLabel(c) {
    if (!c) return '';
    if (c.mode === 'app' && !c.card) return commentAsset(c) === 'card' ? '카드 이미지 1080×470' : commentAsset(c) === 'thumb' ? '대표 이미지 1:1' : '페이지 전체';
    if (!c.card) return '페이지 전체';
    var v = c.variant === 'b' ? 'B안' : 'A안';
    if (c.card === 1) return '1장 히어로 ' + v;
    if (c.card === 2) return '2장 2번 섹션 ' + v;
    return c.card + '장';
  }
  /* group consecutive detail cards into pieces no taller than maxH; a card taller than maxH is cut into rows */
  function planPieces(heights, maxH) {
    var pieces = [], cur = [], curH = 0;
    (heights || []).forEach(function (h, i) {
      if (h > maxH) {
        if (cur.length) { pieces.push(cur); cur = []; curH = 0; }
        for (var y = 0; y < h; y += maxH) pieces.push([{ i: i, y: y, h: Math.min(maxH, h - y) }]);
        return;
      }
      if (cur.length && curH + h > maxH) { pieces.push(cur); cur = []; curH = 0; }
      cur.push({ i: i, y: 0, h: h }); curH += h;
    });
    if (cur.length) pieces.push(cur);
    return pieces;
  }
  function splitPiece(piece) {
    if (piece.length > 1) { var k = Math.ceil(piece.length / 2); return [piece.slice(0, k), piece.slice(k)]; }
    var s = piece[0], h1 = Math.ceil(s.h / 2);
    return [[{ i: s.i, y: s.y, h: h1 }], [{ i: s.i, y: s.y + h1, h: s.h - h1 }]];
  }
  function crc32(bytes) {
    var table = crc32.table || (crc32.table = (function () { var t = [], n, k; for (n = 0; n < 256; n++) { k = n; for (var j = 0; j < 8; j++) k = (k & 1) ? (0xedb88320 ^ (k >>> 1)) : (k >>> 1); t[n] = k >>> 0; } return t; })());
    var c = 0xffffffff; for (var i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0;
  }
  function utf8Bytes(s) { return new TextEncoder().encode(String(s)); }
  /* uncompressed (stored) ZIP with UTF-8 names: the JPEGs inside are already compressed */
  function zipStore(files, when) {
    var d = when instanceof Date ? when : new Date();
    var time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | (Math.floor(d.getSeconds() / 2) & 31);
    var date = (((Math.max(1980, d.getFullYear()) - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
    var parts = [], central = [], offset = 0;
    files.forEach(function (f) {
      var name = utf8Bytes(f.name), data = f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data), crc = crc32(data);
      var lh = new Uint8Array(30 + name.length), v = new DataView(lh.buffer);
      v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(8, 0, true);
      v.setUint16(10, time, true); v.setUint16(12, date, true); v.setUint32(14, crc, true);
      v.setUint32(18, data.length, true); v.setUint32(22, data.length, true); v.setUint16(26, name.length, true); v.setUint16(28, 0, true);
      lh.set(name, 30);
      var ch = new Uint8Array(46 + name.length), c = new DataView(ch.buffer);
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      ch.set(name, 46);
      parts.push(lh, data); central.push(ch); offset += lh.length + data.length;
    });
    var cdSize = central.reduce(function (s, x) { return s + x.length; }, 0);
    var end = new Uint8Array(22), e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
    var all = parts.concat(central, [end]), out = new Uint8Array(offset + cdSize + 22), p = 0;
    all.forEach(function (x) { out.set(x, p); p += x.length; });
    return out;
  }
  function clampTarget(t) {
    var keys = ['text', 'copyText', 'priceText', 'image', 'price', 'copy', 'label'], lim = 120;
    var size = function () { return utf8Bytes(JSON.stringify(t)).length; };
    while (size() > 2000 && lim >= 8) { keys.forEach(function (k) { if (typeof t[k] === 'string' && t[k].length > lim) t[k] = t[k].slice(0, lim); }); lim = Math.floor(lim / 2); }
    return t;
  }

  function fieldKind(name) {
    if (/price/i.test(name)) return 'price';
    if (/(^|_)vat\d*$/i.test(name)) return 'price-note';
    return 'copy';
  }

  function isMultiline(name, value) {
    var v = value == null ? '' : String(value);
    return v.indexOf('\n') >= 0 || v.length > 80 ||
      /^(body|concept|audience|approval\d+|condition\d+|offer\d+_detail)$/.test(name);
  }

  function collectNumbered(fields, prefix) {
    var re = new RegExp('^' + prefix + '(\\d+)$');
    return Object.keys(fields || {}).map(function (k) {
      var m = re.exec(k); return m ? { n: Number(m[1]), field: k } : null;
    }).filter(Boolean).sort(function (a, b) { return a.n - b.n; });
  }

  /* 2026-11-11 print sheets (team: "A4 출력 시 이미지가 잘립니다, PNG·PDF 모두 여유 공간 없이 출력" + "A6도 낱장으로"): 300dpi paper,
     a white outer margin (default 10mm, office printers never reach it), a rounded panel inside it and the 4:5 cards in the grid that makes them largest. */
  var PAPERS = {
    a4: { id: 'a4', label: 'A4', mm: [210, 297], w: 2480, h: 3508, pt: [595.28, 841.89] },
    a6: { id: 'a6', label: 'A6', mm: [105, 148], w: 1240, h: 1748, pt: [297.64, 419.53] },
  };
  function mmPx(mm) { return Math.round(mm * 300 / 25.4); }
  function sheetLayout(n, paperId, marginMm, aspect) {
    var P = PAPERS[paperId] || PAPERS.a4, m = mmPx(Math.max(0, Number(marginMm) || 0)), ar = aspect || 1350 / 1080;
    n = Math.max(0, Number(n) || 0);
    var panel = { x: m, y: m, w: P.w - 2 * m, h: P.h - 2 * m }, pad = Math.round(Math.min(panel.w, panel.h) * 0.035), gap = Math.round(P.w * 0.024);
    var inner = { x: panel.x + pad, y: panel.y + pad, w: panel.w - 2 * pad, h: panel.h - 2 * pad }, out = { paper: P, margin: m, panel: panel, boxes: [] };
    if (!n) return out;
    var best = null;
    for (var cols = 1; cols <= Math.min(n, 4); cols++) {
      var rows = Math.ceil(n / cols), cw = Math.min((inner.w - (cols - 1) * gap) / cols, (inner.h - (rows - 1) * gap) / rows / ar);
      if (!best || cw > best.w + 0.5) best = { cols: cols, rows: rows, w: cw };
    }
    var w = Math.floor(best.w), h = Math.floor(best.w * ar), totalH = best.rows * h + (best.rows - 1) * gap, y0 = inner.y + Math.floor((inner.h - totalH) / 2);
    for (var i = 0; i < n; i++) {
      var row = Math.floor(i / best.cols), count = row === best.rows - 1 && n % best.cols ? n % best.cols : best.cols, rowW = count * w + (count - 1) * gap, col = i % best.cols;
      out.boxes.push({ x: inner.x + Math.floor((inner.w - rowW) / 2) + col * (w + gap), y: y0 + row * (h + gap), w: w, h: h });
    }
    return out;
  }
  function a4Layout(n, marginMm) { return sheetLayout(n, 'a4', marginMm == null ? 10 : marginMm).boxes; }

  function collectOffers(fields) {
    var byN = {};
    Object.keys(fields || {}).forEach(function (k) {
      var m = /^offer(\d+)_(title|detail|price|vat)$/.exec(k);
      if (!m) return;
      var n = Number(m[1]);
      byN[n] = byN[n] || { n: n, title: null, detail: null, price: null, vat: null };
      byN[n][m[2]] = k;
    });
    return Object.keys(byN).map(Number).sort(function (a, b) { return a - b; }).map(function (n) { return byN[n]; });
  }

  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

  function validateData(data) {
    if (!isObj(data)) return ['data.json 형식 오류: 최상위가 객체가 아닙니다.'];
    var errs = [];
    var locales = Array.isArray(data.locales) ? data.locales : null;
    var items = Array.isArray(data.items) ? data.items : null;
    if (!locales || !locales.length) errs.push('data.json 형식 오류: locales 배열이 없거나 비어 있습니다.');
    if (!items || !items.length) errs.push('data.json 형식 오류: items 배열이 없거나 비어 있습니다.');
    if (!locales || !items) return errs;
    locales.forEach(function (l, i) {
      if (!isObj(l) || !LOCALE_RE.test(l.id || '') || !l.label) errs.push('locales[' + i + '] 형식 오류 (id 두 자리 대문자, label 필요)');
    });
    var ids = items.map(function (it) { return it && it.id; });
    EXPECTED_ITEMS.forEach(function (id) { if (ids.indexOf(id) < 0) errs.push('항목 누락: ' + id); });
    items.forEach(function (it, i) {
      if (!isObj(it) || !ID_RE.test(it.id || '')) { errs.push('items[' + i + '] id 형식 오류'); return; }
      if (it.kind !== 'aptos' && it.kind !== 'plan' && it.kind !== 'landing') errs.push(it.id + ': kind는 aptos, landing 또는 plan이어야 합니다.');
      if (!isObj(it.fields)) { errs.push(it.id + ': fields 객체 없음'); return; }
      /* 2026-11-02: an item may list only the locales it already has (winter events start Korean-only) */
      var only = Array.isArray(it.locales) ? it.locales : null;
      if (only && (!only.length || only.some(function (x) { return !locales.some(function (l) { return isObj(l) && l.id === x; }); }))) errs.push(it.id + ': locales 형식 오류');
      locales.forEach(function (l) {
        if (!isObj(l)) return;
        if (only && only.indexOf(l.id) < 0) return;
        var f = it.fields[l.id];
        var tag = it.id + ' ' + l.id + ': ';
        if (!isObj(f) || !Object.keys(f).length) { errs.push(tag + '언어판 데이터 없음'); return; }
        Object.keys(f).forEach(function (k) {
          if (!FIELD_RE.test(k)) errs.push(tag + '잘못된 필드명 "' + k + '"');
          else if (typeof f[k] !== 'string') errs.push(tag + '문자열이 아닌 값 ' + k);
        });
        if (it.kind !== 'plan' && it.kind !== 'landing') return;
        if (typeof it.page === 'string' && it.page) return; /* own-page designs (EXAM, V3) use their own copy keys */
        PLAN_REQUIRED.forEach(function (k) { if (!(k in f)) errs.push(tag + '필수 필드 누락 ' + k); });
        var offers = collectOffers(f);
        if (offers.length < 3) errs.push(tag + '오퍼가 3개 미만입니다 (' + offers.length + '개)');
        if (offers.length > 5) errs.push(tag + '오퍼가 5개를 넘습니다 (' + offers.length + '개)');
        offers.forEach(function (o) {
          ['title', 'price'].forEach(function (p) { if (!o[p]) errs.push(tag + '필수 필드 누락 offer' + o.n + '_' + p); });
        });
        if (!collectNumbered(f, 'condition').length) errs.push(tag + '필수 필드 누락 condition1');
      });
    });
    return errs;
  }

  /* ------------------------------------------------------------ store */
  function createStore(opts) {
    var base = String(opts.api || '').replace(/\/+$/, '');
    var doFetch = opts.fetch;
    var HEAD = {}; HEAD[HEADER_NAME] = HEADER_VALUE;
    var store = {
      status: 'loading', online: true, cells: {}, deleted: [], error: null, lastSync: null,
      canEdit: function () { return store.status === 'ready'; },
      get: function (k) { return store.cells[k]; },
      value: function (k, def) { var c = store.cells[k]; return c && typeof c.value === 'string' ? c.value : def; },
      isDeleted: function (itemId) { return store.deleted.some(function (d) { return (d && d.id) === itemId || d === itemId; }); },
      isSelected: function (itemId, locale) {
        var c = store.cells[selectedKey(itemId, locale)];
        return !!c && (c.value === true || c.value === 'true');
      },
      adopt: function (k, cell) { if (cell && typeof cell === 'object') store.cells[k] = cell; },
    };

    function fetchState() {
      return doFetch(base + '/v1/state', { headers: Object.assign({}, HEAD), cache: 'no-store' }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }).then(function (body) {
        if (!body || !isObj(body.cells)) throw new Error('응답 형식 오류');
        return { cells: body.cells, deleted: Array.isArray(body.deleted) ? body.deleted : [] };
      });
    }

    store.load = function () {
      return fetchState().then(function (remote) {
        store.cells = remote.cells; store.deleted = remote.deleted; store.status = 'ready'; store.online = true; store.error = null; store.lastSync = new Date();
        return true;
      }, function (e) { store.status = 'error'; store.error = e && e.message || String(e); return false; });
    };

    store.refresh = function (o) {
      var skip = (o && o.skipKeys) || [];
      return fetchState().then(function (remote) {
        var changed = [];
        Object.keys(remote.cells).forEach(function (k) {
          if (skip.indexOf(k) >= 0) return;
          var old = store.cells[k];
          if (!old || old.revision !== remote.cells[k].revision || old.value !== remote.cells[k].value) { store.cells[k] = remote.cells[k]; changed.push(k); }
        });
        store.deleted = remote.deleted;
        store.status = 'ready'; store.online = true; store.error = null; store.lastSync = new Date();
        return changed;
      }, function () { store.online = false; return []; });
    };

    store.remove = function (targets, pin, by) {
      var headers = Object.assign({ 'Content-Type': 'application/json' }, HEAD);
      return doFetch(base + '/v1/delete', { method: 'POST', headers: headers, body: JSON.stringify({ targets: targets, pin: pin, by: by }) }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok) return { ok: false, status: res.status, body: body };
          store.deleted = Array.isArray(body.deleted) ? body.deleted : store.deleted;
          return { ok: true, deleted: store.deleted };
        });
      }, function () { return { ok: false, status: 0 }; });
    };

    store.save = function (key, value, by, o) {
      if (!store.canEdit()) return Promise.resolve({ ok: false, reason: 'locked' });
      if (typeof value === 'string' && value.length > MAX_LEN) return Promise.resolve({ ok: false, reason: 'toolong' });
      var existing = store.cells[key];
      var baseRevision = o && typeof o.baseRevision === 'number' ? o.baseRevision : (existing && existing.revision) || 0;
      var headers = Object.assign({ 'Content-Type': 'application/json' }, HEAD);
      return doFetch(base + '/v1/cell', { method: 'POST', headers: headers, body: JSON.stringify({ key: key, value: value, baseRevision: baseRevision, by: by }) })
        .then(function (res) {
          if (res.status === 409) {
            return res.json().then(function (b) { return b; }, function () { return {}; }).then(function (b) {
              return { ok: false, reason: 'conflict', current: b && b.current };
            });
          }
          if (!res.ok) return { ok: false, reason: 'http', status: res.status };
          return res.json().then(function (b) {
            if (!b || !isObj(b.cell)) return { ok: false, reason: 'badresponse' };
            store.cells[key] = b.cell; store.online = true; store.lastSync = new Date();
            return { ok: true, cell: b.cell };
          });
        }, function () { store.online = false; return { ok: false, reason: 'network' }; });
    };
    return store;
  }

  /* comment API (plan section 5). Every call resolves to { ok, status, body }; a network error is status 0. */
  function createCommentApi(opts) {
    var base = String(opts.api || '').replace(/\/+$/, '');
    var doFetch = opts.fetch;
    var HEAD = {}; HEAD[HEADER_NAME] = HEADER_VALUE;
    function call(method, path, body) {
      var o = { method: method, headers: Object.assign({}, HEAD), cache: 'no-store' };
      if (body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
      return Promise.resolve().then(function () { return doFetch(base + path, o); }).then(function (res) {
        return Promise.resolve().then(function () { return res.json(); }).then(function (b) { return b; }, function () { return null; })
          .then(function (b) { return { ok: !!res.ok, status: res.status, body: b }; });
      }, function () { return { ok: false, status: 0, body: null }; });
    }
    return {
      base: base,
      list: function (item) { return call('GET', '/v1/comments?item=' + encodeURIComponent(item)); },
      summary: function () { return call('GET', '/v1/comments/summary'); },
      create: function (b) { return call('POST', '/v1/comments', b); },
      update: function (b) { return call('POST', '/v1/comments/update', b); },
      image: function (b) { return call('POST', '/v1/comments/image', b); },
      imageRaw: function (m, blob) {
        var qs = '?commentId=' + encodeURIComponent(m.commentId) + '&mime=' + encodeURIComponent(m.mime) + '&w=' + m.w + '&h=' + m.h + '&by=' + encodeURIComponent(m.by || '');
        var o = { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/octet-stream' }, HEAD), cache: 'no-store', body: blob };
        return Promise.resolve().then(function () { return doFetch(base + '/v1/comments/image/raw' + qs, o); }).then(function (res) {
          return Promise.resolve().then(function () { return res.json(); }).then(function (b) { return b; }, function () { return null; })
            .then(function (b) { return { ok: !!res.ok, status: res.status, body: b }; });
        }, function () { return { ok: false, status: 0, body: null }; });
      },
      imageDelete: function (b) { return call('POST', '/v1/comments/image/delete', b); },
      imagePreview: function (id, blob) {
        var o = { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/octet-stream' }, HEAD), cache: 'no-store', body: blob };
        return Promise.resolve().then(function () { return doFetch(base + '/v1/comments/image/preview?id=' + encodeURIComponent(id), o); })
          .then(function (res) { return { ok: !!res.ok, status: res.status }; }, function () { return { ok: false, status: 0 }; });
      },
      imageUrl: function (id, size) { return base + '/v1/comments/image?id=' + encodeURIComponent(id) + (size ? '&size=' + encodeURIComponent(size) : ''); },
    };
  }

  function effectiveFields(item, locale, store) {
    var out = {}; var f = (item.fields && item.fields[locale]) || {};
    Object.keys(f).forEach(function (k) { out[k] = store.value(cellKey(item.id, locale, k), f[k]); });
    return out;
  }

  function effectiveFormats(item, locale, store) {
    var out = {home:{},line:{},kakao:{},app:{}};
    if(!Format || !item)return out;
    var fields = effectiveFields(item,locale,store);
    Format.scopes.forEach(function(scope){Object.keys(fields).forEach(function(field){var x=Format.decode(store.value(cellKey(item.id,locale,Format.key(field,scope)),''),String(fields[field]));if(x&&!Format.isDefault(x))out[scope][field]=x;});});
    Format.scopes.forEach(function(scope){var prefix=item.id+'.'+locale+'.fmt_'+scope+'_';Object.keys(store.cells||{}).forEach(function(k){if(k.indexOf(prefix)!==0)return;var name=k.slice(prefix.length),at=name.lastIndexOf('__');if(at<0)return;var field=name.slice(0,at),slot=name.slice(at+2);if(!Object.prototype.hasOwnProperty.call(fields,field)||!Format.validSlot(slot))return;var value=store.value(k,''),x=value===''?Format.empty(String(fields[field])):Format.decode(value,String(fields[field]));if(x)out[scope][name]=x;});});
    return out;
  }

  /* 2026-11-12 picture layers moved/resized in 편집 모드: <ID>.<LOC>.lay_<scope>_<picture key>__<slot> = "x,y,s" (design px, scale). Sent to every frame. */
  var LAYOUT_RE = /^lay_(home|line|kakao|app)_([A-Za-z][A-Za-z0-9_-]*)__((?:c\d{1,2}[ab]p\d{1,2}n\d{1,3}|app(?:thumb|card|detail)n\d{1,3}|rootn\d{1,3}))$/;
  var LAYOUT_VALUE_RE = /^-?\d{1,4}(?:\.\d{1,2})?,-?\d{1,4}(?:\.\d{1,2})?,\d(?:\.\d{1,3})?(?:,0)?$/; /* ",0" = hidden layer */
  function layoutValueOk(v) { if (v === '') return true; if (!LAYOUT_VALUE_RE.test(v)) return false; var s = Number(v.split(',')[2]); return s >= 0.2 && s <= 4; }
  function effectiveLayouts(item, locale, store) {
    var out = { home: {}, line: {}, kakao: {}, app: {} };
    if (!item || !store || !store.cells) return out;
    var prefix = item.id + '.' + locale + '.';
    Object.keys(store.cells).forEach(function (k) {
      if (k.indexOf(prefix + 'lay_') !== 0) return;
      var name = k.slice(prefix.length), m = LAYOUT_RE.exec(name), v = store.value(k, '');
      if (!m || !v || !layoutValueOk(v)) return;
      out[m[1]][name] = v;
    });
    return out;
  }

  function hasLocale(item, locale) { return !Array.isArray(item.locales) || item.locales.indexOf(locale) >= 0; }

  function buildExport(data, store) {
    return {
      items: data.items.map(function (item) {
        var locales = {};
        data.locales.forEach(function (l) {
          if (!hasLocale(item, l.id)) return;
          locales[l.id] = { selected: store.isSelected(item.id, l.id), fields: effectiveFields(item, l.id, store), formats: effectiveFormats(item,l.id,store) };
        });
        var variants = {};
        VARIANT_SLOTS.forEach(function (n) { variants['c' + n] = normVariant(store.value(variantKey(item.id, n), 'a')); });
        return { id: item.id, label: item.label, kind: item.kind, variants: variants, locales: locales };
      }),
    };
  }

  function reasonMessage(r) {
    switch (r.reason) {
      case 'locked': return '공유 서버에 연결되지 않아 저장할 수 없습니다 (편집 잠금).';
      case 'toolong': return '2000자를 넘어 저장할 수 없습니다.';
      case 'network': return '네트워크 오류로 서버에 저장되지 않았습니다.';
      case 'http': return '서버가 저장을 거부했습니다 (HTTP ' + r.status + ').';
      case 'conflict': return '다른 사람이 먼저 수정했습니다 (충돌).';
      default: return '서버 응답을 확인할 수 없어 저장되지 않았습니다.';
    }
  }

  /* ------------------------------------------------------------ DOM helper */
  function h(doc, tag, props, kids) {
    var el = doc.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    [].concat(kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c);
    });
    return el;
  }

  /* ------------------------------------------------------------ app */
  function createApp(env) {
    var doc = env.document;
    var H = function (tag, props, kids) { return h(doc, tag, props, kids); };
    var store = createStore({ api: env.api || DEFAULT_API, fetch: env.fetch });
    var setTimer = env.setTimeout || function (fn, ms) { return setTimeout(fn, ms); };
    var state = {
      data: null, errors: [], fatal: null, itemId: null, locale: null, author: '', editor: null,
      saving: 0, aptos: null, frames: [], previewKey: null, toastTimer: null, started: false, capture: null,
      mode: 'home', slides: {}, summary: {}, summaryOk: null, drafts: {}, appView: null, designBox: null, ctx: null, viewTimer: null,
      cm: { itemId: null, list: [], loaded: false, loading: false, error: null, status: 0, active: null, token: 0, dirtyPanel: false },
    };
    var ui = {};
    var capi = createCommentApi({ api: env.api || DEFAULT_API, fetch: env.fetch });
    /* 2026-11-09 user: "잘못 수정했을 때 되돌리기 가능하게 컨트롤+Z" (a team member merged two lines of a price name by mistake and
       could not get them back). Wording saved from this tab (in-place page edits and the edit dialog) is remembered here;
       Ctrl+Z writes the previous text back to the shared server and Ctrl+Shift+Z / Ctrl+Y writes it again. A change somebody
       else saved afterwards is never overwritten (the cell revision must still be ours). Kept per tab in sessionStorage. */
    var UNDO_KEY = 'bb-review-undo-v1', UNDO_MAX = 50;
    state.undo = { done: [], redo: [] }; state.undoBusy = false;
    try { var undo0 = env.session && JSON.parse(env.session.getItem(UNDO_KEY) || 'null'); if (undo0 && Array.isArray(undo0.done) && Array.isArray(undo0.redo)) state.undo = { done: undo0.done.slice(-UNDO_MAX), redo: undo0.redo.slice(-UNDO_MAX) }; } catch (e) { /* start with an empty history */ }
    var win0 = doc.defaultView || null; /* null in the unit-test DOM */

    try { state.author = (env.storage && env.storage.getItem(AUTHOR_KEY)) || ''; } catch (e) { state.author = ''; }

    function by() { return state.author || '익명'; }
    function item() { return state.data && state.data.items.filter(function (i) { return i.id === state.itemId && !store.isDeleted(i.id); })[0]; }
    function localeObj(id) { return state.data.locales.filter(function (l) { return l.id === id; })[0]; }
    function origin() { return (env.location && env.location.origin) || ''; }

    function keepUndo() { try { if (env.session) env.session.setItem(UNDO_KEY, JSON.stringify(state.undo)); } catch (e) { /* storage blocked: the history still works in this page */ } }
    function rememberEdit(e) {
      if (!e || (!e.changes && e.before === e.after)) return;
      state.undo.done.push(e); if (state.undo.done.length > UNDO_MAX) state.undo.done.shift();
      state.undo.redo = []; keepUndo();
    }
    function shortText(v) { v = String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); return v ? (v.length > 18 ? v.slice(0, 17) + '…' : v) : '(빈 칸)'; }
    function itemName(id) { var it = state.data && state.data.items.filter(function (i) { return i.id === id; })[0]; return it && it.label ? it.label : id; }
    function refreshAfterUndo(itemId) {
      if (state.aptos && state.aptos.itemId === itemId) postAptosData();
      else if (state.itemId === itemId && !state.aptos) renderPreview();
      renderSidebar(); renderStatus();
    }
    /* one step back (redo=false) or forward (redo=true) through this tab's saved wording changes */
    function stepUndo(redo) {
      var from = redo ? state.undo.redo : state.undo.done, to = redo ? state.undo.done : state.undo.redo;
      var e = from[from.length - 1];
      if (!e) { toast(redo ? '다시 적용할 수정이 없습니다.' : '되돌릴 수정이 없습니다. (이 창에서 저장한 문구만 되돌릴 수 있습니다)', 'error'); return Promise.resolve(false); }
      if (!store.canEdit()) { toast('공유 서버에 연결되지 않아 되돌릴 수 없습니다.', 'error'); return Promise.resolve(false); }
      if (state.saving > 0 || state.undoBusy) { toast('저장 중입니다. 잠시 뒤 다시 눌러 주세요.', 'error'); return Promise.resolve(false); }
      if(e.changes)return stepGroupUndo(e,redo,from,to);
      var cell = store.get(e.key), rev = redo ? e.undoRev : e.afterRev;
      if (!cell || cell.revision !== rev) {
        from.pop(); keepUndo(); renderStatus();
        toast('그 뒤에 다른 사람이 같은 문구를 고쳐서 ' + (redo ? '다시 적용하지' : '되돌리지') + ' 않았습니다: ' + itemName(e.itemId), 'error');
        return Promise.resolve(false);
      }
      var value = redo ? e.after : e.before;
      state.undoBusy = true; state.saving++; renderStatus();
      return store.save(e.key, value, by(), { baseRevision: cell.revision }).then(function (r) {
        state.undoBusy = false; state.saving--;
        if (r.ok) {
          from.pop();
          if (redo) e.afterRev = r.cell.revision; else e.undoRev = r.cell.revision;
          rebaseUndo(from,e.key,value,r.cell.revision,redo);
          to.push(e); keepUndo();
          toast((redo ? '다시 적용했습니다: ' : '되돌렸습니다: ') + itemName(e.itemId) + (e.kind==='format' ? ' · 글자 크기/줄 배치' : e.kind==='layout' ? ' · 그림 위치·크기' : ' · "'+shortText(value)+'"') + (redo ? '' : ' (다시 적용 Ctrl+Shift+Z)'), 'ok');
        } else if (r.reason === 'conflict') { store.adopt(e.key, r.current); from.pop(); keepUndo(); toast('그 뒤에 다른 사람이 같은 문구를 고쳐서 바꾸지 않았습니다.', 'error'); }
        else toast('서버에 저장되지 않았습니다. (' + reasonMessage(r) + ')', 'error');
        refreshAfterUndo(e.itemId);
        return r.ok;
      });
    }
    function rebaseUndo(stack,key,value,revision,redo){
      for(var i=stack.length-1;i>=0;i--){var list=stack[i].changes||[stack[i]],hit=list.filter(function(j){return j.key===key;})[0];if(!hit)continue;if((redo?hit.before:hit.after)===value){if(redo)hit.undoRev=revision;else hit.afterRev=revision;}break;}
    }
    function stepGroupUndo(e,redo,from,to){
      var action=redo?'redo':'undo',done=e.pendingAction===action?(e.doneKeys||[]):[];
      var conflict=e.changes.some(function(j){var cell=store.get(j.key),already=done.indexOf(j.key)>=0,rev=already?(redo?j.afterRev:j.undoRev):(redo?j.undoRev:j.afterRev);return !cell||cell.revision!==rev;});
      if(conflict){from.pop();keepUndo();renderStatus();toast('그 뒤에 다른 사람이 같은 문구나 서식을 고쳐 바꾸지 않았습니다.','error');return Promise.resolve(false);}
      e.pendingAction=action;e.doneKeys=done;state.undoBusy=true;state.saving++;renderStatus();var fail=null;
      return e.changes.reduce(function(chain,j){return chain.then(function(){if(fail||done.indexOf(j.key)>=0)return;return store.save(j.key,redo?j.after:j.before,by(),{baseRevision:store.get(j.key).revision}).then(function(r){if(!r.ok){fail=r;if(r.reason==='conflict'&&r.current)store.adopt(j.key,r.current);return;}if(redo)j.afterRev=r.cell.revision;else j.undoRev=r.cell.revision;done.push(j.key);keepUndo();});});},Promise.resolve()).then(function(){
        state.undoBusy=false;state.saving--;
        if(!fail){from.pop();e.changes.forEach(function(j){rebaseUndo(from,j.key,redo?j.after:j.before,redo?j.afterRev:j.undoRev,redo);});delete e.pendingAction;delete e.doneKeys;to.push(e);keepUndo();toast((redo?'문구와 서식을 다시 적용했습니다: ':'문구와 서식을 되돌렸습니다: ')+itemName(e.itemId),'ok');}
        else toast((done.length?'일부만 반영됐습니다. ':'')+'남은 수정은 저장되지 않았습니다. 다시 눌러 주세요. '+reasonMessage(fail),'error');
        refreshAfterUndo(e.itemId);return !fail;
      });
    }
    function undoLast() { return stepUndo(false); }
    function redoLast() { return stepUndo(true); }

    function toast(msg, kind) {
      if (!ui.toast) return;
      ui.toast.textContent = msg;
      ui.toast.className = 'toast show kind-' + (kind || 'ok');
      if (state.toastTimer && env.clearTimeout) env.clearTimeout(state.toastTimer);
      var t = setTimer(function () { ui.toast.className = 'toast kind-' + (kind || 'ok'); }, 4500);
      if (t && t.unref) t.unref();
      state.toastTimer = t;
    }

    /* ---- shell ---- */
    function buildShell() {
      ui.errors = H('div', { class: 'errors-host' });
      ui.status = H('div', { class: 'save-status', 'data-state': 'loading', role: 'status' });
      ui.summary = H('div', { class: 'selection-summary', 'aria-live': 'polite' });
      ui.tabs = H('nav', { class: 'locale-tabs', role: 'tablist', 'aria-label': '언어 선택' });
      ui.sideTitle = H('h2', { class: 'side-title' });
      ui.list = H('ul', { class: 'item-list' });
      ui.preview = H('main', { class: 'preview', id: 'preview' });
      ui.toast = H('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
      ui.modeTabs = H('nav', { class: 'mode-tabs', role: 'tablist', 'aria-label': '보기 선택' });
      ui.cmHead = H('div', { class: 'cm-head' });
      ui.cmStatus = H('p', { class: 'cm-status', role: 'status' });
      ui.cmList = H('ul', { class: 'cm-list' });
      ui.ebar = H('div', { class: 'editor-bar', role: 'toolbar', 'aria-label': '디자인 편집기' });
      ui.lpanel = H('section', { class: 'layer-panel', 'aria-label': '레이어' });
      ui.rpTabs = H('div', { class: 'rp-tabs', role: 'tablist', 'aria-label': '오른쪽 패널' }, [
        H('button', { type: 'button', role: 'tab', 'data-rp-tab': 'layers', text: '레이어', onclick: function () { ui.cpanel.setAttribute('data-tab', 'layers'); } }),
        H('button', { type: 'button', role: 'tab', 'data-rp-tab': 'comments', text: '코멘트', onclick: function () { ui.cpanel.setAttribute('data-tab', 'comments'); } }),
      ]);
      ui.cpanel = H('aside', { class: 'comment-panel', id: 'comment-panel', 'aria-label': '코멘트' }, [
        ui.rpTabs,
        ui.cmHead,
        H('p', { class: 'cm-hint', text: '미리보기에서 고칠 곳을 우클릭하고 ‘여기에 코멘트 달기’를 누르세요. 글은 자동 저장되고, 캡처는 Ctrl+V로 붙입니다. Shift+우클릭은 브라우저 기본 메뉴입니다.' }),
        ui.cmStatus, ui.cmList, ui.lpanel,
      ]);
      ui.drawerBtn = H('button', { type: 'button', class: 'cm-drawer-btn', 'data-action': 'toggle-comments', 'aria-controls': 'comment-panel', 'aria-expanded': 'false', text: '코멘트', onclick: function () { setDrawer(!hasAppClass('drawer-open')); } });
      ui.drawerBack = H('div', { class: 'cm-backdrop', 'aria-hidden': 'true', onclick: function () { setDrawer(false); } });
      ui.ctx = H('div', { class: 'ctx-menu', role: 'menu', hidden: true });
      ui.lightbox = H('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': '이미지 크게 보기', hidden: true, onclick: function () { closeLightbox(); } });
      var authorInput = H('input', { class: 'author-input', type: 'text', maxlength: '40', placeholder: '이름 (표시용)', value: state.author, 'aria-label': '작성자 이름' });
      var saveAuthor = function () {
        state.author = String(authorInput.value || '').trim().slice(0, 40);
        try { env.storage.setItem(AUTHOR_KEY, state.author); } catch (e) { /* convenience only */ }
      };
      authorInput.addEventListener('input', saveAuthor); authorInput.addEventListener('change', saveAuthor);
      /* 2026-11-12 user: "다크모드 라이트모드도 기능 추가해줘". Board screens only (the designs keep their own colours, downloads are unchanged).
         Kept per browser (THEME_KEY); index.html applies a saved dark theme before the first paint. Dark colours: ops/gen-dark-css.cjs. */
      ui.themeBtns = [['light', '라이트'], ['dark', '다크']].map(function (t) {
        return H('button', { type: 'button', class: 'theme-btn', 'data-theme-set': t[0], 'aria-pressed': 'false', text: t[1], title: t[1] + ' 화면으로 봅니다 (이 브라우저에만 저장)', onclick: function () { setTheme(t[0]); } });
      });
      applyTheme(storedTheme());
      var app = H('div', { class: 'app' }, [
        ui.headSlot = H('div', { class: 'board-head-slot' }, [ui.head = H('div', { class: 'board-head' }, [
        ui.modeTabs,
        H('header', { class: 'topbar' }, [
          H('div', { class: 'brand' }, [
            H('h1', { text: '12월 이벤트 · 수능 이벤트 검토' }),
            H('p', { class: 'brand-sub', text: '공유 검토 모드: 이 링크를 가진 사람은 누구나 선택과 문구를 수정할 수 있습니다. 병원 사이트와 연동되지 않습니다.' }),
          ]),
          H('div', { class: 'topbar-tools' }, [
            H('div', { class: 'theme-switch', role: 'group', 'aria-label': '화면 밝기' }, [H('span', { class: 'theme-switch-label', text: '화면' })].concat(ui.themeBtns)),
            H('label', { class: 'author' }, [H('span', { text: '작성자' }), authorInput]),
            H('p', { class: 'author-note', text: '이름은 저장 기록에 표시만 되며 인증이 아닙니다.' }),
            H('button', { type: 'button', class: 'btn', 'data-action': 'toggle-edit-mode', 'aria-pressed': 'false', text: '디자인 편집기', title: '포토샵처럼 그림·글자 레이어를 옮기고 크기를 바꿉니다', onclick: function (e) {
              var on = !hasAppClass('edit-mode');
              setAppClass('edit-mode', on);
              e.target.setAttribute('aria-pressed', on ? 'true' : 'false');
              state.tool = 'move'; state.layers = null;
              if (ui.cpanel) ui.cpanel.setAttribute('data-tab', on ? 'layers' : 'comments');
              renderEditorBar(); renderLayerPanel();
              postAptosData();
            } }),
            H('button', { type: 'button', class: 'btn', 'data-action': 'download-json', text: '현재 문구 JSON 받기', onclick: downloadJson }),
            H('p', { class: 'edit-mode-note', text: '디자인 편집기: 이동 도구(V)로 그림·글자를 끌어 옮기고 모서리로 크기를 바꿉니다. 오른쪽 레이어 목록에서 골라도 됩니다. 글자 도구(T)는 글자 고치기, Ctrl+Z는 되돌리기입니다.' }),
          ]),
        ]),
        H('section', { class: 'statusbar' }, [ui.status, ui.summary]),
        ui.errors,
        ui.tabs,
        ])]),
        ui.layout = H('div', { class: 'layout' }, [H('aside', { class: 'sidebar' }, [ui.sideTitle, ui.list]), ui.preview, ui.cpanel]),
        ui.hub = H('main', { class: 'dl-hub', id: 'dl-hub', hidden: true }),
        ui.drawerBtn, ui.drawerBack, ui.ctx, ui.lightbox,
        ui.toast,
      ]);
      ui.app = app;
      env.root.replaceChildren(app);
      renderModeTabs();
      bindBoardEvents();
      bindStickyHead();
    }
    /* 2026-11-12 user: "상단 이구간은 스크롤을 내려도 따라서 내려오게 하면 좋을거 같아" (보기 탭부터 언어 탭까지).
       Screens 769px and wider: once the page is scrolled past this block, the same block stays on top in a slim form
       (descriptions hidden, smaller tabs and buttons; class 'slim', position:fixed). Its place in the page keeps the full height,
       so nothing below jumps. --head-h (slim bar height or 0) moves the sticky side list, comment panel and editor bar below it;
       --head-pad keeps scrollIntoView targets out from under it. Phones keep the old layout. */
    function bindStickyHead() {
      var w = win0; if (!w || !ui.head || !ui.headSlot || typeof w.addEventListener !== 'function') return;
      var queued = false, run = function () { queued = false; updateHead(); };
      var later = function () { if (queued) return; queued = true; if (w.requestAnimationFrame) w.requestAnimationFrame(run); else w.setTimeout(run, 16); };
      w.addEventListener('scroll', later, { passive: true });
      w.addEventListener('resize', function () { state.headSlimH = 0; later(); });
      updateHead();
    }
    function updateHead() {
      var w = win0, slot = ui.headSlot, head = ui.head; if (!w || !slot || !head || !head.classList) return;
      var slim = head.classList.contains('slim'), wide = w.innerWidth >= 769, y = w.pageYOffset || 0;
      if (!slim) state.headFullH = slot.offsetHeight;
      var slimH = state.headSlimH || 140, top = slot.getBoundingClientRect().top + y;
      var want = wide && y > top + state.headFullH - slimH;
      if (want && !slim) { slot.style.height = state.headFullH + 'px'; head.classList.add('slim'); }
      if (!want && slim) { head.classList.remove('slim'); slot.style.height = ''; head.style.left = ''; head.style.width = ''; }
      if (want) { var r = slot.getBoundingClientRect(); head.style.left = r.left + 'px'; head.style.width = r.width + 'px'; state.headSlimH = head.offsetHeight; }
      var root = doc.documentElement;
      if (root && root.style) { root.style.setProperty('--head-h', want ? state.headSlimH + 'px' : '0px'); root.style.setProperty('--head-pad', wide ? (state.headSlimH || 140) + 'px' : '0px'); }
    }
    function hasAppClass(cls) { return !!ui.app && ui.app.className.split(/\s+/).indexOf(cls) >= 0; }
    function setAppClass(cls, on) {
      if (!ui.app) return;
      var list = ui.app.className.split(/\s+/).filter(function (c) { return c && c !== cls; });
      if (on) list.push(cls);
      ui.app.className = list.join(' ');
    }
    function setDrawer(on) {
      setAppClass('drawer-open', on);
      if (ui.drawerBtn) ui.drawerBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
    }

    function downloadJson() {
      if (!state.data) return;
      var text = JSON.stringify(buildExport(state.data, store), null, 2);
      if (env.download) env.download(text, 'event-review-copy.json');
    }

    /* ---- errors / status / summary ---- */
    function renderErrors() {
      var all = (state.fatal ? [state.fatal] : []).concat(state.errors);
      if (!all.length) { ui.errors.replaceChildren(); return; }
      var shown = all.slice(0, 40);
      ui.errors.replaceChildren(H('div', { class: 'data-errors', role: 'alert' }, [
        H('strong', { text: '데이터 오류 ' + all.length + '건: 아래 항목은 비어 있거나 불완전합니다. 완료된 화면이 아닙니다.' }),
        H('ul', null, shown.map(function (e) { return H('li', { text: e }); })),
        all.length > shown.length ? H('p', { text: '외 ' + (all.length - shown.length) + '건' }) : null,
      ]));
    }

    function statusState() {
      if (store.status === 'loading') return 'loading';
      if (!store.canEdit()) return 'locked';
      if (state.saving > 0) return 'saving';
      if (state.editor && state.editor.status === 'error') return 'unsaved';
      if (!store.online) return 'offline';
      return 'ready';
    }
    var STATUS_TEXT = {
      loading: '공유 서버 연결 중…',
      locked: '공유 서버 연결 실패: 편집이 잠겨 있습니다.',
      saving: '서버에 저장 중…',
      unsaved: '미저장: 서버에 저장되지 않은 수정이 있습니다.',
      offline: '오프라인: 서버와 동기화되지 않았습니다. 저장은 다시 시도할 수 있습니다.',
      ready: '공유 서버 연결됨',
    };
    function renderStatus() {
      var s = statusState();
      var kids = [H('span', { class: 'dot' }), H('span', { text: STATUS_TEXT[s] })];
      if (s === 'ready' && store.lastSync) kids.push(H('span', { class: 'sync-time', text: ' · 확인 ' + store.lastSync.toLocaleTimeString('ko-KR') }));
      if (s === 'locked') kids.push(H('button', { type: 'button', class: 'btn small', 'data-action': 'retry-connect', text: '다시 연결', onclick: retryConnect }));
      var lastDone = state.undo.done[state.undo.done.length - 1], lastUndone = state.undo.redo[state.undo.redo.length - 1];
      if ((s === 'ready' || s === 'saving' || s === 'offline') && lastDone) kids.push(H('button', { type: 'button', class: 'btn small undo-btn', 'data-action': 'undo', title: '마지막 문구 수정 되돌리기 (Ctrl+Z) · ' + itemName(lastDone.itemId) + ' "' + shortText(lastDone.after) + '" → "' + shortText(lastDone.before) + '"', text: '↶ 되돌리기', onclick: function () { undoLast(); } }));
      if ((s === 'ready' || s === 'saving' || s === 'offline') && lastUndone) kids.push(H('button', { type: 'button', class: 'btn small undo-btn', 'data-action': 'redo', title: '되돌린 수정 다시 적용 (Ctrl+Shift+Z)', text: '↷ 다시 적용', onclick: function () { redoLast(); } }));
      if (env.apiOverride) kids.push(H('span', { class: 'api-override', text: '시험 서버: ' + env.apiOverride }));
      ui.status.setAttribute('data-state', s);
      ui.status.replaceChildren.apply(ui.status, kids);
      renderSummary();
    }
    function renderSummary() {
      if (!state.data || !state.locale) { ui.summary.replaceChildren(); return; }
      var totalOf = function (loc) { return state.data.items.filter(function (it) { return hasLocale(it, loc); }).length; };
      var total = totalOf(state.locale);
      var count = function (loc) { return state.data.items.filter(function (it) { return hasLocale(it, loc) && store.isSelected(it.id, loc); }).length; };
      var chips = state.data.locales.map(function (l) {
        return H('button', { type: 'button', class: 'summary-chip' + (l.id === state.locale ? ' current' : ''), text: l.id + ' ' + count(l.id) + '/' + totalOf(l.id), onclick: function () { selectLocale(l.id); } });
      });
      ui.summary.replaceChildren(H('strong', { class: 'summary-main', text: state.locale + ' 선택 ' + count(state.locale) + ' / ' + total }), H('span', { class: 'summary-chips' }, chips));
    }

    /* ---- tabs / sidebar ---- */
    function renderTabs() {
      ui.tabs.replaceChildren.apply(ui.tabs, state.data.locales.map(function (l) {
        var cur = l.id === state.locale;
        return H('button', { type: 'button', role: 'tab', class: 'locale-tab' + (cur ? ' current' : ''), 'data-locale': l.id, 'aria-selected': cur ? 'true' : 'false', lang: l.lang, onclick: function () { selectLocale(l.id); } }, [
          H('span', { class: 'tab-id', text: l.id }), H('span', { class: 'tab-label', text: l.label }),
        ]);
      }));
    }
    function itemErrorCount(id) { return state.errors.filter(function (e) { return e.indexOf(id + ' ') === 0 || e.indexOf(id + ':') === 0; }).length; }
    /* ---- project groups (folding) ---- */
    function groupsOf() {
      var g = state.data && Array.isArray(state.data.groups) ? state.data.groups : [];
      return g.filter(function (x) { return isObj(x) && typeof x.id === 'string' && Array.isArray(x.items); });
    }
    function loadFolded() {
      if (state.folded) return state.folded;
      state.folded = {};
      try { var s = env.storage && env.storage.getItem(FOLD_KEY); if (s) { var o = JSON.parse(s); if (isObj(o)) state.folded = o; } } catch (e) { /* ignore */ }
      return state.folded;
    }
    function isTestItem(itemId) { return groupsOf().some(function (g) { return g.test === true && g.items.indexOf(itemId) >= 0; }); }
    function isFolded(g) { var f = loadFolded(); return typeof f[g.id] === 'boolean' ? f[g.id] : g.folded === true; }
    function setFolded(id, v) {
      loadFolded()[id] = v;
      try { if (env.storage) env.storage.setItem(FOLD_KEY, JSON.stringify(state.folded)); } catch (e) { /* ignore */ }
    }
    function toggleGroup(g) { setFolded(g.id, !isFolded(g)); renderSidebar(); }
    function unfoldFor(itemId) { groupsOf().forEach(function (g) { if (g.items.indexOf(itemId) >= 0 && isFolded(g)) setFolded(g.id, false); }); }

    function visibleItems() { return state.data.items.filter(function (it) { return !store.isDeleted(it.id); }); }
    function visibleGroups() { return groupsOf().map(function (g) { return { g: g, items: g.items.map(function (id) { return state.data.items.filter(function (it) { return it.id === id; })[0]; }).filter(Boolean).filter(function (it) { return !store.isDeleted(it.id); }) }; }).filter(function (x) { return x.items.length; }); }
    /* 2026-11-06 user request: on wide screens the left list is a fixed-height scroll box (style.css), so keep its
       scroll position across re-renders and bring the current item into view when the selected item changes. */
    var sidebarShownItem = null, fitQueued = false;
    /* the list box ends at the bottom of the window: it grows while the page scrolls until it sticks at the top */
    function fitSidebar() {
      var s = ui.list && ui.list.parentNode; if (!s || !s.style || !s.getBoundingClientRect || !win0 || !ui.list.querySelector) return;
      if (win0.matchMedia && !win0.matchMedia('(min-width: 769px)').matches) { s.style.maxHeight = ''; return; }
      var cur = ui.list.querySelector('.item-row.current'), was = false;
      if (cur) { var l0 = ui.list.getBoundingClientRect(), c0 = cur.getBoundingClientRect(); was = l0.height > 0 && c0.top >= l0.top - 1 && c0.bottom <= l0.bottom + 1; }
      var top = Math.max(12, s.getBoundingClientRect().top);
      s.style.maxHeight = Math.max(260, (win0.innerHeight || 800) - top - 12) + 'px';
      if (cur && was) { /* the current item stays in view when the box shrinks (page top, late font load) */
        var l1 = ui.list.getBoundingClientRect(), c1 = cur.getBoundingClientRect();
        if (c1.bottom > l1.bottom) ui.list.scrollTop += c1.bottom - l1.bottom; else if (c1.top < l1.top) ui.list.scrollTop -= l1.top - c1.top;
      }
    }
    function queueFitSidebar() { if (fitQueued || !win0 || !win0.requestAnimationFrame) return; fitQueued = true; win0.requestAnimationFrame(function () { fitQueued = false; fitSidebar(); }); }
    function curRowShown() { /* is the current row fully inside the list box right now? */
      if (!ui.list.querySelector || !ui.list.getBoundingClientRect) return false;
      var cur = ui.list.querySelector('.item-row.current'); if (!cur) return false;
      var l = ui.list.getBoundingClientRect(), c = cur.getBoundingClientRect();
      return l.height > 0 && c.top >= l.top - 1 && c.bottom <= l.bottom + 1;
    }
    function renderSidebar() {
      var focused = doc.activeElement;
      if (focused && focused.classList && (focused.classList.contains('up-date-input') || focused.classList.contains('up-time-input')) && ui.list.contains && ui.list.contains(focused)) { state.sidebarDeferred = true; return; }
      var keep = ui.list.scrollTop, shown = curRowShown();
      renderSidebarInner();
      fitSidebar();
      ui.list.scrollTop = keep;
      if (shown && !curRowShown()) { /* rows above grew (late comment badges): keep the current row in view */
        var cur0 = ui.list.querySelector('.item-row.current'), l0 = ui.list.getBoundingClientRect(), c0 = cur0.getBoundingClientRect();
        if (c0.bottom > l0.bottom) ui.list.scrollTop += c0.bottom - l0.bottom; else if (c0.top < l0.top) ui.list.scrollTop -= l0.top - c0.top;
      }
      if (!state.itemId || state.itemId === sidebarShownItem || !ui.list.querySelector || !ui.list.getBoundingClientRect) return; /* unit-test DOM */
      var cur = ui.list.querySelector('.item-row.current');
      var lr = ui.list.getBoundingClientRect();
      if (!cur || !lr.height) return;
      var cr = cur.getBoundingClientRect();
      if (ui.list.scrollHeight > ui.list.clientHeight + 1 && (cr.top < lr.top || cr.bottom > lr.bottom)) ui.list.scrollTop += (cr.top - lr.top) - Math.max(0, (lr.height - cr.height) / 2);
      sidebarShownItem = state.itemId;
    }
    function renderSidebarInner() {
      var loc = state.locale;
      var items = visibleItems();
      ui.sideTitle.textContent = '검토 항목 ' + items.length + '개';
      var groups = visibleGroups();
      if (!groups.length) { ui.list.replaceChildren.apply(ui.list, items.map(itemRow)); return; }
      var byId = {}, used = {}, out = [];
      items.forEach(function (it) { byId[it.id] = it; });
      if (!groups.length) { ui.list.replaceChildren.apply(ui.list, items.map(itemRow)); return; }
      groups.forEach(function (x) {
        var g = x.g, members = x.items;
        members.forEach(function (it) { used[it.id] = true; });
        if (!members.length) return;
        var folded = isFolded(g);
        var selCount = members.filter(function (it) { return store.isSelected(it.id, loc); }).length;
        out.push(H('li', { class: 'group-row' + (folded ? ' folded' : '') }, [
          H('div', { class: 'group-head' }, [
            H('button', { type: 'button', class: 'group-btn', 'data-group-id': g.id, 'aria-expanded': folded ? 'false' : 'true', onclick: function () { toggleGroup(g); } }, [
              H('span', { class: 'group-chev', 'aria-hidden': 'true', text: folded ? '▶' : '▼' }),
              g.test === true ? H('span', { class: 'group-test', text: '테스트 구간' }) : null,
              H('span', { class: 'group-label', text: g.label || g.id }),
              H('span', { class: 'group-count', text: members.length + '개' + (selCount ? ' · 최종완료 ' + selCount : '') + (folded ? ' · 접힘' : '') }),
            ]),
            H('button', { type: 'button', class: 'btn small danger delete-btn', text: '삭제', onclick: function (e) { e.stopPropagation(); openDeleteDialog(members.map(function (it) { return it.id; }), g.label || g.id, members.length); } }),
          ]),
        ]));
        if (!folded) members.forEach(function (it) { out.push(itemRow(it)); });
      });
      items.forEach(function (it) { if (!used[it.id]) out.push(itemRow(it)); });
      ui.list.replaceChildren.apply(ui.list, out);
    }

    /* 2026-11-12 user: "이벤트별로 나열된 목록을 컴포넌트로 묶어서 업로드 매체 체크박스, 업로드 예약 희망일 선택(캘린더)",
       then "페이스북을 메타로", "홈페이지는 클릭하면 드롭다운으로 안에 체크박스, 이벤트·프로모션 두 개 선택",
       then "홈페이지 하위로 공지사항 체크박스 추가 부탁해. 그리고 복수선택도 가능하게 해주고".
       Every event row is a small card: 디자인 최종완료 check · name · 삭제, then the channels it will be uploaded to and the wished upload date.
       2026-11-14 user: "이부분은 담당자가 앞으로 너에게 업로드 요청을 기록하는 구간이라서 희망시간도 기록해줄수 있게" -> 희망 시간 under the date.
       This card is the staff's upload request to the lead (ops/upload-requests.cjs lists them).
       Saved per item and language like the 최종완료 check: <ID>.<LOC>.up_media = chosen ids joined by ',' (UP_IDS order), <ID>.<LOC>.up_date = 'YYYY-MM-DD' or '',
       <ID>.<LOC>.up_time = 'HH:MM' (24 h) or ''.
       Any number of channels (and of 홈페이지's 이벤트·프로모션·공지사항) can be ticked. A change shows at once; saves for one item+language+field go out one
       after another with the newest value (state.upQueue), so a quick second tick or a time typed digit by digit never runs into its own earlier save. */
    var UPLOAD_MEDIA = [['home', '홈페이지', [['home_event', '이벤트'], ['home_promo', '프로모션'], ['home_notice', '공지사항']]], ['insta', '인스타그램'], ['meta', '메타'], ['kakao', '카카오톡'], ['line', '라인'], ['gangnam', '강남언니'], ['babi', '바비톡'], ['yeoshin', '여신티켓']];
    var UP_IDS = []; UPLOAD_MEDIA.forEach(function (m) { if (m[2]) m[2].forEach(function (s) { UP_IDS.push(s[0]); }); else UP_IDS.push(m[0]); });
    function upQueue() { return state.upQueue || (state.upQueue = {}); }
    /* the value shown for an upload-request field: the newest one waiting to be saved, else the server's */
    function upValue(itemId, loc, field) { var key = cellKey(itemId, loc, field), q = upQueue()[key]; return q ? q.want : store.value(key, ''); }
    function uploadMedia(itemId, loc) { var v = upValue(itemId, loc, 'up_media'); return v ? v.split(',').filter(function (id) { return UP_IDS.indexOf(id) >= 0; }) : []; }
    function toggleUpload(itemId, loc, id, on) {
      var cur = uploadMedia(itemId, loc);
      queueUpload(itemId, loc, 'up_media', UP_IDS.filter(function (x) { return x === id ? on : cur.indexOf(x) >= 0; }).join(','), '업로드 매체를');
    }
    function queueUpload(itemId, loc, field, value, what) {
      if (!store.canEdit()) { toast('공유 서버에 연결되지 않아 저장할 수 없습니다 (편집 잠금).', 'error'); renderSidebar(); return; }
      var key = cellKey(itemId, loc, field), q = upQueue()[key] || (upQueue()[key] = { busy: false });
      q.want = value; q.what = what; q.itemId = itemId; q.loc = loc;
      renderSidebar(); flushUpload(key);
    }
    function flushUpload(key) {
      var q = upQueue()[key];
      if (!q || q.busy) return;
      var sending = q.want;
      if (sending === store.value(key, '')) { delete upQueue()[key]; renderSidebar(); return; }
      q.busy = true; state.saving++; renderStatus();
      store.save(key, sending, by()).then(function (r) {
        state.saving--; q.busy = false;
        if (r.ok && q.want !== sending) { renderStatus(); flushUpload(key); return; }
        delete upQueue()[key];
        if (r.ok) toast(q.what + ' 저장했습니다: ' + itemName(q.itemId) + ' (' + q.loc + ')', 'ok');
        else if (r.reason === 'conflict') { store.adopt(key, r.current); toast('다른 사람이 먼저 바꿨습니다. 최신 값을 불러왔습니다.', 'error'); }
        else toast('서버에 저장되지 않았습니다. 원래대로 돌아갑니다. (' + reasonMessage(r) + ')', 'error');
        renderSidebar(); renderStatus();
      });
    }
    var THEME_KEY = 'bb-review-theme';
    function storedTheme() { try { return env.storage && env.storage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch (e) { return 'light'; } }
    function applyTheme(t) {
      var html = doc && doc.documentElement;
      if (html && typeof html.setAttribute === 'function') { if (t === 'dark') html.setAttribute('data-theme', 'dark'); else if (typeof html.removeAttribute === 'function') html.removeAttribute('data-theme'); }
      state.theme = t;
      (ui.themeBtns || []).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-theme-set') === t ? 'true' : 'false'); });
    }
    function setTheme(t) { t = t === 'dark' ? 'dark' : 'light'; try { if (env.storage) env.storage.setItem(THEME_KEY, t); } catch (e) { /* convenience only */ } applyTheme(t); }
    function uploadDate(itemId, loc) { var v = upValue(itemId, loc, 'up_date'); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''; }
    function uploadTime(itemId, loc) { var v = upValue(itemId, loc, 'up_time'); return /^\d{2}:\d{2}$/.test(v) ? v : ''; }
    function upTimeNote(v) { var h = +v.slice(0, 2); return (h < 12 ? '오전 ' : '오후 ') + ((h % 12) || 12) + ':' + v.slice(3, 5); }
    function upDateNote(v) {
      var p = v.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2]), t0 = new Date(); t0.setHours(0, 0, 0, 0);
      var diff = Math.round((d.getTime() - t0.getTime()) / 86400000);
      return '(' + '일월화수목금토'.charAt(d.getDay()) + ') ' + (diff === 0 ? '오늘' : diff > 0 ? 'D-' + diff : -diff + '일 지남');
    }
    function uploadBox(it, loc) {
      if (isTestItem(it.id)) return null;
      state.upOpen = state.upOpen || {};
      var chosen = uploadMedia(it.id, loc), date = uploadDate(it.id, loc), time = uploadTime(it.id, loc), canEdit = store.canEdit(), count = 0;
      var afterBlur = function () { if (state.sidebarDeferred) { state.sidebarDeferred = false; renderSidebar(); } };
      var save = function (id, on) { toggleUpload(it.id, loc, id, on); };
      var box = function (id, label, aria) { var on = chosen.indexOf(id) >= 0; return H('label', { class: 'up-chip' + (on ? ' on' : '') }, [H('input', { type: 'checkbox', 'data-up-media': id, 'aria-label': aria, checked: on, disabled: !canEdit, onchange: function (e) { save(id, !!e.target.checked); } }), H('span', { text: label })]); };
      var chips = [];
      UPLOAD_MEDIA.forEach(function (m) {
        if (!m[2]) { if (chosen.indexOf(m[0]) >= 0) count++; chips.push(box(m[0], m[1], it.label + ' 업로드 매체 ' + m[1] + ' (' + loc + ')')); return; }
        /* 홈페이지: click opens the places inside it (이벤트 · 프로모션 · 공지사항), each its own checkbox, any number of them */
        var picked = m[2].filter(function (s) { return chosen.indexOf(s[0]) >= 0; }), openKey = it.id + '.' + loc + '.' + m[0], open = !!state.upOpen[openKey];
        if (picked.length) count++;
        chips.push(H('button', { type: 'button', class: 'up-chip up-drop' + (picked.length ? ' on' : '') + (open ? ' open' : ''), 'data-up-drop': m[0], 'aria-expanded': open ? 'true' : 'false', title: m[1] + ' 안에서 ' + m[2].map(function (s) { return s[1]; }).join('·') + '을 고릅니다 (여러 개 선택 가능)',
          onclick: function () { state.upOpen[openKey] = !open; renderSidebar(); } }, [
          H('span', { class: 'up-mark', 'aria-hidden': 'true', text: picked.length ? '✓' : '' }),
          H('span', { text: m[1] }), picked.length ? H('span', { class: 'up-picked', text: picked.length === m[2].length && m[2].length > 2 ? '전체' : picked.map(function (s) { return s[1]; }).join('·') }) : null,
          H('span', { class: 'up-caret', 'aria-hidden': 'true', text: open ? '▴' : '▾' }),
        ]));
        if (open) chips.push(H('div', { class: 'up-sub', role: 'group', 'aria-label': m[1] + ' 업로드 위치 (여러 개 선택 가능)' }, [H('span', { class: 'up-sub-note', text: '여러 개 선택 가능' })].concat(m[2].map(function (s) { return box(s[0], s[1], it.label + ' ' + m[1] + ' ' + s[1] + ' (' + loc + ')'); }))));
      });
      var dateIn = H('input', { type: 'date', class: 'up-date-input', 'data-up-date': it.id, 'aria-label': it.label + ' 업로드 예약 희망일 (' + loc + ')', value: date, disabled: !canEdit,
        onchange: function (e) { var v = String(e.target.value || ''); if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return; queueUpload(it.id, loc, 'up_date', v, '업로드 희망일을'); },
        onblur: afterBlur });
      var timeIn = H('input', { type: 'time', class: 'up-time-input', 'data-up-time': it.id, 'aria-label': it.label + ' 업로드 희망 시간 (' + loc + ')', value: time, disabled: !canEdit,
        onchange: function (e) { var v = String(e.target.value || '').slice(0, 5); if (v && !/^\d{2}:\d{2}$/.test(v)) return; queueUpload(it.id, loc, 'up_time', v, '업로드 희망 시간을'); },
        onblur: afterBlur });
      return H('div', { class: 'up-box', 'data-upload-for': it.id }, [
        H('div', { class: 'up-head' }, [H('span', { class: 'up-title', text: '업로드 매체' }), H('span', { class: 'up-count', text: count ? count + '곳' : '미정' })]),
        H('div', { class: 'up-media', role: 'group', 'aria-label': it.label + ' 업로드 매체' }, chips),
        H('div', { class: 'up-date' }, [
          H('span', { class: 'up-title', text: '예약 희망일' }), dateIn,
          date ? H('span', { class: 'up-dday', text: upDateNote(date) }) : H('span', { class: 'up-dday muted', text: '미정' }),
          date ? H('button', { type: 'button', class: 'up-date-clear', 'data-up-clear': it.id, 'aria-label': '희망일 지우기', title: '희망일 지우기', text: '×', disabled: !canEdit, onclick: function () { queueUpload(it.id, loc, 'up_date', '', '업로드 희망일을'); } }) : null,
        ]),
        H('div', { class: 'up-date up-time' }, [
          H('span', { class: 'up-title', text: '희망 시간' }), timeIn,
          time ? H('span', { class: 'up-tnote', text: upTimeNote(time) }) : H('span', { class: 'up-tnote muted', text: '미정' }),
          time ? H('button', { type: 'button', class: 'up-date-clear', 'data-up-time-clear': it.id, 'aria-label': '희망 시간 지우기', title: '희망 시간 지우기', text: '×', disabled: !canEdit, onclick: function () { queueUpload(it.id, loc, 'up_time', '', '업로드 희망 시간을'); } }) : null,
        ]),
      ]);
    }

    function itemRow(it) {
        var loc = state.locale;
        var sel = store.isSelected(it.id, loc);
        var errs = itemErrorCount(it.id);
        var fb = feedbackDone(it.id);
        return H('li', { class: 'item-row' + (it.id === state.itemId ? ' current' : '') + (sel ? ' selected' : '') + (fb ? ' fb-done' : '') }, [
          H('label', { class: 'final-box', title: '디자인이 최종 완료되면 체크합니다 (' + loc + ' 언어판)' }, [H('span', { class: 'final-cap', text: '디자인\n최종완료' }), H('input', { type: 'checkbox', class: 'select-box', 'data-select-for': it.id, 'aria-label': it.label + ' 디자인 최종완료 (' + loc + ')', checked: sel, disabled: !store.canEdit(), onchange: function (e) { onSelectChange(it.id, loc, !!e.target.checked); } })]),
          H('button', { type: 'button', class: 'item-btn', 'data-item-id': it.id, 'aria-current': it.id === state.itemId ? 'true' : null, onclick: function () { selectItem(it.id); } }, [
            H('span', { class: 'item-label', text: it.label }),
            fb ? H('span', { class: 'fb-tag', 'data-feedback-done': it.id, text: '피드백 완료' }) : null,
            isTestItem(it.id) ? H('span', { class: 'kind-tag kind-test', text: '테스트' }) : H('span', { class: 'kind-tag kind-' + it.kind, text: it.kind === 'plan' ? '기획' : '완성' }),
            errs ? H('span', { class: 'err-tag', text: '오류 ' + errs }) : null,
            requestBadge(it.id),
          ]),
          H('button', { type: 'button', class: 'btn small danger delete-btn', text: '삭제', onclick: function (e) { e.stopPropagation(); openDeleteDialog([it.id], it.label, 1); } }),
          uploadBox(it, loc),
        ]);
    }

    function openDeleteDialog(targets, label, count) {
      if (!store.canEdit()) { toast('공유 서버에 연결되지 않아 삭제할 수 없습니다.', 'error'); return; }
      var pin = H('input', { class: 'delete-pin', type: 'password', inputMode: 'numeric', autocomplete: 'off', maxlength: '64', placeholder: '관리자 PIN', 'aria-label': '관리자 PIN' });
      var modal = H('div', { class: 'delete-modal-backdrop', role: 'presentation' }, [H('div', { class: 'delete-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'delete-title' }, [
        H('h3', { id: 'delete-title', text: '항목 삭제' }),
        H('p', { text: '다음 항목을 삭제합니다.' }),
        H('strong', { class: 'delete-summary', text: label + ' (' + count + '개)' }),
        H('p', { class: 'delete-warning', text: '삭제하면 검토 보드와 저장된 수정 내용에서 사라지며 되돌릴 수 없습니다.' }),
        pin,
        H('div', { class: 'delete-actions' }, [
          H('button', { type: 'button', class: 'btn', text: '취소', onclick: function () { modal.remove(); } }),
          H('button', { type: 'button', class: 'btn danger', text: '삭제', onclick: function () { submitDelete(targets, pin.value, modal); } }),
        ]),
      ])]);
      doc.body.appendChild(modal); pin.focus();
    }
    function submitDelete(targets, pin, modal) {
      if (!pin) { toast('관리자 PIN을 입력해 주세요.', 'error'); return; }
      store.remove(targets, pin, by()).then(function (r) {
        if (!r.ok) { toast(r.status === 403 ? '관리자 PIN이 올바르지 않습니다.' : r.status === 429 ? '삭제 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' : '삭제하지 못했습니다. (' + (r.status || '네트워크 오류') + ')', 'error'); return; }
        modal.remove();
        var wasOpen = targets.indexOf(state.itemId) >= 0;
        if (wasOpen) { var remain = visibleItems(); state.itemId = remain.length ? remain[0].id : null; }
        renderAll(); toast('삭제했습니다. 저장소 파일은 몇 분 안에 자동으로 지워집니다.', 'ok');
      });
    }

    /* ---- navigation ---- */
    function canNavigate() {
      /* in-place editing pages save on blur, and their late save message is still handled after the page changes (state.frames) */
      if(state.aptos && state.aptos.editing && !state.aptos.inline){toast('압토스 수정창을 먼저 저장하거나 닫아 주세요.','error');return false;}
      var ed = state.editor;
      if (ed && (ed.draft !== ed.original || ed.status !== 'idle')) { toast('수정 중인 내용을 먼저 저장하거나 취소해 주세요.', 'error'); return false; }
      state.editor = null; return true;
    }
    function pushHash() { if (env.replaceHash) env.replaceHash('#' + state.itemId + '/' + state.locale + (state.mode === 'app' ? '/app' : state.mode === 'download' ? '/dl' : '')); }
    function selectItem(id) { if (id === state.itemId || !canNavigate()) return; flushActiveDraft(); hideCtx(); state.itemId = id; unfoldFor(id); pushHash(); renderAll(); loadComments(id); }
    function selectLocale(id) { if (id === state.locale || !canNavigate()) return; hideCtx(); state.locale = id; pushHash(); renderAll(); }
    function selectMode(m) { if (m === state.mode || !canNavigate()) return; hideCtx(); state.mode = m === 'app' ? 'app' : m === 'download' ? 'download' : 'home'; pushHash(); renderAll(); }
    /* 2026-11-06: third view '콘텐츠별 다운로드' (#ID/LOCALE/dl) replaces the list/preview/comments with the download hub */
    function showHub(on) { if (ui.layout) ui.layout.hidden = !!on; if (ui.hub) ui.hub.hidden = !on; if (ui.drawerBtn) ui.drawerBtn.hidden = !!on; }
    function renderAll() { renderErrors(); renderModeTabs(); renderTabs(); if (state.mode === 'download') { showHub(true); renderHub(); renderStatus(); return; } showHub(false); renderSidebar(); renderPreview(); renderComments(); renderStatus(); }
    function renderModeTabs() {
      if (!ui.modeTabs) return;
      setAppClass('mode-app', state.mode === 'app');
      setAppClass('mode-dl', state.mode === 'download');
      ui.modeTabs.replaceChildren.apply(ui.modeTabs, [['home', '홈페이지', '모든 이미지'], ['app', '뷰티앱', '강남언니 · 바비톡 · 여신티켓'], ['download', '콘텐츠별 다운로드', '라인·카카오톡 사이즈까지 한 번에']].map(function (m) {
        var cur = state.mode === m[0];
        return H('button', { type: 'button', role: 'tab', class: 'mode-tab' + (cur ? ' current' : ''), 'data-mode': m[0], 'aria-selected': cur ? 'true' : 'false', onclick: function () { selectMode(m[0]); } }, [
          H('span', { class: 'mode-name', text: m[1] }), H('span', { class: 'mode-sub', text: m[2] }),
        ]);
      }));
    }
    function requestBadge(itemId) {
      var s = state.summary[itemId];
      if (!s || !(s.open > 0)) return null;
      return H('span', { class: 'req-tag', 'data-request-count': String(s.open), title: '요청 ' + s.open + ' · 확인 필요 ' + (s.question || 0) + ' · 적용완료 ' + (s.done || 0), text: '요청 ' + s.open });
    }

    function retryConnect() {
      return store.load().then(function () { renderAll(); if (store.canEdit()) toast('공유 서버에 연결되었습니다.', 'ok'); });
    }

    /* ---- selection ---- */
    function onSelectChange(itemId, locale, checked) {
      var key = selectedKey(itemId, locale);
      if (!store.canEdit()) { toast('공유 서버에 연결되지 않아 선택을 저장할 수 없습니다 (편집 잠금).', 'error'); renderSidebar(); renderPreview(); return Promise.resolve(); }
      state.saving++; renderStatus();
      return store.save(key, checked, by()).then(function (r) {
        state.saving--;
        if (r.ok) toast('디자인 최종완료 표시를 저장했습니다. (' + locale + ')', 'ok');
        else if (r.reason === 'conflict') { store.adopt(key, r.current); toast('다른 사람이 먼저 바꿨습니다. 최신 선택 상태를 불러왔습니다.', 'error'); }
        else toast('서버에 저장되지 않았습니다. 선택이 원래대로 돌아갑니다. (' + reasonMessage(r) + ')', 'error');
        renderSidebar(); renderPreview(); renderStatus();
      });
    }

    /* ---- editing ---- */
    function openEditor(itemId, locale, name, def) {
      var key = cellKey(itemId, locale, name);
      if (!store.canEdit()) { toast('공유 서버에 연결되지 않아 편집이 잠겨 있습니다. 연결을 다시 시도해 주세요.', 'error'); return; }
      var ed = state.editor;
      if (ed) {
        if (ed.key === key) { if (ed.ta) ed.ta.focus(); return; }
        if (ed.draft !== ed.original || ed.status !== 'idle') { toast('수정 중인 내용을 먼저 저장하거나 취소해 주세요.', 'error'); return; }
      }
      var cur = store.value(key, def);
      var cell = store.get(key);
      state.editor = { key: key, itemId: itemId, locale: locale, field: name, def: def, original: cur, draft: cur, baseRevision: cell ? cell.revision : 0, status: 'idle', message: '', conflict: null, ta: null, justOpened: true };
      renderPreview();
    }
    function closeEditor() { state.editor = null; renderPreview(); renderStatus(); }

    function commitEdit() {
      var ed = state.editor;
      if (!ed || ed.status === 'saving' || ed.status === 'conflict') return Promise.resolve();
      if (ed.ta) ed.draft = ed.ta.value;
      if (ed.draft === ed.original) { closeEditor(); return Promise.resolve(); }
      ed.status = 'saving'; ed.message = '서버에 저장 중…'; state.saving++;
      renderPreview(); renderStatus();
      return store.save(ed.key, ed.draft, by(), { baseRevision: ed.baseRevision }).then(function (r) {
        state.saving--;
        if (r.ok) { state.editor = null; rememberEdit({ key: ed.key, itemId: ed.itemId, locale: ed.locale, field: ed.field, before: ed.original, after: ed.draft, afterRev: r.cell.revision, at: Date.now() }); toast('서버에 저장되었습니다. 잘못 고쳤으면 Ctrl+Z로 되돌릴 수 있습니다.', 'ok'); }
        else if (r.reason === 'conflict') { ed.status = 'conflict'; ed.conflict = r.current || {}; ed.message = ''; }
        else { ed.status = 'error'; ed.message = '미저장: ' + reasonMessage(r) + ' 입력한 내용은 그대로 남아 있습니다.'; }
        renderPreview(); renderSidebar(); renderStatus();
      });
    }

    function reloadLatest() {
      var ed = state.editor;
      if (!ed || ed.status !== 'conflict') return;
      var cur = ed.conflict || {};
      if (typeof cur.revision !== 'number') { toast('서버 최신 값을 확인할 수 없습니다. 잠시 뒤 다시 시도해 주세요.', 'error'); return; }
      store.adopt(ed.key, cur);
      ed.baseRevision = cur.revision; ed.original = typeof cur.value === 'string' ? cur.value : ''; ed.draft = ed.original;
      ed.status = 'idle'; ed.message = ''; ed.conflict = null; ed.justOpened = true;
      renderPreview(); renderSidebar(); renderStatus();
    }

    function editorPanel(ed, kind) {
      var price = kind === 'price';
      var ta = H('textarea', { class: 'field-editor', rows: isMultiline(ed.field, ed.draft) ? '6' : '2', value: ed.draft, 'aria-label': ed.field + ' 수정', onkeydown: function (e) {
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === 'Escape') { if (ed.status !== 'saving') { e.preventDefault(); closeEditor(); } return; }
        if (e.key === 'Enter') {
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); commitEdit(); return; }
          if (!e.shiftKey && !isMultiline(ed.field, ed.ta ? ed.ta.value : ed.draft)) { e.preventDefault(); commitEdit(); }
        }
      } });
      ta.addEventListener('input', function () { ed.draft = ta.value; });
      ed.ta = ta;
      var busy = ed.status === 'saving';
      var cur = ed.conflict || {};
      return H('div', { class: 'editor-panel' + (price ? ' is-price' : ''), 'data-kind': kind }, [
        H('label', { class: 'editor-label', text: (price ? '금액 수정 · ' : '문구 수정 · ') + ed.field }),
        ta,
        price ? H('p', { class: 'price-warning', text: '금액 항목입니다. 숫자와 단위(만원 등)를 확인하세요. 기본값: ' + ed.def }) : H('p', { class: 'editor-default', text: '기본 문구: ' + ed.def }),
        ed.message ? H('p', { class: 'editor-msg status-' + ed.status, role: 'alert', text: ed.message }) : null,
        ed.status === 'conflict' ? H('div', { class: 'conflict-panel', role: 'alert' }, [
          H('p', { text: '다른 사람(' + (cur.by || '알 수 없음') + ')이 먼저 저장했습니다. 내 입력으로 덮어쓰지 않았습니다.' }),
          H('div', { class: 'conflict-cols' }, [
            H('div', null, [H('strong', { text: '서버 최신 값' }), H('pre', { text: typeof cur.value === 'string' ? cur.value : '' })]),
            H('div', null, [H('strong', { text: '내 입력' }), H('pre', { text: ed.draft })]),
          ]),
          H('button', { type: 'button', class: 'btn', 'data-action': 'reload-latest', text: '최신 값으로 다시 편집', onclick: reloadLatest }),
        ]) : null,
        H('div', { class: 'editor-actions' }, [
          H('button', { type: 'button', class: 'btn primary', 'data-action': 'save', disabled: busy || ed.status === 'conflict', text: busy ? '저장 중…' : '저장', onclick: commitEdit }),
          H('button', { type: 'button', class: 'btn', 'data-action': 'cancel', disabled: busy, text: '취소', onclick: closeEditor }),
          H('button', { type: 'button', class: 'btn ghost', 'data-action': 'fill-default', disabled: busy || ed.status === 'conflict', text: '기본값 채우기', onclick: function () { ta.value = ed.def; ed.draft = ed.def; ta.focus(); } }),
          H('span', { class: 'editor-hint', text: isMultiline(ed.field, ed.draft) ? 'Ctrl+Enter 저장 · Esc 취소' : 'Enter 저장 · Shift+Enter 줄바꿈 · Esc 취소' }),
        ]),
      ]);
    }

    function editable(tag, name, extra) {
      var it = item(); var loc = state.locale;
      var def = it.fields[loc][name];
      var key = cellKey(it.id, loc, name);
      var kind = fieldKind(name);
      var ed = state.editor;
      var el = H(tag, { class: 'field ' + (extra || ''), 'data-field': name, 'data-key': key, 'data-kind': kind, tabindex: '0', title: '더블클릭하면 수정할 수 있습니다' });
      var open = function () { openEditor(it.id, loc, name, def); };
      if (ed && ed.key === key) {
        el.className += ' is-editing'; el.removeAttribute('title');
        el.appendChild(editorPanel(ed, kind));
        return el;
      }
      var val = store.value(key, def);
      var cell = store.get(key);
      el.appendChild(H('span', { class: 'field-text' + (val === '' ? ' is-empty' : ''), text: val === '' ? '(비어 있음)' : val }));
      if (cell && cell.value !== def) el.appendChild(H('span', { class: 'edited-badge', title: (cell.by || '') + ' · 수정됨', text: kind === 'price' ? '금액 수정됨' : '수정됨' }));
      el.appendChild(H('button', { type: 'button', class: 'edit-btn', 'aria-label': name + ' 수정', text: '수정', onclick: open }));
      el.addEventListener('dblclick', function () { open(); });
      el.addEventListener('keydown', function (e) { if (e.target === el && (e.key === 'Enter' || e.key === 'F2')) { e.preventDefault(); open(); } });
      return el;
    }

    /* ---- preview ---- */
    function safeTheme(t) { return String(t || 'default').replace(/[^A-Za-z0-9-]/g, '') || 'default'; }

    function previewHead(it) {
      var cb = H('input', { type: 'checkbox', class: 'select-box big', 'data-preview-select': it.id, checked: store.isSelected(it.id, state.locale), disabled: !store.canEdit() || !hasLocale(it, state.locale), onchange: function (e) { onSelectChange(it.id, state.locale, !!e.target.checked); } });
      state.previewCb = cb;
      return H('div', { class: 'preview-head' }, [
        H('div', null, [
          isTestItem(it.id)
            ? H('span', { class: 'kind-badge kind-test', text: '테스트 구간' })
            : H('span', { class: 'kind-badge kind-' + it.kind, text: it.kind === 'aptos' ? '완성 디자인 · 압토스' : it.kind === 'landing' ? '완성 디자인 · 공유 검토' : '기획 검토 시안 · 확정 아님' }),
          H('h2', { class: 'preview-title', text: it.label + ' · ' + state.locale + (state.mode === 'app' ? ' · 뷰티앱' : '') }),
          isTestItem(it.id) ? H('p', { class: 'test-note', text: '테스트 구간 항목입니다. 연습용으로 만든 랜딩 7종(수능 포함)이며 실제 진행 작업과 구분됩니다.' }) : null,
        ]),
        H('div', { class: 'preview-actions' }, [
          hasPage(it) && (it.cards | 0) > 0 ? H('button', { type: 'button', class: 'btn final-btn', 'data-action': 'final-open', text: '최종본 전체보기', onclick: function () { openFinal(it); } }) : null,
          (state.previewFb = H('button', { type: 'button', class: 'btn fb-btn', 'data-action': 'feedback-done', 'data-feedback-for': it.id, title: '팀 피드백을 다 달았으면 눌러 주세요. 왼쪽 목록 제목이 분홍색으로 바뀝니다.', onclick: function () { toggleFeedback(it.id); } }), syncFbBtn(), state.previewFb),
          H('label', { class: 'preview-select' }, [cb, H('span', { text: state.locale + ' 디자인 최종완료' })]),
        ]),
      ]);
    }

    /* ---- feedback round finished (pink title in the list) ---- */
    function feedbackDone(itemId) { return store.value(feedbackKey(itemId), '') === 'done'; }
    function syncFbBtn() {
      var b = state.previewFb; if (!b) return;
      var on = feedbackDone(b.getAttribute('data-feedback-for'));
      b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.disabled = !store.canEdit(); b.textContent = on ? '피드백 완료됨' : '피드백 완료로 표시';
    }
    function toggleFeedback(itemId) {
      if (!store.canEdit()) { toast('공유 서버에 연결되지 않아 저장할 수 없습니다 (편집 잠금).', 'error'); return Promise.resolve(); }
      var key = feedbackKey(itemId), next = feedbackDone(itemId) ? '' : 'done';
      state.saving++; renderStatus();
      return store.save(key, next, by()).then(function (r) {
        state.saving--;
        if (r.ok) toast(next ? '피드백 완료로 표시했습니다.' : '피드백 완료 표시를 없앰습니다.', 'ok');
        else if (r.reason === 'conflict') { store.adopt(key, r.current); toast('다른 사람이 먼저 바꿨습니다. 최신 상태를 불러왔습니다.', 'error'); }
        else toast('서버에 저장되지 않았습니다. (' + reasonMessage(r) + ')', 'error');
        renderSidebar(); renderPreview(); renderStatus();
      });
    }

    /* ---- final version, full view: slides in from the right; chosen A/B only, saved wording, no pins (2026-11-06) ---- */
    function variantSummary(it) { return VARIANT_SLOTS.map(function (n) { return n + '장 ' + variantOf(it.id, n).toUpperCase() + '안'; }).join(' · ') + ' 선택 기준 · 저장된 문구 반영'; }
    function openFinal(it) {
      if (!it || !hasPage(it)) return;
      closeFinal(true);
      var stage = H('div', { class: 'final-stage' }), note = H('p', { class: 'final-note', role: 'status', text: '최종본을 준비하는 중입니다…' });
      var sizes = sizesOf(it), tabs = sizes.length > 1 ? H('div', { class: 'final-sizes', role: 'tablist', 'aria-label': '사이즈' }) : null;
      var panel = H('div', { class: 'final-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': it.label + ' 최종본 전체보기', 'data-final-for': it.id }, [
        H('div', { class: 'final-head' }, [
          H('div', { class: 'final-title-wrap' }, [H('h2', { class: 'final-title', text: it.label + ' · 최종본' }), H('p', { class: 'final-sub', text: variantSummary(it) })]),
          tabs,
          H('button', { type: 'button', class: 'btn final-close', 'data-action': 'final-close', text: '닫기 (Esc)', onclick: function () { closeFinal(); } }),
        ]),
        note, stage,
      ]);
      state.final = { el: panel, stage: stage, note: note, tabs: tabs, sizes: sizes, itemId: it.id, frame: null, fit: null, size: null };
      doc.body.appendChild(panel);
      loadFinal('home');
      win0.requestAnimationFrame(function () { win0.requestAnimationFrame(function () { panel.className += ' open'; }); });
    }
    function loadFinal(sizeId) {
      var f = state.final, it = f && itemById(f.itemId); if (!f || !it) return;
      var size = f.size = sizeById(sizeId);
      if (f.tabs) f.tabs.replaceChildren.apply(f.tabs, f.sizes.map(function (s) {
        var cur = s.id === size.id;
        return H('button', { type: 'button', role: 'tab', class: 'btn small' + (cur ? ' current' : ''), 'aria-selected': cur ? 'true' : 'false', 'data-final-size': s.id, text: (s.id === 'home' ? '기본' : s.label) + ' ' + s.w + '×' + s.h, onclick: function () { if (!cur) loadFinal(s.id); } });
      }));
      f.note.hidden = false; f.note.textContent = '최종본을 준비하는 중입니다…';
      var fw = Math.max(CAP.frameW, size.w + 200), fr = doc.createElement('iframe');
      fr.className = 'final-frame'; fr.setAttribute('title', it.label + ' 최종본'); fr.setAttribute('scrolling', 'no'); fr.style.width = fw + 'px'; fr.style.height = '1600px';
      var fit = H('div', { class: 'final-fit' }, [fr]);
      f.frame = fr; f.fit = fit; f.stage.replaceChildren(fit); f.stage.scrollTop = 0;
      fr.addEventListener('load', function () {
        if (state.final !== f || f.frame !== fr) return;
        var cap = { el: fr, fields: effectiveFields(it, 'KO', store) };
        postTo(cap, { type: 'aptos-data', locale: 'KO', fields: cap.fields, formats: effectiveFormats(it,'KO',store), layouts: effectiveLayouts(it,'KO',store), editable: false, editMode: false });
        capApplied(cap, it, 'KO').catch(function () { return null; }).then(function () {
          if (state.final !== f || f.frame !== fr || !fr.contentDocument) return;
          var idoc = fr.contentDocument;
          applyVariantsToDoc(idoc, it, false);
          Array.prototype.forEach.call(idoc.querySelectorAll('[data-bb-overlay]'), function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
          if (size.id !== 'home' && idoc.documentElement.getAttribute('data-size') !== size.id) { f.note.textContent = '이 페이지에는 ' + size.label + ' ' + size.w + '×' + size.h + ' 디자인이 아직 없습니다.'; return; }
          f.note.hidden = true; fitFinal();
          [300, 1200, 3000].forEach(function (ms) { win0.setTimeout(fitFinal, ms); }); /* late images and fonts change the height */
        });
      });
      fr.src = it.page + '?lang=KO' + PAGE_V + '&capture=1' + (size.id !== 'home' ? '&size=' + size.id : '');
    }
    function fitFinal() {
      var f = state.final, fr = f && f.frame, idoc = fr && fr.contentDocument; if (!idoc || !idoc.documentElement) return;
      var h = Math.max(idoc.documentElement.scrollHeight, idoc.body ? idoc.body.scrollHeight : 0), fw = parseFloat(fr.style.width) || CAP.frameW;
      var s = Math.min(1, Math.max(0.2, (f.stage.clientWidth - 32) / fw));
      fr.style.height = h + 'px'; fr.style.transform = 'scale(' + s + ')';
      f.fit.style.width = Math.round(fw * s) + 'px'; f.fit.style.height = Math.round(h * s) + 'px';
    }
    function closeFinal(now) {
      var f = state.final; if (!f) return;
      state.final = null;
      var el = f.el; el.className = el.className.replace(/\s*\bopen\b/g, '');
      if (now || !win0) { if (el.parentNode) el.parentNode.removeChild(el); return; }
      win0.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 420);
    }

    function missing(name) { return H('div', { class: 'missing-field', text: '필드 누락: ' + name }); }

    function planCard(it, f) {
      var loc = localeObj(state.locale);
      var has = function (n) { return Object.prototype.hasOwnProperty.call(f, n); };
      var ed = function (tag, n, cls) { return has(n) ? editable(tag, n, cls) : missing(n); };
      var offers = collectOffers(f);
      var conds = collectNumbered(f, 'condition');
      var approvals = collectNumbered(f, 'approval');
      var notes = [];
      if(has('label'))notes.push(H('div',{class:'note'},[H('h4',{text:'목록 이름'}),editable('p','label','note-text')]));
      if(has('selectionReason'))notes.push(H('div',{class:'note'},[H('h4',{text:'선택 기준'}),editable('p','selectionReason','note-text')]));
      var refs=collectNumbered(f,'reference');
      if(refs.length)notes.push(H('div',{class:'note'},[H('h4',{text:'참고 근거'}),H('div',null,refs.map(function(r){return editable('p',r.field,'note-text');}))]));
      if (has('audience')) notes.push(H('div', { class: 'note' }, [H('h4', { text: '대상' }), editable('p', 'audience', 'note-text')]));
      if (has('concept')) notes.push(H('div', { class: 'note' }, [H('h4', { text: '콘셉트' }), editable('p', 'concept', 'note-text')]));
      if (approvals.length) notes.push(H('div', { class: 'note' }, [H('h4', { text: '승인 확인 사항' }), H('ul', { class: 'approvals' }, approvals.map(function (a) { return editable('li', a.field, 'approval'); }))]));
      return H('article', { class: 'plan-card theme-' + safeTheme(it.theme), lang: loc && loc.lang }, [
        H('div', { class: 'plan-hero'+(it.image?' has-photo':'') }, [
          it.image ? H('img',{class:'plan-hero-photo',src:it.image,alt:f.alt_image||it.imageAlt||'',loading:'eager'}) : null,
          ed('p', 'heroEyebrow', 'eyebrow'), ed('h3', 'title', 'plan-title'), ed('p', 'subtitle', 'plan-subtitle'), ed('p', 'body', 'plan-body'),
        ]),
        H('section', { class: 'offers' }, [
          H('h4', { class: 'section-title', text: 'OPTIONS · KRW' }),
          H('div', { class: 'offer-grid offers-' + offers.length }, offers.map(function (o) {
            return H('div', { class: 'offer' }, [
              o.title ? editable('h5', o.title, 'offer-title') : missing('offer' + o.n + '_title'),
              o.detail ? editable('p', o.detail, 'offer-detail') : null,
              H('div', { class: 'price-box' }, [
                o.price ? editable('div', o.price, 'offer-price') : missing('offer' + o.n + '_price'),
                o.vat ? editable('div', o.vat, 'offer-vat') : null,
              ]),
            ]);
          })),
        ]),
        conds.length ? H('section', { class: 'conditions' }, [
          H('h4', { class: 'section-title', text: '이용 조건' }),
          H('ul', null, conds.map(function (c) { return editable('li', c.field, 'condition'); })),
        ]) : null,
        notes.length ? H('details', { class: 'rationale' }, [H('summary', { text: '기획 근거 · 확인 사항' }), H('div', { class: 'notes' }, notes)]) : null,
      ]);
    }

    function aptosShell(it) {
      var ownPage = typeof it.page === 'string' && /^[a-z0-9-]+\/index\.html$/.test(it.page);
      var frame = H('iframe', { class: 'aptos-frame', src: ownPage ? it.page + '?lang=' + encodeURIComponent(state.locale) + PAGE_V + (state.dlSize && state.dlSize[it.id] && state.dlSize[it.id] !== 'home' ? '&size=' + state.dlSize[it.id] : '') : (it.kind === 'aptos' ? 'aptos/index.html?lang=' + encodeURIComponent(state.locale) : 'landings/index.html?item=' + encodeURIComponent(it.id) + '&lang=' + encodeURIComponent(state.locale)) + '&v=20261029-edit1', title: it.label + ' ' + state.locale + ' 완성 디자인', loading: 'eager' });
      state.aptos = { el: frame, itemId: it.id, locale: state.locale, win: null, editing: null, inline: false };
      frame.addEventListener('load', function () { syncViewer(); later(syncViewer, 400); });
      state.frames.push(state.aptos); if (state.frames.length > 6) state.frames.shift();
      return H('div', { class: 'aptos-shell' }, [
        H('p', { class: 'aptos-note', text: typeof it.note === 'string' && it.note ? it.note : it.kind === 'aptos' ? '글자를 누르면 바로 고칠 수 있고, Enter를 누르거나 다른 곳을 누르면 공유 저장됩니다(Esc는 취소). 원문의 ‘최대 49%’ 배지는 표시 가격과 계산이 맞지 않아 확인이 필요합니다. 기존 행사 기간은 10/21~11/30입니다.' : '검토용 디자인입니다. 글자를 누르면 바로 고칠 수 있고, Enter를 누르거나 다른 곳을 누르면 공유 저장됩니다(Esc는 취소). 행사 가격·기간·적용 조건은 최종 확인 대상입니다.' }),
        frame,
      ]);
    }

    function renderPreview() {
      var it = item();
      if (!it || state.mode === 'download') return;
      var key = it.id + '/' + state.locale + '/' + state.mode;
      var ed0 = state.editor;
      if (ed0 && ed0.ta) { ed0.selStart = ed0.ta.selectionStart; ed0.selEnd = ed0.ta.selectionEnd; ed0.hadFocus = doc.activeElement === ed0.ta; }
      if (state.mode === 'app') {
        if (state.previewKey === key && state.appView && state.appView.itemId === it.id) {
          if (state.previewCb) { state.previewCb.checked = store.isSelected(it.id, state.locale); state.previewCb.disabled = !store.canEdit() || !hasLocale(it, state.locale); }
          fillDesignBox(); updateAppView();
          return;
        }
        state.previewKey = key; state.aptos = null;
        ui.preview.replaceChildren.apply(ui.preview, [previewHead(it), designBox(it), appPreview(it)].filter(Boolean));
        return;
      }
      state.appView = null;
      if ((it.kind === 'aptos' || it.kind === 'landing') && state.previewKey === key && state.aptos && state.aptos.el.parentNode) {
        if (state.previewCb) { state.previewCb.checked = store.isSelected(it.id, state.locale); state.previewCb.disabled = !store.canEdit(); }
        syncFbBtn();
        fillDesignBox();
        postAptosData();
        syncViewer();
        return;
      }
      state.previewKey = key;
      if (it.kind !== 'aptos' && it.kind !== 'landing') state.aptos = null;
      var f = it.fields && it.fields[state.locale];
      var body;
      if (!hasLocale(it, state.locale)) {
        state.aptos = null;
        var lo = localeObj(state.locale);
        body = H('div', { class: 'missing-locale pending-locale', role: 'status', text: '이 페이지는 한국어판을 먼저 확정한 뒤 ' + (lo && lo.label ? lo.label : state.locale) + ' 판을 만듭니다.' });
      } else if (!isObj(f) || !Object.keys(f).length) {
        state.aptos = null;
        body = H('div', { class: 'missing-locale', role: 'alert', text: '이 언어판 데이터가 없습니다: ' + it.id + ' / ' + state.locale + '. 부모 작업(data.json)에서 채워야 합니다.' });
      } else body = (it.kind === 'aptos' || it.kind === 'landing') ? aptosShell(it) : planCard(it, f);
      var bar = state.aptos && state.aptos.itemId === it.id ? downloadBar(it) : null;
      var design = state.aptos && state.aptos.itemId === it.id ? designBox(it) : null;
      ui.preview.replaceChildren.apply(ui.preview, [previewHead(it), state.aptos && state.aptos.itemId === it.id ? (renderEditorBar(), ui.ebar) : null, design, bar, body].filter(Boolean));
      var ed = state.editor;
      if (ed && ed.ta && (ed.justOpened || ed.hadFocus)) {
        ed.ta.focus();
        if (ed.justOpened) ed.ta.setSelectionRange(ed.ta.value.length, ed.ta.value.length);
        else if (typeof ed.selStart === 'number') ed.ta.setSelectionRange(ed.selStart, ed.selEnd);
        ed.justOpened = false;
      }
    }

    /* ---- aptos iframe protocol ---- */
    function targetOrigin() { var o = origin(); return !o || o === 'null' ? '*' : o; }
    function postToFrame(msg) { postTo(state.aptos, msg); }
    function postTo(a, msg) {
      var win = a && (a.el.contentWindow || a.win);
      try { if (win && win.postMessage) win.postMessage(msg, targetOrigin()); } catch (e) { /* page already closed */ }
    }
    /* the frame a message came from: the open page, or a page just replaced while its in-place edit was saving */
    function frameOf(src) {
      var a = state.aptos;
      if (a && a.el.contentWindow && src === a.el.contentWindow) { a.win = src; return a; }
      for (var i = state.frames.length - 1; i >= 0; i--) if (state.frames[i].win && state.frames[i].win === src) return state.frames[i];
      return null;
    }
    function aptosItem() { return state.aptos && state.data.items.filter(function (i) { return i.id === state.aptos.itemId; })[0]; }
    function postAptosData() {
      var a = state.aptos; var it = aptosItem(); if (!a || !it) return;
      postToFrame({ type: 'aptos-data', locale: a.locale, fields: effectiveFields(it, a.locale, store), formats: effectiveFormats(it,a.locale,store), layouts: effectiveLayouts(it,a.locale,store), tool: state.tool || 'move', editable: store.canEdit(), editMode: ui.app.className.split(/\s+/).indexOf('edit-mode') >= 0 });
    }
    function onMessage(e) {
      var cap = state.capture;
      if (cap && cap.el && e.source === cap.el.contentWindow) {
        if (e.origin === origin() && isObj(e.data) && e.data.type === 'aptos-ready' && cap.fields) capPost(cap);
        return;
      }
      var acf = appFrameOf(e.source);
      if (acf) {
        if (e.origin !== origin() || !isObj(e.data)) return;
        if (e.data.type === 'aptos-ready') postAppData(acf);
        else if (e.data.type === 'aptos-size') layoutCrop(acf);
        return;
      }
      var a = frameOf(e.source);
      if (!a) return;
      if (e.origin !== origin()) return;
      var d = e.data;
      if (!isObj(d)) return;
      if (a !== state.aptos) {
        if (d.type === 'aptos-edit') handleAptosEdit(a, d);
        else if (d.type === 'aptos-edit-cancel') a.editing = null;
        return;
      }
      if (d.type === 'aptos-ready') a.inline = d.inline === true;
      if (d.type === 'aptos-size' && Number.isFinite(d.height) && d.height >= 300 && d.height <= 25000) { a.el.style.height = Math.ceil(d.height) + 'px'; syncViewer(); }
      else if (d.type === 'aptos-ready') { postAptosData(); syncViewer(); }
      else if(d.type==='aptos-editing' && typeof d.field==='string' && FIELD_RE.test(d.field)){var k=cellKey(a.itemId,a.locale,d.field),c=store.get(k),scope=frameScope(a);a.editing={field:d.field,key:k,baseRevision:c?c.revision:0,scope:scope,slot:d.slot||''};if(Format){try{var fk=cellKey(a.itemId,a.locale,Format.key(d.field,scope,d.slot||'')),fc=store.get(fk);a.editing.formatKey=fk;a.editing.formatBaseRevision=fc?fc.revision:0;}catch(err){a.editing=null;}}}
      else if(d.type==='aptos-edit-cancel'){a.editing=null;}
      else if (d.type === 'aptos-edit') handleAptosEdit(a, d);
      else if (d.type === 'aptos-layout') handleLayoutEdit(a, d);
      else if (d.type === 'aptos-layers' && Array.isArray(d.list)) { state.layers = { itemId: a.itemId, list: d.list.filter(isObj).slice(0, 400), selected: typeof d.selected === 'string' ? d.selected : '', scrollTo: state.layers && state.layers.itemId === a.itemId ? state.layers.scrollTo : null }; renderLayerPanel(); renderEditorBar(); }
      else if (d.type === 'aptos-tool-request') setTool(d.tool);
      else if (d.type === 'aptos-undo') undoLast();
      else if (d.type === 'aptos-redo') redoLast();
    }
    function frameScope(a){
      try{var src=a.el.getAttribute?a.el.getAttribute('src'):a.el.src,q=new URL(src||'',doc.baseURI||'http://local/').searchParams;if(q.get('mode')==='app')return 'app';if(q.get('size')==='line'||q.get('size')==='kakao')return q.get('size');}catch(e){}return 'home';
    }
    /* Separate revision-checked text and typography cells; partial failures are never reported as saved. */
    function handleFormattedEdit(a,d,it,ack){
      var scope=frameScope(a),slot=d.slot||'',format=Format&&Format.normalize(d.format,d.value);
      if(!format||d.scope!==scope||(slot&&!Format.validSlot(slot))){ack(false,'서식이나 규격이 올바르지 않습니다.');return Promise.resolve();}
      var encoded;try{encoded=Format.isDefault(format)?'':Format.encode(format,d.value);}catch(e){ack(false,e.message);return Promise.resolve();}
      var key=cellKey(it.id,a.locale,d.field),fk=cellKey(it.id,a.locale,Format.key(d.field,scope,slot)),before=store.value(key,String(it.fields[a.locale][d.field]||'')),beforeFmt=store.value(fk,''),ed=a.editing&&a.editing.field===d.field?a.editing:null;
      if(ed&&ed.slot!==slot){ack(false,'수정 중인 문구 구간이 다릅니다.');return Promise.resolve();}
      var jobs=[],applied=[],failure=null,textSaved=d.value===before,formatSaved=encoded===beforeFmt;
      if(d.value!==before)jobs.push({key:key,before:before,after:d.value,baseRevision:ed?ed.baseRevision:(store.get(key)||{}).revision||0,kind:'text'});
      if(encoded!==beforeFmt)jobs.push({key:fk,before:beforeFmt,after:encoded,baseRevision:ed&&ed.scope===scope?ed.formatBaseRevision:(store.get(fk)||{}).revision||0,kind:'format'});
      state.saving++;renderStatus();
      return jobs.reduce(function(chain,j){return chain.then(function(){if(failure)return;return store.save(j.key,j.after,by(),{baseRevision:j.baseRevision}).then(function(r){
        if(!r.ok){failure=r;if(r.reason==='conflict'&&r.current){store.adopt(j.key,r.current);if(ed){if(j.kind==='text')ed.baseRevision=r.current.revision;else ed.formatBaseRevision=r.current.revision;}}return;}
        j.afterRev=r.cell.revision;j.itemId=it.id;j.locale=a.locale;j.field=d.field;j.at=Date.now();applied.push(j);
        if(j.kind==='text'){textSaved=true;if(ed)ed.baseRevision=r.cell.revision;}else{formatSaved=true;if(ed)ed.formatBaseRevision=r.cell.revision;}
      });});},Promise.resolve()).then(function(){
        state.saving--;
        if(applied.length===1)rememberEdit(applied[0]);else if(applied.length>1)rememberEdit({changes:applied,itemId:it.id,locale:a.locale,field:d.field,at:Date.now()});
        if(!failure){if(a.editing===ed)a.editing=null;toast('문구와 서식을 저장했습니다. Ctrl+Z로 되돌릴 수 있습니다.','ok');}
        else toast((textSaved&&d.value!==before?'문구는 저장됐지만 서식은 저장되지 않았습니다. ':'저장되지 않았습니다. ')+reasonMessage(failure),'error');
        if(a===state.aptos)postAptosData();else if(applied.length)renderSidebar();
        ack(!failure,failure?((textSaved&&d.value!==before?'문구는 저장됐습니다. 서식: ':'')+reasonMessage(failure)):null,{textSaved:textSaved,formatSaved:formatSaved,savedValue:textSaved?d.value:before});
        renderStatus();
      });
    }
    /* ---- 2026-11-12 디자인 편집기 (Photoshop style, user: "포토샵처럼 편집기 스타일"): a tools bar over the preview (이동 도구 V / 글자 도구 T,
       되돌리기, the selected layer's X · Y · 크기 · 숨기기 · 원래대로) and a 레이어 panel in the right column (per card: thumbnail, name, moved mark, eye).
       The page reports its layers (aptos-layers); clicks here go back as aptos-layer-select / aptos-layer-set. ---- */
    function setTool(t) { state.tool = t === 'text' ? 'text' : 'move'; postAptosData(); renderEditorBar(); }
    function layerSelected() { var L = state.layers; if (!L || !L.selected) return null; return L.list.filter(function (l) { return l.name === L.selected; })[0] || null; }
    function layerGroupName(l) { var c = String(l.card || ''); if (/^\d+$/.test(c)) return c + '장' + (l.variant === 'b' ? ' B안' : '') + (l.part && String(l.part) !== '1' ? '-' + l.part : ''); return { thumb: '대표 이미지', card: '카드 이미지', detail: '상세 이미지' }[c] || c; }
    function layerSet(name, o) { postToFrame(Object.assign({ type: 'aptos-layer-set', name: name }, o)); }
    function layerNum(v, d) { v = Number(v); return isFinite(v) ? Math.round(v * Math.pow(10, d)) / Math.pow(10, d) : 0; }
    function renderEditorBar() {
      if (!ui.ebar) return;
      var l = layerSelected(), tool = state.tool || 'move';
      var tb = function (id, label, key, title) { return H('button', { type: 'button', class: 'btn small eb-tool', 'data-tool': id, 'aria-pressed': tool === id ? 'true' : 'false', title: title, onclick: function () { setTool(id); } }, [H('span', { class: 'eb-key', text: key }), label]); };
      var num = function (label, attr, value, apply) { return H('label', { class: 'eb-num' }, [H('span', { text: label }), H('input', { type: 'number', step: '1', value: String(value), 'data-eb': attr, onchange: function (e) { var v = Number(e.target.value); if (isFinite(v)) apply(v); } })]); };
      ui.ebar.replaceChildren(
        H('div', { class: 'eb-group', role: 'group', 'aria-label': '도구' }, [tb('move', '이동 도구', 'V', '그림·글자를 눌러 옮기고, 모서리를 끌어 크기를 바꿉니다'), tb('text', '글자 도구', 'T', '글자를 눌러 바로 고칩니다')]),
        H('div', { class: 'eb-group' }, [
          H('button', { type: 'button', class: 'btn small', 'data-action': 'eb-undo', title: '되돌리기 (Ctrl+Z)', text: '↶ 되돌리기', onclick: function () { undoLast(); } }),
          H('button', { type: 'button', class: 'btn small', 'data-action': 'eb-redo', title: '다시 실행 (Ctrl+Shift+Z)', text: '↷ 다시 실행', onclick: function () { redoLast(); } }),
        ]),
        l && tool === 'move' ? H('div', { class: 'eb-group eb-sel' }, [
          H('span', { class: 'eb-name', title: String(l.label || ''), text: (l.kind === 'text' ? '글자 · ' : '그림 · ') + String(l.label || '') }),
          num('X', 'x', layerNum(l.x, 1), function (v) { layerSet(l.name, { x: v }); }),
          num('Y', 'y', layerNum(l.y, 1), function (v) { layerSet(l.name, { y: v }); }),
          num('크기 %', 's', Math.round(layerNum(l.s, 3) * 100), function (v) { if (v >= 20 && v <= 400) layerSet(l.name, { s: v / 100 }); }),
          H('button', { type: 'button', class: 'btn small', 'data-action': 'eb-hide', text: l.hidden ? '보이기' : '숨기기', onclick: function () { layerSet(l.name, { hidden: !l.hidden }); } }),
          H('button', { type: 'button', class: 'btn small', 'data-action': 'eb-reset', text: '원래대로', onclick: function () { layerSet(l.name, { reset: true }); } }),
        ]) : H('p', { class: 'eb-hint', text: tool === 'move' ? '그림이나 글자를 누른 채 끌면 옮겨지고, 모서리를 끌면 크기가 바뀝니다. 방향키 1px · Shift 10px · 글자를 두 번 누르면 바로 고칩니다 · Ctrl+Z 되돌리기' : '글자를 눌러 바로 고칩니다. 그림을 옮기려면 이동 도구(V)를 고르세요.' })
      );
    }
    function renderLayerPanel() {
      if (!ui.lpanel) return;
      var L = state.layers, it = aptosItem(), own = origin();
      if (!L || !it || L.itemId !== it.id || !L.list.length) { ui.lpanel.replaceChildren(H('h3', { class: 'lp-title', text: '레이어' }), H('p', { class: 'lp-empty', text: hasAppClass('edit-mode') ? '미리보기를 불러오는 중이거나 화면이 좁아 편집할 수 없습니다 (미리보기 폭 560px 이상).' : '디자인 편집기를 켜면 이 페이지의 레이어가 여기에 나옵니다.' })); return; }
      var groups = [], byKey = {};
      L.list.forEach(function (l) { var g = layerGroupName(l); if (!byKey[g]) { byKey[g] = { name: g, items: [] }; groups.push(byKey[g]); } byKey[g].items.push(l); });
      ui.lpanel.replaceChildren(
        H('h3', { class: 'lp-title' }, ['레이어 ', H('span', { class: 'lp-count', text: L.list.length + '개' })]),
        H('p', { class: 'lp-hint', text: '누르면 미리보기에서 그 레이어가 선택됩니다. 옮기거나 크기를 바꾼 레이어에는 ● 표시가 붙습니다.' }),
        H('div', { class: 'lp-groups' }, groups.map(function (g) {
          return H('section', { class: 'lp-group' }, [H('h4', { text: g.name }), H('ul', { class: 'lp-list' }, g.items.map(function (l) {
            var on = l.name === L.selected, label = String(l.label || ''), thumb = typeof l.thumb === 'string' && own && l.thumb.indexOf(own + '/') === 0 ? l.thumb : '';
            return H('li', { class: 'lp-row' + (on ? ' sel' : '') + (l.hidden ? ' off' : ''), 'data-layer': l.name }, [
              H('button', { type: 'button', class: 'lp-pick', 'aria-pressed': on ? 'true' : 'false', title: label, onclick: function () { if (state.tool !== 'move') setTool('move'); postToFrame({ type: 'aptos-layer-select', name: l.name }); } }, [
                l.kind === 'img' && thumb ? H('img', { class: 'lp-thumb', src: thumb, alt: '', loading: 'lazy' }) : H('span', { class: 'lp-thumb lp-t', text: 'T' }),
                H('span', { class: 'lp-label', text: label }),
                l.locked ? H('span', { class: 'lp-lock', title: '배경 레이어: 목록에서 골랐을 때만 옮겨집니다', text: '잠김' }) : null,
                l.moved ? H('span', { class: 'lp-moved', title: '옮기거나 크기를 바꾼 레이어', text: '●' }) : null,
              ]),
              H('button', { type: 'button', class: 'lp-eye', 'data-layer-eye': l.name, 'aria-pressed': l.hidden ? 'true' : 'false', title: l.hidden ? '보이게 하기' : '숨기기 (파일에서도 빠집니다)', text: l.hidden ? '숨김' : '보임', onclick: function () { layerSet(l.name, { hidden: !l.hidden }); } }),
            ]);
          }))]);
        }))
      );
      var cur = ui.lpanel.querySelector ? ui.lpanel.querySelector('.lp-row.sel') : null;
      if (cur && cur.scrollIntoView && L.scrollTo !== L.selected) { L.scrollTo = L.selected; cur.scrollIntoView({ block: 'nearest' }); }
    }
    /* a picture moved or resized in the open page (편집 모드): one revision-checked cell, remembered for Ctrl+Z */
    function handleLayoutEdit(a, d) {
      var it = aptosItem(), name = typeof d.name === 'string' ? d.name : '';
      var ack = function (ok, error) { postTo(a, { type: 'aptos-layout-result', name: name, ok: ok, error: error || null }); };
      var m = name.length <= 64 ? LAYOUT_RE.exec(name) : null;
      if (!it || !m || m[1] !== frameScope(a) || typeof d.value !== 'string' || !layoutValueOk(d.value)) { ack(false, '그림 위치 값이 올바르지 않습니다.'); return Promise.resolve(); }
      if (!store.canEdit()) { ack(false, '공유 서버에 연결되지 않아 저장할 수 없습니다.'); return Promise.resolve(); }
      var key = cellKey(it.id, a.locale, name), before = store.value(key, '');
      if (before === d.value) { ack(true); return Promise.resolve(); }
      state.saving++; renderStatus();
      return store.save(key, d.value, by()).then(function (r) {
        state.saving--;
        if (r.ok) { rememberEdit({ key: key, itemId: it.id, locale: a.locale, field: name, before: before, after: d.value, afterRev: r.cell.revision, at: Date.now(), kind: 'layout' }); toast('그림 위치·크기를 저장했습니다. 잘못 옮겼으면 Ctrl+Z로 되돌릴 수 있습니다.', 'ok'); }
        else if (r.reason === 'conflict') { store.adopt(key, r.current); toast('다른 사람이 먼저 이 그림을 옮겼습니다. 최신 위치를 불러왔습니다.', 'error'); }
        else toast('서버에 저장되지 않았습니다. (' + reasonMessage(r) + ')', 'error');
        if (a === state.aptos) postAptosData();
        ack(r.ok, r.ok ? null : reasonMessage(r));
        renderStatus();
      });
    }
    function handleAptosEdit(a, d) {
      var it = state.data.items.filter(function (i) { return i.id === a.itemId; })[0];
      var live = a === state.aptos;
      var ack = function (ok, error, extra) {
        var m = { type: 'aptos-save-result', field: typeof d.field === 'string' ? d.field : '', ok: ok };
        if (error) m.error = error;
        if(extra)Object.keys(extra).forEach(function(k){m[k]=extra[k];});
        postTo(a, m);
      };
      var defs = it && it.fields[a.locale];
      if (!defs || typeof d.field !== 'string' || !Object.prototype.hasOwnProperty.call(defs, d.field) || typeof d.value !== 'string') { if (live) postAptosData(); ack(false, '알 수 없는 필드이거나 값 형식이 올바르지 않습니다.'); return Promise.resolve(); }
      if (d.value.length > MAX_LEN) { if (live) postAptosData(); ack(false, '2000자를 넘어 저장할 수 없습니다.'); return Promise.resolve(); }
      if(Object.prototype.hasOwnProperty.call(d,'format'))return handleFormattedEdit(a,d,it,ack);
      var key = cellKey(it.id, a.locale, d.field);
      var before = store.value(key, defs[d.field] == null ? '' : String(defs[d.field]));
      state.saving++; renderStatus();
      return store.save(key, d.value, by(), a.editing && a.editing.field===d.field ? {baseRevision: a.editing.baseRevision} : {}).then(function (r) {
        state.saving--;
        if (r.ok) {if(!a.inline||(a.editing&&a.editing.field===d.field))a.editing=null;rememberEdit({ key: key, itemId: it.id, locale: a.locale, field: d.field, before: before, after: d.value, afterRev: r.cell.revision, at: Date.now() });toast('서버에 저장되었습니다. 잘못 고쳤으면 Ctrl+Z로 되돌릴 수 있습니다.', 'ok');}
        else if (r.reason === 'conflict') { store.adopt(key, r.current); if(a.editing)a.editing.baseRevision=r.current.revision; toast('다른 사람이 먼저 수정했습니다. 최신 문구를 불러왔습니다.', 'error'); }
        else toast('서버에 저장되지 않았습니다.', 'error');
        if (a === state.aptos) postAptosData(); else if (r.ok) renderSidebar();
        ack(r.ok, r.ok ? null : reasonMessage(r));
        renderStatus();
      });
    }

    /* ---- card image download (2026-10-30 user: "개별 다운로드 기능과 한번에 길게 다운로드 기능") ----
       The page opens in a hidden 1440px iframe with the same saved wording as the board, then every 1080x1350 card
       becomes a PNG via vendor/modern-screenshot-4.7.0.js (MIT, vendor/modern-screenshot-4.7.0.LICENSE.txt).
       capFontCss() embeds the font faces the five cards actually use (family, matched weight/style, characters), so the image matches the page. */
    /* board items whose page has five 1080x1350 cards (section.p1 ... section.p5). To add one, append it here, e.g. FV12: true, HH12: true */
    var CAP_ITEMS = { FV12: true, HH12: true }; /* 2026-11-03: OXM12·APT12 now have 6 cards with data-card (B/A added) */
    var pageHtmlCache = {};
    function pageHtmlFor(it) {
      if (!it || typeof it.page !== 'string') return Promise.reject(new Error('페이지가 없는 항목입니다.'));
      var key = it.page;
      if (!pageHtmlCache[key]) {
        var p = pageHtmlCache[key] = Promise.resolve().then(function () { return env.fetch(it.page, { cache: 'no-store' }); }).then(function (r) { if (!r.ok) throw new Error('페이지를 확인하지 못했습니다.'); return r.text(); });
        p.catch(function () { if (pageHtmlCache[key] === p) delete pageHtmlCache[key]; });
      }
      return pageHtmlCache[key];
    }
    function parseHtml(html) { var P = win0 && win0.DOMParser; return P ? new P().parseFromString(html, 'text/html') : null; }
    /* price cards of the chosen design (hero / 2nd section A or B) */
    function a4CardsFromHtml(html, it) {
      var d = parseHtml(html); if (!d) return [];
      if (it) applyVariantsToDoc(d, it, false);
      return Array.prototype.filter.call(d.querySelectorAll('[data-card]'), function (el) { return el.querySelectorAll('[data-price-row]').length >= 1; }).map(function (el) { return Number(el.getAttribute('data-card')); }).filter(function (n, i, a) { return isFinite(n) && a.indexOf(n) === i; });
    }
    function a4CardsFor(it) {
      if (!it || typeof it.page !== 'string') return Promise.resolve([]);
      return pageHtmlFor(it).then(function (html) { return a4CardsFromHtml(html, it); });
    }
    function pageInfoFor(it) {
      return pageHtmlFor(it).then(function (html) {
        var d = parseHtml(html), slots = {};
        VARIANT_SLOTS.forEach(function (n) { var s = d ? sectionsFor(d, n) : { a: null, b: null }; slots[n] = { a: !!s.a, b: !!s.b }; });
        return { slots: slots };
      });
    }
    var CAP_P5 = 'section.p1,section.p2,section.p3,section.p4,section.p5';
    var CAP = { items: CAP_ITEMS, sel: CAP_P5, n: 5, w: 1080, h: 1350, frameW: 1440, lib: 'vendor/modern-screenshot-4.7.0.js' };
    /* 2026-11-06 channel sizes (v4/events/CHANNEL_SIZES_20261106.md): every image is redesigned per size, never cropped.
       A page lists its sizes in data.json item.sizes (and <meta name="bb-sizes">); ?size=line|kakao switches it. New channel = one line. */
    var SIZES = [
      { id: 'home', label: '홈페이지·수가책·메타', w: 1080, h: 1350, tag: '' },
      { id: 'line', label: '라인', w: 1100, h: 1000, tag: '라인' },
      { id: 'kakao', label: '카카오톡', w: 800, h: 600, tag: '카카오톡' },
    ];
    function sizeById(id) { return SIZES.filter(function (s) { return s.id === id; })[0] || SIZES[0]; }
    function sizesOf(it) { var l = it && Array.isArray(it.sizes) ? it.sizes : []; return SIZES.filter(function (s) { return s.id === 'home' || l.indexOf(s.id) >= 0; }); }
    function sizeSuffix(size) { return size && size.id !== 'home' ? '_' + size.tag + '_' + size.w + 'x' + size.h : ''; }
    function partLabel(o) { return o.n + '장' + (o.parts > 1 ? '-' + o.part : ''); }
    /* winter event pages (2026-11-02) have a different number of cards: data.json item.cards = count and every card section carries data-card="1".."n" */
    function capSpec(it) {
      if (!it || typeof it.page !== 'string') return null;
      if (CAP_ITEMS[it.id]) return { sel: CAP_P5, n: 5 };
      if ((it.cards | 0) > 0) return { sel: '[data-card]', n: it.cards | 0 };
      return null;
    }
    var capFontData = {};

    function capName(it, locale, suffix) {
      var base = String(it.label || it.id).replace(/[\\/:*?"<>|]+/g, '').replace(/\s*·\s*/g, '_').replace(/\s+/g, '');
      return base + '_' + locale + '_' + suffix + '.png';
    }

    function safeBase(it) { return String(it.label || it.id).replace(/[\\/:*?"<>|]+/g, '').replace(/\s*·\s*/g, '_').replace(/\s+/g, ''); }
    function switchPreviewSize(it,size,done){
      var a=state.aptos;if(!a||a.itemId!==it.id||frameScope(a)===size){done(true);return;}
      var started=Date.now();state.sizeSwitchBusy=true;postTo(a,{type:'aptos-finish-edit'});
      function check(){
        if(state.aptos!==a){state.sizeSwitchBusy=false;done(false);return;}
        if(a.editing||state.saving){if(Date.now()-started<5000){setTimer(check,80);return;}state.sizeSwitchBusy=false;toast('현재 수정 내용을 먼저 저장하거나 취소해 주세요. 규격은 바꾸지 않았습니다.','error');done(false);return;}
        state.sizeSwitchBusy=false;state.previewKey=null;renderPreview();done(true);
      }
      setTimer(check,60);
    }
    /* 2026-11-11 download form modelled on MiriCanvas's download panel (team: "A6도 낱장으로 선택해서 뽑게, 미리캔버스처럼", user: "버튼이 헷갈려, 초보자도 이해하기 쉽게").
       ① 어디에 쓰나요 (온라인 크기 또는 원내 인쇄 A4·A6) → ② 파일 형식 → ③ 받을 장 고르기 (+ 합치기 / 담는 방식 / 여백) → 다운로드 정보와 다운로드 버튼 하나.
       Test hooks: .img-dl-sizes [data-size], [data-dl-fmt], [data-dl-pages="all"], [data-dl-page="N"], [data-dl-merge], [data-dl-layout], [data-dl-margin], [data-action="dl-go"]. */
    var DL_MARGINS = [[0, '없음', '인쇄소 재단용'], [5, '좁게', '5mm'], [10, '보통', '10mm · 권장'], [15, '넓게', '15mm']];
    function downloadBar(it) {
      var spec = capSpec(it); if (!spec || !env.downloadBlob) return null;
      state.dlSize = state.dlSize || {}; state.dlForm = state.dlForm || {};
      var sizes = sizesOf(it), all = []; for (var q = 1; q <= spec.n; q++) all.push(q);
      var f = state.dlForm[it.id] || (state.dlForm[it.id] = { use: state.dlSize[it.id] || 'home', fmt: 'png', pages: all.slice(), merge: false, pfmt: 'pdf', ppages: null, layout: 'together', margin: 10, price: [] });
      if (!PAPERS[f.use] && !sizes.some(function (s) { return s.id === f.use; })) f.use = 'home';
      var isPrint = function () { return !!PAPERS[f.use]; };
      var pagesNow = function () { return isPrint() ? (f.ppages || (f.price.length ? f.price : all)) : f.pages; };
      var controls = [], status = H('p', { class: 'img-dl-status', role: 'status', 'aria-live': 'polite' });
      var chip = function (props, title, desc) { var b = H('button', Object.assign({ type: 'button', class: 'btn small img-dl-chip', 'aria-pressed': 'false' }, props), [H('span', { class: 'img-dl-chip-t', text: title }), H('span', { class: 'img-dl-chip-d', text: desc || '' })]); controls.push(b); return b; };
      var setDesc = function (b, text) { var d = b.querySelector('.img-dl-chip-d'); if (d && d.textContent !== text) d.textContent = text; };
      var press = function (b, on) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); };
      var step = function (no, text, hint) { return H('div', { class: 'img-dl-step-head' }, [H('span', { class: 'img-dl-no', 'aria-hidden': 'true', text: no }), H('strong', { class: 'img-dl-label', text: text }), hint ? H('span', { class: 'img-dl-hint', text: hint }) : null]); };
      var row = function (label, aria, kids, cls) { return H('div', { class: 'img-dl-row' + (cls ? ' ' + cls : ''), role: 'group', 'aria-label': aria }, [label ? H('span', { class: 'img-dl-sub', text: label }) : null].concat(kids)); };
      var useBtns = [], useBtn = function (id, title, desc) { var b = chip({ 'data-size': id, onclick: function () { pickUse(id); } }, title, desc); b.classList.add('size-btn'); useBtns.push(b); return b; };
      var step1 = H('div', { class: 'img-dl-step' }, [step('1', '어디에 쓰나요?', '온라인 크기를 고르면 위 시안도 그 크기로 바뀝니다.'),
        row('온라인', '사이즈', sizes.map(function (s) { return useBtn(s.id, s.label, s.w + '×' + s.h + ' px'); }), 'img-dl-sizes'),
        row('원내 인쇄', '인쇄 용지', [useBtn('a4', 'A4 용지', '210×297mm'), useBtn('a6', 'A6 용지', '105×148mm')], 'img-dl-sizes')]);
      var fmtBtns = { png: chip({ 'data-dl-fmt': 'png', onclick: function () { setFmt('png'); } }, '이미지 PNG', ''), pdf: chip({ 'data-dl-fmt': 'pdf', onclick: function () { setFmt('pdf'); } }, 'PDF', '') };
      var step2 = H('div', { class: 'img-dl-step' }, [step('2', '파일 형식'), row('', '파일 형식', [fmtBtns.png, fmtBtns.pdf])]);
      var allBtn = chip({ 'data-dl-pages': 'all', onclick: function () { setPages(pagesNow().length === all.length ? [] : all.slice()); } }, '모두', '');
      var pageBtns = all.map(function (n) { return chip({ 'data-dl-page': String(n), onclick: function () { var cur = pagesNow().slice(), k = cur.indexOf(n); if (k >= 0) cur.splice(k, 1); else cur.push(n); cur.sort(function (a, b) { return a - b; }); setPages(cur); } }, n + '장', ''); });
      var mergeBox = H('input', { type: 'checkbox', 'data-dl-merge': '1', onchange: function () { f.merge = mergeBox.checked; sync(); } }), mergeText = H('span'), mergeRow = H('label', { class: 'img-dl-opt' }, [mergeBox, mergeText]); controls.push(mergeBox);
      var layoutBtns = { together: chip({ 'data-dl-layout': 'together', onclick: function () { f.layout = 'together'; sync(); } }, '한 장에 모두 모아서', ''), each: chip({ 'data-dl-layout': 'each', onclick: function () { f.layout = 'each'; sync(); } }, '카드마다 한 장씩', '') };
      var layoutRow = row('담는 방식', '담는 방식', [layoutBtns.together, layoutBtns.each]);
      var marginBtns = DL_MARGINS.map(function (m) { return chip({ 'data-dl-margin': String(m[0]), onclick: function () { f.margin = m[0]; sync(); } }, m[1], m[2]); });
      var marginRow = row('여백', '여백', marginBtns);
      var step3 = H('div', { class: 'img-dl-step' }, [step('3', '받을 장 고르기', '누른 장만 받습니다.'), row('', '받을 장', [allBtn].concat(pageBtns)), mergeRow, layoutRow, marginRow]);
      var infoList = H('ul', { class: 'img-dl-info-list' }), sheet = H('div', { class: 'img-dl-sheet', 'aria-hidden': 'true' });
      var info = H('div', { class: 'img-dl-info' }, [H('div', { class: 'img-dl-info-main' }, [H('strong', { text: '다운로드 정보' }), infoList]), sheet]);
      var tip = H('p', { class: 'img-dl-note', text: '인쇄 창에서 배율을 "실제 크기"(100%)로 두면 고른 여백 그대로 나오고, "용지에 맞춤"으로 인쇄해도 잘리지 않습니다.' });
      var goBtn = H('button', { type: 'button', class: 'btn primary img-dl-go', 'data-action': 'dl-go', onclick: function () { go(); } }); controls.push(goBtn);
      var note = spec.sel === '[data-card]' ? H('p', { class: 'img-dl-note', text: '히어로·2번 섹션은 디자인 선택에서 고른 안만 들어가고, 말풍선 핀은 들어가지 않습니다.' }) : null;
      var host = H('div', { class: 'img-download img-dl-panel', 'data-img-download': it.id }, [
        H('div', { class: 'img-dl-head' }, [H('strong', { text: '파일 받기' }), H('span', { class: 'img-dl-hint', text: '지금 서버에 저장된 문구 그대로 만듭니다.' })]),
        step1, step2, step3, info, tip, H('div', { class: 'img-dl-go-row' }, [goBtn, status]), note,
      ].filter(Boolean));
      function pickUse(id) {
        if (state.capture || id === f.use) return;
        var prev = f.use, prevSize = state.dlSize[it.id] || 'home', sizeId = PAPERS[id] ? 'home' : id;
        f.use = id; state.dlSize[it.id] = sizeId; status.textContent = ''; sync();
        if (sizeId !== prevSize) switchPreviewSize(it, sizeId, function (ok) { if (!ok) { f.use = prev; state.dlSize[it.id] = prevSize; sync(); } });
      }
      function setFmt(v) { if (isPrint()) f.pfmt = v; else f.fmt = v; sync(); }
      function setPages(list) { if (isPrint()) f.ppages = list; else f.pages = list; sync(); }
      function plan() {
        var pr = isPrint(), sel = pagesNow().slice(), k = sel.length, fmt = pr ? f.pfmt : f.fmt, size = pr ? SIZES[0] : sizeById(f.use), paper = pr ? PAPERS[f.use] : null;
        var together = pr && f.use === 'a4' && f.layout === 'together', canMerge = !pr && k >= 2 && (fmt === 'pdf' || size.id === 'home'), merged = canMerge && !!f.merge;
        var sheets = pr ? (together ? 1 : k) : 0, files = pr ? (fmt === 'pdf' ? 1 : sheets) : (merged ? 1 : k);
        return { pr: pr, sel: sel, k: k, fmt: fmt, size: size, paper: paper, together: together, canMerge: canMerge, merged: merged, sheets: sheets, files: files };
      }
      function sync() {
        var p = plan();
        useBtns.forEach(function (b) { press(b, b.getAttribute('data-size') === f.use); });
        press(fmtBtns.png, p.fmt === 'png'); press(fmtBtns.pdf, p.fmt === 'pdf');
        setDesc(fmtBtns.png, p.pr ? '이미지로 보관·공유할 때' : '홈페이지·SNS에 올릴 때');
        setDesc(fmtBtns.pdf, p.pr ? '인쇄 권장 · 크기 그대로 인쇄' : '문서로 보내거나 인쇄할 때');
        press(allBtn, p.k === all.length);
        pageBtns.forEach(function (b, i) { press(b, p.sel.indexOf(i + 1) >= 0); setDesc(b, p.pr && f.price.indexOf(i + 1) >= 0 ? '금액' : ''); });
        mergeRow.hidden = !p.canMerge; mergeBox.checked = !!f.merge;
        mergeText.textContent = p.fmt === 'pdf' ? 'PDF 한 개로 합치기 (장마다 한 쪽씩)' : '긴 이미지 한 장으로 합치기 (위아래로 이어 붙임)';
        layoutRow.hidden = !(p.pr && f.use === 'a4');
        press(layoutBtns.together, f.layout === 'together'); press(layoutBtns.each, f.layout !== 'together');
        marginRow.hidden = !p.pr;
        marginBtns.forEach(function (b) { press(b, Number(b.getAttribute('data-dl-margin')) === f.margin); });
        var lines = [];
        if (!p.k) lines.push('받을 장을 1개 이상 골라 주세요.');
        else if (p.pr) {
          lines.push(p.paper.label + ' ' + p.paper.mm[0] + '×' + p.paper.mm[1] + 'mm ' + p.sheets + '쪽' + (p.together ? (p.k > 1 ? ' (카드 ' + p.k + '장을 한 쪽에 모아서)' : ' (카드 1장)') : ' (카드마다 한 쪽)'));
          lines.push(p.fmt === 'pdf' ? 'PDF 파일 1개' + (p.sheets > 1 ? ' (' + p.sheets + '쪽)' : '') : 'PNG 파일 ' + p.sheets + '개');
          lines.push((f.margin ? '바깥 흰 여백 ' + f.margin + 'mm' : '여백 없음 (인쇄소에서 재단할 때)') + ' · 300dpi');
        } else {
          if (p.fmt === 'pdf') lines.push(p.merged ? 'PDF 파일 1개 (고른 ' + p.k + '장)' : 'PDF 파일 ' + p.k + '개 (장마다 1개)');
          else lines.push(p.merged ? 'PNG 파일 1개 (' + p.k + '장을 이어 붙인 긴 이미지)' : 'PNG 파일 ' + p.k + '개');
          lines.push(p.merged && p.fmt === 'png' ? p.size.w + '×' + (p.size.h * p.k) + ' px' : p.size.label + ' ' + p.size.w + '×' + p.size.h + ' px' + (p.fmt === 'pdf' ? ' · 인쇄해도 선명한 2배 해상도' : ''));
          if (p.size.id !== 'home') lines.push('한 장에 다 들어가지 않는 장은 나눠서 받습니다 (예: 2장-1, 2장-2).');
        }
        infoList.textContent = ''; lines.forEach(function (l) { infoList.appendChild(H('li', { text: l })); });
        sheet.hidden = !(p.pr && p.k); if (p.pr && p.k) drawSheet(sheet, p.paper, p.together ? p.sel : [p.sel[0]], f.margin, p.sheets);
        tip.hidden = !p.pr;
        goBtn.disabled = !p.k || !!state.capture;
        goBtn.textContent = p.k ? '다운로드 (' + (p.fmt === 'pdf' ? 'PDF ' : 'PNG ') + p.files + '개)' : '받을 장을 골라 주세요';
      }
      function go() {
        if (state.sizeSwitchBusy) { status.textContent = '편집 규격을 바꾸는 중입니다. 잠시 뒤 받아 주세요.'; return; }
        if (state.capture) { status.textContent = '이미 파일을 만드는 중입니다. 끝난 뒤 다시 눌러 주세요.'; return; }
        var p = plan(); if (!p.k) { status.textContent = '받을 장을 1개 이상 골라 주세요.'; return; }
        var say = function (m) { status.textContent = m; };
        controls.forEach(function (b) { b.disabled = true; });
        var job = p.pr ? capturePrint(it, state.locale, p.sel, { paper: p.paper.id, together: p.together, margin: f.margin, fmt: p.fmt }, say)
          : p.fmt === 'pdf' ? capturePdf(it, state.locale, p.sel, p.merged ? 'merged' : 'single', say, p.size.id)
          : captureCards(it, state.locale, p.sel, p.merged ? 'long' : 'single', say, p.size.id);
        job.then(say, function (e) { say('받지 못했습니다: ' + (e && e.message || e)); }).then(function () { controls.forEach(function (b) { b.disabled = false; }); sync(); });
      }
      a4CardsFor(it).then(function (cards) { f.price = cards || []; sync(); }, function () { /* no price cards: print defaults to every card */ });
      sync();
      return host;
    }
    /* a small sketch of the paper: white margin (dashed edge), the panel and where each card goes */
    function drawSheet(el, paper, nums, marginMm, pages) {
      var L = sheetLayout(nums.length, paper.id, marginMm), P = L.paper, pct = function (v, total) { return (v / total * 100).toFixed(2) + '%'; };
      var box = function (cls, r, text) { var d = H('div', { class: cls, text: text || null }); d.style.left = pct(r.x, P.w); d.style.top = pct(r.y, P.h); d.style.width = pct(r.w, P.w); d.style.height = pct(r.h, P.h); return d; };
      var sheetEl = H('div', { class: 'img-dl-paper' + (paper.id === 'a6' ? ' a6' : '') }); sheetEl.style.aspectRatio = P.w + ' / ' + P.h;
      sheetEl.appendChild(box('img-dl-paper-panel' + (L.margin ? '' : ' bleed'), L.panel));
      L.boxes.forEach(function (r, i) { sheetEl.appendChild(box('img-dl-paper-card', r, String(nums[i]))); });
      el.textContent = '';
      el.appendChild(sheetEl);
      el.appendChild(H('span', { class: 'img-dl-paper-cap', text: paper.label + (pages > 1 ? ' × ' + pages + '쪽' : ' 1쪽') + (L.margin ? ' · 여백 ' + marginMm + 'mm' : ' · 여백 없음') }));
    }
    function refreshForCapture(){
      var a=state.aptos,started=Date.now();
      if(!a&&!state.saving)return store.refresh();
      if(a)postTo(a,{type:'aptos-finish-edit'});
      return new Promise(function(resolve,reject){function check(){
        if((a&&a.editing)||state.saving){if(Date.now()-started>=10000){reject(new Error('저장하지 못한 수정이 있습니다. 먼저 저장하거나 취소해 주세요.'));return;}setTimer(check,60);return;}
        store.refresh().then(resolve,reject);
      }setTimer(check,60);});
    }
    /* 2026-11-11 (team: "A4 출력 시 이미지가 잘립니다"): boxes laid out with CSS columns (combo12a 2장 가격표, blackfriday11 라인 가격표 …) re-flow
       differently inside the screenshot copy, so a price group could slip into a third column outside the card and be cut off. Right before drawing,
       every child of such a box is pinned where the page really shows it and the column rule is redrawn as a thin background bar. Capture frame only. */
    function freezeColumns(iwin, root) {
      var px = function (v) { return parseFloat(v) || 0; };
      [root].concat(Array.prototype.slice.call(root.querySelectorAll('*'))).forEach(function (mc) {
        var cs = iwin.getComputedStyle(mc), n = parseInt(cs.columnCount, 10);
        if (cs.display === 'none' || (!(n > 1) && cs.columnWidth === 'auto')) return;
        if (Array.prototype.some.call(mc.childNodes, function (x) { return x.nodeType === 3 && x.textContent.trim(); })) return; /* loose text cannot be pinned */
        var kids = Array.prototype.filter.call(mc.children, function (k) { var s = iwin.getComputedStyle(k); return s.display !== 'none' && s.position !== 'absolute' && s.position !== 'fixed'; });
        if (!kids.length) return;
        var r = mc.getBoundingClientRect(), bl = px(cs.borderLeftWidth), br = px(cs.borderRightWidth), bt = px(cs.borderTopWidth), bb = px(cs.borderBottomWidth);
        var pl = px(cs.paddingLeft), pr = px(cs.paddingRight), pt = px(cs.paddingTop), pb = px(cs.paddingBottom);
        var contentW = r.width - bl - br - pl - pr, gap = cs.columnGap === 'normal' ? px(cs.fontSize) || 16 : px(cs.columnGap);
        var cols = n > 1 ? n : Math.max(1, Math.floor((contentW + gap) / ((px(cs.columnWidth) || contentW) + gap))), colW = (contentW - (cols - 1) * gap) / cols;
        var pins = kids.map(function (k) { var q = k.getBoundingClientRect(), s = iwin.getComputedStyle(k); return { k: k, x: q.left - r.left - bl - px(s.marginLeft), y: q.top - r.top - bt - px(s.marginTop), w: q.width }; });
        if (pins.some(function (p) { return p.w > colW + 2; })) return; /* a child split over two columns: leave the box alone */
        var rw = px(cs.columnRuleWidth), bars = [];
        if (cs.columnRuleStyle !== 'none' && rw > 0) for (var i = 0; i < cols - 1; i++) bars.push({ x: pl + (i + 1) * colW + i * gap + gap / 2 - rw / 2 });
        mc.style.boxSizing = 'border-box'; mc.style.height = r.height + 'px'; mc.style.columnCount = 'auto'; mc.style.columnWidth = 'auto'; mc.style.columnRuleStyle = 'none';
        if (cs.position === 'static') mc.style.position = 'relative';
        if (bars.length) {
          var hasImg = cs.backgroundImage && cs.backgroundImage !== 'none', join = function (mine, theirs) { return mine.join(', ') + (hasImg ? ', ' + theirs : ''); }, h = Math.max(0, r.height - bt - bb - pt - pb);
          mc.style.backgroundImage = join(bars.map(function () { return 'linear-gradient(' + cs.columnRuleColor + ', ' + cs.columnRuleColor + ')'; }), cs.backgroundImage);
          mc.style.backgroundSize = join(bars.map(function () { return rw + 'px ' + h + 'px'; }), cs.backgroundSize);
          mc.style.backgroundPosition = join(bars.map(function (b) { return b.x + 'px ' + pt + 'px'; }), cs.backgroundPosition);
          mc.style.backgroundRepeat = join(bars.map(function () { return 'no-repeat'; }), cs.backgroundRepeat);
          mc.style.backgroundOrigin = join(bars.map(function () { return 'padding-box'; }), cs.backgroundOrigin);
          mc.style.backgroundClip = join(bars.map(function () { return 'padding-box'; }), cs.backgroundClip);
        }
        pins.forEach(function (p) { p.k.style.boxSizing = 'border-box'; p.k.style.position = 'absolute'; p.k.style.left = p.x + 'px'; p.k.style.top = p.y + 'px'; p.k.style.width = p.w + 'px'; });
      });
    }
    function capWait(win, ms) { return new Promise(function (r) { win.setTimeout(r, ms); }); }
    function capPost(cap) { var it=state.data.items.filter(function(i){return i.id===cap.itemId;})[0]; postTo(cap, { type:'aptos-data',locale:cap.locale,fields:cap.fields,formats:effectiveFormats(it,cap.locale,store),layouts:effectiveLayouts(it,cap.locale,store),editable:false,editMode:false }); }
    function capBlob(canvas, type, quality) {
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (b) { if (b) resolve(b); else reject(new Error('이미지를 만들지 못했습니다.')); }, type || 'image/png', quality);
      });
    }
    function withPhys(blob) {
      return blob.arrayBuffer().then(function (ab) { var src = new Uint8Array(ab), pos = 8, type, len; while (pos + 12 <= src.length) { len = (src[pos] << 24) | (src[pos + 1] << 16) | (src[pos + 2] << 8) | src[pos + 3]; type = String.fromCharCode(src[pos + 4], src[pos + 5], src[pos + 6], src[pos + 7]); if (type === 'IDAT') break; pos += 12 + len; } var data = new Uint8Array(9), dv = new DataView(data.buffer); dv.setUint32(0, 11811); dv.setUint32(4, 11811); data[8] = 1; var chunk = new Uint8Array(21), cd = new DataView(chunk.buffer); cd.setUint32(0, 9); chunk.set([112, 72, 89, 115], 4); chunk.set(data, 8); cd.setUint32(17, crc32(chunk.slice(4, 17))); var out = new Uint8Array(src.length + 21); out.set(src.slice(0, pos)); out.set(chunk, pos); out.set(src.slice(pos), pos + 21); return new Blob([out], { type: 'image/png' }); });
    }
    /* pages: [{ canvas, w, h }] with w/h in points; each page holds one JPEG of its canvas (2026-11-11: any page size; A4 output unchanged) */
    function pdfFromPages(pages) {
      var num = function (v) { return String(Math.round(v * 100) / 100); };
      return Promise.all(pages.map(function (p) { return p.canvas.toDataURL('image/jpeg', .92); })).then(function (urls) { var objs = [], kids = [], add = function (s) { objs.push(s); return objs.length; }, bin = function (s) { var a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; }; var catalog = add('<< /Type /Catalog /Pages 2 0 R >>'); add(''); urls.forEach(function (u, k) { var pg = pages[k], raw = atob(u.split(',')[1]); var io = add('<< /Type /XObject /Subtype /Image /Width ' + pg.canvas.width + ' /Height ' + pg.canvas.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + raw.length + ' >>\nstream\n' + raw + '\nendstream'); var content = 'q ' + num(pg.w) + ' 0 0 ' + num(pg.h) + ' 0 0 cm /Im' + io + ' Do Q\n'; var co = add('<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream'); var po = add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + num(pg.w) + ' ' + num(pg.h) + '] /Resources << /XObject << /Im' + io + ' ' + io + ' 0 R >> >> /Contents ' + co + ' 0 R >>'); kids.push(po + ' 0 R'); }); objs[1] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + kids.length + ' >>'; var out = '%PDF-1.4\n%\xff\xff\xff\xff\n', offsets = [0]; objs.forEach(function (o, i) { offsets[i + 1] = out.length; out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; }); var x = out.length; out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n'; offsets.slice(1).forEach(function (n) { out += String(n).padStart(10, '0') + ' 00000 n \n'; }); out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + catalog + ' 0 R >>\nstartxref\n' + x + '\n%%EOF'; return new Blob([bin(out)], { type: 'application/pdf' }); });
    }
    function roundClip(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); } g.closePath(); }
    /* 2026-11-04: the page background is a plain vertical blend of the first card's top edge colour and the last card's bottom edge colour (no blurred copy of the card, no stretched rows) */
    function a4EdgeColor(c, top) {
      var g = c.getContext('2d'), w = c.width, h = c.height, y = top ? Math.round(h * 0.02) : Math.max(0, Math.round(h * 0.98) - 8), d;
      try { d = g.getImageData(Math.round(w * 0.1), y, Math.max(1, Math.round(w * 0.8)), 8).data; } catch (err) { return null; }
      var r = 0, gr = 0, b = 0, k = 0; for (var i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; r += d[i]; gr += d[i + 1]; b += d[i + 2]; k++; }
      return k ? 'rgb(' + Math.round(r / k) + ',' + Math.round(gr / k) + ',' + Math.round(b / k) + ')' : null;
    }
    /* 2026-11-11: one printed sheet. White paper, the margin stays white, a rounded panel with the cards' edge colours behind the cards (full bleed when margin is 0). */
    function composeSheet(cards, L) {
      var P = L.paper, n = cards.length, page = doc.createElement('canvas'); page.width = P.w; page.height = P.h; var g = page.getContext('2d');
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, P.w, P.h);
      var top = a4EdgeColor(cards[0], true) || '#ffffff', bottom = a4EdgeColor(cards[n - 1], false) || top, pn = L.panel, grad = g.createLinearGradient(0, pn.y, 0, pn.y + pn.h);
      grad.addColorStop(0, top); grad.addColorStop(1, bottom); g.fillStyle = grad;
      if (L.margin > 0) { g.save(); roundClip(g, pn.x, pn.y, pn.w, pn.h, Math.round(P.w * 0.012)); g.fill(); g.restore(); } else g.fillRect(0, 0, P.w, P.h);
      var r = Math.max(8, Math.round(P.w * 0.0113)), blur = Math.round(P.w * 0.0097), off = Math.round(P.w * 0.0032);
      L.boxes.forEach(function (p, i) {
        var c = cards[i], s = Math.min(p.w / c.width, p.h / c.height), dw = Math.round(c.width * s), dh = Math.round(c.height * s), dx = p.x + Math.round((p.w - dw) / 2), dy = p.y + Math.round((p.h - dh) / 2);
        g.save(); roundClip(g, dx, dy, dw, dh, r); g.shadowColor = 'rgba(0,0,0,.14)'; g.shadowBlur = blur; g.shadowOffsetY = off; g.fillStyle = top; g.fill(); g.restore();
        g.save(); roundClip(g, dx, dy, dw, dh, r); g.clip(); g.drawImage(c, 0, 0, c.width, c.height, dx, dy, dw, dh); g.restore();
      });
      return page;
    }
    /* 2026-11-11 print files: the chosen cards (home size, chosen A/B design, saved wording) on A4/A6 paper at 300dpi inside a white margin.
       o.together = every chosen card on one A4 sheet, otherwise one sheet per card. PDF = one file with one page per sheet, PNG = one file per sheet. */
    function capturePrint(it, locale, nums, o, progress) {
      var paper = PAPERS[o.paper] || PAPERS.a4, together = !!o.together, L = sheetLayout(together ? nums.length : 1, paper.id, o.margin), maxW = 1;
      L.boxes.forEach(function (b) { maxW = Math.max(maxW, b.w); });
      var scale = Math.min(together || nums.length < 3 ? 2.4 : 1.6, Math.max(1, maxW / CAP.w));
      return captureParts(it, locale, nums, 'home', progress, { scale: scale }).then(function (res) {
        var cards = res.out.map(function (x) { return x.canvas; }), win = doc.defaultView;
        progress('인쇄용 파일로 만드는 중…');
        var pages = together ? [composeSheet(cards, L)] : cards.map(function (c) { return composeSheet([c], L); });
        var base = safeBase(it) + '_' + locale + '_' + paper.label + '_', marg = o.margin ? '여백 ' + o.margin + 'mm' : '여백 없음';
        var tag = together ? '원내배치용' : nums.length === 1 ? nums[0] + '장' : '카드별';
        if (o.fmt === 'pdf') return pdfFromPages(pages.map(function (c) { return { canvas: c, w: paper.pt[0], h: paper.pt[1] }; })).then(function (pdf) { env.downloadBlob(pdf, base + tag + '.pdf'); return '받았습니다: ' + paper.label + ' PDF 1개 (' + pages.length + '쪽, ' + marg + ')'; });
        var chain = Promise.resolve();
        pages.forEach(function (c, i) { chain = chain.then(function () { return capBlob(c).then(withPhys).then(function (b) { env.downloadBlob(b, base + (together ? tag : nums[i] + '장') + '.png'); return i < pages.length - 1 ? capWait(win, 400) : null; }); }); });
        return chain.then(function () { return '받았습니다: ' + paper.label + ' PNG ' + pages.length + '개 (' + marg + ', 300dpi)'; });
      });
    }
    /* capture the chosen design's cards at one channel size (2026-11-06); resolves { size, out: [{ n, part, parts, canvas }] }.
       Size modes: the page gets &size=line|kakao, only displayed sections count, and a card may be split into parts (data-part). */
    function captureParts(it, locale, nums, sizeId, progress, opts) {
      var sc = (opts && opts.scale) || 1; /* 2026-11-11: PDF asks for 2x so print stays sharp */
      var spec = capSpec(it) || { sel: CAP_P5, n: 5 }; CAP.sel = spec.sel; CAP.n = spec.n;
      var size = sizeById(sizeId), win = doc.defaultView;
      var cap = state.capture = { itemId: it.id, locale: locale, el: null, fields: null };
      var finish = function () { if (cap.el && cap.el.parentNode) cap.el.parentNode.removeChild(cap.el); if (state.capture === cap) state.capture = null; };
      progress('최신 문구를 확인하는 중…');
      return refreshForCapture().then(function () {
        if (!store.online || store.status !== 'ready') throw new Error('서버에 연결되지 않아 최신 문구를 확인할 수 없습니다. 연결된 뒤 다시 눌러 주세요.');
        cap.fields = effectiveFields(it, locale, store);
        progress('페이지를 준비하는 중…');
        return new Promise(function (resolve, reject) {
          var f = doc.createElement('iframe');
          f.setAttribute('aria-hidden', 'true'); f.setAttribute('tabindex', '-1'); f.setAttribute('title', 'image capture');
          f.style.cssText = 'position:fixed;left:0;top:0;width:' + Math.max(CAP.frameW, size.w + 200) + 'px;height:1600px;border:0;opacity:0;pointer-events:none;z-index:-1;';
          var t = win.setTimeout(function () { reject(new Error('페이지를 불러오지 못했습니다.')); }, 30000);
          f.addEventListener('load', function () { win.clearTimeout(t); resolve(); });
          f.src = it.page + '?lang=' + encodeURIComponent(locale) + PAGE_V + '&capture=1' + (size.id !== 'home' ? '&size=' + size.id : '');
          cap.el = f; doc.body.appendChild(f);
        });
      }).then(function () {
        capPost(cap);
        return capApplied(cap, it, locale);
      }).then(function () {
        if (spec.sel === '[data-card]') applyVariantsToDoc(cap.el.contentDocument, it, true);
        progress('사진과 글꼴을 준비하는 중…');
        return capPrepare(cap);
      }).then(function (fontCss) {
        var iwin = cap.el.contentWindow, idoc = iwin.document;
        if (size.id !== 'home' && idoc.documentElement.getAttribute('data-size') !== size.id) throw new Error('이 페이지에는 ' + size.label + ' ' + size.w + '×' + size.h + ' 디자인이 아직 없습니다.');
        var shown = Array.prototype.filter.call(idoc.querySelectorAll(CAP.sel), function (c) { return iwin.getComputedStyle(c).display !== 'none' && !(c.closest && c.closest('[data-app-asset]')); });
        var groups = {}, order = [];
        shown.forEach(function (c, i) { var n = spec.sel === '[data-card]' ? Number(c.getAttribute('data-card')) : i + 1; if (!groups[n]) { groups[n] = []; order.push(n); } groups[n].push(c); });
        if (state.lastCapture) { state.lastCapture.fontKB = Math.round(fontCss.length / 1024); state.lastCapture.fontFaces = (fontCss.match(/@font-face/g) || []).length; }
        if (order.length !== CAP.n) throw new Error('카드 ' + CAP.n + '장을 찾지 못했습니다 (' + order.length + '장).');
        var jobs = [];
        nums.forEach(function (n) {
          var parts = (groups[n] || []).slice().sort(function (a, b) { return (Number(a.getAttribute('data-part')) || 1) - (Number(b.getAttribute('data-part')) || 1); });
          if (!parts.length) throw new Error(n + '장을 찾지 못했습니다.');
          parts.forEach(function (card, pi) { jobs.push({ n: n, part: pi + 1, parts: parts.length, card: card }); });
        });
        var out = [], chain = Promise.resolve();
        jobs.forEach(function (j, i) {
          chain = chain.then(function () {
            var r = j.card.getBoundingClientRect();
            if (Math.abs(r.width - size.w) > 1 || Math.abs(r.height - size.h) > 1) throw new Error(partLabel(j) + ' 크기가 ' + Math.round(r.width) + '×' + Math.round(r.height) + '입니다.' + (size.id !== 'home' ? ' (' + size.label + ' ' + size.w + '×' + size.h + ')' : ''));
            progress('이미지를 만드는 중 ' + (i + 1) + '/' + jobs.length + '…');
            /* the card is drawn on its own, so give it the page language: CJK fallback fonts and line breaking follow lang */
            var lang = idoc.documentElement.getAttribute('lang');
            if (lang && !j.card.getAttribute('lang')) j.card.setAttribute('lang', lang);
            freezeColumns(iwin, j.card); return iwin.modernScreenshot.domToCanvas(j.card, { scale: sc, font: { cssText: fontCss } }).then(function (c) {
              var k = doc.createElement('canvas'); k.width = size.w * sc; k.height = size.h * sc; k.getContext('2d').drawImage(c, 0, 0, size.w * sc, size.h * sc);
              out.push({ n: j.n, part: j.part, parts: j.parts, canvas: k });
            });
          });
        });
        return chain.then(function () { return out; });
      }).then(function (out) { finish(); return { size: size, out: out }; }, function (e) { finish(); throw e; });
    }
    function captureCards(it, locale, nums, mode, progress, sizeId) {
      var win = doc.defaultView;
      return captureParts(it, locale, nums, sizeId || 'home', progress).then(function (res) {
        var out = res.out, size = res.size;
        progress('파일로 저장하는 중…');
        if (mode === 'long' && size.id === 'home') {
          var big = doc.createElement('canvas'); big.width = size.w; big.height = size.h * out.length;
          var g = big.getContext('2d');
          out.forEach(function (o, i) { g.drawImage(o.canvas, 0, i * size.h, size.w, size.h); });
          return capBlob(big).then(function (b) {
            env.downloadBlob(b, capName(it, locale, nums.length === ((capSpec(it) || {}).n) ? '전체' : nums.join('-') + '장_이어붙임'));
            return '받았습니다: ' + out.length + '장을 이어 붙인 1장 (' + size.w + '×' + big.height + ')';
          });
        }
        var chain = Promise.resolve();
        out.forEach(function (o, i) {
          chain = chain.then(function () {
            return capBlob(o.canvas).then(function (b) { env.downloadBlob(b, capName(it, locale, partLabel(o) + sizeSuffix(size))); return i < out.length - 1 ? capWait(win, 400) : null; });
          });
        });
        return chain.then(function () { return '받았습니다: ' + out.map(partLabel).join(', ') + ' (각 ' + (size.id !== 'home' ? size.label + ' ' : '') + size.w + '×' + size.h + ')'; });
      });
    }
    function pdfName(it, locale, suffix) { return safeBase(it) + '_' + locale + '_' + suffix + '.pdf'; }
    /* 2026-11-11: PDF downloads. mode 'single' = one PDF per card (a card split into parts gets one page per part), 'merged' = one PDF, one page per image.
       Pages are the card size in points (1px = 0.75pt) and hold a 2x capture. */
    function capturePdf(it, locale, nums, mode, progress, sizeId) {
      var win = doc.defaultView;
      return captureParts(it, locale, nums, sizeId || 'home', progress, { scale: 2 }).then(function (res) {
        var out = res.out, size = res.size, sz = sizeSuffix(size), spec = capSpec(it) || { n: nums.length };
        var page = function (o) { return { canvas: o.canvas, w: size.w * 0.75, h: size.h * 0.75 }; };
        progress('PDF로 만드는 중…');
        if (mode === 'merged') {
          var tag = nums.length === spec.n ? '전체' : nums.join('-') + '장';
          return pdfFromPages(out.map(page)).then(function (p) { env.downloadBlob(p, pdfName(it, locale, tag + sz)); return '받았습니다: PDF 1개 (' + out.length + '쪽' + (size.id !== 'home' ? ', ' + size.label + ' ' + size.w + '×' + size.h : '') + ')'; });
        }
        var groups = [];
        out.forEach(function (o) { var g = groups.filter(function (x) { return x.n === o.n; })[0]; if (!g) { g = { n: o.n, pages: [] }; groups.push(g); } g.pages.push(o); });
        var chain = Promise.resolve();
        groups.forEach(function (g, i) {
          chain = chain.then(function () { return pdfFromPages(g.pages.map(page)).then(function (p) { env.downloadBlob(p, pdfName(it, locale, g.n + '장' + sz)); return i < groups.length - 1 ? capWait(win, 400) : null; }); });
        });
        return chain.then(function () { return '받았습니다: PDF ' + groups.length + '개 (' + groups.map(function (g) { return g.n + '장' + (g.pages.length > 1 ? ' ' + g.pages.length + '쪽' : ''); }).join(', ') + ')'; });
      });
    }

    /* ---- 콘텐츠별 다운로드 (2026-11-06 user: "다운로드 기능이 있는 url을 컨텐츠별로 분류해서 선택 클릭 다운 받을 수 있게") ----
       Groups -> items -> sizes. Every image of the chosen items is captured in each chosen size with the saved wording and the
       A/B design choice, then one stored ZIP (one folder per channel) is downloaded. #ID/LOCALE/dl opens this view. */
    function hubState() { return state.hub || (state.hub = { sizes: { home: true, line: true, kakao: true }, items: {}, busy: false, msg: '' }); }
    function hubItems() { return visibleItems().filter(function (it) { return !!capSpec(it) && hasLocale(it, state.locale) && !isTestItem(it.id); }); }
    function hubJobs() {
      var hub = hubState(), jobs = [];
      hubItems().forEach(function (it) { if (!hub.items[it.id]) return; sizesOf(it).forEach(function (s) { if (hub.sizes[s.id]) jobs.push({ it: it, size: s }); }); });
      return jobs;
    }
    function hubFolder(size) { return size.id === 'home' ? '홈페이지·수가책·메타_1080x1350' : size.tag + '_' + size.w + 'x' + size.h; }
    function hubStamp() { var d = new Date(), p = function (v) { return (v < 10 ? '0' : '') + v; }; return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()); }
    function setHubMsg(m) { var hub = hubState(); hub.msg = m; var s = ui.hub && ui.hub.querySelector ? ui.hub.querySelector('.hub-status') : null; if (s) s.textContent = m; }
    function renderHub() {
      if (!ui.hub) return;
      var hub = hubState(), loc = state.locale, avail = hubItems(), availIds = {};
      avail.forEach(function (it) { availIds[it.id] = true; });
      var check = function (on, fn, label) { return H('input', { type: 'checkbox', checked: !!on, disabled: hub.busy, 'aria-label': label, onchange: function (e) { fn(!!e.target.checked); renderHub(); } }); };
      var sizeBox = H('div', { class: 'hub-sizes', role: 'group', 'aria-label': '사이즈' }, [H('strong', { class: 'hub-label', text: '사이즈' })].concat(SIZES.map(function (s) {
        return H('label', { class: 'hub-size' }, [check(hub.sizes[s.id], function (v) { hub.sizes[s.id] = v; }, s.label), H('span', { text: s.label + ' ' + s.w + '×' + s.h })]);
      })));
      var used = {}, rows = [];
      var itemRowH = function (it) {
        var sz = sizesOf(it), missing = SIZES.filter(function (s) { return sz.indexOf(s) < 0; });
        return H('li', { class: 'hub-item' + (hub.items[it.id] ? ' on' : ''), 'data-hub-item': it.id }, [
          H('label', { class: 'hub-item-main' }, [check(hub.items[it.id], function (v) { hub.items[it.id] = v; }, it.label), H('span', { class: 'hub-item-label', text: it.label }), H('span', { class: 'hub-item-cards', text: capSpec(it).n + '장' })]),
          H('span', { class: 'hub-item-sizes' }, sz.map(function (s) { return H('span', { class: 'hub-chip', text: s.id === 'home' ? '1080×1350' : s.tag + ' ' + s.w + '×' + s.h }); }).concat(missing.length ? [H('span', { class: 'hub-chip off', text: missing.map(function (s) { return s.tag || s.label; }).join('·') + ' 준비 중' })] : [])),
        ]);
      };
      visibleGroups().forEach(function (x) {
        var members = x.items.filter(function (it) { return availIds[it.id]; });
        members.forEach(function (it) { used[it.id] = true; });
        if (!members.length) return;
        var allOn = members.every(function (it) { return hub.items[it.id]; });
        rows.push(H('li', { class: 'hub-group', 'data-hub-group': x.g.id }, [
          H('label', { class: 'hub-group-head' }, [check(allOn, function (v) { members.forEach(function (it) { hub.items[it.id] = v; }); }, (x.g.label || x.g.id) + ' 전체'), H('strong', { text: x.g.label || x.g.id }), H('span', { class: 'hub-count', text: members.length + '개' })]),
          H('ul', { class: 'hub-items' }, members.map(itemRowH)),
        ]));
      });
      var rest = avail.filter(function (it) { return !used[it.id]; });
      if (rest.length) rows.push(H('li', { class: 'hub-group' }, [H('div', { class: 'hub-group-head' }, [H('strong', { text: '묶음 없음' })]), H('ul', { class: 'hub-items' }, rest.map(itemRowH))]));
      var jobs = hubJobs(), imgs = jobs.reduce(function (a, j) { return a + capSpec(j.it).n; }, 0);
      var go = H('button', { type: 'button', class: 'btn primary hub-go', 'data-action': 'hub-download', disabled: hub.busy || !jobs.length, text: hub.busy ? '만드는 중…' : '선택한 이미지 받기 (ZIP)', onclick: function () { runHub(); } });
      ui.hub.replaceChildren(H('section', { class: 'hub-panel', 'aria-label': '콘텐츠별 다운로드' }, [
        H('h2', { class: 'hub-title', text: '콘텐츠별 이미지 받기 · ' + loc }),
        H('p', { class: 'hub-note', text: '받을 묶음·항목과 사이즈를 고르면, 서버에 저장된 지금 문구와 디자인 선택(A·B안) 그대로 모든 장을 만들어 ZIP 한 개로 받습니다. 사이즈별로 폴더가 나뉩니다. 언어는 위 언어 탭에서 바꿉니다. 라인·카카오톡은 사이즈에 맞게 새로 디자인한 페이지만 들어갑니다.' }),
        sizeBox,
        H('div', { class: 'hub-actions' }, [go, H('span', { class: 'hub-sum', text: jobs.length ? '항목×사이즈 ' + jobs.length + '건 · 기본 ' + imgs + '장(나뉜 장은 더 늘어납니다)' : '항목과 사이즈를 고르세요.' })]),
        H('p', { class: 'hub-status', role: 'status', 'aria-live': 'polite', text: hub.msg || '' }),
        H('ul', { class: 'hub-list' }, rows),
      ]));
    }
    function runHub() {
      var hub = hubState(), jobs = hubJobs(), loc = state.locale;
      if (hub.busy || !jobs.length) return;
      if (state.capture) { setHubMsg('다른 이미지를 만드는 중입니다. 끝난 뒤 다시 눌러 주세요.'); return; }
      hub.busy = true; hub.msg = '준비하는 중…'; renderHub();
      var files = [], failed = [], chain = Promise.resolve();
      jobs.forEach(function (j, idx) {
        chain = chain.then(function () {
          var nums = []; for (var q = 1; q <= capSpec(j.it).n; q++) nums.push(q);
          var head = (idx + 1) + '/' + jobs.length + ' ' + j.it.label + ' · ' + (j.size.tag || '홈페이지') + ': ';
          return captureParts(j.it, loc, nums, j.size.id, function (m) { setHubMsg(head + m); }).then(function (res) {
            var c2 = Promise.resolve();
            res.out.forEach(function (o) { c2 = c2.then(function () { return capBlob(o.canvas).then(function (b) { return b.arrayBuffer(); }).then(function (ab) { files.push({ name: hubFolder(res.size) + '/' + capName(j.it, loc, partLabel(o) + sizeSuffix(res.size)), data: new Uint8Array(ab) }); }); }); });
            return c2;
          }).catch(function (e) { failed.push(j.it.label + ' · ' + (j.size.tag || '홈페이지') + ' (' + (e && e.message || e) + ')'); });
        });
      });
      chain.then(function () {
        if (!files.length) throw new Error(failed.join(' / ') || '받을 이미지가 없습니다.');
        setHubMsg('ZIP으로 묶는 중… (' + files.length + '장)');
        env.downloadBlob(new Blob([zipStore(files)], { type: 'application/zip' }), '뷰티블라썸_이미지_' + loc + '_' + hubStamp() + '.zip');
        hub.msg = '받았습니다: 이미지 ' + files.length + '장 (ZIP)' + (failed.length ? ' · 못 받은 것 ' + failed.length + '건: ' + failed.join(' / ') : '');
      }).catch(function (e) { hub.msg = '받지 못했습니다: ' + (e && e.message || e); }).then(function () { hub.busy = false; renderHub(); });
    }

    /* wait until every saved (server) value of this item/locale is visible in the hidden page */
    function capApplied(cap, it, locale) {
      var win = doc.defaultView, prefix = it.id + '.' + locale + '.', started = Date.now();
      var want = Object.keys(store.cells).filter(function (k) {
        var f = k.slice(prefix.length);
        return k.indexOf(prefix) === 0 && f !== 'selected' && typeof store.cells[k].value === 'string' && Object.prototype.hasOwnProperty.call(cap.fields, f);
      }).map(function (k) { return { field: k.slice(prefix.length), text: store.cells[k].value.replace(/\s+/g, '') }; }).filter(function (w) { return w.text; });
      return new Promise(function (resolve, reject) {
        (function check() {
          var idoc = cap.el && cap.el.contentDocument, hay = '';
          if (idoc && idoc.body) {
            hay = idoc.body.textContent;
            Array.prototype.forEach.call(idoc.querySelectorAll('[alt],[title],[aria-label]'), function (el) {
              hay += (el.getAttribute('alt') || '') + (el.getAttribute('title') || '') + (el.getAttribute('aria-label') || '');
            });
            hay = hay.replace(/\s+/g, '');
          }
          var missing = want.filter(function (w) { return hay.indexOf(w.text) < 0; });
          if (hay && !missing.length && idoc.documentElement.getAttribute('data-format-ready') !== 'false' && Date.now() - started > 500) { resolve(); return; }
          if (Date.now() - started > 10000) { reject(new Error('저장된 문구가 화면에 반영되지 않았습니다 (' + missing.map(function (m) { return m.field; }).join(', ') + ').')); return; }
          win.setTimeout(check, 150);
        })();
      });
    }

    /* load every image eagerly at its current choice, wait for fonts, load the capture tool, build the font CSS */
    function capPrepare(cap) {
      var iwin = cap.el.contentWindow, idoc = iwin.document;
      /* review-only overlays (comment pins, A/B controls) never belong in a downloaded image */
      Array.prototype.forEach.call(idoc.querySelectorAll('[data-bb-overlay]'), function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
      var settle = function () {
        return Promise.all(Array.prototype.map.call(idoc.images, function (img) {
          if (img.complete && img.naturalWidth) return img.decode ? img.decode().catch(function () { return null; }) : null;
          return new Promise(function (r) { img.addEventListener('load', r); img.addEventListener('error', r); iwin.setTimeout(r, 15000); });
        }));
      };
      Array.prototype.forEach.call(idoc.images, function (img) { img.loading = 'eager'; });
      return settle().then(function () {
        var chosen = Array.prototype.map.call(idoc.images, function (img) { return [img, img.currentSrc]; });
        Array.prototype.forEach.call(idoc.querySelectorAll('picture source'), function (s) { s.parentNode.removeChild(s); });
        chosen.forEach(function (p) { if (p[1] && p[1] !== p[0].src) p[0].src = p[1]; p[0].removeAttribute('srcset'); p[0].removeAttribute('sizes'); });
        return settle();
      }).then(function () {
        return capSheets(iwin);
      }).then(function () {
        return capSettle(iwin);
      }).then(function () {
        var fallback = capFallback(iwin);
        var lang = idocLang(iwin);
        /* line pinning only where the drawn card breaks CJK lines differently (JP card 5); KO/EN/TH already match without it */
        state.lastCapture = { itemId: cap.itemId, locale: cap.locale, fallback: fallback, freeze: /^(ja|zh)/.test(lang) ? capFreeze(iwin) : null };
        if (iwin.modernScreenshot) return null;
        return new Promise(function (resolve, reject) {
          var s = idoc.createElement('script');
          s.src = new URL(CAP.lib, doc.baseURI).href;
          s.onload = resolve; s.onerror = function () { reject(new Error('이미지 도구를 불러오지 못했습니다.')); };
          idoc.head.appendChild(s);
        });
      }).then(function () { return capFontCss(iwin); });
    }

    /* wait until every stylesheet link has loaded (the pages add their JP/CN/TW/HK/TH font sheet from script after load) */
    function capSheets(iwin) {
      var idoc = iwin.document, started = Date.now();
      return new Promise(function (resolve, reject) {
        (function check() {
          var waiting = Array.prototype.filter.call(idoc.querySelectorAll('link[rel~="stylesheet"]'), function (l) { return l.href && !l.sheet; });
          if (!waiting.length) { resolve(); return; }
          if (Date.now() - started > 20000) { reject(new Error('글꼴을 불러오지 못했습니다. 잠시 뒤 다시 눌러 주세요.')); return; }
          iwin.setTimeout(check, 100);
        })();
      });
    }

    /* wait until web fonts are loaded and the card layout stops changing (the page re-fits its titles when fonts arrive) */
    function capSettle(iwin) {
      var idoc = iwin.document, started = Date.now(), last = '', same = 0;
      var sig = function () {
        var s = [idoc.fonts ? idoc.fonts.status : '', idoc.documentElement.scrollHeight];
        Array.prototype.forEach.call(idoc.querySelectorAll(CAP.sel), function (card) {
          Array.prototype.forEach.call(card.querySelectorAll('*'), function (el) { s.push(el.offsetWidth, el.offsetHeight, el.offsetLeft, el.offsetTop); });
        });
        return s.join(',');
      };
      return new Promise(function (resolve) {
        (function step() {
          (idoc.fonts ? idoc.fonts.ready : Promise.resolve()).then(function () {
            iwin.dispatchEvent(new iwin.Event('resize'));
            iwin.setTimeout(function () {
              var s = sig();
              if (s === last && (!idoc.fonts || idoc.fonts.status === 'loaded')) same++; else same = 0;
              last = s;
              if (same >= 2 || Date.now() - started > 10000) resolve(); else step();
            }, 200);
          });
        })();
      });
    }

    /* a drawn card ignores lang when the browser picks fallback fonts (2026-10-30: CN "模式" came out in a Korean font),
       so write the page's own lang fallback (Windows first, then macOS) into every font list, before the generic family */
    var CAP_FALLBACK = { ko: ['Malgun Gothic', 'Apple SD Gothic Neo'], ja: ['Yu Gothic', 'Hiragino Sans'], 'zh-CN': ['Microsoft YaHei', 'PingFang SC'],
      'zh-TW': ['Microsoft JhengHei', 'PingFang TC'], 'zh-HK': ['Microsoft JhengHei', 'PingFang HK'], th: ['Tahoma', 'Thonburi'] };
    function idocLang(iwin) { return iwin.document.documentElement.getAttribute('lang') || ''; }
    function capFallback(iwin) {
      var idoc = iwin.document, list = CAP_FALLBACK[idoc.documentElement.getAttribute('lang')];
      if (!list) return 0;
      var extra = list.map(function (f) { return '"' + f + '"'; }).join(', '), generic = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded|emoji|math|fangsong)$/i;
      var els = [], saved = [];
      Array.prototype.forEach.call(idoc.querySelectorAll(CAP.sel), function (card) { els.push(card); Array.prototype.push.apply(els, card.querySelectorAll('*')); });
      var sig = function () { return els.map(function (el) { return el.offsetWidth + ',' + el.offsetHeight + ',' + el.offsetLeft + ',' + el.offsetTop; }).join(';'); };
      var before = sig();
      els.forEach(function (el) {
        var fam = iwin.getComputedStyle(el).fontFamily;
        if (!fam || fam.indexOf(list[0]) >= 0) return;
        var parts = fam.split(','), at = -1;
        for (var i = 0; i < parts.length; i++) if (generic.test(parts[i].trim().replace(/^["']|["']$/g, ''))) { at = i; break; }
        if (at < 0) parts.push(extra); else parts.splice(at, 0, extra);
        saved.push([el, el.style.fontFamily]);
        el.style.fontFamily = parts.join(',');
      });
      if (sig() !== before) { saved.forEach(function (s) { s[0].style.fontFamily = s[1]; }); return -1; }
      return saved.length;
    }

    /* pin every soft line break of the live page (nowrap spans + <br>), so the drawn card cannot wrap text differently
       (2026-10-30: the drawn JP card 5 wrapped one line more than the page). A card whose layout moves is restored. */
    function capFreeze(iwin) {
      var idoc = iwin.document, frozen = 0, undone = 0;
      Array.prototype.forEach.call(idoc.querySelectorAll(CAP.sel), function (card) {
        var els = Array.prototype.slice.call(card.querySelectorAll('*'));
        var sig = function () { return els.map(function (el) { return el.offsetWidth + ',' + el.offsetHeight + ',' + el.offsetLeft + ',' + el.offsetTop; }).join(';'); };
        var before = sig(), plans = [], walker = idoc.createTreeWalker(card, 4), t;
        while ((t = walker.nextNode())) {
          var pe = t.parentElement;
          if (!t.data.trim() || !pe || pe.closest('svg,script,style,textarea')) continue;
          var ws = iwin.getComputedStyle(pe).whiteSpace;
          if (ws === 'nowrap' || ws === 'pre') continue;
          var r = idoc.createRange(), cuts = [], lastTop = null, i = 0;
          while (i < t.data.length) {
            var len = t.data.codePointAt(i) > 0xffff ? 2 : 1;
            r.setStart(t, i); r.setEnd(t, i + len);
            var rc = r.getClientRects()[0];
            if (rc && rc.width > 0) {
              var top = Math.round(rc.top);
              if (lastTop !== null && Math.abs(top - lastTop) > 2) cuts.push(i);
              lastTop = top;
            }
            i += len;
          }
          if (cuts.length) plans.push({ node: t, cuts: cuts, keep: ws === 'pre-wrap' || ws === 'break-spaces' });
        }
        /* lock the used width of every non-inline box around the frozen text, so nowrap lines cannot shrink-to-fit it */
        var lockSet = [];
        plans.forEach(function (p) {
          for (var el = p.node.parentElement; el && el !== card.parentElement; el = el.parentElement) {
            var d = iwin.getComputedStyle(el).display;
            if (d !== 'inline' && d !== 'contents' && lockSet.indexOf(el) < 0) lockSet.push(el);
          }
        });
        var locks = lockSet.map(function (el) { return { el: el, w: iwin.getComputedStyle(el).width, css: el.style.cssText }; });
        var undo = [];
        plans.forEach(function (p) {
          var node = p.node, parent = node.parentNode, frag = idoc.createDocumentFragment(), start = 0, ends = p.cuts.concat([node.data.length]);
          ends.forEach(function (end, k) {
            var s = node.data.slice(start, end);
            if (k < ends.length - 1) s = s.replace(/\s+$/, '');
            if (k) frag.appendChild(idoc.createElement('br'));
            var sp = idoc.createElement('span'); sp.style.whiteSpace = p.keep ? 'pre' : 'nowrap'; sp.textContent = s;
            frag.appendChild(sp); start = end;
          });
          var nodes = Array.prototype.slice.call(frag.childNodes);
          parent.replaceChild(frag, node);
          undo.push({ node: node, nodes: nodes, parent: parent });
        });
        locks.forEach(function (k) { if (/px$/.test(k.w)) { k.el.style.width = k.w; k.el.style.minWidth = k.w; k.el.style.maxWidth = k.w; } });
        if (undo.length && sig() !== before) {
          undo.forEach(function (u) { u.parent.insertBefore(u.node, u.nodes[0]); u.nodes.forEach(function (n) { u.parent.removeChild(n); }); });
          locks.forEach(function (k) { k.el.style.cssText = k.css; });
          undone++;
        } else frozen += undo.length;
      });
      return { frozenTextNodes: frozen, cardsRestored: undone };
    }

    /* @font-face rules for the fonts the five cards actually use, files inlined as data URLs:
       per family only the face weight/style that CSS font matching picks for each used weight/style, and only the
       unicode-range subsets holding characters set in that family (2026-11-02: embedding every weight of every family,
       about 5.8 MB of CSS for HK, made the HK images differ from run to run). */
    function capFontCss(iwin) {
      var idoc = iwin.document;
      var GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded|emoji|math|fangsong|-apple-system)$/;
      var famKey = function (f) { return String(f || '').trim().replace(/^["']|["']$/g, '').toLowerCase(); };
      var used = {};
      var note = function (cs, text) {
        if (!text || !cs) return;
        var w = parseInt(cs.fontWeight, 10) || 400, st = /italic|oblique/.test(cs.fontStyle) ? 'italic' : 'normal';
        cs.fontFamily.split(',').forEach(function (f) {
          var k = famKey(f);
          if (!k || GENERIC.test(k)) return;
          var u = used[k] || (used[k] = { want: {} });
          var want = u.want[w + '|' + st] || (u.want[w + '|' + st] = { w: w, st: st, cps: {} });
          Array.from(text).forEach(function (ch) { want.cps[ch.codePointAt(0)] = true; });
        });
      };
      Array.prototype.forEach.call(idoc.querySelectorAll(CAP.sel), function (card) {
        [card].concat(Array.prototype.slice.call(card.querySelectorAll('*'))).forEach(function (el) {
          var own = '';
          for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) own += c.data;
          if (own.trim()) note(iwin.getComputedStyle(el), own);
          ['::before', '::after'].forEach(function (ps) {
            var s = iwin.getComputedStyle(el, ps), ct = s.content;
            if (ct && ct !== 'none' && ct !== 'normal') note(s, ct.replace(/^["']|["']$/g, ''));
          });
        });
      });
      var inRange = function (css, cps) {
        var m = /unicode-range\s*:\s*([^;}]+)/i.exec(css);
        if (!m) return true;
        var any = function (lo, hi) { for (var i = 0; i < cps.length; i++) if (cps[i] >= lo && cps[i] <= hi) return true; return false; };
        return m[1].split(',').some(function (p) {
          var t = p.trim().replace(/^U\+/i, '');
          if (t.indexOf('?') >= 0) return any(parseInt(t.replace(/\?/g, '0'), 16), parseInt(t.replace(/\?/g, 'F'), 16));
          var ab = t.split('-'), lo = parseInt(ab[0], 16);
          return any(lo, ab[1] ? parseInt(ab[1], 16) : lo);
        });
      };
      var desc = function (css, name) { var m = new RegExp(name + '\\s*:\\s*([^;}]+)', 'i').exec(css); return m ? m[1].trim() : ''; };
      var faceWeight = function (css) {
        var v = desc(css, 'font-weight').replace(/\bnormal\b/g, '400').replace(/\bbold\b/g, '700').split(/\s+/).map(Number).filter(function (n) { return n > 0; });
        return v.length ? [Math.min.apply(null, v), Math.max.apply(null, v)] : [400, 400];
      };
      var faceStyle = function (css) { var s = desc(css, 'font-style').toLowerCase(); return /italic/.test(s) ? 'italic' : /oblique/.test(s) ? 'oblique' : 'normal'; };
      /* CSS Fonts 4 weight matching over the distinct weight ranges of one family+style */
      var pickWeight = function (ranges, w) {
        var inside = ranges.filter(function (r) { return r[0] <= w && w <= r[1]; });
        if (inside.length) return inside[0];
        var above = function (lim) { return ranges.filter(function (r) { return r[0] > w && (lim == null || r[0] <= lim); }).sort(function (a, b) { return a[0] - b[0]; })[0]; };
        var below = function () { return ranges.filter(function (r) { return r[1] < w; }).sort(function (a, b) { return b[1] - a[1]; })[0]; };
        if (w >= 400 && w <= 500) return above(500) || below() || above(null);
        if (w < 400) return below() || above(null);
        return above(null) || below();
      };
      var pickStyle = function (styles, st) {
        var order = st === 'italic' ? ['italic', 'oblique', 'normal'] : ['normal', 'oblique', 'italic'];
        for (var i = 0; i < order.length; i++) if (styles.indexOf(order[i]) >= 0) return order[i];
        return styles[0];
      };
      var sheets = Array.prototype.map.call(idoc.styleSheets, function (sheet) {
        var base = sheet.href || idoc.baseURI;
        try { return Promise.resolve({ css: Array.prototype.map.call(sheet.cssRules, function (r) { return r.cssText; }).join('\n'), base: base }); }
        catch (e) { return sheet.href ? iwin.fetch(sheet.href).then(function (r) { return r.text(); }).then(function (css) { return { css: css, base: base }; }, function () { return null; }) : Promise.resolve(null); }
      });
      var dataUrl = function (url) {
        if (!capFontData[url]) capFontData[url] = iwin.fetch(url).then(function (r) { if (!r.ok) throw new Error('글꼴 파일 HTTP ' + r.status); return r.blob(); }).then(function (b) {
          return new Promise(function (resolve, reject) { var fr = new iwin.FileReader(); fr.onload = function () { resolve(fr.result); }; fr.onerror = reject; fr.readAsDataURL(b); });
        });
        return capFontData[url];
      };
      return Promise.all(sheets).then(function (list) {
        var byFam = {}, rules = [];
        list.forEach(function (s) {
          if (s) (s.css.match(/@font-face\s*\{[^}]*\}/g) || []).forEach(function (css) {
            var k = famKey(desc(css, 'font-family'));
            if (used[k]) (byFam[k] = byFam[k] || []).push({ css: css, base: s.base, w: faceWeight(css), st: faceStyle(css) });
          });
        });
        Object.keys(byFam).forEach(function (k) {
          var faces = byFam[k], u = used[k], keep = {};
          Object.keys(u.want).forEach(function (wk) {
            var want = u.want[wk], cps = Object.keys(want.cps).map(Number);
            var st = pickStyle(faces.map(function (f) { return f.st; }).filter(function (v, i, a) { return a.indexOf(v) === i; }), want.st);
            var same = faces.filter(function (f) { return f.st === st; });
            var ranges = same.map(function (f) { return f.w; }).filter(function (r, i, a) { return a.findIndex(function (q) { return q[0] === r[0] && q[1] === r[1]; }) === i; });
            var r = pickWeight(ranges, want.w);
            if (r) same.forEach(function (f, i) { if (f.w[0] === r[0] && f.w[1] === r[1] && inRange(f.css, cps)) keep[faces.indexOf(f)] = true; });
          });
          faces.forEach(function (f, i) { if (keep[i]) rules.push(f); });
        });
        return Promise.all(rules.map(function (r) {
          var src = /src\s*:\s*([^;}]+)/i.exec(r.css);
          if (!src) return null;
          var urls = [], re = /url\((['"]?)([^'")]+)\1\)\s*(format\((['"]?)([^'")]+)\4\))?/g, m;
          while ((m = re.exec(src[1]))) urls.push({ url: new URL(m[2], r.base).href, fmt: (m[5] || '').toLowerCase() });
          var pick = urls.filter(function (u) { return /woff2/.test(u.fmt) || /\.woff2(\?|$)/.test(u.url); })[0] || urls[0];
          if (!pick) return null;
          return dataUrl(pick.url).then(function (d) { return r.css.replace(/src\s*:\s*[^;}]+/i, 'src: url(' + d + ')'); });
        }));
      }).then(function (faces) { return faces.filter(Boolean).join('\n'); });
    }

    /* ================================================================ v4 board (v4/events/BOARD_V4_PLAN.md) */
    function later(fn, ms) { var t = setTimer(fn, ms); if (t && t.unref) t.unref(); return t; }
    function clearLater(t) { if (t == null) return; if (env.clearTimeout) env.clearTimeout(t); else clearTimeout(t); }
    function hasPage(it) { return !!it && typeof it.page === 'string' && /^[a-z0-9-]+\/index\.html$/.test(it.page); }
    function frameDoc(f) { try { var d = f && f.contentDocument; return d && d.body ? d : null; } catch (e) { return null; } }
    function itemById(id) { return state.data && state.data.items.filter(function (i) { return i.id === id; })[0]; }
    function fmtTime(s) { var d = s ? new Date(s) : null; return d && !isNaN(d.getTime()) ? d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''; }
    function snip(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
    function fileName(u) { var s = String(u || '').split('#')[0].split('?')[0]; if (/^data:/i.test(s)) return 'data-url'; return s.slice(s.lastIndexOf('/') + 1); }

    /* ---- A/B choice of the hero (1) and the 2nd section (2) ---- */
    function variantOf(itemId, n) { return normVariant(store.value(variantKey(itemId, n), 'a')); }
    function slideOf(itemId, n) { var s = state.slides[itemId]; return (s && s[n]) || variantOf(itemId, n); }
    function setSlide(itemId, n, v) { (state.slides[itemId] = state.slides[itemId] || {})[n] = normVariant(v); syncAllViews();if(state.aptos&&state.aptos.itemId===itemId)postTo(state.aptos,{type:'aptos-format-refresh'}); }
    function inPageSize(s,root) {
      var d=root.documentElement?root:root.ownerDocument,html=d&&d.documentElement,size=html&&html.getAttribute('data-size')||'home',only=s.getAttribute('data-size-only'),hide=s.getAttribute('data-size-hide')||'';
      return (!only||only.split(/\s+/).indexOf(size)>=0)&&hide.split(/\s+/).indexOf(size)<0;
    }
    function sectionsFor(root, n) {
      var out = { a: null, b: null };
      Array.prototype.forEach.call(root.querySelectorAll('[data-card="' + n + '"]'), function (s) {
        if (s.closest && s.closest('[data-app-asset]')) return;
        if(!inPageSize(s,root))return;
        if (s.getAttribute('data-variant') === 'b') { if (!out.b) out.b = s; } else if (!out.a) out.a = s;
      });
      return out;
    }
    /* keep only the chosen section of the hero / 2nd section (and never a B section of another card) */
    function applyVariantsToDoc(root, it, strict) {
      if (!root || !root.querySelectorAll) return [];
      var missing = [];
      VARIANT_SLOTS.forEach(function (n) {
        var s = sectionsFor(root, n), want = variantOf(it.id, n);
        if (want === 'b' && !s.b) { if (s.a) missing.push(n); return; }
        /* drop every section of the design that is not chosen: all its parts (data-part) and size-only sections too */
        Array.prototype.forEach.call(root.querySelectorAll('[data-card="' + n + '"]'), function (sec) {
          if (sec.closest && sec.closest('[data-app-asset]')) return;
          var isB = sec.getAttribute('data-variant') === 'b';
          if ((want === 'b') !== isB && sec.parentNode) sec.parentNode.removeChild(sec);
        });
      });
      Array.prototype.forEach.call(root.querySelectorAll('[data-card][data-variant="b"]'), function (s) { if (VARIANT_SLOTS.indexOf(Number(s.getAttribute('data-card'))) < 0 && s.parentNode) s.parentNode.removeChild(s); });
      if (missing.length && strict) throw new Error(missing.map(slotName).join(', ') + '에 B안이 선택되어 있지만 페이지에 B안 디자인이 없습니다. 디자인 선택을 확인해 주세요.');
      return missing;
    }
    function designBox(it) {
      if (!hasPage(it) || !((it.cards | 0) > 0)) { state.designBox = null; return null; }
      var box = H('section', { class: 'design-box', 'aria-label': '디자인 선택', 'data-design-for': it.id });
      var d = state.designBox = { el: box, itemId: it.id, info: null };
      fillDesignBox();
      pageInfoFor(it).then(function (info) { d.info = info; if (state.designBox === d) fillDesignBox(); }, function () { d.info = { slots: null }; if (state.designBox === d) fillDesignBox(); });
      return box;
    }
    function fillDesignBox() {
      var d = state.designBox, it = item();
      if (!d || !it || it.id !== d.itemId) return;
      var info = d.info;
      var rows = VARIANT_SLOTS.map(function (n) {
        var slot = info && info.slots ? info.slots[n] : null, cur = variantOf(it.id, n);
        var hasB = !!(slot && slot.b);
        var opt = function (v, enabled, label) {
          var on = cur === v;
          return H('label', { class: 'variant-opt' + (on ? ' checked' : '') + (enabled ? '' : ' disabled') }, [
            H('input', { type: 'checkbox', class: 'variant-box', 'data-variant-for': 'c' + n, 'data-variant-value': v, checked: on, disabled: !enabled || !store.canEdit(), 'aria-label': slotName(n) + ' ' + label, onchange: function (e) { onVariantChange(it.id, n, v, !!e.target.checked); } }),
            H('span', { text: label }),
          ]);
        };
        return H('div', { class: 'variant-row', 'data-variant-slot': String(n) }, [
          H('span', { class: 'variant-slot', text: slotName(n) }),
          opt('a', true, 'A안'),
          opt('b', hasB, hasB ? 'B안' : info ? 'B안 · 미구현' : 'B안 · 확인 중'),
        ]);
      });
      d.el.replaceChildren(H('strong', { class: 'design-title', text: '디자인 선택' }), H('div', { class: 'variant-rows' }, rows),
        H('p', { class: 'design-note', text: '슬롯마다 하나만 고릅니다(언어 공통). 장별·길게·A4·뷰티앱 받기는 고른 안만 씁니다.' }));
    }
    function onVariantChange(itemId, n, v, checked) {
      var key = variantKey(itemId, n);
      if (!checked || variantOf(itemId, n) === v) { fillDesignBox(); return Promise.resolve(); } /* one choice per slot */
      if (!store.canEdit()) { toast('공유 서버에 연결되지 않아 디자인 선택을 저장할 수 없습니다 (편집 잠금).', 'error'); fillDesignBox(); return Promise.resolve(); }
      state.saving++; renderStatus();
      return store.save(key, v, by()).then(function (r) {
        state.saving--;
        if (r.ok) { (state.slides[itemId] = state.slides[itemId] || {})[n] = v; toast(slotName(n) + ' ' + (v === 'b' ? 'B안' : 'A안') + ' 선택이 서버에 저장되었습니다.', 'ok'); }
        else if (r.reason === 'conflict') { store.adopt(key, r.current); toast('다른 사람이 먼저 바꿨습니다. 최신 디자인 선택을 불러왔습니다.', 'error'); }
        else toast('디자인 선택이 저장되지 않았습니다. (' + reasonMessage(r) + ')', 'error');
        fillDesignBox(); syncAllViews(); renderStatus();
      });
    }

    /* ---- overlays inside the same-origin preview frames (never in the hidden download frame) ---- */
    var OVERLAY_CSS = [
      '.bbv4-layer{position:absolute!important;inset:0;pointer-events:none!important;z-index:2147483000!important;margin:0!important;padding:0!important;border:0!important;background:none!important}',
      '.bbv4-page-layer{inset:auto}',
      '.bbv4-pin{position:absolute!important;box-sizing:border-box;pointer-events:auto!important;transform:translate(-50%,calc(-100% - 8px));min-width:30px;height:30px;margin:0;padding:0 9px;border:2px solid #fff;border-radius:15px;background:var(--pin,#E5484D);color:#fff;font:800 14px/26px system-ui,-apple-system,"Segoe UI","Malgun Gothic",sans-serif;letter-spacing:0;text-align:center;white-space:nowrap;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.38)}',
      '.bbv4-pin::after{content:"";position:absolute;left:50%;bottom:-9px;margin-left:-7px;border:7px solid transparent;border-top:8px solid var(--pin,#E5484D);border-bottom:0}',
      '.bbv4-pin.on{outline:3px solid rgba(17,17,17,.75);outline-offset:2px;z-index:1}',
      '.bbv4-cover{position:absolute!important;inset:0;z-index:2147482000!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;box-sizing:border-box;margin:0;padding:24px;border:3px dashed #b8bcc8;background:repeating-linear-gradient(135deg,#f5f5f7 0 22px,#ededf1 22px 44px);color:#555a66;text-align:center;font-family:system-ui,-apple-system,"Segoe UI","Malgun Gothic",sans-serif}',
      '.bbv4-cover strong{font-size:clamp(18px,4vw,44px);font-weight:900;letter-spacing:-.01em;color:#40444f}',
      '.bbv4-cover span{font-size:clamp(12px,1.8vw,20px);font-weight:600}',
      '.bbv4-slide{position:relative!important;z-index:5;box-sizing:border-box;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:2px;width:max-content;max-width:100%;margin:8px auto!important;padding:4px;border-radius:999px;background:rgba(20,22,28,.84);box-shadow:0 2px 10px rgba(0,0,0,.2);font:700 13px/1 system-ui,-apple-system,"Segoe UI","Malgun Gothic",sans-serif;letter-spacing:0;white-space:nowrap;transform:none!important}',
      '.bbv4-slide button{margin:0;padding:7px 11px;border:0;border-radius:999px;background:transparent;color:#fff;font:inherit;line-height:1;cursor:pointer;box-shadow:none;text-shadow:none}',
      '.bbv4-slide button:hover{background:rgba(255,255,255,.18)}',
      '.bbv4-slide .bbv4-tab.on{background:#fff;color:#16181d}',
      '.bbv4-slide .bbv4-slot{padding:0 6px 0 9px;color:#cdd0d8;font-weight:600}',
    ].join('\n');
    function childByClass(el, cls) { for (var c = el && el.firstElementChild; c; c = c.nextElementSibling) if (c.classList && c.classList.contains(cls)) return c; return null; }
    function ensurePositioned(el) { var w = el.ownerDocument.defaultView; if (w && w.getComputedStyle(el).position === 'static') el.style.position = 'relative'; }
    function setHidden(el, hide) {
      if (!el) return;
      if (hide) { el.setAttribute('data-bb-hidden', '1'); el.style.setProperty('display', 'none', 'important'); }
      else if (el.hasAttribute('data-bb-hidden')) { el.removeAttribute('data-bb-hidden'); el.style.removeProperty('display'); }
    }
    function ensureOverlay(idoc, view) {
      if (!idoc.querySelector('style[data-bb-overlay]')) {
        var st = idoc.createElement('style'); st.setAttribute('data-bb-overlay', ''); st.textContent = OVERLAY_CSS;
        (idoc.head || idoc.documentElement).appendChild(st);
      }
      idoc.__bbv4view = view;
      if (idoc.__bbv4on) return;
      idoc.__bbv4on = true;
      idoc.addEventListener('contextmenu', function (e) { onFrameContext(idoc, e); }, true);
      idoc.addEventListener('mousedown', function (e) { if (e.button !== 2) hideCtx(); }, true);
      idoc.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideCtx(); }, true);
      if (idoc.defaultView) idoc.defaultView.addEventListener('scroll', hideCtx);
    }
    function syncAllViews() { syncViewer(); syncAppView(); }
    function startViewTimer() {
      if (!win0 || state.viewTimer) return;
      var loop = function () { state.viewTimer = win0.setTimeout(loop, 1500); if (!doc.hidden) { try { syncAllViews(); } catch (e) { /* the frame is navigating */ } } };
      state.viewTimer = win0.setTimeout(loop, 1500);
    }
    /* home viewer: A/B slides, the 'B 미구현' cover and the comment pins */
    function syncViewer() {
      var a = state.aptos; if (!a || state.mode !== 'home') return;
      var it = aptosItem(); var idoc = frameDoc(a.el);
      if (!it || !idoc || it.id !== state.itemId) return;
      ensureOverlay(idoc, { kind: 'home', frame: a.el });
      VARIANT_SLOTS.forEach(function (n) {
        var s = sectionsFor(idoc, n); if (!s.a && !s.b) return;
        var slide = slideOf(it.id, n), host;
        Array.prototype.forEach.call(idoc.querySelectorAll('[data-card="'+n+'"]'),function(sec){if(sec.closest&&sec.closest('[data-app-asset]'))return;if(inPageSize(sec,idoc))setHidden(sec,(sec.getAttribute('data-variant')==='b')!==(slide==='b'&&!!s.b));});
        if (s.a && s.b) { setHidden(s.a, slide === 'b'); setHidden(s.b, slide !== 'b'); host = slide === 'b' ? s.b : s.a; removeCover(s.a); }
        else { host = s.a || s.b; if (s.a) { if (slide === 'b') ensureCover(s.a, n); else removeCover(s.a); } }
        var first = s.a && s.b ? (s.a.compareDocumentPosition(s.b) & 4 ? s.a : s.b) : host;
        slideControl(first, n, slide, !!s.b, it);
      });
      drawPins(idoc, { kind: 'home' }, it);
    }
    function ensureCover(sec, n) {
      var c = childByClass(sec, 'bbv4-cover'); if (c) return c;
      var d = sec.ownerDocument;
      c = d.createElement('div'); c.className = 'bbv4-cover'; c.setAttribute('data-bb-overlay', ''); c.setAttribute('data-cover-slot', String(n));
      var t = d.createElement('strong'); t.textContent = 'B안 · 디자인 미구현';
      var s = d.createElement('span'); s.textContent = (n === 1 ? '히어로' : '2번 섹션') + ' B안은 아직 만들지 않았습니다. 우클릭으로 B안 요청을 남길 수 있습니다.';
      c.appendChild(t); c.appendChild(s); ensurePositioned(sec); sec.appendChild(c);
      return c;
    }
    function removeCover(sec) { var c = sec && childByClass(sec, 'bbv4-cover'); if (c) c.parentNode.removeChild(c); }
    /* a slim A/B bar right before the slot's first section: outside the card, so it never covers copy that can be edited */
    function slideControl(first, n, slide, hasB, it) {
      var d = first.ownerDocument, chosen = variantOf(it.id, n), ctl = d.querySelector('.bbv4-slide[data-slide-slot="' + n + '"]');
      if (!ctl) { ctl = d.createElement('div'); ctl.className = 'bbv4-slide'; ctl.setAttribute('data-bb-overlay', ''); ctl.setAttribute('data-slide-slot', String(n)); ctl.setAttribute('role', 'group'); ctl.setAttribute('aria-label', slotName(n) + ' A/B'); }
      if (ctl.nextElementSibling !== first && first.parentNode) first.parentNode.insertBefore(ctl, first);
      var sig = [slide, hasB ? 1 : 0, chosen].join('|');
      if (ctl.getAttribute('data-sig') === sig) return;
      ctl.setAttribute('data-sig', sig);
      while (ctl.firstChild) ctl.removeChild(ctl.firstChild);
      var add = function (text, cls, fn, attrs) {
        var b = d.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = text;
        Object.keys(attrs || {}).forEach(function (k) { b.setAttribute(k, attrs[k]); });
        b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); fn(); });
        ctl.appendChild(b); return b;
      };
      var lab = d.createElement('span'); lab.className = 'bbv4-slot'; lab.textContent = n === 1 ? '히어로' : '2번 섹션'; ctl.appendChild(lab);
      var flip = function () { setSlide(it.id, n, slide === 'a' ? 'b' : 'a'); };
      add('‹', 'bbv4-arrow', flip, { 'aria-label': '이전 안' });
      ['a', 'b'].forEach(function (v) {
        add((v === 'a' ? 'A안' : 'B안') + (v === 'b' && !hasB ? ' · 미구현' : '') + (chosen === v ? ' ✓' : ''), 'bbv4-tab' + (slide === v ? ' on' : ''), function () { setSlide(it.id, n, v); }, { 'data-slide': v, 'aria-pressed': slide === v ? 'true' : 'false', title: chosen === v ? '디자인 선택에서 고른 안' : '' });
      });
      add('›', 'bbv4-arrow', flip, { 'aria-label': '다음 안' });
    }

    /* ---- pins ---- */
    function viewComments(mode) {
      var it = item(); if (!it) return [];
      return state.cm.list.filter(function (c) { return c.item === it.id && c.mode === mode && c.status !== 'deleted' && (mode === 'app' || c.locale === state.locale); });
    }
    function pinHost(idoc, c, it, view) {
      var asset = commentAsset(c);
      if (view.kind === 'app-thumb' || view.kind === 'app-card') return !c.card && asset === view.asset ? idoc.querySelector('[data-app-asset="' + view.asset + '"]') : null;
      if (!c.card) return asset ? null : 'page';
      var s = sectionsFor(idoc, c.card);
      if (VARIANT_SLOTS.indexOf(c.card) >= 0) {
        var shown = view.kind === 'home' ? slideOf(it.id, c.card) : variantOf(it.id, c.card);
        if (c.variant !== shown) return null;
        if (shown === 'b') return s.b || (view.kind === 'home' && s.a ? childByClass(s.a, 'bbv4-cover') : null);
        return s.a;
      }
      return c.variant === 'b' ? s.b : s.a;
    }
    function pageLayer(idoc) {
      var L = idoc.querySelector('.bbv4-page-layer'), w = idoc.defaultView;
      if (!L) { L = idoc.createElement('div'); L.className = 'bbv4-layer bbv4-page-layer'; L.setAttribute('data-bb-overlay', ''); idoc.body.appendChild(L); }
      var m = idoc.querySelector('main') || idoc.body, r = m.getBoundingClientRect();
      L.style.left = (r.left + w.scrollX) + 'px'; L.style.top = (r.top + w.scrollY) + 'px'; L.style.width = r.width + 'px'; L.style.height = r.height + 'px';
      return L;
    }
    function layerIn(el) {
      var L = childByClass(el, 'bbv4-layer');
      if (!L) { L = el.ownerDocument.createElement('div'); L.className = 'bbv4-layer'; L.setAttribute('data-bb-overlay', ''); ensurePositioned(el); el.appendChild(L); }
      return L;
    }
    function pinTitle(c) { return c.seq + '번 · ' + (STATUS_NAME[c.status] || '') + ' · ' + cardLabel(c) + (c.text ? ' · ' + snip(draftText(c), 60) : ''); }
    function placePin(layer, c, keep) {
      var d = layer.ownerDocument, p = null;
      Array.prototype.some.call(d.querySelectorAll('.bbv4-pin'), function (x) { if (x.getAttribute('data-comment-id') === c.id) { p = x; return true; } return false; });
      if (!p) {
        p = d.createElement('button'); p.type = 'button'; p.className = 'bbv4-pin'; p.setAttribute('data-comment-id', c.id); p.setAttribute('data-bb-overlay', '');
        p.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); activateComment(c.id, { fromPin: true }); });
        p.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); });
      }
      if (p.parentNode !== layer) layer.appendChild(p);
      var color = STATUS_COLOR[c.status] || STATUS_COLOR.open;
      p.style.left = (c.x * 100).toFixed(3) + '%'; p.style.top = (c.y * 100).toFixed(3) + '%';
      p.style.setProperty('--pin', color); p.style.background = color;
      p.setAttribute('data-status', c.status); p.textContent = String(c.seq || '?'); p.title = pinTitle(c);
      p.setAttribute('aria-label', pinTitle(c));
      p.className = 'bbv4-pin' + (state.cm.active === c.id ? ' on' : '');
      keep.push(p);
    }
    function drawPins(idoc, view, it) {
      var keep = [];
      viewComments(view.kind === 'home' ? 'home' : 'app').forEach(function (c) {
        var host = pinHost(idoc, c, it, view); if (!host) return;
        placePin(host === 'page' ? pageLayer(idoc) : layerIn(host), c, keep);
      });
      Array.prototype.forEach.call(idoc.querySelectorAll('.bbv4-pin'), function (p) { if (keep.indexOf(p) < 0 && p.parentNode) p.parentNode.removeChild(p); });
    }
    function findPin(id) {
      var docs = [];
      if (state.aptos) docs.push(frameDoc(state.aptos.el));
      if (state.appView) state.appView.frames.forEach(function (f) { docs.push(frameDoc(f.el)); });
      var hit = null;
      docs.filter(Boolean).some(function (d) { return Array.prototype.some.call(d.querySelectorAll('.bbv4-pin'), function (p) { if (p.getAttribute('data-comment-id') === id) { hit = p; return true; } return false; }); });
      if (!hit && ui.app && ui.app.querySelectorAll) Array.prototype.some.call(ui.app.querySelectorAll('.board-pin'), function (p) { if (p.getAttribute('data-comment-id') === id) { hit = p; return true; } return false; });
      return hit;
    }

    /* ---- right-click menu ---- */
    function nearestEl(list, cx, cy) {
      var best = null, bd = Infinity;
      Array.prototype.forEach.call(list || [], function (el) {
        if (el.closest && el.closest('[data-bb-overlay]')) return;
        var r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return;
        var dx = cx < r.left ? r.left - cx : cx > r.right ? cx - r.right : 0, dy = cy < r.top ? r.top - cy : cy > r.bottom ? cy - r.bottom : 0, dd = dx * dx + dy * dy;
        if (dd < bd) { bd = dd; best = el; }
      });
      return best;
    }
    function buildTarget(el, scope, cx, cy, ex) {
      var t = {};
      if (!ex.cover && scope) {
        var copyEl = (el && el.closest('[data-copy]')) || nearestEl(scope.querySelectorAll('[data-copy]'), cx, cy);
        if (copyEl) { t.copy = copyEl.getAttribute('data-copy'); t.copyText = snip(copyEl.textContent, 80); }
        var priceEl = (el && el.closest('[data-price-row]')) || nearestEl(scope.querySelectorAll('[data-price-row]'), cx, cy);
        if (priceEl) { t.price = priceEl.getAttribute('data-price-row'); t.priceText = snip(priceEl.textContent, 100); }
        var imgs = Array.prototype.filter.call(scope.querySelectorAll('img'), function (i) { return i.getAttribute('aria-hidden') !== 'true'; });
        var imgEl = (el && el.tagName === 'IMG' ? el : null) || nearestEl(imgs.length ? imgs : scope.querySelectorAll('img'), cx, cy);
        if (imgEl) t.image = fileName(imgEl.currentSrc || imgEl.getAttribute('src'));
        var txt = el && !(el.closest && el.closest('[data-bb-overlay]')) ? snip(el.textContent, 120) : '';
        if (txt) t.text = txt;
      }
      if (ex.asset) t.asset = ex.asset;
      if (ex.cover) t.cover = 'B안 미구현';
      if (ex.placeholder) t.placeholder = '뷰티앱 디자인 미구현';
      t.label = cardLabel({ mode: ex.mode, card: ex.card, variant: ex.variant, target: t });
      return clampTarget(t);
    }
    function surfaceAt(view, idoc, el, cx, cy) {
      var mode = view.kind === 'home' ? 'home' : 'app', container = null, card = 0, variant = 'a', cover = false;
      if (view.kind === 'app-thumb' || view.kind === 'app-card') container = idoc.querySelector('[data-app-asset="' + view.asset + '"]');
      else {
        var cv = el && el.closest && el.closest('.bbv4-cover'), sec = el && el.closest && el.closest('[data-card]');
        if (sec && sec.closest('[data-app-asset]')) sec = null;
        if (cv && sec) { container = cv; card = Number(sec.getAttribute('data-card')) || 0; variant = 'b'; cover = true; }
        else if (sec) { container = sec; card = Number(sec.getAttribute('data-card')) || 0; variant = sec.getAttribute('data-variant') === 'b' ? 'b' : 'a'; }
        else container = idoc.querySelector('main') || idoc.body;
      }
      if (!container) return null;
      var r = container.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return null;
      var asset = view.asset || null;
      return { mode: mode, card: card, variant: variant, x: round4(clamp01((cx - r.left) / r.width)), y: round4(clamp01((cy - r.top) / r.height)), target: buildTarget(el, container, cx, cy, { mode: mode, card: card, variant: variant, cover: cover, asset: asset }) };
    }
    function onFrameContext(idoc, e) {
      var view = idoc.__bbv4view; if (!view || !view.frame) return;
      if (e.shiftKey) { hideCtx(); return; } /* Shift+right-click keeps the browser menu */
      var t = e.target, el = t && t.nodeType === 1 ? t : t && t.parentElement;
      if (el && el.closest && el.closest('.bbv4-pin,.bbv4-slide')) { e.preventDefault(); return; }
      var surf = surfaceAt(view, idoc, el, e.clientX, e.clientY);
      if (!surf) return;
      e.preventDefault();
      var f = view.frame, r = f.getBoundingClientRect(), sx = r.width / (f.offsetWidth || r.width || 1), sy = r.height / (f.offsetHeight || r.height || 1);
      showCtx(r.left + e.clientX * sx, r.top + e.clientY * sy, surf);
    }
    function onBoardContext(e, host, asset) {
      if (e.shiftKey) { hideCtx(); return; }
      if (e.target && e.target.closest && e.target.closest('.board-pin')) { e.preventDefault(); return; }
      e.preventDefault();
      var r = host.getBoundingClientRect();
      showCtx(e.clientX, e.clientY, { mode: 'app', card: 0, variant: 'a', x: round4(clamp01((e.clientX - r.left) / r.width)), y: round4(clamp01((e.clientY - r.top) / r.height)), target: buildTarget(null, null, 0, 0, { mode: 'app', card: 0, variant: 'a', asset: asset, placeholder: true }) });
    }
    function showCtx(x, y, surf) {
      if (!ui.ctx || !it0()) return;
      state.ctx = surf;
      var t = surf.target || {}, where = [t.label, t.copyText ? '가까운 문구 “' + snip(t.copyText, 26) + '”' : '', t.cover || t.placeholder || ''].filter(Boolean).join(' · ');
      ui.ctx.replaceChildren(
        H('button', { type: 'button', class: 'ctx-item', role: 'menuitem', 'data-action': 'ctx-add-comment', onclick: function () { var s = state.ctx; hideCtx(); if (s) createComment(s); } }, [H('span', { class: 'ctx-bubble', 'aria-hidden': 'true' }), H('span', { text: '여기에 코멘트 달기' })]),
        H('p', { class: 'ctx-where', text: where }),
        H('p', { class: 'ctx-tip', text: 'Shift+우클릭: 브라우저 기본 메뉴' }));
      ui.ctx.hidden = false;
      var W = (win0 && win0.innerWidth) || 1280, Hh = (win0 && win0.innerHeight) || 800;
      ui.ctx.setAttribute('style', 'left:' + Math.round(Math.max(4, Math.min(x, W - 270))) + 'px;top:' + Math.round(Math.max(4, Math.min(y, Hh - 130))) + 'px');
      var b = ui.ctx.firstChild; if (b && b.focus) b.focus();
    }
    function it0() { return item(); }
    function hideCtx() { if (ui.ctx && !ui.ctx.hidden) { ui.ctx.hidden = true; } state.ctx = null; }
    function bindBoardEvents() {
      if (!doc.addEventListener) return;
      doc.addEventListener('mousedown', function (e) { if (ui.ctx && !ui.ctx.hidden && !(ui.ctx.contains && ui.ctx.contains(e.target))) hideCtx(); }, true);
      doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') { hideCtx(); if (ui.lightbox && !ui.lightbox.hidden) closeLightbox(); else closeFinal(); } });
      /* Ctrl+Z / Cmd+Z: undo this tab's last saved wording change; Ctrl+Shift+Z / Ctrl+Y: redo. Text boxes keep their own undo. */
      doc.addEventListener('keydown', function (e) {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        var k = e.key || '', z = e.code === 'KeyZ' || k === 'z' || k === 'Z', y = e.code === 'KeyY' || k === 'y' || k === 'Y';
        if (!z && !y) return;
        var t = e.target && e.target.nodeType === 1 ? e.target : null;
        if (state.editor || (t && t.closest && t.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'))) return;
        e.preventDefault();
        if (y || e.shiftKey) redoLast(); else undoLast();
      });
      doc.addEventListener('keydown', function (e) {
        if (!hasAppClass('edit-mode') || e.ctrlKey || e.metaKey || e.altKey) return;
        var t = e.target && e.target.nodeType === 1 ? e.target : null;
        if (state.editor || (t && t.closest && t.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'))) return;
        if (e.key === 'v' || e.key === 'V') { e.preventDefault(); setTool('move'); } else if (e.key === 't' || e.key === 'T') { e.preventDefault(); setTool('text'); }
        else if (state.tool !== 'text' && state.layers && state.layers.selected && /^(ArrowLeft|ArrowRight|ArrowUp|ArrowDown|\+|=|-|_|Escape)$/.test(e.key)) { e.preventDefault(); postToFrame({ type: 'aptos-layer-key', key: e.key, shift: e.shiftKey }); }
      });
      /* a link dropped outside a comment card must not navigate the board away (unsaved drafts would be lost) */
      doc.addEventListener('dragover', function (e) { var ty = dtTypes(e.dataTransfer); if (ty.indexOf('text/uri-list') >= 0 || ty.indexOf('Files') >= 0) e.preventDefault(); });
      doc.addEventListener('drop', function (e) {
        if (e.defaultPrevented) return;
        var t = e.target && e.target.nodeType === 1 ? e.target : null; if (t && t.closest && t.closest('input,textarea,[contenteditable]')) return;
        var dt = e.dataTransfer, fs = filesFrom(dt), c = commentById(state.cm.active);
        if (fs.length) { e.preventDefault(); if (c) addImages(c.id, fs); else toast('이미지를 붙일 코멘트를 먼저 열어 주세요.', 'error'); return; }
        if (dtTypes(dt).indexOf('text/uri-list') >= 0 || (dt && dt.files && dt.files.length)) { e.preventDefault(); toast(dropProblem(dt) || LINK_ONLY_MSG, 'error'); }
      });
      doc.addEventListener('paste', function (e) { /* Ctrl+V anywhere on the board goes to the open comment */
        var c = commentById(state.cm.active); if (!c || e.defaultPrevented) return;
        var t = e.target && e.target.nodeType === 1 ? e.target : null;
        if (t && t.closest && (t.closest('.cm-card') || t.closest('input,textarea,[contenteditable]'))) return; /* the card handles its own paste; other fields keep theirs */
        var files = filesFrom(e.clipboardData); if (!files.length) return;
        e.preventDefault(); addImages(c.id, files);
      });
      if (win0) { win0.addEventListener('resize', function () { hideCtx(); syncAllViews(); fitFinal(); }); win0.addEventListener('blur', hideCtx); win0.addEventListener('scroll', hideCtx, { passive: true }); }
      if (win0) { win0.addEventListener('scroll', queueFitSidebar, { passive: true }); win0.addEventListener('resize', queueFitSidebar); if (win0.setTimeout) win0.setTimeout(queueFitSidebar, 600); }
      if (doc.fonts && doc.fonts.ready && doc.fonts.ready.then) doc.fonts.ready.then(queueFitSidebar);
    }

    /* ---- comments: data ---- */
    function normComment(c) {
      c = isObj(c) ? c : {};
      var st = ['open', 'question', 'done', 'deleted'].indexOf(c.status) >= 0 ? c.status : 'open';
      var str = function (v) { return typeof v === 'string' ? v : ''; };
      return { id: String(c.id || ''), seq: Number(c.seq) || 0, item: str(c.item), locale: str(c.locale), mode: c.mode === 'app' ? 'app' : 'home', card: Math.max(0, Number(c.card) | 0), variant: normVariant(c.variant),
        x: clamp01(c.x), y: clamp01(c.y), target: isObj(c.target) ? c.target : {}, text: str(c.text), status: st, note: str(c.note), by: str(c.by), createdAt: str(c.createdAt), updatedAt: str(c.updatedAt),
        statusBy: str(c.statusBy), statusAt: str(c.statusAt), images: Array.isArray(c.images) ? c.images.filter(function (i) { return isObj(i) && typeof i.id === 'string'; }) : [], _local: 0 };
    }
    function commentById(id) { return id ? state.cm.list.filter(function (c) { return c.id === id; })[0] || null : null; }
    function draftOf(id) { return state.drafts[id] || (state.drafts[id] = { text: null, dirty: false, timer: null, saving: null, msg: '', kind: '' }); }
    function draftText(c) { var d = state.drafts[c.id]; return d && d.text != null && (d.dirty || d.saving) ? d.text : c.text; }
    function upsertComment(c) {
      c._local = Date.now();
      var i = -1; state.cm.list.forEach(function (x, k) { if (x.id === c.id) i = k; });
      if (c.status === 'deleted') { if (i >= 0) state.cm.list.splice(i, 1); }
      else if (i >= 0) state.cm.list[i] = c; else state.cm.list.push(c);
      state.cm.list.sort(function (a, b) { return a.seq - b.seq; });
      var it = item(); if (it && state.cm.itemId === it.id) state.summary[it.id] = commentCounts(state.cm.list);
    }
    function loadComments(itemId) {
      if (!itemId) return Promise.resolve();
      var token = ++state.cm.token, started = Date.now();
      if (state.cm.itemId !== itemId) { state.cm.itemId = itemId; state.cm.list = []; state.cm.active = null; state.cm.loaded = false; state.cm.error = null; }
      state.cm.loading = true;
      return capi.list(itemId).then(function (r) {
        if (token !== state.cm.token || state.cm.itemId !== itemId) return;
        state.cm.loading = false; state.cm.status = r.status;
        if (!r.ok || !r.body || !Array.isArray(r.body.comments)) { state.cm.error = r.status === 404 ? 'unavailable' : 'failed'; renderComments(); return; }
        state.cm.error = null; state.cm.loaded = true;
        var fresh = r.body.comments.map(normComment).filter(function (c) { return c.item === itemId && c.id && c.status !== 'deleted'; });
        state.cm.list.forEach(function (old) { /* keep a local change newer than this request */
          if (old._local <= started) return;
          var k = -1; fresh.forEach(function (x, j) { if (x.id === old.id) k = j; });
          if (k >= 0) fresh[k] = old; else fresh.push(old);
        });
        fresh.sort(function (a, b) { return a.seq - b.seq; });
        state.cm.list = fresh;
        if (state.cm.active && !commentById(state.cm.active)) state.cm.active = null;
        state.summary[itemId] = commentCounts(fresh);
        renderComments(); renderSidebar(); syncAllViews();
      });
    }
    function loadSummary() {
      return capi.summary().then(function (r) {
        if (!r.ok || !r.body || !isObj(r.body.items)) { state.summaryOk = false; return; }
        state.summaryOk = true;
        var next = {};
        Object.keys(r.body.items).forEach(function (id) { var s = r.body.items[id]; if (isObj(s)) next[id] = { open: Number(s.open) || 0, question: Number(s.question) || 0, done: Number(s.done) || 0 }; });
        if (state.cm.loaded && state.cm.itemId) next[state.cm.itemId] = commentCounts(state.cm.list);
        var changed = JSON.stringify(next) !== JSON.stringify(state.summary);
        state.summary = next;
        if (changed) renderSidebar();
      });
    }
    function refreshComments() { var it = item(); return Promise.all([loadSummary(), it ? loadComments(it.id) : null]); }
    function commentErr(r, what) {
      if (!r || !r.status) return what + ': 네트워크 오류입니다.';
      if (r.status === 404) return what + ': 공유 서버에 코멘트 기능이 아직 없습니다 (HTTP 404).';
      if (r.status === 429) return what + ': 요청이 너무 많습니다. 잠시 뒤 다시 해 주세요.';
      if (r.status === 413) return what + ': 크기가 너무 큽니다 (장당 10MB까지).';
      return what + ' (HTTP ' + r.status + (r.body && r.body.error ? ' · ' + String(r.body.error).slice(0, 80) : '') + ').';
    }
    function createComment(surf) {
      var it = item(); if (!it) return Promise.resolve();
      if (!store.canEdit()) { toast('공유 서버에 연결되지 않아 코멘트를 달 수 없습니다.', 'error'); return Promise.resolve(); }
      var body = { item: it.id, locale: surf.mode === 'app' ? 'KO' : state.locale, mode: surf.mode, card: surf.card, variant: surf.variant, x: surf.x, y: surf.y, target: surf.target, text: '', by: by() };
      return capi.create(body).then(function (r) {
        if (!r.ok || !r.body || !isObj(r.body.comment)) { toast(commentErr(r, '코멘트를 만들지 못했습니다'), 'error'); return; }
        var c = normComment(r.body.comment);
        if (c.item !== it.id) return;
        if (state.cm.active) flushDraft(state.cm.active);
        upsertComment(c); state.cm.active = c.id;
        setDrawer(true); renderComments(); renderSidebar(); syncAllViews(); focusComment(c.id);
        toast((c.seq || '') + '번 코멘트를 달았습니다. 내용을 적으면 자동 저장됩니다.', 'ok');
      });
    }
    function setSaveNote(id, msg, kind) {
      var d = draftOf(id); d.msg = msg; d.kind = kind || '';
      var el = ui.cmSaveEl && ui.cmSaveEl[id];
      if (el) { el.textContent = msg; el.className = 'cm-save' + (kind ? ' is-' + kind : ''); }
    }
    function onCommentInput(id, ta) {
      var d = draftOf(id); d.text = ta.value; d.dirty = true;
      setSaveNote(id, '입력 중…', '');
      clearLater(d.timer);
      d.timer = later(function () { d.timer = null; saveCommentText(id); }, COMMENT_SAVE_MS);
    }
    function saveCommentText(id) {
      var d = draftOf(id);
      if (!d.dirty) return d.saving || Promise.resolve();
      if (d.saving) { d.again = true; return d.saving; }
      if (!store.canEdit()) { setSaveNote(id, '미저장: 공유 서버에 연결되지 않았습니다.', 'error'); return Promise.resolve(); }
      var text = d.text; d.dirty = false;
      setSaveNote(id, '저장 중…', '');
      d.saving = capi.update({ id: id, text: text, by: by() }).then(function (r) {
        d.saving = null;
        if (!r.ok || !r.body || !isObj(r.body.comment)) { if (d.text === text) d.dirty = true; setSaveNote(id, '미저장: ' + commentErr(r, '저장하지 못했습니다') + ' 다시 입력하면 다시 저장합니다.', 'error'); return; }
        var c = normComment(r.body.comment);
        upsertComment(c);
        if (d.again || d.dirty) { d.again = false; if (d.dirty) return saveCommentText(id); }
        setSaveNote(id, '저장됨 ' + new Date().toLocaleTimeString('ko-KR'), 'ok');
        updateCommentHead(); syncAllViews();
      });
      return d.saving;
    }
    function flushDraft(id) { var d = state.drafts[id]; if (!d) return Promise.resolve(); clearLater(d.timer); d.timer = null; return saveCommentText(id); }
    function flushActiveDraft() { if (state.cm.active) flushDraft(state.cm.active); }
    function setCommentStatus(id, status) {
      if (!store.canEdit()) { toast('공유 서버에 연결되지 않아 상태를 바꿀 수 없습니다.', 'error'); return Promise.resolve(); }
      return flushDraft(id).then(function () { return capi.update({ id: id, status: status, by: by() }); }).then(function (r) {
        if (!r.ok || !r.body || !isObj(r.body.comment)) { toast(commentErr(r, '상태를 바꾸지 못했습니다'), 'error'); return; }
        var c = normComment(r.body.comment);
        if (status === 'deleted') c.status = 'deleted';
        upsertComment(c);
        if (c.status === 'deleted' && state.cm.active === id) state.cm.active = null;
        renderComments(); renderSidebar(); syncAllViews();
        toast(status === 'done' ? (c.seq + '번을 적용완료로 바꾸었습니다.') : status === 'open' ? (c.seq + '번을 다시 열었습니다.') : '코멘트를 지웠습니다.', 'ok');
      });
    }
    function activateComment(id, o) {
      var c = commentById(id); if (!c) return;
      if (state.cm.active && state.cm.active !== id) flushDraft(state.cm.active);
      state.cm.active = id;
      var it = item();
      if (c.mode === 'home' && c.locale !== state.locale && it && hasLocale(it, c.locale) && state.data.locales.some(function (l) { return l.id === c.locale; })) { selectLocale(c.locale); }
      if (c.mode === 'home' && it && VARIANT_SLOTS.indexOf(c.card) >= 0 && slideOf(it.id, c.card) !== c.variant) (state.slides[it.id] = state.slides[it.id] || {})[c.card] = c.variant;
      setDrawer(true); renderComments(); syncAllViews();
      if (o && o.fromPin) { focusComment(id); return; }
      var pin = findPin(id); if (pin && pin.scrollIntoView) pin.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    function focusComment(id) {
      var ta = ui.cmTextEl && ui.cmTextEl[id];
      if (ta && ta.focus) { ta.focus(); try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) { /* not a text field */ } }
      var card = ui.cmCardEl && ui.cmCardEl[id]; if (card && card.scrollIntoView) card.scrollIntoView({ block: 'nearest' });
    }
    /* 2026-11-06 team: "이미지 첨부가 안 돼서 링크로". A picture dragged or copied from Drive or a web page arrives as a link or HTML,
       not as a file: say how to attach instead of ignoring it, and never let a dropped link navigate the board away. */
    var LINK_ONLY_MSG = '이미지 링크는 붙일 수 없습니다. 이미지를 PC에 저장한 뒤 ‘이미지 첨부’로 고르거나, 화면을 캡처(Win+Shift+S)해 Ctrl+V로 붙여 주세요.';
    function dtTypes(dt) { return dt ? Array.prototype.slice.call(dt.types || []) : []; }
    function htmlImageOnly(dt) { var ty = dtTypes(dt); if (ty.indexOf('Files') >= 0) return false; var html = ty.indexOf('text/html') >= 0 && dt.getData ? dt.getData('text/html') : ''; return /<img\b/i.test(html || ''); }
    function dropProblem(dt) {
      var ty = dtTypes(dt);
      if (dt && dt.files && dt.files.length) return '이미지 파일(PNG·JPG·WEBP·GIF)만 붙일 수 있습니다.';
      if (ty.indexOf('text/uri-list') >= 0 || htmlImageOnly(dt)) return LINK_ONLY_MSG;
      return '';
    }
    function filesFrom(dt) {
      if (!dt) return [];
      var out = [];
      if (dt.files && dt.files.length) Array.prototype.forEach.call(dt.files, function (f) { if (/^image\//.test(f.type)) out.push(f); });
      if (!out.length && dt.items) Array.prototype.forEach.call(dt.items, function (i) { if (i.kind === 'file' && /^image\//.test(i.type)) { var f = i.getAsFile(); if (f) out.push(f); } });
      return out;
    }
    function blobB64(blob) {
      return new Promise(function (resolve, reject) { var fr = new win0.FileReader(); fr.onload = function () { resolve(String(fr.result).split(',')[1] || ''); }; fr.onerror = function () { reject(new Error('이미지를 읽지 못했습니다.')); }; fr.readAsDataURL(blob); });
    }
    /* the original file when imagePlan keeps it; otherwise redrawn on white as JPEG 0.9, lowering quality to 0.6 and then the size
       (x0.75 per step) only while it is still above 10MB */
    function prepareImage(file) {
      return new Promise(function (resolve, reject) {
        var url = win0.URL.createObjectURL(file), img = new win0.Image();
        img.onload = function () { win0.URL.revokeObjectURL(url); resolve(img); };
        img.onerror = function () { win0.URL.revokeObjectURL(url); reject(new Error('이미지 파일을 열지 못했습니다.')); };
        img.src = url;
      }).then(function (img) {
        var w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) throw new Error('이미지 파일을 열지 못했습니다.');
        var plan = imagePlan(w, h, file.type, file.size);
        var withPreview = function (main) { /* the thumbnail shows the center square (object-fit: cover), so the preview is exactly that */
          if (main.blob.size <= IMG_PREVIEW_MIN) return main;
          var side = Math.min(w, h), out = Math.min(IMG_PREVIEW_SIDE, side), c = doc.createElement('canvas'); c.width = out; c.height = out;
          var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, out, out); g.imageSmoothingQuality = 'high';
          g.drawImage(img, Math.round((w - side) / 2), Math.round((h - side) / 2), side, side, 0, 0, out, out);
          return capBlob(c, 'image/jpeg', 0.85).then(function (b) { main.preview = b; return main; }, function () { return main; });
        };
        if (plan.keep) return withPreview({ blob: file, mime: file.type, w: w, h: h });
        var drawAt = function (scale) {
          var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale)), c = doc.createElement('canvas'); c.width = cw; c.height = ch;
          var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, cw, ch);
          var tryQ = function (q) {
            return capBlob(c, 'image/jpeg', q).then(function (b) {
              if (b.size <= IMG_MAX_BYTES) return { blob: b, mime: 'image/jpeg', w: cw, h: ch };
              if (q > 0.6) return tryQ(Math.round((q - 0.1) * 100) / 100);
              if (scale > 0.05) return drawAt(scale * 0.75);
              throw new Error('이미지가 너무 커서 올릴 수 없습니다.');
            });
          };
          return tryQ(IMG_Q);
        };
        return drawAt(plan.scale).then(withPreview);
      });
    }
    function addImages(id, files) {
      var c = commentById(id); if (!c || !files.length || !win0) return Promise.resolve();
      if (!store.canEdit()) { toast('공유 서버에 연결되지 않아 이미지를 올릴 수 없습니다.', 'error'); return Promise.resolve(); }
      var d = draftOf(id), room = IMG_PER_COMMENT - c.images.length - (d.uploading || 0);
      if (room <= 0) { toast('이미지는 코멘트당 ' + IMG_PER_COMMENT + '장까지 넣을 수 있습니다.', 'error'); return Promise.resolve(); }
      if (files.length > room) toast(IMG_PER_COMMENT + '장을 넘는 이미지는 넣지 않았습니다.', 'error');
      var list = files.slice(0, room); d.uploading = (d.uploading || 0) + list.length;
      return list.reduce(function (p, f, i) {
        return p.then(function () {
          setSaveNote(id, '이미지 올리는 중 ' + (i + 1) + '/' + list.length + '…', '');
          return prepareImage(f).then(function (s) {
            return capi.imageRaw({ commentId: id, mime: s.mime, w: s.w, h: s.h, by: by() }, s.blob).then(function (r) {
              if (!r.ok || !r.body || !isObj(r.body.image) || !s.preview) return r;
              /* the preview is a nicety: if it fails, the card just shows the original */
              return capi.imagePreview(r.body.image.id, s.preview).then(function (p) { if (p.ok) r.body.image.preview = true; return r; }, function () { return r; });
            });
          }).then(function (r) {
            d.uploading--;
            if (!r.ok || !r.body || !isObj(r.body.image)) throw new Error(commentErr(r, '이미지를 올리지 못했습니다'));
            var cur = commentById(id); if (cur) { cur.images = cur.images.concat([r.body.image]); cur._local = Date.now(); }
            renderComments(); setSaveNote(id, '이미지를 올렸습니다 (' + ((cur && cur.images.length) || 0) + '/' + IMG_PER_COMMENT + ').', 'ok');
          }, function (e) { d.uploading--; throw e; });
        });
      }, Promise.resolve()).catch(function (e) { d.uploading = 0; setSaveNote(id, e && e.message || String(e), 'error'); toast(e && e.message || String(e), 'error'); });
    }
    function removeImage(cid, img) {
      if (!store.canEdit()) return Promise.resolve();
      return capi.imageDelete({ id: img.id, by: by() }).then(function (r) {
        if (!r.ok) { toast(commentErr(r, '이미지를 지우지 못했습니다'), 'error'); return; }
        var c = commentById(cid); if (c) { c.images = c.images.filter(function (x) { return x.id !== img.id; }); c._local = Date.now(); }
        renderComments();
      });
    }
    function openLightbox(src, alt) {
      if (!ui.lightbox) return;
      /* the original can take a while to arrive from the share server: say so until it has loaded */
      var note = H('div', { class: 'lightbox-note', text: '원본 이미지를 불러오는 중입니다…' });
      var im = H('img', { class: 'lightbox-img', alt: alt || '', onload: function () { note.hidden = true; }, onerror: function () { note.textContent = '이미지를 불러오지 못했습니다.'; } });
      ui.lightbox.replaceChildren(im, note, H('button', { type: 'button', class: 'btn small lightbox-close', text: '닫기 (Esc)' }));
      im.src = src;
      ui.lightbox.hidden = false;
    }
    function closeLightbox() { if (ui.lightbox && !ui.lightbox.hidden) { ui.lightbox.hidden = true; ui.lightbox.replaceChildren(); } }

    /* ---- comments: panel ---- */
    function panelComments() {
      var it = item(); if (!it || state.cm.itemId !== it.id) return [];
      return state.cm.list.filter(function (c) { return c.mode === state.mode && c.status !== 'deleted'; });
    }
    function updateCommentHead() {
      if (!ui.cmHead) return;
      var list = panelComments(), n = commentCounts(list);
      ui.cmHead.replaceChildren(
        H('h2', { class: 'cm-title', text: (state.mode === 'app' ? '뷰티앱' : '홈페이지') + ' 코멘트' }),
        H('p', { class: 'cm-counts', 'data-cm-counts': n.open + '/' + n.question + '/' + n.done + '/' + n.total }, [
          H('span', { class: 'cm-count is-open', text: '요청 ' + n.open }), H('span', { class: 'cm-count is-question', text: '확인 필요 ' + n.question }),
          H('span', { class: 'cm-count is-done', text: '적용완료 ' + n.done }), H('span', { class: 'cm-count', text: '전체 ' + n.total }),
        ]),
        H('button', { type: 'button', class: 'btn small cm-close', 'aria-label': '코멘트 닫기', text: '닫기', onclick: function () { setDrawer(false); } }));
      if (ui.drawerBtn) ui.drawerBtn.textContent = '코멘트' + (n.open ? ' · 요청 ' + n.open : n.total ? ' ' + n.total : '');
    }
    function renderComments() {
      if (!ui.cpanel) return;
      updateCommentHead();
      var ae = doc.activeElement, typing = ae && ae.getAttribute && ae.getAttribute('data-comment-text');
      if (typing && commentById(typing) && ui.cmTextEl && ui.cmTextEl[typing] === ae) { state.cm.dirtyPanel = true; fillCardParts(commentById(typing)); return; } /* never rebuild under the caret */
      state.cm.dirtyPanel = false;
      var it = item(), list = panelComments();
      var msg = !it ? '' : state.cm.error === 'unavailable' ? '공유 서버에 코멘트 기능이 아직 없습니다 (HTTP 404). 서버가 준비되면 자동으로 보입니다.'
        : state.cm.error === 'failed' ? '코멘트를 불러오지 못했습니다' + (state.cm.status ? ' (HTTP ' + state.cm.status + ')' : ' (네트워크)') + '. 15초마다 다시 확인합니다.'
        : !state.cm.loaded ? '코멘트를 불러오는 중…' : !list.length ? '아직 코멘트가 없습니다.' : '';
      ui.cmStatus.textContent = msg;
      ui.cmStatus.setAttribute('data-state', state.cm.error || (state.cm.loaded ? 'ready' : 'loading'));
      ui.cmTextEl = {}; ui.cmSaveEl = {}; ui.cmCardEl = {}; ui.cmParts = {};
      ui.cmList.replaceChildren.apply(ui.cmList, list.map(commentCard));
    }
    function headKids(c) {
      var color = STATUS_COLOR[c.status] || STATUS_COLOR.open;
      return [
        H('span', { class: 'cm-num', style: 'background:' + color, text: String(c.seq || '?') }),
        H('span', { class: 'cm-loc', text: cardLabel(c) + (c.mode === 'home' && c.locale !== state.locale ? ' · ' + c.locale : '') }),
        H('span', { class: 'cm-chip is-' + c.status, text: STATUS_NAME[c.status] || c.status }),
      ];
    }
    function thumbKids(c) {
      return c.images.map(function (img, k) {
        var src = capi.imageUrl(img.id), thumb = img.preview ? capi.imageUrl(img.id, 'preview') : src;
        return H('div', { class: 'cm-thumb' }, [
          H('button', { type: 'button', class: 'cm-thumb-btn', 'data-comment-image': img.id, 'aria-label': c.seq + '번 이미지 ' + (k + 1) + ' 크게 보기', onclick: function () { openLightbox(src, c.seq + '번 코멘트 이미지 ' + (k + 1)); } }, [H('img', { src: thumb, alt: '', loading: 'lazy', width: img.w ? String(img.w) : null, height: img.h ? String(img.h) : null })]),
          store.canEdit() ? H('button', { type: 'button', class: 'cm-thumb-del', 'aria-label': '이미지 ' + (k + 1) + ' 지우기', text: '×', onclick: function () { removeImage(c.id, img); } }) : null,
        ]);
      });
    }
    function metaText(c) { return '작성 ' + (c.by || '익명') + (fmtTime(c.createdAt) ? ' · ' + fmtTime(c.createdAt) : '') + (c.statusAt ? ' · ' + (STATUS_NAME[c.status] || c.status) + ' ' + (c.statusBy || '') + ' ' + fmtTime(c.statusAt) : ''); }
    function noteKids(c) { return c.note ? [H('strong', { text: '에이전트 메모' }), H('p', { text: c.note })] : []; }
    function actionKids(c) {
      var del = H('button', { type: 'button', class: 'btn small ghost', 'data-action': 'comment-delete', text: '지우기', onclick: function () {
        if (del.getAttribute('data-armed') !== '1') { del.setAttribute('data-armed', '1'); del.textContent = '한 번 더 누르면 지웁니다'; later(function () { del.removeAttribute('data-armed'); del.textContent = '지우기'; }, 4000); return; }
        setCommentStatus(c.id, 'deleted');
      } });
      return [
        c.status === 'done'
          ? H('button', { type: 'button', class: 'btn small', 'data-action': 'comment-reopen', disabled: !store.canEdit(), text: '다시 열기', onclick: function () { setCommentStatus(c.id, 'open'); } })
          : H('button', { type: 'button', class: 'btn small primary cm-done', 'data-action': 'comment-done', disabled: !store.canEdit(), text: '적용완료', onclick: function () { setCommentStatus(c.id, 'done'); } }),
        c.status === 'question' ? H('button', { type: 'button', class: 'btn small', 'data-action': 'comment-answered', disabled: !store.canEdit(), text: '답했음(요청으로)', onclick: function () { setCommentStatus(c.id, 'open'); } }) : null,
        del,
      ];
    }
    /* refresh an open card around the text box the user is typing in (the text box itself is never replaced) */
    function fillCardParts(c) {
      var p = ui.cmParts && ui.cmParts[c.id], li = ui.cmCardEl && ui.cmCardEl[c.id]; if (!p || !li) return;
      var color = STATUS_COLOR[c.status] || STATUS_COLOR.open;
      li.className = 'cm-card is-' + c.status + ' active'; li.setAttribute('data-status', c.status); li.setAttribute('style', '--cm:' + color);
      p.head.replaceChildren.apply(p.head, headKids(c));
      p.thumbs.replaceChildren.apply(p.thumbs, thumbKids(c)); p.thumbs.hidden = !c.images.length;
      p.tip.textContent = 'Ctrl+V 붙여넣기 · 끌어놓기 · 장당 10MB · ' + c.images.length + '/' + IMG_PER_COMMENT + '장';
      p.note.replaceChildren.apply(p.note, noteKids(c)); p.note.hidden = !c.note;
      p.meta.textContent = metaText(c);
      p.actions.replaceChildren.apply(p.actions, actionKids(c));
    }
    function commentCard(c) {
      var active = c.id === state.cm.active, color = STATUS_COLOR[c.status] || STATUS_COLOR.open, d = draftOf(c.id);
      var head = H('button', { type: 'button', class: 'cm-card-head', 'aria-expanded': active ? 'true' : 'false', onclick: function () { if (state.cm.active === c.id) return; activateComment(c.id); } }, headKids(c));
      var kids = [head];
      if (!active) {
        kids.push(H('p', { class: 'cm-preview' + (draftText(c) ? '' : ' is-empty'), text: draftText(c) ? snip(draftText(c), 90) : '(글 없음)' }));
        if (c.images.length) kids.push(H('p', { class: 'cm-meta', text: '이미지 ' + c.images.length + '장' }));
      } else {
        var ta = H('textarea', { class: 'cm-text', rows: '4', maxlength: String(COMMENT_MAX), 'data-comment-text': c.id, placeholder: '수정 요청을 적어 주세요. 캐처는 Ctrl+V로 붙입니다.', 'aria-label': c.seq + '번 코멘트 내용', value: draftText(c), disabled: !store.canEdit() });
        ta.addEventListener('input', function () { onCommentInput(c.id, ta); });
        ta.addEventListener('blur', function () { flushDraft(c.id); if (state.cm.dirtyPanel) later(renderComments, 0); });
        ui.cmTextEl[c.id] = ta;
        var save = H('span', { class: 'cm-save' + (d.kind ? ' is-' + d.kind : ''), role: 'status', text: d.msg || (c.updatedAt ? '저장됨 ' + fmtTime(c.updatedAt) : '') });
        ui.cmSaveEl[c.id] = save;
        var file = H('input', { type: 'file', class: 'cm-file', accept: 'image/png,image/jpeg,image/webp,image/gif', multiple: true, 'aria-label': '이미지 파일 선택', onchange: function (e) { var fs = filesFrom({ files: e.target.files }); e.target.value = ''; addImages(c.id, fs); } });
        var parts = ui.cmParts[c.id] = {
          head: head,
          thumbs: H('div', { class: 'cm-thumbs', hidden: !c.images.length }, thumbKids(c)),
          tip: H('span', { class: 'cm-attach-tip', text: 'Ctrl+V 붙여넣기 · 끌어놓기 · 장당 10MB · ' + c.images.length + '/' + IMG_PER_COMMENT + '장' }),
          note: H('div', { class: 'cm-note', hidden: !c.note }, noteKids(c)),
          meta: H('p', { class: 'cm-meta', text: metaText(c) }),
          actions: H('div', { class: 'cm-actions' }, actionKids(c)),
        };
        kids.push(ta, save, parts.thumbs,
          H('div', { class: 'cm-attach' }, [
            H('button', { type: 'button', class: 'btn small', 'data-action': 'comment-attach', disabled: !store.canEdit(), text: '이미지 첨부', onclick: function () { file.click(); } }), file, parts.tip,
          ]),
          parts.note, parts.meta, parts.actions);
      }
      var li = H('li', { class: 'cm-card is-' + c.status + (active ? ' active' : ''), 'data-comment-id': c.id, 'data-status': c.status, style: '--cm:' + color }, kids);
      ui.cmCardEl[c.id] = li;
      if (active) {
        li.addEventListener('paste', function (e) { var fs = filesFrom(e.clipboardData); if (!fs.length) { if (htmlImageOnly(e.clipboardData)) toast(LINK_ONLY_MSG, 'error'); return; } e.preventDefault(); addImages(c.id, fs); });
        li.addEventListener('dragover', function (e) { var ty = e.dataTransfer ? Array.prototype.slice.call(e.dataTransfer.types || []) : []; if (ty.indexOf('Files') >= 0 || ty.indexOf('text/uri-list') >= 0) { e.preventDefault(); li.className = li.className.replace(/\s*is-drop/g, '') + ' is-drop'; } });
        li.addEventListener('dragleave', function () { li.className = li.className.replace(/\s*is-drop/g, ''); });
        li.addEventListener('drop', function (e) { li.className = li.className.replace(/\s*is-drop/g, ''); var fs = filesFrom(e.dataTransfer); if (!fs.length) { var why = dropProblem(e.dataTransfer); if (why) { e.preventDefault(); toast(why, 'error'); } return; } e.preventDefault(); addImages(c.id, fs); });
      }
      return li;
    }

    /* ---- beauty-app tab (plan section 7) ---- */
    function appSpecPanel() {
      return H('details', { class: 'app-spec', open: true }, [
        H('summary', { text: '플랫폼 규격 · 강남언니 · 바비톡 · 여신티켓 (2026-11-04 확인)' }),
        H('div', { class: 'app-spec-scroll' }, [H('table', { class: 'app-spec-table' }, [
          H('thead', null, [H('tr', null, ['플랫폼', '대표·썸네일', '추가 이미지', '상세 이미지', '가격 규칙'].map(function (t) { return H('th', { scope: 'col', text: t }); }))]),
          H('tbody', null, APP_SPEC_ROWS.map(function (r) { return H('tr', null, r.map(function (t, i) { return H(i ? 'td' : 'th', i ? { text: t } : { scope: 'row', text: t }); })); })),
        ])]),
        H('p', { class: 'app-spec-note', text: '디자인은 뷰티앱 하나로 통일하고 받기 형식만 나눕니다. 가로 1080 기준(바비톡은 800으로 줄임), 상세는 1080 폭으로 이어 붙인 뒤 16000px·5MB 단위로 나눕니다. 이미지 속 금액은 VAT 포함(시트 vatAfter)이어야 합니다.' }),
      ]);
    }
    function appPreview(it) {
      var root = H('div', { class: 'app-view', 'data-app-view': it.id });
      if (state.locale !== 'KO') {
        state.appView = { itemId: it.id, root: root, frames: [], ready: false, koOnly: true, blocks: null };
        root.appendChild(H('div', { class: 'app-ko-only', role: 'status' }, [
          H('strong', { text: '뷰티앱은 한국어판만 만듭니다.' }),
          H('p', { text: '강남언니·바비톡·여신티켓은 한국어 화면으로 등록합니다. 한국어(KO) 탭에서 확인해 주세요.' }),
          H('button', { type: 'button', class: 'btn small', 'data-action': 'app-to-ko', text: '한국어(KO)로 보기', onclick: function () { selectLocale('KO'); } }),
        ]));
        return root;
      }
      var status = H('p', { class: 'img-dl-status', role: 'status', 'aria-live': 'polite' });
      var note = H('p', { class: 'img-dl-note app-dl-note', text: '뷰티앱 디자인을 확인하는 중…' });
      var av = { itemId: it.id, root: root, frames: [], ready: null, zipBtns: [], note: note, status: status, blocks: {} };
      av.zipBtns = APP_PLATFORMS.map(function (p) { return H('button', { type: 'button', class: 'btn small' + (p.id === 'gangnam' ? ' primary' : ''), 'data-action': 'app-zip-' + p.id, disabled: true, text: p.label + '용 ZIP', onclick: function () { runAppZip(it, p, av); } }); });
      [['thumb', '대표 1:1 · 1080×1080 (바비톡 800×800)'], ['card', '카드 1080×470 · 강남언니 상세 상단'], ['detail', '상세 · 카드를 1080 폭으로 이어 붙인 모습']].forEach(function (b) {
        var body = H('div', { class: 'app-block-body' });
        av.blocks[b[0]] = { el: H('section', { class: 'app-block', 'data-app-block': b[0] }, [H('h4', { class: 'app-block-title', text: b[1] }), body]), body: body, shown: null, frame: null };
      });
      state.appView = av;
      root.appendChild(appSpecPanel());
      root.appendChild(H('div', { class: 'img-download app-download', 'data-app-download': it.id }, [H('div', { class: 'img-dl-row' }, [H('strong', { class: 'img-dl-label', text: '뷰티앱 받기' })].concat(av.zipBtns)), note, status]));
      root.appendChild(H('div', { class: 'app-phone', 'aria-label': '휴대폰 폭 미리보기' }, [H('p', { class: 'app-phone-bar', text: '휴대폰 폭 미리보기 · 대표 → 카드 → 상세' }), av.blocks.thumb.el, av.blocks.card.el, av.blocks.detail.el]));
      if (!hasPage(it)) { av.ready = false; setAppBlocks(av, it); return root; }
      var det = cropFrame(av, it, 'detail');
      av.blocks.detail.frame = det;
      det.el.addEventListener('load', function () { waitAppReady(av, det, it); });
      setAppBlocks(av, it);
      return root;
    }
    function waitAppReady(av, det, it) {
      var t0 = Date.now();
      (function check() {
        if (state.appView !== av) return;
        var idoc = frameDoc(det.el), ok = !!idoc && idoc.documentElement.getAttribute('data-bb-app') === 'ready';
        if (ok || Date.now() - t0 > 1500) { av.ready = ok; setAppBlocks(av, it); layoutCrop(det); return; }
        later(check, 100);
      })();
    }
    function cropFrame(av, it, kind) {
      var f = H('iframe', { class: 'app-frame', src: it.page + '?lang=KO&mode=app' + PAGE_V, title: it.label + ' 뷰티앱 ' + kind, loading: 'eager', scrolling: 'no', tabindex: '-1' });
      var cf = { kind: kind, el: f, itemId: it.id, asset: kind === 'detail' ? null : kind, scale: 1, wrap: null };
      cf.wrap = H('div', { class: 'app-crop', 'data-app-crop': kind }, [f]);
      av.frames.push(cf);
      f.addEventListener('load', function () { layoutCrop(cf); later(function () { layoutCrop(cf); }, 500); });
      return cf;
    }
    function postAppData(cf) {
      var it = itemById(cf.itemId); if (!it) return;
      postTo({ el: cf.el }, { type: 'aptos-data', locale: 'KO', fields: effectiveFields(it, 'KO', store), formats: effectiveFormats(it,'KO',store), layouts: effectiveLayouts(it,'KO',store), editable: false, editMode: false });
    }
    function updateAppView() {
      var av = state.appView; if (!av) return;
      av.frames.forEach(function (cf) { postAppData(cf); layoutCrop(cf); });
      drawBoardPins(av);
    }
    function syncAppView() { var av = state.appView; if (!av || state.mode !== 'app') return; av.frames.forEach(layoutCrop); drawBoardPins(av); }
    function setAppBlocks(av, it) {
      if (!av.blocks || !av.blocks.thumb) return;
      ['thumb', 'card'].forEach(function (k) {
        var b = av.blocks[k], want = av.ready === true ? 'frame' : av.ready === false ? 'missing' : 'wait';
        if (b.shown === want) return;
        b.shown = want;
        if (want === 'frame') { if (!b.frame) b.frame = cropFrame(av, it, k); b.body.replaceChildren(b.frame.wrap); return; }
        if (want === 'wait') { b.body.replaceChildren(H('div', { class: 'app-missing is-wait', 'data-app-missing': k, text: '확인 중…' })); return; }
        var ph = H('div', { class: 'app-missing', 'data-app-missing': k }, [
          H('strong', { text: '뷰티앱 디자인 미구현' }),
          H('span', { text: k === 'thumb' ? '대표 1:1 이미지는 뷰티앱판 제작(2단계)에서 만듭니다.' : '강남언니 카드 1080×470은 뷰티앱판 제작(2단계)에서 만듭니다.' }),
        ]);
        ph.addEventListener('contextmenu', function (e) { onBoardContext(e, ph, k); });
        b.body.replaceChildren(ph);
      });
      var det = av.blocks.detail;
      if (!det.bandHost) { /* built once: moving the iframe in the DOM would reload it */
        det.bandHost = H('div', { class: 'app-band-host' });
        det.body.replaceChildren(det.bandHost, det.frame ? det.frame.wrap : H('div', { class: 'app-missing', 'data-app-missing': 'detail', text: '이 항목은 페이지형 디자인이 아니어서 상세 미리보기가 없습니다.' }));
      }
      var detState = String(av.ready);
      if (det.shown !== detState) {
        det.shown = detState;
        det.bandHost.replaceChildren.apply(det.bandHost, av.ready === false && hasPage(it) ? [H('div', { class: 'app-band', role: 'note', text: '앱용 금액(VAT 포함) 카드 제작 전 · 다운로드 불가' })] : []);
      }
      av.zipBtns.forEach(function (b) { b.disabled = av.ready !== true || !!state.capture; });
      av.note.textContent = av.ready === true
        ? '강남언니: 대표 1080×1080 · 카드 1080×470 · 상세 1080폭 16000px·5MB 단위 / 바비톡: 썸네일 800×800 2MB 이하 · 상세 800폭 5MB 이하 / 여신티켓: 대표 1080×1080 · 상세 1080폭 16000px·5MB 단위. JPEG를 무압축 ZIP 한 개로 받습니다.'
        : av.ready === false ? '다운로드 불가: 이 페이지는 아직 뷰티앱판(앱용 금액 VAT 포함, 대표 1:1, 카드 1080×470)이 없습니다. 준비된 페이지만 받을 수 있습니다.' : '뷰티앱 디자인을 확인하는 중…';
      av.root.setAttribute('data-app-ready', String(av.ready));
      drawBoardPins(av);
    }
    function appFrameOf(src) { var av = state.appView; if (!av || !src) return null; return av.frames.filter(function (f) { return f.el.contentWindow === src; })[0] || null; }
    function detailTargets(idoc, it) {
      var secs = Array.prototype.filter.call(idoc.querySelectorAll('[data-card]'), function (s) { return !s.closest('[data-app-asset]'); });
      if (secs.length) return secs.filter(function (s) {
        var n = Number(s.getAttribute('data-card')), v = s.getAttribute('data-variant') === 'b' ? 'b' : 'a';
        if (VARIANT_SLOTS.indexOf(n) < 0) return v === 'a';
        var want = variantOf(it.id, n); if (want === 'b' && !sectionsFor(idoc, n).b) want = 'a';
        return v === want;
      });
      var p5 = idoc.querySelectorAll(CAP_P5); if (p5.length) return Array.prototype.slice.call(p5);
      var m = idoc.querySelector('main'); return m ? [m] : [];
    }
    /* show only the given elements (and their ancestors) so the cards sit one after another */
    function isolate(idoc, keep) {
      var anc = [];
      keep.forEach(function (el) { for (var p = el.parentElement; p && p !== idoc.documentElement; p = p.parentElement) if (anc.indexOf(p) < 0) anc.push(p); });
      anc.forEach(function (a) {
        for (var c = a.firstElementChild; c; c = c.nextElementSibling) {
          if (anc.indexOf(c) >= 0 || keep.indexOf(c) >= 0) { setHidden(c, false); continue; }
          if (/^(SCRIPT|STYLE|LINK|META|TEMPLATE|NOSCRIPT)$/.test(c.tagName) || c.hasAttribute('data-bb-overlay')) continue;
          setHidden(c, true);
        }
      });
      keep.forEach(function (el) { if (el.parentElement) { el.parentElement.style.setProperty('row-gap', '0px', 'important'); } });
    }
    function layoutCrop(cf) {
      var av = state.appView; if (!av || av.frames.indexOf(cf) < 0) return;
      var idoc = frameDoc(cf.el), it = itemById(cf.itemId); if (!idoc || !it) return;
      var iwin = idoc.defaultView;
      ensureOverlay(idoc, { kind: 'app-' + cf.kind, frame: cf.el, asset: cf.asset });
      var targets;
      if (cf.kind === 'detail') { targets = detailTargets(idoc, it); isolate(idoc, targets); }
      else { var a = idoc.querySelector('[data-app-asset="' + cf.kind + '"]'); targets = a ? [a] : []; }
      targets = targets.filter(function (el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
      if (!targets.length) { cf.wrap.setAttribute('data-empty', '1'); return; }
      cf.wrap.removeAttribute('data-empty');
      var L = Infinity, T = Infinity, R = -Infinity, B = -Infinity;
      targets.forEach(function (el) { var r = el.getBoundingClientRect(); L = Math.min(L, r.left + iwin.scrollX); T = Math.min(T, r.top + iwin.scrollY); R = Math.max(R, r.right + iwin.scrollX); B = Math.max(B, r.bottom + iwin.scrollY); });
      var docH = Math.max(Math.ceil(B) + 2, idoc.documentElement.scrollHeight);
      if (cf.el.style.height !== docH + 'px') cf.el.style.height = docH + 'px';
      var W = cf.wrap.clientWidth || 360, s = W / Math.max(1, R - L);
      var tf = 'translate(' + (-L * s).toFixed(2) + 'px,' + (-T * s).toFixed(2) + 'px) scale(' + s.toFixed(5) + ')';
      if (cf.el.style.transform !== tf) cf.el.style.transform = tf;
      var hh = Math.ceil((B - T) * s) + 'px'; if (cf.wrap.style.height !== hh) cf.wrap.style.height = hh;
      cf.scale = s;
      drawPins(idoc, { kind: 'app-' + cf.kind, asset: cf.asset }, it);
    }
    function drawBoardPins(av) {
      var it = item(); if (!av || !av.blocks || !av.blocks.thumb || !it || it.id !== av.itemId) return;
      ['thumb', 'card'].forEach(function (k) {
        var b = av.blocks[k], ph = b.shown === 'missing' ? b.body.firstChild : null; if (!ph) return;
        var list = viewComments('app').filter(function (c) { return !c.card && commentAsset(c) === k; });
        var old = Array.prototype.slice.call(ph.children || []).filter(function (x) { return x.className && String(x.className).indexOf('board-pin') >= 0; });
        old.forEach(function (x) { ph.removeChild(x); });
        list.forEach(function (c) {
          var color = STATUS_COLOR[c.status] || STATUS_COLOR.open;
          ph.appendChild(H('button', { type: 'button', class: 'board-pin' + (state.cm.active === c.id ? ' on' : ''), 'data-comment-id': c.id, 'data-status': c.status, title: pinTitle(c), style: 'left:' + (c.x * 100).toFixed(3) + '%;top:' + (c.y * 100).toFixed(3) + '%;--pin:' + color + ';background:' + color, text: String(c.seq || '?'), onclick: function (e) { e.stopPropagation(); activateComment(c.id, { fromPin: true }); } }));
        });
      });
    }
    function runAppZip(it, p, av) {
      if (av.ready !== true) { av.status.textContent = '준비된 페이지만 받을 수 있습니다.'; return; }
      if (state.capture) { av.status.textContent = '이미 파일을 만드는 중입니다. 끝난 뒤 다시 눌러 주세요.'; return; }
      av.zipBtns.forEach(function (b) { b.disabled = true; });
      captureApp(it, p, function (m) { av.status.textContent = m; }).then(function (m) { av.status.textContent = m; }, function (e) { av.status.textContent = '받지 못했습니다: ' + (e && e.message || e); })
        .then(function () { av.zipBtns.forEach(function (b) { b.disabled = av.ready !== true; }); });
    }
    function drawWhite(src, w, h, sy, sh) {
      var c = doc.createElement('canvas'); c.width = w; c.height = h;
      var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.imageSmoothingQuality = 'high';
      if (src) g.drawImage(src, 0, sy || 0, src.width, sh || src.height, 0, 0, w, h);
      return c;
    }
    function encodeFit(canvas, maxBytes, qualities) {
      var i = 0;
      return (function next() {
        var q = qualities[i++];
        return capBlob(canvas, 'image/jpeg', q).then(function (b) {
          if (b.size <= maxBytes) return b.arrayBuffer().then(function (ab) { return { ok: true, bytes: new Uint8Array(ab), q: q }; });
          if (i < qualities.length) return next();
          return { ok: false, size: b.size, q: q };
        });
      })();
    }
    function drawPiece(cards, piece, w) {
      var hTotal = piece.reduce(function (s, seg) { return s + seg.h; }, 0), c = doc.createElement('canvas'); c.width = w; c.height = hTotal;
      var g = c.getContext('2d'), y = 0; g.fillStyle = '#fff'; g.fillRect(0, 0, w, hTotal);
      piece.forEach(function (seg) { g.drawImage(cards[seg.i], 0, seg.y, w, seg.h, 0, y, w, seg.h); y += seg.h; });
      return c;
    }
    function encodePieces(cards, p) {
      var queue = planPieces(cards.map(function (c) { return c.height; }), p.maxH), done = [];
      return (function next() {
        if (!queue.length) return Promise.resolve(done);
        var piece = queue.shift(), canvas = drawPiece(cards, piece, p.width), canSplit = piece.length > 1 || piece[0].h >= 400;
        return encodeFit(canvas, p.maxBytes, p.order === 'quality' ? QUALITY_LADDER : [0.92]).then(function (r) {
          if (r.ok) { done.push({ bytes: r.bytes, h: canvas.height }); return next(); }
          if (canSplit) { var halves = splitPiece(piece); queue.unshift(halves[0], halves[1]); return next(); }
          return encodeFit(canvas, p.maxBytes, QUALITY_LADDER).then(function (r2) {
            if (!r2.ok) throw new Error('상세 이미지를 ' + (p.maxBytes / MB) + 'MB 이하로 만들지 못했습니다.');
            done.push({ bytes: r2.bytes, h: canvas.height }); return next();
          });
        });
      })();
    }
    function buildAppFiles(it, p, out) {
      var files = [], find = function (k) { return out.filter(function (o) { return o.key === k; })[0]; };
      var thumb = find('thumb'), card = find('card');
      return encodeFit(drawWhite(thumb.canvas, p.thumb, p.thumb), p.thumbMax, QUALITY_LADDER).then(function (r) {
        if (!r.ok) throw new Error('대표 이미지를 ' + (p.thumbMax / MB) + 'MB 이하로 만들지 못했습니다.');
        files.push({ name: '01_대표_' + p.thumb + 'x' + p.thumb + '.jpg', data: r.bytes });
        if (!p.card) return null;
        return encodeFit(drawWhite(card.canvas, 1080, 470), p.maxBytes, QUALITY_LADDER).then(function (r2) {
          if (!r2.ok) throw new Error('카드 이미지를 ' + (p.maxBytes / MB) + 'MB 이하로 만들지 못했습니다.');
          files.push({ name: '02_카드_1080x470.jpg', data: r2.bytes });
        });
      }).then(function () {
        var cards = out.filter(function (o) { return o.key === 'detail'; }).map(function (o) { return drawWhite(o.canvas, p.width, Math.round(o.canvas.height * p.width / o.canvas.width)); });
        return encodePieces(cards, p);
      }).then(function (pieces) {
        var lead = p.card ? '03' : '02';
        pieces.forEach(function (pc, i) { files.push({ name: lead + '_상세_' + String(i + 1).padStart(2, '0') + '_' + p.width + 'x' + pc.h + '.jpg', data: pc.bytes }); });
        return files;
      });
    }
    function captureApp(it, p, progress) {
      var win = doc.defaultView, locale = 'KO', prevSel = CAP.sel, prevN = CAP.n;
      var cap = state.capture = { itemId: it.id, locale: locale, el: null, fields: null };
      var finish = function () { CAP.sel = prevSel; CAP.n = prevN; if (cap.el && cap.el.parentNode) cap.el.parentNode.removeChild(cap.el); if (state.capture === cap) state.capture = null; };
      progress('최신 문구를 확인하는 중…');
      return refreshForCapture().then(function () {
        if (!store.online || store.status !== 'ready') throw new Error('서버에 연결되지 않아 최신 문구를 확인할 수 없습니다. 연결된 뒤 다시 눌러 주세요.');
        cap.fields = effectiveFields(it, locale, store);
        progress('뷰티앱 페이지를 준비하는 중…');
        return new Promise(function (resolve, reject) {
          var f = doc.createElement('iframe');
          f.setAttribute('aria-hidden', 'true'); f.setAttribute('tabindex', '-1'); f.setAttribute('title', 'app capture');
          f.style.cssText = 'position:fixed;left:0;top:0;width:' + CAP.frameW + 'px;height:1600px;border:0;opacity:0;pointer-events:none;z-index:-1;';
          var t = win.setTimeout(function () { reject(new Error('페이지를 불러오지 못했습니다.')); }, 30000);
          f.addEventListener('load', function () { win.clearTimeout(t); resolve(); });
          f.src = it.page + '?lang=KO&mode=app' + PAGE_V + '&capture=1';
          cap.el = f; doc.body.appendChild(f);
        });
      }).then(function () {
        capPost(cap);
        return capApplied(cap, it, locale);
      }).then(function () {
        var idoc = cap.el.contentDocument;
        if (idoc.documentElement.getAttribute('data-bb-app') !== 'ready') throw new Error('이 페이지는 뷰티앱 디자인이 아직 없습니다 (다운로드 불가).');
        applyVariantsToDoc(idoc, it, true);
        CAP.sel = '[data-card],[data-app-asset]';
        progress('사진과 글꼴을 준비하는 중…');
        return capPrepare(cap);
      }).then(function (fontCss) {
        var iwin = cap.el.contentWindow, idoc = iwin.document, lang = idoc.documentElement.getAttribute('lang');
        var thumb = idoc.querySelector('[data-app-asset="thumb"]'), card = idoc.querySelector('[data-app-asset="card"]');
        var size = function (el) { var r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
        var near = function (a, b) { return Math.abs(a - b) <= 1; };
        if (!thumb) throw new Error('대표 이미지([data-app-asset="thumb"])를 찾지 못했습니다.');
        var ts = size(thumb); if (!near(ts.w, 1080) || !near(ts.h, 1080)) throw new Error('대표 이미지 크기가 ' + ts.w + '×' + ts.h + '입니다 (1080×1080 필요).');
        if (p.card) { if (!card) throw new Error('카드 이미지([data-app-asset="card"])를 찾지 못했습니다.'); var cs = size(card); if (!near(cs.w, 1080) || !near(cs.h, 470)) throw new Error('카드 이미지 크기가 ' + cs.w + '×' + cs.h + '입니다 (1080×470 필요).'); }
        var details = Array.prototype.filter.call(idoc.querySelectorAll('[data-card]'), function (s) { var r = s.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !s.closest('[data-app-asset]'); });
        if (!details.length) throw new Error('상세 카드([data-card])를 찾지 못했습니다.');
        details.forEach(function (s) { var z = size(s); if (!near(z.w, 1080)) throw new Error(s.getAttribute('data-card') + '장 폭이 ' + z.w + 'px입니다 (1080 필요).'); });
        var jobs = [{ key: 'thumb', el: thumb }].concat(p.card ? [{ key: 'card', el: card }] : []).concat(details.map(function (el) { return { key: 'detail', el: el }; }));
        var out = [], chain = Promise.resolve();
        jobs.forEach(function (j, i) {
          chain = chain.then(function () {
            progress('이미지를 만드는 중 ' + (i + 1) + '/' + jobs.length + '…');
            if (lang && !j.el.getAttribute('lang')) j.el.setAttribute('lang', lang);
            freezeColumns(iwin, j.el); return iwin.modernScreenshot.domToCanvas(j.el, { scale: 1, font: { cssText: fontCss } }).then(function (c) { out.push({ key: j.key, canvas: c }); });
          });
        });
        return chain.then(function () { return out; });
      }).then(function (out) {
        progress(p.label + ' 규격으로 맞추는 중…');
        return buildAppFiles(it, p, out);
      }).then(function (files) {
        var zip = zipStore(files);
        env.downloadBlob(new Blob([zip], { type: 'application/zip' }), safeBase(it) + '_KO_' + p.label + '.zip');
        return p.label + '용 ZIP을 받았습니다: ' + files.length + '개 파일 (' + files.map(function (f) { return f.name; }).join(', ') + ')';
      }).then(function (m) { finish(); return m; }, function (e) { finish(); throw e; });
    }

    /* ---- polling ---- */
    function tick() {
      if (doc.hidden) return Promise.resolve();
      var prev = store.status;
      var skip = state.editor ? [state.editor.key] : [];
      if(state.aptos&&state.aptos.editing)skip.push(state.aptos.editing.key);
      return store.refresh({ skipKeys: skip }).then(function (changed) {
        renderStatus();
        if (changed.length || prev !== store.status) { renderSidebar(); renderPreview(); }
      }).then(function () { return refreshComments(); });
    }

    /* ---- start ---- */
    function pickInitial() {
      var hm = parseHash((env.location && env.location.hash) || '');
      var m = hm && [null, hm.item, hm.locale];
      if (hm) state.mode = hm.mode;
      var it = m && state.data.items.filter(function (i) { return i.id === m[1] && !store.isDeleted(i.id); })[0];
      var loc = m && state.data.locales.filter(function (l) { return l.id === m[2]; })[0];
      /* without a link to a specific item, open the first item of the first group that is not folded */
      var visible = visibleItems();
      var open = !it && visibleGroups().filter(function (x) { return !isFolded(x.g); }).map(function (x) { return x.items[0]; }).filter(Boolean)[0];
      state.itemId = (it || open || visible[0] || {}).id || null;
      if (it) unfoldFor(it.id);
      state.locale = (loc || state.data.locales[0]).id;
    }

    function start() {
      buildShell(); renderStatus();
      if (env.addMessageListener) env.addMessageListener(onMessage);
      return env.fetch((env.baseUrl || '') + 'data.json', { cache: 'no-store' }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }).then(function (data) { return { data: data }; }, function (e) { return { error: e && e.message || String(e) }; })
        .then(function (r) {
          if (r.error) { state.fatal = 'data.json을 불러오지 못했습니다 (' + r.error + ').'; renderErrors(); renderStatus(); return; }
          state.errors = validateData(r.data);
          if (!Array.isArray(r.data && r.data.locales) || !r.data.locales.length || !Array.isArray(r.data.items) || !r.data.items.length) {
            state.fatal = 'data.json을 사용할 수 없습니다.'; renderErrors(); return;
          }
          state.data = r.data; pickInitial();
          renderAll();
          return store.load().then(function () {
            renderAll(); state.started = true;
            (env.setInterval || setInterval)(tick, POLL_MS);
            startViewTimer();
            return refreshComments();
          });
        });
    }

    return { start: start, store: store, state: state, tick: tick };
  }

  /* ------------------------------------------------------------ browser boot */
  function boot(win) {
    var doc = win.document;
    var memory = {};
    var storage;
    try { win.localStorage.getItem(AUTHOR_KEY); storage = win.localStorage; } catch (e) {
      storage = { getItem: function (k) { return k in memory ? memory[k] : null; }, setItem: function (k, v) { memory[k] = String(v); } };
    }
    var session = null;
    try { win.sessionStorage.getItem('bb-review-undo-v1'); session = win.sessionStorage; } catch (e) { session = null; }
    var apiOverride = apiFromSearch(win.location && win.location.search);
    var app = createApp({
      document: doc, root: doc.getElementById('app'),
      fetch: win.fetch.bind(win), api: apiOverride || win.REVIEW_API || DEFAULT_API, apiOverride: apiOverride, storage: storage, session: session, location: win.location,
      replaceHash: function (hash) { try { win.history.replaceState(null, '', hash); } catch (e) { /* ignore */ } },
      addMessageListener: function (fn) { win.addEventListener('message', fn); },
      setInterval: function (fn, ms) { return win.setInterval(fn, ms); },
      setTimeout: function (fn, ms) { return win.setTimeout(fn, ms); }, clearTimeout: function (t) { win.clearTimeout(t); },
      download: function (text, name) {
        var url = win.URL.createObjectURL(new win.Blob([text], { type: 'application/json' }));
        var a = doc.createElement('a'); a.href = url; a.download = name; doc.body.appendChild(a); a.click(); doc.body.removeChild(a);
        win.setTimeout(function () { win.URL.revokeObjectURL(url); }, 1000);
      },
      downloadBlob: function (blob, name) {
        var url = win.URL.createObjectURL(blob);
        var a = doc.createElement('a'); a.href = url; a.download = name; doc.body.appendChild(a); a.click(); doc.body.removeChild(a);
        win.setTimeout(function () { win.URL.revokeObjectURL(url); }, 60000);
      },
    });
    win.__reviewApp = app;
    app.start();
    return app;
  }

  return {
    DEFAULT_API: DEFAULT_API, MAX_LEN: MAX_LEN, POLL_MS: POLL_MS,
    cellKey: cellKey, selectedKey: selectedKey, fieldKind: fieldKind, isMultiline: isMultiline,
    collectNumbered: collectNumbered, collectOffers: collectOffers, validateData: validateData,
    createStore: createStore, effectiveFields: effectiveFields, effectiveFormats: effectiveFormats, buildExport: buildExport,
    createApp: createApp, a4Layout: a4Layout, sheetLayout: sheetLayout, PAPERS: PAPERS, boot: boot,
    BOARD_V: BOARD_V, variantKey: variantKey, parseHash: parseHash, apiFromSearch: apiFromSearch, zipStore: zipStore, crc32: crc32,
    planPieces: planPieces, splitPiece: splitPiece, fitLong: fitLong, imagePlan: imagePlan, commentCounts: commentCounts, cardLabel: cardLabel, clampTarget: clampTarget,
    createCommentApi: createCommentApi, APP_PLATFORMS: APP_PLATFORMS, STATUS_COLOR: STATUS_COLOR,
  };
});
