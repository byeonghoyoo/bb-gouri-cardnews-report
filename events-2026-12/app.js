(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.ReviewApp = api;
    if (root.document && !root.__REVIEW_NO_AUTOSTART) api.boot(root);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------ constants */
  var DEFAULT_API = 'https://bb-event-review-sync.beautyblossom.workers.dev';
  var HEADER_NAME = 'X-BB-Review';
  var HEADER_VALUE = 'event-review-2026';
  var MAX_LEN = 2000;
  var POLL_MS = 15000;
  var AUTHOR_KEY = 'bb-review-author';
  var FOLD_KEY = 'bb-review-folded';
  var EXPECTED_ITEMS = ['aptos', 'D1', 'D2', 'D3', 'D4', 'D5', 'EXAM'];
  var PLAN_REQUIRED = ['heroEyebrow', 'title', 'subtitle', 'body'];
  var FIELD_RE = /^[A-Za-z0-9_]+$/;
  var ID_RE = /^[A-Za-z0-9]+$/;
  var LOCALE_RE = /^[A-Z]{2}$/;

  /* ------------------------------------------------------------ pure helpers */
  function cellKey(itemId, locale, field) { return itemId + '.' + locale + '.' + field; }
  function selectedKey(itemId, locale) { return cellKey(itemId, locale, 'selected'); }

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
      status: 'loading', online: true, cells: {}, error: null, lastSync: null,
      canEdit: function () { return store.status === 'ready'; },
      get: function (k) { return store.cells[k]; },
      value: function (k, def) { var c = store.cells[k]; return c && typeof c.value === 'string' ? c.value : def; },
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
        return body.cells;
      });
    }

    store.load = function () {
      return fetchState().then(function (cells) {
        store.cells = cells; store.status = 'ready'; store.online = true; store.error = null; store.lastSync = new Date();
        return true;
      }, function (e) { store.status = 'error'; store.error = e && e.message || String(e); return false; });
    };

    store.refresh = function (o) {
      var skip = (o && o.skipKeys) || [];
      return fetchState().then(function (remote) {
        var changed = [];
        Object.keys(remote).forEach(function (k) {
          if (skip.indexOf(k) >= 0) return;
          var old = store.cells[k];
          if (!old || old.revision !== remote[k].revision || old.value !== remote[k].value) { store.cells[k] = remote[k]; changed.push(k); }
        });
        store.status = 'ready'; store.online = true; store.error = null; store.lastSync = new Date();
        return changed;
      }, function () { store.online = false; return []; });
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

  function effectiveFields(item, locale, store) {
    var out = {}; var f = (item.fields && item.fields[locale]) || {};
    Object.keys(f).forEach(function (k) { out[k] = store.value(cellKey(item.id, locale, k), f[k]); });
    return out;
  }

  function hasLocale(item, locale) { return !Array.isArray(item.locales) || item.locales.indexOf(locale) >= 0; }

  function buildExport(data, store) {
    return {
      items: data.items.map(function (item) {
        var locales = {};
        data.locales.forEach(function (l) {
          if (!hasLocale(item, l.id)) return;
          locales[l.id] = { selected: store.isSelected(item.id, l.id), fields: effectiveFields(item, l.id, store) };
        });
        return { id: item.id, label: item.label, kind: item.kind, locales: locales };
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
    };
    var ui = {};

    try { state.author = (env.storage && env.storage.getItem(AUTHOR_KEY)) || ''; } catch (e) { state.author = ''; }

    function by() { return state.author || '익명'; }
    function item() { return state.data && state.data.items.filter(function (i) { return i.id === state.itemId; })[0]; }
    function localeObj(id) { return state.data.locales.filter(function (l) { return l.id === id; })[0]; }
    function origin() { return (env.location && env.location.origin) || ''; }

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
      var authorInput = H('input', { class: 'author-input', type: 'text', maxlength: '40', placeholder: '이름 (표시용)', value: state.author, 'aria-label': '작성자 이름' });
      var saveAuthor = function () {
        state.author = String(authorInput.value || '').trim().slice(0, 40);
        try { env.storage.setItem(AUTHOR_KEY, state.author); } catch (e) { /* convenience only */ }
      };
      authorInput.addEventListener('input', saveAuthor); authorInput.addEventListener('change', saveAuthor);
      var app = H('div', { class: 'app' }, [
        H('header', { class: 'topbar' }, [
          H('div', { class: 'brand' }, [
            H('h1', { text: '12월 이벤트 · 수능 이벤트 검토' }),
            H('p', { class: 'brand-sub', text: '공유 검토 모드: 이 링크를 가진 사람은 누구나 선택과 문구를 수정할 수 있습니다. 병원 사이트와 연동되지 않습니다.' }),
          ]),
          H('div', { class: 'topbar-tools' }, [
            H('label', { class: 'author' }, [H('span', { text: '작성자' }), authorInput]),
            H('p', { class: 'author-note', text: '이름은 저장 기록에 표시만 되며 인증이 아닙니다.' }),
            H('button', { type: 'button', class: 'btn', 'data-action': 'toggle-edit-mode', 'aria-pressed': 'false', text: '편집 모드', onclick: function (e) {
              var on = ui.app.className.split(/\s+/).indexOf('edit-mode') < 0;
              ui.app.className = on ? 'app edit-mode' : 'app';
              e.target.setAttribute('aria-pressed', on ? 'true' : 'false');
              postAptosData();
            } }),
            H('button', { type: 'button', class: 'btn', 'data-action': 'download-json', text: '현재 문구 JSON 받기', onclick: downloadJson }),
          ]),
        ]),
        H('section', { class: 'statusbar' }, [ui.status, ui.summary]),
        ui.errors,
        ui.tabs,
        H('div', { class: 'layout' }, [H('aside', { class: 'sidebar' }, [ui.sideTitle, ui.list]), ui.preview]),
        ui.toast,
      ]);
      ui.app = app;
      env.root.replaceChildren(app);
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

    function renderSidebar() {
      var loc = state.locale;
      ui.sideTitle.textContent = '검토 항목 ' + state.data.items.length + '개';
      var groups = groupsOf();
      if (!groups.length) { ui.list.replaceChildren.apply(ui.list, state.data.items.map(itemRow)); return; }
      var byId = {}, used = {}, out = [];
      state.data.items.forEach(function (it) { byId[it.id] = it; });
      groups.forEach(function (g) {
        var members = g.items.map(function (id) { used[id] = true; return byId[id]; }).filter(Boolean);
        if (!members.length) return;
        var folded = isFolded(g);
        var selCount = members.filter(function (it) { return store.isSelected(it.id, loc); }).length;
        out.push(H('li', { class: 'group-row' + (folded ? ' folded' : '') }, [
          H('button', { type: 'button', class: 'group-btn', 'data-group-id': g.id, 'aria-expanded': folded ? 'false' : 'true', onclick: function () { toggleGroup(g); } }, [
            H('span', { class: 'group-chev', 'aria-hidden': 'true', text: folded ? '▶' : '▼' }),
            g.test === true ? H('span', { class: 'group-test', text: '테스트 구간' }) : null,
            H('span', { class: 'group-label', text: g.label || g.id }),
            H('span', { class: 'group-count', text: members.length + '개' + (selCount ? ' · 선택 ' + selCount : '') + (folded ? ' · 접힘' : '') }),
          ]),
        ]));
        if (!folded) members.forEach(function (it) { out.push(itemRow(it)); });
      });
      state.data.items.forEach(function (it) { if (!used[it.id]) out.push(itemRow(it)); });
      ui.list.replaceChildren.apply(ui.list, out);
    }

    function itemRow(it) {
        var loc = state.locale;
        var sel = store.isSelected(it.id, loc);
        var errs = itemErrorCount(it.id);
        return H('li', { class: 'item-row' + (it.id === state.itemId ? ' current' : '') + (sel ? ' selected' : '') }, [
          H('input', { type: 'checkbox', class: 'select-box', 'data-select-for': it.id, 'aria-label': it.label + ' 선택 (' + loc + ')', checked: sel, disabled: !store.canEdit(), onchange: function (e) { onSelectChange(it.id, loc, !!e.target.checked); } }),
          H('button', { type: 'button', class: 'item-btn', 'data-item-id': it.id, 'aria-current': it.id === state.itemId ? 'true' : null, onclick: function () { selectItem(it.id); } }, [
            H('span', { class: 'item-label', text: it.label }),
            isTestItem(it.id) ? H('span', { class: 'kind-tag kind-test', text: '테스트' }) : H('span', { class: 'kind-tag kind-' + it.kind, text: it.kind === 'plan' ? '기획' : '완성' }),
            errs ? H('span', { class: 'err-tag', text: '오류 ' + errs }) : null,
          ]),
        ]);
    }

    /* ---- navigation ---- */
    function canNavigate() {
      /* in-place editing pages save on blur, and their late save message is still handled after the page changes (state.frames) */
      if(state.aptos && state.aptos.editing && !state.aptos.inline){toast('압토스 수정창을 먼저 저장하거나 닫아 주세요.','error');return false;}
      var ed = state.editor;
      if (ed && (ed.draft !== ed.original || ed.status !== 'idle')) { toast('수정 중인 내용을 먼저 저장하거나 취소해 주세요.', 'error'); return false; }
      state.editor = null; return true;
    }
    function pushHash() { if (env.replaceHash) env.replaceHash('#' + state.itemId + '/' + state.locale); }
    function selectItem(id) { if (id === state.itemId || !canNavigate()) return; state.itemId = id; unfoldFor(id); pushHash(); renderAll(); }
    function selectLocale(id) { if (id === state.locale || !canNavigate()) return; state.locale = id; pushHash(); renderAll(); }
    function renderAll() { renderErrors(); renderTabs(); renderSidebar(); renderPreview(); renderStatus(); }

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
        if (r.ok) toast('선택이 서버에 저장되었습니다.', 'ok');
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
        if (r.ok) { state.editor = null; toast('서버에 저장되었습니다.', 'ok'); }
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
          H('h2', { class: 'preview-title', text: it.label + ' · ' + state.locale }),
          isTestItem(it.id) ? H('p', { class: 'test-note', text: '테스트 구간 항목입니다. 연습용으로 만든 랜딩 7종(수능 포함)이며 실제 진행 작업과 구분됩니다.' }) : null,
        ]),
        H('label', { class: 'preview-select' }, [cb, H('span', { text: state.locale + ' 언어판 선택' })]),
      ]);
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
      var frame = H('iframe', { class: 'aptos-frame', src: ownPage ? it.page + '?lang=' + encodeURIComponent(state.locale) + '&v=20261029-v3o' : (it.kind === 'aptos' ? 'aptos/index.html?lang=' + encodeURIComponent(state.locale) : 'landings/index.html?item=' + encodeURIComponent(it.id) + '&lang=' + encodeURIComponent(state.locale)) + '&v=20261029-edit1', title: it.label + ' ' + state.locale + ' 완성 디자인', loading: 'eager' });
      state.aptos = { el: frame, itemId: it.id, locale: state.locale, win: null, editing: null, inline: false };
      state.frames.push(state.aptos); if (state.frames.length > 6) state.frames.shift();
      return H('div', { class: 'aptos-shell' }, [
        H('p', { class: 'aptos-note', text: typeof it.note === 'string' && it.note ? it.note : it.kind === 'aptos' ? '글자를 누르면 바로 고칠 수 있고, Enter를 누르거나 다른 곳을 누르면 공유 저장됩니다(Esc는 취소). 원문의 ‘최대 49%’ 배지는 표시 가격과 계산이 맞지 않아 확인이 필요합니다. 기존 행사 기간은 10/21~11/30입니다.' : '검토용 디자인입니다. 글자를 누르면 바로 고칠 수 있고, Enter를 누르거나 다른 곳을 누르면 공유 저장됩니다(Esc는 취소). 행사 가격·기간·적용 조건은 최종 확인 대상입니다.' }),
        frame,
      ]);
    }

    function renderPreview() {
      var it = item();
      if (!it) return;
      var key = it.id + '/' + state.locale;
      var ed0 = state.editor;
      if (ed0 && ed0.ta) { ed0.selStart = ed0.ta.selectionStart; ed0.selEnd = ed0.ta.selectionEnd; ed0.hadFocus = doc.activeElement === ed0.ta; }
      if ((it.kind === 'aptos' || it.kind === 'landing') && state.previewKey === key && state.aptos && state.aptos.el.parentNode) {
        if (state.previewCb) { state.previewCb.checked = store.isSelected(it.id, state.locale); state.previewCb.disabled = !store.canEdit(); }
        postAptosData();
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
      ui.preview.replaceChildren.apply(ui.preview, [previewHead(it), bar, body].filter(Boolean));
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
      postToFrame({ type: 'aptos-data', locale: a.locale, fields: effectiveFields(it, a.locale, store), editable: store.canEdit(), editMode: ui.app.className.split(/\s+/).indexOf('edit-mode') >= 0 });
    }
    function onMessage(e) {
      var cap = state.capture;
      if (cap && cap.el && e.source === cap.el.contentWindow) {
        if (e.origin === origin() && isObj(e.data) && e.data.type === 'aptos-ready' && cap.fields) capPost(cap);
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
      if (d.type === 'aptos-size' && Number.isFinite(d.height) && d.height >= 300 && d.height <= 25000) a.el.style.height = Math.ceil(d.height) + 'px';
      else if (d.type === 'aptos-ready') postAptosData();
      else if(d.type==='aptos-editing' && typeof d.field==='string'){var k=cellKey(a.itemId,a.locale,d.field);var c=store.get(k);a.editing={field:d.field,key:k,baseRevision:c?c.revision:0};}
      else if(d.type==='aptos-edit-cancel'){a.editing=null;}
      else if (d.type === 'aptos-edit') handleAptosEdit(a, d);
    }
    function handleAptosEdit(a, d) {
      var it = state.data.items.filter(function (i) { return i.id === a.itemId; })[0];
      var live = a === state.aptos;
      var ack = function (ok, error) {
        var m = { type: 'aptos-save-result', field: typeof d.field === 'string' ? d.field : '', ok: ok };
        if (error) m.error = error;
        postTo(a, m);
      };
      var defs = it && it.fields[a.locale];
      if (!defs || typeof d.field !== 'string' || !Object.prototype.hasOwnProperty.call(defs, d.field) || typeof d.value !== 'string') { if (live) postAptosData(); ack(false, '알 수 없는 필드이거나 값 형식이 올바르지 않습니다.'); return Promise.resolve(); }
      if (d.value.length > MAX_LEN) { if (live) postAptosData(); ack(false, '2000자를 넘어 저장할 수 없습니다.'); return Promise.resolve(); }
      var key = cellKey(it.id, a.locale, d.field);
      state.saving++; renderStatus();
      return store.save(key, d.value, by(), a.editing && a.editing.field===d.field ? {baseRevision: a.editing.baseRevision} : {}).then(function (r) {
        state.saving--;
        if (r.ok) {if(!a.inline||(a.editing&&a.editing.field===d.field))a.editing=null;toast('서버에 저장되었습니다.', 'ok');}
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
    var CAP_ITEMS = { OXM12: true, APT12: true, FV12: true, HH12: true };
    var CAP_P5 = 'section.p1,section.p2,section.p3,section.p4,section.p5';
    var CAP = { items: CAP_ITEMS, sel: CAP_P5, n: 5, w: 1080, h: 1350, frameW: 1440, lib: 'vendor/modern-screenshot-4.7.0.js' };
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

    function downloadBar(it) {
      var spec = capSpec(it); if (!spec || !env.downloadBlob) return null;
      var nums1 = []; for (var q = 1; q <= spec.n; q++) nums1.push(q);
      var status = H('p', { class: 'img-dl-status', role: 'status', 'aria-live': 'polite' });
      var buttons = [];
      var btn = function (text, action, nums, mode, cls) {
        var b = H('button', { type: 'button', class: 'btn small' + (cls ? ' ' + cls : ''), 'data-action': action, text: text, onclick: function () { run(nums, mode); } });
        buttons.push(b); return b;
      };
      function run(nums, mode) {
        if (state.capture) { status.textContent = '이미 이미지를 만드는 중입니다. 끝난 뒤 다시 눌러 주세요.'; return; }
        buttons.forEach(function (b) { b.disabled = true; });
        captureCards(it, state.locale, nums, mode, function (m) { status.textContent = m; }).then(function (msg) {
          status.textContent = msg;
        }, function (e) {
          status.textContent = '받지 못했습니다: ' + (e && e.message || e);
        }).then(function () { buttons.forEach(function (b) { b.disabled = false; }); });
      }
      return H('div', { class: 'img-download', 'data-img-download': it.id }, [
        H('div', { class: 'img-dl-row' }, [
          H('strong', { class: 'img-dl-label', text: '이미지 받기' }),
          H('span', { class: 'img-dl-group', role: 'group', 'aria-label': '장별로 받기' }, nums1.map(function (n) {
            return btn(n + '장', 'img-card-' + n, [n], 'single');
          }).concat([btn(spec.n + '장 모두 따로', 'img-cards-all', nums1, 'single')])),
          btn(spec.n + '장 이어서 길게 1장', 'img-long', nums1, 'long', 'primary'),
        ]),
        H('p', { class: 'img-dl-note', text: '서버에 저장된 지금 문구 그대로 받습니다. 장별은 1080×1350, 길게는 1080×' + (1350 * spec.n) + ' PNG입니다.' }),
        status,
      ]);
    }

    function capWait(win, ms) { return new Promise(function (r) { win.setTimeout(r, ms); }); }
    function capPost(cap) { postTo(cap, { type: 'aptos-data', locale: cap.locale, fields: cap.fields, editable: false, editMode: false }); }
    function capBlob(canvas) {
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (b) { if (b) resolve(b); else reject(new Error('PNG를 만들지 못했습니다.')); }, 'image/png');
      });
    }

    function captureCards(it, locale, nums, mode, progress) {
      var spec = capSpec(it) || { sel: CAP_P5, n: 5 }; CAP.sel = spec.sel; CAP.n = spec.n;
      var win = doc.defaultView;
      var cap = state.capture = { itemId: it.id, locale: locale, el: null, fields: null };
      var finish = function () { if (cap.el && cap.el.parentNode) cap.el.parentNode.removeChild(cap.el); if (state.capture === cap) state.capture = null; };
      progress('최신 문구를 확인하는 중…');
      return store.refresh().then(function () {
        if (!store.online || store.status !== 'ready') throw new Error('서버에 연결되지 않아 최신 문구를 확인할 수 없습니다. 연결된 뒤 다시 눌러 주세요.');
        cap.fields = effectiveFields(it, locale, store);
        progress('페이지를 준비하는 중…');
        return new Promise(function (resolve, reject) {
          var f = doc.createElement('iframe');
          f.setAttribute('aria-hidden', 'true'); f.setAttribute('tabindex', '-1'); f.setAttribute('title', 'image capture');
          f.style.cssText = 'position:fixed;left:0;top:0;width:' + CAP.frameW + 'px;height:1600px;border:0;opacity:0;pointer-events:none;z-index:-1;';
          var t = win.setTimeout(function () { reject(new Error('페이지를 불러오지 못했습니다.')); }, 30000);
          f.addEventListener('load', function () { win.clearTimeout(t); resolve(); });
          f.src = it.page + '?lang=' + encodeURIComponent(locale) + '&v=20261029-v3o' + '&capture=1';
          cap.el = f; doc.body.appendChild(f);
        });
      }).then(function () {
        capPost(cap);
        return capApplied(cap, it, locale);
      }).then(function () {
        progress('사진과 글꼴을 준비하는 중…');
        return capPrepare(cap);
      }).then(function (fontCss) {
        var iwin = cap.el.contentWindow, cards = iwin.document.querySelectorAll(CAP.sel), out = [], chain = Promise.resolve();
        if (state.lastCapture) { state.lastCapture.fontKB = Math.round(fontCss.length / 1024); state.lastCapture.fontFaces = (fontCss.match(/@font-face/g) || []).length; }
        if (cards.length !== CAP.n) throw new Error('카드 ' + CAP.n + '장을 찾지 못했습니다 (' + cards.length + '장).');
        nums.forEach(function (n, i) {
          chain = chain.then(function () {
            var card = cards[n - 1], r = card.getBoundingClientRect();
            if (Math.abs(r.width - CAP.w) > 1 || Math.abs(r.height - CAP.h) > 1) throw new Error(n + '장 크기가 ' + Math.round(r.width) + '×' + Math.round(r.height) + '입니다.');
            progress('이미지를 만드는 중 ' + (i + 1) + '/' + nums.length + '…');
            /* the card is drawn on its own, so give it the page language: CJK fallback fonts and line breaking follow lang */
            var lang = iwin.document.documentElement.getAttribute('lang');
            if (lang && !card.getAttribute('lang')) card.setAttribute('lang', lang);
            return iwin.modernScreenshot.domToCanvas(card, { scale: 1, font: { cssText: fontCss } }).then(function (c) { out.push({ n: n, canvas: c }); });
          });
        });
        return chain.then(function () { return out; });
      }).then(function (out) {
        progress('파일로 저장하는 중…');
        if (mode === 'long') {
          var big = doc.createElement('canvas'); big.width = CAP.w; big.height = CAP.h * out.length;
          var g = big.getContext('2d');
          out.forEach(function (o, i) { g.drawImage(o.canvas, 0, i * CAP.h, CAP.w, CAP.h); });
          return capBlob(big).then(function (b) {
            env.downloadBlob(b, capName(it, locale, '전체'));
            return '받았습니다: ' + out.length + '장을 이어 붙인 1장 (' + CAP.w + '×' + big.height + ')';
          });
        }
        var chain = Promise.resolve();
        out.forEach(function (o, i) {
          chain = chain.then(function () {
            var c = doc.createElement('canvas'); c.width = CAP.w; c.height = CAP.h;
            c.getContext('2d').drawImage(o.canvas, 0, 0, CAP.w, CAP.h);
            return capBlob(c).then(function (b) { env.downloadBlob(b, capName(it, locale, o.n + '장')); return i < out.length - 1 ? capWait(win, 400) : null; });
          });
        });
        return chain.then(function () { return '받았습니다: ' + out.map(function (o) { return o.n + '장'; }).join(', ') + ' (각 ' + CAP.w + '×' + CAP.h + ')'; });
      }).then(function (msg) { finish(); return msg; }, function (e) { finish(); throw e; });
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
          if (hay && !missing.length && Date.now() - started > 500) { resolve(); return; }
          if (Date.now() - started > 10000) { reject(new Error('저장된 문구가 화면에 반영되지 않았습니다 (' + missing.map(function (m) { return m.field; }).join(', ') + ').')); return; }
          win.setTimeout(check, 150);
        })();
      });
    }

    /* load every image eagerly at its current choice, wait for fonts, load the capture tool, build the font CSS */
    function capPrepare(cap) {
      var iwin = cap.el.contentWindow, idoc = iwin.document;
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

    /* ---- polling ---- */
    function tick() {
      if (doc.hidden) return Promise.resolve();
      var prev = store.status;
      var skip = state.editor ? [state.editor.key] : [];
      if(state.aptos&&state.aptos.editing)skip.push(state.aptos.editing.key);
      return store.refresh({ skipKeys: skip }).then(function (changed) {
        renderStatus();
        if (changed.length || prev !== store.status) { renderSidebar(); renderPreview(); }
      });
    }

    /* ---- start ---- */
    function pickInitial() {
      var m = /^#?([A-Za-z0-9]+)\/([A-Z]{2})$/.exec((env.location && env.location.hash) || '');
      var it = m && state.data.items.filter(function (i) { return i.id === m[1]; })[0];
      var loc = m && state.data.locales.filter(function (l) { return l.id === m[2]; })[0];
      /* without a link to a specific item, open the first item of the first group that is not folded */
      var open = !it && groupsOf().filter(function (g) { return !isFolded(g); }).map(function (g) { return state.data.items.filter(function (i) { return g.items.indexOf(i.id) >= 0; })[0]; }).filter(Boolean)[0];
      state.itemId = (it || open || state.data.items[0]).id;
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
    var app = createApp({
      document: doc, root: doc.getElementById('app'),
      fetch: win.fetch.bind(win), api: win.REVIEW_API || DEFAULT_API, storage: storage, location: win.location,
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
    createStore: createStore, effectiveFields: effectiveFields, buildExport: buildExport,
    createApp: createApp, boot: boot,
  };
});
