/* NAMICA launch invitation (board item "aptos") renderer + review-board protocol (aptos-* messages, same as site/exam). */
(()=>{'use strict';
const DATA=window.PAGE_COPY;
if(!DATA||!DATA.locales||!DATA.locales.KO){document.documentElement.dataset.reviewError='copy-data missing';return;}
const KEYS=Object.keys(DATA.locales.KO);
const LANG={KO:'ko',EN:'en',JP:'ja',CN:'zh-CN',TW:'zh-TW',TH:'th',HK:'zh-HK'};
const G='https://fonts.googleapis.com/css2?';
const FONT_CSS={
 KO:G+'family=Gowun+Batang:wght@400;700&display=swap',
 EN:G+'family=Gowun+Batang:wght@400;700&display=swap',
 JP:G+'family=Shippori+Mincho:wght@500;700;800&family=Noto+Sans+JP:wght@400;500;700&display=swap',
 CN:G+'family=Noto+Serif+SC:wght@500;700;900&family=Noto+Sans+SC:wght@400;500;700&display=swap',
 TW:G+'family=Noto+Serif+TC:wght@500;700;900&family=Noto+Sans+TC:wght@400;500;700&display=swap',
 HK:G+'family=Noto+Serif+TC:wght@500;700;900&family=Noto+Sans+TC:wght@400;500;700&display=swap',
 TH:G+'family=Noto+Serif+Thai:wght@500;600;700&family=Noto+Sans+Thai:wght@400;500;700&display=swap'
};
const qs=new URLSearchParams(location.search);
let locale=String(qs.get('lang')||'KO').toUpperCase();if(!DATA.locales[locale])locale='KO';
let fields={...DATA.locales[locale]};
let editable=false,editMode=false,editField=null,pending=false,lastHeight=0;
const root=document.documentElement;
function reply(message){if(parent!==window)parent.postMessage(message,location.origin);}
/* in-place editing (../inline-edit.js): tap a copy, type, Enter or tap elsewhere saves. Without it the dialog below is the editor. */
const IE=window.BBInlineEdit?window.BBInlineEdit.create({doc:document,raw:k=>fields[k]??'',send:m=>reply(m),refit:()=>{fit();report();},rerender:()=>render()}):null;

/* type images: fall back to live script text when the PNG/WebP has not been delivered */
for(const img of document.querySelectorAll('.type-img')){
 const swap=()=>{const s=document.createElement('span');s.className='type-fallback';s.textContent=img.alt;img.replaceWith(s);report();};
 if(img.complete&&!img.naturalWidth)swap();else img.addEventListener('error',swap,{once:true});
}
/* decorative assets (Miricanvas / product cutouts) not delivered yet: CSS stand-in or nothing */
for(const img of document.querySelectorAll('img[data-fb]')){
 const fb=img.dataset.fb;
 const swap=()=>{if(fb==='hide'){img.remove();report();return;}
  const s=document.createElement('span');s.className=img.className+' fb fb-'+fb;s.setAttribute('aria-hidden','true');
  if(fb==='box'){s.dataset.alt=img.dataset.alt||'';s.removeAttribute('aria-hidden');s.setAttribute('role','img');}
  img.replaceWith(s);report();};
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

/* one-line price/heading rows: shrink through --fit only when they would overflow */
function fitTo(el,limit,min=.6){
 el.style.removeProperty('--fit');
 for(let f=1,i=0;i<26&&el.scrollWidth>limit+1&&f>min;i++){f-=.02;el.style.setProperty('--fit',f.toFixed(3));}
 return el.scrollWidth<=limit+1;
}
function fit(){
 for(const el of document.querySelectorAll('.fit'))if(el.offsetParent)fitTo(el,el.clientWidth);
 for(const a of document.querySelectorAll('.rsvp-rows dd a')){a.classList.remove('wrap');if(!fitTo(a,a.parentElement.clientWidth,.8)){a.style.removeProperty('--fit');a.classList.add('wrap');}}
}

/* words that must never be split across lines (display only, text content stays identical):
   Thai transliterations and compounds have no dictionary break points, CJK terms read badly when split */
const KEEP={
 ALL:['P(LA/CL)'],
 TH:['ไฮยาลูรอนิก','แอซิด','เจเนอเรชัน','ไบโอลิฟติ้ง','ลิฟติ้ง','ร่วมกัน','ความกระชับ','ไหมละลาย','ความยาวไหม','กรอบหน้า','ใบหน้า','ส่วนกลาง','หย่อนคล้อย','โปรแกรม','คอมโบ','สกินโบท็อกซ์','ผลิตภัณฑ์','ปรึกษา','เปิดตัว','คำเชิญ','ตอบรับ','สถานี','ฮับจอง','แตกต่าง','ดูแล','ได้แก่','ความหย่อนคล้อย','ด้วยกัน','ระยะพักฟื้น','แผนกต้อนรับ'],
 CN:['玻尿酸','可吸收线','下颌线','中下面部','第四代','埋线','产品线','组合方案','紧致','轮廓','脸颊','新品首发','首发','肌肤','皮肤肉毒','线长','咨询','合井站','分为','单项方案','脸部结构','恢复','注入'],
 TW:['玻尿酸','可吸收線','下顎線','中下臉','第四代','埋線','拉提','組合方案','緊緻','輪廓','臉頰','新品首發','首發','肌膚','皮膚肉毒','線長','線材','諮詢','合井站','分為','單項方案','臉部結構','恢復'],
 HK:['透明質酸','可吸收線','下顎線','中下面部','第四代','埋線','組合療程','緊緻','輪廓','臉頰','新品首發','首發','肌膚','皮膚肉毒','線長','諮詢','合井站','分為','單項療程','面部結構','恢復','注入了'],
 JP:['ヒアルロン酸','フェイスライン','バイオリフティング','リフティング','プログラム','カウンセリング','ローンチ','スキンボトックス','コアトックス','中・下顔面','溶ける糸','ハプチョン駅','ヒアルロン酸（HA）を']
};
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const keepRe=loc=>{const l=[...KEEP.ALL,...(KEEP[loc]||[])].sort((a,b)=>b.length-a.length);return l.length?new RegExp(l.map(esc).join('|'),'gu'):null;};
function appendKeep(parent,s){
 const re=keepRe(locale);let last=0;
 if(re)for(const m of s.matchAll(re)){if(m.index>last)parent.append(document.createTextNode(s.slice(last,m.index)));const k=document.createElement('span');k.className='nw';k.textContent=m[0];parent.append(k);last=m.index+m[0].length;}
 if(last<s.length)parent.append(document.createTextNode(s.slice(last)));
}
/* widow guard: keep the last two words (CJK: last three characters) together. Text content stays identical. */
const GUARD='h1,h2,h3,.inv-sub,.letter-body,.letter-to,.sec-body,.line-desc,.combo-desc,.q,.a,.notice li,.qr-label,.rsvp-rows dd,.foot p';
function setText(el,v){
 el.textContent='';
 if(v)v=v.replace(/ ([\u00b7\u30fb])/g,'\u00a0$1');
 if(!v){el.textContent=v;return;}
 if(!el.closest(GUARD)){appendKeep(el,v);return;}
 let m=null;
 if(/^(JP|CN|TW|HK)$/.test(locale))m=v.match(/([^\s]{3}[\u3002\u3001\uff0c\uff0e\uff01\uff1f!?\u2026\u300d\u300f\uff09)\]\u00b7~\u301c]*)$/u);
 else if(locale!=='TH')m=v.match(/(\S+[ \t]+\S+)$/);
 if(!m||m[1].length>=v.length){appendKeep(el,v);return;}
 /* a protected word that straddles the tail start joins the tail */
 let cut=v.length-m[1].length;const re=keepRe(locale);
 if(re)for(const k of v.matchAll(re))if(k.index<cut&&k.index+k[0].length>cut)cut=k.index;
 appendKeep(el,v.slice(0,cut));
 const tail=document.createElement('span');tail.className='nw';appendKeep(tail,v.slice(cut));el.append(tail);
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
 for(const el of document.querySelectorAll('.fb-box'))el.setAttribute('aria-label',fields[el.dataset.alt]??'');
 for(const a of document.querySelectorAll('a[data-link]')){
  const href=DATA.links[a.dataset.link];if(href)a.href=href;
  if(a.dataset.link!=='phone'){a.target='_blank';a.rel='noopener noreferrer';}
 }
 if(IE)IE.sync(editable);
 document.title=[fields.nm_hero_title,fields.nm_hero_kicker].filter(Boolean).join(' · ')+' · BEAUTY BLOSSOM';
 requestAnimationFrame(()=>{fit();report();});
 document.fonts.ready.then(()=>{fit();report();});
 root.dataset.reviewReady='true';
}

/* in-page jump: the board sizes this frame to its full height, so scroll whichever ancestor can move */
document.addEventListener('click',e=>{
 const a=e.target.closest('a[data-jump]');if(!a)return;
 if(root.classList.contains('bb-inline'))return; /* editing the button label */
 const t=document.getElementById(a.dataset.jump);if(!t)return;
 e.preventDefault();t.scrollIntoView({behavior:'smooth',block:'start'});
});

function startEdit(el){
 if(!editable||pending)return;
 editField=el.dataset.copy;input.value=fields[editField]??'';
 reply({type:'aptos-editing',field:editField});
 info.textContent=/_(old|sale)$/.test(editField)?'금액은 숫자와 쉼표·소수점만 입력해 주세요. 통화 단위는 별도 칸입니다.':(el.dataset.placeholder?el.dataset.placeholder:'줄바꿈은 그대로 반영됩니다.');
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
window.__NM_REVIEW__={get locale(){return locale;},get editable(){return editable;},get editMode(){return editMode;},get inline(){return !!IE;},keys:KEYS};
reply(IE?{type:'aptos-ready',inline:true}:{type:'aptos-ready'});
})();
