/* ONE12 원데이 마스터 솔루션 · 겨울 시즌 (2026-11-04 rework) renderer + review-board protocol (aptos-* messages, same as the other V4 pages).
   Every visible word comes from copy-data.js (titles, group / product names, options, chips, parts lists and prices from v4/events/_data/pages.json via
   v4/oneday12/build-oneday12.cjs) and is edited in place through ../inline-edit.js. Display-only helpers below never change the stored text. */
(()=>{'use strict';
const DATA=window.PAGE_COPY;
if(!DATA||!DATA.locales||!DATA.locales.KO){document.documentElement.dataset.reviewError='copy-data missing';return;}
const KEYS=Object.keys(DATA.locales.KO);
/* 2026-11-17 language versions (TW first; copy from v4/langverify/out/ONE12.final.json via v4/oneday12/work/i18n-prep.cjs): <html lang> drives the
   language fonts and layout rules in oneday12-i18n.css (:lang()); the Google font of the language is added here (same as ligament12.js / sofwave12.js).
   Korean renders exactly as before. */
const LANG={KO:'ko',EN:'en',JP:'ja',CN:'zh-CN',TW:'zh-TW',TH:'th',HK:'zh-HK'};
const FONT_FAMILY={JP:'Noto Sans JP',CN:'Noto Sans SC',TW:'Noto Sans TC',HK:'Noto Sans TC',TH:'Noto Sans Thai'};
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

/* money: the number large, the unit small */
function setMoney(el,v){
 el.textContent='';
 const m=/^(\D*?)(\d[\d,.]*)(.*)$/.exec(v||'');
 if(!m){el.textContent=v||'';return;}
 if(m[1]){const p=document.createElement('span');p.className='u pre';p.textContent=m[1];el.append(p);}
 const n=document.createElement('span');n.className='n';n.textContent=m[2];el.append(n);
 if(m[3]){const s=document.createElement('span');s.className='u';s.textContent=m[3];el.append(s);}
}
/* split at ' + ' outside brackets (the text stays the same: the ' + ' separators remain as text)
   2026-11-17 language versions (as ligament12.js / sofwave12.js TW): the TW copy joins the parts with a full-width '＋' and no spaces and uses
   full-width brackets ('索夫波200發＋核心支柱拉提（玻尿酸4cc＋舒顏萃1瓶）＋…'); it splits before every '＋' outside brackets too and the '＋' stays as the separator
   text (Korean copy has neither, so it is set exactly as before) */
function topSplit(v){
 const parts=[],seps=[];let depth=0,start=0;
 for(let i=0;i<v.length;i++){
  const c=v[i];if(c==='('||c==='['||c==='（'||c==='［')depth++;else if((c===')'||c===']'||c==='）'||c==='］')&&depth)depth--;
  else if(!depth&&v.startsWith(' + ',i)){parts.push(v.slice(start,i));seps.push(' + ');start=i+3;i+=2;}
  else if(!depth&&c==='＋'){parts.push(v.slice(start,i));seps.push('＋');start=i+1;}
 }
 parts.push(v.slice(start));return {parts,seps};
}
/* parts lists: one chip per part; option / sub lines: each part stays on one line (breaks only at ' + ') */
function setParts(el,v,chip){
 el.textContent='';v=v||'';
 const {parts,seps}=topSplit(v);
 parts.forEach((p,i)=>{
  if(i){const s=document.createElement('span');s.className='plus';s.textContent=seps[i-1];el.append(s);}
  const c=document.createElement('span');c.className=chip?'chip':'seg';if(locale==='TH')appendKept(c,p);else c.textContent=p;el.append(c); /* 2026-11-17 TH: its loanwords and number + unit stay whole inside a part (KEEP_TH) */
 });
}
/* card 6 hours: the day label and the time are styled apart */
function setHours(el,v){
 el.textContent='';
 const m=/^(.*\S)(\s+)(\d{1,2}:\d{2}\s*[\u2013\u2014~-]\s*\d{1,2}:\d{2}.*)$/.exec(v||'');
 if(!m){el.textContent=v||'';return;}
 const d=document.createElement('span');d.className='hd';d.textContent=m[1];
 const t=document.createElement('span');t.className='ht';t.textContent=m[3];
 el.append(d,document.createTextNode(m[2]),t);
}
/* widow guard: the last two words stay together */
const GUARD='.hook,.p-lead,.q-ans,.tier-d,.dv-t,.st-d,.inf-n,.ask-d,.care [data-copy],.src,.notes [data-copy],.at,.ad,.ab-title,.ab-lead [data-copy],.dr-quote,.way-addr > [data-copy],.hrs-note,.bk-links [data-copy],.pnote,.prod-s,.tier-n,.lay-t,.tz-label';
/* names that never break inside
   2026-11-17 language versions also keep the international phone number, a chat ID ('@beautyblossom_tw'), the floor / house numbers of the address
   ('6樓', '66號'), a name in corner brackets (the TW LINE account '「🌸麗朵皮膚科🌸」') the Latin 'One Day' / 'Beauty Blossom' and the TW title '一日全方位療程' of the TW copy whole (a two-line title breaks after 'One Day');
   no Korean copy has them */
const KEEP=/(\+?82[ -]\d{1,2}[ -]\d{3,4}-\d{4}|@[\w.\-]+|\d+[樓楼階號号]|「[^」\n]{1,16}」|一日全方位療程|One Day|Beauty Blossom|BEAUTY::BLOSSOM|02-336-7511|'뷰티블라썸의원'|VAT 10%|마스터 솔루션|울쎄라피 프라임|써마지 FLX|1\.5·3\.0·4\.5mm|근막\(SMAS\)층까지|3D 피부 진단기|진피 1\.5mm|두 주파수|세 단계|세 장비|두 장비|하루 일정|Plan A·B|Plan A|Plan B|목·어깨 라인|3중 레이어 리프팅|리프팅 솔루션|베이직 솔루션|연고 마취|마취 없이|붉어짐·붓기·멍|몸속 전자기기|금속·보형물|임신·수유|복용 중인 약|음주·사우나·과한 운동|자외선 차단제)/g;
/* 2026-11-17 TH: Thai loanwords the browser's Thai dictionary does not know break between their syllables ('ฟิล|เลอร์', 'โบ|ท็อกซ์'), and so do
   'ไขมัน', 'เหมาะสม', the director's name and the compounds 'หลอดเลือดดำ', 'ยาชา', 'ชั้นผิว' / 'ชั้นลึก' / 'ชั้นตื้น' (their last syllable alone took a last
   line); they stay whole, and so do a number and its unit ('2,200 ช็อต', '24 cc', '20:00 น.') and an exit / line / floor /
   house number ('ทางออก 3'). Only the Thai copy is set with this list (KEEP_TH = KEEP + these); Korean and TW use KEEP as before */
const KEEP_TH=new RegExp(KEEP.source+'|ฟิลเลอร์|โบท็อกซ์|แพ็กเกจ|ทรีตเมนต์|อัลตราซาวนด์|มาสก์|คิวอาร์โค้ด|ซาวน่า|หลอดเลือดดำ|ยาชา|ชั้นผิว|ชั้นลึก|ชั้นตื้น|ไขมัน|เหมาะสม|อี กอนโฮ'
 +'|\\d[\\d,.:]*\\s(?:ช็อต|พัลส์|cc|kJ|ขวด|ระดับ|ชนิด|มม\\.|แพ็กเกจ|ล้านจูล|แผ่น|น\\.)|(?:ทางออก|สาย|ชั้น|เลขที่)\\s\\d+','g');
const keepRe=()=>locale==='TH'?KEEP_TH:KEEP;
function appendKept(el,s){
 let last=0;
 for(const m of s.matchAll(keepRe())){
  if(m.index>last)el.append(document.createTextNode(s.slice(last,m.index)));
  let e=m.index+m[0].length;while(e<s.length&&/[，。、：；！？）」』]/.test(s[e]))e++; /* 2026-11-17: Chinese punctuation right after a kept name stays with it (it may not start a line); Korean copy has none */
  const k=document.createElement('span');k.className='nw';k.textContent=s.slice(m.index,e);el.append(k);last=e;
 }
 if(last<s.length)el.append(document.createTextNode(s.slice(last)));
}
/* 2026-11-17 Chinese (same as ligament12.js / sofwave12.js): the last three characters stay together, grown back to the start of their word (a '・'
   break or Intl.Segmenter) so a short line never splits a word; at most 5 characters (punctuation aside). Thai has no guard (dictionary breaks). */
function cjkCut(v,cut){const core=(i)=>v.slice(i).replace(/[。！？，、）)]+$/u,'').length;
 const sep=Math.max(v.lastIndexOf('・'),v.lastIndexOf('·'));if(sep>0&&sep+1<cut&&core(sep+1)<=5)return sep+1;
 let seg=SEGS[locale];if(seg===undefined){try{seg=SEGS[locale]=new Intl.Segmenter(LANG[locale],{granularity:'word'});}catch(e){seg=SEGS[locale]=null;}}if(!seg)return cut;
 let start=0,end=v.length;for(const g of seg.segment(v)){if(g.index>cut){end=g.index;break;}start=g.index;}
 if(start===cut)return cut;if(start>0&&core(start)<=5)return start;return end<v.length?end:-1;}
/* flex / grid boxes turn every text piece into its own item (gaps, trimmed spaces), so they keep their text whole */
const guardable=(el)=>!/flex|grid/.test(getComputedStyle(el).display);
function setText(el,v){
 if(el.classList.contains('money')){setMoney(el,v);return;}
 if(el.classList.contains('pparts')){setParts(el,v,true);return;}
 if(el.parentElement&&el.parentElement.classList.contains('cmb')){setParts(el,v,false);return;}
 if(el.matches('.hrs [data-copy]')){setHours(el,v);return;}
 const KR=keepRe();KR.lastIndex=0;
 const kept=!!v&&KR.test(v);KR.lastIndex=0;
 /* Chinese: every text keeps its last word together (the Korean list GUARD stays as it was) */
 if(!v||(!el.matches(GUARD)&&!(CJK[locale]&&guardable(el)))){if(kept){el.textContent='';appendKept(el,v);}else el.textContent=v;return;}
 let m=null;
 if(locale==='TH')m=null;
 else if(!CJK[locale])m=el.matches('.ab-title')?v.match(/(\S+[ \t]+\S{1,3})$/):v.match(/(\S+[ \t]+\S+)$/);
 /* Chinese guard only in boxes whose text flows inline: in a flex / grid box the kept tail would become its own item with a gap before it */
 else if(guardable(el)){m=v.match(/([^\s]{3}[。！？，、）)]*)$/u);if(m&&m[1].length<v.length){const c=cjkCut(v,v.length-m[1].length);m=c>0?[null,v.slice(c)]:null;}}
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
 for(const el of document.querySelectorAll('.d-en,.d-sub,.x-en')){if(phone){el.style.removeProperty('--fit');continue;}fitTo(el,el.parentElement.clientWidth,.7);}
 for(const el of document.querySelectorAll('.pt-main')){if(phone){el.style.removeProperty('--fit');continue;}fitTo(el,el.closest('.p-title').clientWidth*.82,.6);}
 for(const el of document.querySelectorAll('.gh-n')){if(phone){el.style.removeProperty('--fit');continue;}fitTo(el,el.clientWidth,.7);}
 for(const el of document.querySelectorAll('.q-title')){if(phone){el.style.removeProperty('--fit');continue;}fitTo(el,el.clientWidth,.7);}
 for(const el of document.querySelectorAll('.ab-title,.ab-strengths .at')){if(phone){el.style.removeProperty('--fit');continue;}fitLines(el,2,.74);}
 /* seal lines: the content box of the seal text (inside its side padding) */
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
 /* 2026-11-17 language versions (LIG12 / SOF12 / CRF12 / OND12 rule): the booking-box phone line (on_ab_phone) may hold the country's chat ID (TW LINE ID
    '@beautyblossom_tw') instead of a number; then the chat icon and the booking link replace the phone icon and tel:. A line that repeats the second
    link line word for word is hidden outside the edit mode (the same words twice). Korean always holds the number: nothing changes there. */
 const isId=(v)=>!!v&&!/^\+?\d[\d\s\-().]*$/.test(v);
 for(const p of document.querySelectorAll('.bk-phone')){const sp=p.querySelector('[data-copy]'),v=String((sp&&fields[sp.dataset.copy])??'').trim(),id=isId(v);p.classList.toggle('is-id',id);
  const img=p.querySelector('img.ico');if(img){if(id&&!img.dataset.src0)img.dataset.src0=img.getAttribute('src');const pic=id?'assets/icons/consult.webp':(img.dataset.src0||img.getAttribute('src'));if(img.getAttribute('src')!==pic)img.setAttribute('src',pic);}
  const a=p.querySelector('a[data-link]');if(a){if(id){const b=(CH&&CH.booking)||(DATA.links&&DATA.links.booking);if(b)a.href=b;a.target='_blank';a.rel='noopener noreferrer';}else{a.removeAttribute('target');a.removeAttribute('rel');}}
  const box=p.closest('.bk-text'),alt=box&&box.querySelector('.bk-alt [data-copy]'),av=String((alt&&fields[alt.dataset.copy])??'').trim();
  p.hidden=locale!=='KO'&&id&&!!av&&av===v&&!(editable&&editMode);}
 /* 2026-11-17 language versions (CRF12 / THM12 rule): a hero contact line that names a chat channel (TW 'LINE@beautyblossom_tw') shows the consult
    icon instead of the phone; Korean and phone-number lines keep the phone icon */
 for(const p of document.querySelectorAll('.c1-contact')){const sp=p.querySelector('[data-copy]'),v=String((sp&&fields[sp.dataset.copy])??''),chat=locale!=='KO'&&/微信|WeChat|WhatsApp|LINE/i.test(v);
  const img=p.querySelector('img.ico');if(!img)continue;if(chat&&!img.dataset.src0)img.dataset.src0=img.getAttribute('src');const pic=chat?'assets/icons/consult.webp':(img.dataset.src0||img.getAttribute('src'));if(img.getAttribute('src')!==pic)img.setAttribute('src',pic);}
 const GM=(DATA.gmap&&DATA.gmap[locale])||null;
 for(const el of document.querySelectorAll('[data-gmap]')){const u=GM&&GM[el.dataset.gmap];if(!u)continue;const a=el.tagName==='SOURCE'?'srcset':'src';if(el.getAttribute(a)!==u)el.setAttribute(a,u);}
 for(const w of document.querySelectorAll('[data-bk-alt]')){const lab=w.querySelector('[data-copy]');w.hidden=!String((lab&&fields[lab.dataset.copy])??'').trim()&&!(editable&&editMode);}
 document.title=[fields.on_title||'원데이 마스터 솔루션',fields.on_brand||'BEAUTY BLOSSOM'].join(' \u00b7 ');
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
window.__ON12__={get locale(){return locale;},get editable(){return editable;},get editMode(){return editMode;},get inline(){return !!IE;},keys:KEYS};
reply(IE?{type:'aptos-ready',inline:true}:{type:'aptos-ready'});
})();
