/* 통합이벤트 같은 주제 묶음 ② (combo12c · combo12d) renderer + review-board protocol (aptos-* messages, same as the other V4 pages).
   The two pages use this same file (combo12c.js = combo12d.js). Every visible word comes from copy-data.js (titles, product names, options,
   chips and prices from v4/events/_data/pages.json via v4/<slug>/build-<slug>.cjs) and is edited in place through ../inline-edit.js.
   Display-only helpers below never change the stored text. */
(()=>{'use strict';
const DATA=window.PAGE_COPY;
if(!DATA||!DATA.locales||!DATA.locales.KO){document.documentElement.dataset.reviewError='copy-data missing';return;}
const KEYS=Object.keys(DATA.locales.KO);
/*<lang:CMB12C:1:Y29uc3QgTEFORz17S086J2tvJ307>*//* 2026-11-18 language version TH, 2026-11-20 TW / JP / CN (v4/combo12c/i18n-1118.cjs; copy v4/langverify/out/CMB12C.final.json via
   v4/combo12c/work/i18n-prep.cjs): <html lang> drives the language fonts and layout rules in combo12c-i18n.css (:lang(th) / :lang(ja) / :lang(zh)); the
   Google font of the language is added here (as CMB12A / CMB12B / CMB12D). Korean renders exactly as before. */
const LANG={KO:'ko',JP:'ja',CN:'zh-CN',TW:'zh-TW',TH:'th'};
const FONT_FAMILY={JP:'Noto Sans JP',CN:'Noto Sans SC',TW:'Noto Sans TC',TH:'Noto Sans Thai'};
const CJK={TW:1,JP:1,CN:1},SEGS={};/*</lang:CMB12C:1>*/
const qs=new URLSearchParams(location.search);
let locale=String(qs.get('lang')||'KO').toUpperCase();if(!DATA.locales[locale])locale='KO';
let fields={...DATA.locales[locale]};
let editable=false,editMode=false,lastHeight=0;
const root=document.documentElement;
/* ?capture=1 (board image download): no animation, fixed layout */
if(qs.get('capture')==='1')root.classList.add('is-capture');

/*<lang:CMB12C:2:ZnVuY3Rpb24gcmVwbHkobWVzc2FnZSl7>*/function setFonts(){let l=document.getElementById('locale-fonts');const family=FONT_FAMILY[locale];if(!family){if(l)l.remove();return;}if(!l){l=document.createElement('link');l.id='locale-fonts';l.rel='stylesheet';document.head.append(l);l.addEventListener('load',()=>document.fonts.ready.then(()=>{fit();report();}));}const href='https://fonts.googleapis.com/css2?family='+family.replace(/ /g,'+')+':wght@400;500;600;700;800;900&display=swap';if(l.getAttribute('href')!==href)l.setAttribute('href',href);}
function reply(message){/*</lang:CMB12C:2>*/if(parent!==window)parent.postMessage(message,location.origin);}
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
/* split at ' + ' outside brackets (the text stays the same: the ' + ' separators remain as text) */
function topSplit(v){
 const parts=[];let depth=0,start=0;
 for(let i=0;i<v.length;i++){
  const c=v[i];if(c==='('||c==='[')depth++;else if((c===')'||c===']')&&depth)depth--;
  else if(!depth&&v.startsWith(' + ',i)){parts.push(v.slice(start,i));start=i+3;i+=2;}
 }
 parts.push(v.slice(start));return parts;
}
/* option lines: each part stays on one line (breaks only at ' + ') */
function setParts(el,v){
 el.textContent='';v=v||'';
 topSplit(v).forEach((p,i)=>{
  if(i){const s=document.createElement('span');s.className='plus';s.textContent=' + ';el.append(s);}
  /*<lang:CMB12C:11:Y29uc3QgYz1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7Yy5jbGFzc05hbWU9J3NlZyc7Yy50ZXh0Q29udGVudD1wO2VsLmFwcGVuZChjKTs=>*/const c=document.createElement('span');c.className='seg';if(locale==='TH'||CJK[locale])appendKept(c,p);else c.textContent=p;el.append(c); /* 2026-11-18 TH, 2026-11-20 TW / JP / CN: the loanwords / device names and number + unit stay whole inside a part (KEEP_TH / _TW / _JP / _ZH) *//*</lang:CMB12C:11>*/
 });
}
/* clinic hours: the day label and the time are styled apart */
function setHours(el,v){
 el.textContent='';
 const m=/^(.*\S)(\s+)(\d{1,2}:\d{2}\s*[\u2013\u2014~-]\s*\d{1,2}:\d{2}.*)$/.exec(v||'');
 if(!m){el.textContent=v||'';return;}
 const d=document.createElement('span');d.className='hd';d.textContent=m[1];
 const t=document.createElement('span');t.className='ht';t.textContent=m[3];
 el.append(d,document.createTextNode(m[2]),t);
}
/* widow guard: the last two words stay together */
const GUARD='.bub-tx,.p-lead,.q-ans,.way-d,.way-pick,.way-for,.facts [data-copy],.ar-d,.pick-d,.st-d,.inf-n,.ask-d,.care [data-copy],.src,.notes [data-copy],.at,.ad,.ab-title,.ab-lead [data-copy],.dr-quote,.way-addr > [data-copy],.hrs-note,.bk-links [data-copy],.prod-s';
/* names that never break inside */
const KEEP=/(BEAUTY::BLOSSOM|02-336-7511|'뷰티블라썸의원'|VAT 10%|고주파\(RF\)|모공 팁|펌핑 팁|스킨부스터|크라이오·시트팩|크라이오 5분|앰플·스킨부스터|미세침|저작근|귀밑·턱밑|턱 근육\(저작근\)|피부의 얕은 층|피부결·잔주름|이마·미간·눈가|붉어짐·부기·멍|붉어짐·열감|세안·화장·운동·사우나|알레르기·신경근 질환|임신·수유|복용 중인 약|자외선 차단|3D 피부 진단기|두 갈래|근육 상태|저작근\)의|세안·화장·생활 관리|크라이오·시트팩을|이렇게 진행돼요)/g;
/*<lang:CMB12C:4:ZnVuY3Rpb24gYXBwZW5kS2VwdChlbCxzKXsKIGxldCBsYXN0PTA7S0VFUC5sYXN0SW5kZXg9MDsKIGZvcihjb25zdCBtIG9mIHMubWF0Y2hBbGwoS0VFUCkpew==>*//* 2026-11-18 TH (as CMB12A / CMB12B TH): Thai loanwords the browser's Thai dictionary does not know break between their syllables ('โบ|ท็|อกซ์'),
   and so do a few compounds and the director's name; they stay whole, and so do a number and its unit and an exit / line / floor / house number
   (v4/combo12c/i18n-1118.cjs TH_KEEP). Only the Thai copy is set with this list (KEEP_TH = the Thai names + KEEP); Korean uses KEEP as before */
const KEEP_TH=new RegExp('\\+?82[ -]\\d{1,2}[ -]\\d{3,4}-\\d{4}|@[\\w.\\-]+|Beauty Blossom|Gangnam Unni|Medione Medical Center|Yanghwa-ro|Mapo-gu|Potenza Pumping|RF Microneedling|Chanel Skin Booster|Juvelook Skin|ULTRACOL 100|'+KEEP.source+'|สกินบูสเตอร์|แอมพูล|มาสก์แผ่น|มาสก์ชีต|มาสก์|แพ็กเกจ|ทรีตเมนต์|คอลลาเจน|รูขุมขน|ปริมาณ|ขั้นตอน|ผู้อำนวยการ|เหมาะสม|แตกต่าง|เครื่องมือ|หัวทิป|แซลมอน|โพเทนซ่า|ซาวน่า|สุดสัปดาห์|ชุ่มชื้น|สม่ำเสมอ|เรียบเนียน|หยาบกร้าน|แต่ละคน|เรื่อย ๆ|ก่อนทำ|หลังทำ|ระหว่างทำ|สภาพผิว|ชั้นผิว|กับผิว|คลื่นวิทยุ \\(RF\\)|นพ\\. อี กอนโฮ|อี กอนโฮ|Cryo \\d+ นาที|\\d[\\d,.:]*\\s(?:cc|ขวด|ครั้ง|นาที|ชนิด|วอน|น\\.)|(?:ทางออก|สาย|ชั้น|เลขที่)\\s\\d+(?:\\sและ\\s\\d+)?','g');
/* 2026-11-20 TW / JP / CN (as CMB12D): each language has its own keep list (v4/combo12c/i18n-1118.cjs LANG_KEEP_TW / _JP / _ZH); Korean and TH as before */
const KEEP_TW=new RegExp('\\+?82[ -]\\d{1,2}[ -]\\d{3,4}-\\d{4}|LINE@[\\w.\\-]+|Line@「[^」\\n]{1,16}」|@[\\w.\\-]+|「[^」\\n]{1,16}」|\\d+[樓楼階號号]|\\([^()\\n]{1,6}\\)|N-25|CP-25|Pumping探頭|黃金微針|專題|喬雅露|麗珠蘭|Cryo冷卻護理|水光針|安瓶|面膜|塗抹|\\d+(?:\\.\\d+)?cc|\\d+分鐘|\\d+萬(?:\\d+千)?韓元|\\d{1,2}:\\d{2}[–-]\\d{1,2}:\\d{2}|Beauty Blossom|QR Code|Medione醫療中心|Jeisys Medical|Ultracol 100|'+KEEP.source,'g');
const KEEP_JP=new RegExp('\\+?82[ -]\\d{1,2}[ -]\\d{3,4}-\\d{4}|LINE：@[\\w.\\-]+|@[\\w.\\-]+|ビューティーブロッサム|メディワンメディカルセンター|ジェイシスメディカル|カンナムオンニ|カウンセリング|スキンブースター|シートマスク|ジュベルックスキン|ウルトラコール100|エクソヒーラー|フィロルガ|トラブラン|リジュラン|リズネ|ポテンツァ|ポンピング|エディション|オールインワン|エイジングケア|コラーゲン|エネルギー|アンプル|クライオ|バイアル|チップ|メニュー|サーモン注射|シャネル注射|イ・ゴンホ|N-25|CP-25|\\d+(?:\\.\\d+)?cc|\\d+分|\\d[\\d,]*万?ウォン|\\d+(?:・\\d+)*(?:号線|階)|\\d+番出口|\\d{1,2}:\\d{2}[–-]\\d{1,2}:\\d{2}|Beauty Blossom|QR|'+KEEP.source,'g');
const KEEP_ZH=new RegExp('\\+?82[ -]\\d{1,2}[ -]\\d{3,4}-\\d{4}|Beautyblossom00|@[\\w.\\-]+|\\d+(?:・\\d+)*[樓楼階號号]|（[^（）\\n]{1,8}）|\\([^()\\n]{1,6}\\)|N-25|CP-25|Pumping探头|黄金微针|专场|乔雅露|丽珠兰|Cryo冷却护理|水光产品|丽朵皮肤科|官方微信|面膜|涂抹|\\d+(?:\\.\\d+)?cc|\\d+分钟|\\d+万(?:\\d+千)?韩元|\\d{1,2}:\\d{2}[–-]\\d{1,2}:\\d{2}|Beauty Blossom|MediOne Medical Center|Jeisys Medical|ULTRACOL 100|QR Code|'+KEEP.source,'g');
const keepRe=()=>locale==='TH'?KEEP_TH:locale==='TW'?KEEP_TW:locale==='JP'?KEEP_JP:locale==='CN'?KEEP_ZH:KEEP;
/* 2026-11-20 Chinese / Japanese (same as CMB12A / CMB12B / CMB12D): the last three characters stay together, grown back to the start of their word
   (a '・' break or Intl.Segmenter) so a short line never splits a word; at most 5 characters (punctuation aside); a '・' inside those last characters is a
   break too when two to five characters follow it. Thai has no guard (dictionary breaks) */
function cjkCut(v,cut){const core=(i)=>v.slice(i).replace(/[。！？，、）)]+$/u,'').length;
 const sep=Math.max(v.lastIndexOf('・'),v.lastIndexOf('·'));if(sep>0&&sep+1<v.length&&core(sep+1)>=2&&core(sep+1)<=5)return sep+1;
 let seg=SEGS[locale];if(seg===undefined){try{seg=SEGS[locale]=new Intl.Segmenter(LANG[locale],{granularity:'word'});}catch(e){seg=SEGS[locale]=null;}}if(!seg)return cut;
 let start=0,end=v.length;for(const g of seg.segment(v)){if(g.index>cut){end=g.index;break;}start=g.index;}
 if(start===cut)return cut;if(start>0&&core(start)<=5)return start;return end<v.length?end:-1;}
/* flex / grid boxes turn every text piece into its own item (gaps, trimmed spaces), so they keep their text whole */
const guardable=(el)=>!/flex|grid/.test(getComputedStyle(el).display);
/* the Chinese guard only for text with Chinese characters; JP: kana count too (a kana-only Japanese line keeps its last word as well) */
const HAN=/[\u3400-\u9fff\uf900-\ufaff]/;
const JPCH=/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/;
const hanOf=(v)=>(locale==='JP'?JPCH:HAN).test(v);
function appendKept(el,s){
 let last=0;const R=keepRe();R.lastIndex=0;
 for(const m of s.matchAll(R)){/*</lang:CMB12C:4>*/
  if(m.index>last)el.append(document.createTextNode(s.slice(last,m.index)));
  /*<lang:CMB12C:5:Y29uc3Qgaz1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7ay5jbGFzc05hbWU9J253JztrLnRleHRDb250ZW50PW1bMF07ZWwuYXBwZW5kKGspO2xhc3Q9bS5pbmRleCttWzBdLmxlbmd0aDs=>*/let e=m.index+m[0].length;if(CJK[locale])while(e<s.length&&/[，。、：；！？）」』]/.test(s[e]))e++; /* 2026-11-20 TW / JP / CN: Chinese / Japanese punctuation right after a kept name stays with it (it may not start a line); Korean and Thai: unchanged */
  const k=document.createElement('span');k.className='nw';k.textContent=s.slice(m.index,e);el.append(k);last=e;
  if(locale==='JP'&&el.closest('.h-ko'))el.append(document.createElement('wbr')); /* 2026-11-20 JP: the hero title breaks only between its kept katakana words (KEEP_JP), never inside one (as CMB12D JP) *//*</lang:CMB12C:5>*/
 }
 if(last<s.length)el.append(document.createTextNode(s.slice(last)));
}
function setText(el,v){
 if(el.classList.contains('money')){setMoney(el,v);return;}
 if(el.classList.contains('cmb')){setParts(el,v);return;}
 if(el.matches('.hrs [data-copy]')){setHours(el,v);return;}
 KEEP.lastIndex=0;
 /*<lang:CMB12C:6:Y29uc3Qga2VwdD0hIXYmJktFRVAudGVzdCh2KTtLRUVQLmxhc3RJbmRleD0wOw==>*/const KR=keepRe();KR.lastIndex=0;const kept=!!v&&KR.test(v);KR.lastIndex=0;/*</lang:CMB12C:6>*/
 /*<lang:CMB12C:7:aWYoIXZ8fCFlbC5tYXRjaGVzKEdVQVJEKSl7>*//* 2026-11-18 TH: no Korean widow guard (Thai breaks by its dictionary; its words stay whole through KEEP_TH, as CMB12A / CMB12B TH). 2026-11-20 TW / JP / CN:
    a text with Chinese characters (JP: or kana) keeps its last word together where it flows inline (the Korean list GUARD stays as it was) */
 if(!v||locale==='TH'||(!el.matches(GUARD)&&!(CJK[locale]&&hanOf(v)&&guardable(el)))){/*</lang:CMB12C:7>*/if(kept){el.textContent='';appendKept(el,v);}else el.textContent=v;return;}
 /*<lang:CMB12C:8:bGV0IG09ZWwubWF0Y2hlcygnLmFiLXRpdGxlJyk/di5tYXRjaCgvKFxTK1sgXHRdK1xTezEsM30pJC8pOnYubWF0Y2goLyhcUytbIFx0XStcUyspJC8pOw==>*/let m=null;
 if(!CJK[locale])m=el.matches('.ab-title')?v.match(/(\S+[ \t]+\S{1,3})$/):v.match(/(\S+[ \t]+\S+)$/);
 /* 2026-11-20 TW / JP / CN: the Chinese guard only in boxes whose text flows inline (in a flex / grid box the kept tail would become its own item) */
 else if(hanOf(v)&&guardable(el)){m=v.match(/([^\s]{3}[。！？，、）)]*)$/u);if(m&&m[1].length<v.length){const c=cjkCut(v,v.length-m[1].length);m=c>0?[null,v.slice(c)]:null;}}/*</lang:CMB12C:8>*/
 if(!m&&/\d{2,3}-\d{3,4}-\d{4}$/.test(v))m=v.match(/(\S*\d{2,3}-\d{3,4}-\d{4})$/);
 if(m){let cut=v.length-m[1].length;/*<lang:CMB12C:9:Zm9yKGNvbnN0IGsgb2Ygdi5tYXRjaEFsbChLRUVQKSlpZihjdXQ+ay5pbmRleA==>*/for(const k of v.matchAll(KR))if(cut>k.index/*</lang:CMB12C:9>*/&&cut<k.index+k[0].length)cut=k.index;m=cut>0?[null,v.slice(cut)]:null;}
 if(!m||m[1].length>=v.length){el.textContent='';appendKept(el,v);return;}
 const tail=document.createElement('span');tail.className='nw';tail.textContent=m[1];
 /*<lang:CMB12C:10:ZWwudGV4dENvbnRlbnQ9Jyc7YXBwZW5kS2VwdChlbCx2LnNsaWNlKDAsdi5sZW5ndGgtbVsxXS5sZW5ndGgpKTtlbC5hcHBlbmQodGFpbCk7>*/el.textContent='';appendKept(el,v.slice(0,v.length-m[1].length));if(locale==='JP'&&el.matches('.h-ko'))el.append(document.createElement('wbr')); /* 2026-11-20 JP: a break opportunity before the kept last word of the hero title */
 el.append(tail);/*</lang:CMB12C:10>*/
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
function fitBox(el,min){
 el.style.removeProperty('--fit');
 for(let f=1,i=0;i<30&&(el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1)&&f>min;i++){f-=.02;el.style.setProperty('--fit',f.toFixed(3));}
}
function fit(){
 const phone=isPhone();
 for(const el of document.querySelectorAll('.tz-top')){if(phone){el.style.removeProperty('--fit');continue;}fitTo(el,el.clientWidth,.6);}
 for(const el of document.querySelectorAll('.h-ko')){if(phone){el.style.removeProperty('--fit');continue;}fitLines(el,2,.7);}
 for(const el of document.querySelectorAll('.bub-tx')){if(phone){el.style.removeProperty('--fit');continue;}fitBox(el,.7);}
 for(const el of document.querySelectorAll('.pt-main')){if(phone){el.style.removeProperty('--fit');continue;}fitTo(el,el.closest('.p-title').clientWidth*.86,.6);}
 for(const el of document.querySelectorAll('.q-title')){if(phone){el.style.removeProperty('--fit');continue;}fitTo(el,el.clientWidth,.7);}
 for(const el of document.querySelectorAll('.ab-title,.ab-strengths .at')){if(phone){el.style.removeProperty('--fit');continue;}fitLines(el,2,.74);}
 /* seal lines: the content box of the seal text (inside its side padding) */
 for(const el of document.querySelectorAll('.seal .sl')){const p=el.parentElement,cs=getComputedStyle(p);fitTo(el,p.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight),.55);}
}

function render(){
 /*<lang:CMB12C:3:cm9vdC5sYW5nPUxBTkdbbG9jYWxlXXx8J2tvJztyb290LmRhdGFzZXQubG9jYWxlPWxvY2FsZTs=>*/root.lang=LANG[locale]||'ko';root.dataset.locale=locale;setFonts();/*</lang:CMB12C:3>*/
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
 /*<lang:CMB12C:12:Zm9yKGNvbnN0IGltZyBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdpbWdbZGF0YS1xcl0nKSl7Y29uc3QgcT1DSCYmQ0gucXI7aWYocSYmaW1nLmdldEF0dHJpYnV0ZSgnc3JjJykhPT1xKWltZy5zZXRBdHRyaWJ1dGUoJ3NyYycscSk7fQo=>*/for(const img of document.querySelectorAll('img[data-qr]')){const q=CH&&CH.qr;if(q&&img.getAttribute('src')!==q)img.setAttribute('src',q);}
 /* 2026-11-20 TW (LIG12 / ONE12 / SOF12 / CRF12 / OND12 / CMB12B / CMB12D rule): the booking-box phone line (c3_ab_phone) may hold the country's chat ID (TW
    LINE ID '@beautyblossom_tw') instead of a number; then the chat icon and the booking link replace the phone icon and tel:. A line that repeats the second
    link line word for word is hidden outside the edit mode. Korean, TH, JP and CN hold the number: nothing changes there. */
 const isId=(v)=>!!v&&!/^\+?\d[\d\s\-().]*$/.test(v);
 for(const p of document.querySelectorAll('.bk-phone')){const sp=p.querySelector('[data-copy]'),v=String((sp&&fields[sp.dataset.copy])??'').trim(),id=isId(v);p.classList.toggle('is-id',id);
  const img=p.querySelector('img.ico');if(img){if(id&&!img.dataset.src0)img.dataset.src0=img.getAttribute('src');const pic=id?'assets/icons/consult.webp':(img.dataset.src0||img.getAttribute('src'));if(img.getAttribute('src')!==pic)img.setAttribute('src',pic);}
  const a=p.querySelector('a[data-link]');if(a){if(id){const b=(CH&&CH.booking)||(DATA.links&&DATA.links.booking);if(b)a.href=b;a.target='_blank';a.rel='noopener noreferrer';}else{a.removeAttribute('target');a.removeAttribute('rel');}}
  const box=p.closest('.bk-text'),alt=box&&box.querySelector('.bk-alt [data-copy]'),av=String((alt&&fields[alt.dataset.copy])??'').trim();
  p.hidden=locale!=='KO'&&id&&!!av&&av===v&&!(editable&&editMode);}
 /* 2026-11-18 language versions (CRF12 / THM12 / ONE12 / CMB12B rule): a hero contact line that names a chat channel (TH 'Line: @beautyblossom_th', TW
    '預約・諮詢 LINE@beautyblossom_tw', JP 'LINE：@beautyblossom_jp', CN '预约咨询：官方微信 Beautyblossom00') shows the consult icon instead of the phone; Korean and
    phone-number lines keep the phone icon */
 for(const p of document.querySelectorAll('.h-contact')){const sp=p.querySelector('[data-copy]'),v=String((sp&&fields[sp.dataset.copy])??''),chat=locale!=='KO'&&/微信|WeChat|WhatsApp|LINE/i.test(v);
  const img=p.querySelector('img.ico');if(!img)continue;if(chat&&!img.dataset.src0)img.dataset.src0=img.getAttribute('src');const pic=chat?'assets/icons/consult.webp':(img.dataset.src0||img.getAttribute('src'));if(img.getAttribute('src')!==pic)img.setAttribute('src',pic);}
/*</lang:CMB12C:12>*/ const GM=(DATA.gmap&&DATA.gmap[locale])||null;
 for(const el of document.querySelectorAll('[data-gmap]')){const u=GM&&GM[el.dataset.gmap];if(!u)continue;const a=el.tagName==='SOURCE'?'srcset':'src';if(el.getAttribute(a)!==u)el.setAttribute(a,u);}
 for(const w of document.querySelectorAll('[data-bk-alt]')){const lab=w.querySelector('[data-copy]');w.hidden=!String((lab&&fields[lab.dataset.copy])??'').trim()&&!(editable&&editMode);}
 const tk=DATA.titleKey,bk=DATA.brandKey;
 document.title=[fields[tk]||'',fields[bk]||'BEAUTY BLOSSOM'].filter(Boolean).join(' \u00b7 ');
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
window.__CB2__={get locale(){return locale;},get editable(){return editable;},get editMode(){return editMode;},get inline(){return !!IE;},keys:KEYS};
reply(IE?{type:'aptos-ready',inline:true}:{type:'aptos-ready'});
})();
