/* k12_dims.js (v6.33, lane CORE2, gate x1): game rules that switch a dimension off (GR.nether, GR.aether, GR.puppet;
   src/world/p38_liquids_portals.js: dimOn, dimEvict; src/purgatory/p0_entry.js).
   1 the three rules exist, are on by default, are in the rules editor's list, and a save from before them loads with all on
   2 the Nether off: an obsidian frame does not light; with it on again the same frame lights
   3 a Nether portal that already stands does not carry Dan while the rule is off, and does when it is on
   4 the Aether off: a glowstone frame does not take the water; on again it does
   5 a player found inside a switched-off dimension is put back at his Overworld spawn (a rule turned off mid-visit, and a
     save that was made in there), without a scratch
   6 Purgatory off: the Stage Door does not come when its ten minutes are up, and the door of a world that already has one
     stays shut; on again the door comes and opens. What Purgatory remembers (MP) is kept through all of it
   7 the server lists the same three rules, on */
'use strict';
const path=require('path'),{pathToFileURL}=require('url');
const boot=require('../lib/c_boot.js'),{ok}=boot;
const {REPO}=require('../lib/paths.js');
const V=boot({seed:33});
const step=boot.stepper(600000);

boot.run(async()=>{
  const B=V.B,GR=V.GR;
  ok('the seams are on __vox',['dimOn','dimEvict','tryIgnitePortal','setDim','mpSetPlayT','mpEnter'].every(k=>typeof V[k]==='function'));
  /* ===== 1 ===== */
  const o=boot.studio(V,step,{});V.GR.god=true;
  const P=()=>V.P;
  ok('nether, aether and puppet are rules, on by default, and the Overworld cannot be switched off',
    GR.nether===true&&GR.aether===true&&GR.puppet===true&&V.dimOn('over')&&V.dimOn('nether')&&V.dimOn('aether')&&V.dimOn('puppet')&&(GR.over=false,V.dimOn('over'))&&delete GR.over);
  {const snap=V.snapshot('dims');const old=JSON.parse(JSON.stringify(snap));if(old.gr){delete old.gr.nether;delete old.gr.aether;delete old.gr.puppet;}
    GR.nether=false;V.applySave(old);
    ok('a save from before the rules loads with all three on',V.GR.nether===true&&V.GR.aether===true&&V.GR.puppet===true);}
  V.GR.god=true;V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;step(40);   /* the loaded world's chunks are built again */

  /* ===== 2, 4: frames ===== */
  const fx=o.x+3,fy=o.y,fz=o.z-3;
  const frame=(id)=>{for(let i=-1;i<=2;i++){V.setBlock(fx+i,fy-1,fz,id);V.setBlock(fx+i,fy+3,fz,id);}
    for(let j=0;j<3;j++){V.setBlock(fx-1,fy+j,fz,id);V.setBlock(fx+2,fy+j,fz,id);for(let i=0;i<2;i++)V.setBlock(fx+i,fy+j,fz,B.AIR);}};
  const lit=id=>{let n=0;for(let i=0;i<2;i++)for(let j=0;j<3;j++)if(V.getBlock(fx+i,fy+j,fz)===id)n++;return n;};
  frame(B.OBSIDIAN);V.GR.nether=false;const n0=V.tryIgnitePortal(fx,fy,fz,B.OBSIDIAN,B.PORTAL_N),l0=lit(B.PORTAL_N);
  V.GR.nether=true;const n1=V.tryIgnitePortal(fx,fy,fz,B.OBSIDIAN,B.PORTAL_N),l1=lit(B.PORTAL_N);
  ok('the Nether off: the frame does not light ('+n0+', '+l0+' portal blocks); on again: it does ('+n1+', '+l1+')',n0===false&&l0===0&&n1===true&&l1===6);

  /* ===== 3: the standing portal ===== */
  V.GR.nether=false;P().portalT=0;for(let i=0;i<50;i++){const p=P();p.x=fx+0.5;p.z=fz+0.5;p.y=fy;step(1);}
  const stayed=V.getDim();
  V.GR.nether=true;P().portalT=0;for(let i=0;i<60&&V.getDim()==='over';i++){const p=P();p.x=fx+0.5;p.z=fz+0.5;p.y=fy;step(1);}
  ok('a standing Nether portal: 2 seconds in it with the rule off leaves Dan in the '+stayed+'world; with it on he is in the '+V.getDim(),stayed==='over'&&V.getDim()==='nether');

  /* ===== 5: found inside ===== */
  step(10);P().hp=20;P().spawn=[o.x+0.5,o.y,o.z+0.5];
  const inside=V.snapshot('dims');
  V.GR.nether=false;step(3);
  ok('the rule goes off while he is in the Nether: back in the Overworld at his spawn, unhurt ('+V.getDim()+', '+P().hp+')',
    V.getDim()==='over'&&Math.abs(P().x-(o.x+0.5))<0.6&&Math.abs(P().z-(o.z+0.5))<0.6&&P().hp===20&&!P().dead);
  {const sv=JSON.parse(JSON.stringify(inside));sv.gr=Object.assign({},sv.gr,{nether:false});V.applySave(sv);const at=V.getDim();step(3);
    ok('a save made inside the Nether, loaded with the rule off: he wakes in the '+at+' for an instant and is put in the Overworld',V.getDim()==='over'&&!P().dead);}
  V.GR.god=true;V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;V.GR.nether=true;
  {const p=P();p.x=o.x+0.5;p.z=o.z+0.5;p.y=o.y;p.vx=p.vy=p.vz=0;step(25);}

  frame(B.GLOWSTONE);V.GR.aether=false;const a0=V.tryIgnitePortal(fx,fy,fz,B.GLOWSTONE,B.PORTAL_A),al0=lit(B.PORTAL_A);
  V.GR.aether=true;const a1=V.tryIgnitePortal(fx,fy,fz,B.GLOWSTONE,B.PORTAL_A),al1=lit(B.PORTAL_A);
  ok('the Aether off: the glowstone frame stays empty ('+a0+', '+al0+'); on again: the door opens ('+a1+', '+al1+')',a0===false&&al0===0&&a1===true&&al1===6);
  for(let i=0;i<2;i++)for(let j=0;j<3;j++)V.setBlock(fx+i,fy+j,fz,B.AIR);

  /* ===== 6: Purgatory ===== */
  const MP=()=>V.getMP?V.getMP():V.MP;
  if(!MP()){ok('the Purgatory state can be read',false);}
  else{
    const had=!!MP().door;
    V.GR.puppet=false;V.mpSetPlayT(600);step(20);const d0=!!MP().door;
    const e0=V.mpEnter({now:1}),dimE0=V.getDim(),d0b=!!MP().door;
    ok('Purgatory off: ten minutes are up and no Stage Door comes; asking to enter does nothing, and makes no door ('+[had,d0,e0,dimE0,d0b].join(',')+')',!had&&!d0&&e0===false&&dimE0==='over'&&!d0b);
    V.GR.puppet=true;step(20);const d1=!!MP().door,t1=MP().playT;
    ok('on again: the door that was due arrives (play time kept at '+Math.round(t1)+' s)',d1&&t1>=600);
    V.GR.puppet=false;const e1=V.mpEnter({}),e1b=V.mpEnter({now:1});
    ok('off again: the door that stands stays shut, and it is still there (kept in the save\'s Purgatory state)',e1===false&&e1b===false&&V.getDim()==='over'&&!!MP().door&&!!(V.snapshot('dims').mp||V.snapshot('dims').MP||JSON.stringify(V.snapshot('dims')).includes('"door"')));
    V.GR.puppet=true;
  }

  /* ===== 7 ===== */
  const cfg=await import(pathToFileURL(path.join(REPO,'server','lib','config.mjs')).href);
  ok('the server knows the three rules, on, and keeps a false through its rule cleaner',cfg.RULES.nether===true&&cfg.RULES.aether===true&&cfg.RULES.puppet===true&&cfg.cleanRules({nether:false,puppet:false,aether:'no'}).nether===false&&cfg.cleanRules({puppet:false}).puppet===false&&!('aether' in cfg.cleanRules({aether:'no'})));
});
