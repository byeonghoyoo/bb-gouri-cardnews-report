/* TYPE 01 · 리프팅 페어링 코스 renderer + review-board protocol (aptos-* messages, same as site/exam). */
(()=>{'use strict';
const DATA=window.PAGE_COPY;
if(!DATA||!DATA.locales||!DATA.locales.KO){document.documentElement.dataset.reviewError='copy-data missing';return;}
const KEYS=Object.keys(DATA.locales.KO);
const LANG={KO:'ko',EN:'en',JP:'ja',CN:'zh-CN',TW:'zh-TW',TH:'th',HK:'zh-HK'};
const G='https://fonts.googleapis.com/css2?',COMMON='family=Noto+Serif:ital,wght@0,500;0,600;0,700;1,500&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500;1,600&display=swap';
const FONT_CSS={
 KO:G+'family=Noto+Serif+KR:wght@500;600;700;900&'+COMMON,
 EN:G+COMMON,
 JP:G+'family=Noto+Serif+JP:wght@500;600;700;900&family=Noto+Sans+JP:wght@400;500;700&'+COMMON,
 CN:G+'family=Noto+Serif+SC:wght@500;600;700;900&family=Noto+Sans+SC:wght@400;500;700&'+COMMON,
 TW:G+'family=Noto+Serif+TC:wght@500;600;700;900&family=Noto+Sans+TC:wght@400;500;700&'+COMMON,
 HK:G+'family=Noto+Serif+TC:wght@500;600;700;900&family=Noto+Sans+TC:wght@400;500;700&'+COMMON,
 TH:G+'family=Noto+Serif+Thai:wght@500;600;700&family=Noto+Sans+Thai:wght@400;500;700&'+COMMON
};
const qs=new URLSearchParams(location.search);
let locale=String(qs.get('lang')||'KO').toUpperCase();if(!DATA.locales[locale])locale='KO';
let fields={...DATA.locales[locale]};
let editable=false,editMode=false,editField=null,pending=false,lastHeight=0;
const root=document.documentElement;
function reply(message){if(parent!==window)parent.postMessage(message,location.origin);}
/* in-place editing (../inline-edit.js): tap a copy, type, Enter or tap elsewhere saves. Without it the dialog below is the editor. */
const IE=window.BBInlineEdit?window.BBInlineEdit.create({doc:document,raw:k=>fields[k]??'',send:m=>reply(m),refit:()=>{fit();report();},rerender:()=>render()}):null;

/* ---- asset fallbacks: a missing Miricanvas or device file never leaves a broken image ---- */
function onMissing(img,swap){if(img.complete&&!img.naturalWidth)swap();else img.addEventListener('error',swap,{once:true});}
for(const img of document.querySelectorAll('.type-img'))onMissing(img,()=>{const s=document.createElement('span');s.className='type-fallback';s.textContent=img.alt;img.replaceWith(s);report();});
for(const img of document.querySelectorAll('img.divider'))onMissing(img,()=>{const s=document.createElement('span');s.className='rule';s.setAttribute('aria-hidden','true');s.append(document.createElement('i'));img.replaceWith(s);report();});
for(const img of document.querySelectorAll('img.deco,img.cloche'))onMissing(img,()=>{img.remove();report();});
for(const img of document.querySelectorAll('.dev-img img'))onMissing(img,()=>{const s=document.createElement('span');s.className='dev-ph';s.setAttribute('aria-hidden','true');img.replaceWith(s);report();});

/* ---- fallback editor (only when inline-edit.js is not loaded) ---- */
const dlg=document.createElement('dialog');dlg.className='review-dialog';
const form=document.createElement('form');form.method='dialog';
const heading=document.createElement('h2');heading.textContent='문구·금액 수정';
const label=document.createElement('label');label.textContent='선택한 문구';
const input=document.createElement('textarea');input.rows=4;input.maxLength=2000;input.setAttribute('aria-label','선택한 문구');
const info=document.createElement('p');info.className='edit-info';
const actions=document.createElement('div');actions.className='edit-actions';
const cancel=document.createElement('button');cancel.type='button';cancel.textContent='취소';
const save=document.createElement('button');save.type='button';save.textContent='공유 저장';
actions.append(cancel,save);label.append(input);form.append(heading,label,info,actions);dlg.append(form);
if(!IE)document.body.append(dlg);

function report(){
 const main=document.querySelector('main');if(!main)return;
 const h=Math.max(300,Math.min(25000,Math.ceil(main.getBoundingClientRect().height)));
 if(h===lastHeight)return;lastHeight=h;reply({type:'aptos-size',height:h});
}
function setFonts(){const l=document.getElementById('locale-fonts');if(l&&l.getAttribute('href')!==FONT_CSS[locale])l.setAttribute('href',FONT_CSS[locale]);}

/* prices and booking links stay on one line: shrink through --fit only when they would overflow */
function fitTo(el,limit,min=.62){
 el.style.removeProperty('--fit');
 for(let f=1,i=0;i<24&&el.scrollWidth>limit+1&&f>min;i++){f-=.02;el.style.setProperty('--fit',f.toFixed(3));}
 return el.scrollWidth<=limit+1;
}
function fit(){
 for(const el of document.querySelectorAll('.fit'))fitTo(el,el.clientWidth);
 for(const a of document.querySelectorAll('.rsv-row dd a')){a.classList.remove('wrap');if(!fitTo(a,a.parentElement.clientWidth,.8)){a.style.removeProperty('--fit');a.classList.add('wrap');}}
}

/* widow guard: keep the last two words (CJK: last two characters) together. Text content stays identical. */
const GUARD='h1,h2,h3,.hero-title,.hero-lead,.why-body,.menu-lead,.c-items,.c-pair,.sig-lead,.sig-items,.qa-item dt,.qa-item dd,.notice li,.dev-depth,.dev-name,.chart-note,.rsv-row dd,.plate-label';
const ONE_PIECE=['lf_d_sof_name','lf_d_thm_name','lf_d_ond_name','lf_d_ult_name','lf_c1_name','lf_c2_name','lf_c3_name','lf_c4_name','lf_sig_name','lf_c3_extra'];
/* display only (the stored text never changes): keep meaningful units on one line */
function display(v){
 if(!v)return v;
 v=v.replace(/ ([\u00b7\u30fb+×])/g,'\u00a0$1')      /* a middle dot, plus or times never starts a line */
  .replace(/(\d) (?=[^\s\d+·×])/g,'$1\u00a0')       /* a number stays with its unit ("50 pulses") */
  .replace(/([\p{L}\p{M}]) (?=\d)/gu,'$1\u00a0');      /* a device stays with its count ("소프웨이브 100펄스") */
 if(locale==='KO')v=v.replace(/(^|[\s\u00a0])(한|두|세|네|다섯|여섯) (?=\S)/g,'$1$2\u00a0'); /* "네 가지", "두 장비를" */
 /* device and course names stay in one piece ("울쎄라피 프라임", "Thermage FLX") */
 for(const k of ONE_PIECE){const n=fields[k];if(n&&n.includes(' ')&&n.length<=28&&v.includes(n))v=v.split(n).join(n.replace(/ /g,'\u00a0'));}
 return v;
}
/* hyphenated words ("year-end", "One-Day", the phone number) never break at the hyphen: they go into a no-wrap span */
const HYPHEN=/[^\s\u00a0-]+(?:-[^\s\u00a0-]+)+/g;
function appendText(el,txt){
 let last=0;
 for(const m of txt.matchAll(HYPHEN)){
  if(m.index>last)el.append(document.createTextNode(txt.slice(last,m.index)));
  const s=document.createElement('span');s.className='nw';s.textContent=m[0];el.append(s);last=m.index+m[0].length;
 }
 if(last<txt.length)el.append(document.createTextNode(txt.slice(last)));
}
function setText(el,v){
 el.textContent='';
 v=display(v);
 if(!v)return;
 if(!el.closest(GUARD)){appendText(el,v);return;}
 let m=null;
 if(/^(JP|CN|TW|HK)$/.test(locale))m=v.match(/([^\s]{3}[\u3002\u3001\uff0c\uff0e\uff01\uff1f!?\u2026\u300d\u300f\uff09)\]\u00b7~\u301c]*)$/u);
 else if(locale!=='TH'){
  /* only a short last word needs company; gluing long words makes headings break badly ("왜 두 / 장비를 짝지을까요?") */
  const last=(v.match(/(\S+)$/)||[])[1]||'',core=last.replace(/[.,!?'"’”)\]~\-…]/g,'');
  if(core.length<=(locale==='KO'?2:4))m=v.match(/(\S+[ \t]+\S+)$/);
 }
 if(!m||m[1].length>=v.length){appendText(el,v);return;}
 appendText(el,v.slice(0,v.length-m[1].length));
 const tail=document.createElement('span');tail.className='nw';tail.textContent=m[1];el.append(tail);
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
 document.title=[fields.lf_title,fields.lf_title_em].filter(Boolean).join(' ')+' · BEAUTY BLOSSOM';
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
window.__LIFTING_REVIEW__={get locale(){return locale;},get editable(){return editable;},get editMode(){return editMode;},get inline(){return !!IE;},keys:KEYS};
reply(IE?{type:'aptos-ready',inline:true}:{type:'aptos-ready'});
})();
