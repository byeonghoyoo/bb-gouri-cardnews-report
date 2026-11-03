/* SOF12 소프웨이브 · 겨울 시즌 renderer + review-board protocol (aptos-* messages, same as the other V4 pages).
   Every visible word comes from copy-data.js (titles, names, care lines, badges and prices from v4/events/_data/pages.json via v4/sofwave12/build-sofwave12.cjs)
   and is edited in place through ../inline-edit.js. Display-only helpers below never change the stored text. */
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
/* ?capture=1 (board image download): no animation, fixed layout */
if(qs.get('capture')==='1')root.classList.add('is-capture');

function reply(message){if(parent!==window)parent.postMessage(message,location.origin);}
const IE=window.BBInlineEdit?window.BBInlineEdit.create({doc:document,raw:k=>fields[k]??'',send:m=>reply(m),refit:()=>{fit();report();},rerender:()=>render()}):null;

function report(){
 const main=document.querySelector('main');if(!main)return;
 const h=Math.max(300,Math.min(25000,Math.ceil(main.getBoundingClientRect().height)));
 if(h===lastHeight)return;lastHeight=h;reply({type:'aptos-size',height:h});
}

/* money: the number large, the unit small */
function setMoney(el,v){
 el.textContent='';
 const m=/^(\D*?)(\d[\d,.]*)(.*)$/.exec(v||'');
 if(!m){el.textContent=v||'';return;}
 if(m[1]){const p=document.createElement('span');p.className='u pre';p.textContent=m[1];el.append(p);}
 const n=document.createElement('span');n.className='n';n.textContent=m[2];el.append(n);
 if(m[3]){const s=document.createElement('span');s.className='u';s.textContent=m[3];el.append(s);}
}
/* price names: the pulse / shot figure ('50펄스', '200샷') stands out; combo names break before ' + ' (the text stays the same) */
function unitSpan(parent,s){
 const m=/^(.*?)(\s*)(\d[\d,]*\s*(?:펄스|샷))$/.exec(s);
 if(!m){parent.append(document.createTextNode(s));return;}
 if(m[1]){const a=document.createElement('span');a.className='pb';a.textContent=m[1];parent.append(a);}
 if(m[2])parent.append(document.createTextNode(m[2]));
 const b=document.createElement('span');b.className='pv';b.textContent=m[3];parent.append(b);
}
function setPulse(el,v){
 el.textContent='';v=v||'';
 const i=v.indexOf(' + ');
 if(el.classList.contains('cmb')&&i>0){
  const l1=document.createElement('span');l1.className='ln l1';unitSpan(l1,v.slice(0,i));
  const l2=document.createElement('span');l2.className='ln l2';unitSpan(l2,v.slice(i+1));
  el.append(l1,document.createTextNode(' '),l2);return;
 }
 unitSpan(el,v);
}
/* card 6 hours: the day label and the time are styled apart */
function setHours(el,v){
 el.textContent='';
 const m=/^(.*\S)(\s+)(\d{1,2}:\d{2}\s*[\u2013\u2014~-]\s*\d{1,2}:\d{2}.*)$/.exec(v||'');
 if(!m){el.textContent=v||'';return;}
 const d=document.createElement('span');d.className='hd';d.textContent=m[1];
 const t=document.createElement('span');t.className='ht';t.textContent=m[3];
 el.append(d,document.createTextNode(m[2]),t);
}
/* widow guard: the last two words stay together */
const GUARD='.hook,.p-lead,.unit-d,.pcare,.pdet,.q-ans,.pt-d,.st-d,.who-v,.inf-n,.c5-tip [data-copy],.src,.bkl-msg,.cmp-d,.cmp-h,.notes [data-copy],.at,.ad,.ab-title,.ab-lead [data-copy],.dr-quote,.way-addr > [data-copy],.hrs-note,.bk-links [data-copy]';
/* names that never break inside */
const KEEP=/(BEAUTY::BLOSSOM|02-336-7511|'뷰티블라썸의원'|VAT 10%|울쎄라피 프라임|1\.5 · 3\.0 · 4\.5mm|1\.5mm|SUPERB 7개 빔|Sofcool|MFU-V|소노 or LDM 10'|소노 5'|국산 스킨보톡스|풀페이스 스킨보톡스|목주름 스킨보톡스|프리미엄 수분케어|7개 트랜스듀서|신경 쓰일 때|펄스 수)/g;
function appendKept(el,s){
 let last=0;KEEP.lastIndex=0;
 for(const m of s.matchAll(KEEP)){
  if(m.index>last)el.append(document.createTextNode(s.slice(last,m.index)));
  const k=document.createElement('span');k.className='nw';k.textContent=m[0];el.append(k);last=m.index+m[0].length;
 }
 if(last<s.length)el.append(document.createTextNode(s.slice(last)));
}
function setText(el,v){
 if(el.classList.contains('money')){setMoney(el,v);return;}
 if(el.classList.contains('pnm')){setPulse(el,v);return;}
 if(el.matches('.hrs [data-copy]')){setHours(el,v);return;}
 KEEP.lastIndex=0;
 const kept=!!v&&KEEP.test(v);KEEP.lastIndex=0;
 if(!v||!el.matches(GUARD)){if(kept){el.textContent='';appendKept(el,v);}else el.textContent=v;return;}
 let m=el.matches('.ab-title')?v.match(/(\S+[ \t]+\S{1,3})$/):v.match(/(\S+[ \t]+\S+)$/);
 if(!m&&/\d{2,3}-\d{3,4}-\d{4}$/.test(v))m=v.match(/(\S*\d{2,3}-\d{3,4}-\d{4})$/);
 if(m){let cut=v.length-m[1].length;for(const k of v.matchAll(KEEP))if(cut>k.index&&cut<k.index+k[0].length)cut=k.index;m=cut>0?[null,v.slice(cut)]:null;}
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
 for(const el of document.querySelectorAll('.kicker-latin,.hero-title,.tz-label'))fitTo(el,el.parentElement.clientWidth,.6);
 for(const el of document.querySelectorAll('.pt-main'))fitTo(el,el.closest('.cp-htx').clientWidth,.6);
 for(const el of document.querySelectorAll('.q-title')){if(phone){el.style.removeProperty('--fit');continue;}fitTo(el,el.clientWidth,.7);}
 for(const el of document.querySelectorAll('.bb-ba__title')){if(phone){el.style.removeProperty('--fit');continue;}fitTo(el,el.parentElement.clientWidth,.7);}
 /* price names stay on one line per part (desktop); on phones they may wrap */
 for(const el of document.querySelectorAll('.pname')){
  el.classList.remove('wrap');
  if(phone){el.style.removeProperty('--fit');continue;}
  if(!fitTo(el,el.clientWidth,.84))el.classList.add('wrap');
 }
 for(const el of document.querySelectorAll('.ab-title,.ab-strengths .at')){if(phone){el.style.removeProperty('--fit');continue;}fitLines(el,2,.74);}
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
 const CH=(DATA.channels&&DATA.channels[locale])||null;
 for(const a of document.querySelectorAll('a[data-link]')){
  const n=a.dataset.link;const href=CH&&(n in CH)?CH[n]:(DATA.links&&DATA.links[n]);if(href)a.href=href;else a.removeAttribute('href');
  if(n!=='phone'){a.target='_blank';a.rel='noopener noreferrer';}
 }
 for(const img of document.querySelectorAll('img[data-qr]')){const q=CH&&CH.qr;if(q&&img.getAttribute('src')!==q)img.setAttribute('src',q);}
 const GM=(DATA.gmap&&DATA.gmap[locale])||null;
 for(const el of document.querySelectorAll('[data-gmap]')){const u=GM&&GM[el.dataset.gmap];if(!u)continue;const a=el.tagName==='SOURCE'?'srcset':'src';if(el.getAttribute(a)!==u)el.setAttribute(a,u);}
 for(const w of document.querySelectorAll('[data-bk-alt]')){const lab=w.querySelector('[data-copy]');w.hidden=!String((lab&&fields[lab.dataset.copy])??'').trim()&&!(editable&&editMode);}
 document.title=[fields.sw_title||'소프웨이브',fields.sw_brand||'BEAUTY BLOSSOM'].join(' \u00b7 ');
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
window.__SW12__={get locale(){return locale;},get editable(){return editable;},get editMode(){return editMode;},get inline(){return !!IE;},keys:KEYS};
reply(IE?{type:'aptos-ready',inline:true}:{type:'aptos-ready'});
})();
