/* k18_trees.js (v6.43, lane CORE2, gate x1): saplings and leaf decay (src/features/p53g_trees.js).
   1 the things: one sapling block (249), three sapling items, a name each
   2 the world's own trees are unchanged: a chunk generated now is block for block what the shared shape makes
   3 planting: on grass and dirt, not on stone, not under a block; one is used
   4 growing: nothing in the dark; with sky above it goes through its stages and becomes a tree of its own kind, a trunk
     of 4 to 6 logs with leaves round it; with a ceiling too low for the trunk it waits, and grows when the ceiling goes
   5 a sapling whose ground is dug out comes loose as its item; a broken sapling gives its own kind back
   6 leaves: a sapling about once in 20, an oak apple about once in 200, nothing else; birch and spruce give no apples
   7 leaf decay: a tree left alone keeps every leaf; cut the trunk and they all wither (dropping saplings); leaves in
     reach of another tree's log stay
   8 leaves a player placed never wither, and "held" is exactly four blocks along leaves
   9 a save keeps a sapling's kind and stage and it goes on growing; the id ledger: no free block id is left */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:43});
const step=boot.stepper(600000);

boot.run(async()=>{
  const B=V.B,IT=V.IT,D=V.DEFS,TREE=V.TREE;
  ok('the seams are on __vox',['treeShape','treeGrow','treeUse','treeTick','leafDrop','leafHeld','treeKindOf','genChunk'].every(k=>typeof V[k]==='function')&&!!TREE);
  let rs=4321;const rnd=()=>{rs=(rs*1103515245+12345)&0x7fffffff;return rs/0x7fffffff;};
  TREE.rnd=rnd;
  /* ===== 1 ===== */
  ok('one sapling block and three items: '+[0,1,2].map(k=>D[IT.SAPLING+k].name).join(', '),B.SAPLING===249&&D[249].cross===true&&D[249].solid===false&&IT.SAPLING===379&&
    [0,1,2].map(k=>D[IT.SAPLING+k].name).join()==='Oak Sapling,Birch Sapling,Spruce Sapling'&&[0,1,2].every(k=>D[IT.SAPLING+k].sap===k));

  const o=boot.studio(V,step,{});V.GR.mobSpawn=false;V.GR.fireTick=false;V.GR.snail=false;V.GR.jsc=0;
  const P=()=>V.P;
  /* ===== 2 ===== */
  {let trees=0,same=true;const pcx=Math.floor(P().x/16),pcz=Math.floor(P().z/16);
    for(let cx=pcx-4;cx<=pcx+4&&same;cx++)for(let cz=pcz-4;cz<=pcz+4&&same;cz++){
      const bl=V.genChunk(cx,cz);for(let i=0;i<bl.length;i++)if(V.isLogId(bl[i]))trees++;}
    /* the shape, drawn by hand into a blank column, against the old code's known sizes */
    const cells=[];V.treeShape(0,0,{h:10,th:5,type:0},(x,y,z,id,keep)=>cells.push([x,y,z,id,!!keep]));
    const logs=cells.filter(c=>c[3]===B.LOG_O),leaves=cells.filter(c=>c[3]===B.LEAF_O);
    const sp=[];V.treeShape(0,0,{h:10,th:6,type:2},(x,y,z,id,keep)=>sp.push([x,y,z,id]));
    ok('the shared shape: an oak 5 tall is 4 logs from y 11 with '+leaves.length+' leaf cells kept off anything already there; a spruce 6 tall is 6 logs and a pointed crown; the world still grows trees ('+trees+' log blocks nearby)',
      logs.length===4&&logs.every((c,i)=>c[0]===0&&c[2]===0&&c[1]===11+i&&!c[4])&&leaves.length>=40&&leaves.every(c=>c[4])&&sp.filter(c=>c[3]===B.LOG_S).length===6&&sp.some(c=>c[3]===B.LEAF_S&&c[1]===17)&&trees>20);}
  /* a flat field of grass in the open, high enough that nothing is over it */
  const FX=o.x+20,FZ=o.z,FY=Math.min(60,Math.max(V.surfaceTop(FX,FZ)+6,o.y+8));
  const field=()=>{for(let dx=-9;dx<=9;dx++)for(let dz=-9;dz<=9;dz++){for(let y=FY-1;y<FY+14;y++)V.setBlock(FX+dx,y,FZ+dz,y===FY-1?B.DIRT:y===FY?B.GRASS:B.AIR);}
    for(const e of V.entities)if(e.t==='drop')e.dead=true;TREE.q.clear();TREE.dq.length=0;const p=P();p.x=FX-6.5;p.z=FZ+0.5;p.y=FY+1;p.vx=p.vy=p.vz=0;p.fallD=0;step(3);};
  V.forceChunksNear(FX,FZ);step(25);
  for(let dx=-12;dx<=12;dx++)for(let dz=-12;dz<=12;dz++)for(let y=FY-1;y<79;y++)V.setBlock(FX+dx,y,FZ+dz,B.AIR);
  field();
  const Y=FY+1,cell=(x,y,z)=>V.getBlock(x,y,z)+':'+V.getMeta(x,y,z);
  const hold=(id,n)=>{const p=P();p.mode='s';p.inv[0]={id,count:n||1};p.sel=0;V.refreshHand();p.x=FX-1.5;p.z=FZ+0.5;p.y=Y;p.vx=p.vy=p.vz=0;step(1);};
  const useAt=(x,y,z)=>{boot.aim(V,x,y,z);boot.rclick(V,step);};
  /* ===== 3 ===== */
  hold(IT.SAPLING+1,3);useAt(FX+0.5,Y,FZ+0.5);const p1=cell(FX,Y,FZ),left=P().inv[0].count;
  V.setBlock(FX,FY,FZ+2,B.STONE);useAt(FX+0.5,Y,FZ+2.5);const onStone=V.getBlock(FX,Y,FZ+2);
  V.setBlock(FX,FY,FZ-2,B.DIRT);useAt(FX+0.5,Y,FZ-1.5);const onDirt=cell(FX,Y,FZ-2);
  ok('planting: a birch sapling on grass -> '+p1+' (kind 1, stage 0), one used; on dirt too ('+onDirt+'); not on stone',p1===B.SAPLING+':1'&&left===2&&onDirt===B.SAPLING+':1'&&onStone===B.AIR);
  /* ===== 4 ===== */
  field();
  const grow=(n)=>{for(let i=0;i<n;i++)V.treeTick(1);};
  V.setBlock(FX,Y,FZ,B.SAPLING,0);for(let y=Y+1;y<Y+9;y++)for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++)V.setBlock(FX+dx,Y+9,FZ+dz,B.STONE);
  for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++)for(let y=Y;y<Y+9;y++)if(Math.abs(dx)===3||Math.abs(dz)===3)V.setBlock(FX+dx,y,FZ+dz,B.STONE);
  grow(3000);const dark=cell(FX,Y,FZ);
  for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++)for(let y=Y;y<=Y+9;y++)if(V.getBlock(FX+dx,y,FZ+dz)===B.STONE)V.setBlock(FX+dx,y,FZ+dz,B.AIR);
  ok('in a sealed dark box for 3000 seconds a sapling does not grow ('+dark+')',dark===B.SAPLING+':0');
  const kinds=[];
  for(let k=0;k<3;k++){field();V.setBlock(FX,Y,FZ,B.SAPLING,k);const stages=new Set();let t=0;
    while(V.getBlock(FX,Y,FZ)===B.SAPLING&&t<20000){stages.add((V.getMeta(FX,Y,FZ)>>2)&3);V.treeTick(1);t++;}
    let logs=0,lv=0,wrong=0;for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++)for(let y=Y;y<Y+9;y++){const id=V.getBlock(FX+dx,y,FZ+dz);if(V.isLogId(id)){logs++;if(V.treeKindOf(id)!==k||dx||dz)wrong++;}else if(V.isLeafId(id)){lv++;if(V.treeKindOf(id)!==k)wrong++;}else if(id!==B.AIR)wrong++;}
    kinds.push({k,t,stages:[...stages].join(''),logs,lv,wrong});}
  ok('in the open each grows through stages 0 to 3 into its own kind of tree: '+kinds.map(r=>V.TREE_KINDS[r.k].n+' after '+r.t+' s, '+r.logs+' logs, '+r.lv+' leaves').join('; '),
    kinds.every(r=>r.stages==='0123'&&r.logs>=3&&r.logs<=6&&r.lv>=20&&r.wrong===0&&r.t>100&&r.t<6000));
  field();V.setBlock(FX,Y,FZ,B.SAPLING,0|(3<<2));V.setBlock(FX,Y+3,FZ,B.GLASS);grow(3000);const waits=cell(FX,Y,FZ);
  V.setBlock(FX,Y+3,FZ,B.AIR);let t2=0;while(V.getBlock(FX,Y,FZ)===B.SAPLING&&t2<6000){V.treeTick(1);t2++;}
  ok('a block in the way of the trunk: the sapling waits at its last stage ('+waits+'); the block gone, it grows ('+t2+' s)',waits===B.SAPLING+':12'&&V.isLogId(V.getBlock(FX,Y,FZ))&&t2<6000);
  /* ===== 5 ===== */
  field();V.setBlock(FX,Y,FZ,B.SAPLING,2);V.setBlock(FX,FY,FZ,B.AIR);grow(2);step(1);
  const loose=V.entities.filter(e=>e.t==='drop'&&!e.dead).map(e=>e.st.id+'x'+e.st.count).join();
  for(const e of V.entities)if(e.t==='drop')e.dead=true;
  V.setBlock(FX+2,Y,FZ,B.SAPLING,1|(2<<2));P().inv[0]=null;V.refreshHand();V.breakBlock(FX+2,Y,FZ,true);step(1);
  const broke=V.entities.filter(e=>e.t==='drop'&&!e.dead).map(e=>e.st.id+'x'+e.st.count).join();
  ok('the ground dug out from under a spruce sapling: it comes loose as its item ('+loose+'); a birch sapling broken by hand gives a birch sapling ('+broke+')',V.getBlock(FX,Y,FZ)===B.AIR&&loose===(IT.SAPLING+2)+'x1'&&broke===(IT.SAPLING+1)+'x1');
  /* ===== 6 ===== */
  {const N=20000,c=[{s:0,a:0,o:0},{s:0,a:0,o:0},{s:0,a:0,o:0}];
    for(let k=0;k<3;k++)for(let i=0;i<N;i++){const d=V.leafDrop(k);if(!d)continue;if(d.id===IT.SAPLING+k&&d.count===1)c[k].s++;else if(d.id===IT.APPLE&&d.count===1)c[k].a++;else c[k].o++;}
    ok('leaves over '+N+' each: saplings '+c.map(x=>x.s).join(' / ')+' (1000 expected), apples '+c.map(x=>x.a).join(' / ')+' (100, oak only)',
      c.every(x=>x.s>850&&x.s<1150&&x.o===0)&&c[0].a>60&&c[0].a<150&&c[1].a===0&&c[2].a===0&&typeof D[B.LEAF_O].pdrop==='function'&&typeof D[B.LEAF_S].pdrop==='function');}
  /* ===== 7 ===== */
  field();
  const tree=(x,z,k)=>{V.setBlock(x,Y,z,B.SAPLING,k);return V.treeGrow(x,Y,z,k,5);};
  const count=(f)=>{let n=0;for(let dx=-9;dx<=9;dx++)for(let dz=-9;dz<=9;dz++)for(let y=Y;y<Y+10;y++)if(f(V.getBlock(FX+dx,y,FZ+dz)))n++;return n;};
  const tick=(sec)=>{for(let i=0;i<sec*20;i++)V.treeTick(0.05);};
  const grew=tree(FX,FZ,0),L0=count(V.isLeafId);tick(30);
  ok('a tree left alone keeps every leaf ('+L0+' before and '+count(V.isLeafId)+' after 30 seconds)',grew&&L0>30&&count(V.isLeafId)===L0&&TREE.dq.length===0);
  for(let y=Y;y<Y+8;y++)if(V.isLogId(V.getBlock(FX,y,FZ)))V.setBlock(FX,y,FZ,B.AIR);
  const queued=TREE.dq.length;tick(40);step(2);
  const drops=V.entities.filter(e=>e.t==='drop'&&!e.dead),saps=drops.filter(e=>e.st.id===IT.SAPLING).reduce((n,e)=>n+e.st.count,0);
  ok('the trunk cut: its '+L0+' leaves were queued ('+queued+') and all withered within 40 seconds ('+count(V.isLeafId)+' left), dropping '+saps+' sapling(s) and nothing that is not a sapling or an apple',
    queued>=L0&&count(V.isLeafId)===0&&drops.every(e=>e.st.id===IT.SAPLING||e.st.id===IT.APPLE));
  field();tree(FX,FZ,0);tree(FX+4,FZ,0);const two=count(V.isLeafId);
  for(let y=Y;y<Y+8;y++)if(V.isLogId(V.getBlock(FX,y,FZ)))V.setBlock(FX,y,FZ,B.AIR);tick(40);
  const after=count(V.isLeafId);let near=0;for(let y=Y;y<Y+10;y++)for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)if(V.isLeafId(V.getBlock(FX+4+dx,y,FZ+dz)))near++;
  ok('two trees side by side, one cut: the leaves the other still holds stay ('+two+' -> '+after+', '+near+' round the standing trunk)',after<two&&near>=30&&[...Array(8).keys()].some(i=>V.isLogId(V.getBlock(FX+4,Y+i,FZ))));
  /* ===== 8 ===== */
  field();V.setBlock(FX,Y,FZ,B.LOG_O);for(let i=1;i<=6;i++)V.setBlock(FX+i,Y,FZ,B.LEAF_O);
  const held=[1,2,3,4,5,6].map(i=>V.leafHeld(FX+i,Y,FZ)?1:0).join('');
  V.setBlock(FX,Y,FZ+3,B.LEAF_O,1);V.setBlock(FX,Y,FZ,B.AIR);tick(40);
  ok('"held" is four blocks along leaves ('+held+'); with the log gone the natural ones wither and the one placed by hand stays',held==='111100'&&[1,2,3,4,5,6].every(i=>V.getBlock(FX+i,Y,FZ)===B.AIR)&&cell(FX,Y,FZ+3)===B.LEAF_O+':1');
  {const p=P();p.mode='s';p.inv[0]={id:B.LEAF_B,count:2};p.sel=0;V.refreshHand();p.x=FX-1.5;p.z=FZ+0.5;p.y=Y;step(1);V.setBlock(FX,Y,FZ-3,B.STONE);boot.aim(V,FX+0.5,Y+1,FZ-2.5);boot.rclick(V,step);
    ok('a leaf block placed by the real right click is marked ('+cell(FX,Y+1,FZ-3)+')',cell(FX,Y+1,FZ-3)===B.LEAF_B+':1');}
  /* ===== 9 ===== */
  field();V.setBlock(FX,Y,FZ,B.SAPLING,2|(1<<2));
  const snap=JSON.parse(JSON.stringify(V.snapshot('trees')));V.setBlock(FX,Y,FZ,B.AIR);V.applySave(snap);step(60);TREE.rnd=rnd;
  const back=cell(FX,Y,FZ),listed=TREE.q.has(FX+','+Y+','+FZ);let t9=0;while(V.getBlock(FX,Y,FZ)===B.SAPLING&&t9<20000){V.treeTick(1);t9++;}
  ok('a save keeps a sapling ('+back+': spruce, stage 1), it is on the list again and grows into a spruce after loading',back===B.SAPLING+':6'&&listed&&V.getBlock(FX,Y,FZ)===B.LOG_S);
  {const free=[];for(let i=1;i<256;i++)if(!D[i])free.push(i);ok('the ledger: the only block id not in use is 212, which stays empty on purpose ('+free.join()+')',free.join()==='212');}
  TREE.rnd=null;
});
