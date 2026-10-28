(()=>{'use strict';
const STORY_KEYS=['story_question','story_title','story_body','feature1_title','feature1_body','feature2_title','feature2_body','feature3_title','feature3_body','guide_title','guide_body','cta_title','care_title','care_intro','care1_title','care1_body','care2_title','care2_body','care3_title','care3_body'];
let fields={...window.LANDING_COPY.text,...Object.fromEntries(STORY_KEYS.map(key=>[key,'']))}, locale='KO', editable=false, editField=null, pending=false, tapEdit=false, lastHeight=0;
const languages={KO:'ko',EN:'en',JP:'ja',CN:'zh-CN',TW:'zh-TW',TH:'th',HK:'zh-HK'};
const dlg=document.createElement('dialog');dlg.className='review-dialog';
const form=document.createElement('form');form.method='dialog';
const heading=document.createElement('h2');heading.textContent='문구·금액 수정';
const label=document.createElement('label');label.textContent='선택한 문구';
const input=document.createElement('textarea');input.rows=5;input.maxLength=2000;input.setAttribute('aria-label','선택한 문구');
const info=document.createElement('p');info.className='edit-info';
const actions=document.createElement('div');actions.className='edit-actions';
const cancel=document.createElement('button');cancel.type='button';cancel.textContent='취소';
const save=document.createElement('button');save.type='button';save.textContent='공유 저장';
actions.append(cancel,save);label.append(input);form.append(heading,label,info,actions);dlg.append(form);document.body.append(dlg);
function reply(message){if(parent!==window)parent.postMessage(message,location.origin);}
function reportSize(){
 const main=document.querySelector('main');if(!main)return;
 const height=Math.max(300,Math.min(25000,Math.ceil(main.getBoundingClientRect().height)));
 if(height===lastHeight)return;lastHeight=height;reply({type:'aptos-size',height});
}
function fit(){
 for(const el of document.querySelectorAll('[data-copy]'))el.style.fontSize='';
 if(matchMedia('(max-width: 900px)').matches||locale==='KO'){reportSize();return;}
 for(const el of document.querySelectorAll('[data-copy]')){
  if(el.closest('.offer-seal'))continue;
  let initial=parseFloat(getComputedStyle(el).fontSize), min=initial*.43;
  if(el.scrollWidth>el.clientWidth+1){
   let size=Math.max(min,initial*(el.clientWidth-2)/el.scrollWidth);el.style.fontSize=size+'px';
   for(let i=0;i<12&&el.scrollWidth>el.clientWidth+1&&size>min;i++){size=Math.max(min,size-.5);el.style.fontSize=size+'px';}
  }
 }
}
function render(){
 document.documentElement.lang=languages[locale]||'ko';document.documentElement.dataset.locale=locale;
 document.documentElement.classList.toggle('review-editable',editable);
 for(const el of document.querySelectorAll('[data-copy]')){
  const id=el.dataset.copy;el.textContent=fields[id]??'';el.title=editable?'더블클릭하여 수정':'';
  if(el.classList.contains('sale-price')&&locale==='KO'){
   const value=fields[id]??'',cut=value.indexOf('만원');
   if(cut>=0){el.replaceChildren(document.createTextNode(value.slice(0,cut)));const u=document.createElement('span');u.className='unit';u.textContent=value.slice(cut);el.append(u);}
  }
 }
 for(const el of document.querySelectorAll('[data-alt]'))el.alt=fields[el.dataset.alt]??'';
 if(locale==='KO'){
 const intro=document.querySelector('.hero-intro'),start=fields.intro.indexOf('바이오리프팅');
 if(start>=0){intro.replaceChildren(document.createTextNode(fields.intro.slice(0,start)));const b=document.createElement('strong');b.textContent=fields.intro.slice(start);intro.append(b);}
 const seal=document.querySelector('[data-copy="badge"]'),parts=fields.badge.match(/^(\S+ )(.*% )(\S+)$/);
 if(parts){seal.replaceChildren();for(let i=1;i<parts.length;i++){const line=document.createElement('span');line.className='seal-line'+(i===2?' seal-strong':'');line.textContent=parts[i];seal.append(line);}}
 }
 for(const el of document.querySelectorAll('.optional-copy'))el.classList.toggle('is-empty',!String(fields[el.dataset.copy]??'').trim());
 for(const section of document.querySelectorAll('.optional-section'))section.hidden=![...section.querySelectorAll('.optional-copy')].some(el=>!el.classList.contains('is-empty'));
 document.documentElement.classList.toggle('has-v2-story',STORY_KEYS.some(key=>String(fields[key]??'').trim()));
 document.title=fields.title_main||'NAMICA';
 requestAnimationFrame(()=>{fit();reportSize();});document.fonts.ready.then(()=>{fit();reportSize();});
 document.documentElement.dataset.reviewReady='true';
}
function startEdit(el){if(!editable||pending)return;editField=el.dataset.copy;input.value=fields[editField]??'';reply({type:'aptos-editing',field:editField});info.textContent='가격은 표시된 통화·단위를 유지해 입력해 주세요.';save.disabled=false;cancel.disabled=false;dlg.showModal();input.focus();input.select();}
function submit(){if(pending||!editField)return;if(input.value===fields[editField]){dlg.close();return;}pending=true;save.disabled=true;cancel.disabled=true;info.textContent='서버에 저장 중입니다…';reply({type:'aptos-edit',field:editField,value:input.value});}
save.addEventListener('click',submit);cancel.addEventListener('click',()=>dlg.close());dlg.addEventListener('close',()=>{reply({type:'aptos-edit-cancel'});editField=null;});
dlg.addEventListener('cancel',e=>{if(pending)e.preventDefault();});input.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();submit();}});
document.addEventListener('dblclick',e=>{const el=e.target.closest('[data-copy]');if(el){e.preventDefault();startEdit(el);}});
document.addEventListener('click',e=>{const hit=e.target.closest('[data-copy]');if(editable&&hit){e.preventDefault();if(tapEdit)startEdit(hit);}});
window.addEventListener('message',event=>{
 if(event.source !== parent||event.origin!==location.origin)return;
 const msg=event.data;if(!msg||typeof msg!=='object')return;
 if(msg.type==='aptos-data'&&languages[msg.locale]&&msg.fields&&typeof msg.fields==='object'){
  for(const key of [...Object.keys(window.LANDING_COPY.text),...STORY_KEYS])if(typeof msg.fields[key]==='string')fields[key]=msg.fields[key];
  locale=msg.locale;editable=msg.editable===true;tapEdit=msg.editMode===true;render();
 }else if(msg.type==='aptos-save-result'&&msg.field===editField){
  pending=false;save.disabled=false;cancel.disabled=false;
  if(msg.ok){dlg.close();editField=null;}else {info.textContent=(msg.error||'저장되지 않았습니다.')+' 최신 문구: '+(fields[editField]||'');}
 }else if(msg.type==='aptos-start-edit'&&typeof msg.field==='string'){
  const el=[...document.querySelectorAll('[data-copy]')].find(x=>x.dataset.copy===msg.field);if(el)startEdit(el);
 }
});
window.addEventListener('resize',()=>{fit();reportSize();});
const main=document.querySelector('main');if(main&&'ResizeObserver'in window)new ResizeObserver(reportSize).observe(main);
for(const image of document.images){if(!image.complete){image.addEventListener('load',reportSize,{once:true});image.addEventListener('error',reportSize,{once:true});}}
document.fonts.ready.then(reportSize);requestAnimationFrame(reportSize);
window.__APTOS_REVIEW__={get locale(){return locale;},get editable(){return editable;}};
reply({type:'aptos-ready'});
})();
