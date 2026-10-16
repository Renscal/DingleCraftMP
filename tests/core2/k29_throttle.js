/* k29_throttle.js (v6.66, lane CORE2, gate x1): the plane's throttle (e.thr in src/features/p51_prop_plane.js) and its
   gauge on the right of the screen (tickThrottleHud, #thrhud).
   1 Space opens the throttle, empty to full in about 2 s; let go at full, the plane still flies at about 28 ten seconds
     on (before 6.66 it slowed down whenever Space was let go)
   2 Alt closes it and brakes while held; let go at about half, the throttle stays there and the speed settles at
     throttle x 28; with nobody aboard it closes
   3 hitting the ground: a plane falling onto flat ground loses half its speed and half its throttle on touchdown; one
     taxiing on the ground keeps its throttle; flying into a wall halves it too
   4 the gauge: hidden on foot, shown in a plane, its fill as tall as the throttle (red at full), hidden on getting off
   5 the html: the gauge is in the HUD and scales with it, the Controls row explains the throttle */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const fs=require('fs');
const V=boot({seed:66});
const step=boot.stepper(700000);
const HH=fs.readFileSync(boot.BUILD+'head.html','utf8');

boot.run(async()=>{
  ok('the seams are on __vox',['spawnPlane','tickThrottleHud','forceChunksNear','surfaceTop'].every(k=>typeof V[k]==='function'));
  V.startNewWorld('k29','1337','s');V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;step(160);
  V.GR.god=true;
  const KEY=V.KEY,keys=o=>{for(const k of ['Space','KeyW','KeyS','KeyA','KeyD','AltLeft'])KEY[k]=!!(o&&o[k]);};
  const plane=(x,y,z)=>{V.spawnPlane(x,y,z,0);return V.entities.filter(e=>e.t==='plane'&&!e.dead).pop();};
  const off=e=>{V.P.ride=null;keys();step(2);e.dead=true;if(V.removeEnt)V.removeEnt(e);step(1);};
  const el=document.getElementById('thrhud'),fill=document.getElementById('thrfill');
  const P=V.P;

  /* ===== 1. the throttle stays open ===== */
  ok('on foot the gauge is not shown',el.style.display!=='block');
  {const e=plane(P.x+2,Math.max(72,V.surfaceTop(Math.floor(P.x),Math.floor(P.z))+30),P.z);V.P.ride=e;keys({Space:1});step(10);
   const t1=e.thr;step(50);
   ok('Space opens the throttle a little at a time ('+t1.toFixed(2)+' after 10 frames), full after about 2 s',t1>0.1&&t1<0.4&&e.thr===1);
   ok('in a plane the gauge is shown, as tall as the throttle and red at full',el.style.display==='block'&&fill.style.height==='100%'&&fill.className==='full');
   keys();step(100);const s1=e.spd;step(100);
   ok('let go at full: the throttle stays full and the plane keeps about 28 ('+s1.toFixed(1)+', then '+e.spd.toFixed(1)+')',e.thr===1&&s1>26&&e.spd>26);

  /* ===== 2. closing it ===== */
   const s0=e.spd;keys({AltLeft:1});step(20);
   ok('Alt closes the throttle and brakes while held ('+s0.toFixed(1)+' -> '+e.spd.toFixed(1)+', throttle '+e.thr.toFixed(2)+')',e.thr>0.3&&e.thr<0.7&&e.spd<s0-3);
   keys();const t2=e.thr;step(200);
   ok('let go at '+t2.toFixed(2)+': the throttle stays there and the speed settles at throttle x 28 ('+e.spd.toFixed(1)+' for '+(t2*28).toFixed(1)+')',e.thr===t2&&Math.abs(e.spd-t2*28)<1.5);
   ok('...and the gauge shows it ('+fill.style.height+')',fill.style.height===Math.round(t2*100)+'%'&&fill.className==='');
   V.P.ride=null;step(2);
   ok('with nobody aboard the throttle closes, and the gauge goes away',e.thr===0&&el.style.display==='none');
   off(e);}

  /* ===== 3. hitting the ground ===== */
  const px=Math.floor(P.x),pz=Math.floor(P.z);
  for(let dz=0;dz>=-60;dz-=16)V.forceChunksNear(P.x,P.z+dz);
  let top=0;for(let x=px-4;x<=px+4;x++)for(let z=pz-70;z<=pz+4;z++)top=Math.max(top,V.surfaceTop(x,z));
  const fy=top+1;                                            /* a flat floor above everything there: nothing stands over it */
  for(let x=px-4;x<=px+4;x++)for(let z=pz-70;z<=pz+4;z++)V.setBlock(x,fy,z,V.B.STONE);
  step(2);
  {const e=plane(px+0.5,fy+21,pz+0.5);V.P.ride=e;e.thr=1;e.spd=10;keys({Space:1,KeyW:1});   /* nose down: it dives into the floor */
   let before=null,after=null;
   for(let i=0;i<120&&!after;i++){const was={spd:e.spd,thr:e.thr,g:e.onGround,vy:e.vy};step(1);if(!was.g&&e.onGround){before=was;after={spd:e.spd,thr:e.thr};}}
   ok('a plane falling onto the ground touches down on the floor',!!after&&Math.abs(e.y-(fy+1))<0.01);
   ok('...and loses half its speed and half its throttle ('+(before?before.spd.toFixed(1)+' -> '+after.spd.toFixed(1)+', throttle '+before.thr.toFixed(2)+' -> '+after.thr.toFixed(2):'?')+')',
     !!after&&after.thr<=0.51&&after.spd<=before.spd*0.6);
   off(e);}
  {const e=plane(px+0.5,fy+1.2,pz+0.5);V.P.ride=e;keys();step(20);
   ok('a plane set down gently sits on the floor',e.onGround);
   e.thr=0.2;step(40);
   ok('taxiing on the ground keeps its throttle ('+e.thr+', speed '+e.spd.toFixed(1)+')',e.thr===0.2&&Math.abs(e.spd-5.6)<0.5&&e.onGround);
   off(e);}
  {for(let x=px-4;x<=px+4;x++)for(let y=fy+1;y<=fy+9;y++)V.setBlock(x,y,pz-40,V.B.STONE);step(2);
   const e=plane(px+0.5,fy+4,pz-20.5);V.P.ride=e;e.thr=0.8;e.spd=22;keys();
   let hit=null;
   for(let i=0;i<60&&!hit;i++){const sp=e.spd,t=e.thr;step(1);if(e.spd<sp*0.5)hit={sp,t,now:e.spd,thr:e.thr};}
   ok('flying into a wall halves the throttle ('+(hit?hit.t.toFixed(2)+' -> '+hit.thr.toFixed(2):'no hit')+')',!!hit&&hit.thr<=hit.t*0.5+0.01);
   off(e);}

  /* ===== 4 and 5. the html ===== */
  ok('the gauge is in the HUD, and scales with it',/<div id="thrhud"><div id="thrfill"><\/div><\/div>/.test(HH)&&/#armor,#thrhud,[^{]*\{zoom:var\(--uih\)\}/.test(HH)&&/#thrhud\{position:fixed;right:14px;top:50%/.test(HH));
  ok('the Controls row: Space throttle up, Alt brake and throttle down, and the throttle stays',/<kbd data-k="jump">Space<\/kbd> throttle up[^\n]*<kbd data-k="brake">Alt<\/kbd> brake and throttle down[^\n]*the throttle stays where you leave it/.test(HH));
});
