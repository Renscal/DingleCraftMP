/* k20_bullets.js (v6.47, lane CORE2, gate x1): bullets fly through what a bullet should (bulletPass in src/core/p04a_physics.js).
   A one-block-thick wall of the block under test stands 3 blocks in front of Dan; a bullet is fired level at it and run
   with updateBullet until it is gone or past the wall.
   1 the rule: leaves, doors (shut or open), water and Puppet Fleece pass; lava, glass, Bunker Glass and stone stop it
   2 the real bullet: through a leaf wall, a shut door and water it flies on; lava, glass and stone stop it
   3 another player's copy of the bullet (ntFxPup) agrees; an arrow's copy still sticks in leaves
   4 the Staple Gun's staple follows the bullet's rule: through leaves, stopped by lava */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:47});
const step=boot.stepper(600000);

boot.run(async()=>{
  const B=V.B;
  ok('the seams are on __vox',['bulletPass','spawnBullet','updateBullet','puSpawn','puUpdate','ntFxPup'].every(k=>typeof V[k]==='function'));
  const o=boot.studio(V,step,{});V.GR.god=true;
  const WX=o.x+3,Y=o.y,Z=o.z;
  const wall=id=>{for(let dz=-2;dz<=2;dz++)for(let dy=0;dy<=4;dy++)V.setBlock(WX,Y+dy,Z+dz,id);step(1);};
  const door=()=>{for(let dz=-2;dz<=2;dz++)for(let dy=0;dy<=4;dy++)V.setBlock(WX,Y+dy,Z+dz,dy<2?V.doorId?V.doorId(0,dy,0):43+dy*4:B.STONE);step(1);};

  /* ===== 1. the rule ===== */
  const P=V.bulletPass;
  ok('leaves pass (oak, birch, spruce)',P(B.LEAF_O)&&P(B.LEAF_B)&&P(B.LEAF_S));
  ok('doors pass, shut or open (all 16)',Array.from({length:16},(_,i)=>43+i).every(id=>P(id)));
  ok('water and air pass',P(B.WATER)&&P(B.AIR));
  ok('lava does not',!P(B.LAVA));
  ok('glass, Bunker Glass and stone do not',!P(B.GLASS)&&!P(B.BGLASS)&&!P(B.STONE));
  ok('Puppet Fleece and the Canopy Eye pass',P(B.PG_FLEECE)&&P(B.PG_EYE));

  /* ===== 2. the real bullet ===== */
  const fire=(vx)=>{V.spawnBullet(o.x+0.5,Y+1.5,Z+0.5,vx||60,0,0,0,0);const e=V.entities[V.entities.length-1];
    for(let i=0;i<40&&!e.dead&&e.x<WX+1.5;i++)V.updateBullet(e,0.02);const through=!e.dead&&e.x>=WX+1.5;if(!e.dead){e.age=99;V.updateBullet(e,0);}return through;};
  wall(B.LEAF_O);ok('a bullet flies through a leaf wall',fire());
  door();ok('...and through a shut door',fire());
  wall(B.WATER);ok('...and through water',fire());
  wall(B.LAVA);ok('lava stops it',!fire());
  wall(B.GLASS);ok('glass stops it',!fire());
  wall(B.STONE);ok('stone stops it',!fire());

  /* ===== 3. the copy ===== */
  const copy=(k,id)=>{wall(id);V.spawnBullet(o.x+0.5,Y+1.5,Z+0.5,10,0,0,0,0);const e=V.entities[V.entities.length-1];
    e.fxk=k;e.fxl=3;e.fxg=0;e.fxs=false;e.fxid='k20.'+k+id;
    for(let i=0;i<60&&!e.dead&&!e.fxs&&e.x<WX+1.5;i++)V.ntFxPup(e,0.02);
    const r={through:!e.dead&&!e.fxs&&e.x>=WX+1.5,stuck:!!e.fxs,gone:!!e.dead};if(!e.dead){e.fxl=0;V.ntFxPup(e,0);}return r;};
  ok('another player\'s copy of the bullet passes the leaves too',copy('blt',B.LEAF_O).through);
  ok('...and is stopped by lava like the real one',copy('blt',B.LAVA).gone);
  ok('an arrow\'s copy still sticks in leaves (arrows are unchanged)',copy('arrow',B.LEAF_O).stuck);

  /* ===== 4. the staple ===== */
  const staple=id=>{wall(id);const e=V.puSpawn('staple',o.x+0.5,Y+1.5,Z+0.5,25,0,0,'Dan',{src:null});if(!e)return null;e.g=0;
    for(let i=0;i<60&&!e.dead&&e.x<WX+1.5;i++)V.puUpdate(e,0.02);const through=!e.dead&&e.x>=WX+1.5;if(!e.dead){e.age=1e9;V.puUpdate(e,0);}return through;};
  {const a=staple(B.LEAF_O),b=staple(B.LAVA);
    ok('a staple flies through leaves'+(a===null?' [no staple projectile here]':''),a===true);
    ok('...and lava stops it',b===false);}
});
