/* NAD11 NAD+ 수액 NEW OPEN! renderer + review-board protocol (aptos-* messages, same as the other V4 pages).
   Every visible word comes from copy-data.js (the three hero lines, event name, product names, composition lines and prices from
   v4/events/_data/pages.json via v4/nad11/build-nad11.cjs) and is edited in place through ../inline-edit.js.
   Display-only helpers below never change the stored text. */
(()=>{'use strict';
const DATA=window.PAGE_COPY;
if(!DATA||!DATA.locales||!DATA.locales.KO){document.documentElement.dataset.reviewError='copy-data missing';return;}
const KEYS=Object.keys(DATA.locales.KO);
const LANG={KO:'ko',EN:'en'}; /* 2026-11-10: EN at 1080×1350 (copy-data.js locales KO, EN) */
const qs=new URLSearchParams(location.search);
let locale=String(qs.get('lang')||'KO').toUpperCase();if(!DATA.locales[locale])locale='KO';
let fields={...DATA.locales[locale]};
let editable=false,editMode=false,lastHeight=0;
const root=document.documentElement;
/* ?capture=1 (board image download): no animation, fixed layout */
if(qs.get('capture')==='1')root.classList.add('is-capture');

function reply(message){if(parent!==window)parent.postMessage(message,location.origin);}
const IE=window.BBInlineEdit?window.BBInlineEdit.create({doc:document,raw:k=>fields[k]??'',send:m=>reply(m),refit:()=>{fit();report();},rerender:()=>render()}):null;

function report(){
 const main=document.querySelector('main');if(!main)return;
 const h=Math.max(300,Math.min(25000,Math.ceil(main.getBoundingClientRect().height)));
 if(h===lastHeight)return;lastHeight=h;reply({type:'aptos-size',height:h});
}
const span=(cls,t)=>{const s=document.createElement('span');if(cls)s.className=cls;s.textContent=t;return s;};
/* money: digits large, the Korean units small ('12만원' -> 12 만원) */
function setMoney(el,v){
 el.textContent='';
 for(const m of String(v||'').matchAll(/(\d[\d,.]*)|(\D+)/g))el.append(span(m[1]?'n':'u',m[0]));
}
/* two-line title: 'NAD+ 수액' / 'NEW OPEN!' (the text stays one sentence); EN: the first word / the rest ('Introducing' / 'NAD+ IV Drips!') */
function setTitle(el,v){
 el.textContent='';v=v||'';
 const m=locale==='EN'?/^(\S+)\s+(\S[\s\S]*)$/.exec(v):/^(.*?)\s+(NEW OPEN!?)$/.exec(v);
 if(!m){el.append(span('t1',v));return;}
 el.append(span('t1',m[1]),document.createTextNode(' '),span('t2',m[2]));
}
/* team line 3: the part after '맞춘' in pink; EN: the care phrase at the start ('Nutrient IV care') in pink */
function setL3(el,v){
 el.textContent='';v=v||'';
 if(locale==='EN'){const e=/^(.+?\bcare)\s+(\S[\s\S]*)$/i.exec(v);if(!e){appendKept(el,v);return;}el.append(span('hl',e[1]),document.createTextNode(' '),span('l3a',e[2]));return;}
 const m=/^(.*맞춘)\s+(.+)$/.exec(v);
 if(!m){appendKept(el,v);return;}
 el.append(span('l3a',m[1]),document.createTextNode(' '),span('hl',m[2]));
}
/* hours: the day label and the time are styled apart */
function setHours(el,v){
 el.textContent='';
 const m=/^(.*\S)(\s+)(\d{1,2}:\d{2}\s*[\u2013\u2014~-]\s*\d{1,2}:\d{2}.*)$/.exec(v||'');
 if(!m){el.textContent=v||'';return;}
 el.append(span('hd',m[1]),document.createTextNode(m[2]),span('ht',m[3]));
}
/* names that never break inside */
/* 2026-11-09: 'NAD 브이트리' is no longer kept whole (it pushed the name out of the narrow kakao B tiles); the team's names of comment #1 are */
const KEEP_KO=/(02-336-7511|VAT 10%|49%|11\.06 – 02\.28|셀 리부트|백옥 글로우|비타민 B3\(나이아신\)|나이아신\(B3\)|비타민 C|Vitamin B-complex|L-카르니틴|NAD\+ 단품|NAD\+|50mg|100mg|건강기능식품|임신·수유|'뷰티블라썸의원')/g;
/* EN (2026-11-10): phone, units, ingredient and place names */
const KEEP_EN=/(\+82-2-336-7511|VAT 10%|up to 49%|11\.06 – 02\.28|[Vv]itamin B3 \(niacin\)|Vitamin C|B vitamins|L-carnitine|Alpha-lipoic acid|Cell Reboot|White Jade Glow|Beauty Blossom Clinic|Beauty Blossom|Dr\. Geonho Lee|Hapjeong Station|Exit 3|Lines 2 & 6|Mediwon Medical Center|66 Yanghwa-ro|10:00–20:00|10:00–16:30|NAD\+|\d+ ?mg)/g;
let KEEP=KEEP_KO;
function appendKept(el,s){
 let last=0;KEEP.lastIndex=0;
 for(const m of s.matchAll(KEEP)){if(m.index>last)el.append(document.createTextNode(s.slice(last,m.index)));el.append(span('nw',m[0]));last=m.index+m[0].length;}
 if(last<s.length)el.append(document.createTextNode(s.slice(last)));
}
/* widow guard: the last two words of a wrapping line stay together */
const GUARD='.p-lead,.q-ans,.st-d,.nad-d,.cmp-d,.single-d,.c3-note,.care-tx,.notes [data-copy],.ab-lead [data-copy],.dr-quote,.ad,.way-addr > [data-copy],.hrs-note,.pr-d,.pt-d,.pr-n,.pt-n,.h-l2,.ab-title';
/* price lead: two halves at the first comma (the card A title block shows them as two lines). The text is kept exactly: the team's server value
   (2026-11-07) has no space after the comma, so no space is added; .l1.tight only adds a visual gap where the halves run on one line (B) */
function setLead(el,v){
 el.textContent='';v=v||'';
 const m=/^([^,]*,)(\s*)(\S[\s\S]*)$/.exec(v);
 if(!m){appendKept(el,v);return;}
 const a=span('l1'+(m[2]?'':' tight'),'');appendKept(a,m[1]);const b=span('l2','');appendKept(b,m[3]);
 el.append(a);if(m[2])el.append(document.createTextNode(m[2]));el.append(b);
}
/* EN price lead (2026-11-10): two sentences, one line each (A and B); a single sentence wraps as a paragraph */
function setLeadEN(el,v){
 el.textContent='';v=v||'';
 const m=/^(.+?[.!?])\s+(\S[\s\S]*)$/.exec(v);
 if(!m){appendKept(el,v);return;}
 const a=span('l1',''),b=span('l2','');appendKept(a,m[1]);appendKept(b,m[2]);el.append(a,document.createTextNode(' '),b);
}
/* card 2 A rows: the composition on one line where it fits, breaking only between the items (each item kept whole) */
function setCompLine(el,v){
 el.textContent='';
 String(v||'').split(' + ').forEach((p,i)=>{if(i)el.append(document.createTextNode(' + '));el.append(span('nw',p));});
}
/* card 2 B tiles: the composition as a list, one injection per line (the ' + ' stays in the text at the start of each next line) */
function setComp(el,v){
 el.textContent='';
 String(v||'').split(' + ').forEach((p,i)=>{const s=span('ci','');if(i)s.append(span('sep',' + '));s.append(document.createTextNode(p));el.append(s);});
}
/* card 4 title: '시술 당일은' / '이렇게 진행돼요' (team rule 2026-11-06: when it takes two lines it breaks there) */
function setQ4(el,v){
 el.textContent='';v=v||'';
 const m=/^(.*?당일은)\s+(.+)$/.exec(v);
 if(!m){appendKept(el,v);return;}
 el.append(span('q1',m[1]),document.createTextNode(' '),span('q2',m[2]));
}
/* card 3 title: the two halves at the comma (kakao shows them as two lines) */
function setQ3(el,v){
 el.textContent='';v=v||'';
 const i=v.indexOf(', ');
 if(i<0){appendKept(el,v);return;}
 el.append(span('qa',v.slice(0,i+1)),document.createTextNode(' '),span('qb',v.slice(i+2)));
}
function setText(el,v){
 if(el.classList.contains('money')){setMoney(el,v);return;}
 if(el.classList.contains('p-lead')){if(locale==='EN')setLeadEN(el,v);else setLead(el,v);return;}
 if(el.classList.contains('pt-d')){setComp(el,v);return;}
 if(el.classList.contains('pr-d')){setCompLine(el,v);return;}
 if(el.matches('.c4 .q-title')){setQ4(el,v);return;}
 if(el.matches('.c3 .q-title')){setQ3(el,v);return;}
 if(el.classList.contains('h-title')||el.classList.contains('p-title')){setTitle(el,v);return;}
 if(el.classList.contains('h-l3')){setL3(el,v);return;}
 if(el.matches('.hrs [data-copy]')){setHours(el,v);return;}
 v=v||'';
 if(!el.matches(GUARD)){el.textContent='';appendKept(el,v);return;}
 const m=v.match(/(\S+[ \t]+\S+)$/);
 if(!m||m[1].length>=v.length){el.textContent='';appendKept(el,v);return;}
 let cut=v.length-m[1].length;KEEP.lastIndex=0;
 for(const k of v.matchAll(KEEP))if(cut>k.index&&cut<k.index+k[0].length)cut=k.index;
 el.textContent='';appendKept(el,v.slice(0,cut));el.append(span('nw',v.slice(cut)));
}
function fitTo(el,limit,min){
 el.style.removeProperty('--fit');
 for(let f=1,i=0;i<40&&el.scrollWidth>limit+1&&f>min;i++){f-=.02;el.style.setProperty('--fit',f.toFixed(3));}
}
function fit(){
 /* home only (the size modes are fixed 1080-scale screens): title lines and the hero team lines stay on one line each at narrow widths */
 if(root.dataset.size!=='home')return;
 for(const el of document.querySelectorAll('.h-title .t1,.h-title .t2,.p-title .t1,.p-title .t2')){fitTo(el,el.parentElement.clientWidth*.98,.6);}
 for(const el of document.querySelectorAll('.ha-l2,.ha-l3,.hb-l2,.hb-l3')){fitTo(el,el.parentElement.clientWidth,.7);}
}
function render(){
 root.lang=LANG[locale]||'ko';root.dataset.locale=locale;KEEP=locale==='EN'?KEEP_EN:KEEP_KO;
 root.classList.toggle('is-editable',editable);
 root.classList.toggle('is-editmode',editable&&editMode);
 for(const el of document.querySelectorAll('[data-copy]')){
  if(IE&&IE.holds(el))continue; /* never overwrite the copy someone is typing in */
  const v=fields[el.dataset.copy]??'';setText(el,v);
  const empty=!String(v).trim();el.classList.toggle('is-empty',empty);
  if(el.hasAttribute('data-optional'))el.hidden=empty&&!(editable&&editMode);
 }
 for(const g of document.querySelectorAll('[data-optional-group]'))g.hidden=[...g.querySelectorAll('[data-optional]')].every(e=>e.hidden);
 for(const el of document.querySelectorAll('[data-alt]'))el.alt=fields[el.dataset.alt]??'';
 const CH=(DATA.channels&&DATA.channels[locale])||null;
 for(const a of document.querySelectorAll('a[data-link]')){
  const n=a.dataset.link;const href=CH&&(n in CH)?CH[n]:(DATA.links&&DATA.links[n]);if(href)a.href=href;else a.removeAttribute('href');
  if(n!=='phone'){a.target='_blank';a.rel='noopener noreferrer';}
 }
 for(const img of document.querySelectorAll('img[data-qr]')){const q=CH&&CH.qr;if(q&&img.getAttribute('src')!==q)img.setAttribute('src',q);}
 const GM=(DATA.gmap&&DATA.gmap[locale])||null;
 for(const el of document.querySelectorAll('[data-gmap]')){const u=GM&&GM[el.dataset.gmap];if(!u)continue;const a=el.tagName==='SOURCE'?'srcset':'src';if(el.getAttribute(a)!==u)el.setAttribute(a,u);}
 for(const w of document.querySelectorAll('[data-bk-alt]')){const lab=w.querySelector('[data-copy]');w.hidden=!String((lab&&fields[lab.dataset.copy])??'').trim()&&!(editable&&editMode);}
 document.title=[fields[DATA.titleKey]||'','BEAUTY BLOSSOM'].filter(Boolean).join(' \u00b7 ');
 if(IE)IE.sync(editable);
 requestAnimationFrame(()=>{fit();report();});
 if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{fit();report();});
 root.dataset.reviewReady='true';
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
render();
window.__ND11__={get locale(){return locale;},get editable(){return editable;},get editMode(){return editMode;},get inline(){return !!IE;},keys:KEYS};
reply(IE?{type:'aptos-ready',inline:true}:{type:'aptos-ready'});
})();
