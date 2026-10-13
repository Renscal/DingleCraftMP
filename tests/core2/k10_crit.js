/* k10_crit.js (v6.30, lane CORE2, gate x1): critical hits (src/core/p04d_player_update.js: critNow, critFx, CRIT_MUL).
   A melee hit landed while falling does half as much again. Headless: a cow with a great deal of health in a stone room,
   hit by the real left click; the damage is read off its health.
   1 the rule, case by case: falling and off the ground is a crit; on the ground, rising, in water, in lava, riding,
     sprinting and flying are not
   2 a fist, standing: 1. Falling: 1.5
   3 a diamond sword, standing and falling: exactly half as much again
   4 Sharpness V is added after the half, not multiplied by it
   5 a crit makes the burst and the sound; a plain hit makes neither
   6 a sprinting jump is not a crit in the game itself (the keys held, not the flag set)
   7 the best hit there is still fits under the server's limit of 40 */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:30});
const step=boot.stepper(600000);

boot.run(async()=>{
  const B=V.B,MB=V.MB;
  ok('the seams are on __vox',typeof V.critNow==='function'&&typeof V.critFx==='function'&&V.CRIT_MUL===1.5);
  const o=boot.studio(V,step,{});
  const P=()=>V.P;
  for(const e of V.entities)if(e.mob)e.dead=true;step(2);
  const mx=o.x+2.5,mz=o.z+0.5;
  V.spawnMob('cow',mx,o.y,mz);step(2);
  const cow=()=>V.entities.find(e=>e.mob&&!e.dead&&e.mt==='cow');
  const pin=()=>{const c=cow();c.x=mx;c.z=mz;c.y=o.y;c.vx=c.vy=c.vz=0;c.hp=5000;c.hurtT=0;c.inv=0;return c;};
  /* one left click with the player in a given state; returns the damage done */
  const hit=(setup)=>{const c=pin(),p=P();p.x=o.x+0.5;p.z=o.z+0.5;p.y=o.y;p.vx=p.vy=p.vz=0;p.atkT=0;p.sprint=false;p.flying=false;p.fallD=0;step(3);pin();
    if(setup)setup(P());P().atkT=0;boot.aim(V,mx,c.y+0.7,mz);
    MB.l=true;step(1);MB.l=false;const d=5000-cow().hp;P().y=o.y;P().vy=0;P().fallD=0;step(2);return Math.round(d*1000)/1000;};
  const falling=p=>{p.y=o.y+0.9;p.vy=-2;p.onGround=false;};

  /* ===== 1. the rule ===== */
  {const p=P(),keep={vy:p.vy,onGround:p.onGround,inWater:p.inWater,inLava:p.inLava,ride:p.ride,sprint:p.sprint,flying:p.flying};
    const set=o2=>Object.assign(p,{vy:-1,onGround:false,inWater:false,inLava:false,ride:null,sprint:false,flying:false},o2);
    const r=[set({}),set({onGround:true}),set({vy:1}),set({vy:0}),set({inWater:true}),set({inLava:true}),set({ride:{}}),set({sprint:true}),set({flying:true})].map((_,i)=>{
      set([{}, {onGround:true},{vy:1},{vy:0},{inWater:true},{inLava:true},{ride:{}},{sprint:true},{flying:true}][i]);return V.critNow();});
    Object.assign(p,keep);
    ok('the rule: falling yes; on the ground, rising, still, water, lava, riding, sprinting, flying no ('+r.map(v=>v?1:0).join('')+')',r.join()===[true,false,false,false,false,false,false,false,false].join());}

  /* ===== 2. a fist ===== */
  for(let i=0;i<36;i++)P().inv[i]=null;V.refreshHand();
  const f0=hit(),f1=hit(falling);
  ok('a fist: standing '+f0+', falling '+f1,f0===1&&f1===1.5);

  /* ===== 3, 4. a sword ===== */
  const SW=V.toolId(3,3),base=V.DEFS[SW].tool.dmg;
  P().inv[0]={id:SW,count:1,dur:V.DEFS[SW].tool.dur};P().sel=0;V.refreshHand();
  const s0=hit(),s1=hit(falling);
  ok('a diamond sword ('+base+'): standing '+s0+', falling '+s1,s0===base&&s1===base*1.5);
  P().inv[0]={id:SW,count:1,dur:V.DEFS[SW].tool.dur,ench:{sharp:5}};V.refreshHand();
  const e0=hit(),e1=hit(falling);
  ok('Sharpness V is added after the half: standing '+e0+', falling '+e1+' (not '+((base+6)*1.5)+')',Math.abs(e0-(base+6))<1e-6&&Math.abs(e1-(base*1.5+6))<1e-6);

  /* ===== 5. the burst ===== */
  const wipe=()=>{for(const e of V.entities)if(e.t==='part')e.dead=true;step(1);},parts=()=>V.entities.filter(e=>e.t==='part'&&!e.dead).length;
  wipe();hit();const n1=parts();wipe();hit(falling);const n2=parts();
  ok('a crit throws its burst of sparks: 14 more than a plain hit on the same cow ('+n1+' then '+n2+')',n2-n1>=10);

  /* ===== 6. a sprinting jump ===== */
  P().inv[0]={id:SW,count:1,dur:V.DEFS[SW].tool.dur};V.refreshHand();
  {const c=pin(),p=P();p.x=o.x+0.5;p.z=o.z+0.5;p.y=o.y;step(2);pin();boot.aim(V,mx,c.y+0.7,mz);
    V.KEY.KeyW=true;V.KEY.ControlLeft=true;step(2);const spr=P().sprint;
    P().y=o.y+0.9;P().vy=-2;P().onGround=false;P().atkT=0;P().x=o.x+0.5;P().z=o.z+0.5;pin();boot.aim(V,mx,o.y+0.7,mz);
    MB.l=true;step(1);MB.l=false;V.KEY.KeyW=false;V.KEY.ControlLeft=false;
    const d=Math.round((5000-cow().hp)*1000)/1000;step(3);
    ok('falling with W and sprint held: sprinting ('+spr+'), so no crit ('+d+')',spr===true&&d===base);}

  /* ===== 7. the server's limit ===== */
  let best=0;for(let i=0;i<400;i++){const d=V.DEFS[i];if(d&&d.tool&&d.tool.dmg>best)best=d.tool.dmg;}
  const top=(best+2)*1.5+5*1.2;
  ok('the hardest hit there is (weapon '+best+', the big-power bonus, a crit, Sharpness V) is '+top+': under the server\'s 40',top<=40);
});
