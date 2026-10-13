/* k9_lava.js (v6.28, lane CORE2, gate x1): lava is not a solid.
   The ray that picks the block you look at went through water and stopped on lava, and a block could be placed into
   water and not into lava. Both now treat lava as they treat water. A stone table in the air, as in k7_liquids.
   1 the ray goes through a lava source and through flowing lava and hits the block behind, exactly as through water
   2 a block placed (by the real right click) into a lava source replaces it, leaves no level behind, and the lava that
     flowed from that source drains away
   3 placed into flowing lava: the same, and the lava runs round the new block
   4 a torch goes into lava under the rule it goes into water under
   5 sand over lava falls into it, as over water
   6 an empty bucket still fills from a lava source it looks at (it does not look through it) */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:28});
const step=boot.stepper(600000);

boot.run(async()=>{
  const B=V.B,IT=V.IT,LIQ=V.LIQ;
  V.startNewWorld('lava','1337','s');V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;V.GR.fireTick=false;V.GR.god=true;step(80);
  let P=V.P;
  const cx=Math.floor(P.x),cz=Math.floor(P.z),FY=Math.min(66,Math.floor(P.y)+14),Y=FY+1,R=8;
  const table=()=>{LIQ.w.clear();LIQ.l.clear();for(const e of V.entities)if(e.t==='drop'||e.t==='fall')e.dead=true;
    for(let x=-R-2;x<=R+2;x++)for(let z=-R-2;z<=R+2;z++)for(let y=FY-3;y<=Y+4;y++)V.setBlock(cx+x,y,cz+z,(y===FY&&Math.abs(x)<=R&&Math.abs(z)<=R)?B.STONE:B.AIR);
    LIQ.w.clear();LIQ.l.clear();P=V.P;P.mode='s';P.flying=false;P.x=cx+0.5;P.z=cz+0.5;P.y=Y;P.vx=P.vy=P.vz=0;P.fallD=0;P.hp=20;step(3);};
  const lvl=(x,z,y)=>{const id=V.getBlock(x,y===undefined?Y:y,z);return V.isLiq(id)?(V.getMeta(x,y===undefined?Y:y,z)&15):-1;};
  const count=id=>{let n=0;for(let x=-R-2;x<=R+2;x++)for(let z=-R-2;z<=R+2;z++)for(let y=FY-3;y<=Y+4;y++)if(V.getBlock(cx+x,y,cz+z)===id)n++;return n;};
  const ray=(x,y,z)=>{const e=[cx+0.5,Y+1.6,cz+0.5],dx=x-e[0],dy=y-e[1],dz=z-e[2],d=Math.hypot(dx,dy,dz);return V.raycastB(e[0],e[1],e[2],dx/d,dy/d,dz/d,d+2);};
  const place=(id,x,y,z)=>{P=V.P;P.inv[0]={id,count:4};P.sel=0;V.refreshHand();P.x=cx+0.5;P.z=cz+0.5;P.y=Y;P.vx=P.vy=P.vz=0;step(1);boot.aim(V,x,y,z);boot.rclick(V,step);};
  ok('the seams are on __vox',typeof V.raycastB==='function'&&typeof V.isLiq==='function'&&!!LIQ);

  /* ===== 1. the ray ===== */
  table();V.setBlock(cx+4,Y,cz,B.STONE);V.setBlock(cx+4,Y+1,cz,B.STONE);
  const clear=ray(cx+4,Y+0.5,cz+0.5);
  V.setBlock(cx+2,Y,cz,B.WATER);const viaW=ray(cx+4,Y+0.5,cz+0.5);V.setBlock(cx+2,Y,cz,B.AIR);LIQ.w.clear();
  V.setBlock(cx+2,Y,cz,B.LAVA);const viaL=ray(cx+4,Y+0.5,cz+0.5);
  V.setBlock(cx+2,Y,cz,B.LAVA,4);const viaF=ray(cx+4,Y+0.5,cz+0.5);
  const same=(a,b)=>!!a&&!!b&&a.x===b.x&&a.y===b.y&&a.z===b.z&&a.nx===b.nx&&a.ny===b.ny&&a.nz===b.nz&&a.id===b.id;
  ok('the ray goes through a lava source and through flowing lava to the stone behind, as it does through water',
    !!clear&&clear.id===B.STONE&&clear.x===cx+4&&same(clear,viaW)&&same(clear,viaL)&&same(clear,viaF));
  const down=V.raycastB(cx+2.5,Y+3,cz+0.5,0,-1,0,6);
  ok('  ... and straight down through it to the floor (stone at the table height, facing up)',!!down&&down.y===FY&&down.ny===1&&down.id===B.STONE);

  /* ===== 2. into a source ===== */
  table();V.setBlock(cx+2,Y,cz,B.LAVA);step(900);
  const spread=count(B.LAVA);
  place(B.COBBLE||B.STONE,cx+2.5,Y+0.3,cz+0.5);
  const put=V.getBlock(cx+2,Y,cz),meta=V.getMeta(cx+2,Y,cz);
  step(1500);
  ok('a block placed into a lava source replaces it, with no level left behind (lava before '+spread+', block '+put+', meta '+meta+')',
    spread>5&&put===(B.COBBLE||B.STONE)&&meta===0);
  ok('  ... and the lava that came from that source drains away ('+count(B.LAVA)+' left)',count(B.LAVA)===0);

  /* ===== 3. into flowing lava ===== */
  table();V.setBlock(cx+3,Y,cz,B.LAVA);step(900);
  const flowAt=lvl(cx+2,cz);
  place(B.COBBLE||B.STONE,cx+2.5,Y+0.3,cz+0.5);
  const put3=V.getBlock(cx+2,Y,cz),meta3=V.getMeta(cx+2,Y,cz);step(600);
  ok('placed into flowing lava (level '+flowAt+'): the block stands, meta 0, the source is still there and still flowing round it',
    flowAt>0&&put3===(B.COBBLE||B.STONE)&&meta3===0&&lvl(cx+3,cz)===0&&count(B.LAVA)>4);

  /* ===== 4. a torch ===== */
  table();V.setBlock(cx+2,Y,cz,B.WATER);place(B.TORCH,cx+2.5,Y+0.3,cz+0.5);const tW=V.getBlock(cx+2,Y,cz)===B.TORCH;
  table();V.setBlock(cx+2,Y,cz,B.LAVA);place(B.TORCH,cx+2.5,Y+0.3,cz+0.5);const tL=V.getBlock(cx+2,Y,cz)===B.TORCH;
  ok('a torch goes into lava under the rule it goes into water under (water: '+tW+', lava: '+tL+')',tW===tL);

  /* ===== 5. sand ===== */
  table();V.setBlock(cx+2,Y,cz,B.LAVA,7);V.setBlock(cx+2,Y+1,cz,B.SAND);step(40);
  ok('sand over lava falls into it and lands on the floor',V.getBlock(cx+2,Y,cz)===B.SAND&&V.getBlock(cx+2,Y+1,cz)===B.AIR);

  /* ===== 6. the bucket ===== */
  table();V.setBlock(cx+2,Y,cz,B.LAVA);P=V.P;P.inv[0]={id:IT.BUCKET,count:1};P.sel=0;V.refreshHand();step(1);boot.aim(V,cx+2.5,Y+0.5,cz+0.5);boot.rclick(V,step);
  ok('an empty bucket still fills from the lava source it looks at',V.P.inv[0]&&V.P.inv[0].id===IT.BUCKET_L&&V.getBlock(cx+2,Y,cz)!==B.LAVA);
});
