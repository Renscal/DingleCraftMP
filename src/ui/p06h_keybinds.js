/* ----- your own keys (6.56): rebinding, and the Controls screen's index and its Change keys page ----- */
/* Every key handler in the game asks for the DEFAULT key: KEY.KeyW is "forward", e.code==='KeyE' is "inventory". A new
   binding changes none of them. kbEv() is the door: the key you pressed comes in, the default key of the action bound to
   it goes out (a Proxy of the event with another code), and a default key whose action moved elsewhere goes nowhere.
   p06b's keydown and keyup and the replay listener pass through it. With every key at its default KB.map is null and
   kbEv hands back the very same event, so nothing changes for anyone who never opens the page.
   Not translated: typing (a text field, chat), the easel and DEEP DIRT 2D (their own keys), F3's own B and G.
   The side buttons of a mouse (4 and 5, "back" and "forward") never go back or forward: they are keys called Mouse4 and
   Mouse5, which any action can take; pressed, they are sent through the window as a keydown and a keyup of that code. */
const KB_ACTS=[   /* [id, group, label, default code] */
  ['fwd','Moving','Walk forward','KeyW'],['back','Moving','Walk backward','KeyS'],['left','Moving','Strafe left','KeyA'],
  ['right','Moving','Strafe right','KeyD'],['jump','Moving','Jump / swim / fly up / plane throttle','Space'],['sneak','Moving','Sneak / get off','ShiftLeft'],
  ['sprint','Moving','Sprint (and drop the whole stack)','ControlLeft'],
  ['inv','Inventory','Inventory','KeyE'],['drop','Inventory','Drop item','KeyQ'],['sort','Inventory','Sort inventory','KeyR'],
  ['hot1','Inventory','Hotbar slot 1','Digit1'],['hot2','Inventory','Hotbar slot 2','Digit2'],['hot3','Inventory','Hotbar slot 3','Digit3'],
  ['hot4','Inventory','Hotbar slot 4','Digit4'],['hot5','Inventory','Hotbar slot 5','Digit5'],['hot6','Inventory','Hotbar slot 6','Digit6'],
  ['hot7','Inventory','Hotbar slot 7','Digit7'],['hot8','Inventory','Hotbar slot 8','Digit8'],['hot9','Inventory','Hotbar slot 9','Digit9'],
  ['cam','Actions','Change camera','KeyF'],['powers','Actions','Powers menu','KeyP'],['laser','Actions','Laser Eyes (hold)','KeyL'],
  ['honk','Actions','Honk (in a car)','KeyH'],['brake','Actions','Plane brake','AltLeft'],
  ['chat','Screen & chat','Chat','KeyT'],['cmd','Screen & chat','Chat with a command','Slash'],['list','Screen & chat','Player list (hold)','Tab'],
  ['shot','Screen & chat','Screenshot','F2'],['replay','Screen & chat','Save a replay','F8']];
const KB_FIXED=['Escape','F3','Enter','NumpadEnter','MetaLeft','MetaRight','ContextMenu','OSLeft','OSRight'];
const KB={bind:{},map:null,down:{},cap:null,wired:false};
function kbDef(id){const a=KB_ACTS.find(a=>a[0]===id);return a?a[3]:'';}
function kbCode(id){return KB.bind[id]||kbDef(id);}
/* the key you press -> the default code it stands for ('' = nothing); null when every key is at home */
function kbRebuild(){
  const m={};let any=false;
  for(const a of KB_ACTS){const c=kbCode(a[0]);if(c!==a[3]){any=true;if(!(a[3] in m))m[a[3]]='';}}
  for(const a of KB_ACTS){const c=kbCode(a[0]);if(c!==a[3])m[c]=a[3];}
  KB.map=any?m:null;KB.down={};
}
/* translate only where the keys mean the game's actions */
function kbLive(e){
  if(KB.cap)return false;
  if(typeof chatOpen!=='undefined'&&chatOpen)return false;
  if(typeof crOn!=='undefined'&&crOn)return false;
  if(typeof terrOpen!=='undefined'&&terrOpen)return false;
  if(typeof DBG!=='undefined'&&DBG.held&&(e.code==='KeyB'||e.code==='KeyG'))return false;
  const t=e.target,tg=t&&t.tagName;
  if(tg==='INPUT'||tg==='TEXTAREA'||tg==='SELECT'||(t&&t.isContentEditable))return false;
  return true;
}
/* the door. up: a keyup, which goes where its keydown went */
function kbEv(e,up){
  if(KB.cap&&!up)return null;                 /* the Change keys page is listening for a key: it is nobody else's */
  if(!KB.map||!e)return e;
  const raw=e.code;let m;
  if(up&&Object.prototype.hasOwnProperty.call(KB.down,raw)){m=KB.down[raw];delete KB.down[raw];}
  else{m=kbLive(e)&&Object.prototype.hasOwnProperty.call(KB.map,raw)?KB.map[raw]:raw;if(!up)KB.down[raw]=m;}
  if(m===raw)return e;
  if(m==='')return null;
  return new Proxy(e,{get(t,p){if(p==='code')return m;const v=t[p];return typeof v==='function'?v.bind(t):v;}});
}
/* a code as a person reads it */
function kbName(c){
  if(!c)return '?';
  const N={Space:'Space',ShiftLeft:'Shift',ShiftRight:'Right Shift',ControlLeft:'Ctrl',ControlRight:'Right Ctrl',AltLeft:'Alt',AltRight:'Right Alt',
    ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Slash:'/',Backslash:'\\',Backquote:'`',Minus:'-',Equal:'=',BracketLeft:'[',
    BracketRight:']',Semicolon:';',Quote:'\'',Comma:',',Period:'.',CapsLock:'Caps Lock',Backspace:'Backspace',Tab:'Tab',Delete:'Delete',
    Insert:'Insert',Home:'Home',End:'End',PageUp:'Page Up',PageDown:'Page Down',IntlBackslash:'\\'};
  if(N[c])return N[c];
  if(/^Key[A-Z]$/.test(c))return c.slice(3);
  if(/^Digit\d$/.test(c))return c.slice(5);
  if(/^Numpad/.test(c))return 'Num '+c.slice(6);
  if(c==='Mouse4'||c==='Mouse5')return 'Mouse '+c.slice(5);
  return c;
}
/* bind one action; a key another action had swaps over to it */
function kbSet(id,code){
  if(!kbDef(id)||!code||KB_FIXED.includes(code))return false;
  const old=kbCode(id),o=KB_ACTS.find(a=>a[0]!==id&&kbCode(a[0])===code);
  if(o)KB.bind[o[0]]=old;
  KB.bind[id]=code;
  for(const a of KB_ACTS)if(KB.bind[a[0]]===a[3])delete KB.bind[a[0]];
  kbRebuild();for(const k in KEY)KEY[k]=false;
  return true;
}
function kbReset(){KB.bind={};kbRebuild();for(const k in KEY)KEY[k]=false;}
/* the settings file: only what differs, or nothing at all */
function kbSaveVal(){return Object.keys(KB.bind).length?{...KB.bind}:undefined;}
function kbLoad(o){
  KB.bind={};
  if(o&&typeof o==='object')for(const a of KB_ACTS){const c=o[a[0]];if(typeof c==='string'&&c&&c.length<=24&&!KB_FIXED.includes(c)&&c!==a[3])KB.bind[a[0]]=c;}
  const seen={};for(const a of KB_ACTS){const c=kbCode(a[0]);if(seen[c]){KB.bind={};break;}seen[c]=1;}   /* two actions on one key: a broken file, start over */
  kbRebuild();
}

/* ----- the Controls screen ----- */
function kbSec(sec){
  const h=$('help');if(!h||!h.querySelectorAll)return;
  for(const s of h.querySelectorAll('.hsec'))s.hidden=s.dataset.sec!==sec;
  for(const b of h.querySelectorAll('#h_idx .mc-btn'))b.classList.toggle('on',b.dataset.sec===sec);
  const bd=$('h_body');if(bd)bd.scrollTop=0;
  if(sec!=='keys')KB.cap=null;
  kbRender();
}
function kbRender(){
  const h=$('help');if(!h||!h.querySelectorAll)return;
  for(const k of h.querySelectorAll('kbd[data-k]'))k.textContent=kbName(kbCode(k.dataset.k));
  const box=$('h_binds');if(!box)return;
  let html='',g='';
  for(const a of KB_ACTS){
    if(a[1]!==g){g=a[1];html+='<div class="kbgrp">'+g.replace('&','&amp;')+'</div>';}
    const mod=kbCode(a[0])!==a[3],cap=KB.cap===a[0];
    html+='<div class="kbrow"><span>'+a[2]+'</span><button class="mc-btn'+(mod?' kbmod':'')+(cap?' kbcap':'')+'" data-kb="'+a[0]+'">'+
      (cap?'press a key…':kbName(kbCode(a[0])).replace('&','&amp;').replace('<','&lt;'))+'</button></div>';
  }
  box.innerHTML=html;
  for(const b of box.querySelectorAll('button[data-kb]'))b.onclick=()=>{KB.cap=KB.cap===b.dataset.kb?null:b.dataset.kb;playS('click');kbRender();};
}
/* once: the index, Reset, and the ear the Change keys page listens with */
function kbWire(){
  if(KB.wired)return;KB.wired=true;
  const h=$('help');
  if(h&&h.querySelectorAll)for(const b of h.querySelectorAll('#h_idx .mc-btn'))b.onclick=()=>{playS('click');kbSec(b.dataset.sec);};
  const r=$('h_reset');if(r)r.onclick=()=>{kbReset();KB.cap=null;saveSettings();playS('click');kbRender();showToast('Every key is back where it started');};
  if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('keydown',e=>{
    if(!KB.cap)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(e.code==='Escape'){KB.cap=null;kbRender();return;}
    if(KB_FIXED.includes(e.code)){showToast(kbName(e.code)+' stays where it is: pick another key');return;}
    const id=KB.cap;KB.cap=null;
    if(kbSet(id,e.code)){saveSettings();playS('click');}
    kbRender();
  },true);
}
function kbHelp(){kbWire();KB.cap=null;kbRender();}
/* mouse buttons 4 and 5: never the browser's back and forward; while the Change keys page listens, a key; otherwise, if
   an action has one, that action's key going down and up */
function kbMouse(e,up){
  const c=e&&(e.button===3?'Mouse4':e.button===4?'Mouse5':'');
  if(!c)return false;
  if(e.preventDefault)e.preventDefault();
  if(!up&&KB.cap){const id=KB.cap;KB.cap=null;if(kbSet(id,c)){saveSettings();playS('click');}kbRender();return true;}
  if(KB.map&&Object.prototype.hasOwnProperty.call(KB.map,c)&&typeof KeyboardEvent!=='undefined'&&typeof window!=='undefined'&&window.dispatchEvent)
    window.dispatchEvent(new KeyboardEvent(up?'keyup':'keydown',{code:c,key:'',bubbles:true}));
  return true;
}
if(typeof window!=='undefined'&&window.addEventListener){
  window.addEventListener('mousedown',e=>{kbMouse(e,false);},true);
  window.addEventListener('mouseup',e=>{kbMouse(e,true);},true);
  window.addEventListener('auxclick',e=>{if(e.button===3||e.button===4)e.preventDefault();},true);
}
