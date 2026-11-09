/* ULT5 울쎄라 5% 할인 renderer + review-board protocol (aptos-* messages, same as FV12 / ULT12 and the other V4 pages).
   Every visible word comes from copy-data.js (names and 만원 strings from v4/events/_data/pages.json via v4/ulthera5/build-ulthera5.cjs)
   and is edited in place through ../inline-edit.js. Display helpers only wrap text in spans; the stored text is never changed. */
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
if(qs.get('capture')==='1')root.classList.add('is-capture'); /* board image download: no motion, fixed layout */

function reply(message){if(parent!==window)parent.postMessage(message,location.origin);}
const IE=window.BBInlineEdit?window.BBInlineEdit.create({doc:document,raw:k=>fields[k]??'',send:m=>reply(m),refit:()=>{fit();report();},rerender:()=>render()}):null;

function report(){
 const main=document.querySelector('main');if(!main)return;
 const h=Math.max(300,Math.min(25000,Math.ceil(main.getBoundingClientRect().height)));
 if(h===lastHeight)return;lastHeight=h;reply({type:'aptos-size',height:h});
}
const span=(cls,text)=>{const s=document.createElement('span');if(cls)s.className=cls;s.textContent=text;return s;};

/* money: the number large, the unit small */
function setMoney(el,v){
 el.textContent='';
 const m=/^(\D*?)(\d[\d,.]*)(.*)$/.exec(v||'');
 if(!m){el.textContent=v||'';return;}
 if(m[1])el.append(span('u pre',m[1]));
 el.append(span('n',m[2]));
 if(m[3])el.append(span('u',m[3]));
}
/* hero title / sub line: split after the first comma (the space stays in the text) */
function setSplit(el,v,c1,c2){
 el.textContent='';
 const nl=/^([^\n]*)\n([\s\S]*)$/.exec(v||''); /* 2026-11-06: two-line copy (u5_h2, team comment #4) splits at the line break */
 if(nl){el.append(span(c1,nl[1]),document.createTextNode('\n'),span(c2,nl[2]));return;}
 const m=/^(.*?,)(\s+)(\S.*)$/.exec(v||'');
 if(!m){el.append(span(c1,v||''));return;}
 el.append(span(c1,m[1]),document.createTextNode(m[2]),span(c2,m[3]));
}
/* the offer line: the percentage large, the words around it small */
function setBig(el,v){
 el.textContent='';
 const m=/^(.*?)(\s*)(\d+(?:\.\d+)?%)(\s*)(.*)$/.exec(v||'');
 if(!m){el.textContent=v||'';return;}
 if(m[1])el.append(span('b1',m[1]));
 if(m[2])el.append(document.createTextNode(m[2]));
 el.append(span('b5',m[3]));
 if(m[4])el.append(document.createTextNode(m[4]));
 if(m[5])el.append(span('b2',m[5]));
}
/* price names: a package line breaks before ' + ' (second device on its own line) */
function setName(el,v){
 el.textContent='';v=v||'';
 const c=/^(.*\S)(\s*)(\+\s*\S.*)$/.exec(v); /* 2026-11-09: also splits when the space before + was deleted (team comment #24) */
 if(c){el.append(span('n1',c[1]),document.createTextNode(c[2]),span('n2',c[3]));return;}
 el.append(span('n1',v));
}
/* clinic hours: the day label and the time are styled apart */
function setHours(el,v){
 el.textContent='';
 const m=/^(.*\S)(\s+)(\d{1,2}:\d{2}\s*[\u2013\u2014~-]\s*\d{1,2}:\d{2}.*)$/.exec(v||'');
 if(!m){el.textContent=v||'';return;}
 el.append(span('hd',m[1]),document.createTextNode(m[2]),span('ht',m[3]));
}
/* widow guard: the last two words stay together; kept names never break */
const GUARD='.q-ans,.pt-d,.st-d,.inf-n,.inf-v,.c4-tip [data-copy],.src,.p-notes li,.p-lead > [data-copy]:not(.p-period),.cmp-title,.notes [data-copy],.ad,.ab-title,.ab-lead [data-copy],.dr-quote,.way-addr > [data-copy],.hrs-note,.tk-ct,.h1b-cond';
const KEEP=/(02-336-7511|'뷰티블라썸의원'|VAT 10%|울쎄라피 프라임|DeepSEE)/g;
function appendKept(el,s){
 let last=0;
 for(const m of s.matchAll(KEEP)){
  if(m.index>last)el.append(document.createTextNode(s.slice(last,m.index)));
  el.append(span('nw',m[0]));last=m.index+m[0].length;
 }
 if(last<s.length)el.append(document.createTextNode(s.slice(last)));
}
function setText(el,v){
 if(el.classList.contains('money')){setMoney(el,v);return;}
 if(el.classList.contains('h-title')){setSplit(el,v,'t1','t2');return;}
 if(el.classList.contains('h-sub')){setSplit(el,v,'s1','s2');return;}
 if(el.classList.contains('big5')){setBig(el,v);return;}
 if(el.classList.contains('pname')){setName(el,v);return;}
 if(el.matches('.hrs [data-copy]')){setHours(el,v);return;}
 KEEP.lastIndex=0;
 if(v&&!el.matches(GUARD)&&KEEP.test(v)){KEEP.lastIndex=0;el.textContent='';appendKept(el,v);return;}
 KEEP.lastIndex=0;
 if(!v||!el.matches(GUARD)){el.textContent=v;return;}
 let m=el.matches('.ab-title')?v.match(/(\S+[ \t]+\S{1,3})$/):v.match(/(\S+[ \t]+\S+)$/);
 if(!m&&/\d{2,3}-\d{3,4}-\d{4}$/.test(v))m=v.match(/(\S*\d{2,3}-\d{3,4}-\d{4})$/);
 if(m){let cut=v.length-m[1].length;for(const k of v.matchAll(KEEP))if(cut>k.index&&cut<k.index+k[0].length)cut=k.index;m=cut>0?[null,v.slice(cut)]:null;}
 if(!m||m[1].length>=v.length){el.textContent='';appendKept(el,v);return;}
 el.textContent='';appendKept(el,v.slice(0,v.length-m[1].length));el.append(span('nw',m[1]));
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
 for(const el of document.querySelectorAll('.h-title,.h-sub,.big5,.tk-ct,.h1b-cond'))fitTo(el,el.clientWidth,.6);
 for(const el of document.querySelectorAll('.p-title,.q-title')){if(phone){el.style.removeProperty('--fit');continue;}fitTo(el,el.clientWidth,.7);}
 for(const el of document.querySelectorAll('.pname')){if(phone){el.style.removeProperty('--fit');continue;}fitTo(el,el.clientWidth,.8);}
 for(const el of document.querySelectorAll('.ab-title,.ab-strengths .at')){if(phone){el.style.removeProperty('--fit');continue;}fitLines(el,2,.74);}
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
 document.title=[fields.u5_event||'울쎄라 5% 할인','BEAUTY BLOSSOM'].join(' \u00b7 ');
 if(IE)IE.sync(editable);
 requestAnimationFrame(()=>{fit();report();});
 document.fonts.ready.then(()=>{fit();report();});
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
window.__ULT5__={get locale(){return locale;},get editable(){return editable;},get editMode(){return editMode;},get inline(){return !!IE;},keys:KEYS};
reply(IE?{type:'aptos-ready',inline:true}:{type:'aptos-ready'});
})();
