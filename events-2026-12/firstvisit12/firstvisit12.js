/* FV12 첫방문&체험가 · 겨울 시즌 renderer + review-board protocol (aptos-* messages, same as the other V4 pages).
   Every visible word comes from copy-data.js (names and prices from v4/firstvisit12/input/ITEMS.json) and is edited in place through ../inline-edit.js. */
(()=>{'use strict';
const DATA=window.PAGE_COPY;
if(!DATA||!DATA.locales||!DATA.locales.KO){document.documentElement.dataset.reviewError='copy-data missing';return;}
const KEYS=Object.keys(DATA.locales.KO);
const LANG={KO:'ko'};
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

/* money: the number large, the unit small (display only; the stored text stays exactly as typed) */
function setMoney(el,v){
 el.textContent='';
 const m=/^(\D*?)(\d[\d,.]*)(.*)$/.exec(v||'');
 if(!m){el.textContent=v||'';return;}
 if(m[1]){const p=document.createElement('span');p.className='u pre';p.textContent=m[1];el.append(p);}
 const n=document.createElement('span');n.className='n';n.textContent=m[2];el.append(n);
 if(m[3]){const s=document.createElement('span');s.className='u';s.textContent=m[3];el.append(s);}
}
/* titles: the last word on its own line (display only; the space stays in the text, so the stored value is unchanged) */
function setTitle(el,v){
 el.textContent='';
 const m=/^(.*\S)(\s+)(\S+)$/.exec(v||'');
 if(!m){const a=document.createElement('span');a.className='t1';a.textContent=v||'';el.append(a);return;}
 const a=document.createElement('span');a.className='t1';a.textContent=m[1];
 const b=document.createElement('span');b.className='t2';b.textContent=m[3];
 el.append(a,document.createTextNode(m[2]),b);
}
/* card 5 hours: the day label and the time are styled apart (display only) */
function setHours(el,v){
 el.textContent='';
 const m=/^(.*\S)(\s+)(\d{1,2}:\d{2}\s*[\u2013\u2014~-]\s*\d{1,2}:\d{2}.*)$/.exec(v||'');
 if(!m){el.textContent=v||'';return;}
 const d=document.createElement('span');d.className='hd';d.textContent=m[1];
 const t=document.createElement('span');t.className='ht';t.textContent=m[3];
 el.append(d,document.createTextNode(m[2]),t);
}
/* care guide contents: each listed treatment stays on one line when it is short enough (display only; phones may still wrap it) */
function setParts(el,v){
 el.textContent='';
 for(const p of String(v||'').split(/(,\s+)/)){
  if(!p)continue;
  if(/^,\s+$/.test(p)||p.length>26){el.append(document.createTextNode(p));continue;}
  const s=document.createElement('span');s.className='nw';s.textContent=p;el.append(s);
 }
}
/* widow guard: the last two words stay together; the phone number never breaks */
const GUARD='.hook,.c4-a,.c4-tip,.c4-src,.gd-v,.bkl-msg,.spec,.notes [data-copy],.at,.ad,.ab-title,.ab-lead [data-copy],.dr-quote,.way-addr > [data-copy],.hrs-note,.bk-links [data-copy]';
/* names that must never break inside (display only: wrapped in nowrap spans, the stored text is unchanged) */
const KEEP=/(Beauty Blossom|BEAUTY::BLOSSOM|02-336-7511|'뷰티블라썸의원'|VAT 10%)/g;
function appendKept(el,s){
 let last=0;
 for(const m of s.matchAll(KEEP)){
  if(m.index>last)el.append(document.createTextNode(s.slice(last,m.index)));
  const k=document.createElement('span');k.className='nw';k.textContent=m[0];el.append(k);last=m.index+m[0].length;
 }
 if(last<s.length)el.append(document.createTextNode(s.slice(last)));
}
function setText(el,v){
 if(el.classList.contains('money')){setMoney(el,v);return;}
 if(el.classList.contains('title')){setTitle(el,v);return;}
 if(el.matches('.hrs [data-copy]')){setHours(el,v);return;}
 if(el.matches('.gd-what .gd-v')){setParts(el,v);return;}
 if(v&&!el.matches(GUARD)&&KEEP.test(v)){KEEP.lastIndex=0;el.textContent='';appendKept(el,v);return;}
 KEEP.lastIndex=0;
 if(!v||!el.matches(GUARD)){el.textContent=v;return;}
 let m=el.matches('.ab-title')?v.match(/(\S+[ \t]+\S{1,3})$/):v.match(/(\S+[ \t]+\S+)$/); /* card 5 title: only a very short last word is kept with the previous one */
 if(!m&&/\d{2,3}-\d{3,4}-\d{4}$/.test(v))m=v.match(/(\S*\d{2,3}-\d{3,4}-\d{4})$/);
 if(m){let cut=v.length-m[1].length;for(const k of v.matchAll(KEEP))if(cut>k.index&&cut<k.index+k[0].length)cut=k.index;m=cut>0?[null,v.slice(cut)]:null;} /* never split a kept word at the widow cut */
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
 const phone=isPhone();
 /* one-line headings shrink to their column */
 for(const el of document.querySelectorAll('.eyebrow,.title'))fitTo(el,el.clientWidth,.5);
 for(const el of document.querySelectorAll('.c4-q')){if(phone){el.style.removeProperty('--fit');continue;}fitTo(el,el.clientWidth,.7);}
 for(const el of document.querySelectorAll('.gname')){
  el.classList.remove('wrap');
  if(phone){el.style.removeProperty('--fit');continue;}
  if(!fitTo(el,el.clientWidth,.8))el.classList.add('wrap');
 }
 for(const el of document.querySelectorAll('.row .name')){
  el.classList.remove('wrap');
  if(phone){el.style.removeProperty('--fit');continue;}
  if(!fitTo(el,el.clientWidth,.84))el.classList.add('wrap');
 }
 /* card 5 (desktop): the title and the strength titles shrink to at most two lines */
 for(const el of document.querySelectorAll('.ab-title,.ab-strengths .at')){if(phone){el.style.removeProperty('--fit');continue;}fitLines(el,2,.74);}
 /* 49% seal: each line shrinks to the inner circle */
 for(const el of document.querySelectorAll('.seal .sl'))fitTo(el,el.parentElement.clientWidth,.55);
}

function render(){
 root.lang=LANG[locale]||'ko';root.dataset.locale=locale;
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
 const CH=(DATA.channels&&DATA.channels[locale])||null; /* per-locale consultation channels (v4/_shared/channels/CHANNELS.json) */
 for(const a of document.querySelectorAll('a[data-link]')){
  const n=a.dataset.link;const href=CH&&(n in CH)?CH[n]:(DATA.links&&DATA.links[n]);if(href)a.href=href;else a.removeAttribute('href');
  if(n!=='phone'){a.target='_blank';a.rel='noopener noreferrer';}
 }
 for(const img of document.querySelectorAll('img[data-qr]')){const q=CH&&CH.qr;if(q&&img.getAttribute('src')!==q)img.setAttribute('src',q);}
 /* card-5 Google map: this locale's own capture for every width tier (the picture sources pick the tier) */
 const GM=(DATA.gmap&&DATA.gmap[locale])||null;
 for(const el of document.querySelectorAll('[data-gmap]')){const u=GM&&GM[el.dataset.gmap];if(!u)continue;const a=el.tagName==='SOURCE'?'srcset':'src';if(el.getAttribute(a)!==u)el.setAttribute(a,u);}
 for(const w of document.querySelectorAll('[data-bk-alt]')){const lab=w.querySelector('[data-copy]');w.hidden=!String((lab&&fields[lab.dataset.copy])??'').trim()&&!(editable&&editMode);}
 document.title=[fields.fv_title||'첫 방문&체험가 이벤트',fields.fv_brand||'BEAUTY BLOSSOM'].join(' \u00b7 ');
 if(IE)IE.sync(editable);
 typeSwap();
 requestAnimationFrame(()=>{fit();report();});
 document.fonts.ready.then(()=>{fit();report();});
 root.dataset.reviewReady='true';
}

/* Miricanvas typography: the image replaces the live text only while the on-screen text equals the text drawn in the image,
   and not while someone is typing in it. Any edit falls back to the live text automatically. */
const typeLoaded={};
const norm=s=>String(s||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
function typeSwap(){
 for(const el of document.querySelectorAll('[data-type-src]')){
  const src=el.dataset.typeSrc;
  if(!(src in typeLoaded)){typeLoaded[src]=null;const im=new Image();im.onload=()=>{typeLoaded[src]=im.naturalWidth>0;typeSwap();report();};im.onerror=()=>{typeLoaded[src]=false;};im.src=src;}
  if(!el.style.getPropertyValue('--type'))el.style.setProperty('--type','url("'+src+'")');
  const same=norm(el.textContent)===norm(el.dataset.typeText||'');
  const typing=el.contains(document.activeElement)&&document.activeElement.isContentEditable;
  el.classList.toggle('typed',typeLoaded[src]===true&&same&&!typing&&!el.hidden);
 }
}
document.addEventListener('focusin',typeSwap);
document.addEventListener('focusout',()=>setTimeout(typeSwap,0));

/* Miricanvas decorations: shown when the file exists, otherwise the code-drawn fallback stays */
function miri(){
 for(const img of document.querySelectorAll('img.miri')){
  const w=img.parentElement;
  const ok=()=>{w.classList.add('ok');report();};
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
window.__FV12__={get locale(){return locale;},get editable(){return editable;},get editMode(){return editMode;},get inline(){return !!IE;},keys:KEYS};
reply(IE?{type:'aptos-ready',inline:true}:{type:'aptos-ready'});
})();
