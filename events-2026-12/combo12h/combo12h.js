/* 통합이벤트 묶음 ⑤ renderer + review-board protocol (aptos-* messages, same as the other V4 pages). Same script in site/combo12h and site/combo12i.
   Every visible word comes from copy-data.js (names, compositions, options and prices from v4/events/_data/pages.json via v4/<slug>/build-<slug>.cjs)
   and is edited in place through ../inline-edit.js. Display-only helpers below never change the stored text (DOM text = copy text). */
(()=>{'use strict';
const DATA=window.PAGE_COPY;
if(!DATA||!DATA.locales||!DATA.locales.KO){document.documentElement.dataset.reviewError='copy-data missing';return;}
const KEYS=Object.keys(DATA.locales.KO);
const P=DATA.prefix||'';
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

/* money: the number large, the unit small ('22만7천원' -> '22' '만' '7' '천원'; the text stays identical) */
function setMoney(el,v){
 el.textContent='';
 const m=/^(\D*?)(\d[\d,.]*)(.*)$/.exec(v||'');
 if(!m){el.textContent=v||'';return;}
 if(m[1]){const p=document.createElement('span');p.className='u pre';p.textContent=m[1];el.append(p);}
 const n=document.createElement('span');n.className='n';n.textContent=m[2];el.append(n);
 if(m[3]){
  const rest=/^(만)(\d+)(천원)$/.exec(m[3]);
  if(rest){const a=document.createElement('span');a.className='u';a.textContent=rest[1];const b=document.createElement('span');b.className='n';b.textContent=rest[2];const c=document.createElement('span');c.className='u';c.textContent=rest[3];el.append(a,b,c);}
  else{const s=document.createElement('span');s.className='u';s.textContent=m[3];el.append(s);}
 }
}
/* text with ' + ': each part stays on one line, the plus is coloured (text unchanged) */
function setPlus(el,v){
 el.textContent='';v=v||'';
 v.split(' + ').forEach((p,i)=>{
  if(i){const s=document.createElement('span');s.className='plus';s.textContent=' + ';el.append(s);}
  const c=document.createElement('span');c.className='seg';appendKept(c,p);el.append(c);
 });
}
/* clinic hours: the day label and the time are styled apart */
function setHours(el,v){
 el.textContent='';
 const m=/^(.*\S)(\s+)(\d{1,2}:\d{2}\s*[\u2013\u2014~-]\s*\d{1,2}:\d{2}.*)$/.exec(v||'');
 if(!m){el.textContent=v||'';return;}
 const d=document.createElement('span');d.className='hd';d.textContent=m[1];
 const t=document.createElement('span');t.className='ht';t.textContent=m[3];
 el.append(d,document.createTextNode(m[2]),t);
}
/* highlighted words (DATA.hl[field]): coloured spans, text unchanged */
function setHl(el,v,words){
 el.textContent='';let rest=v||'';
 const re=new RegExp('('+words.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')');
 while(rest){const m=re.exec(rest);if(!m){el.append(document.createTextNode(rest));break;}
  if(m.index)el.append(document.createTextNode(rest.slice(0,m.index)));
  const s=document.createElement('span');s.className='hl';s.textContent=m[0];el.append(s);rest=rest.slice(m.index+m[0].length);}
}
/* widow guard: the last two words stay together */
const GUARD='.hook,.p-lead,.q-ans,.tl-d,.tl-x,.st-d,.inf-n,.care-l [data-copy],.alert,.src,.notes [data-copy],.at,.ad,.ab-title,.ab-lead [data-copy],.dr-quote,.way-addr > [data-copy],.hrs-note,.bk-links [data-copy],.q-wrap,.dv-d,.dv3-d,.gd-n,.pg-parts,.pg-list,.psv';
/* names and numbers that never break inside */
const KEEP=/(BEAUTY::BLOSSOM|02-336-7511|'뷰티블라썸의원'|VAT 10%|SPF 50 이상|Q-LDM 20분|LDM 12분|Q-ldm 10분|크라이오 5분|PDRN 2\.5cc|1450nm|755nm|532nm|1064nm|5회당|1회·5회·10회|1회·3회|골드 PTT|포텐자 모공 팁|피코슈어 포커스|모공 싹쓰리 콤보|3D 피부진단|원장님께서 모드 선택|미백\/수분\/진정\/재생관리|명함크기|1곳|2~4가지|금액 카드 2\/2|세 가지 주파수|금 입자)/g;
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
 const hl=DATA.hl&&DATA.hl[el.dataset.copy];if(hl&&hl.length){setHl(el,v,hl);return;}
 if((el.classList.contains('pplus')||el.classList.contains('pt-main'))&&/ \+ /.test(v||'')){setPlus(el,v);return;}
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
/* hero title: both big lines share one scale so the widest line fits the title column */
function fitBig(el){
 el.style.removeProperty('--fit');
 const lim=el.parentElement.clientWidth;
 const widest=()=>Math.max(...[...el.querySelectorAll('.hb-l')].map(l=>l.getBoundingClientRect().width));
 for(let f=1,i=0;i<40&&widest()>lim+1&&f>.5;i++){f-=.02;el.style.setProperty('--fit',f.toFixed(3));}
}
function fit(){
 const phone=isPhone();
 for(const el of document.querySelectorAll('.h-big'))fitBig(el);
 for(const el of document.querySelectorAll('.pt-main')){el.style.removeProperty('--fit');if(phone)continue;const segs=[...el.querySelectorAll('.seg')];const lim=el.closest('.p-title').clientWidth*.98;
  if(segs.length){for(let f=1,i=0;i<30&&Math.max(...segs.map(s=>s.getBoundingClientRect().width))>lim&&f>.6;i++){f-=.02;el.style.setProperty('--fit',f.toFixed(3));}}
  else fitTo(el,lim,.6);}
 for(const el of document.querySelectorAll('.q-title:not(.q-wrap)')){if(phone){el.style.removeProperty('--fit');continue;}fitTo(el,el.clientWidth,.7);}
 for(const el of document.querySelectorAll('.ab-title,.ab-strengths .at')){if(phone){el.style.removeProperty('--fit');continue;}fitLines(el,2,.74);}
 for(const el of document.querySelectorAll('.seal .sl')){const p=el.parentElement,cs=getComputedStyle(p);fitTo(el,p.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight),.55);}
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
 document.title=[(fields[P+'title_a']||'')+(fields[P+'title_b']||''),fields[P+'brand']||'BEAUTY BLOSSOM'].join(' \u00b7 ');
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
window.__B5__={get locale(){return locale;},get editable(){return editable;},get editMode(){return editMode;},get inline(){return !!IE;},keys:KEYS};
reply(IE?{type:'aptos-ready',inline:true}:{type:'aptos-ready'});
})();
