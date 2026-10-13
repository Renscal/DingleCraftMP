/* u_chords.js (v6.27, lane UI, gate x1): two mouse buttons at once (src/ui/p06b_input.js: mbSync, ptrDown, ptrMove, ptrUp).
   A browser sends pointerdown for the first button only; the second, and the release of one of two, arrive as a
   pointermove or the last pointerup with a changed e.buttons. Headless: the real handlers, fed the event sequences a
   browser sends.
   1 one button: down sets it, up clears it
   2 hold right, then left (a pointermove with buttons 3): both held; release in either order
   3 hold left, tap right: the right button comes and goes, the left one stays
   4 nothing is set while paused, dead or in a window, and a button held through that stays unset until pressed again
   5 touch is ignored; an event with no e.buttons falls back to e.button
   6 in the game: a scoped rifle fires while aiming; a door toggles on every right click while W and sprint are held
     and while the left button is mining */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:27});
const step=boot.stepper(600000);

boot.run(async()=>{
  const B=V.B,MB=V.MB,GL={};
  ok('the seams are on __vox',['mbSync','ptrDown','ptrMove','ptrUp'].every(k=>typeof V[k]==='function'));
  const o=boot.studio(V,step,{});
  const P=()=>V.P;
  const ev=(buttons,button)=>({pointerType:'mouse',buttons,button,movementX:0,movementY:0,target:GL});
  const down=(b,btn)=>V.ptrDown(ev(b,btn),GL),move=b=>V.ptrMove(ev(b,-1),GL),up=(b,btn)=>V.ptrUp(ev(b,btn));
  const st=()=>(MB.l?'L':'-')+(MB.r?'R':'-');
  const reset=()=>{up(0,0);MB.l=MB.r=false;};
  /* the headless page has no pointer lock: play without it, as the game does where a lock is refused */
  V.setPLock(false);

  /* ===== 1 ===== */
  reset();down(1,0);const a1=st();up(0,0);const a2=st();down(2,2);const a3=st();up(0,2);
  ok('one button: left down/up, right down/up ('+[a1,a2,a3,st()].join(' ')+')',a1==='L-'&&a2==='--'&&a3==='-R'&&st()==='--');

  /* ===== 2 ===== */
  reset();down(2,2);move(3);const b1=st();move(2);const b2=st();up(0,2);const b3=st();
  ok('hold right, then left: both; left released first ('+[b1,b2,b3].join(' ')+')',b1==='LR'&&b2==='-R'&&b3==='--');
  reset();down(2,2);move(3);move(1);const b4=st();up(0,0);
  ok('  ... and right released first ('+b4+' '+st()+')',b4==='L-'&&st()==='--');

  /* ===== 3 ===== */
  reset();down(1,0);move(3);const c1=st();move(1);const c2=st();move(3);const c3=st();move(1);up(0,0);
  ok('hold left, tap right twice: the left one never drops ('+[c1,c2,c3,st()].join(' ')+')',c1==='LR'&&c2==='L-'&&c3==='LR'&&st()==='--');
  reset();down(1,0);move(1);move(1);
  ok('a move with nothing changed changes nothing',st()==='L-');

  /* ===== 4 ===== */
  reset();V.openModal('inv');down(1,0);move(3);const d1=st();V.closeModal(true);move(3);const d2=st();move(0);move(1);const d3=st();up(0,0);
  ok('in a window nothing is set, and buttons held through it stay unset until pressed again ('+[d1,d2,d3].join(' ')+')',d1==='--'&&d2==='--'&&d3==='L-');
  reset();down(1,0);MB.l=MB.r=false;move(1);const d4=st();move(3);const d5=st();up(0,0);
  ok('a button the game let go of (a panel opening) is not picked up again by a move ('+d4+' '+d5+')',d4==='--'&&d5==='-R');
  reset();

  /* ===== 5 ===== */
  V.ptrDown({pointerType:'touch',buttons:1,button:0},GL);const e1=st();
  V.ptrDown({pointerType:'mouse',button:0},GL);const e2=st();V.ptrUp({pointerType:'mouse',button:0});
  ok('touch is ignored; an event without e.buttons still works by e.button ('+e1+' '+e2+' '+st()+')',e1==='--'&&e2==='L-'&&st()==='--');

  /* ===== 6. in the game ===== */
  let gun=0;for(let i=200;i<220;i++)if(V.DEFS[i]&&V.DEFS[i].gun&&V.DEFS[i].gun.scope){gun=i;break;}const gd=V.DEFS[gun];
  if(gd&&gd.gun&&gd.gun.scope){
    reset();P().mode='c';boot.give(V,gun,0);boot.aim(V,o.x+4.5,o.y+1.5,o.z+0.5);step(3);
    const shots=()=>V.entities.filter(e=>!e.dead&&(e.t==='bullet'||e.t==='proj'||e.bullet)).length+(V.getShotsFired?V.getShotsFired():0);
    down(2,2);step(20);const aimed=P().aimT>0.9,useBefore=P().useT;
    move(3);step(2);const fired=P().useT>useBefore||P().useT>0.3;
    ok('a scoped rifle: right held scopes in ('+(P().aimT||0).toFixed(2)+'), then left fires with the scope still up',aimed&&fired&&MB.r&&P().aimT>0.9);
    move(2);up(0,2);step(30);P().mode='s';
  }else ok('a scoped rifle exists to test with',false);

  reset();for(let i=0;i<9;i++)P().inv[i]=null;V.refreshHand();
  const dx=o.x+2,dy=o.y,dz=o.z;
  const door=()=>{V.setBlock(dx,dy,dz,V.doorId(false,0,0));V.setBlock(dx,dy+1,dz,V.doorId(false,1,0));};door();step(3);
  const isOpen=()=>{const d=V.DEFS[V.getBlock(dx,dy,dz)];return !!(d&&d.door&&d.door.open);};
  const face=()=>boot.aim(V,dx+0.5,dy+1.2,dz+0.5);
  let good=0;const hold=()=>{P().x=o.x+0.5;P().z=o.z+0.5;P().vx=P().vz=0;};
  V.KEY.KeyW=true;V.KEY.ControlLeft=true;
  for(let i=0;i<8;i++){hold();face();const was=isOpen();down(2,2);step(1);up(0,2);step(3);if(isOpen()!==was)good++;}
  V.KEY.KeyW=false;V.KEY.ControlLeft=false;
  ok('a door toggles on every right click while W and sprint are held ('+good+'/8)',good===8);
  good=0;down(1,0);
  for(let i=0;i<6;i++){hold();face();door();move(3);step(1);if(isOpen())good++;move(1);step(2);}   /* the left button is mining the door meanwhile: it is stood up again each round */
  up(0,0);
  ok('  ... and opens on every right tap while the left button is held down ('+good+'/6)',good===6);
  /* what does refuse: closing a door you are standing in (toggleDoor will not shut a solid block on Dan) */
  reset();door();V.toggleDoor(dx,dy,dz);const wasOpen=isOpen();P().x=dx+0.5;P().z=dz+0.5;P().y=dy;V.toggleDoor(dx,dy,dz);const stuck=isOpen();P().x=o.x+0.5;P().z=o.z+0.5;V.toggleDoor(dx,dy,dz);
  ok('an open door will not close on the player standing in its doorway, and closes once he is out',wasOpen&&stuck&&!isOpen());
});
