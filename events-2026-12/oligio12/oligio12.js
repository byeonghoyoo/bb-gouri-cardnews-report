/* 12월 올리지오 XM (OXM12) renderer + review-board protocol (aptos-* messages, same as site/exam/exam.js).
   Every visible word comes from copy-data.js and is edited in place through ../inline-edit.js. */
(()=>{'use strict';
const DATA=window.PAGE_COPY;
if(!DATA||!DATA.locales||!DATA.locales.KO){document.documentElement.dataset.reviewError='copy-data missing';return;}
const KEYS=Object.keys(DATA.locales.KO);
const LANG={KO:'ko',EN:'en',JP:'ja',CN:'zh-CN',TW:'zh-TW',TH:'th',HK:'zh-HK'};
const G='https://fonts.googleapis.com/css2?';
const FONT_CSS={
 JP:G+'family=Noto+Sans+JP:wght@400;500;600;700;800&display=swap',
 CN:G+'family=Noto+Sans+SC:wght@400;500;600;700;800&display=swap',
 TW:G+'family=Noto+Sans+TC:wght@400;500;600;700;800&display=swap',
 HK:G+'family=Noto+Sans+TC:wght@400;500;600;700;800&display=swap',
 TH:G+'family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap'
};
const qs=new URLSearchParams(location.search);
let locale=String(qs.get('lang')||'KO').toUpperCase();if(!DATA.locales[locale])locale='KO';
let fields={...DATA.locales[locale]};
let editable=false,editMode=false,lastHeight=0;
const root=document.documentElement;

function reply(message){if(parent!==window)parent.postMessage(message,location.origin);}
const IE=window.BBInlineEdit?window.BBInlineEdit.create({doc:document,raw:k=>fields[k]??'',send:m=>reply(m),refit:()=>{fit();report();},rerender:()=>render()}):null;

function report(){
 const main=document.querySelector('main');if(!main)return;
 const h=Math.max(300,Math.min(25000,Math.ceil(main.getBoundingClientRect().height)));
 if(h===lastHeight)return;lastHeight=h;reply({type:'aptos-size',height:h});
}
function setFonts(){
 let l=document.getElementById('locale-fonts');const href=FONT_CSS[locale]||'';
 if(!href){if(l)l.remove();return;}
 if(!l){l=document.createElement('link');l.id='locale-fonts';l.rel='stylesheet';document.head.append(l);
  l.addEventListener('load',()=>document.fonts.ready.then(()=>{fit();report();}));}
 if(l.getAttribute('href')!==href)l.setAttribute('href',href);
}

/* money: the number large, the unit small (display only; the stored text stays exactly as typed) */
function setMoney(el,v){
 el.textContent='';
 const m=/^(\D*?)(\d[\d,.]*)(.*)$/.exec(v||'');
 if(!m){el.textContent=v||'';return;}
 if(m[1]){const p=document.createElement('span');p.className='u pre';p.textContent=m[1];el.append(p);}
 const n=document.createElement('span');n.className='n';n.textContent=m[2];el.append(n);
 if(m[3]){const s=document.createElement('span');s.className='u';s.textContent=m[3];el.append(s);}
}
/* widow guard: the last two words (CJK: last three characters) stay together; the phone number never breaks */
const GUARD='.hook span,.t-pre,.grp-title,.contact,.p2-foot .vat,.name [data-copy]:not(.badge):not(.pre),.notes [data-copy],.cx-q,.cx-a,.en-desc,.depth-title,.depth-note,.band [data-copy],.sd,.iv,.in,.st,.at,.ad,.ab-title,.ab-lead [data-copy],.dr-quote,.way-addr > [data-copy],.hrs-note,.bk-links [data-copy],.bb-ba__title,.bb-ba__note'; /* 2026-11-03: B/A card title and note */
/* names that must never break inside (display only: wrapped in nowrap spans, the stored text is unchanged) */
const KEEP=/(\u0e2e\u0e31\u0e1a\u0e08\u0e2d\u0e07|Beauty Blossom|Oligio XM|02-336-7511|\u30d3\u30e5\u30fc\u30c6\u30a3\u30fc\u30d6\u30ed\u30c3\u30b5\u30e0|\u30ab\u30ab\u30aa\u30c8\u30fc\u30af|Head Director|Chat on WhatsApp|\u0e1c\u0e39\u0e49\u0e2d\u0e33\u0e19\u0e27\u0e22\u0e01\u0e32\u0e23\u0e04\u0e25\u0e34\u0e19\u0e34\u0e01|\u0e04\u0e27\u0e32\u0e21\u0e21\u0e31\u0e48\u0e19\u0e43\u0e08)/g; /* 2026-11-23: + the TH word '\u0e04\u0e27\u0e32\u0e21\u0e21\u0e31\u0e48\u0e19\u0e43\u0e08' of the reviewed card-6 title (it occurs only there); 2026-10-30b: card 5 only (these words do not occur on cards 1-4): JP clinic name, KakaoTalk, the director's title */
/* 2026-11-20 CN (reviewed copy, lead order): Chinese words / phrases kept the same way, so a CN line never breaks inside them ('\u82b1|\u5f00', '\u81ea|\u7136', '\u6807|\u51c6', '\u8d85|\u58f0\u6ce2',
   '\u5c04|\u9891', '6|\u697c' ...); display only (nowrap spans, the stored text is unchanged) and only on the CN page: every other language keeps exactly the list above */
const KEEP_CN=new RegExp(KEEP.source.slice(0,-1)+'|\u51ac\u65e5\u91cc\u4e5f\u6709\u82b1\u5f00\u7684\u5730\u65b9|\u8ffd\u6c42\u81ea\u7136\u4e4b\u7f8e|\u6807\u51c6\u7528\u91cf|\u5468\u672b\u63a5\u8bca|\u8bbe\u5907\u53c2\u6570\u800c\u5b9a|\u5171\u540c\u786e\u5b9a|\u76ae\u80a4\u8868\u9762|\u63d0\u62c9HIFU\u8d85\u58f0\u6ce2\\d+\u53d1|\u7f8e\u7248\u8d85\u58f0\u5200\u4e8c\u4ee3\\d+\u53d1|\u8d85\u58f0\u6ce2\u63a2\u5934|\u8d85\u58f0\u6ce2|\u5c04\u9891|\\d+\u697c|MediOne Medical Center|\u5236\u5b9a\u65b9\u6848|\u7ffb\u8bd1\u4eba\u5458|\u4e25\u683c|\u4e0d\u540c|\u72b6\u6001|\u66f4\u52a0\u95ea\u8000|\u6bcf\u4e00\u5929)','g'); /* 2026-11-23: + '\u66f4\u52a0\u95ea\u8000', '\u6bcf\u4e00\u5929' of the reviewed card-6 title (only there) */
/* 2026-11-23 HK (reviewed copy, lead order): the HK words kept the same way, so an HK line never breaks inside a word or a number ('\u5c04|\u983b',
   '\u8d85\u8072|\u6ce2', '600|\u767c', '+82 10-7215-|7511', '\u500b\u4eba|\u5316' ...); display only (nowrap spans, the stored text is unchanged) and only on the HK page */
const KEEP_HK=new RegExp(KEEP.source.slice(0,-1)+'|\\+82 10-7215-7511|\\+82-2-336-7511|Ultherapy PRIME|3\\.0mm \u00b7 4\\.5mm|HIFU\u805a\u7126\u8d85\u8072\u6ce2|HIFU\u8d85\u8072\u6ce2\\d+\u767c|RF\u5c04\u983b\\d+\u767c|\u8d85\u8072\u5200\\d+\u767c|\\d+\u767c|RF\u5c04\u983b|\u805a\u7126\u8d85\u8072\u6ce2|\u8d85\u8072\u6ce2|\u5c04\u983b|\u63d0\u5347|\u7dca\u7dfb|\u7d30\u7dfb\u8b77\u7406|\u5100\u5668|\u7528\u91cf|\u500b\u4eba\u5316|\u4e00\u5c0d\u4e00|\u6548\u679c|\u9031\u672b|\u7ffb\u8b6f|\u65e5\u8a9e|\u6cf0\u8a9e|\u7642\u7a0b|\u8a2d\u5b9a|\u8aee\u8a62\u6642|\u4e00\u540c|\u8868\u9762|\u6df1\u5ea6)','g');
/* 2026-11-23 TW (reviewed copy, lead order): the TW words kept the same way ('RF|\u96fb\u6ce2', '600|\u767c', '\u81ea|\u7136\u4e4b\u7f8e', '\u5c08|\u5c6c\u8aee\u8a62', the LINE name in corner
   brackets ...); display only (nowrap spans, the stored text is unchanged) and only on the TW page */
const KEEP_TW=new RegExp(KEEP.source.slice(0,-1)+'|RF\u96fb\u6ce2\\d+\u767c|HIFU\u97f3\u6ce2\\d+\u767c|\u7f8e\u570b\u97f3\u6ce2\u4e8c\u4ee3\\d+\u767c|\\d+\u767c|RF\u96fb\u6ce2|Medione\u91ab\u7642\u4e2d\u5fc3|\u300c\ud83c\udf38\u9e97\u6735\u8a3a\u6240\ud83c\udf38\u300d|\u805a\u7126\u8d85\u97f3\u6ce2|\u773c\u5468\u7dda\u689d|\u81ea\u7136\u4e4b\u7f8e|\u8db3\u91cf\u65bd\u4f5c|\u5c08\u5c6c\u8aee\u8a62|\u9031\u672b\u9580\u8a3a|\u7ffb\u8b6f\u670d\u52d9|\u96fb\u6ce2\u6280\u8853|\u808c\u819a\u8868\u9762|\u8aee\u8a62\u6642|\u8a2d\u5099|\u76ee\u6a19|\u8a2d\u5b9a|\u4e00\u8d77|\u5e33\u865f|\u642d\u914d|\u5176\u4e2d|\u96d9\u80fd\u91cf|HIFU\u97f3\u6ce2|\u773c\u5468)','g');
const keepRe=()=>locale==='CN'?KEEP_CN:locale==='HK'?KEEP_HK:locale==='TW'?KEEP_TW:KEEP;
function appendKept(el,s){
 let last=0;
 for(const m of s.matchAll(keepRe())){
  if(m.index>last)el.append(document.createTextNode(s.slice(last,m.index)));
  const k=document.createElement('span');k.className='nw';k.textContent=m[0];el.append(k);last=m.index+m[0].length;
 }
 if(last<s.length)el.append(document.createTextNode(s.slice(last)));
}
/* card 5 hours: the day label and the time are styled apart (display only; the stored text stays exactly as typed) */
function setHours(el,v){
 el.textContent='';
 const m=/^(.*\S)(\s+)(\d{1,2}:\d{2}\s*[\u2013\u2014~-]\s*\d{1,2}:\d{2}.*)$/.exec(v||'');
 if(!m){el.textContent=v||'';return;}
 const d=document.createElement('span');d.className='hd';d.textContent=m[1];
 const t=document.createElement('span');t.className='ht';t.textContent=m[3];
 el.append(d,document.createTextNode(m[2]),t);
}
function setText(el,v){
 if(el.classList.contains('money')){setMoney(el,v);return;}
 if(el.matches('.hrs [data-copy]')){setHours(el,v);return;}
 const K=keepRe();if(v&&!el.matches(GUARD)&&K.test(v)){K.lastIndex=0;el.textContent='';appendKept(el,v);return;}
 K.lastIndex=0;
 if(!v||!el.matches(GUARD)){el.textContent=v;return;}
 let m=null;
 if(/^(JP|CN|TW|HK)$/.test(locale))m=v.match(/([^\s]{3}[\u3002\u3001\uff0c\uff0e\uff01\uff1f!?\u2026\uff09)\]\u00b7]*)$/u);
 else if(locale!=='TH')m=el.matches('.ab-title')?v.match(/(\S+[ \t]+\S{1,3})$/):v.match(/(\S+[ \t]+\S+)$/); /* card 5 title: only a very short last word is kept with the previous one, so the Korean title breaks before '뷰티블라썸' */
 if(!m&&/\d{2,3}-\d{3,4}-\d{4}$/.test(v))m=v.match(/(\S*\d{2,3}-\d{3,4}-\d{4})$/);
 if(m&&(el.closest('.p5')||locale==='CN'||locale==='HK'||locale==='TW')){let cut=v.length-m[1].length;for(const k of v.matchAll(K))if(cut>k.index&&cut<k.index+k[0].length)cut=k.index;m=cut>0?[null,v.slice(cut)]:null;} /* card 5 (and every CN card, 2026-11-20; every HK / TW card, 2026-11-23): never split a kept word at the widow cut */
 if(!m||m[1].length>=v.length){el.textContent='';appendKept(el,v);return;}
 const tail=document.createElement('span');tail.className='nw';tail.textContent=m[1];
 el.textContent='';appendKept(el,v.slice(0,v.length-m[1].length));el.append(tail);
}

function isPhone(){const m=document.querySelector('main');return !!m&&m.clientWidth<=600;}
function fitTo(el,limit,min){
 el.style.removeProperty('--fit');
 for(let f=1,i=0;i<40&&el.scrollWidth>limit+1&&f>min;i++){f-=.02;el.style.setProperty('--fit',f.toFixed(3));}
 return el.scrollWidth<=limit+1;
}
function fitLines(el,lines,min){
 el.style.removeProperty('--fit');
 const lh=()=>parseFloat(getComputedStyle(el).lineHeight)||0;
 for(let f=1,i=0;i<30&&(el.getBoundingClientRect().height>lh()*lines+2||el.scrollWidth>el.clientWidth+1)&&f>min;i++){f-=.02;el.style.setProperty('--fit',f.toFixed(3));}
}
function fit(){
 for(const el of document.querySelectorAll('.t-main'))fitTo(el,el.parentElement.clientWidth,.55);
 const phone=isPhone();
 /* 2026-11-03 B/A card: the treatment name stays on one line on desktop and tablet */
 for(const el of document.querySelectorAll('.bb-ba__title')){if(phone){el.style.removeProperty('--fit');continue;}fitTo(el,el.clientWidth,.6);}
 for(const el of document.querySelectorAll('.grp-title')){
  el.classList.remove('wrap');
  if(phone){el.style.removeProperty('--fit');continue;}
  if(!fitTo(el,el.clientWidth,.78))el.classList.add('wrap');
 }
 for(const el of document.querySelectorAll('.row .name')){
  el.classList.remove('wrap');
  if(phone){el.style.removeProperty('--fit');continue;}
  if(!fitTo(el,el.clientWidth,.72))el.classList.add('wrap');
 }
 /* card 5 (desktop): the title and the strength titles shrink to at most two lines */
 for(const el of document.querySelectorAll('.ab-title,.ab-strengths .at')){if(phone){el.style.removeProperty('--fit');continue;}fitLines(el,2,.74);}
 /* 49% seal: each line shrinks to the inner circle */
 for(const el of document.querySelectorAll('.seal .sl'))fitTo(el,el.parentElement.clientWidth,.6);
}

function render(){
 root.lang=LANG[locale]||'ko';root.dataset.locale=locale;
 root.classList.toggle('is-editable',editable);
 root.classList.toggle('is-editmode',editable&&editMode);
 setFonts();
 for(const el of document.querySelectorAll('[data-copy]')){
  if(IE&&IE.holds(el))continue; /* never overwrite the copy someone is typing in */
  const v=fields[el.dataset.copy]??'';setText(el,v);
  const empty=!String(v).trim();el.classList.toggle('is-empty',empty);
  if(el.hasAttribute('data-optional'))el.hidden=empty&&!(editable&&editMode);
 }
 for(const g of document.querySelectorAll('[data-optional-group]'))g.hidden=[...g.querySelectorAll('[data-optional]')].every(e=>e.hidden);
 for(const el of document.querySelectorAll('[data-alt]'))el.alt=fields[el.dataset.alt]??'';
 const CH=(DATA.channels&&DATA.channels[locale])||null; /* 2026-10-29: per-locale consultation channels (v4/_shared/channels/CHANNELS.json) */
 for(const a of document.querySelectorAll('a[data-link]')){
  const n=a.dataset.link;const href=CH&&(n in CH)?CH[n]:(DATA.links&&DATA.links[n]);if(href)a.href=href;else a.removeAttribute('href');
  if(n!=='phone'){a.target='_blank';a.rel='noopener noreferrer';}
 }
 /* 2026-11-23 reviewed TW (lead order; the LIG12 / ONE12 / CMB12A-E TW rule): the card-6 phone field may hold the country's chat ID (TW LINE ID
    '@beautyblossom_tw') instead of a number; then a chat icon replaces the phone icon and the line opens the booking LINE instead of tel:. TW only: the
    other languages keep their published phone line */
 {const CHAT_D='M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.6 6.2L4.8 21l4.2-2.3c1 .2 2 .3 3 .3 5.5 0 10-3.6 10-8s-4.5-8-10-8z';
  for(const p of document.querySelectorAll('.bk-phone')){const sp=p.querySelector('[data-copy]'),v=String((sp&&fields[sp.dataset.copy])??'').trim(),id=locale==='TW'&&!!v&&!/^\+?\d[\d\s\-().]*$/.test(v);
   p.classList.toggle('is-id',id);const ico=p.querySelector('svg.ph-ico path');if(ico){if(!ico.dataset.d0)ico.dataset.d0=ico.getAttribute('d');const d=id?CHAT_D:ico.dataset.d0;if(ico.getAttribute('d')!==d)ico.setAttribute('d',d);}
   const a=p.querySelector('a[data-link="phone"]');if(a){if(id&&CH&&CH.booking){a.href=CH.booking;a.target='_blank';a.rel='noopener noreferrer';}else{a.removeAttribute('target');a.removeAttribute('rel');}}}}
 for(const img of document.querySelectorAll('img[data-qr]')){const q=CH&&CH.qr;if(q&&img.getAttribute('src')!==q)img.setAttribute('src',q);}
 /* 2026-10-30c: card-5 Google map, this locale's own capture for every width tier (copy-data gmap; the picture sources pick the tier) */
 const GM=(DATA.gmap&&DATA.gmap[locale])||null;
 for(const el of document.querySelectorAll('[data-gmap]')){const u=GM&&GM[el.dataset.gmap];if(!u)continue;const a=el.tagName==='SOURCE'?'srcset':'src';if(el.getAttribute(a)!==u)el.setAttribute(a,u);}
 for(const w of document.querySelectorAll('[data-bk-alt]')){const lab=w.querySelector('[data-copy]');w.hidden=!String((lab&&fields[lab.dataset.copy])??'').trim()&&!(editable&&editMode);}
 document.title=[fields.ox_title_main||'oligio xm',fields.ox_brand||'BEAUTY BLOSSOM'].join(' \u00b7 ');
 if(IE)IE.sync(editable);
 typeSwap();
 logoSwap();
 requestAnimationFrame(()=>{fit();report();});
 document.fonts.ready.then(()=>{fit();report();});
 root.dataset.reviewReady='true';
}

/* Miricanvas typography: the image replaces the live text only while the on-screen text equals the text drawn in the image,
   for the listed locales, and not while someone is typing in it. Any edit falls back to the live text automatically. */
const typeLoaded={};
const norm=s=>String(s||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
function typeSwap(){
 for(const el of document.querySelectorAll('[data-type-src]')){
  const src=el.dataset.typeSrc;
  if(!(src in typeLoaded)){typeLoaded[src]=null;const im=new Image();im.onload=()=>{typeLoaded[src]=im.naturalWidth>0;typeSwap();report();};im.onerror=()=>{typeLoaded[src]=false;};im.src=src;}
  if(!el.style.getPropertyValue('--type'))el.style.setProperty('--type','url("'+src+'")');
  const locs=(el.dataset.typeLocales||'*').split(',');
  const keys=(el.dataset.typeKeys||el.dataset.copy||'').split('|');
  const want=(el.dataset.typeText||'').split('|');
  const shown=keys.map(k=>{const t=el.dataset.copy===k?el:el.querySelector('[data-copy="'+k+'"]');return t?norm(t.textContent):null;});
  const same=keys.length===want.length&&shown.every((v,i)=>v!==null&&v===norm(want[i]));
  const typing=el.contains(document.activeElement)&&document.activeElement.isContentEditable;
  el.classList.toggle('typed',typeLoaded[src]===true&&(locs.includes('*')||locs.includes(locale))&&same&&!typing&&!el.hidden);
 }
}
/* 2026-10-30: the 'oligio xm' titles show the official white logo (img alt 'oligio xm') while the text reads exactly 'oligio xm'.
   The editable text stays on top of the logo; while someone types, or after the name is edited, the live text is shown instead. */
function logoSwap(){
 for(const img of document.querySelectorAll('img.t-logo')){
  const wrap=img.parentElement,main=wrap&&wrap.querySelector('.t-main');if(!main)continue;
  const same=norm(main.textContent).toLowerCase()===norm(img.dataset.logoText||'oligio xm').toLowerCase(); /* 2026-11-19: the reviewed TH writes 'OLIGIO XM'; the same name in capitals still shows the official logo */
  const typing=main.contains(document.activeElement)&&document.activeElement.isContentEditable;
  const on=img.complete&&img.naturalWidth>0&&same&&!typing;
  if(wrap.classList.contains('is-logo')!==on){wrap.classList.toggle('is-logo',on);requestAnimationFrame(()=>{fit();report();});}
  if(on&&!main.isContentEditable)main.setAttribute('aria-hidden','true');else main.removeAttribute('aria-hidden');
  if(!img.complete)img.addEventListener('load',logoSwap,{once:true});
 }
}
document.addEventListener('focusin',()=>{typeSwap();logoSwap();});
document.addEventListener('focusout',()=>setTimeout(()=>{typeSwap();logoSwap();},0));

/* Miricanvas decorations: shown when the file exists, otherwise the code-drawn fallback stays */
function miri(){
 for(const img of document.querySelectorAll('img.miri')){
  const w=img.parentElement;
  const ok=()=>{w.classList.add('ok');const sec=w.closest('section');if(sec&&w.dataset.kind)sec.classList.add('has-'+w.dataset.kind);report();};
  const bad=()=>{img.remove();};
  if(img.complete){if(img.naturalWidth)ok();else bad();}
  else{img.addEventListener('load',ok,{once:true});img.addEventListener('error',bad,{once:true});}
 }
}

window.addEventListener('message',event=>{
 if(event.source!==parent||event.origin!==location.origin)return;
 const msg=event.data;if(!msg||typeof msg!=='object')return;
 if(msg.type==='aptos-data'&&DATA.locales[msg.locale]&&msg.fields&&typeof msg.fields==='object'){
  if(msg.locale!==locale){locale=msg.locale;fields={...DATA.locales[locale]};}
  for(const k of KEYS)if(typeof msg.fields[k]==='string')fields[k]=msg.fields[k];
  editable=msg.editable===true;editMode=msg.editMode===true;render();
 }else if(msg.type==='aptos-save-result'){
  if(IE)IE.saveResult(msg);
 }else if(msg.type==='aptos-start-edit'&&typeof msg.field==='string'){
  if(IE)IE.start(msg.field);
 }
});

window.addEventListener('resize',()=>{fit();report();});
if(document.fonts&&document.fonts.addEventListener)document.fonts.addEventListener('loadingdone',()=>{fit();report();});
const main=document.querySelector('main');
if(main&&'ResizeObserver' in window)new ResizeObserver(report).observe(main);
for(const img of document.images){if(!img.complete){img.addEventListener('load',report,{once:true});img.addEventListener('error',report,{once:true});}}
render();miri();
window.__OXM12__={get locale(){return locale;},get editable(){return editable;},get editMode(){return editMode;},get inline(){return !!IE;},keys:KEYS};
reply(IE?{type:'aptos-ready',inline:true}:{type:'aptos-ready'});
})();
