/* k3_pickup.js (v6.21, lane CORE2, gate x1): what you throw, you wait for.
   Q used to hand the item straight back: any drop could be picked up after 0.55 s, the thrower's own included. Now an
   item a player throws on purpose (dropSel) cannot be picked up by that player for 2 seconds; everything else is as it was.
   Headless, a stepper smoke in a stone studio. Items are counted, not entities.
   1 a throw is marked with who threw it; a block's drop is not
   2 thrown at your own feet: still on the ground after 1.5 s, in the pocket again soon after 2 s; nothing made or lost
   3 Ctrl+Q throws the whole stack, the same way
   4 a drop nobody threw is picked up at about half a second, as before
   5 a throw by somebody else (another name) is picked up at about half a second too */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:11});
const step=boot.stepper(600000);

boot.run(async()=>{
  const B=V.B;
  ok('the seams are on __vox',typeof V.dropSel==='function'&&typeof V.dropMe==='function'&&V.DROP_WAIT===2&&V.dropMe()==='me');
  const S=boot.studio(V,step,{});
  const P=V.P;
  const drops=()=>V.entities.filter(e=>e.t==='drop'&&!e.dead);
  const inInv=id=>P.inv.reduce((n,s)=>n+(s&&s.id===id?s.count:0),0);
  const onFloor=id=>drops().reduce((n,e)=>n+(e.st.id===id?e.st.count:0),0);
  const total=id=>inInv(id)+onFloor(id);
  const clear=()=>{for(const e of drops())e.dead=true;for(let i=0;i<36;i++)P.inv[i]=null;step(2);};
  const down=()=>{P.pitch=-1.5;P.vx=P.vy=P.vz=0;};   /* looking straight down: the throw lands at the player's feet */
  const FR=n=>Math.round(n/0.04);

  /* ===== 1, 2. one item thrown at your own feet ===== */
  clear();P.inv[0]={id:B.STONE,count:5};P.sel=0;down();
  V.dropSel(false);
  {const e=drops()[0];
    ok('a throw is marked with its thrower and its wait',drops().length===1&&e.by==='me'&&e.byT===2&&inInv(B.STONE)===4&&total(B.STONE)===5);}
  step(FR(1.5));
  ok('1.5 seconds later it still lies at the thrower\'s feet, not picked up (it would have been back at 0.55 s before)',inInv(B.STONE)===4&&onFloor(B.STONE)===1&&Math.hypot(drops()[0].x-P.x,drops()[0].z-P.z)<1.5);
  step(FR(1.0));
  ok('soon after 2 seconds it is picked up again: five stone, nothing made or lost',inInv(B.STONE)===5&&onFloor(B.STONE)===0&&total(B.STONE)===5);

  /* ===== 3. the whole stack ===== */
  clear();P.inv[0]={id:B.DIRT,count:7};P.sel=0;down();
  V.dropSel(true);
  ok('Ctrl+Q throws the whole stack as one marked drop',P.inv[0]===null&&onFloor(B.DIRT)===7&&drops().every(e=>e.by==='me'));
  step(FR(1.5));ok('...which also waits',inInv(B.DIRT)===0&&onFloor(B.DIRT)===7);
  step(FR(1.0));ok('...and comes back whole',inInv(B.DIRT)===7&&onFloor(B.DIRT)===0);

  /* ===== 4. nobody threw it ===== */
  clear();V.spawnDrop(P.x,P.y+0.3,P.z,{id:B.GLASS,count:2},0,0,0);
  ok('a drop nobody threw (a broken block, a mob, a death) carries no thrower',drops().length===1&&drops()[0].by===undefined);
  step(FR(0.4));ok('...is not picked up before half a second',inInv(B.GLASS)===0);
  step(FR(0.5));ok('...and is by 0.9 s, as before',inInv(B.GLASS)===2&&onFloor(B.GLASS)===0);

  /* ===== 5. somebody else's throw ===== */
  clear();V.spawnDrop(P.x,P.y+0.3,P.z,{id:B.COBBLE,count:3},0,0,0);
  {const e=drops()[0];e.by='Bea';e.byT=2;}
  step(FR(0.9));
  ok('another player\'s throw is anybody else\'s to take at once',inInv(B.COBBLE)===3&&onFloor(B.COBBLE)===0);
});
