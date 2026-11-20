/* IVS12 수액 이벤트 · 겨울 시즌 renderer + review-board protocol (aptos-* messages, same as the other V4 pages).
   Every visible word comes from copy-data.js (titles, product names, composition lines and prices from v4/events/_data/pages.json via
   v4/iv12/build-iv12.cjs) and is edited in place through ../inline-edit.js. Display-only helpers below never change the stored text. */
(()=>{'use strict';
const DATA=window.PAGE_COPY;
if(!DATA||!DATA.locales||!DATA.locales.KO){document.documentElement.dataset.reviewError='copy-data missing';return;}
const KEYS=Object.keys(DATA.locales.KO);
/* 2026-11-17 language versions (TW and TH; copy from v4/langverify/out/IVS12.final.json via v4/iv12/work/i18n-prep.cjs): <html lang> drives the
   language fonts and layout rules in iv12-i18n.css (:lang()); the Google font of the language is added here (same as ligament12.js / oneday12.js).
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

/* money: the number large, the unit small ('7만원' -> '7' + '만원', '18만5천원' -> '18' '만' '5' '천원'; text stays identical) */
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
/* card 5 hours: the day label and the time are styled apart */
function setHours(el,v){
 el.textContent='';
 /* 2026-11-19 EN: the time may carry AM / PM ('Weekdays 10:00 AM – 8:00 PM'); no other language writes AM / PM, so only EN changes */
 const m=/^(.*\S)(\s+)(\d{1,2}:\d{2}(?:\s?[AP]M)?\s*[\u2013\u2014~-]\s*\d{1,2}:\d{2}.*)$/.exec(v||'');
 if(!m){el.textContent=v||'';return;}
 const d=document.createElement('span');d.className='hd';d.textContent=m[1];
 const t=document.createElement('span');t.className='ht';t.textContent=m[3];
 el.append(d,document.createTextNode(m[2]),t);
}
/* widow guard: the last two words stay together */
const GUARD='.hook,.p-lead,.q-ans,.kd-d,.kd-n,.mix-d,.pick-l [data-copy],.st-d,.inf-n,.care-l [data-copy],.alert,.src,.notes [data-copy],.at,.ad,.ab-title,.ab-lead [data-copy],.dr-quote,.way-addr > [data-copy],.hrs-note,.bk-links [data-copy],.q-wrap,.popts,.pmix';
/* names that never break inside
   2026-11-17 language versions also keep the international phone number, a chat ID ('@beautyblossom_tw'), the floor / house numbers of the address
   ('6樓', '66號'), a name in corner brackets (the TW LINE account '「🌸麗朵皮膚科🌸」') and Thai words the browser's Thai dictionary splits at a line end
   (loan words: 'แพ็ก|เกจ' package, 'บูส|เตอร์' booster, 'กลูตา|ไธโอน' glutathione; compounds 'ความ|มั่นใจ', 'เหมาะ|สม', 'สุด|สัปดาห์'; the director's
   name 'นพ. อี กอนโฮ'; and, seen splitting in IVS12 TH: 'หลอดเลือด|ดำ', 'เหนื่อย|ล้า', 'สาร|น้ำ', 'จอง|คิว', 'กรุง|โซล', 'รับ|บริการ', 'ส่วน|ประกอบ',
   'เป้า|หมาย', 'ความ|งาม', 'ซัก|ประวัติ', 'ให้นม|บุตร', 'ข้อ|ควรระวัง', 'วัน|หยุด', 'ช็|อต' (shot), 'ประจำ|วัน', a number and its word ('1 ครั้ง', '6 สูตร', '4 แพ็กเกจ', 'ทางออก 3'),
   'เขต Mapo-gu' and 'IV Drip'); TW also keeps the clinic name 'Beauty Blossom', the word 療程 and the card 4 question's last phrase '流程這樣安排' (it broke
   '流 / 程' and '療 / 程'); no Korean copy has them */
const KEEP=/(\+?82[ -]\d{1,2}[ -]\d{3,4}-\d{4}|@[\w.\-]+|\d+[樓楼階號号]|「[^」\n]{1,16}」|Beauty Blossom|流程這樣安排|療程|แพ็กเกจ|บูสเตอร์|กลูตาไธโอน|ความมั่นใจ|เหมาะสม|สุดสัปดาห์|หลอดเลือดดำ|เหนื่อยล้า|สารน้ำ|จองคิว|กรุงโซล|ทางออก \d+|\d+ (?:ครั้ง|สูตร|แพ็กเกจ)|เขต Mapo-gu|รับบริการ|ส่วนประกอบ|เป้าหมาย|ความงาม|ซักประวัติ|ให้นมบุตร|ข้อควรระวัง|วันหยุด|ช็อต|ประจำวัน|IV Drip|นพ\. อี กอนโฮ|BEAUTY::BLOSSOM|02-336-7511|'뷰티블라썸의원'|VAT 10%|immune booster shot|부스터 샷|건강기능식품|약물 알레르기|임신·수유|기저질환|비타민·미네랄|진통 성분|피하 주사|응급 진료|두드러기|메스꺼움|멍·붓기·발진|투여 이력|건강 상태|작은 글씨|싸이모신\(sc\)|백옥\(iv\)|\(만성피로 고농축 영양\))/g;
function appendKept(el,s){
 let last=0;KEEP.lastIndex=0;
 for(const m of s.matchAll(KEEP)){
  if(m.index>last)el.append(document.createTextNode(s.slice(last,m.index)));
  let e=m.index+m[0].length;while(e<s.length&&/[，。、：；！？）」』]/.test(s[e]))e++; /* 2026-11-17: Chinese punctuation right after a kept name stays with it (it may not start a line); Korean copy has none */
  const k=document.createElement('span');k.className='nw';k.textContent=s.slice(m.index,e);el.append(k);last=e;
 }
 if(last<s.length)el.append(document.createTextNode(s.slice(last)));
}
/* 2026-11-17 Chinese (same as ligament12.js / oneday12.js): the last three characters stay together, grown back to the start of their word (a '・'
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
 if(el.matches('.hrs [data-copy]')){setHours(el,v);return;}
 KEEP.lastIndex=0;
 const kept=!!v&&KEEP.test(v);KEEP.lastIndex=0;
 /* Chinese: every text keeps its last word together (the Korean list GUARD stays as it was) */
 if(!v||(!el.matches(GUARD)&&!(CJK[locale]&&guardable(el)))){if(kept){el.textContent='';appendKept(el,v);}else el.textContent=v;return;}
 let m=null;
 if(locale==='TH')m=null;
 else if(!CJK[locale])m=el.matches('.ab-title')?v.match(/(\S+[ \t]+\S{1,3})$/):v.match(/(\S+[ \t]+\S+)$/);
 /* Chinese guard only in boxes whose text flows inline: in a flex / grid box the kept tail would become its own item with a gap before it */
 else if(guardable(el)){m=v.match(/([^\s]{3}[。！？，、）)]*)$/u);if(m&&m[1].length<v.length){const c=cjkCut(v,v.length-m[1].length);m=c>0?[null,v.slice(c)]:null;}}
 if(!m&&/\d{2,3}-\d{3,4}-\d{4}$/.test(v))m=v.match(/(\S*\d{2,3}-\d{3,4}-\d{4})$/);
 if(m){let cut=v.length-m[1].length;for(const k of v.matchAll(KEEP))if(cut>k.index&&cut<k.index+k[0].length)cut=k.index;m=cut>0?[null,v.slice(cut)]:null;}
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
 /* 2026-11-17 language versions: the TW / TH titles are longer than the Korean ones ('Blossom點滴加強組合', 'แพ็กเกจ Blossom IV Booster'), so a language
    version may shrink them further than the Korean floor; Korean keeps its floors (it fits above them, nothing changes) */
 const lv=locale!=='KO';
 for(const el of document.querySelectorAll('.h-ko,.h-word')){fitTo(el,el.parentElement.clientWidth,lv?.4:.55);}
 for(const el of document.querySelectorAll('.pt-main')){if(phone){el.style.removeProperty('--fit');continue;}fitTo(el,el.closest('.p-title').clientWidth,lv?.45:.6);}
 for(const el of document.querySelectorAll('.q-title:not(.q-wrap)')){if(phone){el.style.removeProperty('--fit');continue;}fitTo(el,el.clientWidth,lv?.5:.7);}
 for(const el of document.querySelectorAll('.q-wrap')){if(phone){el.style.removeProperty('--fit');continue;}fitLines(el,2,.74);}
 for(const el of document.querySelectorAll('.hb-name')){fitTo(el,el.clientWidth,.7);}
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
 /* 2026-11-17 language versions (LIG12 / ONE12 / SOF12 / CRF12 rule): the booking-box phone line (iv_ab_phone) may hold the country's chat ID (TW LINE
    ID '@beautyblossom_tw') instead of a number; then the chat icon and the booking link replace the phone icon and tel:. A line that repeats the second
    link line word for word is hidden outside the edit mode. Korean and TH hold the number: nothing changes there. */
 const isId=(v)=>!!v&&!/^\+?\d[\d\s\-().]*$/.test(v);
 for(const p of document.querySelectorAll('.bk-phone')){const sp=p.querySelector('[data-copy]'),v=String((sp&&fields[sp.dataset.copy])??'').trim(),id=isId(v);p.classList.toggle('is-id',id);
  const img=p.querySelector('img.ico');if(img){if(id&&!img.dataset.src0)img.dataset.src0=img.getAttribute('src');const pic=id?'assets/icons/consult.webp':(img.dataset.src0||img.getAttribute('src'));if(img.getAttribute('src')!==pic)img.setAttribute('src',pic);}
  const a=p.querySelector('a[data-link]');if(a){if(id){const b=(CH&&CH.booking)||(DATA.links&&DATA.links.booking);if(b)a.href=b;a.target='_blank';a.rel='noopener noreferrer';}else{a.removeAttribute('target');a.removeAttribute('rel');}}
  const box=p.closest('.bk-text'),alt=box&&box.querySelector('.bk-alt [data-copy]'),av=String((alt&&fields[alt.dataset.copy])??'').trim();
  p.hidden=locale!=='KO'&&id&&!!av&&av===v&&!(editable&&editMode);}
 /* 2026-11-17 language versions (CRF12 / THM12 / ONE12 rule): a hero or band contact line that names a chat channel (TW 'LINE@beautyblossom_tw') shows
    the consult icon instead of the phone; Korean and phone-number lines (TH) keep the phone icon */
 for(const sp of document.querySelectorAll('[data-copy="iv_contact"]')){const p=sp.parentElement,img=p&&p.querySelector('img.ico');if(!img)continue;const v=String(fields.iv_contact??''),chat=locale!=='KO'&&/微信|WeChat|WhatsApp|LINE/i.test(v);
  if(chat&&!img.dataset.src0)img.dataset.src0=img.getAttribute('src');const pic=chat?'assets/icons/consult.webp':(img.dataset.src0||img.getAttribute('src'));if(img.getAttribute('src')!==pic)img.setAttribute('src',pic);}
 const GM=(DATA.gmap&&DATA.gmap[locale])||null;
 for(const el of document.querySelectorAll('[data-gmap]')){const u=GM&&GM[el.dataset.gmap];if(!u)continue;const a=el.tagName==='SOURCE'?'srcset':'src';if(el.getAttribute(a)!==u)el.setAttribute(a,u);}
 for(const w of document.querySelectorAll('[data-bk-alt]')){const lab=w.querySelector('[data-copy]');w.hidden=!String((lab&&fields[lab.dataset.copy])??'').trim()&&!(editable&&editMode);}
 document.title=[fields.iv_title||'수액 부스터 패키지',fields.iv_brand||'BEAUTY BLOSSOM'].join(' \u00b7 ');
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
window.__IV__={get locale(){return locale;},get editable(){return editable;},get editMode(){return editMode;},get inline(){return !!IE;},keys:KEYS};
reply(IE?{type:'aptos-ready',inline:true}:{type:'aptos-ready'});
})();
