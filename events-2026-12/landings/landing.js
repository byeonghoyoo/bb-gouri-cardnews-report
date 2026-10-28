(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.Landing = api;
    if (root.document && !root.__LANDING_NO_AUTOSTART) api.boot(root);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------ constants */
  var DATA_URL = '../data.json';
  var ASSET_LOGO = '../aptos/assets/brand.png'; // compatibility mirror of assets/brand/wordmark-coral.png
  var ASSET_EMBLEM = '../assets/brand/emblem-pink.png';
  var ASSET_QR = '../aptos/assets/reservation-qr.png';
  var ALLOWED = /^(?:title|subtitle|body|heroEyebrow|brand|location|contact|booking_title|booking_text|currency|price_heading|alt_hero|condition2|condition3|story_(?:question|title|body)|feature[1-3]_(?:title|body)|guide_(?:title|body)|care_(?:title|intro)|care[1-5]_(?:title|body)|cta_title|offer[1-5]_(?:title|detail|price|vat))$/;
  var REQUIRED = ['brand', 'title', 'subtitle', 'body', 'heroEyebrow', 'currency', 'contact', 'booking_title', 'booking_text', 'alt_hero'];
  var LAYOUTS = { lifting: 'rows', winter: 'trio', booster: 'quad', pore: 'steps', toning: 'visits', exam: 'exam' };

  /* ------------------------------------------------------------ pure helpers */
  function isAllowedField(k) { return typeof k === 'string' && ALLOWED.test(k); }

  function parseQuery(search) {
    var q = new URLSearchParams(search || '');
    var item = q.get('item'); var lang = q.has('lang') ? q.get('lang') : 'KO';
    return {
      item: item && /^[A-Za-z0-9]+$/.test(item) ? item : null,
      lang: lang && /^[A-Z]{2}$/.test(lang) ? lang : null,
    };
  }

  function layoutFor(theme) { return LAYOUTS[theme] || 'rows'; }

  function collectOffers(fields) {
    var out = [];
    for (var n = 1; n <= 5; n++) if (fields && Object.prototype.hasOwnProperty.call(fields, 'offer' + n + '_title')) out.push({ n: n });
    return out;
  }

  function v2Asset(src) {
    return typeof src === 'string' && /^assets\/[A-Za-z0-9_./-]+\.(?:avif|webp|png|jpe?g)$/i.test(src) && src.indexOf('..') < 0 ? '../' + src : null;
  }

  function offerImagesFor(item, n) {
    var map = item && item.offerImages;
    var raw = map && map[String(n)];
    var list = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
    return list.map(v2Asset).filter(Boolean).slice(0, 2);
  }

  function productsFor(item) {
    var list = item && item.v2 && Array.isArray(item.v2.products) ? item.v2.products : [];
    return list.filter(function (p) { return p && typeof p.name === 'string' && p.name.trim() && v2Asset(p.src); })
      .map(function (p) { return { name: p.name, src: v2Asset(p.src) }; });
  }

  function miriAsset(item, key) {
    var miri = item && item.v2 && item.v2.miri;
    return miri && Object.prototype.hasOwnProperty.call(miri, key) ? v2Asset(miri[key]) : null;
  }

  function clampFrameHeight(value) {
    var n = Number(value);
    if (!isFinite(n)) n = 300;
    return Math.max(300, Math.min(25000, Math.ceil(n)));
  }

  function missingFields(fields) {
    var f = fields || {}; var out = [];
    REQUIRED.forEach(function (k) { if (typeof f[k] !== 'string') out.push(k); });
    var count = 0;
    for (var n = 1; n <= 5; n++) {
      var any = ['title', 'detail', 'price', 'vat'].some(function (p) { return ('offer' + n + '_' + p) in f; });
      if (!any) continue;
      count++;
      ['title', 'price'].forEach(function (p) { if (typeof f['offer' + n + '_' + p] !== 'string') out.push('offer' + n + '_' + p); });
    }
    if (count < 3) out.push('offer 3개 이상 필요 (현재 ' + count + '개)');
    return out;
  }

  function pickAllowed(src) {
    var out = {};
    if (src && typeof src === 'object') Object.keys(src).forEach(function (k) { if (isAllowedField(k) && typeof src[k] === 'string') out[k] = src[k]; });
    return out;
  }

  function h(doc, tag, props, kids) {
    var el = doc.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'disabled' || k === 'hidden') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    [].concat(kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c);
    });
    return el;
  }

  /* ------------------------------------------------------------ renderer */
  function createLanding(env) {
    var doc = env.document;
    var H = function (tag, props, kids) { return h(doc, tag, props, kids); };
    var st = {
      data: null, item: null, locale: 'KO', fields: {}, links: {}, editable: false, editMode: false,
      sig: null, page: null, copyEls: [], altEls: [], linkEls: [], photo: null, missingBox: null,
      editField: null, pending: false, imageProblem: null, started: false,
      sizeEnabled: false, sizeObserver: null, sizeQueued: false, lastHeight: null,
    };
    var ui = {};

    function origin() { return (env.location && env.location.origin) || ''; }
    function post(msg) {
      var p = env.parentWindow;
      if (!p || p === env.selfWindow || !p.postMessage) return;
      var o = origin();
      p.postMessage(msg, !o || o === 'null' ? '*' : o);
    }
    function notifySize() {
      if (!st.sizeEnabled || !ui.root) return;
      var height = clampFrameHeight(ui.root.scrollHeight || ui.root.offsetHeight || 0);
      if (height === st.lastHeight) return;
      st.lastHeight = height;
      post({ type: 'aptos-size', height: height });
    }
    function scheduleSize() {
      if (!st.sizeEnabled || st.sizeQueued) return;
      st.sizeQueued = true;
      var run = function () { st.sizeQueued = false; notifySize(); };
      if (typeof env.requestAnimationFrame === 'function') env.requestAnimationFrame(run);
      else Promise.resolve().then(run);
    }

    /* ---- error banner ---- */
    function problems() {
      var out = missingFields(st.fields).map(function (k) { return '필드 누락: ' + k; });
      if (st.imageProblem) out.push(st.imageProblem);
      if (!st.links.booking || !st.links.phone) out.push('data.links(booking, phone)를 찾을 수 없습니다.');
      return out;
    }
    function renderBanner(list) {
      ui.errorHost.replaceChildren.apply(ui.errorHost, list.length ? [H('div', { class: 'landing-error', role: 'alert' }, [
        H('strong', { text: '데이터 오류 ' + list.length + '건: 아래 항목을 채워야 완성된 랜딩입니다.' }),
        H('ul', null, list.map(function (t) { return H('li', { text: t }); })),
      ])] : []);
    }
    function fatal(msg) {
      ui.errorHost.replaceChildren(H('div', { class: 'landing-error fatal', role: 'alert' }, [H('strong', { text: msg })]));
      ui.root.replaceChildren(ui.errorHost);
    }

    /* ---- build ---- */
    function signature() { return Object.keys(st.fields).sort().join('|') + '#' + (st.item.image || '') + '#' + JSON.stringify(st.item.offerImages || {}) + '#' + JSON.stringify(st.item.v2 || {}) + '#' + st.item.theme; }

    function slot(tag, key, cls) {
      if (!(key in st.fields) && REQUIRED.indexOf(key) < 0 && !/^offer[1-5]_(title|price)$/.test(key)) return null;
      var el = H(tag, { class: cls, 'data-copy': key });
      st.copyEls.push(el);
      return el;
    }
    function img(src, cls, altKey, literalAlt) {
      var el = H('img', { class: cls, src: src, 'data-alt': altKey, 'data-alt-literal': literalAlt || null });
      st.altEls.push(el);
      return el;
    }
    function link(el, key) { el.setAttribute('data-link', key); st.linkEls.push(el); return el; }
    function priceBlock(n, cls) {
      return H('div', { class: cls }, [
        slot('strong', 'offer' + n + '_price', 'price-num'),
        slot('span', 'currency', 'cur'),
        'offer' + n + '_vat' in st.fields ? slot('small', 'offer' + n + '_vat', 'vat') : null,
      ]);
    }

    function build() {
      st.copyEls = []; st.altEls = []; st.linkEls = []; st.photo = null; st.imageProblem = null;
      var f = st.fields; var offers = collectOffers(f); var it = st.item; var layout = layoutFor(it.theme);
      var figure = H('figure', { class: 'hero-figure' });
      st.missingBox = H('div', { class: 'image-missing', role: 'alert', hidden: true });
      if (it.image) {
        st.photo = img('../' + it.image, 'hero-photo', 'alt_hero');
        st.photo.addEventListener('load', scheduleSize);
        st.photo.addEventListener('error', function () { imageFailed('../' + it.image); scheduleSize(); });
        figure.appendChild(st.photo);
      }
      figure.appendChild(st.missingBox);
      var first = offers.length ? offers[0].n : 1;
      var heroCopy = H('div', { class: 'hero-copy' }, [
        slot('h1', 'title', 'hero-title'), slot('p', 'subtitle', 'hero-subtitle'), slot('p', 'body', 'hero-body'),
        H('div', { class: 'rep' }, [slot('span', 'offer' + first + '_title', 'rep-name'), priceBlock(first, 'rep-price')]),
      ]);
      var heroMedia = H('div', { class: 'hero-media' }, [
        H('span', { class: 'photo-index', 'aria-hidden': 'true' }), figure,
        H('span', { class: 'photo-rule', 'aria-hidden': 'true' }),
      ]);
      var hero = H('section', { class: 'panel hero' }, [
        H('header', { class: 'topbar' }, [img(ASSET_LOGO, 'logo', 'brand'), slot('span', 'heroEyebrow', 'eyebrow')]),
        H('div', { class: 'hero-stage' }, [heroCopy, heroMedia]),
      ]);

      var products = productsFor(it);
      if (!products.length) offers.forEach(function (o) {
        offerImagesFor(it, o.n).forEach(function (src) {
          if (!products.some(function (p) { return p.src === src; })) products.push({ name: f['offer' + o.n + '_title'] || '', src: src, altKey: 'offer' + o.n + '_title' });
        });
      });
      var productGallery = H('div', { class: 'product-gallery' }, products.map(function (p, index) {
        var shot = img(p.src, 'product-shot product-shot-' + (index + 1), p.altKey || 'alt_hero', p.name);
        shot.addEventListener('load', scheduleSize);
        shot.addEventListener('error', function () { shot.hidden = true; scheduleSize(); });
        return H('figure', { class: 'product-figure' }, [shot]);
      }));
      var features = [];
      for (var featureN = 1; featureN <= 3; featureN++) {
        var ft = 'feature' + featureN + '_title'; var fb = 'feature' + featureN + '_body';
        if (ft in f || fb in f) features.push(H('article', { class: 'feature-chip feature-' + featureN }, [slot('h3', ft, 'feature-title'), slot('p', fb, 'feature-body')]));
      }
      var miriKeys = ['seal', 'bubble', 'note', 'tape', 'winterType', 'examType'];
      var miri = H('div', { class: 'miri-layer', 'aria-hidden': 'true' }, miriKeys.map(function (key) {
        var src = miriAsset(it, key); return src ? img(src, 'miri miri-' + key, 'title') : null;
      }));
      var story = H('section', { class: 'panel story-intro' }, [
        miri,
        H('header', { class: 'story-copy' }, [slot('p', 'story_question', 'story-question'), slot('h2', 'story_title', 'story-title'), slot('p', 'story_body', 'story-body')]),
        H('div', { class: 'product-stage' }, [productGallery, H('div', { class: 'feature-orbit' }, features)]),
        H('div', { class: 'summary-strip' }, [
          'guide_title' in f ? slot('strong', 'guide_title', 'guide-title') : null,
          'guide_body' in f ? slot('p', 'guide_body', 'guide-body') : null,
        ]),
      ]);

      function offerCard(o, suppressMedia) {
        var sources = suppressMedia ? [] : offerImagesFor(it, o.n);
        var media = sources.length ? H('figure', { class: 'offer-media image-count-' + sources.length }, sources.map(function (src) {
          var visual = img(src, 'offer-visual', 'offer' + o.n + '_title');
          visual.addEventListener('load', scheduleSize);
          visual.addEventListener('error', function () {
            visual.hidden = true;
            if (media.children.every(function (child) { return child.hidden; })) media.hidden = true;
            scheduleSize();
          });
          return visual;
        })) : null;
        return H('article', { class: 'offer price-panel', 'data-n': String(o.n) }, [
          media,
          H('div', { class: 'offer-copy' }, [slot('h3', 'offer' + o.n + '_title', 'offer-title'), 'offer' + o.n + '_detail' in f ? slot('p', 'offer' + o.n + '_detail', 'offer-detail') : null]),
          priceBlock(o.n, 'price price-amount'),
        ]);
      }
      var sharedWinterMedia = null;
      if (layout === 'trio' && products.length) {
        var sharedWinterVisual = img(products[0].src, 'offer-visual', products[0].altKey || 'alt_hero', products[0].name);
        sharedWinterVisual.addEventListener('load', scheduleSize);
        sharedWinterVisual.addEventListener('error', function () { sharedWinterVisual.hidden = true; scheduleSize(); });
        sharedWinterMedia = H('figure', { class: 'winter-shared-product' }, [sharedWinterVisual]);
      }
      var offerCards = offers.map(function (o) { return offerCard(o, layout === 'trio'); }); var structure;
      if (layout === 'rows') structure = H('div', { class: 'pairing-map offer-grid count-' + offers.length }, offerCards);
      else if (layout === 'trio') structure = H('div', { class: 'winter-counts offer-grid count-' + offers.length }, offerCards);
      else if (layout === 'quad') structure = H('div', { class: 'vial-scale offer-grid count-' + offers.length }, offerCards);
      else if (layout === 'steps') structure = H('div', { class: 'device-branches offer-grid count-' + offers.length }, offerCards);
      else if (layout === 'visits') structure = H('div', { class: 'visit-track offer-grid count-' + offers.length }, offerCards);
      else structure = H('div', { class: 'exam-notebook offer-grid count-' + offers.length }, offerCards);
      var offerPanel = H('section', { class: 'panel offers' }, ['price_heading' in f ? slot('h2', 'price_heading', 'price-heading') : null, sharedWinterMedia, structure]);

      var guide = ('guide_title' in f || 'guide_body' in f) ? H('section', { class: 'panel guide-section' }, [
        slot('h2', 'guide_title', 'guide-heading'), slot('p', 'guide_body', 'guide-copy'),
      ]) : null;

      function careVisuals(max, filter) {
        var list = products.slice();
        if (filter) {
          var matched = list.filter(filter);
          if (matched.length) list = matched;
        }
        return H('div', { class: 'care-visuals' }, list.slice(0, max).map(function (p, index) {
          var visual = img(p.src, 'care-visual care-visual-' + (index + 1), p.altKey || 'alt_hero', p.name);
          visual.addEventListener('load', scheduleSize);
          visual.addEventListener('error', function () { visual.hidden = true; scheduleSize(); });
          return visual;
        }));
      }
      function careEntry(n, cls, tag) {
        return H(tag || 'article', { class: cls, 'data-step': String(n) }, [
          slot('h3', 'care' + n + '_title', 'care-item-title'),
          slot('p', 'care' + n + '_body', 'care-item-body'),
        ]);
      }
      var careCount = layout === 'trio' ? 5 : 3;
      var careEntries = [];
      for (var careN = 1; careN <= careCount; careN++) careEntries.push(careN);
      var careBody;
      if (layout === 'rows') {
        careBody = H('div', { class: 'care-layout care-units' }, [
          careVisuals(4),
          H('div', { class: 'care-unit-list' }, careEntries.map(function (n) { return careEntry(n, 'care-unit'); })),
        ]);
      } else if (layout === 'trio') {
        careBody = H('div', { class: 'care-layout care-track-five' }, [
          H('ol', { class: 'care-step-track' }, careEntries.map(function (n) { return careEntry(n, 'care-step', 'li'); })),
          H('aside', { class: 'care-product-point' }, [careVisuals(1)]),
        ]);
      } else if (layout === 'quad') {
        careBody = H('div', { class: 'care-layout care-consult-notes' }, [
          H('aside', { class: 'care-product-rack' }, [careVisuals(3)]),
          H('div', { class: 'care-note-stack' }, careEntries.map(function (n) { return careEntry(n, 'care-note'); })),
        ]);
      } else if (layout === 'steps') {
        careBody = H('div', { class: 'care-layout care-option-checks' }, [
          careVisuals(1, function (p) { return /JUVELOOK/i.test(p.name); }),
          H('ul', { class: 'care-option-list' }, careEntries.map(function (n) { return careEntry(n, 'care-option', 'li'); })),
        ]);
      } else if (layout === 'visits') {
        careBody = H('div', { class: 'care-layout care-life-memos' }, [
          H('div', { class: 'care-equipment-ribbon' }, [careVisuals(2)]),
          H('div', { class: 'care-memo-list' }, careEntries.map(function (n) { return careEntry(n, 'care-memo'); })),
        ]);
      } else {
        careBody = H('div', { class: 'care-layout care-exam-order' }, [
          H('ol', { class: 'care-exam-list' }, careEntries.map(function (n) { return careEntry(n, 'care-exam-step', 'li'); })),
          H('aside', { class: 'care-exam-stamp' }, [careVisuals(1)]),
        ]);
      }
      var care = ('care_title' in f || 'care_intro' in f) ? H('section', { class: 'panel care-section' }, [
        H('header', { class: 'care-header' }, [slot('h2', 'care_title', 'care-title'), slot('p', 'care_intro', 'care-intro')]),
        careBody,
      ]) : null;
      var ctaKey = 'cta_title' in f ? 'cta_title' : 'booking_title';
      var ctaLink = link(slot('a', 'booking_title', 'v2-cta-link'), 'booking');
      ctaLink.setAttribute('target', '_blank'); ctaLink.setAttribute('rel', 'noopener noreferrer');
      var cta = H('section', { class: 'panel v2-cta' }, [slot('h2', ctaKey, 'cta-title'), ctaLink]);

      var conds = ['condition2', 'condition3'].filter(function (k) { return k in f; });
      var qr = link(H('a', { class: 'qr-link', target: '_blank', rel: 'noopener noreferrer' }, [img(ASSET_QR, 'qr', 'booking_title')]), 'booking');
      var bookingTitle = link(slot('a', 'booking_title', 'booking-title'), 'booking');
      bookingTitle.setAttribute('target', '_blank'); bookingTitle.setAttribute('rel', 'noopener noreferrer');
      var info = H('section', { class: 'panel info' }, [
        conds.length ? H('ul', { class: 'conditions' }, conds.map(function (k) { return slot('li', k, 'condition'); })) : null,
        H('div', { class: 'booking-card' }, [qr, H('div', { class: 'booking-copy' }, [bookingTitle, slot('p', 'booking_text', 'booking-text')])]),
        'location' in f ? slot('p', 'location', 'location') : null,
        link(slot('a', 'contact', 'contact'), 'phone'),
        H('div', { class: 'foot-brand' }, [img(ASSET_EMBLEM, 'foot-emblem', 'brand')]),
      ]);
      var page = H('main', { class: 'landing', 'data-item': it.id, 'data-theme': it.theme || '', 'data-layout': layout }, [hero, story, offerPanel, guide, care, cta, info]);
      st.page = page; st.sig = signature();
      ui.root.replaceChildren(ui.errorHost, page, ui.dialog);
      if (!it.image) { st.imageProblem = 'item.image 경로가 없습니다 (이미지 누락)'; showMissing('item.image 경로가 없습니다.'); }
    }

    function showMissing(text) { if (st.missingBox) { st.missingBox.textContent = text; st.missingBox.hidden = false; } }
    function imageFailed(src) {
      st.imageProblem = '이미지를 불러오지 못했습니다: ' + src;
      showMissing('이미지를 불러오지 못했습니다: ' + src);
      renderBanner(problems());
    }

    /* ---- render (text only, never touches the editor dialog) ---- */
    function renderBooking(el) {
      var t = st.fields.booking_text || ''; var sep = t.indexOf(' / ');
      if (sep < 0 || !st.links.booking || !st.links.kakao) { el.textContent = t; return; }
      var mk = function (txt, href) { return H('a', { href: href, target: '_blank', rel: 'noopener noreferrer', text: txt }); };
      el.replaceChildren(mk(t.slice(0, sep), st.links.booking), doc.createTextNode(' / '), mk(t.slice(sep + 3), st.links.kakao));
    }

    function render() {
      if (signature() !== st.sig) build();
      var lobj = st.data.locales.filter(function (l) { return l.id === st.locale; })[0];
      var lang = (lobj && lobj.lang) || st.locale.toLowerCase();
      st.page.setAttribute('lang', lang); st.page.setAttribute('data-locale', st.locale);
      if (doc.documentElement) doc.documentElement.setAttribute('lang', lang);
      st.page.classList.toggle('editable', st.editable); st.page.classList.toggle('edit-mode', st.editable && st.editMode);
      st.copyEls.forEach(function (el) {
        var key = el.getAttribute('data-copy'); var v = st.fields[key];
        el.classList.toggle('is-missing', typeof v !== 'string');
        if (key === 'booking_text') renderBooking(el);
        else el.textContent = typeof v === 'string' ? v : '';
        if (st.editable) el.setAttribute('title', '더블클릭하여 수정'); else el.removeAttribute('title');
      });
      st.altEls.forEach(function (el) { el.alt = el.getAttribute('data-alt-literal') || st.fields[el.getAttribute('data-alt')] || ''; });
      st.linkEls.forEach(function (el) { var href = st.links[el.getAttribute('data-link')]; if (href) el.setAttribute('href', href); else el.removeAttribute('href'); });
      if (typeof st.fields.title === 'string') doc.title = st.fields.title;
      renderBanner(problems());
      scheduleSize();
    }

    /* ---- editing (same protocol as the aptos adapter) ---- */
    function buildDialog() {
      var ta = H('textarea', { rows: '5', maxlength: '2000', 'aria-label': '선택한 문구' });
      var info = H('p', { class: 'edit-info' });
      var cancel = H('button', { type: 'button', 'data-action': 'cancel', text: '취소' });
      var save = H('button', { type: 'button', 'data-action': 'save', text: '공유 저장' });
      var dlg = H('dialog', { class: 'edit-ui' }, [H('form', { method: 'dialog' }, [
        H('h2', { text: '문구·금액 수정' }), H('label', null, ['선택한 문구', ta]), info, H('div', { class: 'edit-actions' }, [cancel, save]),
      ])]);
      ui.dialog = dlg; ui.ta = ta; ui.info = info; ui.cancel = cancel; ui.save = save;
      function submit() {
        if (st.pending || !st.editField) return;
        if (ta.value === (st.fields[st.editField] || '')) { dlg.close(); return; }
        st.pending = true; save.disabled = true; cancel.disabled = true;
        info.textContent = '서버에 저장 중입니다…';
        post({ type: 'aptos-edit', field: st.editField, value: ta.value });
      }
      save.addEventListener('click', submit);
      cancel.addEventListener('click', function () { dlg.close(); });
      dlg.addEventListener('close', function () { post({ type: 'aptos-edit-cancel' }); st.editField = null; });
      dlg.addEventListener('cancel', function (e) { if (st.pending) e.preventDefault(); });
      ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } });
    }

    function startEdit(key) {
      if (!st.editable || st.pending || !isAllowedField(key) || ui.dialog.open) return;
      st.editField = key; ui.ta.value = st.fields[key] || '';
      ui.info.textContent = /price|vat|currency/.test(key) ? '금액은 표시된 통화·단위를 유지해 입력해 주세요.' : '';
      ui.save.disabled = false; ui.cancel.disabled = false;
      post({ type: 'aptos-editing', field: key });
      ui.dialog.showModal(); ui.ta.focus(); if (ui.ta.select) ui.ta.select();
    }

    function closestCopy(t) { for (var n = t; n; n = n.parentNode) if (n.getAttribute && n.getAttribute('data-copy')) return n; return null; }
    function closestLink(t) { for (var n = t; n; n = n.parentNode) if (n.tag === 'a' || n.tagName === 'A') return n; return null; }

    function onDblClick(e) {
      var hit = closestCopy(e.target);
      if (st.editable && hit) { e.preventDefault(); startEdit(hit.getAttribute('data-copy')); }
    }
    function onClick(e) {
      if (!st.editable) return;
      var hit = closestCopy(e.target); var a = closestLink(e.target);
      if (hit || a) e.preventDefault();
      if (hit && st.editMode) startEdit(hit.getAttribute('data-copy'));
    }

    function onMessage(e) {
      if (e.source !== env.parentWindow || e.origin !== origin()) return;
      var msg = e.data;
      if (!msg || typeof msg !== 'object' || !st.item) return;
      if (msg.type === 'aptos-data') {
        if (typeof msg.locale !== 'string' || !st.item.fields || !st.item.fields[msg.locale] || !msg.fields || typeof msg.fields !== 'object') return;
        st.locale = msg.locale;
        st.fields = Object.assign(pickAllowed(st.item.fields[msg.locale]), pickAllowed(msg.fields));
        st.editable = msg.editable === true; st.editMode = msg.editMode === true;
        render();
      } else if (msg.type === 'aptos-save-result' && msg.field === st.editField) {
        st.pending = false; ui.save.disabled = false; ui.cancel.disabled = false;
        if (msg.ok) { ui.dialog.close(); st.editField = null; }
        else ui.info.textContent = (msg.error || '저장되지 않았습니다.') + ' 최신 문구: ' + (st.fields[st.editField] || '');
      } else if (msg.type === 'aptos-start-edit' && typeof msg.field === 'string') {
        startEdit(msg.field);
      }
    }

    /* ---- start ---- */
    function start() {
      ui.root = env.root; ui.errorHost = H('div', { class: 'error-host' });
      buildDialog();
      ui.root.replaceChildren(ui.errorHost, ui.dialog);
      if (typeof env.ResizeObserver === 'function') {
        st.sizeEnabled = true;
        st.sizeObserver = new env.ResizeObserver(scheduleSize);
        st.sizeObserver.observe(ui.root);
        if (doc.fonts && doc.fonts.ready && typeof doc.fonts.ready.then === 'function') doc.fonts.ready.then(scheduleSize);
      }
      ui.root.addEventListener('dblclick', onDblClick); ui.root.addEventListener('click', onClick);
      if (env.addMessageListener) env.addMessageListener(onMessage);
      var q = parseQuery(env.location && env.location.search);
      if (!q.item) { fatal('주소의 item 값이 올바르지 않습니다. 예: ?item=D1&lang=KO'); return Promise.resolve(); }
      if (!q.lang) { fatal('주소의 lang 값이 올바르지 않습니다. 예: ?item=D1&lang=KO'); return Promise.resolve(); }
      return env.fetch(env.dataUrl || DATA_URL, { cache: 'no-store' }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }).then(function (data) {
        var item = data && Array.isArray(data.items) && data.items.filter(function (i) { return i && i.id === q.item; })[0];
        if (!item) return fatal('data.json에 항목 ' + q.item + '이(가) 없습니다.');
        if (item.kind !== 'landing') return fatal('항목 ' + q.item + '의 kind가 landing이 아닙니다 (' + item.kind + ').');
        if (!item.fields || typeof item.fields[q.lang] !== 'object' || !item.fields[q.lang]) return fatal('항목 ' + q.item + '에 언어 ' + q.lang + ' 데이터가 없습니다.');
        st.data = data; st.item = item; st.locale = q.lang;
        st.links = (data.links && typeof data.links === 'object' ? data.links : env.fallbackLinks) || {};
        st.fields = pickAllowed(item.fields[q.lang]);
        render(); st.started = true;
        post({ type: 'aptos-ready' });
      }, function (e) { fatal('data.json을 불러오지 못했습니다 (' + (e && e.message || e) + ').'); });
    }

    return { start: start, state: st };
  }

  /* ------------------------------------------------------------ browser boot */
  function boot(win) {
    var doc = win.document;
    var app = createLanding({
      document: doc, root: doc.getElementById('landing-root'), parentWindow: win.parent, selfWindow: win,
      location: win.location, fetch: win.fetch.bind(win),
      addMessageListener: function (fn) { win.addEventListener('message', fn); },
      ResizeObserver: win.ResizeObserver, requestAnimationFrame: win.requestAnimationFrame && win.requestAnimationFrame.bind(win),
      fallbackLinks: win.LANDING_COPY && win.LANDING_COPY.links,
    });
    win.__landing = app;
    app.start();
    return app;
  }

  return {
    isAllowedField: isAllowedField, parseQuery: parseQuery, layoutFor: layoutFor, collectOffers: collectOffers,
    offerImagesFor: offerImagesFor, productsFor: productsFor, v2Asset: v2Asset, miriAsset: miriAsset,
    clampFrameHeight: clampFrameHeight, missingFields: missingFields, createLanding: createLanding, boot: boot,
  };
});
