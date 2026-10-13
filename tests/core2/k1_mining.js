/* k1_mining.js (v6.19, lane CORE2, gate x1): the tool-swap exploit is closed.
   Mining used to keep its timer when the hotbar slot changed, so a block started with a pickaxe could be finished with an
   empty hand (no wear), or started by hand and finished with a borrowed pickaxe. Now a change of slot, or of the item
   held, starts the block over. Headless, a stepper smoke in a small stone studio.
   1 a full mine with no swap: the time breakTime says, and one point of wear
   2 swap to an empty slot at 90%: the block does not break at the old time, the pickaxe is not charged
   3 swap back: progress starts from 0, and the block then takes the pickaxe's full time
   4 swap to the same kind of pickaxe in another slot: still starts over (the slot counts)
   5 the pickaxe swapped out of the hand in place (same slot, other item): starts over too
   6 creative mode is untouched */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:7});
const step=boot.stepper(600000);

boot.run(async()=>{
  const B=V.B,MINE=V.MINE,PICK=V.toolId(2,0);
  ok('the seams are on __vox',!!MINE&&typeof V.breakTime==='function'&&'slot' in MINE&&'itemId' in MINE&&!!V.DEFS[PICK].tool);
  const S=boot.studio(V,step,{});
  const P=V.P,tx=S.x+2,ty=S.y+1,tz=S.z;
  const put=()=>{V.setBlock(tx,ty,tz,B.STONE);step(2);};
  const aim=()=>boot.aim(V,tx+0.5,ty+0.5,tz+0.5);
  const hold=n=>{aim();V.MB.l=true;step(n);};
  const up=()=>{V.MB.l=false;step(2);};
  const there=()=>V.getBlock(tx,ty,tz)===B.STONE;
  const pick=()=>({id:PICK,count:1,dur:100});
  const DT=0.04,need=V.breakTime(B.STONE,{id:PICK,count:1}),frames=Math.ceil(need/DT);
  for(let i=0;i<9;i++)P.inv[i]=null;

  /* ===== 1. no swap ===== */
  put();P.inv[0]=pick();P.sel=0;
  hold(frames-2);
  ok('a pickaxe on stone: not broken a moment before its time ('+need.toFixed(2)+' s)',there()&&MINE.active&&MINE.slot===0&&MINE.itemId===PICK);
  step(4);
  ok('...and broken at it, for one point of wear',!there()&&P.inv[0].dur===99);
  up();

  /* ===== 2. swap to an empty hand at 90% ===== */
  put();P.inv[0]=pick();P.inv[1]=null;P.sel=0;
  hold(Math.floor(frames*0.9));
  ok('most of the way through, not yet broken',there()&&MINE.prog/MINE.need>0.7&&MINE.prog/MINE.need<1);
  P.sel=1;step(1);
  ok('changing slot starts the block over, at once (the crack overlay reads the same numbers)',there()&&MINE.active&&MINE.prog<=DT+1e-9&&MINE.slot===1&&MINE.itemId===0&&MINE.need===V.breakTime(B.STONE,null));
  step(frames);
  ok('the block does not break at the pickaxe\'s old time, and the pickaxe has not been charged',there()&&P.inv[0].dur===100&&P.inv[1]===null);

  /* ===== 3. swap back ===== */
  P.sel=0;step(1);
  ok('swapping back starts from 0 again, on the pickaxe\'s timer',there()&&MINE.prog<=DT+1e-9&&MINE.slot===0&&MINE.itemId===PICK&&Math.abs(MINE.need-need)<1e-9);
  step(frames-4);
  ok('...so it takes the pickaxe\'s whole time from here',there());
  step(6);
  ok('...and then breaks, charged to the tool that did all of it',!there()&&P.inv[0].dur===99);
  up();

  /* ===== 4. the same kind of tool in another slot ===== */
  put();P.inv[0]=pick();P.inv[2]=pick();P.sel=0;
  hold(Math.floor(frames*0.9));P.sel=2;step(1);
  ok('another pickaxe of the same kind in another slot still starts over: the slot counts',there()&&MINE.prog<=DT+1e-9&&MINE.slot===2);
  step(3);
  ok('...so no borrowing the last tenth of a second',there()&&P.inv[0].dur===100&&P.inv[2].dur===100);
  up();

  /* ===== 5. the item changed under the same slot ===== */
  put();P.inv[0]=pick();P.sel=0;
  hold(Math.floor(frames*0.9));P.inv[0]={id:B.DIRT,count:1};step(1);
  ok('a different item in the same slot starts over too',there()&&MINE.prog<=DT+1e-9&&MINE.itemId===B.DIRT);
  up();

  /* ===== 6. creative ===== */
  put();P.inv[0]=pick();P.sel=0;P.mode='c';P.atkT=0;
  hold(2);
  ok('creative mode is untouched: the block is gone at once and nothing wears',!there()&&P.inv[0].dur===100);
  up();P.mode='s';
});
