/* ----- inventory mouse controls (6.23): drags, the wheel, double-click, hotkeys over a slot ----- */
/* slotClick (p06d) is still the one-click primitive. This file is the hand around it: which button is down, where it went
   down, which slots it has been dragged over since. mkSlot sends it pointerdown and pointerenter; the window sends pointerup;
   the overlay sends the wheel and clicks that miss the window. Touch does not come through here.
     left click           as before: pick up, put down, swap, merge
     right click          as before: half, or one
     double left click    (holding a stack) gather every matching item in the window onto the cursor, part stacks first
     left drag, holding   over empty slots: the stack is shared out evenly over them, the rest stays on the cursor
                          starting on a slot of the same item: every such slot dragged over is pulled onto the cursor
                          (with Shift: each one is quick-moved instead)
     Shift + left drag    with an empty hand: every slot dragged over is quick-moved
     right drag, holding  one item into each slot entered (again each time it is entered)
     wheel over a stack   down: one item out to the other section; up: one matching item in from it
     1-9 over a slot      swap it with that hotbar slot
     Q / Ctrl+Q over      throw one / the stack (a throw: p05a's wait applies)
     click outside        holding a stack: left throws it all, right throws one
     middle click         in creative: a full stack of that item
   The rule for the two left drags is where the drag STARTS: on an empty slot it shares out, on a slot holding the cursor's
   item it gathers. A press that never leaves its slot is a plain click.
   Every move goes through a slot's own get and set, so a chest on a server syncs exactly as it does for clicks. */
const IM={wired:false,btn:-1,mode:null,start:null,hover:null,slots:[],snap:null,base:0,item:0,lastT:-9,lastS:null};

/* n of a stack as a stack of its own, with everything that makes it what it is (wear, enchantments, the mob in a jar) */
function stackPart(st,n){
  /* 6.40: a weapon's coat goes with it; the poisoned pieces of a food go along only with a copy of the whole stack (a
     part is a split: its caller says which way they went, psnSplit) */
  return {id:st.id,count:n,...(st.dur!=null?{dur:st.dur}:{}),...(st.ench?{ench:st.ench}:{}),...(st.mob?{mob:st.mob}:{}),...(st.pz?{pz:st.pz}:{}),...(st.psn>0&&n>=st.count?{psn:st.psn}:{})};
}
/* an ordinary slot: one that holds what is put in it (not a result, a palette entry, the trash or an armour slot) */
function imPlain(s){return !!s&&(s.kind==='n'||!s.kind);}
/* forget the drag (the window closed, or the button came up) */
function imReset(){IM.btn=-1;IM.mode=null;IM.start=null;IM.slots=[];IM.snap=null;IM.base=0;IM.item=0;}

/* ----- the pieces ----- */
/* pull a slot's matching items onto the cursor, up to a full stack */
function imPull(s){
  const st=s.get();
  if(!cursorStack||!st||!sameStack(cursorStack,st))return;
  const mv=Math.min(stackMax(st.id)-cursorStack.count,st.count);
  if(mv<=0)return;
  cursorStack.count+=mv;st.count-=mv;psnMoved(st,cursorStack,mv);s.set(st.count>0?st:null);
}
/* double-click: every matching item in the window, part stacks before full ones */
function imCollectAll(){
  if(!cursorStack)return;
  const mx=stackMax(cursorStack.id);
  for(const full of [false,true])for(const s of MODAL.slots){
    if(cursorStack.count>=mx)return;
    const st=imPlain(s)?s.get():null;
    if(st&&sameStack(cursorStack,st)&&(st.count>=mx)===full)imPull(s);
  }
}
/* may the cursor's stack go (in part) into this slot? */
function imFits(s){
  if(!imPlain(s)||!cursorStack)return false;
  const st=s.get();
  return !st||(sameStack(cursorStack,st)&&st.count<stackMax(st.id));
}
/* share the stack the drag started with evenly over the slots dragged across; the rest stays on the cursor. Done afresh
   from the slots as they were each time one is added, so what you see while dragging is what you get. */
function imShare(){
  const S=IM.slots,proto=IM.proto;
  for(let i=0;i<S.length;i++)S[i].set(IM.snap[i]?stackPart(IM.snap[i],IM.snap[i].count):null);
  let left=IM.base,bad=IM.psn|0;                           /* bad: the poisoned pieces still on the cursor (6.40) */
  const each=Math.floor(IM.base/S.length),mx=stackMax(proto.id);
  if(each>0)for(let i=0;i<S.length;i++){
    const was=IM.snap[i],put=Math.min(each,mx-(was?was.count:0));
    if(put<=0)continue;
    const into=stackPart(was||proto,(was?was.count:0)+put),k=psnDraw(left,bad,put);
    if(was&&was.psn>0)into.psn=was.psn;
    psnAdd(into,k);bad-=k;
    S[i].set(into);left-=put;
  }
  cursorStack=left>0?stackPart(proto,left):null;
  if(cursorStack&&bad>0)cursorStack.psn=bad;
}
/* one item of a slot to the other section (the wheel, down); the same place a Shift+click would send it */
function imMoveOne(s){
  const st=imPlain(s)?s.get():null;
  if(!st)return false;
  const one=stackPart(st,1),pk=st.count>1?psnDraw(st.count,st.psn|0,1):0;   /* a single piece is a whole copy: it has its poison already */
  if(pk)one.psn=1;
  let left=one;
  quickMove({get:()=>one,set:v=>{left=v;},home:s.home,idx:s.idx,kind:'n'});
  if(left)return false;
  st.count--;if(pk)psnAdd(st,-pk);s.set(st.count>0?st:null);
  return true;
}
/* is slot o in "the other section" from slot s? The open container against the player's inventory; with no container, the
   hotbar against the backpack */
function imOther(s,o){
  if(!imPlain(o)||o===s)return false;
  const cont=MODAL.kind==='chest'||MODAL.kind==='furnace';
  if(cont)return s.home==='inv'?o.home==='be':o.home==='inv';
  if(s.home!=='inv')return o.home==='inv';
  return o.home==='inv'&&(o.idx<9)!==(s.idx<9);
}
/* one matching item into a slot from the other section, looking from the last slot back (the wheel, up) */
function imPullOne(s){
  const st=imPlain(s)?s.get():null;
  if(!st||st.dur!=null||st.count>=stackMax(st.id))return false;
  for(let i=MODAL.slots.length-1;i>=0;i--){
    const o=MODAL.slots[i],ot=imOther(s,o)?o.get():null;
    if(!ot||!sameStack(st,ot))continue;
    ot.count--;st.count++;psnMoved(ot,st,1);              /* 6.40: the piece may be a poisoned one */
    o.set(ot.count>0?ot:null);s.set(st);
    return true;
  }
  return false;
}
/* throw n of a stack out of the window, the way Q throws from the hand */
function imThrow(st,n){
  const d=lookDir(),e=eyePos();
  DROP_BY=dropMe();
  const out=stackPart(st,n);
  if(n<st.count)psnSplit(st,out,n);
  try{spawnDrop(e[0]+d[0]*0.5,e[1]-0.3,e[2]+d[2]*0.5,out,d[0]*6,d[1]*6+2,d[2]*6);}finally{DROP_BY=null;}
}

/* ----- the mouse ----- */
/* a button went down on a slot (button 0 left, 1 middle, 2 right; t in seconds, for the double-click) */
function imDown(s,button,shift,t){
  IM.hover=s;imReset();
  if(button===1){
    const st=s.get();
    if(P.mode==='c'&&st&&s.kind!=='result'&&s.kind!=='trash')cursorStack=stackPart(st,stackMax(st.id));
    return;
  }
  if(!imPlain(s)){slotClick(s,button===2,shift);return;}
  const st=s.get();
  if(button===2){
    if(!cursorStack){slotClick(s,true,false);return;}
    slotClick(s,true,false);                               /* one in here now, and one in each slot entered from here on */
    IM.btn=2;IM.mode='rdrag';
    return;
  }
  if(!shift&&cursorStack&&IM.lastS===s&&t-IM.lastT<0.35){IM.lastT=-9;imCollectAll();return;}
  IM.lastT=t;IM.lastS=s;
  if(!cursorStack){
    if(shift){if(st)quickMove(s);IM.btn=0;IM.mode='shiftdrag';return;}
    slotClick(s,false,false);
    return;
  }
  /* holding a stack. On an empty slot, or one of the same item, the press may turn into a drag: nothing happens until the
     button comes up (a click) or the pointer enters another slot (a drag). Anything else is a plain swap, now. */
  if(!st||sameStack(cursorStack,st)){
    IM.btn=0;IM.start=s;IM.item=cursorStack.id;
    IM.mode=st?(shift?'pend-shift':'pend-gather'):'pend-share';
    return;
  }
  slotClick(s,false,shift);
}
/* the pointer entered a slot */
function imOver(s){
  IM.hover=s;
  if(IM.btn<0||!IM.mode)return;
  if(IM.mode==='rdrag'){if(cursorStack&&imFits(s))slotClick(s,true,false);return;}
  if(IM.mode==='shiftdrag'){if(imPlain(s)&&s.get())quickMove(s);return;}
  if(s===IM.start&&IM.mode.startsWith('pend'))return;
  if(IM.mode==='pend-gather'){IM.mode='gather';imPull(IM.start);}
  else if(IM.mode==='pend-shift'){IM.mode='shiftgather';quickMove(IM.start);}
  else if(IM.mode==='pend-share'){
    IM.mode='share';IM.proto=stackPart(cursorStack,1);delete IM.proto.psn;IM.psn=cursorStack.psn|0;IM.base=cursorStack.count;IM.slots=[IM.start];IM.snap=[null];
  }
  if(IM.mode==='gather'){imPull(s);return;}
  if(IM.mode==='shiftgather'){const st=imPlain(s)?s.get():null;if(st&&st.id===IM.item&&st.dur==null)quickMove(s);return;}
  if(IM.mode==='share'){
    if(IM.slots.indexOf(s)>=0||!imPlain(s))return;
    const st=s.get();
    if(st&&!(st.id===IM.proto.id&&st.dur==null&&IM.proto.dur==null&&st.count<stackMax(st.id)))return;
    IM.slots.push(s);IM.snap.push(st?stackPart(st,st.count):null);
    imShare();
  }
}
/* the button came up, anywhere. A press that never turned into a drag is the click it always was. */
function imUp(){
  const m=IM.mode,s=IM.start;
  imReset();
  if(m&&m.startsWith('pend')&&s&&MODAL.kind)slotClick(s,false,m==='pend-shift');
}
/* the wheel turned over a slot: down sends one out, up brings one in */
function imWheel(s,dy){
  if(!MODAL.kind||!imPlain(s)||cursorStack||!dy)return false;
  return dy>0?imMoveOne(s):imPullOne(s);
}
/* a click on the overlay, outside the window, holding a stack: left throws it all, right throws one */
function imOutside(button){
  if(!cursorStack||!MODAL.kind)return false;
  const n=button===2?1:cursorStack.count;
  imThrow(cursorStack,n);
  cursorStack.count-=n;if(cursorStack.count<=0)cursorStack=null;
  return true;
}
/* a key went down with the window open. true = it was for the slot under the pointer. */
function imKey(e){
  const s=IM.hover;
  if(!MODAL.kind||!s||MODAL.slots.indexOf(s)<0||!imPlain(s))return false;
  if(e.code&&e.code.startsWith('Digit')){
    const n=+e.code.slice(5);
    if(!(n>=1&&n<=9)||(s.home==='inv'&&s.idx===n-1))return false;
    const a=s.get()||null,b=P.inv[n-1]||null;
    s.set(b);P.inv[n-1]=a;redrawHotbar();
    return true;
  }
  if(e.code==='KeyQ'){
    const st=s.get();
    if(!st)return false;
    const n=(e.ctrlKey||KEY.ControlLeft)?st.count:1;
    imThrow(st,n);st.count-=n;s.set(st.count>0?st:null);redrawHotbar();
    return true;
  }
  return false;
}
/* wire the window-wide listeners, once (the first time a slot is made) */
function imWire(){
  if(IM.wired)return;
  IM.wired=true;
  addEventListener('pointerup',()=>{if(IM.btn>=0||IM.mode){imUp();if(MODAL.kind)redrawModal();}});
  const M=$('modal');
  if(!M||!M.addEventListener)return;
  M.addEventListener('wheel',ev=>{if(!MODAL.kind)return;ev.preventDefault();if(IM.hover&&imWheel(IM.hover,ev.deltaY))redrawModal();},{passive:false});
  M.addEventListener('pointerdown',ev=>{if(ev.target===M&&ev.pointerType!=='touch'&&imOutside(ev.button)){ev.preventDefault();redrawModal();}});
}
