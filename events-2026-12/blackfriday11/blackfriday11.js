/* BLF11 blackfriday11 renderer + review-board protocol (aptos-* messages, same as the other V4 pages). Copied to site/blackfriday11/blackfriday11.js by
   v4/blackfriday11/build-blackfriday11.cjs. Every visible word comes from copy-data.js and is edited in place through ../inline-edit.js.
   Display-only helpers (title lines, EVENT chip, money units, ' + ' breaks) never change the stored text: the element text stays equal to the copy. */
(()=>{'use strict';
const DATA=window.PAGE_COPY;
if(!DATA||!DATA.locales||!DATA.locales.KO){document.documentElement.dataset.reviewError='copy-data missing';return;}
const KEYS=Object.keys(DATA.locales.KO);
const qs=new URLSearchParams(location.search);
let locale=String(qs.get('lang')||'KO').toUpperCase();if(!DATA.locales[locale])locale='KO';
let fields={...DATA.locales[locale]};
let editable=false,editMode=false,lastHeight=0;
const root=document.documentElement;
/* 2026-11-10 language versions (EN JP CN TW TH HK, copy from v4/langverify/out/BLF11.final.json): <html lang> drives the language fonts and layout
   rules in blackfriday11-i18n.css (:lang()); the Google font of the language is added here. Korean renders exactly as before. */
const LANG={KO:'ko',EN:'en',JP:'ja',CN:'zh-CN',TW:'zh-TW',TH:'th',HK:'zh-HK'};
const FONT_FAMILY={JP:'Noto Sans JP',CN:'Noto Sans SC',TW:'Noto Sans TC',HK:'Noto Sans TC',TH:'Noto Sans Thai'};
function setFonts(){let l=document.getElementById('locale-fonts');const family=FONT_FAMILY[locale];if(!family){if(l)l.remove();return;}if(!l){l=document.createElement('link');l.id='locale-fonts';l.rel='stylesheet';document.head.append(l);l.addEventListener('load',()=>document.fonts.ready.then(()=>{fit();report();}));}const href='https://fonts.googleapis.com/css2?family='+family.replace(/ /g,'+')+':wght@400;500;600;700;800;900&display=swap';if(l.getAttribute('href')!==href)l.setAttribute('href',href);}
if(qs.get('capture')==='1')root.classList.add('is-capture');
/* 2026-11-06 channel sizes (v4/events/CHANNEL_SIZES_20261106.md): the <head> script sets data-size = home | line | kakao before the CSS.
   In line / kakao no text is shrunk to fit (the size layouts give every line the room it needs); kakao breaks the hero title word in two lines. */
const SIZE=root.getAttribute('data-size')||'home',SIZED=SIZE!=='home';
function reply(message){if(parent!==window)parent.postMessage(message,location.origin);}
const IE=window.BBInlineEdit?window.BBInlineEdit.create({doc:document,raw:k=>fields[k]??'',send:m=>reply(m),refit:()=>{fit();report();},rerender:()=>render()}):null;
function report(){const main=document.querySelector('main');if(!main)return;const h=Math.max(300,Math.min(25000,Math.ceil(main.getBoundingClientRect().height)));if(h===lastHeight)return;lastHeight=h;reply({type:'aptos-size',height:h});}
const span=(cls,t)=>{const s=document.createElement('span');if(cls)s.className=cls;s.textContent=t;return s;};
/* money: the number large, the unit small */
function setMoney(el,v){el.textContent='';const m=/^(\D*?)(\d[\d,.]*)(.*)$/.exec(v||'');if(!m){el.textContent=v||'';return;}
 if(m[1])el.append(span('u pre',m[1]));el.append(span('n',m[2]));if(m[3])el.append(span('u',m[3]));}
/* hero title: first word = Korean line, the rest = the Latin line (the space stays in the text) */
function tl1Of(w){if(SIZE!=='kakao'||w.length<4)return span('tl1',w);const c=/^블랙/.test(w)?2:Math.ceil(w.length/2);const s=span('tl1','');s.append(span('tl1a',w.slice(0,c)),span('tl1b',w.slice(c)));return s;}
/* language versions: the event name ('BLACK FRIDAY' / 'ブラックフライデー' / '黑色星期五') is the first line, the rest the pink second line (no text added or dropped) */
function setTitle(el,v){el.textContent='';v=v||'';
 if(locale!=='KO'){const m=/^(BLACK FRIDAY|ブラックフライデー|黑色星期五)(\s*)(\S[\s\S]*)$/i.exec(v);if(m){el.append(span('tl1',m[1]));if(m[2])el.append(document.createTextNode(m[2]));el.append(span('tl2',m[3]));return;}}
 const i=v.indexOf(' ');if(i<0){el.append(tl1Of(v));return;}
 el.append(tl1Of(v.slice(0,i)),document.createTextNode(' '),span('tl2',v.slice(i+1)));}
/* 'EVENT 01｜리프팅 더블 할인' -> chip | title (the bar stays in the text) */
function setLabel(el,v){el.textContent='';v=v||'';const i=v.indexOf('｜');if(i<0){el.append(span('evt',v));return;}
 el.append(span('evc',v.slice(0,i)),span('evb','｜'),span('evt',v.slice(i+1)));}
/* names: each part stays on one line, breaks only at ' + ' */
function topSplit(v){const parts=[];let depth=0,start=0;for(let i=0;i<v.length;i++){const c=v[i];if(c==='('||c==='[')depth++;else if((c===')'||c===']')&&depth)depth--;else if(!depth&&v.startsWith(' + ',i)){parts.push(v.slice(start,i));start=i+3;i+=2;}}parts.push(v.slice(start));return parts;}
/* language versions: a long part (more than 8 CJK / 14 other characters) may wrap inside itself; short parts stay whole ('面膜' never splits) */
function setParts(el,v){el.textContent='';topSplit(v||'').forEach((p,i)=>{if(i)el.append(span('plus',' + '));const s=span('seg',p);if(locale!=='KO'&&p.length>(/[\u3040-\u30ff\u3400-\u9fff]/.test(p)?8:14))s.classList.add('segw');el.append(s);});}
function setHours(el,v){el.textContent='';const m=/^(.*\S)(\s+)(\d{1,2}:\d{2}\s*[\u2013\u2014~-]\s*\d{1,2}:\d{2}.*)$/.exec(v||'');if(!m){el.textContent=v||'';return;}
 el.append(span('hd',m[1]),document.createTextNode(m[2]),span('ht',m[3]));}
/* 2026-11-10 language versions: international numbers ('+82 10-7215-7511', '+82-2-336-7511') never break (Korean copy has none, so Korean is unchanged) */
const KEEP=/(BEAUTY BLOSSOM|\+?82[ -]\d{1,2}[ -]\d{3,4}-\d{4}|02-336-7511|'뷰티블라썸의원'|VAT 10%|울쎄라피 프라임|최대 49%|7% 추가 할인!|할인가 제공!|조기 종료될|안내드립니다\.|적용이 불가합니다\.|6CC 까지 가능|\d+V|\d+cc|\d+샷|\d+kJ|\d+회)/g;
function appendKept(el,s){let last=0;KEEP.lastIndex=0;for(const m of s.matchAll(KEEP)){if(m.index>last)el.append(document.createTextNode(s.slice(last,m.index)));el.append(span('nw',m[0]));last=m.index+m[0].length;}if(last<s.length)el.append(document.createTextNode(s.slice(last)));}
/* emphasis on the percentage inside the EVENT 01 line ('7%') */
function setEm(el,v){el.textContent='';v=v||'';const m=/(\d+%)/.exec(v);if(!m){appendTail(el,v);return;}
 const pre=v.slice(0,m.index),post=v.slice(m.index+m[0].length);if(pre)el.append(document.createTextNode(pre));el.append(span('em',m[0]));if(post)appendTail(el,post,true);}
/* widow guard: Korean and English keep the last two words together, Chinese and Japanese the last three characters, Thai none (dictionary breaks) */
function appendTail(el,v,noReset){if(!noReset)el.textContent='';const m=locale==='KO'||locale==='EN'?v.match(/(\S+[ \t]+\S+)$/):locale==='TH'?null:v.match(/([^\s]{3}[。！？，、）)]*)$/u);if(!m||m[1].length>=v.length){appendKept(el,v);return;}
 let cut=v.length-m[1].length;
 /* language versions: the kept tail never starts inside a kept phrase (a phone number stays whole: 'WhatsApp：+82 10-7215-7511') */
 if(locale!=='KO'){for(const k of v.matchAll(KEEP))if(cut>k.index&&cut<k.index+k[0].length)cut=k.index;if(cut<=0){appendKept(el,v);return;}}
 appendKept(el,v.slice(0,cut));el.append(span('nw',v.slice(cut)));}
const GUARD='.p-lead,.ev-l1,.pmod,.tl-mod,.fine [data-copy],.notes [data-copy],.at,.ad,.ab-title,.ab-lead [data-copy],.dr-quote,.way-addr > [data-copy],.hrs-note,.bk-links [data-copy]';
function setText(el,v){
 if(el.classList.contains('money')){setMoney(el,v);return;}
 if(el.classList.contains('h-title')){setTitle(el,v);return;}
 if(el.classList.contains('ev-label')){setLabel(el,v);return;}
 if(el.classList.contains('ev-l2')){setEm(el,v);return;}
 if(el.matches('.pname,.tl-name')){setParts(el,v);return;}
 if(el.matches('.hrs [data-copy]')){setHours(el,v);return;}
 if(!v){el.textContent='';return;}
 if(!el.matches(GUARD)){KEEP.lastIndex=0;if(KEEP.test(v)){el.textContent='';appendKept(el,v);}else el.textContent=v;KEEP.lastIndex=0;return;}
 appendTail(el,v);}
function isPhone(){const m=document.querySelector('main');return !!m&&m.clientWidth<=600;}
function fitTo(el,limit,min){el.style.removeProperty('--fit');for(let f=1,i=0;i<40&&el.scrollWidth>limit+1&&f>min;i++){f-=.02;el.style.setProperty('--fit',f.toFixed(3));}return el.scrollWidth<=limit+1;}
function fitLines(el,lines,min){el.style.removeProperty('--fit');const lh=()=>parseFloat(getComputedStyle(el).lineHeight)||0;for(let f=1,i=0;i<30&&(el.getBoundingClientRect().height>lh()*lines+2||el.scrollWidth>el.clientWidth+1)&&f>min;i++){f-=.02;el.style.setProperty('--fit',f.toFixed(3));}}
function fit(){
 const phone=isPhone();
 /* title lines: shrink until the text itself (not the block box) fits the title width */
 const natural=(el)=>{const r=document.createRange();r.selectNodeContents(el);return r.getBoundingClientRect().width;};
 for(const t of document.querySelectorAll('.h-title')){const w=t.clientWidth;for(const el of t.querySelectorAll('.tl1,.tl2')){el.style.removeProperty('--fit');if(SIZED&&locale==='KO')continue;for(let f=1,i=0;i<40&&natural(el)>w*(phone?.97:.985)&&f>.5;i++){f-=.02;el.style.setProperty('--fit',f.toFixed(3));}}}
 for(const el of document.querySelectorAll('.ev-label')){if(SIZED){el.style.removeProperty('--fit');continue;}const box=el.parentElement;fitTo(el,box.clientWidth-(parseFloat(getComputedStyle(box).paddingLeft)||0)-(parseFloat(getComputedStyle(box).paddingRight)||0),.6);}
 for(const el of document.querySelectorAll('.pname')){if(phone||SIZED){el.style.removeProperty('--fit');continue;}fitLines(el,1,.82);}
 for(const el of document.querySelectorAll('.ab-title,.ab-strengths .at')){if(phone||(SIZED&&locale==='KO')){el.style.removeProperty('--fit');continue;}if(locale!=='KO'){if(el.matches('.at'))fitLines(el,3,.86);else fitLines(el,2,.74);continue;}fitLines(el,2,.74);}
 /* language versions: the international phone number may come down by at most 15 % to fit the booking box (Korean never shrinks) */
 for(const el of document.querySelectorAll('.bk-phone')){if(locale==='KO'||phone){el.style.removeProperty('--fit');continue;}fitTo(el,el.clientWidth,.85);}
}
const LINE_SPLIT=SIZE==='line'?new Map([...document.querySelectorAll('section.c2a:not([data-size-only])')].map(el=>[el,el.innerHTML])):new Map();
function prepareLineParts(){
 for(const [card,original] of LINE_SPLIT){
  if(locale==='KO'){
   if(card.hasAttribute('data-i18n-split')){document.getElementById(card.dataset.i18nClone)?.remove();card.innerHTML=original;for(const a of ['data-i18n-split','data-i18n-clone','data-part'])card.removeAttribute(a);}
   continue;
  }
  if(card.hasAttribute('data-i18n-split'))continue;
  const clone=card.cloneNode(true),id='bf-l2a-i18n';clone.id=id;clone.setAttribute('data-i18n-created','true');
  for(const el of clone.querySelectorAll('[id]'))el.id+='-i18n';
  if(clone.hasAttribute('aria-labelledby'))clone.setAttribute('aria-labelledby',clone.getAttribute('aria-labelledby')+'-i18n');
  card.dataset.i18nSplit='true';card.dataset.i18nClone=id;card.dataset.part='1';clone.dataset.i18nSplit='true';clone.dataset.part='2';
  [...card.querySelectorAll('.plist-a > .pr')].forEach((r,i)=>{if(i>=6)r.remove();});
  [...clone.querySelectorAll('.plist-a > .pr')].forEach((r,i)=>{if(i<6)r.remove();});
  card.querySelector('.cp-foot')?.remove();clone.querySelector('.p-lead')?.remove();
  card.after(clone);
 }
}
function render(){
 root.lang=LANG[locale]||'ko';root.dataset.locale=locale;setFonts();prepareLineParts();
 root.classList.toggle('is-editable',editable);root.classList.toggle('is-editmode',editable&&editMode);
 for(const el of document.querySelectorAll('[data-copy]')){
  if(IE&&IE.holds(el))continue;
  const v=fields[el.dataset.copy]??'';setText(el,v);
  const empty=!String(v).trim();el.classList.toggle('is-empty',empty);
  if(el.hasAttribute('data-optional'))el.hidden=empty&&!(editable&&editMode);
 }
 for(const g of document.querySelectorAll('[data-optional-group]'))g.hidden=[...g.querySelectorAll('[data-optional]')].every(e=>e.hidden);
 for(const el of document.querySelectorAll('[data-alt]'))el.alt=fields[el.dataset.alt]??'';
 const CH=(DATA.channels&&DATA.channels[locale])||null;
 for(const a of document.querySelectorAll('a[data-link]')){const n=a.dataset.link;const href=CH&&(n in CH)?CH[n]:(DATA.links&&DATA.links[n]);if(href)a.href=href;else a.removeAttribute('href');if(n!=='phone'){a.target='_blank';a.rel='noopener noreferrer';}}
 for(const img of document.querySelectorAll('img[data-qr]')){const q=CH&&CH.qr;if(q&&img.getAttribute('src')!==q)img.setAttribute('src',q);}
 const GM=(DATA.gmap&&DATA.gmap[locale])||null;
 for(const el of document.querySelectorAll('[data-gmap]')){const u=GM&&GM[el.dataset.gmap];if(!u)continue;const a=el.tagName==='SOURCE'?'srcset':'src';if(el.getAttribute(a)!==u)el.setAttribute(a,u);}
 for(const w of document.querySelectorAll('[data-bk-alt]')){const lab=w.querySelector('[data-copy]');w.hidden=!String((lab&&fields[lab.dataset.copy])??'').trim()&&!(editable&&editMode);}
 document.title=[fields.bf_title||'','BEAUTY BLOSSOM'].join(' \u00b7 ');
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
 }else if(msg.type==='aptos-save-result'){if(IE)IE.saveResult(msg);}
 else if(msg.type==='aptos-start-edit'&&typeof msg.field==='string'){if(IE)IE.start(msg.field);}
});
window.addEventListener('resize',()=>{fit();report();});
if(document.fonts&&document.fonts.addEventListener)document.fonts.addEventListener('loadingdone',()=>{fit();report();});
const main=document.querySelector('main');
if(main&&'ResizeObserver' in window)new ResizeObserver(report).observe(main);
for(const img of document.images){if(!img.complete){img.addEventListener('load',report,{once:true});img.addEventListener('error',report,{once:true});}}
render();
window.__BF11__={get locale(){return locale;},get editable(){return editable;},get editMode(){return editMode;},get inline(){return !!IE;},keys:KEYS};
reply(IE?{type:'aptos-ready',inline:true}:{type:'aptos-ready'});
})();
