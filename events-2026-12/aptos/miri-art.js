(()=>{'use strict';
/* Optional image typography for the landing title.
   The real DOM text (h1.hero-title / h2.pricing-title [data-copy=title_main]) always stays in place and keeps
   working for accessibility and double-click editing. When assets/miri-title-ko.png has loaded, the page is Korean
   and the text equals the source copy exactly, the class below paints the PNG as the background and makes the
   glyphs transparent. Any text/lang change removes the class at once so the normal HTML text shows again. */
const SRC='assets/miri-title-ko.png',ACTIVE='miri-title-art';
const SELECTOR='h1.hero-title[data-copy="title_main"],h2.pricing-title[data-copy="title_main"]';
const root=document.documentElement;
let loaded=false;
const sourceTitle=()=>{const c=window.LANDING_COPY;return c&&c.text&&typeof c.text.title_main==='string'?c.text.title_main:null;};
const isKorean=()=>/^ko(?:-|$)/i.test(root.lang||'');
function sync(){
  const src=sourceTitle(),on=loaded&&src!==null&&isKorean();
  for(const el of document.querySelectorAll(SELECTOR))el.classList.toggle(ACTIVE,on&&el.textContent===src);
}
const observer=new MutationObserver(sync);
observer.observe(document.body||root,{subtree:true,childList:true,characterData:true});
observer.observe(root,{attributes:true,attributeFilter:['lang']});
// state: loading -> ready (PNG usable) | pending (PNG missing/failed; normal HTML title is shown)
root.dataset.miriArt='loading';
const img=new Image();
img.onload=()=>{loaded=img.naturalWidth>0&&img.naturalHeight>0;root.dataset.miriArt=loaded?'ready':'pending';sync();};
img.onerror=()=>{loaded=false;root.dataset.miriArt='pending';sync();};
img.src=SRC;
window.__MIRI_ART__={get state(){return root.dataset.miriArt;},sync};
})();
