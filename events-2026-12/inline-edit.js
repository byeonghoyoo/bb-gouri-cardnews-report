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
    + '.bb-gap{display:none!important}'
    + '[data-inline].bb-saving{outline:2px dashed #2f6bff!important;outline-offset:3px}'
    + '[data-inline].bb-saved{outline:2px solid #16a34a!important;outline-offset:3px}'
    + '[data-inline].bb-error{outline:2px dashed #dc2626!important;outline-offset:3px}'
    + '.bb-tip{position:absolute;z-index:2147483000;max-width:min(340px,calc(100vw - 16px));padding:5px 10px;border-radius:8px;'
    + 'background:#1d2433;color:#fff;font:600 12px/1.4 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;'
    + 'letter-spacing:0;text-transform:none;box-shadow:0 4px 14px rgba(0,0,0,.22);pointer-events:none;white-space:normal;word-break:keep-all}'
    + '.bb-tip[hidden]{display:none}.bb-tip[data-tone="ok"]{background:#15803d}.bb-tip[data-tone="err"]{background:#b91c1c}.bb-tip[data-tone="busy"]{background:#1d4ed8}';

  CSS += '.bb-tools{position:absolute;z-index:2147483001;display:flex;flex-wrap:wrap;align-items:center;gap:6px;width:max-content;max-width:calc(100vw - 16px);padding:10px;border-radius:10px;background:#1d2433;color:#fff;font:500 13px/1.4 system-ui,-apple-system,"Malgun Gothic",sans-serif;letter-spacing:0;text-transform:none;box-shadow:0 6px 18px rgba(0,0,0,.22);transform-origin:top left;box-sizing:border-box;white-space:normal}'+
  '.bb-tools[hidden]{display:none!important}.bb-tools button,.bb-tools input{box-sizing:border-box;height:32px;min-width:32px;border:1px solid #c3cddd;border-radius:5px;background:#fff;color:#192335;font:600 13px/1 system-ui,-apple-system,"Malgun Gothic",sans-serif;letter-spacing:0;padding:6px 8px;text-shadow:none;cursor:pointer;white-space:nowrap;touch-action:manipulation}.bb-tools input{width:66px;text-align:center;cursor:text;font-variant-numeric:tabular-nums}.bb-tools button:hover{background:#dbeafe}.bb-tools button:active{background:#bfdbfe}.bb-tools button:focus-visible,.bb-tools input:focus-visible{outline:2px solid #93c5fd;outline-offset:2px}.bb-tools [data-bb-action="save"]{background:#bbd5ff;border-color:#bbd5ff;color:#0c2448}.bb-tools button:disabled{opacity:.5;cursor:wait}.bb-tools .bb-tool-note{flex:1 0 100%;margin:2px 0 0;font-size:12px;line-height:1.45;font-weight:400;letter-spacing:0;color:#e2e8f0;white-space:normal}.bb-tools .bb-tool-note[data-error="true"]{color:#fecaca}.bb-tools .bb-tool-target{font-size:12px;min-width:50px;white-space:nowrap}@media(pointer:coarse){.bb-tools button,.bb-tools input{height:44px;min-width:44px}}';

  function supportsPlain(doc) {
    try { var d = doc.createElement('div'); d.setAttribute('contenteditable', 'plaintext-only'); return d.contentEditable === 'plaintext-only'; } catch (e) { return false; }
  }

  /* the stored value of an edited element: display-only helpers (nbsp, nowrap spans, unit spans, links) fold back to plain text */
  function textOf(el, keepTrailing) {
    var out = '';
    (function walk(n) {
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) out += c.nodeValue;
        else if (c.nodeType === 1) {
          var t = c.tagName;
          if (c.hasAttribute('data-bb-caret') || c.hasAttribute('data-bb-line')) continue;
          if (t === 'BR') { out += '\n'; continue; }
          if (t === 'WBR' || t === 'SCRIPT' || t === 'STYLE') continue;
          if ((t === 'DIV' || t === 'P' || t === 'LI') && out && out.charAt(out.length - 1) !== '\n') out += '\n';
          walk(c);
        }
      }
    })(el);
    out = out.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/\u200b/g, '');
    return keepTrailing ? out : out.replace(/\n+$/, '');
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
    var FC = win.BBTextFormat, fmt = win.BBInlineFormat ? win.BBInlineFormat.create({doc:doc, keyOf:keyOf, raw:raw, holds:holds, all:function(){return doc.querySelectorAll(SEL);}}) : null;
    var tools = null, sizeInput = null, toolTarget = null, toolNote = null, resizing = 0;
    function json(x){return JSON.stringify(x);}
    function editState(){return{html:cur.el.innerHTML,value:textOf(cur.el),format:JSON.parse(json(cur.format)),sel:fmt.selection(cur.el)||cur.sel};}
    function rememberLocal(kind){if(!fmt||!cur)return;var s=editState(),last=cur.history[cur.at];if(last&&last.value===s.value&&json(last.format)===json(s.format))return;cur.history=cur.history.slice(0,cur.at+1);var now=Date.now();if(kind==='typing'&&cur.lastKind==='typing'&&now-cur.lastAt<800&&cur.at>0)cur.history[cur.at]=s;else{cur.history.push(s);cur.at++;}cur.lastKind=kind;cur.lastAt=now;}
    function localUndo(redo){if(!cur||!fmt)return false;var at=cur.at+(redo?1:-1);if(at<0||at>=cur.history.length)return false;var s=cur.history[at];fmt.clear(cur.el);cur.el.innerHTML=s.html;cur.format=JSON.parse(json(s.format));cur.at=at;cur.dirty=true;cur.lastKind='undo';fmt.apply(cur.el,cur.format);fmt.select(cur.el,s.sel);updateTools();return true;}
    function note(t,error){if(!toolNote)return;toolNote.textContent=t;toolNote.setAttribute('data-error',error?'true':'false');}
    function placeTools(){if(!tools||tools.hidden||!cur)return;var r=cur.el.getBoundingClientRect(),sx=win.pageXOffset||0,sy=win.pageYOffset||0,vw=doc.documentElement.clientWidth,scale=1;try{if(win.frameElement&&win.innerWidth)scale=win.frameElement.getBoundingClientRect().width/win.innerWidth;}catch(e){}scale=Math.max(.5,Math.min(1,scale));tools.style.maxWidth=Math.max(260,(vw-16)*scale)+'px';tools.style.transform='scale('+(1/scale)+')';var tr=tools.getBoundingClientRect(),top=r.top+sy-tr.height-8;if(top<sy+4)top=r.bottom+sy+8;tools.style.top=Math.round(top)+'px';tools.style.left=Math.round(Math.max(sx+8,Math.min(r.left+sx,sx+vw-tr.width-8)))+'px';}
    function updateTools(){if(!fmt||!cur||!tools)return;var s=fmt.selection(cur.el)||cur.sel||{start:0,end:0};cur.sel=s;var chosen=s.start!==s.end;toolTarget.textContent=chosen?'선택 '+(s.end-s.start)+'자':'이 문구 전체';if(doc.activeElement!==sizeInput)sizeInput.value=String(chosen?fmt.scaleAt(cur.format,s.start):cur.format.scale);placeTools();}
    function previewFormat(next,sel,message){if(!cur||!fmt)return false;var old=JSON.parse(json(cur.format)),value=textOf(cur.el);next.base=FC.signature(value);next=FC.normalize(next,value);if(!next){note('40~200% 범위에서 조절해 주세요. 부분 서식은 60곳까지 가능합니다.',true);return false;}var caret=sel||fmt.selection(cur.el)||cur.sel;fmt.apply(cur.el,next);var problem=fmt.check(cur.el,cur.guard);if(problem){fmt.apply(cur.el,old);fmt.select(cur.el,caret);note(problem,true);updateTools();return false;}cur.format=next;cur.dirty=true;fmt.select(cur.el,caret);cur.sel=caret;rememberLocal('format');note(message||'이 언어·이 규격·이 구간에만 저장됩니다. 색상은 그대로입니다.');updateTools();return true;}
    function resizeText(pct){if(!cur||!fmt)return;var s=fmt.selection(cur.el)||cur.sel||{start:0,end:0},v=textOf(cur.el);pct=Number(pct);if(!Number.isInteger(pct)||pct<40||pct>200){note('글자 크기는 40~200%로 입력해 주세요.',true);updateTools();return;}resizing++;try{previewFormat(fmt.rangeSize(cur.format,s.start,s.end,pct,v.length),s);cur.el.focus();fmt.select(cur.el,s);}finally{resizing--;}}
    function lineChange(join,boundary){if(!cur||!fmt)return false;var s=fmt.selection(cur.el)||cur.sel||{start:0,end:0},next=JSON.parse(json(cur.format)),v=textOf(cur.el);if(!next.manual)next.breaks=fmt.structuralBreaks(cur.el);next.manual=true;if(join){if(typeof boundary==='number')next.breaks=next.breaks.filter(function(n){return n!==boundary;});else if(s.start!==s.end)next.breaks=next.breaks.filter(function(n){return n<s.start||n>s.end;});else next.breaks=[];s.afterBreak=false;}else{if(!FC.boundary(v,s.start))return false;next.breaks=Array.from(new Set(next.breaks.concat([s.start]))).sort(function(a,b){return a-b;});s={start:s.start,end:s.start,afterBreak:true};}return previewFormat(next,s,join?'글자는 그대로 두고 줄을 합쳤습니다. 자동으로 접히면 크기를 줄여 주세요.':'줄바꿈을 넣었습니다. 글자나 가격은 바뀌지 않습니다.');}
    function showTools(){if(!fmt||!cur||!doc.body)return;if(!tools){tools=doc.createElement('div');tools.className='bb-tools';tools.setAttribute('role','toolbar');tools.setAttribute('aria-label','글자 크기와 줄 편집');toolTarget=doc.createElement('span');toolTarget.className='bb-tool-target';tools.appendChild(toolTarget);function button(action,label,title){var b=doc.createElement('button');b.type='button';b.textContent=label;b.setAttribute('data-bb-action',action);if(title)b.title=title;tools.appendChild(b);return b;}button('smaller','작게','글자 크기 5% 줄이기');sizeInput=doc.createElement('input');sizeInput.type='number';sizeInput.min='40';sizeInput.max='200';sizeInput.step='5';sizeInput.setAttribute('aria-label','글자 크기 백분율');tools.appendChild(sizeInput);var unit=doc.createElement('span');unit.textContent='%';tools.appendChild(unit);button('larger','크게','글자 크기 5% 키우기');button('break','줄바꿈','커서 위치에서 줄바꿈 (Shift+Enter)');button('join','줄 합치기','글자를 지우지 않고 줄 합치기');button('reset','기본','크기와 줄 배치를 디자인 기본값으로');button('save','저장','글자와 서식을 공유 저장');button('cancel','취소','수정 전으로 (Esc)');toolNote=doc.createElement('p');toolNote.className='bb-tool-note';toolNote.setAttribute('role','status');toolNote.setAttribute('aria-live','polite');tools.appendChild(toolNote);doc.body.appendChild(tools);
      tools.addEventListener('mousedown',function(e){if(!cur)return;cur.sel=fmt.selection(cur.el)||cur.sel;if(e.target.closest('button'))e.preventDefault();});
      tools.addEventListener('click',function(e){var b=e.target.closest('[data-bb-action]');if(!cur||!b)return;var a=b.getAttribute('data-bb-action'),s=cur.sel||{start:0,end:0};if(a==='save'){leave(cur);return;}if(a==='cancel'){cur.cancel=true;leave(cur);return;}if(a==='smaller'||a==='larger'){var p=s.start!==s.end?fmt.scaleAt(cur.format,s.start):cur.format.scale;resizeText(Math.max(40,Math.min(200,p+(a==='smaller'?-5:5))));}else if(a==='break'||a==='join')lineChange(a==='join');else if(a==='reset')previewFormat(FC.empty(textOf(cur.el)),s,'이 문구의 크기와 줄 배치를 기본으로 돌렸습니다.');});
      sizeInput.addEventListener('change',function(){resizeText(sizeInput.value);});sizeInput.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();resizeText(sizeInput.value);}else if(e.key==='Escape'&&cur){e.preventDefault();cur.el.focus();fmt.select(cur.el,cur.sel);}});
    }tools.hidden=false;hideTip();note('드래그하면 선택 부분만 조절합니다. Shift+Enter 줄바꿈 · Esc 취소');updateTools();}


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

    /* 2026-11-09: Chrome edits plaintext-only copy with white-space:pre-wrap, so the space or line break a page leaves
       between two block spans (a two-line name, a split title) shows as an empty line in the board's editing view only
       (team comment ULT5 #25 "행간이 너무 넓다"; the downloaded images never had it). That separator goes into a hidden
       span: the empty line is gone, the saved text (textOf) is unchanged and a stray Backspace can no longer eat it. */
    var BLOCKISH = /^(block|flex|grid|table|list-item|flow-root)/;
    function hideGaps(root) {
      (function walk(el) {
        for (var c = el.firstChild; c; c = c.nextSibling) {
          if (c.nodeType === 1) { if (c.className !== 'bb-gap' && c.firstChild) walk(c); continue; }
          if (c.nodeType !== 3 || !c.nodeValue || /\S/.test(c.nodeValue)) continue;
          var p = c.previousSibling;
          if (!p || p.nodeType !== 1 || p.className === 'bb-gap' || !BLOCKISH.test(win.getComputedStyle(p).display || '')) continue;
          var s = doc.createElement('span'); s.className = 'bb-gap'; s.setAttribute('aria-hidden', 'true');
          el.insertBefore(s, c); s.appendChild(c); c = s;
        }
      })(root);
    }

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
          if (!(cur && cur.el === el)) hideGaps(el);
        } else if (el.hasAttribute('data-inline') && !(cur && cur.el === el)) {
          el.removeAttribute('contenteditable'); el.removeAttribute('data-inline'); el.removeAttribute('spellcheck');
          if (el.title === TIP_ONE || el.title === TIP_MULTI) el.removeAttribute('title');
        }
      }
      if (fmt) fmt.sync();
    }

    /* the page must not overwrite these while rendering */
    function holds(el) {
      if (cur && cur.el === el) return true;
      var k = keyOf(el), d = k && drafts[k];
      return !!(d && d.el === el && !d.layoutInvalid);
    }

    function begin(el) {
      var key = keyOf(el);
      if (!key) return;
      var base = str(raw(key));
      if (saving[key]) { showTip(el, '저장 중입니다. 잠시 뒤 다시 눌러 주세요.', 'busy', 1800); el.blur(); return; }
      cur = { el: el, key: key, base: base, ml: isMulti(key, base), cancel: false, dirty: false };
      if (fmt) { cur.format = fmt.saved(el); cur.formatBase = json(cur.format); if (!el.hasAttribute('data-bb-formatted') && !FC.isDefault(cur.format)) fmt.apply(el,cur.format); cur.guard = fmt.measure(el); cur.sel = fmt.selection(el); }
      var d = drafts[key];
      if (d && d.el === el) { delete drafts[key]; cur.dirty = true; if(fmt && d.format){ if(d.html)el.innerHTML=d.html; cur.format=d.format; fmt.apply(el,cur.format); } } /* the unsaved text is still on screen: keep editing it */
      el.classList.remove('bb-error', 'bb-saved');
      if (cur.ml && win.getComputedStyle(el).whiteSpace === 'normal') el.classList.add('bb-ml');
      send({ type: 'aptos-editing', field: key, scope: fmt ? fmt.scope : 'home',slot:fmt?fmt.slot(el):'' });
      if (fmt) { cur.history = [editState()]; cur.at=0; showTools(); }
      else showTip(el, cur.ml ? '다른 곳을 누르면 저장 · Esc 취소' : 'Enter 저장 · Esc 취소', '');
    }

    function finish() {
      var c = cur; if (!c) return;
      cur = null;
      if (tools) tools.hidden = true;
      var el = c.el;
      el.classList.remove('bb-ml');
      var value = textOf(el), formatChanged = fmt && json(Object.assign({},c.format,{base:''})) !== json(Object.assign({},JSON.parse(c.formatBase),{base:''}));
      if (c.cancel || (value === c.base && !formatChanged)) {
        send({ type: 'aptos-edit-cancel' }); hideTip();
        if (c.dirty || formatChanged) win.setTimeout(rerender, 0); /* restore the saved text and its display formatting */
        return;
      }
      if (value.length > MAX_LEN) {
        drafts[c.key] = { el: el, value: value }; el.classList.add('bb-error');
        send({ type: 'aptos-edit-cancel' });
        showTip(el, MAX_LEN + '자를 넘어 저장할 수 없습니다. 줄인 뒤 다시 저장해 주세요.', 'err', 8000);
        return;
      }
      var formatValue = null;
      if (fmt && (formatChanged || !FC.isDefault(c.format))) {
        c.format.base = FC.signature(value);
        var problem = fmt.check(el,c.guard);
        try { FC.encode(c.format,value); } catch (err) { problem = err.message; }
        if (problem) { drafts[c.key]={el:el,value:value,format:c.format,html:el.innerHTML,layoutInvalid:true}; send({type:'aptos-edit-cancel'}); showTip(el,problem+' · 저장하지 않았습니다. 다시 눌러 수정해 주세요.','err',9000); rerender(); return; }
        formatValue = c.format;
      }
      saving[c.key] = { el: el, value: value, format: formatValue, html:el.innerHTML };
      el.classList.add('bb-saving');
      showTip(el, '저장 중…', 'busy');
      var message = { type:'aptos-edit',field:c.key,value:value };
      if(formatValue){message.format=formatValue;message.scope=fmt.scope;message.slot=fmt.slot(el);}
      send(message);
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
      if (resizing) return;
      if (!cur || (e.target !== cur.el && !cur.el.contains(e.target) && !(tools && tools.contains(e.target)))) return;
      if (e.relatedTarget && (cur.el.contains(e.relatedTarget) || (tools && tools.contains(e.relatedTarget)))) return;
      finish();
    }
    function onKeyDown(e) {
      if (!cur || !cur.el.contains(e.target)) return;
      if (e.isComposing || e.keyCode === 229) return; /* Korean/Japanese IME: Enter only confirms the syllable */
      if (fmt && e.altKey && e.key === 'F10') {e.preventDefault();tools.querySelector('button').focus();return;}
      if (fmt && !e.ctrlKey && !e.metaKey && (e.key==='Backspace'||e.key==='Delete')) {var s=fmt.selection(cur.el),v=textOf(cur.el),br=cur.format.manual?cur.format.breaks:fmt.structuralBreaks(cur.el);if(s&&s.start===s.end){var b=br.find(function(n){return e.key==='Backspace' ? n<=s.start && !v.slice(n,s.start).trim() : n>=s.start && !v.slice(s.start,n).trim();});if(typeof b==='number'){e.preventDefault();lineChange(true,b);return;}}}
      if (fmt && e.key==='Enter' && !e.ctrlKey && !e.metaKey && e.shiftKey) {e.preventDefault();lineChange(false);return;}
      if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); cur.cancel = true; leave(cur); return; }
      if (e.key === 'Enter' && (!cur.ml || e.ctrlKey || e.metaKey)) { e.preventDefault(); leave(cur); }
    }
    /* 2026-11-09 user: "잘못 수정했을 때 되돌리기 가능하게 컨트롤+Z". While the text being typed differs from the saved
       text, Ctrl+Z is the browser's own typing undo. Otherwise Ctrl+Z (Cmd+Z) asks the board to undo the last saved
       change, and Ctrl+Shift+Z / Ctrl+Y redoes it; the board writes it back to the shared server. */
    function onUndoKey(e) {
      if (!on || !(e.ctrlKey || e.metaKey) || e.altKey) return;
      var k = e.key || '', z = e.code === 'KeyZ' || k === 'z' || k === 'Z', y = e.code === 'KeyY' || k === 'y' || k === 'Y';
      if (!z && !y) return;
      if (fmt && cur && localUndo(y || e.shiftKey)) { e.preventDefault(); return; }
      if (cur && (textOf(cur.el) !== cur.base || cur.el.classList.contains('bb-error'))) return;
      var t = e.target && e.target.nodeType === 1 ? e.target : null;
      if (!cur && t && t.closest && t.closest('input,textarea,select')) return;
      e.preventDefault();
      if (cur) { cur.cancel = true; leave(cur); }
      send({ type: (y || e.shiftKey) ? 'aptos-redo' : 'aptos-undo' });
    }
    function onInput(e) {
      if (!cur || !cur.el.contains(e.target)) return;
      cur.dirty = true;
      if(fmt){var extracted=fmt.extract(cur.el,cur.format);cur.format=extracted.format;rememberLocal('typing');updateTools();}
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
        if (!cur) showTip(el, '저장됨 · 잘못 고쳤으면 Ctrl+Z', 'ok', 2600);
      } else {
        drafts[msg.field] = { el: el, value: s.value,format:s.format,html:s.html };
        if(fmt && s.format){el.innerHTML=s.html;fmt.apply(el,s.format);}else el.textContent = s.value; el.classList.add('bb-error');
        try { refit(el); } catch (x) { /* best effort */ }
        if (!cur) showTip(el, '저장되지 않았습니다' + (msg.error ? ' · ' + msg.error : '') + ' · 다시 눌러 Enter로 저장해 주세요', 'err', 9000);
      }
    }

    function start(key) {
      var all = doc.querySelectorAll('[data-inline]'), el = null;
      for (var i = 0; i < all.length; i++) if (keyOf(all[i]) === key && all[i].getClientRects().length) { el = all[i]; break; }
      if (!el) return false;
      el.focus();
      try { var r = doc.createRange(); r.selectNodeContents(el); r.collapse(false); var s = win.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (x) { /* ignore */ }
      return true;
    }

    win.addEventListener('message',function(e){if(e.source===win.parent && e.origin===win.location.origin && e.data && e.data.type==='aptos-finish-edit' && cur)leave(cur);});
    doc.addEventListener('focusin', onFocusIn, true);
    doc.addEventListener('focusout', onFocusOut, true);
    doc.addEventListener('keydown', onUndoKey, true);
    doc.addEventListener('keydown', onKeyDown, true);
    doc.addEventListener('input', onInput, true);
    doc.addEventListener('paste', onPaste, true);
    doc.addEventListener('drop', onDrop, true);
    doc.addEventListener('click', onClick, true);
    win.addEventListener('blur', function () { if (cur) finish(); }); /* focus moved to the board (sidebar, language tabs) */
    win.addEventListener('resize', function () { if (cur) { placeTip(cur.el);placeTools(); } });
    doc.addEventListener('selectionchange', function(){if(cur && fmt) updateTools();});

    return {
      sync: sync, holds: holds, saveResult: saveResult, start: start, mode: MODE,
      active: function () { return cur ? cur.key : null; },
    };
  }

  global.BBInlineEdit = { create: create, textOf: textOf };
})(typeof window !== 'undefined' ? window : this);
