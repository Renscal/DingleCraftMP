/* stubs_K.js (6.56): only ADDS a record of the window's key listeners on top of the root stubs.js (never edit stubs.js), so a
   suite can press a key through the game's real handlers. K.press(code) / K.release(code) send one keydown / keyup through
   them in the browser's order (capture listeners first, then the rest, each in the order it was added) and stop where a
   listener calls stopImmediatePropagation. */
'use strict';
const L=[];
global.addEventListener=(type,f,cap)=>{if(type==='keydown'||type==='keyup')L.push({type,f,cap:!!(cap===true||(cap&&cap.capture))});};
function send(type,code,o){
  const e=Object.assign({code,key:'',repeat:false,target:null,ctrlKey:false,shiftKey:false,metaKey:false,altKey:false,
    pd:false,stopped:false,preventDefault(){this.pd=true;},stopPropagation(){},stopImmediatePropagation(){this.stopped=true;}},o||{});
  for(const l of [...L.filter(l=>l.type===type&&l.cap),...L.filter(l=>l.type===type&&!l.cap)]){l.f(e);if(e.stopped)break;}
  return e;
}
global.__K={listeners:L,press:(c,o)=>send('keydown',c,o),release:(c,o)=>send('keyup',c,o)};
module.exports={};
