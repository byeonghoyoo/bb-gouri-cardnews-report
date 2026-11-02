/* 해피아워 · 겨울 시즌 (board item "HH12") renderer + review-board protocol (aptos-* messages, same as the V4 pages).
   Korean only for now; any other ?lang= falls back to KO until the team confirms the wording. */
(()=>{'use strict';
const DATA=window.PAGE_COPY;
if(!DATA||!DATA.locales||!DATA.locales.KO){document.documentElement.dataset.reviewError='copy-data missing';return;}
const KEYS=Object.keys(DATA.locales.KO);
const LANG={KO:'ko'};
const FONT_CSS={KO:'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600;1,700&family=Sacramento&display=swap'};
const qs=new URLSearchParams(location.search);
let locale=String(qs.get('lang')||'KO').toUpperCase();if(!DATA.locales[locale])locale='KO';
let fields={...DATA.locales[locale]};
let editable=false,editMode=false,editField=null,pending=false,lastHeight=0;
const root=document.documentElement;
function reply(message){if(parent!==window)parent.postMessage(message,location.origin);}
/* in-place editing (../inline-edit.js): tap a copy, type, Enter or tap elsewhere saves. Without it the dialog below is the editor. */
const IE=window.BBInlineEdit?window.BBInlineEdit.create({doc:document,raw:k=>fields[k]??'',send:m=>reply(m),refit:()=>{fit();report();},rerender:()=>render()}):null;

/* decorative Miricanvas pieces not delivered yet: CSS stand-in or nothing */
for(const img of document.querySelectorAll('img[data-fb]')){
 const fb=img.dataset.fb;
 const swap=()=>{if(fb==='hide'){img.remove();report();return;}
  const s=document.createElement('span');s.className=img.className+' fb fb-'+fb;s.setAttribute('aria-hidden','true');img.replaceWith(s);report();};
 if(img.complete&&!img.naturalWidth)swap();else img.addEventListener('error',swap,{once:true});
}

/* edit dialog (fallback editor when inline-edit.js is missing) */
const dlg=document.createElement('dialog');dlg.className='review-dialog';
const form=document.createElement('form');form.method='dialog';
const heading=document.createElement('h2');heading.textContent='문구·금액 수정';
const label=document.createElement('label');label.textContent='선택한 문구';
const input=document.createElement('textarea');input.rows=4;input.maxLength=2000;input.setAttribute('aria-label','선택한 문구');
const info=document.createElement('p');info.className='edit-info';
const actions=document.createElement('div');actions.className='edit-actions';
const cancel=document.createElement('button');cancel.type='button';cancel.textContent='취소';
const save=document.createElement('button');save.type='button';save.textContent='공유 저장';
actions.append(cancel,save);label.append(input);form.append(heading,label,info,actions);dlg.append(form);document.body.append(dlg);

function report(){
 const main=document.querySelector('main');if(!main)return;
 const h=Math.max(300,Math.min(25000,Math.ceil(main.getBoundingClientRect().height)));
 if(h===lastHeight)return;lastHeight=h;reply({type:'aptos-size',height:h});
}
function setFonts(){const l=document.getElementById('locale-fonts');if(l&&l.getAttribute('href')!==FONT_CSS[locale])l.setAttribute('href',FONT_CSS[locale]);}

/* one-line prices: shrink through --fit only when they would overflow */
function fitTo(el,limit,min=.6){
 el.style.removeProperty('--fit');
 for(let f=1,i=0;i<26&&el.scrollWidth>limit+1&&f>min;i++){f-=.02;el.style.setProperty('--fit',f.toFixed(3));}
 return el.scrollWidth<=limit+1;
}
function fit(){for(const el of document.querySelectorAll('.fit'))if(el.offsetParent){const box=el.closest('.mi-price')||el.parentElement;const old=box.querySelector('.mi-old'),arr=box.querySelector('.mi-arrow');const room=box.clientWidth-(old?old.offsetWidth:0)-(arr?arr.offsetWidth:0)-24;fitTo(el,Math.max(60,room));}}

/* words that must never be split across lines (display only, the text stays identical) */
const KEEP={ALL:['02-336-7511','10:00 – 17:00','12.01 – 02.28','VAT 10%','1회 한정가','스킨보톡스','슈링크 유니버스','포트라 콰트로','울쎄라피프라임','써마지 FLX','리쥬란 힐러','덴서티 알파팁','인모드 FX','(5분 이내)']};
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const keepRe=()=>{const l=[...KEEP.ALL].sort((a,b)=>b.length-a.length);return new RegExp(l.map(esc).join('|'),'gu');};
function appendKeep(parent,s){
 const re=keepRe();let last=0;
 for(const m of s.matchAll(re)){if(m.index>last)parent.append(document.createTextNode(s.slice(last,m.index)));const k=document.createElement('span');k.className='nw';k.textContent=m[0];parent.append(k);last=m.index+m[0].length;}
 if(last<s.length)parent.append(document.createTextNode(s.slice(last)));
}
/* display-only accents: spec numbers in menu names (4CC, 600샷, 40KJ, 1v …) and the 만원 unit of prices. textContent stays identical. */
const SPEC=/(\d[\d,.]*\s?(?:CC|cc|KJ|kJ|샷|v)(?![A-Za-z가-힣])|\(5분 이내\))/gu;
function appendSpec(parent,s){let last=0;for(const m of s.matchAll(SPEC)){if(m.index>last)appendKeep(parent,s.slice(last,m.index));const k=document.createElement('span');k.className='spec nw';k.textContent=m[0];parent.append(k);last=m.index+m[0].length;}if(last<s.length)appendKeep(parent,s.slice(last));}
function appendPrice(parent,s){const m=s.match(/^(.*?)(만원)$/u);if(!m){parent.textContent=s;return;}const n=document.createElement('span');n.className='num';n.textContent=m[1];const u=document.createElement('span');u.className='unit';u.textContent=m[2];parent.append(n,u);}
/* widow guard: keep the last two words together. Text content stays identical. */
const GUARD='.title,.c-title,.c-lead,.gi-fact,.c5-d,.b5-intro,.b5-dr-quote,.b5-addr,.notes li,.bk-text,.holiday';
function setText(el,v){
 el.textContent='';
 if(v)v=v.replace(/ ([\u00b7\u30fb])/g,'\u00a0$1');
 if(!v){el.textContent=v;return;}
 if(el.matches('.mi-sale,.mi-old')){appendPrice(el,v);return;}
 if(el.matches('.mi-name,.gi-name')){appendSpec(el,v);return;}
 if(!el.closest(GUARD)){appendKeep(el,v);return;}
 const lines=v.split('\n');
 lines.forEach((line,i)=>{
  if(i)el.append(document.createTextNode('\n'));
  const m=line.match(/(\S+[ \t]+\S+)$/);
  if(!m||m[1].length>=line.length){appendKeep(el,line);return;}
  let cut=line.length-m[1].length;
  for(const k of line.matchAll(keepRe()))if(k.index<cut&&k.index+k[0].length>cut)cut=k.index;
  appendKeep(el,line.slice(0,cut));
  const tail=document.createElement('span');tail.className='nw';appendKeep(tail,line.slice(cut));el.append(tail);
 });
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
  if(!IE){if(editable)el.title='더블클릭하여 수정';else el.removeAttribute('title');}
 }
 for(const g of document.querySelectorAll('[data-optional-group]'))g.hidden=[...g.querySelectorAll('[data-optional]')].every(e=>e.hidden);
 for(const el of document.querySelectorAll('[data-alt]'))el.alt=fields[el.dataset.alt]??'';
 const CH=(DATA.channels&&DATA.channels[locale])||null;
 for(const a of document.querySelectorAll('a[data-link]')){
  const n=a.dataset.link;const href=CH&&(n in CH)?CH[n]:(DATA.links&&DATA.links[n]);if(href)a.href=href;else a.removeAttribute('href');
  if(n!=='phone'){a.target='_blank';a.rel='noopener noreferrer';}
 }
 for(const img of document.querySelectorAll('img[data-qr]')){const q=CH&&CH.qr;if(q&&img.getAttribute('src')!==q)img.setAttribute('src',q);}
 for(const w of document.querySelectorAll('[data-bk-alt]')){const lab=w.querySelector('[data-copy]');w.hidden=!String((lab&&fields[lab.dataset.copy])??'').trim()&&!(editable&&editMode);}
 /* card 5 map: Google Maps capture for this locale (PAGE_COPY.maps); <picture> media queries pick the width tier */
 const MAPS=(DATA.maps&&DATA.maps[locale])||(DATA.maps&&DATA.maps.KO)||null;
 for(const el of document.querySelectorAll('[data-map-tier]')){const f=MAPS&&MAPS[el.dataset.mapTier];if(!f)continue;const at=el.tagName==='SOURCE'?'srcset':'src';if(el.getAttribute(at)!==f)el.setAttribute(at,f);}
 if(IE)IE.sync(editable);
 document.title=[fields.hh_title,fields.hh_limit].filter(Boolean).join(' · ')+' · BEAUTY BLOSSOM';
 requestAnimationFrame(()=>{fit();report();});
 document.fonts.ready.then(()=>{fit();report();});
 root.dataset.reviewReady='true';
}

function startEdit(el){
 if(!editable||pending)return;
 editField=el.dataset.copy;input.value=fields[editField]??'';
 reply({type:'aptos-editing',field:editField});
 info.textContent=/_(old|sale)$/.test(editField)?'금액은 수가표와 같은 형식(예: 13만원)으로 입력해 주세요.':(el.dataset.placeholder?el.dataset.placeholder:'줄바꿈은 그대로 반영됩니다.');
 save.disabled=false;cancel.disabled=false;
 const r=el.getBoundingClientRect(),docH=document.documentElement.scrollHeight;
 dlg.style.top=Math.max(12,Math.min(r.top-24,docH-320))+'px';
 dlg.showModal();input.focus();input.select();
}
function submit(){
 if(pending||!editField)return;
 if(input.value===(fields[editField]??'')){dlg.close();return;}
 pending=true;save.disabled=true;cancel.disabled=true;info.textContent='서버에 저장 중입니다…';
 reply({type:'aptos-edit',field:editField,value:input.value});
}
save.addEventListener('click',submit);
cancel.addEventListener('click',()=>dlg.close());
dlg.addEventListener('close',()=>{if(editField)reply({type:'aptos-edit-cancel'});editField=null;pending=false;});
dlg.addEventListener('cancel',e=>{if(pending)e.preventDefault();});
input.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();submit();}});
document.addEventListener('dblclick',e=>{if(IE)return;const el=e.target.closest('[data-copy]');if(el&&editable){e.preventDefault();startEdit(el);}});
document.addEventListener('click',e=>{if(IE)return;const el=e.target.closest('[data-copy]');if(el&&editable&&editMode){e.preventDefault();startEdit(el);}});

window.addEventListener('message',event=>{
 if(event.source!==parent||event.origin!==location.origin)return;
 const msg=event.data;if(!msg||typeof msg!=='object')return;
 if(msg.type==='aptos-data'&&msg.fields&&typeof msg.fields==='object'){
  /* Korean only for now: another board language still shows the Korean page (and its saved Korean wording) */
  const loc=DATA.locales[msg.locale]?msg.locale:'KO';
  if(loc!==locale){locale=loc;fields={...DATA.locales[locale]};}
  if(DATA.locales[msg.locale])for(const k of KEYS)if(typeof msg.fields[k]==='string')fields[k]=msg.fields[k];
  editable=msg.editable===true&&!!DATA.locales[msg.locale];editMode=msg.editMode===true;render();
 }else if(msg.type==='aptos-save-result'&&IE){
  IE.saveResult(msg);
 }else if(msg.type==='aptos-save-result'&&msg.field===editField){
  pending=false;save.disabled=false;cancel.disabled=false;
  if(msg.ok){editField=null;dlg.close();}
  else info.textContent=(msg.error||'저장되지 않았습니다.')+' 최신 문구: '+(fields[editField]||'');
 }else if(msg.type==='aptos-start-edit'&&typeof msg.field==='string'){
  if(IE){IE.start(msg.field);return;}
  const el=[...document.querySelectorAll('[data-copy]')].find(x=>x.dataset.copy===msg.field);if(el)startEdit(el);
 }
});

window.addEventListener('resize',()=>{fit();report();});
if(document.fonts&&document.fonts.addEventListener)document.fonts.addEventListener('loadingdone',()=>{fit();report();});
const fontLink=document.getElementById('locale-fonts');if(fontLink)fontLink.addEventListener('load',()=>document.fonts.ready.then(()=>{fit();report();}));
const main=document.querySelector('main');
if(main&&'ResizeObserver' in window)new ResizeObserver(report).observe(main);
for(const img of document.images){if(!img.complete){img.addEventListener('load',report,{once:true});img.addEventListener('error',report,{once:true});}}
render();
window.__HH12_REVIEW__={get locale(){return locale;},get editable(){return editable;},get editMode(){return editMode;},get inline(){return !!IE;},keys:KEYS};
reply(IE?{type:'aptos-ready',inline:true}:{type:'aptos-ready'});
})();
