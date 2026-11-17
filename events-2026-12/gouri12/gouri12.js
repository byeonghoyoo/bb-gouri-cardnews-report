/* GOU12 고우리 오픈이벤트 · 겨울 시즌 renderer + review-board protocol (aptos-* messages, same as FV12 / ULT12 and the other V4 pages).
   Every visible word comes from copy-data.js (names and 만원 strings from v4/events/_data/pages.json via v4/gouri12/build-gouri12.cjs)
   and is edited in place through ../inline-edit.js. Display helpers only wrap text in spans; the stored text is never changed.
   ?capture=1 (board image download): no motion, fixed layout. */
(()=>{'use strict';
const DATA=window.PAGE_COPY;
if(!DATA||!DATA.locales||!DATA.locales.KO){document.documentElement.dataset.reviewError='copy-data missing';return;}
const KEYS=Object.keys(DATA.locales.KO);
/* 2026-11-14 language version (CN, copy from v4/langverify/out/GOU12.final.json): <html lang> drives the language fonts and layout rules in
   gouri12-i18n.css (:lang()); the Google font of the language is added here (same as cerf12.js / sofwave12.js / thermage12.js). Korean renders exactly as before. */
const LANG={KO:'ko',EN:'en',JP:'ja',CN:'zh-CN',TW:'zh-TW',TH:'th',HK:'zh-HK'};
const FONT_FAMILY={JP:'Noto Sans JP',CN:'Noto Sans SC',TW:'Noto Sans TC',HK:'Noto Sans TC',TH:'Noto Sans Thai'};
const CJK={JP:1,CN:1,TW:1,HK:1},SEGS={};
const qs=new URLSearchParams(location.search);
let locale=String(qs.get('lang')||'KO').toUpperCase();if(!DATA.locales[locale])locale='KO';
let fields={...DATA.locales[locale]};
let editable=false,editMode=false,lastHeight=0;
const root=document.documentElement;
if(qs.get('capture')==='1')root.classList.add('is-capture');

function setFonts(){let l=document.getElementById('locale-fonts');const family=FONT_FAMILY[locale];if(!family){if(l)l.remove();return;}if(!l){l=document.createElement('link');l.id='locale-fonts';l.rel='stylesheet';document.head.append(l);l.addEventListener('load',()=>document.fonts.ready.then(()=>{fit();report();}));}const href='https://fonts.googleapis.com/css2?family='+family.replace(/ /g,'+')+':wght@400;500;600;700;800;900&display=swap';if(l.getAttribute('href')!==href)l.setAttribute('href',href);}
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
/* two-tone headline (sheet F): the first word glossy (.k1), the rest bold with a white outline (.k2); the space stays in the text */
function setSplit(el,v){
 el.textContent='';
 const m=/^(\S+)(\s+)(.+)$/.exec(v||'');
 /* 2026-11-17 TW: a hero / card 2 title without a space after the Latin name ('GOURI上市優惠', 'GOURI膠原蛋白增生護理優惠活動') is split after the name
    like the other versions ('GOURI 上市活动'); display only, the stored text keeps no space. CN / HK / KO titles have the space, so nothing changes there */
 if(!m&&CJK[locale]&&el.matches('.title,.ptitle')){const c=/^([A-Za-z][A-Za-z0-9]*)([\u2E80-\u9FFF\uF900-\uFAFF].*)$/.exec(v||'');if(c){el.append(span('k1',c[1]),span('k2',c[2]));return;}}
 if(!m){el.append(span('k1',v||''));return;}
 el.append(span('k1',m[1]),document.createTextNode(m[2]),span('k2',m[3]));
 /* 2026-11-17 TH: a Thai title breaks only at its spaces (the browser's Thai dictionary split 'คอลลา' / 'เจน' and 'กระ' / 'ตุ้น' on phones, and keep-all does
    not stop it); each phrase is kept whole. Display only; the other languages are set as before */
 if(locale==='TH')for(const s of el.querySelectorAll('.k1,.k2')){const t=s.textContent;s.textContent='';for(const p of t.split(/(\s+)/))if(p)s.append(/^\s+$/.test(p)?document.createTextNode(p):span('nw',p));}
}
/* card 5 hours: the day label and the time are styled apart */
function setHours(el,v){
 el.textContent='';
 const m=/^(.*\S)(\s+)(\d{1,2}:\d{2}\s*[\u2013\u2014~-]\s*\d{1,2}:\d{2}.*)$/.exec(v||'');
 if(!m){el.textContent=v||'';return;}
 el.append(span('hd',m[1]),document.createTextNode(m[2]),span('ht',m[3]));
}
/* widow guard: the last two words stay together; kept names never break */
const GUARD='.a,.fd,.std,.wd,.ws,.tip [data-copy],.src,.gift-line [data-copy],.gb-tx,.pdesc,.notes [data-copy],.ad,.ab-title,.ab-lead [data-copy],.dr-quote,.way-addr > [data-copy],.hrs-note';
/* kept together: names, the phone number, one set-up ('고우리 2실린지 + 리쥬란 4cc') and words joined by a middle dot ('세안·화장·운동은') */
/* 2026-11-14 language version also keeps the international phone number and the floor / house numbers of the address ('6楼', '66號') whole; no Korean copy has them */
/* 2026-11-14 CN (11/17 TW / HK: 麗珠蘭, 'Re2O 1vial', 麗朵皮膚科, a short name in 「」 such as the TW LINE link '「🌸麗朵皮膚科🌸」', the brand 'Beauty Blossom'; 11/17 TH: Thai loan words the browser's Thai dictionary splits
   ('คอ|ล|ลา|เจน' collagen, 'บูส|เตอร์' booster, 'ไซ|ริงค์' syringe, 'แพ็ก|เกจ' package, 'เหมาะ|สม', 'ผู้|อำนวย|การ') the director's name 'นพ. อี กอนโฮ', 'ผิวตามวัย' ('วัย' alone took the last line of the card 2 A sub) and a Thai
   volume with its space ('10 cc'; 'cc' alone took the second line of a card 2 B option); no other language has Thai letters or a spaced 'cc'): one set-up ('GOURI 1支 + 丽珠兰2cc' / 'GOURI 1支＋Re2O 1瓶', the Korean '고우리 1실린지 + 리쥬란 2cc' rule; 11/16 the reviewer's spacing) and the clinic name '丽朵皮肤科' never break inside */
const KEEP=/(\+?82[ -]\d{1,2}[ -]\d{3,4}-\d{4}|\d+[樓楼層层階號号]|GOURI \d支 ?[＋+] ?(?:丽珠兰|麗珠蘭|RE2O|Re2O) ?\d+(?:cc|瓶|vial)|丽朵皮肤科|麗朵皮膚科|「[^」\s]{1,12}」|Beauty Blossom|คอลลาเจน|สกินบูสเตอร์|บูสเตอร์|ไซริงค์|ไซริงจ์|แพ็กเกจ|เหมาะสม|ผู้อำนวยการ|นพ\. อี กอนโฮ|ผิวตามวัย|\d+ cc|BEAUTY::BLOSSOM|02-336-7511|'뷰티블라썸의원'|VAT 10%|재생크림 증정|PCL \(폴리카프로락톤\)|DEXLEVO|고우리 \d실린지 \+ 리(?:쥬란|투오) \d+(?:cc|vial)|[가-힣A-Za-z0-9]+(?:·[가-힣A-Za-z0-9]+)+)/g;
function appendKept(el,s){
 let last=0;
 for(const m of s.matchAll(KEEP)){
  if(m.index>last)el.append(document.createTextNode(s.slice(last,m.index)));
  let e=m.index+m[0].length;while(e<s.length&&/[，。、：；！？）」』]/.test(s[e]))e++; /* 2026-11-14: Chinese punctuation right after a kept name stays with it (it may not start a line); Korean copy has none */
  el.append(span('nw',s.slice(m.index,e)));last=e;
 }
 if(last<s.length)el.append(document.createTextNode(s.slice(last)));
}
/* 2026-11-14 Chinese (same as cerf12.js / sofwave12.js / thermage12.js): the last three characters stay together, grown back to the start of their word
   (a '・' break or Intl.Segmenter) so a short line never splits a word; at most 5 characters (punctuation aside) */
function cjkCut(v,cut){const core=(i)=>v.slice(i).replace(/[。！？，、）)]+$/u,'').length;
 const sep=Math.max(v.lastIndexOf('・'),v.lastIndexOf('·'));if(sep>0&&sep+1<cut&&core(sep+1)<=5)return sep+1;
 let seg=SEGS[locale];if(seg===undefined){try{seg=SEGS[locale]=new Intl.Segmenter(LANG[locale],{granularity:'word'});}catch(e){seg=SEGS[locale]=null;}}if(!seg)return cut;
 let start=0,end=v.length;for(const g of seg.segment(v)){if(g.index>cut){end=g.index;break;}start=g.index;}
 if(start===cut)return cut;if(start>0&&core(start)<=5)return start;return end<v.length?end:-1;}
/* flex / grid boxes turn every text piece into its own item (gaps, trimmed spaces), so they keep their text whole */
const guardable=(el)=>!/flex|grid/.test(getComputedStyle(el).display);
function setText(el,v){
 if(el.classList.contains('money')){setMoney(el,v);return;}
 if(el.classList.contains('split')){setSplit(el,v);return;}
 if(el.matches('.hrs [data-copy]')){setHours(el,v);return;}
 KEEP.lastIndex=0;
 /* Chinese: every text keeps its last word together (the Korean list GUARD stays as it was) */
 const cjkG=!!v&&!!CJK[locale]&&guardable(el);
 if(v&&!el.matches(GUARD)&&!cjkG&&KEEP.test(v)){KEEP.lastIndex=0;el.textContent='';appendKept(el,v);return;}
 KEEP.lastIndex=0;
 if(!v||(!el.matches(GUARD)&&!cjkG)){el.textContent=v;return;}
 let m=null;
 /* 2026-11-17 TH (THM12 / DEN12 rule): Thai has no last-words guard, its lines break at the browser's dictionary breaks (a space ends a phrase, not a word) */
 if(!CJK[locale]&&locale!=='TH')m=el.matches('.ab-title')?v.match(/(\S+[ \t]+\S{1,3})$/):v.match(/(\S+[ \t]+\S+)$/);
 else{m=v.match(/([^\s]{3}[。！？，、）)]*)$/u);if(m&&m[1].length<v.length){const c=cjkCut(v,v.length-m[1].length);m=c>0?[null,v.slice(c)]:null;}}
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
 for(const el of document.querySelectorAll('.tag,.title'))fitTo(el,el.clientWidth,.6);
 /* 2026-11-14: Chinese titles may shrink a little further (the kakao 2 B one-line title is wider than the Korean); Korean keeps .72. 2026-11-17 TH the same
    (the card 2 B title 'โปรโมชัน GOURI กระตุ้นคอลลาเจน' is 1057 px against 720 on kakao) */
 for(const el of document.querySelectorAll('.ptitle,.q,.ft,.opt')){if(phone){el.style.removeProperty('--fit');continue;}fitTo(el,el.clientWidth,CJK[locale]||locale==='TH'?.56:.72);}
 for(const el of document.querySelectorAll('.ab-title,.ab-strengths .at')){if(phone){el.style.removeProperty('--fit');continue;}fitLines(el,2,.74);}
 for(const el of document.querySelectorAll('.seal .sl'))fitTo(el,el.parentElement.clientWidth,.55);
}

function render(){
 root.lang=LANG[locale]||'ko';root.dataset.locale=locale;setFonts();
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
 const CH=(DATA.channels&&DATA.channels[locale])||null; /* per-locale consultation channels (v4/_shared/channels/CHANNELS.json) */
 for(const a of document.querySelectorAll('a[data-link]')){
  const n=a.dataset.link;const href=CH&&(n in CH)?CH[n]:(DATA.links&&DATA.links[n]);if(href)a.href=href;else a.removeAttribute('href');
  if(n!=='phone'){a.target='_blank';a.rel='noopener noreferrer';}
 }
 for(const img of document.querySelectorAll('img[data-qr]')){const q=CH&&CH.qr;if(q&&img.getAttribute('src')!==q)img.setAttribute('src',q);}
 const GM=(DATA.gmap&&DATA.gmap[locale])||null; /* card-5 Google map: this locale's capture for every width tier (the picture sources pick the tier) */
 for(const el of document.querySelectorAll('[data-gmap]')){const u=GM&&GM[el.dataset.gmap];if(!u)continue;const a=el.tagName==='SOURCE'?'srcset':'src';if(el.getAttribute(a)!==u)el.setAttribute(a,u);}
 for(const w of document.querySelectorAll('[data-bk-alt]')){const lab=w.querySelector('[data-copy]');w.hidden=!String((lab&&fields[lab.dataset.copy])??'').trim()&&!(editable&&editMode);}
 /* 2026-11-14 language version (same as cerf12.js / thermage12.js): the booking box phone line may hold a chat ID instead of a number; then the chat icon and the
    booking link replace the phone icon and tel: (Korean and the CN copy keep their phone numbers, so nothing changes today) */
 for(const p of document.querySelectorAll('.bk-phone')){const sp=p.querySelector('[data-copy]'),v=String((sp&&fields[sp.dataset.copy])??'').trim(),id=!!v&&!/^\+?\d[\d\s\-().]*$/.test(v);p.classList.toggle('is-id',id);
  const img=p.querySelector('img.ph-ico'),pic=id?'assets/icons/consult.webp':'assets/icons/phone.webp';if(img&&img.getAttribute('src')!==pic)img.setAttribute('src',pic);
  const a=p.querySelector('a[data-link]');if(!a)continue;if(id){const b=(CH&&CH.booking)||(DATA.links&&DATA.links.booking);if(b)a.href=b;a.target='_blank';a.rel='noopener noreferrer';}else{a.removeAttribute('target');a.removeAttribute('rel');}}
 /* 2026-11-14 language version (same as cerf12.js / thermage12.js): a contact line (hero, card 2 foot) that names a chat channel (CN 官方微信) shows the consult
    icon instead of the phone; Korean and phone-number lines keep the phone icon */
 for(const p of document.querySelectorAll('.c1-contact,.foot-contact')){const sp=p.querySelector('[data-copy]'),v=String((sp&&fields[sp.dataset.copy])??''),chat=locale!=='KO'&&/微信|WeChat|WhatsApp|LINE/i.test(v);
  const img=p.querySelector('img.ph-ico'),pic=chat?'assets/icons/consult.webp':'assets/icons/phone.webp';if(img&&img.getAttribute('src')!==pic)img.setAttribute('src',pic);}
 document.title=[fields.gr_h_title||'고우리 오픈이벤트',fields.gr_brand||'BEAUTY BLOSSOM'].join(' \u00b7 ');
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
window.__GOU12__={get locale(){return locale;},get editable(){return editable;},get editMode(){return editMode;},get inline(){return !!IE;},keys:KEYS};
reply(IE?{type:'aptos-ready',inline:true}:{type:'aptos-ready'});
})();
