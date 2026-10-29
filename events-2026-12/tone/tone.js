/* TYPE 05 · 색소 관리 (SKIN FORECAST) renderer + review-board protocol (aptos-* messages, same as EXAM V3). */
(()=>{'use strict';
const DATA=window.PAGE_COPY;
if(!DATA||!DATA.locales||!DATA.locales.KO){document.documentElement.dataset.reviewError='copy-data missing';return;}
const KEYS=Object.keys(DATA.locales.KO);
const LANG={KO:'ko',EN:'en',JP:'ja',CN:'zh-CN',TW:'zh-TW',TH:'th',HK:'zh-HK'};
const G='https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;600;700';
const FONT_CSS={
 KO:G+'&display=swap',
 EN:G+'&display=swap',
 JP:G+'&family=Noto+Sans+JP:wght@400;500;700;800&display=swap',
 CN:G+'&family=Noto+Sans+SC:wght@400;500;700;800&display=swap',
 TW:G+'&family=Noto+Sans+TC:wght@400;500;700;800&display=swap',
 HK:G+'&family=Noto+Sans+TC:wght@400;500;700;800&display=swap',
 TH:G+'&family=Noto+Sans+Thai:wght@400;500;700;800&display=swap'
};
const qs=new URLSearchParams(location.search);
let locale=String(qs.get('lang')||'KO').toUpperCase();if(!DATA.locales[locale])locale='KO';
let fields={...DATA.locales[locale]};
let editable=false,editMode=false,editField=null,pending=false,lastHeight=0;
const root=document.documentElement;
/* in-place editing (../inline-edit.js): tap a copy, type, Enter or tap elsewhere saves. Without it the dialog below is the editor. */
const IE=window.BBInlineEdit?window.BBInlineEdit.create({doc:document,raw:k=>fields[k]??'',send:m=>reply(m),refit:()=>{fit();report();},rerender:()=>render()}):null;

/* Miricanvas elements: until the PNG/WebP arrives, the code-drawn SVG in assets/icons/ stands in */
for(const img of document.querySelectorAll('img[data-fb]')){
 const swap=()=>{if(img.dataset.fbDone)return;img.dataset.fbDone='1';img.src=img.dataset.fb;img.classList.add('is-fallback');};
 if(img.complete&&!img.naturalWidth)swap();else img.addEventListener('error',swap,{once:true});
}
/* "SKIN FORECAST" type image: live text until the Miricanvas typography is delivered */
for(const img of document.querySelectorAll('.type-img')){
 const swap=()=>{const s=document.createElement('span');s.className='type-fallback';s.textContent=img.alt;img.replaceWith(s);report();};
 if(img.complete&&!img.naturalWidth)swap();else img.addEventListener('error',swap,{once:true});
}

/* edit dialog (fallback editor when inline-edit.js is not loaded) */
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

function reply(message){if(parent!==window)parent.postMessage(message,location.origin);}
function report(){
 const main=document.querySelector('main');if(!main)return;
 const h=Math.max(300,Math.min(25000,Math.ceil(main.getBoundingClientRect().height)));
 if(h===lastHeight)return;lastHeight=h;reply({type:'aptos-size',height:h});
}
function setFonts(){const l=document.getElementById('locale-fonts');if(l&&l.getAttribute('href')!==FONT_CSS[locale])l.setAttribute('href',FONT_CSS[locale]);}

/* prices and one-line links stay on one line: shrink through --fit only when they would overflow */
function fitTo(el,limit,min=.6){
 el.style.removeProperty('--fit');
 for(let f=1,i=0;i<26&&el.scrollWidth>limit+1&&f>min;i++){f-=.02;el.style.setProperty('--fit',f.toFixed(3));}
 return el.scrollWidth<=limit+1;
}
function fit(){
 for(const el of document.querySelectorAll('.fit'))fitTo(el,el.clientWidth);
 for(const a of document.querySelectorAll('.bk-row dd a')){a.classList.remove('wrap');if(!fitTo(a,a.parentElement.clientWidth,.8)){a.style.removeProperty('--fit');a.classList.add('wrap');}}
}

/* widow guard: keep the last two words (CJK: last three characters) together. Text content stays identical. */
const GUARD='h1,h2,h3,.hero-title,.sec-body,.w-note,.r-detail,.q,.a,.g-card p,.h-text,.bk-row dd,.notice li,.foot p,.dev figcaption';
const KEEP=['tn_offer1_name','tn_offer2_name','tn_offer3_name','tn_offer4_name','tn_dev_pico','tn_dev_v','tn_step1_title'];
function setText(el,v){
 el.textContent='';
 /* display only: a middle dot never starts a new line */
 if(v)v=v.replace(/ ([\u00b7\u30fb])/g,'\u00a0$1');
 /* display only: product and device names stay in one piece ("듀얼피코 슈어토닝", "3D 피부진단") */
 if(v)for(const k of KEEP){const n=fields[k];if(n&&n.includes(' ')&&n.length<=26&&v.includes(n))v=v.split(n).join(n.replace(/ /g,'\u00a0'));}
 if(!v||!el.closest(GUARD)||el.closest('.chip')){el.textContent=v;return;}
 let m=null;
 if(/^(JP|CN|TW|HK)$/.test(locale))m=v.match(/([^\s]{3}[\u3002\u3001\uff0c\uff0e\uff01\uff1f!?\u2026\u300d\u300f\uff09)\]\u00b7~\u301c]*)$/u);
 else if(locale!=='TH')m=v.match(/(\S+[ \t]+\S+)$/);
 if(!m||m[1].length>=v.length||m[1].length>24){el.textContent=v;return;}
 const tail=document.createElement('span');tail.className='nw';tail.textContent=m[1];
 el.append(document.createTextNode(v.slice(0,v.length-m[1].length)),tail);
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
 if(IE)IE.sync(editable);
 for(const el of document.querySelectorAll('[data-alt]'))el.alt=fields[el.dataset.alt]??'';
 for(const a of document.querySelectorAll('a[data-link]')){
  const href=DATA.links[a.dataset.link];if(href)a.href=href;
  if(a.dataset.link!=='phone'){a.target='_blank';a.rel='noopener noreferrer';}
 }
 document.title=[fields.tn_title,fields.tn_title_strong].filter(Boolean).join(' ')+' · BEAUTY BLOSSOM';
 requestAnimationFrame(()=>{fit();report();});
 document.fonts.ready.then(()=>{fit();report();});
 root.dataset.reviewReady='true';
}

function startEdit(el){
 if(!editable||pending)return;
 editField=el.dataset.copy;input.value=fields[editField]??'';
 reply({type:'aptos-editing',field:editField});
 info.textContent=/price/.test(editField)?'금액은 숫자와 쉼표만 입력해 주세요. 통화 단위는 별도 칸입니다.':(el.dataset.placeholder?el.dataset.placeholder:'줄바꿈은 그대로 반영됩니다.');
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
 if(msg.type==='aptos-data'&&DATA.locales[msg.locale]&&msg.fields&&typeof msg.fields==='object'){
  if(msg.locale!==locale){locale=msg.locale;fields={...DATA.locales[locale]};}
  for(const k of KEYS)if(typeof msg.fields[k]==='string')fields[k]=msg.fields[k];
  editable=msg.editable===true;editMode=msg.editMode===true;render();
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
window.__TONE_REVIEW__={get locale(){return locale;},get editable(){return editable;},get editMode(){return editMode;},get inline(){return !!IE;},keys:KEYS};
reply(IE?{type:'aptos-ready',inline:true}:{type:'aptos-ready'});
})();
