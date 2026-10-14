/* k23_laser.js (v6.52, lane CORE2, gate x1): Laser Eyes (src/features/p22_superpowers.js).
   1 the beam leaves from the eyes and points where the player looks, in every direction: 16 headings x 7 pitches, each
     beam's axis along the look within a hair, its start within half a block of the eyes, its far end where the look goes
   2 a keybind: hold L and it fires, whatever is in hand, standing or in mid-air; sneak + right-click no longer does
   3 other players see it: a beam is announced as a flying thing (kind beam) and another game draws the same beam, which
     melts nothing there and fades; the server passes the kind on */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const fs=require('fs'),path=require('path');
const {REPO}=require('../lib/paths.js');
const R3=require(path.join(REPO,'assets','vendor','three.r128.min.js'));   /* the real three.js, for the maths the stand-in does not do */
const V=boot({seed:52});
const step=boot.stepper(700000);

boot.run(async()=>{
  const B=V.B,T=global.THREE;
  ok('the seams are on __vox',typeof V.fireLaser==='function'&&typeof V.laserBeam==='function'&&!!T);
  /* what the game asks of a beam's mesh (where it is, what it looks at) is recorded, and the real three.js says where that points */
  {const L=T.Object3D.prototype.lookAt;T.Object3D.prototype.lookAt=function(x,y,z){this._at=[x,y,z];return L?L.call(this,x,y,z):this;};}
  const axis=m=>{const g=new R3.Group();g.position.set(m.position.x,m.position.y,m.position.z);if(m._at)g.lookAt(m._at[0],m._at[1],m._at[2]);g.updateMatrixWorld(true);const v=new R3.Vector3();g.getWorldDirection(v);return v;};
  const o=boot.studio(V,step,{});V.GR.mobSpawn=false;V.GR.god=true;V.GR.powers=true;
  const P=V.P;P.pow=P.pow||{u:{},a:{}};P.pow.u.laser=1;P.pow.a.laser=1;
  /* a big empty sky to shoot in: up high, so nothing is in the way */
  P.x=o.x+0.5;P.z=o.z+0.5;P.y=70;P.flying=true;P.mode='c';P.vx=P.vy=P.vz=0;step(3);
  const beams=()=>V.entities.filter(e=>e.t==='beam'&&!e.dead);
  const clear=()=>{for(const e of beams())e.dead=true;step(1);};

  /* ===== 1. every direction ===== */
  {clear();let worst=0,far=0,n=0,bad=[];
    for(let i=0;i<16;i++)for(const pitch of [-1.3,-0.8,-0.35,0,0.35,0.8,1.3]){
      P.yaw=i*Math.PI/8;P.pitch=pitch;const e0=V.eyePos(),d=V.lookDir();
      V.fireLaser();const b=beams().pop();if(!b){bad.push('none');continue;}
      const ax=axis(b.mesh);
      const dot=ax.x*d[0]+ax.y*d[1]+ax.z*d[2];
      const st=Math.hypot(b.x-e0[0],b.y-e0[1],b.z-e0[2]);
      const len=Math.hypot(b.vx,b.vy,b.vz),end=[b.x+b.vx,b.y+b.vy,b.z+b.vz],want=[e0[0]+d[0]*32,e0[1]+d[1]*32,e0[2]+d[2]*32];
      worst=Math.max(worst,1-dot);far=Math.max(far,st,Math.hypot(end[0]-want[0],end[1]-want[1],end[2]-want[2])>0.6?9:0);n++;
      if(dot<0.9999||st>0.5)bad.push(i+'/'+pitch);
      b.dead=true;}
    step(1);
    ok('112 directions (16 headings x 7 pitches): every beam points along the look ('+(worst*1e6).toFixed(2)+'e-6 off at worst), starts at the eyes (within '+far.toFixed(2)+' of them) and ends where the look goes'+(bad.length?' (wrong: '+bad.slice(0,6).join(' ')+')':''),
      n===112&&bad.length===0&&far<0.5);}

  /* ===== 2. a keybind ===== */
  {clear();P.yaw=0;P.pitch=0;boot.give(V,B.STONE,0);P.flying=false;P.mode='s';P.y=70;P.vy=0;
    V.KEY.KeyL=true;step(6);const air=beams().length;const inAir=!P.onGround;V.KEY.KeyL=false;step(10);
    ok('holding L fires the laser in mid-air with a block in hand ('+air+' beams while falling)',air>0&&inAir);
    clear();P.flying=true;P.mode='c';P.y=70;P.vy=0;step(2);
    P.inv[P.sel]=null;V.refreshHand();V.KEY.ShiftLeft=true;V.MB.r=true;step(8);V.MB.r=false;V.KEY.ShiftLeft=false;step(2);
    ok('sneak + right-click with an empty hand no longer fires it',beams().length===0);
    V.KEY.KeyL=true;step(4);const held=beams().length;V.KEY.KeyL=false;
    P.pow.a.laser=0;clear();V.KEY.KeyL=true;step(4);const off=beams().length;V.KEY.KeyL=false;P.pow.a.laser=1;
    ok('...L does ('+held+'), and only while the power is switched on ('+off+')',held>0&&off===0);
    const HH=fs.readFileSync(path.join(REPO,'build','head.html'),'utf8');
    ok('the Controls screen lists it',/Laser Eyes<\/b> <span>\(superpower\) hold <kbd data-k="laser">L<\/kbd>/.test(HH));}

  /* ===== 3. other players ===== */
  {clear();const NT=fs.readFileSync(path.join(REPO,'src','net','n9_ents.js'),'utf8'),PR=fs.readFileSync(path.join(REPO,'server','lib','protocol.mjs'),'utf8');
    ok('a beam is announced like anything that flies, and the server passes the kind on',/const NT_FX=\{[^}]*beam:1/.test(NT)&&/FX_KINDS = new Set\(\[[^\]]*'beam'/.test(PR));
    P.yaw=1.1;P.pitch=0.4;const e0=V.eyePos(),d=V.lookDir(),before=V.getBlock(Math.floor(e0[0]+d[0]*5),Math.floor(e0[1]+d[1]*5),Math.floor(e0[2]+d[2]*5));
    const N=V.NET,was={on:N.on,id:N.id};N.on=true;N.id=1;
    try{V.ntFxIn({t:'fx',f:[['2f9','beam',e0[0],e0[1],e0[2],d[0]*20,d[1]*20,d[2]*20,0,0.3]]});}finally{N.on=was.on;N.id=was.id;}
    const c=beams().find(e=>e.pup);
    let dir=null;if(c){const ax=axis(c.mesh);dir=ax.x*d[0]+ax.y*d[1]+ax.z*d[2];}
    ok('another player\'s beam is drawn here, from where they fired it and the way they looked',!!c&&Math.abs(c.x-e0[0])<1e-6&&dir>0.9999);
    step(30);
    ok('...it fades away by itself, and melts nothing here',!c||c.dead&&V.getBlock(Math.floor(e0[0]+d[0]*5),Math.floor(e0[1]+d[1]*5),Math.floor(e0[2]+d[2]*5))===before);}
});
