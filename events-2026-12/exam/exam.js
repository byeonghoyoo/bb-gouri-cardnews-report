/* 수능 이벤트 V3 renderer + review-board protocol (aptos-* messages, same as the existing board). */
(()=>{'use strict';
const DATA=window.EXAM_COPY;
if(!DATA||!DATA.locales||!DATA.locales.KO){document.documentElement.dataset.reviewError='copy-data missing';return;}
const KEYS=Object.keys(DATA.locales.KO);
const LANG={KO:'ko',EN:'en',JP:'ja',CN:'zh-CN',TW:'zh-TW',TH:'th',HK:'zh-HK'};
const G='https://fonts.googleapis.com/css2?';
const FONT_CSS={
 KO:G+'family=Jua&family=Gaegu:wght@400;700&family=Nanum+Pen+Script&display=swap',
 EN:G+'family=Fredoka:wght@500;600;700&family=Caveat:wght@500;700&display=swap',
 JP:G+'family=Zen+Maru+Gothic:wght@500;700;900&family=Yomogi&family=Noto+Sans+JP:wght@400;500;700&display=swap',
 CN:G+'family=ZCOOL+KuaiLe&family=Noto+Sans+SC:wght@400;500;700;900&display=swap',
 TW:G+'family=LXGW+WenKai+TC:wght@400;700&family=Noto+Sans+TC:wght@400;500;700;900&display=swap',
 HK:G+'family=LXGW+WenKai+TC:wght@400;700&family=Noto+Sans+TC:wght@400;500;700;900&display=swap',
 TH:G+'family=Kanit:wght@500;600;700&family=Sriracha&family=Noto+Sans+Thai:wght@400;500;700&display=swap'
};
const qs=new URLSearchParams(location.search);
let locale=String(qs.get('lang')||'KO').toUpperCase();if(!DATA.locales[locale])locale='KO';
let fields={...DATA.locales[locale]};
let editable=false,editMode=false,editField=null,pending=false,lastHeight=0;
const root=document.documentElement;

/* "YOU DID IT!" type image: fall back to live text if the PNG is missing */
for(const img of document.querySelectorAll('.type-img')){
 const swap=()=>{const s=document.createElement('span');s.className='type-fallback';s.textContent=img.alt;img.replaceWith(s);report();};
 if(img.complete&&!img.naturalWidth)swap();else img.addEventListener('error',swap,{once:true});
}

/* edit dialog (same UX as the Aptos review adapter) */
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

/* keep prices and tab rows on one line: shrink through --fit only when they would overflow */
function fitTo(el,limit,min=.62){
 el.style.removeProperty('--fit');
 for(let f=1,i=0;i<24&&el.scrollWidth>limit+1&&f>min;i++){f-=.02;el.style.setProperty('--fit',f.toFixed(3));}
 return el.scrollWidth<=limit+1;
}
function fit(){
 for(const el of document.querySelectorAll('.fit'))fitTo(el,el.clientWidth);
 /* bucket list: one line each; the doodle circle is decoration and must not count as text width */
 for(const li of document.querySelectorAll('.todo li')){const deco=[...li.querySelectorAll('.deco')];deco.forEach(d=>d.style.display='none');fitTo(li,li.clientWidth);deco.forEach(d=>d.style.display='');}
 /* booking links: stay on one line when a small shrink is enough, otherwise wrap inside the ticket */
 for(const a of document.querySelectorAll('.tk-row dd a')){a.classList.remove('wrap');if(!fitTo(a,a.parentElement.clientWidth,.8)){a.style.removeProperty('--fit');a.classList.add('wrap');}}
 for(const tabs of document.querySelectorAll('.tabs')){
  tabs.style.removeProperty('--fit');
  for(let f=1,i=0;i<20&&tabs.scrollWidth>tabs.clientWidth+1&&f>.6;i++){f-=.03;tabs.style.setProperty('--fit',f.toFixed(3));}
 }
}

/* widow guard: keep the last two words (CJK: last two characters) together. Text content stays identical. */
const GUARD='h1,h2,.hook,figcaption,.hp-label,.pi-note,.q,.a,.intro-body,.tk-row dd,.steps li,.todo li,.nb-title,.r-title,.foot p';
function setText(el,v){
 el.textContent='';
 /* display only: a middle dot never starts a new line ("Black Peel · LHALA Peel") */
 if(v)v=v.replace(/ ([\u00b7\u30fb])/g,'\u00a0$1');
 /* display only: product names stay in one piece ("베이직 피부관리", "Black Peel") */
 if(v)for(const k of ['offer1_title','offer4_title','prod_black_name','prod_lhala_name','prod_yes_name']){const n=fields[k];if(n&&n.includes(' ')&&n.length<=24&&v.includes(n))v=v.split(n).join(n.replace(/ /g,'\u00a0'));}
 if(!v||!el.closest(GUARD)){el.textContent=v;return;}
 let m=null;
 if(/^(JP|CN|TW|HK)$/.test(locale))m=v.match(/([^\s]{3}[\u3002\u3001\uff0c\uff0e\uff01\uff1f!?\u2026\u300d\u300f\uff09)\]\u00b7~\u301c]*)$/u);
 else if(locale!=='TH')m=v.match(/(\S+[ \t]+\S+)$/);
 if(!m||m[1].length>=v.length){el.textContent=v;return;}
 const tail=document.createElement('span');tail.className='nw';tail.textContent=m[1];
 el.append(document.createTextNode(v.slice(0,v.length-m[1].length)),tail);
}
function render(){
 root.lang=LANG[locale]||'ko';root.dataset.locale=locale;
 root.classList.toggle('is-editable',editable);
 root.classList.toggle('is-editmode',editable&&editMode);
 setFonts();
 for(const el of document.querySelectorAll('[data-copy]')){
  const v=fields[el.dataset.copy]??'';setText(el,v);
  const empty=!String(v).trim();el.classList.toggle('is-empty',empty);
  if(el.hasAttribute('data-optional'))el.hidden=empty&&!(editable&&editMode);
  if(editable)el.title='더블클릭하여 수정';else el.removeAttribute('title');
 }
 for(const g of document.querySelectorAll('[data-optional-group]'))g.hidden=[...g.querySelectorAll('[data-optional]')].every(e=>e.hidden);
 for(const el of document.querySelectorAll('[data-alt]'))el.alt=fields[el.dataset.alt]??'';
 for(const a of document.querySelectorAll('a[data-link]')){
  const href=DATA.links[a.dataset.link];if(href)a.href=href;
  if(a.dataset.link!=='phone'){a.target='_blank';a.rel='noopener noreferrer';}
 }
 document.title=[fields.title,fields.title_strong].filter(Boolean).join(' ')+' · BEAUTY BLOSSOM';
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
 /* the board sizes this iframe to its full content height, so a centred modal would open thousands of px away:
    open the editor right next to the field that was clicked */
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
document.addEventListener('dblclick',e=>{const el=e.target.closest('[data-copy]');if(el&&editable){e.preventDefault();startEdit(el);}});
document.addEventListener('click',e=>{const el=e.target.closest('[data-copy]');if(el&&editable&&editMode){e.preventDefault();startEdit(el);}});

window.addEventListener('message',event=>{
 if(event.source!==parent||event.origin!==location.origin)return;
 const msg=event.data;if(!msg||typeof msg!=='object')return;
 if(msg.type==='aptos-data'&&DATA.locales[msg.locale]&&msg.fields&&typeof msg.fields==='object'){
  if(msg.locale!==locale){locale=msg.locale;fields={...DATA.locales[locale]};}
  for(const k of KEYS)if(typeof msg.fields[k]==='string')fields[k]=msg.fields[k];
  editable=msg.editable===true;editMode=msg.editMode===true;render();
 }else if(msg.type==='aptos-save-result'&&msg.field===editField){
  pending=false;save.disabled=false;cancel.disabled=false;
  if(msg.ok){const f=editField;editField=null;dlg.close();void f;}
  else info.textContent=(msg.error||'저장되지 않았습니다.')+' 최신 문구: '+(fields[editField]||'');
 }else if(msg.type==='aptos-start-edit'&&typeof msg.field==='string'){
  const el=[...document.querySelectorAll('[data-copy]')].find(x=>x.dataset.copy===msg.field);if(el)startEdit(el);
 }
});

window.addEventListener('resize',()=>{fit();report();});
/* locale web fonts arrive after the first render: measure again whenever a font finishes loading */
if(document.fonts&&document.fonts.addEventListener)document.fonts.addEventListener('loadingdone',()=>{fit();report();});
const fontLink=document.getElementById('locale-fonts');if(fontLink)fontLink.addEventListener('load',()=>document.fonts.ready.then(()=>{fit();report();}));
const main=document.querySelector('main');
if(main&&'ResizeObserver' in window)new ResizeObserver(report).observe(main);
for(const img of document.images){if(!img.complete){img.addEventListener('load',report,{once:true});img.addEventListener('error',report,{once:true});}}
render();
window.__EXAM_REVIEW__={get locale(){return locale;},get editable(){return editable;},get editMode(){return editMode;},keys:KEYS};
reply({type:'aptos-ready'});
})();
