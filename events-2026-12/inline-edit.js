/* In-place editing for the review board's page iframes (aptos-* protocol shared by EXAM, Aptos and D1~D5).
   Tap or click any copy and the caret lands right there. One-line copy saves with Enter, multi-line copy saves when
   you tap elsewhere (Ctrl+Enter also works), Esc restores the saved text. Saving still goes through the board to the
   shared server exactly like the old dialog; a page loaded without this file keeps its dialog. */
(function (global) {
  'use strict';
  var TIP_ONE = '눌러서 바로 수정 · Enter 저장 · Esc 취소';
  var TIP_MULTI = '눌러서 바로 수정 · 다른 곳을 누르면 저장 · Esc 취소';
  var MAX_LEN = 2000;
  var CSS = 'html.bb-inline [data-inline]{cursor:text;-webkit-user-select:text;user-select:text}'
    + 'html.bb-inline [data-inline]:hover{outline:2px solid rgba(47,107,255,.45);outline-offset:3px}'
    + 'html.bb-inline [data-inline]:focus{outline:2px solid #2f6bff;outline-offset:3px}'
    + '[data-inline].bb-ml{white-space:pre-wrap!important}'
    + '[data-inline].bb-saving{outline:2px dashed #2f6bff!important;outline-offset:3px}'
    + '[data-inline].bb-saved{outline:2px solid #16a34a!important;outline-offset:3px}'
    + '[data-inline].bb-error{outline:2px dashed #dc2626!important;outline-offset:3px}'
    + '.bb-tip{position:absolute;z-index:2147483000;max-width:min(340px,calc(100vw - 16px));padding:5px 10px;border-radius:8px;'
    + 'background:#1d2433;color:#fff;font:600 12px/1.4 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;'
    + 'letter-spacing:0;text-transform:none;box-shadow:0 4px 14px rgba(0,0,0,.22);pointer-events:none;white-space:normal;word-break:keep-all}'
    + '.bb-tip[hidden]{display:none}.bb-tip[data-tone="ok"]{background:#15803d}.bb-tip[data-tone="err"]{background:#b91c1c}.bb-tip[data-tone="busy"]{background:#1d4ed8}';

  function supportsPlain(doc) {
    try { var d = doc.createElement('div'); d.setAttribute('contenteditable', 'plaintext-only'); return d.contentEditable === 'plaintext-only'; } catch (e) { return false; }
  }

  /* the stored value of an edited element: display-only helpers (nbsp, nowrap spans, unit spans, links) fold back to plain text */
  function textOf(el) {
    var out = '';
    (function walk(n) {
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) out += c.nodeValue;
        else if (c.nodeType === 1) {
          var t = c.tagName;
          if (t === 'BR') { out += '\n'; continue; }
          if (t === 'WBR' || t === 'SCRIPT' || t === 'STYLE') continue;
          if ((t === 'DIV' || t === 'P' || t === 'LI') && out && out.charAt(out.length - 1) !== '\n') out += '\n';
          walk(c);
        }
      }
    })(el);
    return out.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/\u200b/g, '').replace(/\n+$/, '');
  }

  function create(o) {
    var doc = o.doc || global.document, win = doc.defaultView || global;
    var SEL = o.selector || '[data-copy]';
    var keyOf = o.keyOf || function (el) { return el.getAttribute('data-copy'); };
    var allowed = o.isAllowed || function () { return true; };
    var raw = o.raw, send = o.send;
    var refit = o.refit || function () {}, rerender = o.rerender || function () {};
    var isMulti = o.multiline || function (k, v) { return /\n/.test(v) || /(^|_)(body|detail|intro|desc|note)\d*$/.test(k); };
    var MODE = supportsPlain(doc) ? 'plaintext-only' : 'true';
    var on = false, cur = null, drafts = {}, saving = {}, tip = null, tipTimer = 0;
    var str = function (v) { return v == null ? '' : String(v); };

    if (!doc.getElementById('bb-inline-css')) {
      var style = doc.createElement('style'); style.id = 'bb-inline-css'; style.textContent = CSS;
      (doc.head || doc.documentElement).appendChild(style);
    }

    function editableEl(t) {
      var el = t && t.nodeType === 1 ? t : t && t.parentElement;
      return el && el.closest ? el.closest('[data-inline]') : null;
    }
    function findEl(key, prefer) {
      if (prefer && prefer.isConnected) return prefer;
      var all = doc.querySelectorAll(SEL);
      for (var i = 0; i < all.length; i++) if (keyOf(all[i]) === key) return all[i];
      return null;
    }

    /* small status chip next to the copy being edited */
    function showTip(el, text, tone, ms) {
      if (!doc.body) return;
      if (!tip) { tip = doc.createElement('div'); tip.className = 'bb-tip'; tip.setAttribute('role', 'status'); tip.setAttribute('aria-live', 'polite'); }
      if (!tip.isConnected) doc.body.appendChild(tip);
      tip.textContent = text; tip.setAttribute('data-tone', tone || ''); tip.hidden = false;
      placeTip(el);
      win.clearTimeout(tipTimer); if (ms) tipTimer = win.setTimeout(hideTip, ms);
    }
    function placeTip(el) {
      if (!tip || tip.hidden || !el) return;
      var r = el.getBoundingClientRect();
      if (!r.width && !r.height) { hideTip(); return; }
      var sx = win.pageXOffset || 0, sy = win.pageYOffset || 0, vw = doc.documentElement.clientWidth || 0;
      var top = r.top + sy - tip.offsetHeight - 8;
      if (top < sy + 4) top = r.bottom + sy + 8;
      var left = Math.max(sx + 8, Math.min(r.left + sx, sx + vw - tip.offsetWidth - 8));
      tip.style.top = Math.round(top) + 'px'; tip.style.left = Math.round(left) + 'px';
    }
    function hideTip() { win.clearTimeout(tipTimer); if (tip) tip.hidden = true; }

    /* called by the page after every render: every copy becomes editable while the shared server is connected */
    function sync(editable) {
      on = editable === true;
      doc.documentElement.classList.toggle('bb-inline', on);
      var all = doc.querySelectorAll(SEL);
      for (var i = 0; i < all.length; i++) {
        var el = all[i], key = keyOf(el);
        if (on && key && allowed(key)) {
          if (el.getAttribute('contenteditable') !== MODE) el.setAttribute('contenteditable', MODE);
          if (!el.hasAttribute('data-inline')) el.setAttribute('data-inline', '');
          if (el.getAttribute('spellcheck') !== 'false') el.setAttribute('spellcheck', 'false');
          var title = isMulti(key, str(raw(key))) ? TIP_MULTI : TIP_ONE;
          if (el.title !== title) el.title = title;
        } else if (el.hasAttribute('data-inline') && !(cur && cur.el === el)) {
          el.removeAttribute('contenteditable'); el.removeAttribute('data-inline'); el.removeAttribute('spellcheck');
          if (el.title === TIP_ONE || el.title === TIP_MULTI) el.removeAttribute('title');
        }
      }
    }

    /* the page must not overwrite these while rendering */
    function holds(el) {
      if (cur && cur.el === el) return true;
      var k = keyOf(el), d = k && drafts[k];
      return !!(d && d.el === el);
    }

    function begin(el) {
      var key = keyOf(el);
      if (!key) return;
      var base = str(raw(key));
      cur = { el: el, key: key, base: base, ml: isMulti(key, base), cancel: false, dirty: false };
      var d = drafts[key];
      if (d && d.el === el) { delete drafts[key]; cur.dirty = true; } /* the unsaved text is still on screen: keep editing it */
      el.classList.remove('bb-error', 'bb-saved');
      if (cur.ml && win.getComputedStyle(el).whiteSpace === 'normal') el.classList.add('bb-ml');
      send({ type: 'aptos-editing', field: key });
      showTip(el, cur.ml ? '다른 곳을 누르면 저장 · Esc 취소' : 'Enter 저장 · Esc 취소', '');
    }

    function finish() {
      var c = cur; if (!c) return;
      cur = null;
      var el = c.el;
      el.classList.remove('bb-ml');
      var value = textOf(el);
      if (c.cancel || value === c.base) {
        send({ type: 'aptos-edit-cancel' }); hideTip();
        if (c.dirty) win.setTimeout(rerender, 0); /* restore the saved text and its display formatting */
        return;
      }
      if (value.length > MAX_LEN) {
        drafts[c.key] = { el: el, value: value }; el.classList.add('bb-error');
        send({ type: 'aptos-edit-cancel' });
        showTip(el, MAX_LEN + '자를 넘어 저장할 수 없습니다. 줄인 뒤 다시 저장해 주세요.', 'err', 8000);
        return;
      }
      saving[c.key] = { el: el, value: value };
      el.classList.add('bb-saving');
      showTip(el, '저장 중…', 'busy');
      send({ type: 'aptos-edit', field: c.key, value: value });
    }
    function leave(c) { c.el.blur(); if (cur === c) finish(); }

    function onFocusIn(e) {
      if (!on) return;
      var el = editableEl(e.target);
      if (!el || (cur && cur.el === el)) return;
      if (cur) finish();
      begin(el);
    }
    function onFocusOut(e) {
      if (!cur || (e.target !== cur.el && !cur.el.contains(e.target))) return;
      if (e.relatedTarget && cur.el.contains(e.relatedTarget)) return;
      finish();
    }
    function onKeyDown(e) {
      if (!cur || !cur.el.contains(e.target)) return;
      if (e.isComposing || e.keyCode === 229) return; /* Korean/Japanese IME: Enter only confirms the syllable */
      if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); cur.cancel = true; leave(cur); return; }
      if (e.key === 'Enter' && (!cur.ml || e.ctrlKey || e.metaKey)) { e.preventDefault(); leave(cur); }
    }
    function onInput(e) {
      if (!cur || !cur.el.contains(e.target)) return;
      cur.dirty = true;
      cur.el.classList.toggle('is-empty', !textOf(cur.el).trim());
      try { refit(cur.el); } catch (x) { /* layout helpers are best effort */ }
      placeTip(cur.el);
    }
    function onPaste(e) {
      if (!cur || !cur.el.contains(e.target)) return;
      var cd = e.clipboardData || win.clipboardData; if (!cd) return;
      e.preventDefault();
      var t = cd.getData('text/plain') || cd.getData('text') || '';
      t = t.replace(/\r\n?/g, '\n');
      if (!cur.ml) t = t.replace(/\s*\n\s*/g, ' ');
      var done = false;
      try { done = doc.execCommand('insertText', false, t); } catch (x) { done = false; }
      if (!done) {
        var s = win.getSelection();
        if (s && s.rangeCount) { var r = s.getRangeAt(0); r.deleteContents(); var n = doc.createTextNode(t); r.insertNode(n); r.setStartAfter(n); r.collapse(true); s.removeAllRanges(); s.addRange(r); }
      }
      onInput({ target: cur.el });
    }
    function onDrop(e) { if (on && editableEl(e.target)) e.preventDefault(); }
    function onClick(e) {
      if (!on || !editableEl(e.target)) return;
      var t = e.target.nodeType === 1 ? e.target : e.target.parentElement;
      if (t && t.closest && t.closest('a,button,label,summary')) e.preventDefault(); /* editing a button label must not open the link */
    }

    function saveResult(msg) {
      if (!msg || typeof msg.field !== 'string') return;
      var s = saving[msg.field]; if (!s) return;
      delete saving[msg.field];
      var el = findEl(msg.field, s.el); if (!el) return;
      el.classList.remove('bb-saving');
      if (msg.ok) {
        el.classList.add('bb-saved');
        win.setTimeout(function () { el.classList.remove('bb-saved'); }, 1400);
        if (!cur) showTip(el, '저장됨', 'ok', 1600);
      } else {
        drafts[msg.field] = { el: el, value: s.value };
        el.textContent = s.value; el.classList.add('bb-error');
        try { refit(el); } catch (x) { /* best effort */ }
        if (!cur) showTip(el, '저장되지 않았습니다' + (msg.error ? ' · ' + msg.error : '') + ' · 다시 눌러 Enter로 저장해 주세요', 'err', 9000);
      }
    }

    function start(key) {
      var all = doc.querySelectorAll('[data-inline]'), el = null;
      for (var i = 0; i < all.length; i++) if (keyOf(all[i]) === key) { el = all[i]; break; }
      if (!el) return false;
      el.focus();
      try { var r = doc.createRange(); r.selectNodeContents(el); r.collapse(false); var s = win.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (x) { /* ignore */ }
      return true;
    }

    doc.addEventListener('focusin', onFocusIn, true);
    doc.addEventListener('focusout', onFocusOut, true);
    doc.addEventListener('keydown', onKeyDown, true);
    doc.addEventListener('input', onInput, true);
    doc.addEventListener('paste', onPaste, true);
    doc.addEventListener('drop', onDrop, true);
    doc.addEventListener('click', onClick, true);
    win.addEventListener('blur', function () { if (cur) finish(); }); /* focus moved to the board (sidebar, language tabs) */
    win.addEventListener('resize', function () { if (cur) placeTip(cur.el); });

    return {
      sync: sync, holds: holds, saveResult: saveResult, start: start, mode: MODE,
      active: function () { return cur ? cur.key : null; },
    };
  }

  global.BBInlineEdit = { create: create, textOf: textOf };
})(typeof window !== 'undefined' ? window : this);
