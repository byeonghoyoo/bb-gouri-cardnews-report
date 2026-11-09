/* Shared DOM typography. Formatting changes font size/line flow only, never colors. */
(function(global){'use strict';
var F=global.BBTextFormat;if(!F)return;
function create(o){
 var doc=o.doc,win=doc.defaultView||global,states=new WeakMap(),formats={},scope='home',raf=0;
 try{var q=new URLSearchParams(win.location.search);scope=q.get('mode')==='app'?'app':(['line','kakao'].indexOf(q.get('size'))>=0?q.get('size'):'home');}catch(e){}
 var props=['font-size','line-height','min-width','min-height'];
 function text(el,keep){return win.BBInlineEdit.textOf(el,keep);}
 function snapshotStyle(el,ps){var x={};ps.forEach(function(p){x[p]=[el.style.getPropertyValue(p),el.style.getPropertyPriority(p)];});return x;}
 function restoreStyle(el,x){Object.keys(x).forEach(function(p){if(x[p][0])el.style.setProperty(p,x[p][0],x[p][1]);else el.style.removeProperty(p);});}
 function clear(el){
  var st=states.get(el);if(st){restoreStyle(el,st);states.delete(el);}
  [el].concat(Array.from(el.querySelectorAll('[data-bb-original-flow]'))).forEach(function(n){var val=n.getAttribute('data-bb-original-flow');if(!val)return;try{restoreStyle(n,JSON.parse(val));}catch(e){}n.removeAttribute('data-bb-original-flow');});
  Array.from(el.querySelectorAll('[data-bb-font]')).forEach(function(n){n.replaceWith.apply(n,Array.from(n.childNodes));});
  Array.from(el.querySelectorAll('[data-bb-line],[data-bb-caret]')).forEach(function(n){n.remove();});
  el.removeAttribute('data-bb-manual');el.removeAttribute('data-bb-formatted');
 }
 function logical(el){
  var nodes=[],brs=[],str='';
  function walk(p){Array.from(p.childNodes).forEach(function(n){
   if(n.nodeType===3){var v=n.nodeValue.replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ').replace(/\u200b/g,'');nodes.push({node:n,start:str.length,end:str.length+v.length});str+=v;}
   else if(n.nodeType===1){if(n.hasAttribute('data-bb-caret'))return;if(n.tagName==='BR'){if(n.hasAttribute('data-bb-line'))brs.push({node:n,at:str.length});else str+='\n';return;}if(/^(WBR|SCRIPT|STYLE)$/.test(n.tagName))return;if(/^(DIV|P|LI)$/.test(n.tagName)&&str&&!str.endsWith('\n'))str+='\n';walk(n);}
  });}walk(el);return{nodes:nodes,brs:brs,value:str.replace(/\n+$/,'')};
 }
 function selection(el){
  var s=win.getSelection();if(!s||!s.rangeCount)return null;var r=s.getRangeAt(0);if(!el.contains(r.startContainer)||!el.contains(r.endContainer))return null;
  function offset(n,p){var z=doc.createRange();z.selectNodeContents(el);z.setEnd(n,p);var box=doc.createElement('span');box.appendChild(z.cloneContents());return{text:text(box,true),box:box};}
  var a=offset(r.startContainer,r.startOffset),b=offset(r.endContainer,r.endOffset),brs=logical(a.box).brs;
  return{start:a.text.length,end:b.text.length,afterBreak:!!(brs.length&&brs[brs.length-1].at===a.text.length)};
 }
 function select(el,s){
  if(!s)return;var m=logical(el),len=m.value.length,start=Math.min(s.start,len),end=Math.min(s.end,len);
  function at(p,after){if(after){var b=m.brs.find(function(x){return x.at===p;});if(b)return{node:b.node.parentNode,offset:Array.from(b.node.parentNode.childNodes).indexOf(b.node)+1};}for(var i=0;i<m.nodes.length;i++){var n=m.nodes[i];if(p>=n.start&&p<=n.end){if(p===n.end&&i+1<m.nodes.length&&m.nodes[i+1].start===p)continue;return{node:n.node,offset:Math.min(n.node.length,p-n.start)};}}return{node:el,offset:el.childNodes.length};}
  try{var a=at(start,s.afterBreak),b=at(end,s.afterBreak&&start===end),r=doc.createRange();r.setStart(a.node,a.offset);r.setEnd(b.node,b.offset);var w=win.getSelection();w.removeAllRanges();w.addRange(r);}catch(e){}
 }
 function scaleAt(fmt,pos){for(var i=0;i<fmt.ranges.length;i++){var r=fmt.ranges[i];if(pos>=r[0]&&pos<r[1])return r[2];}return fmt.scale;}
 function rangeSize(fmt,start,end,pct,len){
  var out=JSON.parse(JSON.stringify(fmt));if(start===end){out.scale=pct;out.ranges=[];return out;}
  var cuts=[0,len,start,end];fmt.ranges.forEach(function(r){cuts.push(r[0],r[1]);});cuts=Array.from(new Set(cuts)).sort(function(a,b){return a-b;});out.ranges=[];
  for(var i=0;i<cuts.length-1;i++){var a=cuts[i],b=cuts[i+1],p=a>=start&&b<=end?pct:scaleAt(fmt,a);if(a===b||p===out.scale)continue;var z=out.ranges[out.ranges.length-1];if(z&&z[1]===a&&z[2]===p)z[1]=b;else out.ranges.push([a,b,p]);}return out;
 }
 function structuralBreaks(el){
  var m=logical(el),r=m.brs.map(function(b){return b.at;}),v=m.value;for(var i=0;i<v.length;i++)if(v[i]==='\n')r.push(i+1);
  Array.from(el.querySelectorAll('*')).forEach(function(n){if(n.hasAttribute('data-bb-font')||n.classList.contains('bb-gap'))return;if(!/^(block|flex|grid|table|list-item|flow-root)/.test(win.getComputedStyle(n).display))return;var first=m.nodes.find(function(t){return n.contains(t.node)&&t.node.nodeValue.trim();});if(first&&first.start>0)r.push(first.start);});
  return Array.from(new Set(r)).filter(function(n){return n>=0&&n<=v.length;}).sort(function(a,b){return a-b;});
 }
 function rect(n){var r=n.getBoundingClientRect();return{x:r.left,y:r.top,w:r.width,h:r.height,right:r.right,bottom:r.bottom};}
 function visible(el){var r=el.getBoundingClientRect();return r.width>0&&r.height>0&&win.getComputedStyle(el).visibility!=='hidden'&&win.getComputedStyle(el).display!=='none';}
 function cardOf(el){return el.closest('[data-card],section.p1,section.p2,section.p3,section.p4,section.p5,section')||el.parentElement;}
 function ink(el){var arr=[];logical(el).nodes.forEach(function(t){if(!t.node.nodeValue.trim())return;var p=t.node.parentElement;if(!visible(p))return;var rg=doc.createRange();rg.selectNodeContents(t.node);Array.from(rg.getClientRects()).forEach(function(r){if(r.width>.1&&r.height>.1)arr.push({x:r.left,y:r.top,w:r.width,h:r.height,right:r.right,bottom:r.bottom});});});return arr;}
 function intersects(a,b){return Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1;}
 function measure(el){
  var card=cardOf(el),key=o.keyOf(el),texts=ink(el),siblings=[];
  Array.from(card.querySelectorAll('[data-copy],img,svg')).forEach(function(n){if(n===el||el.contains(n)||n.contains(el)||n.getAttribute('data-copy')===key||!visible(n))return;var rr=n.hasAttribute('data-copy')?ink(n):[rect(n)];siblings.push({node:n,rect:rect(n),inks:rr,overlap:texts.some(function(a){return rr.some(function(b){return intersects(a,b);});})});});
  var bounds=[];for(var p=el.parentElement;p;p=p.parentElement){var c=win.getComputedStyle(p);if(p===card||parseFloat(c.borderTopWidth)>0||(c.backgroundColor!=='rgba(0, 0, 0, 0)'&&c.backgroundColor!=='transparent')||/hidden|clip/.test(c.overflow)){var r=rect(p);if(r.w>0&&r.h>0)bounds.push(r);}if(p===card)break;}
  return{siblings:siblings,bounds:bounds,ink:texts,overflow:Math.max(0,el.scrollWidth-el.clientWidth),rect:rect(el)};
 }
 function outside(a,b){return Math.max(0,b.x-a.x,a.right-b.right,b.y-a.y,a.bottom-b.bottom);}
 function check(el,before){
  if(!visible(el))return null;var current=ink(el);
  for(var i=0;i<before.bounds.length;i++){var box=before.bounds[i],old=Math.max.apply(Math,[0].concat(before.ink.map(function(a){return outside(a,box);}))),now=Math.max.apply(Math,[0].concat(current.map(function(a){return outside(a,box);})));if(now>Math.max(2,old+1))return '글자가 상자를 벗어납니다. 크기를 줄이거나 줄 위치를 바꿔 주세요.';}
  for(var j=0;j<before.siblings.length;j++){var s=before.siblings[j];if(!s.node.isConnected||!visible(s.node))continue;var nr=rect(s.node);if(Math.abs(nr.x-s.rect.x)>2||Math.abs(nr.y-s.rect.y)>2)return '다른 문구나 이미지가 밀려 적용하지 않았습니다. 글자 크기를 줄여 주세요.';var ni=s.node.hasAttribute('data-copy')?ink(s.node):[nr];if(!s.overlap&&current.some(function(a){return ni.some(function(b){return intersects(a,b);});}))return '다른 문구나 이미지와 겹칩니다. 크기를 줄이거나 줄 위치를 바꿔 주세요.';}
  if(el.clientWidth>0&&el.scrollWidth-el.clientWidth>Math.max(2,before.overflow+1))return '글자가 가로 공간을 넘습니다. 크기를 줄여 주세요.';return null;
 }
 function apply(el,fmt){
  clear(el);if(!fmt||F.isDefault(fmt))return;
  var cs=win.getComputedStyle(el),r=rect(el),rootFont=parseFloat(cs.fontSize),rootLine=parseFloat(cs.lineHeight),minW=parseFloat(cs.minWidth)||0,minH=parseFloat(cs.minHeight)||0,display=cs.display,boxW=r.w,boxH=r.h;
  states.set(el,snapshotStyle(el,props));
  var m=logical(el),tokens=m.nodes.map(function(t){var c=win.getComputedStyle(t.node.parentElement);return{node:t.node,start:t.start,end:t.end,font:parseFloat(c.fontSize),line:parseFloat(c.lineHeight)};});
  if(cs.boxSizing!=='border-box'){['paddingLeft','paddingRight','borderLeftWidth','borderRightWidth'].forEach(function(p){boxW-=parseFloat(cs[p])||0;});['paddingTop','paddingBottom','borderTopWidth','borderBottomWidth'].forEach(function(p){boxH-=parseFloat(cs[p])||0;});}
  if(boxH>0)el.style.setProperty('min-height',Math.max(boxH,minH)+'px');if(boxW>0&&/^(inline|flex)/.test(display))el.style.setProperty('min-width',Math.max(boxW,minW)+'px');
  el.style.setProperty('font-size',(rootFont*fmt.scale/100)+'px','important');if(Number.isFinite(rootLine))el.style.setProperty('line-height',(rootLine*fmt.scale/100)+'px','important');
  if(fmt.manual){el.setAttribute('data-bb-manual','true');[el].concat(Array.from(el.querySelectorAll('*'))).forEach(function(n){var ps=['white-space'];if(n!==el)ps.push('display');var d=win.getComputedStyle(n).display;n.setAttribute('data-bb-original-flow',JSON.stringify(snapshotStyle(n,ps)));n.style.setProperty('white-space','normal','important');if(n!==el&&n.tagName==='BR')n.style.setProperty('display','none','important');else if(n!==el&&(n.classList.contains('bb-gap')||/^(block|flex|grid|table|list-item|flow-root)/.test(d)))n.style.setProperty('display','inline','important');});}
  tokens.forEach(function(t){if(!t.node.parentNode||!t.node.nodeValue.trim())return;var cuts=[t.start,t.end];fmt.ranges.forEach(function(a){if(a[0]>t.start&&a[0]<t.end)cuts.push(a[0]);if(a[1]>t.start&&a[1]<t.end)cuts.push(a[1]);});cuts=Array.from(new Set(cuts)).sort(function(a,b){return a-b;});var frag=doc.createDocumentFragment();for(var i=0;i<cuts.length-1;i++){var a=cuts[i],b=cuts[i+1],p=scaleAt(fmt,a),s=doc.createElement('span');s.setAttribute('data-bb-font','');s.setAttribute('data-bb-scale',String(p));s.style.fontSize=(t.font*p/100)+'px';if(Number.isFinite(t.line))s.style.lineHeight=(t.line*p/100)+'px';s.textContent=t.node.nodeValue.slice(a-t.start,b-t.start);frag.appendChild(s);}t.node.replaceWith(frag);});
  if(fmt.manual)fmt.breaks.slice().reverse().forEach(function(pos){var list=logical(el).nodes,target=list.find(function(t){return pos>=t.start&&pos<=t.end;}),br=doc.createElement('br');br.setAttribute('data-bb-line','');if(target){var rr=doc.createRange();rr.setStart(target.node,Math.min(target.node.length,pos-target.start));rr.collapse(true);rr.insertNode(br);}else el.appendChild(br);if(pos===m.value.length){var caret=doc.createElement('span');caret.setAttribute('data-bb-caret','');caret.textContent='\u200b';br.after(caret);}});
  el.setAttribute('data-bb-formatted','true');
 }
 function extract(el,old){var m=logical(el),fmt=F.empty(m.value);fmt.scale=old.scale;fmt.manual=old.manual;fmt.breaks=m.brs.map(function(b){return b.at;}).filter(function(n,i,a){return a.indexOf(n)===i;});m.nodes.forEach(function(t){var n=t.node.parentElement.closest('[data-bb-scale]'),pct=n?Number(n.getAttribute('data-bb-scale')):fmt.scale;if(pct===fmt.scale||t.start===t.end)return;var z=fmt.ranges[fmt.ranges.length-1];if(z&&z[1]===t.start&&z[2]===pct)z[1]=t.end;else fmt.ranges.push([t.start,t.end,pct]);});return{value:m.value,format:fmt};}
 function slot(el){var cached=el.getAttribute('data-bb-slot');if(F.validSlot(cached))return cached;var box=el.closest('[data-card],[data-app-asset]'),stem='root';if(box){var n=box.getAttribute('data-card'),asset=box.getAttribute('data-app-asset');if(/^[0-9]{1,2}$/.test(n||''))stem='c'+n+(box.getAttribute('data-variant')==='b'?'b':'a')+'p'+(box.getAttribute('data-part')||'1');else if(/^(thumb|card|detail)$/.test(asset||''))stem='app'+asset;}var peers=Array.from(o.all()).filter(function(e){return o.keyOf(e)===o.keyOf(el)&&e.closest('[data-card],[data-app-asset]')===box;}),s=stem+'n'+(peers.indexOf(el)+1);if(!F.validSlot(s))throw new Error('문구 구간을 확인할 수 없습니다.');el.setAttribute('data-bb-slot',s);return s;}
 function saved(el){var k=o.keyOf(el),v=String(o.raw(k)||''),own=k+'__'+slot(el);return F.normalize(Object.prototype.hasOwnProperty.call(formats,own)?formats[own]:formats[k],v)||F.empty(v);}
 function flush(){Array.from(o.all()).forEach(function(el){if(o.holds(el)||!visible(el))return;var f=saved(el);if(F.isDefault(f))return;var before=measure(el);apply(el,f);var error=check(el,before);if(error){clear(el);el.setAttribute('data-bb-format-warning',error);}else el.removeAttribute('data-bb-format-warning');});doc.documentElement.setAttribute('data-format-ready','true');}
 function sync(){Array.from(o.all()).forEach(function(el){if(!o.holds(el))clear(el);});doc.documentElement.setAttribute('data-format-ready','false');if(raf)win.cancelAnimationFrame(raf);raf=win.requestAnimationFrame(function(){raf=win.requestAnimationFrame(function(){raf=0;flush();});});}
 win.addEventListener('message',function(e){if(e.source!==win.parent||e.origin!==win.location.origin||!e.data)return;if(e.data.type==='aptos-data')formats=e.data.formats&&e.data.formats[scope]||{};else if(e.data.type==='aptos-format-refresh')sync();});
 win.addEventListener('resize',sync);if(doc.fonts)doc.fonts.ready.then(sync);
 return{scope:scope,slot:slot,sync:sync,saved:saved,apply:apply,clear:clear,selection:selection,select:select,extract:extract,measure:measure,check:check,structuralBreaks:structuralBreaks,rangeSize:rangeSize,scaleAt:scaleAt,visible:visible};
}
global.BBInlineFormat={create:create};
})(typeof window!=='undefined'?window:this);
