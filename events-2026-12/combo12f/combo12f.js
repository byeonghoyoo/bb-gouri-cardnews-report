/* CMB12F (bundle ④ 가성비 베스트셀러) renderer + review-board protocol (aptos-* messages, same as the other V4 pages). Generated from v4/combo12f/page-renderer.js.
   Every visible word comes from copy-data.js (titles, product heads, options and prices from v4/events/_data/pages.json via the page build script)
   and is edited in place through ../inline-edit.js. Display-only helpers below never change the stored text. */
(()=>{'use strict';
const DATA=window.PAGE_COPY;
if(!DATA||!DATA.locales||!DATA.locales.KO){document.documentElement.dataset.reviewError='copy-data missing';return;}
const P='c6_';
const KEYS=Object.keys(DATA.locales.KO);
/* 2026-11-18 language version TH, 2026-11-20 JP / CN (v4/combo12f/i18n-1120.cjs; copy v4/langverify/out/CMB12F.final.json via
   v4/combo12f/work/i18n-prep.cjs): <html lang> drives the language fonts and layout rules in combo12f-i18n.css (:lang()); the Google font of the language
   is added here (as CMB12A / CMB12B / CMB12D / CMB12G). Korean renders exactly as before. */
/* 2026-11-23 EN: 'Dr. Lee Geon-ho' added to NEW_KEEP (the EN director line broke at its hyphen, as CMB12G EN; no other language has it) */
const LANG={KO:'ko',EN:'en',JP:'ja',CN:'zh-CN',TW:'zh-TW',TH:'th',HK:'zh-HK'}; /* EN 2026-11-23 */
const FONT_FAMILY={JP:'Noto Sans JP',CN:'Noto Sans SC',TW:'Noto Sans TC',TH:'Noto Sans Thai',HK:'Noto Sans TC'};
const CJK={JP:1,CN:1,TW:1,HK:1},SEGS={}; /* HK added 2026-11-20 evening */
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
/* money: the number large, the unit small ('8만8천원' -> '8' + '만' + '8' + '천원', text unchanged) */
function setMoney(el,v){
 el.textContent='';
 const m=/^(\D*?)(\d[\d,.]*)(.*)$/.exec(v||'');
 if(!m){el.textContent=v||'';return;}
 if(m[1]){const p=document.createElement('span');p.className='u pre';p.textContent=m[1];el.append(p);}
 const n=document.createElement('span');n.className='n';n.textContent=m[2];el.append(n);
 if(m[3]){
  const rest=/^(만)(\d+)(천원)$/.exec(m[3]);
  if(rest){const a=document.createElement('span');a.className='u';a.textContent=rest[1];const b=document.createElement('span');b.className='n';b.textContent=rest[2];const c=document.createElement('span');c.className='u';c.textContent=rest[3];el.append(a,b,c);}
  else{const s=document.createElement('span');s.className='u';s.textContent=m[3];el.append(s);}
 }
}
/* option text with ' + ': each part stays on one line, the plus is coloured (text unchanged) */
/* 2026-11-20 JP / CN (as CMB12A / CMB12G): the Chinese / Japanese copy may join the parts with a full-width '＋' and no spaces; it splits before every
   '＋' outside brackets too and the '＋' stays as the separator text. Korean and TH split at ' + ' exactly as before */
function splitPlus(v){if(!CJK[locale]){const parts=v.split(' + ');return {parts,seps:parts.slice(1).map(()=>' + ')};}
 const parts=[],seps=[];let depth=0,start=0;for(let i=0;i<v.length;i++){const c=v[i];if(c==='('||c==='['||c==='（'||c==='［')depth++;else if((c===')'||c===']'||c==='）'||c==='］')&&depth)depth--;else if(!depth&&v.startsWith(' + ',i)){parts.push(v.slice(start,i));seps.push(' + ');start=i+3;i+=2;}else if(!depth&&c==='＋'){parts.push(v.slice(start,i));seps.push('＋');start=i+1;}}parts.push(v.slice(start));return {parts,seps};}
function setPlus(el,v){
 el.textContent='';v=v||'';
 const SP=splitPlus(v);SP.parts.forEach((p,i)=>{
  if(i){const s=document.createElement('span');s.className='plus';s.textContent=SP.seps[i-1];el.append(s);}
  const c=document.createElement('span');c.className='seg';if(locale==='TH'||locale==='HK'||locale==='EN')appendKept(c,p);else c.textContent=p;el.append(c); /* 2026-11-18 TH: its loanwords and number + unit stay whole inside a part (KEEP_TH); 2026-11-20 HK: its words too (KEEP_HK) */
 });
}
/* clinic hours: the day label and the time are styled apart */
function setHours(el,v){
 el.textContent='';
 const m=/^(.*\S)(\s+)(\d{1,2}:\d{2}\s*[\u2013\u2014~-]\s*\d{1,2}:\d{2}.*)$/.exec(v||'');
 if(!m){if(locale==='TH'&&v)appendKept(el,v);else el.textContent=v||'';return;} /* 2026-11-18 TH: a line without times keeps its words too */
 const d=document.createElement('span');d.className='hd';if(locale==='TH')appendKept(d,m[1]);else d.textContent=m[1]; /* 2026-11-18 TH: the keep list in the day part */
 const t=document.createElement('span');t.className='ht';t.textContent=m[3];
 el.append(d,document.createTextNode(m[2]),t);
}
/* widow guard: the last two words stay together */
const GUARD='.hook,.p-lead,.q-ans,.kd-d,.kd-n,.pick-d,.st-d,.inf-n,.care-l [data-copy],.alert,.src,.notes [data-copy],.at,.ad,.ab-title,.ab-lead [data-copy],.dr-quote,.way-addr > [data-copy],.hrs-note,.bk-links [data-copy],.q-wrap [data-copy],.gift-tx';
/* names that never break inside */
const KEEP=/(BEAUTY::BLOSSOM|02-336-7511|'뷰티블라썸의원'|VAT 10%|FX\/포마|뷰티핏\/블라썸핏|V핏 주사|사각턱 톡신|스킨 톡신|PDO 실|1~2주|24시간|5분 내외|얼굴 비율|이전 시술|복용 중인 약|음주와 사우나|얼굴 마사지|격한 운동|목주름|고민 부위)/g;
/* 2026-11-18 TH (as CMB12A / CMB12B / CMB12D / CMB12G TH): Thai loanwords the browser's Thai dictionary does not know break between their syllables ('ช็|อต',
   'โบ|ท็|อกซ์'), and so do a few compounds and the director's name; they stay whole, and so do a number and its unit, an exit / line / floor / house number
   and the Latin product names with a space (v4/combo12f/i18n-1120.cjs LANG_KEEP / TH_KEEP). Only the Thai copy is set with this list (KEEP_TH = the Thai
   names + KEEP); Korean uses KEEP as before */
const KEEP_TH=new RegExp('\\+?82[ -]\\d{1,2}[ -]\\d{3,4}-\\d{4}|@[\\w.\\-]+|Beauty Blossom Clinic|Beauty Blossom|Beauty Fit|Blossom Fit|Medione Medical Center|Yanghwa-ro|Mapo-gu|InMode FX|V-Slim Solution|V-Fit|Juvelook Volume|'+KEEP.source+'|สกินโบท็อกซ์|โบท็อกซ์|โปรแกรม|แบรนด์|หน้าผาก|ขากรรไกร|หางตา|ลำคอ|หว่างคิ้ว|ร่องแก้ม|กรอบหน้า|ริ้วรอย|แตกต่าง|เครื่องมือ|กรุงโซล|เหมาะสม|ขั้นตอน|ผู้อำนวยการ|สุดสัปดาห์|เล็ก ๆ|แรง ๆ|ค่อย ๆ|ช็อต|หย่อนคล้อย|ความมั่นใจ|ยกกระชับ|ประจำวัน|จำนวน|สุดคุ้ม|ความลึก|ความกระชับ|ความหนา|ความเย็น|ความร้อน|เป้าหมาย|เฉพาะบุคคล|ถัดไป|ทั้งสอง|วันหยุด|ฟิลเลอร์|แพ็กเกจ|ซิกเนเจอร์|วอลุ่ม|ของ Beauty Blossom|ไขมัน|รูปทรง|ลดลง|ร่วมกับ|ร่วมกัน|ออกกำลังกาย|วันเดียวกัน|ไม่พักกลางวัน|การรับบริการ|นพ\\. อี กอนโฮ|อี กอนโฮ|\\d[\\d,.:]*(?:[~–-]\\d[\\d,.:]*)?\\s(?:cc|ขวด|ครั้ง|บริเวณ|เท่า|นัด|กลุ่ม|วอน|ยูนิต|ช็อต|kJ|น\\.|เส้น|นาที|สัปดาห์|ชั่วโมง|วัน)|(?:ทางออก|สาย|ชั้น|เลขที่)\\s\\d+(?:[・·]\\d+)*','g');
/* 2026-11-20 JP / CN: the phone numbers, a chat ID, the Latin names with a space and a number with its unit stay whole (v4/combo12f/i18n-1120.cjs NEW_KEEP;
   KEEP_L = these + KEEP) */
const KEEP_L=new RegExp('\\+?82[ -]\\d{1,2}[ -]\\d{3,4}-\\d{4}|@[\\w.\\-]+|「[^」\\n]{1,16}」|Dr\\. Lee Geon-ho|Beauty Blossom|Beauty Fit|Blossom Fit|InMode FX|MediOne Medical Center|Medione Medical Center|Yanghwa-ro|Mapo-gu|Juvelook Volume|V-Slim Solution|\\d[\\d,.]*\\s?(?:cc|kJ|KJ)\\b|\\d+(?:[~〜～]\\d+)?(?:分钟|分鐘|分|本|条|條|小时|小時|時間|週間|週|周|号线|號線|号線|号出口|號出口|番出口|楼|樓|階)|'+KEEP.source,'g');
/* 2026-11-20 TW: these + a few Traditional Chinese words that broke in the middle (v4/combo12f/i18n-1120.cjs TW_KEEP); JP / CN keep KEEP_L */
const KEEP_TW=new RegExp('\\+?82[ -]\\d{1,2}[ -]\\d{3,4}-\\d{4}|@[\\w.\\-]+|「[^」\\n]{1,16}」|Dr\\. Lee Geon-ho|Beauty Blossom|Beauty Fit|Blossom Fit|InMode FX|MediOne Medical Center|Medione Medical Center|Yanghwa-ro|Mapo-gu|Juvelook Volume|V-Slim Solution|\\d[\\d,.]*\\s?(?:cc|kJ|KJ)\\b|\\d+(?:[~〜～]\\d+)?(?:分钟|分鐘|分|本|条|條|小时|小時|時間|週間|週|周|号线|號線|号線|号出口|號出口|番出口|楼|樓|階)|水光肉毒|咀嚼肌肉毒|療程|精選|合集|注射|保養|玻尿酸|'+KEEP.source,'g');
/* 2026-11-20 evening HK: the new keep list + floor numbers and the Traditional Chinese words of the HK copy (v4/combo12f/i18n-1120.cjs HK_KEEP) */
const KEEP_HK=new RegExp('\\+?82[ -]\\d{1,2}[ -]\\d{3,4}-\\d{4}|@[\\w.\\-]+|「[^」\\n]{1,16}」|Dr\\. Lee Geon-ho|Beauty Blossom|Beauty Fit|Blossom Fit|InMode FX|MediOne Medical Center|Medione Medical Center|Yanghwa-ro|Mapo-gu|Juvelook Volume|V-Slim Solution|\\d[\\d,.]*\\s?(?:cc|kJ|KJ)\\b|\\d+(?:[~〜～]\\d+)?(?:分钟|分鐘|分|本|条|條|小时|小時|時間|週間|週|周|号线|號線|号線|号出口|號出口|番出口|楼|樓|階)|\\d+(?:[・·、]\\d+)*[樓楼]|肉毒桿菌素|透明質酸|填充劑|廣東話|橙皮紋|咀嚼肌|儀器|效果|精選|緊緻|線條|倒鈎|藥物|需要|主要|皮膚|下巴|配合|療程|日語|填充|輪廓|不同|一起|注射|透過|體積|調節|補充|線材|星期|部位|其他|合集|肉毒|每一天|維持|膚質|唇部|護理|你的|嘴角|溶脂針|法令紋|溶脂|局部|位置|表面|周圍|肌肉|'+KEEP.source,'g');
/* 2026-11-23 EN: the EN words first, then the new keep list */
const KEEP_EN=new RegExp('(?:Juvelook Volume|[A-Za-z][\\w.\\-]*) \\d[\\d,.]*\\s?(?:cc|kJ|KJ)\\b|\\d+ [A-Z]{3,} threads|\\d+ minutes|\\d{1,2}:\\d{2} [AP]M|Booking QR|\\+?82[ -]\\d{1,2}[ -]\\d{3,4}-\\d{4}|@[\\w.\\-]+|「[^」\\n]{1,16}」|Dr\\. Lee Geon-ho|Beauty Blossom|Beauty Fit|Blossom Fit|InMode FX|MediOne Medical Center|Medione Medical Center|Yanghwa-ro|Mapo-gu|Juvelook Volume|V-Slim Solution|\\d[\\d,.]*\\s?(?:cc|kJ|KJ)\\b|\\d+(?:[~〜～]\\d+)?(?:分钟|分鐘|分|本|条|條|小时|小時|時間|週間|週|周|号线|號線|号線|号出口|號出口|番出口|楼|樓|階)|'+KEEP.source,'g');
const keepRe=()=>locale==='TH'?KEEP_TH:(locale==='TW'?KEEP_TW:(locale==='HK'?KEEP_HK:(locale==='EN'?KEEP_EN:(locale!=='KO'&&LANG[locale]?KEEP_L:KEEP))));
/* 2026-11-20 Chinese / Japanese (same as CMB12A / CMB12G): the last three characters stay together, grown back to the start of their word (a '・' break or
   Intl.Segmenter) so a short line never splits a word; at most 5 characters (punctuation aside). Thai has no guard (dictionary breaks) */
function cjkCut(v,cut){const core=(i)=>v.slice(i).replace(/[。！？，、）)]+$/u,'').length;
 const sep=Math.max(v.lastIndexOf('・'),v.lastIndexOf('·'));if(sep>0&&sep+1<v.length&&core(sep+1)>=2&&core(sep+1)<=5)return sep+1;
 let seg=SEGS[locale];if(seg===undefined){try{seg=SEGS[locale]=new Intl.Segmenter(LANG[locale],{granularity:'word'});}catch(e){seg=SEGS[locale]=null;}}if(!seg)return cut;
 let start=0,end=v.length;for(const g of seg.segment(v)){if(g.index>cut){end=g.index;break;}start=g.index;}
 if(start===cut)return cut;if(start>0&&core(start)<=5)return start;return end<v.length?end:-1;}
/* flex / grid boxes turn every text piece into its own item (gaps, trimmed spaces), so they keep their text whole */
const guardable=(el)=>!/flex|grid/.test(getComputedStyle(el).display);
const HAN=/[㐀-鿿豈-﫿]/;
function appendKept(el,s){
 let last=0;const R=keepRe();R.lastIndex=0;
 for(const m of s.matchAll(R)){
  if(m.index>last)el.append(document.createTextNode(s.slice(last,m.index)));
  let e=m.index+m[0].length;if(CJK[locale])while(e<s.length&&/[，。、：；！？）」』]/.test(s[e]))e++; /* 2026-11-20 CJK: Chinese / Japanese punctuation right after a kept name stays with it (it may not start a line) */
  const k=document.createElement('span');k.className='nw';k.textContent=s.slice(m.index,e);el.append(k);last=e;
 }
 if(last<s.length)el.append(document.createTextNode(s.slice(last)));
}
function setText(el,v){
 if(el.classList.contains('money')){setMoney(el,v);return;}
 if(el.classList.contains('pplus')){setPlus(el,v);return;}
 if(el.matches('.hrs [data-copy]')){setHours(el,v);return;}
 KEEP.lastIndex=0;
 const KR=keepRe();KR.lastIndex=0;const kept=!!v&&KR.test(v);KR.lastIndex=0;
 /* 2026-11-18 TH: no Korean widow guard (Thai breaks by its dictionary; its words stay whole through KEEP_TH, as CMB12A / CMB12B / CMB12D TH);
    2026-11-20 Chinese / Japanese: every text with Chinese characters in a box whose text flows inline keeps its last word together (the Korean list GUARD stays as it was) */
 if(!v||locale==='TH'||(!el.matches(GUARD)&&!(CJK[locale]&&HAN.test(v)&&guardable(el)))){if(kept){el.textContent='';appendKept(el,v);}else el.textContent=v;return;}
 let m=null;
 if(!CJK[locale])m=el.matches('.ab-title')?v.match(/(\S+[ \t]+\S{1,3})$/):v.match(/(\S+[ \t]+\S+)$/);
 else if(HAN.test(v)&&guardable(el)){m=v.match(/([^\s]{3}[。！？，、）)]*)$/u);if(m&&m[1].length<v.length){const c=cjkCut(v,v.length-m[1].length);m=c>0?[null,v.slice(c)]:null;}}
 if(!m&&/\d{2,3}-\d{3,4}-\d{4}$/.test(v))m=v.match(/(\S*\d{2,3}-\d{3,4}-\d{4})$/);
 if(m){let cut=v.length-m[1].length;KEEP.lastIndex=0;for(const k of v.matchAll(KR))if(cut>k.index&&cut<k.index+k[0].length)cut=k.index;m=cut>0?[null,v.slice(cut)]:null;}
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
 for(const el of document.querySelectorAll('.ht-a')){fitTo(el,el.parentElement.clientWidth,.55);}
 for(const el of document.querySelectorAll('.pt-main')){if(phone){el.style.removeProperty('--fit');continue;}const t=el.closest('.p-title');const others=[...t.children].filter(c=>c!==el).reduce((a,c)=>a+c.getBoundingClientRect().width,0)+parseFloat(getComputedStyle(t).columnGap||0)*(t.children.length-1);fitTo(el,t.clientWidth-others,.6);}
 for(const el of document.querySelectorAll('.prod-h')){if(phone){el.style.removeProperty('--fit');continue;}fitTo(el,el.clientWidth,.7);}
 for(const el of document.querySelectorAll('.q-title:not(.q-wrap)')){if(phone){el.style.removeProperty('--fit');continue;}fitTo(el,el.clientWidth,.7);}
 for(const el of document.querySelectorAll('.ca-name')){fitLines(el,2,.7);}
 for(const el of document.querySelectorAll('.ab-title,.ab-strengths .at')){if(phone){el.style.removeProperty('--fit');continue;}fitLines(el,2,.74);}
 for(const el of document.querySelectorAll('.seal .sl')){const p=el.parentElement;fitTo(el,p.clientWidth,.55);}
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
 /* 2026-11-18 language version (CRF12 / THM12 / ONE12 / CMB12B / CMB12D rule): a hero contact line that names a chat channel (TH 'Line:
    @beautyblossom_th') shows the consult icon instead of the phone; Korean and phone-number lines keep the phone icon */
 for(const p of document.querySelectorAll('.band-contact')){const sp=p.querySelector('[data-copy]'),v=String((sp&&fields[sp.dataset.copy])??''),chat=locale!=='KO'&&/微信|WeChat|WhatsApp|LINE/i.test(v);
  const img=p.querySelector('img.ico');if(!img)continue;if(chat&&!img.dataset.src0)img.dataset.src0=img.getAttribute('src');const pic=chat?'assets/icons/consult.webp':(img.dataset.src0||img.getAttribute('src'));if(img.getAttribute('src')!==pic)img.setAttribute('src',pic);}
 /* 2026-11-20 TW (LIG12 / ONE12 / SOF12 / CRF12 / OND12 / CMB12A / CMB12B / CMB12D / CMB12G / CMB12H TW rule): the booking-box phone line (c6_ab_phone) may hold
    the country's chat ID (TW LINE ID '@beautyblossom_tw') instead of a number; then the chat icon and the booking link replace the phone icon and tel:. A line
    that repeats the second link line word for word is hidden outside the edit mode (the same words twice). Korean, JP, CN and TH hold the number: nothing
    changes there. */
 const isId=(v)=>!!v&&!/^\+?\d[\d\s\-().]*$/.test(v);
 for(const p of document.querySelectorAll('.bk-phone')){const sp=p.querySelector('[data-copy]'),v=String((sp&&fields[sp.dataset.copy])??'').trim(),id=isId(v);p.classList.toggle('is-id',id);
  const img=p.querySelector('img.ico');if(img){if(id&&!img.dataset.src0)img.dataset.src0=img.getAttribute('src');const pic=id?'assets/icons/consult.webp':(img.dataset.src0||img.getAttribute('src'));if(img.getAttribute('src')!==pic)img.setAttribute('src',pic);}
  const a=p.querySelector('a[data-link]');if(a){if(id){const b=(CH&&CH.booking)||(DATA.links&&DATA.links.booking);if(b)a.href=b;a.target='_blank';a.rel='noopener noreferrer';}else{a.removeAttribute('target');a.removeAttribute('rel');}}
  const box=p.closest('.bk-text'),alt=box&&box.querySelector('.bk-alt [data-copy]'),av=String((alt&&fields[alt.dataset.copy])??'').trim();
  p.hidden=locale!=='KO'&&id&&!!av&&av===v&&!(editable&&editMode);}
 const GM=(DATA.gmap&&DATA.gmap[locale])||null;
 for(const el of document.querySelectorAll('[data-gmap]')){const u=GM&&GM[el.dataset.gmap];if(!u)continue;const a=el.tagName==='SOURCE'?'srcset':'src';if(el.getAttribute(a)!==u)el.setAttribute(a,u);}
 for(const w of document.querySelectorAll('[data-bk-alt]')){const lab=w.querySelector('[data-copy]');w.hidden=!String((lab&&fields[lab.dataset.copy])??'').trim()&&!(editable&&editMode);}
 document.title=[[fields[P+'title_a'],fields[P+'title_b']].filter(Boolean).join(' ')||'가성비 베스트셀러 시술',fields[P+'brand']||'BEAUTY BLOSSOM'].join(' \u00b7 ');
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
window.__BX__={get locale(){return locale;},get editable(){return editable;},get editMode(){return editMode;},get inline(){return !!IE;},keys:KEYS};
reply(IE?{type:'aptos-ready',inline:true}:{type:'aptos-ready'});
})();
