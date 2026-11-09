/* Data-only typography: no HTML, colors or arbitrary CSS. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BBTextFormat=api;})(typeof self!=='undefined'?self:this,function(){
'use strict';
var SCOPES=['home','line','kakao','app'];
function signature(t){t=String(t);var h=2166136261;for(var i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777619);}return t.length+':'+(h>>>0).toString(16);}
function empty(t){return{v:1,base:signature(t),scale:100,ranges:[],breaks:[],manual:false};}
function boundary(t,n){return Number.isInteger(n)&&n>=0&&n<=t.length&&!(n>0&&n<t.length&&/[\uD800-\uDBFF]/.test(t[n-1])&&/[\uDC00-\uDFFF]/.test(t[n]));}
function percent(n){return Number.isInteger(n)&&n>=40&&n<=200;}
function normalize(x,t){
 if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(function(k){return ['v','base','scale','ranges','breaks','manual'].indexOf(k)<0;})||x.v!==1||x.base!==signature(t)||!percent(x.scale)||typeof x.manual!=='boolean'||!Array.isArray(x.ranges)||x.ranges.length>60||!Array.isArray(x.breaks)||x.breaks.length>40)return null;
 var out=empty(t),last=0;out.scale=x.scale;out.manual=x.manual;
 for(var i=0;i<x.ranges.length;i++){var r=x.ranges[i];if(!Array.isArray(r)||r.length!==3||!boundary(t,r[0])||!boundary(t,r[1])||r[0]>=r[1]||r[0]<last||!percent(r[2]))return null;last=r[1];if(r[2]===out.scale)continue;var prev=out.ranges[out.ranges.length-1];if(prev&&prev[1]===r[0]&&prev[2]===r[2])prev[1]=r[1];else out.ranges.push(r.slice());}
 last=-1;for(var j=0;j<x.breaks.length;j++){var n=x.breaks[j];if(!boundary(t,n)||n<=last||!x.manual)return null;last=n;out.breaks.push(n);}return out;
}
function encode(x,t){var n=normalize(x,t);if(!n)throw new Error('서식 값이 올바르지 않습니다.');var s=JSON.stringify(n);if(s.length>2000)throw new Error('부분 서식이 너무 많습니다. 일부를 기본 크기로 바꿔 주세요.');return s;}
function decode(v,t){if(typeof v!=='string'||!v||v.length>2000)return null;try{return normalize(JSON.parse(v),t);}catch(e){return null;}}
function validSlot(s){return typeof s==='string'&&/^(?:c\d{1,2}[ab]p\d{1,2}n\d{1,3}|app(?:thumb|card|detail)n\d{1,3}|rootn\d{1,3})$/.test(s);}
function key(field,scope,slot){if(SCOPES.indexOf(scope)<0||typeof field!=='string'||!/^[A-Za-z][A-Za-z0-9_-]*$/.test(field))throw new Error('알 수 없는 서식 대상입니다.');if(slot&&!validSlot(slot))throw new Error('알 수 없는 문구 구간입니다.');var k='fmt_'+scope+'_'+field+(slot?'__'+slot:'');if(k.length>64)throw new Error('서식 키가 너무 깁니다.');return k;}
function isDefault(x){return x.scale===100&&!x.ranges.length&&!x.manual&&!x.breaks.length;}
return{signature:signature,empty:empty,normalize:normalize,encode:encode,decode:decode,key:key,validSlot:validSlot,scopes:SCOPES.slice(),isDefault:isDefault,boundary:boundary};
});
