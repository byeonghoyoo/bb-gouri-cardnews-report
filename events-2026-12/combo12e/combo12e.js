/* CMB12E 통합이벤트 ③ 바디 슬리밍 & 보톡스 · 겨울 시즌 renderer + review-board protocol (aptos-* messages, same as the other V4 pages).
   Every visible word comes from copy-data.js (titles, product heads, options and prices from v4/events/_data/pages.json via
   v4/combo12e/build-combo12e.cjs) and is edited in place through ../inline-edit.js. Display-only helpers below never change the stored text.
   2026-11-18 / 11-20: plus the TH, JP, CN and TW language pieces written by v4/combo12e/i18n-1118.cjs from v4/combo12e/i18n/renderer-ko.js; do not edit by hand. */
(()=>{'use strict';
const DATA=window.PAGE_COPY;
if(!DATA||!DATA.locales||!DATA.locales.KO){document.documentElement.dataset.reviewError='copy-data missing';return;}
const KEYS=Object.keys(DATA.locales.KO);
/* 2026-11-18 language version TH (v4/combo12e/i18n-1118.cjs; copy v4/langverify/out/CMB12E.final.json via v4/combo12e/work/i18n-prep.cjs): <html lang>
   drives the Thai font and layout rules in combo12e-i18n.css (:lang(th)); the Google font of the language is added here (as CMB12I / CMB12H / CMB12D).
   Korean renders exactly as before. */
const LANG={KO:'ko',EN:'en',JP:'ja',CN:'zh-CN',TW:'zh-TW',TH:'th',HK:'zh-HK'};
const FONT_FAMILY={JP:'Noto Sans JP',CN:'Noto Sans SC',TW:'Noto Sans TC',TH:'Noto Sans Thai',HK:'Noto Sans TC'};
/* 2026-11-20 JP / CN / TW: the Chinese pieces below act only for a CJK locale (as CMB12I / CMB12H / CMB12A) */
/* 2026-11-20 HK takes the same Chinese pieces (as CMB12I / CMB12C HK) */
const CJK={JP:1,CN:1,TW:1,HK:1},SEGS={};
const qs=new URLSearchParams(location.search);
let locale=String(qs.get('lang')||'KO').toUpperCase();if(!DATA.locales[locale])locale='KO';
let fields={...DATA.locales[locale]};
let editable=false,editMode=false,lastHeight=0;
const root=document.documentElement;
/* ?capture=1 (board image download): no animation, fixed layout */
if(qs.get('capture')==='1')root.classList.add('is-capture');

function setFonts(){let l=document.getElementById('locale-fonts');const family=FONT_FAMILY[locale];if(!family){if(l)l.remove();return;}if(!l){l=document.createElement('link');l.id='locale-fonts';l.rel='stylesheet';document.head.append(l);l.addEventListener('load',()=>document.fonts.ready.then(()=>{fit();report();}));}const href='https://fonts.googleapis.com/css2?family='+family.replace(/ /g,'+')+':wght@400;500;600;700;800;900&display=swap';if(l.getAttribute('href')!==href)l.setAttribute('href',href);}
function reply(message){if(parent!==window)parent.postMessage(message,location.origin);}
const IE=window.BBInlineEdit?window.BBInlineEdit.create({doc:document,raw:k=>fields[k]??'',send:m=>reply(m),refit:()=>{fit();report();},rerender:()=>render()}):null;

function report(){
 const main=document.querySelector('main');if(!main)return;
 const h=Math.max(300,Math.min(25000,Math.ceil(main.getBoundingClientRect().height)));
 if(h===lastHeight)return;lastHeight=h;reply({type:'aptos-size',height:h});
}

/* money: the number large, the unit small ('8만9천원' -> '8' + '만' ... keeps the text identical) */
function setMoney(el,v){
 el.textContent='';
 const m=/^(\D*?)(\d[\d,.]*)(.*)$/.exec(v||'');
 if(!m){el.textContent=v||'';return;}
 if(m[1]){const p=document.createElement('span');p.className='u pre';p.textContent=m[1];el.append(p);}
 const n=document.createElement('span');n.className='n';n.textContent=m[2];el.append(n);
 if(m[3]){
  /* '만9천원': '만' small, '9' number, '천원' small */
  const rest=/^(만)(\d+)(천원)$/.exec(m[3]);
  if(rest){const a=document.createElement('span');a.className='u';a.textContent=rest[1];const b=document.createElement('span');b.className='n';b.textContent=rest[2];const c=document.createElement('span');c.className='u';c.textContent=rest[3];el.append(a,b,c);}
  else{const s=document.createElement('span');s.className='u';s.textContent=m[3];el.append(s);}
 }
}
/* option text with ' + ': each part stays on one line, the plus is coloured (text unchanged) */
function setPlus(el,v){
 el.textContent='';v=v||'';
 const sep=(CJK[locale]&&!/ \+ /.test(v)&&/＋/.test(v))?'＋':' + ';
 v.split(sep).forEach((p,i)=>{
  if(i){const s=document.createElement('span');s.className='plus';s.textContent=sep;el.append(s);}
  const c=document.createElement('span');c.className='seg';if(locale==='TH'||CJK[locale])appendKept(c,p);else c.textContent=p;el.append(c); /* 2026-11-18 TH, 2026-11-20 JP / CN / TW: an option part keeps its kept words whole (Thai loanwords; ボトックス, Beauty Fit ...) */
 });
}
/* card 5 hours: the day label and the time are styled apart */
function setHours(el,v){
 el.textContent='';
 const m=/^(.*\S)(\s+)(\d{1,2}:\d{2}(?:\s?[AP]M)?\s*[\u2013\u2014~-]\s*\d{1,2}:\d{2}.*)$/.exec(v||'');
 if(!m){el.textContent=v||'';return;}
 const d=document.createElement('span');d.className='hd';d.textContent=m[1];
 const t=document.createElement('span');t.className='ht';t.textContent=m[3];
 el.append(d,document.createTextNode(m[2]),t);
}
/* widow guard: the last two words stay together */
const GUARD='.hook,.p-lead,.q-ans,.kd-d,.kd-n,.pick-d,.st-d,.inf-n,.care-l [data-copy],.alert,.src,.notes [data-copy],.at,.ad,.ab-title,.ab-lead [data-copy],.dr-quote,.way-addr > [data-copy],.hrs-note,.bk-links [data-copy],.q-wrap';
/* names that never break inside */
const KEEP=/(BEAUTY::BLOSSOM|02-336-7511|'뷰티블라썸의원'|VAT 10%|뷰티핏\/블라썸핏 주사|바디 조각주사|승모근 200U|목빗근|승모근·종아리·허벅지·팔뚝|U 숫자끼리|2~3일|1주일|붓기·뻐근함|격한 운동·사우나·음주|음주·사우나|무거운 짐|하이힐|복용 중인 약|이전 시술 반응|피하지방|얼굴 아래쪽|단위 기준)/g;
/* 2026-11-18 TH (as CMB12I / CMB12H / CMB12D TH): Thai loanwords the browser's Thai dictionary does not know break between their syllables
   ('โบ|ท็|อกซ์'), and so do a few compounds; they stay whole, and so do a number and its unit and an exit / line / floor / house number
   (v4/combo12e/i18n-1118.cjs TH_KEEP). Only the Thai copy is set with this list (KEEP_TH = the Thai names + KEEP); Korean uses KEEP as before */
const KEEP_TH=new RegExp('\\+?82[ -]\\d{1,2}[ -]\\d{3,4}-\\d{4}|@[\\w.\\-]+|Medione Medical Center|Beauty Blossom Clinic|Body Contouring|Nefertiti Lift|Beauty Blossom|Blossom Fit|Beauty Fit|Yanghwa-ro|Mapo-gu|'+KEEP.source+'|โบทูลินัมท็อกซิน|สกินโบท็อกซ์|โบท็อกซ์|โปรแกรม|ทรีตเมนต์|แพ็กเกจ|ซาวน่า|แอลกอฮอล์|ค่อย ๆ|ต้นแขน|ต้นขา|กล้ามเนื้อ|ไขมันสะสม|ไขมัน|สลายไขมัน|ปรับสัดส่วน|ประคบเย็น|รองเท้าส้นสูง|รอยช้ำ|ปวดเมื่อย|ใต้ผิวหนัง|ผู้อำนวยการ|รูปร่าง|ส่วนเกิน|เหมาะสม|ขั้นตอน|สุดสัปดาห์|จองคิว|หลังฉีด|ก่อนฉีด|การฉีด|รอยแดง|แตกต่าง|เครื่องมือ|กรุงโซล|เลเซอร์|ตัวเลือก|ตรงจุด|แนวเส้น|หลีกเลี่ยง|เพียงพอ|วันธรรมดา|กลางวัน|ข้อกำหนด|ทางการแพทย์|ขนาดเล็ก|นพ\\. อี กอนโฮ|อี กอนโฮ|\\d[\\d,.:–]*\\s?(?:cc|ครั้ง|นาที|วอน|ยูนิต|สัปดาห์|วัน|บริเวณ|เท่า|น\\.)|(?:ทางออก|เลขที่)\\s\\d+|(?:สาย|ชั้น)\\s\\d+(?:\\sและ\\s\\d+)?','g');
/* 2026-11-20 JP / CN / TW (as CMB12I / CMB12H / CMB12A): their names kept whole (KEEP_L = the names of v4/combo12e/i18n-1118.cjs LANG_KEEP_L + KEEP) */
const KEEP_L=new RegExp('\\+?82[ -]\\d{1,2}[ -]\\d{3,4}-\\d{4}|@[\\w.\\-]+|\\d+[樓楼階號号]|「[^」\\n]{1,16}」|MediOne Medical Center|Medione Medical Center|Beauty Blossom|Beauty Fit|Blossom Fit|QR Code|官方微信|护理|ボディ|スリミング|ボトックス|'+KEEP.source,'g');
/* 2026-11-20 HK: the HK words of v4/combo12e/i18n-1118.cjs LANG_KEEP_HK, then the KEEP_L names (HK only) */
const KEEP_HK=new RegExp('纖體塑形|肉毒療程|塑形注射|Blossom Fit 注射|Beauty Fit／|'+KEEP_L.source,'g');
/* 2026-11-23 EN: the EN names of v4/combo12e/i18n-1118.cjs LANG_KEEP_EN, then the KEEP_L names (EN only) */
const KEEP_EN=new RegExp('Body Beauty Fit|Lee Geon-ho|'+KEEP_L.source,'g');
const keepRe=()=>locale==='TH'?KEEP_TH:locale==='KO'?KEEP:locale==='HK'?KEEP_HK:locale==='EN'?KEEP_EN:KEEP_L;
/* 2026-11-20 JP / CN / TW (same as CMB12I / CMB12A / CMB12H TW): the last three characters of a Chinese text stay together, grown back to the start of
   their word (a '・' break or Intl.Segmenter) so a short line never splits a word; at most 5 characters (punctuation aside); a '・' inside those last
   characters is a break too when two to five characters follow it */
function cjkCut(v,cut){const core=(i)=>v.slice(i).replace(/[。！？，、）)]+$/u,'').length;
 const sep=Math.max(v.lastIndexOf('・'),v.lastIndexOf('·'));if(sep>0&&sep+1<v.length&&core(sep+1)>=2&&core(sep+1)<=5)return sep+1;
 let seg=SEGS[locale];if(seg===undefined){try{seg=SEGS[locale]=new Intl.Segmenter(LANG[locale],{granularity:'word'});}catch(e){seg=SEGS[locale]=null;}}if(!seg)return cut;
 let start=0,end=v.length;for(const g of seg.segment(v)){if(g.index>cut){end=g.index;break;}start=g.index;}
 if(start===cut)return cut;if(start>0&&core(start)<=5)return start;return end<v.length?end:-1;}
/* flex / grid boxes turn every text piece into its own item (gaps, trimmed spaces), so they keep their text whole */
const guardable=(el)=>!/flex|grid/.test(getComputedStyle(el).display);
/* the Chinese guard only for text with Chinese / Japanese characters; a Latin-only text is set as on the Korean page */
const HAN=/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/;
function appendKept(el,s){
 let last=0;const R=keepRe();R.lastIndex=0;
 for(const m of s.matchAll(R)){
  if(m.index>last)el.append(document.createTextNode(s.slice(last,m.index)));
  let e=m.index+m[0].length;if(CJK[locale])while(e<s.length&&/[，。、：；！？）」』]/.test(s[e]))e++;const k=document.createElement('span');k.className='nw';k.textContent=s.slice(m.index,e);el.append(k);last=e;
 }
 if(last<s.length)el.append(document.createTextNode(s.slice(last)));
}
function setText(el,v){
 if(el.classList.contains('money')){setMoney(el,v);return;}
 if(el.classList.contains('pplus')){setPlus(el,v);return;}
 if(el.matches('.hrs [data-copy]')){setHours(el,v);return;}
 KEEP.lastIndex=0;
 const KR=keepRe();KR.lastIndex=0;const kept=!!v&&KR.test(v);KR.lastIndex=0;
 /* 2026-11-18 TH: no Korean widow guard (Thai breaks by its dictionary; its words stay whole through KEEP_TH, as CMB12I / CMB12H / CMB12D TH).
    2026-11-20 JP / CN / TW: every Chinese / Japanese text in an inline box keeps its last word together (cjkCut, as CMB12I) */
 if(!v||locale==='TH'||(!el.matches(GUARD)&&!(CJK[locale]&&HAN.test(v)&&guardable(el)))){if(kept){el.textContent='';appendKept(el,v);}else el.textContent=v;return;}
 let m=null;
 if(!CJK[locale])m=el.matches('.ab-title')?v.match(/(\S+[ \t]+\S{1,3})$/):v.match(/(\S+[ \t]+\S+)$/);
 /* 2026-11-20 JP / CN / TW: the Chinese guard only in boxes whose text flows inline (in a flex / grid box the kept tail would become its own item) */
 else if(HAN.test(v)&&guardable(el)){m=v.match(/([^\s]{3}[。！？，、）)]*)$/u);if(m&&m[1].length<v.length){const c=cjkCut(v,v.length-m[1].length);m=c>0?[null,v.slice(c)]:null;}}
 if(!m&&/\d{2,3}-\d{3,4}-\d{4}$/.test(v))m=v.match(/(\S*\d{2,3}-\d{3,4}-\d{4})$/);
 if(m){let cut=v.length-m[1].length;for(const k of v.matchAll(KR))if(cut>k.index&&cut<k.index+k[0].length)cut=k.index;m=cut>0?[null,v.slice(cut)]:null;}
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
function fit(){
 const phone=isPhone();
 for(const el of document.querySelectorAll('.h-ko')){fitTo(el,el.parentElement.clientWidth,.6);}
 for(const el of document.querySelectorAll('.pt-main')){if(phone){el.style.removeProperty('--fit');continue;}fitTo(el,el.closest('.p-title').clientWidth,.6);}
 for(const el of document.querySelectorAll('.prod-h')){if(phone){el.style.removeProperty('--fit');continue;}fitTo(el,el.clientWidth,.7);}
 for(const el of document.querySelectorAll('.q-title:not(.q-wrap)')){if(phone){el.style.removeProperty('--fit');continue;}fitTo(el,el.clientWidth,.7);}
 for(const el of document.querySelectorAll('.q-wrap')){if(phone){el.style.removeProperty('--fit');continue;}fitLines(el,2,.74);}
 for(const el of document.querySelectorAll('.hb-name')){fitLines(el,2,.7);}
 for(const el of document.querySelectorAll('.ab-title,.ab-strengths .at')){if(phone){el.style.removeProperty('--fit');continue;}fitLines(el,2,.74);}
 for(const el of document.querySelectorAll('.seal .sl')){const p=el.parentElement,cs=getComputedStyle(p);fitTo(el,p.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight),.55);}
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
 const CH=(DATA.channels&&DATA.channels[locale])||null;
 for(const a of document.querySelectorAll('a[data-link]')){
  const n=a.dataset.link;const href=CH&&(n in CH)?CH[n]:(DATA.links&&DATA.links[n]);if(href)a.href=href;else a.removeAttribute('href');
  if(n!=='phone'){a.target='_blank';a.rel='noopener noreferrer';}
 }
 for(const img of document.querySelectorAll('img[data-qr]')){const q=CH&&CH.qr;if(q&&img.getAttribute('src')!==q)img.setAttribute('src',q);}
 /* 2026-11-20 TW (LIG12 / ONE12 / CMB12A / CMB12H / CMB12I TW rule): the booking-box phone line (c5_ab_phone) may hold the country's chat ID (TW LINE ID
    '@beautyblossom_tw') instead of a number; then the chat icon and the booking link replace the phone icon and tel:. A line that repeats the second link
    line word for word is hidden outside the edit mode. Korean, JP, CN and TH hold the number: nothing changes there */
 const isId=(v)=>!!v&&!/^\+?\d[\d\s\-().]*$/.test(v);
 for(const p of document.querySelectorAll('.bk-phone')){const sp=p.querySelector('[data-copy]'),v=String((sp&&fields[sp.dataset.copy])??'').trim(),id=isId(v);p.classList.toggle('is-id',id);
  const img=p.querySelector('img.ico');if(img){if(id&&!img.dataset.src0)img.dataset.src0=img.getAttribute('src');const pic=id?'assets/icons/consult.webp':(img.dataset.src0||img.getAttribute('src'));if(img.getAttribute('src')!==pic)img.setAttribute('src',pic);}
  const a=p.querySelector('a[data-link]');if(a){if(id){const b=(CH&&CH.booking)||(DATA.links&&DATA.links.booking);if(b)a.href=b;a.target='_blank';a.rel='noopener noreferrer';}else{a.removeAttribute('target');a.removeAttribute('rel');}}
  const box=p.closest('.bk-text'),alt=box&&box.querySelector('.bk-alt [data-copy]'),av=String((alt&&fields[alt.dataset.copy])??'').trim();
  p.hidden=locale!=='KO'&&id&&!!av&&av===v&&!(editable&&editMode);}
 /* 2026-11-18 language version (CRF12 / THM12 / ONE12 / CMB12A / CMB12B / CMB12D / CMB12H / CMB12I rule): a hero contact line that names a chat channel
    (TH 'Line: @beautyblossom_th') shows the consult icon instead of the phone; Korean and phone-number lines keep the phone icon */
 for(const p of document.querySelectorAll('.band-contact')){const sp=p.querySelector('[data-copy]'),v=String((sp&&fields[sp.dataset.copy])??''),chat=locale!=='KO'&&/微信|WeChat|WhatsApp|LINE/i.test(v);
  const img=p.querySelector('img.ico');if(!img)continue;if(chat&&!img.dataset.src0)img.dataset.src0=img.getAttribute('src');const pic=chat?'assets/icons/consult.webp':(img.dataset.src0||img.getAttribute('src'));if(img.getAttribute('src')!==pic)img.setAttribute('src',pic);}
 const GM=(DATA.gmap&&DATA.gmap[locale])||null;
 for(const el of document.querySelectorAll('[data-gmap]')){const u=GM&&GM[el.dataset.gmap];if(!u)continue;const a=el.tagName==='SOURCE'?'srcset':'src';if(el.getAttribute(a)!==u)el.setAttribute(a,u);}
 for(const w of document.querySelectorAll('[data-bk-alt]')){const lab=w.querySelector('[data-copy]');w.hidden=!String((lab&&fields[lab.dataset.copy])??'').trim()&&!(editable&&editMode);}
 document.title=[fields.c5_title||'바디 슬리밍',fields.c5_brand||'BEAUTY BLOSSOM'].join(' \u00b7 ');
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
window.__C5__={get locale(){return locale;},get editable(){return editable;},get editMode(){return editMode;},get inline(){return !!IE;},keys:KEYS};
reply(IE?{type:'aptos-ready',inline:true}:{type:'aptos-ready'});
})();
