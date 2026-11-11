/* SUN11 수능이벤트 renderer + review-board protocol (aptos-* messages, same as the other V4 pages).
   Every visible word comes from copy-data.js (the three hero lines, event name, product names, descriptions and prices from
   v4/events/_data/pages.json via v4/suneung11/build-suneung11.cjs) and is edited in place through ../inline-edit.js.
   Display-only helpers below never change the stored text. */
(()=>{'use strict';
const DATA=window.PAGE_COPY;
if(!DATA||!DATA.locales||!DATA.locales.KO){document.documentElement.dataset.reviewError='copy-data missing';return;}
const KEYS=Object.keys(DATA.locales.KO);
const qs=new URLSearchParams(location.search);
let locale=String(qs.get('lang')||'KO').toUpperCase();if(!DATA.locales[locale])locale='KO';
let fields={...DATA.locales[locale]};
/* 2026-11-11 language versions (TW first; copy = v4/langverify/out/SUN11.final.json, the staff's correction first): <html lang> drives the language
   font and the layout rules in suneung11-i18n.css (:lang()); the Google font of the language is added here (same as BLF11 / ULT5). Korean renders
   exactly as before: every language branch below runs only when the locale is not KO. */
const LANG={KO:'ko',EN:'en',JP:'ja',CN:'zh-CN',TW:'zh-TW',TH:'th',HK:'zh-HK'};
const FONT_FAMILY={JP:'Noto Sans JP',CN:'Noto Sans SC',TW:'Noto Sans TC',HK:'Noto Sans TC',TH:'Noto Sans Thai'};
function setFonts(){let l=document.getElementById('locale-fonts');const family=FONT_FAMILY[locale];if(!family){if(l)l.remove();return;}if(!l){l=document.createElement('link');l.id='locale-fonts';l.rel='stylesheet';document.head.append(l);l.addEventListener('load',()=>document.fonts.ready.then(()=>{fit();report();}));}const href='https://fonts.googleapis.com/css2?family='+family.replace(/ /g,'+')+':wght@400;500;600;700;800;900&display=swap';if(l.getAttribute('href')!==href)l.setAttribute('href',href);}
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
/* money: digits large, the Korean units small ('9만9천원' -> 9 만 9 천원) */
function setMoney(el,v){
 el.textContent='';
 for(const m of String(v||'').matchAll(/(\d[\d,.]*)|(\D+)/g))el.append(span(m[1]?'n':'u',m[0]));
}
/* puffy title: two lines after the first comma (the text stays the same); language versions: also after the full-width comma ('考試結束，美麗正式開始！') */
function setTitle(el,v){
 el.textContent='';v=v||'';
 const i=v.indexOf(', ');
 if(i<0){const j=locale==='KO'?-1:v.indexOf('\uFF0C');if(j>0&&j<v.length-1){el.append(span('t1',v.slice(0,j+1)),span('t2',v.slice(j+1)));return;}el.append(span('t1',v));return;}
 el.append(span('t1',v.slice(0,i+1)),document.createTextNode(' '),span('t2',v.slice(i+2)));
}
/* product lists: each name stays on one line, ' · ' between (language versions: the copy's own separator, '・' in TW) */
function setItems(el,v){
 el.textContent='';
 if(locale!=='KO'){String(v||'').split(/(\s*[\u00B7\u30FB]\s*)/).forEach((p,i)=>{if(i%2)el.append(span('sep',p));else if(p)el.append(span('it',p));});return;}
 String(v||'').split(' · ').forEach((p,i)=>{if(i)el.append(span('sep',' · '));el.append(span('it',p));});
}
/* hours: the day label and the time are styled apart */
function setHours(el,v){
 el.textContent='';
 const m=/^(.*\S)(\s+)(\d{1,2}:\d{2}\s*[\u2013\u2014~-]\s*\d{1,2}:\d{2}.*)$/.exec(v||'');
 if(!m){el.textContent=v||'';return;}
 el.append(span('hd',m[1]),document.createTextNode(m[2]),span('ht',m[3]));
}
/* names that never break inside */
const KEEP=/(02-336-7511|VAT 10%|49%|11\.19 – 12\.31|3D 피부진단|피부 상태|'뷰티블라썸의원'|자외선 차단|졸업 사진|복용 중인 약|붉어짐·부기|3회·5회)/g;
/* language versions: their own phrases that never break inside (the LINE ID, phone numbers, the period, product words with figures) */
const KEEPX=/(@beautyblossom_tw|\+82-2-336-7511|02-336-7511|11\.19 – 12\.31|VAT 10%|10%|49%|QR Code|Line官方帳號|Accu Toning|Blossom Fit|LinearZ|NUVIJU|Coretox|Medione|\d[\d,.]*(?:cc|KJ|發|次|分鐘))/g;
const keepOf=()=>locale==='KO'?KEEP:KEEPX;
function appendKept(el,s){
 const KEEP=keepOf();
 let last=0;KEEP.lastIndex=0;
 for(const m of s.matchAll(KEEP)){if(m.index>last)el.append(document.createTextNode(s.slice(last,m.index)));el.append(span('nw',m[0]));last=m.index+m[0].length;}
 if(last<s.length)el.append(document.createTextNode(s.slice(last)));
}
/* hero A ticket (team comment #1, 2026-11-06): team line 3 shown as two lines, the '최대' tag, a big number and the rest; the stored sentence is unchanged */
function setTicket(el,v){
 el.textContent='';v=v||'';
 /* language versions: the same parts ('從肌膚管理到拉提療程，' / '最高享' / '49%' / '優惠！') */
 const m=/^(.*?)\s*(최대)\s*(\d+\s*%)\s*(.*)$/.exec(v)||(locale==='KO'?null:/^(.*?[\uFF0C,])\s*(最高享?)\s*(\d+\s*%)\s*(.*)$/.exec(v));
 if(!m){appendKept(el,v);return;}
 const b=span('l3b','');b.append(span('tag',m[2]),document.createTextNode(' '),span('num',m[3]),document.createTextNode(' '),span('rest',m[4]));
 el.append(span('l3a',m[1]),document.createTextNode(' '),b);
}
/* language versions (Chinese): headings break between phrases: each phrase up to and including '，' '、' '・' is one inline block (i18n CSS), so a
   two-line heading or lead breaks after the punctuation ('！' '？' '。' too), never inside a word ('第一次來院，' / '療程會怎麼進行？'); a phrase wider than its box still wraps inside */
const PHRASED='.q-title,.p-lead,.ab-strengths .at';
function setPhrases(el,v){el.textContent='';String(v||'').split(/(?<=[\uFF0C\u3001\u30FB\u00B7\uFF01\uFF1F\u3002])/).forEach(p=>{if(!p)return;const s=span('ph','');appendKept(s,p);el.append(s);});}
/* widow guard: the last two words of a wrapping line stay together */
const GUARD='.p-lead,.q-ans,.gd-d,.st-d,.tip-d,.tip-d2,.care [data-copy],.notes [data-copy],.ab-lead [data-copy],.dr-quote,.ad,.way-addr > [data-copy],.hrs-note,.pr-d,.pt-d,.pr-n,.pt-n,.h-l2 [data-copy],.h-l3,.ab-title';
function setText(el,v){
 if(el.classList.contains('money')){setMoney(el,v);return;}
 if(el.classList.contains('ha-l3')){setTicket(el,v);return;}
 if(el.classList.contains('h-title')){setTitle(el,v);return;}
 if(el.classList.contains('gd-it')){setItems(el,v);return;}
 if(el.matches('.hrs [data-copy]')){setHours(el,v);return;}
 v=v||'';
 if(locale!=='KO'&&el.matches(PHRASED)){setPhrases(el,v);return;}
 if(!el.matches(GUARD)){el.textContent='';appendKept(el,v);return;}
 /* language versions (Chinese): the last three characters (and the punctuation after them) stay together, as on BLF11 */
 const m=locale==='KO'||locale==='EN'?v.match(/(\S+[ \t]+\S+)$/):locale==='TH'?null:v.match(/([^\s]{3}[\u3002\uFF01\uFF1F\uFF0C\u3001\uFF09)]*)$/u);
 if(!m||m[1].length>=v.length){el.textContent='';appendKept(el,v);return;}
 let cut=v.length-m[1].length;const KEEP=keepOf();KEEP.lastIndex=0;
 for(const k of v.matchAll(KEEP))if(cut>k.index&&cut<k.index+k[0].length)cut=k.index;
 if(locale!=='KO'&&cut<=0){el.textContent='';appendKept(el,v);return;}
 el.textContent='';appendKept(el,v.slice(0,cut));el.append(span('nw',v.slice(cut)));
}
function isPhone(){const m=document.querySelector('main');return !!m&&m.clientWidth<=600;}
function fitTo(el,limit,min){
 el.style.removeProperty('--fit');
 for(let f=1,i=0;i<40&&el.scrollWidth>limit+1&&f>min;i++){f-=.02;el.style.setProperty('--fit',f.toFixed(3));}
}
function fit(){
 /* the puffy title lines and the hero team lines stay on one line each */
 for(const el of document.querySelectorAll('.h-title .t1,.h-title .t2')){if(locale!=='KO')continue;const p=el.parentElement;fitTo(el,p.clientWidth*.96,.6);}
 /* language versions: both title lines take the same size (the smaller fit of the two), so the longer second line ('美麗正式開始！') never makes
    the lines unequal */
 if(locale!=='KO')for(const t of document.querySelectorAll('.h-title')){const ls=[...t.querySelectorAll('.t1,.t2')];for(const el of ls)el.style.removeProperty('--fit');const w=t.clientWidth*.96;let f=1;for(const el of ls){const n=el.scrollWidth;if(n>w)f=Math.min(f,w/n);}f=Math.max(.5,Math.floor(f*1000)/1000);if(f<1)for(const el of ls)el.style.setProperty('--fit',f.toFixed(3));}
 for(const el of document.querySelectorAll('.ha-l2,.ha-l3,.tk-l3,.cta > [data-copy]')){fitTo(el,el.parentElement===el.closest('.card')?el.clientWidth:el.parentElement.clientWidth,.7);}
}
function render(){
 root.lang=LANG[locale]||'ko';root.dataset.locale=locale;setFonts();
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
window.__SN11__={get locale(){return locale;},get editable(){return editable;},get editMode(){return editMode;},get inline(){return !!IE;},keys:KEYS};
reply(IE?{type:'aptos-ready',inline:true}:{type:'aptos-ready'});
})();
