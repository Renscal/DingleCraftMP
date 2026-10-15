/* k16_farm.js (v6.39, lane CORE2, gate x1): farming (src/features/p53e_farming.js). A stone room, a patch of dirt in it.
   1 the things exist: four blocks, the hoes, the can, seeds, wheat, bread, carrot, hemlock root; their recipes
   2 the hoe: grass and dirt become dry farmland, it wears by one, and it does nothing with a block above or on stone
   3 the watering can: empty when made; fills only from a water source, and the source stays; flowing water does not fill it
   4 watering: dry becomes watered with 5 harvests, one use is spent, watered ground takes no more, an empty can waters nothing
   5 water in the next block does not water farmland, however long it stands there
   6 planting: seeds, a carrot and a hemlock root each go onto farmland (not onto dirt), one is used, and a carrot aimed at
     farmland is planted while a carrot aimed at the sky is eaten
   7 growing: nothing on dry farmland; on watered farmland a crop is ripe in about a day (the random ticks stepped with a
     seeded generator); it stops when ripe
   8 harvests: a ripe crop counts, an unripe one does not; four ripe harvests leave the ground watered, the fifth dries it
   9 the yields: wheat 1 + 1-3 seeds (unripe: 1 seed), carrots 2-3 (unripe: 1), hemlock 2-3 roots (unripe: 1) (6.63)
   12 (6.63) hoes take Unbreaking and Fortune (nothing else); Fortune III doubles every stack of a ripe harvest, I and II in
     between on average; unripe crops ignore it; only a hoe's Fortune counts; Unbreaking III wears a hoe about a quarter
   10 a crop whose farmland is dug out pops off as its seed; a solid block on farmland makes it dirt; farmland drops dirt
   11 tall grass gives seeds about one time in eight; three wheat in a row make bread, which is food
   12 a save keeps farmland's water and count and a crop's stage, and the crop goes on growing after loading; wild
      carrots and hemlock are in the world, ripe */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:39});
const step=boot.stepper(600000);

boot.run(async()=>{
  const B=V.B,IT=V.IT,D=V.DEFS,FARM=V.FARM;
  ok('the seams are on __vox',['cropStage','cropYield','farmUse','farmTick','farmHarvest','wcanUses','getMeta','calcCraft'].every(k=>typeof V[k]==='function')&&!!FARM&&!!V.CROPS);
  /* ===== 1 ===== */
  const names=[B.FARMLAND,B.WHEAT,B.CARROTS,B.HEMLOCK,IT.HOE,IT.HOE+4,IT.WCAN,IT.SEEDS,IT.WHEAT,IT.BREAD,IT.CARROT,IT.HROOT].map(i=>D[i]&&D[i].name);
  ok('blocks and items: '+names.join(', '),names.join()==='Farmland,Wheat,Carrots,Hemlock,Wooden Hoe,Golden Hoe,Watering Can,Wheat Seeds,Wheat,Bread,Carrot,Hemlock Root'&&
    [B.FARMLAND,B.WHEAT,B.CARROTS,B.HEMLOCK].join()==='217,218,219,248'&&D[B.WHEAT].cross===true&&D[B.WHEAT].solid===false&&D[IT.BREAD].food===5&&D[IT.CARROT].food===3&&!D[212]);
  const craft=(rows)=>{const g=Array(9).fill(null);rows.forEach((r,y)=>r.forEach((id,x)=>{if(id)g[y*3+x]={id,count:1};}));const r=V.calcCraft(g,3);return r?r.id+'x'+r.count:'';};
  ok('recipes: a hoe is two of the material over two sticks (all five), bread is three wheat in a row, the can is four iron round a bucket',
    [B.PLANK_O,B.COBBLE,IT.IRON,IT.DIAMOND,IT.GOLD].map((m,i)=>craft([[m,m,0],[0,IT.STICK,0],[0,IT.STICK,0]])===(IT.HOE+i)+'x1').every(Boolean)&&
    craft([[IT.WHEAT,IT.WHEAT,IT.WHEAT]])===IT.BREAD+'x1'&&craft([[IT.IRON,0,IT.IRON],[IT.IRON,IT.BUCKET,IT.IRON],[0,IT.IRON,0]])===IT.WCAN+'x1');

  const o=boot.studio(V,step,{});V.GR.mobSpawn=false;V.GR.fireTick=false;
  const P=()=>V.P;
  const X=o.x+2,Y=o.y-1,Z=o.z;                              /* the floor cell two blocks in front of Dan */
  const hold=(id,extra)=>{const p=P();p.inv[0]=Object.assign({id,count:1},extra||{});p.sel=0;V.refreshHand();p.x=o.x+0.5;p.z=o.z+0.5;p.y=o.y;p.vx=p.vy=p.vz=0;p.hunger=20;step(1);return p.inv[0];};
  const useAt=(x,y,z)=>{boot.aim(V,x,y,z);boot.rclick(V,step);};
  const cell=(x,y,z)=>V.getBlock(x,y,z)+':'+V.getMeta(x,y,z);
  const clear=()=>{for(let dx=1;dx<=5;dx++)for(let dz=-2;dz<=2;dz++){V.setBlock(o.x+dx,Y,o.z+dz,B.DIRT);for(let dy=1;dy<=3;dy++)V.setBlock(o.x+dx,Y+dy,o.z+dz,B.AIR);}
    for(const e of V.entities)if(e.t==='drop')e.dead=true;V.LIQ.w.clear();FARM.q.clear();step(2);};
  const top=(x,z)=>[x+0.5,Y+1,z+0.5];
  /* ===== 2 ===== */
  clear();V.setBlock(X,Y,Z,B.GRASS);
  let st=hold(IT.HOE+1);const d0=D[IT.HOE+1].dur;useAt(...top(X,Z));
  const a2=cell(X,Y,Z),wear=d0-(P().inv[0].dur===undefined?d0:P().inv[0].dur);
  V.setBlock(X+1,Y,Z,B.DIRT);useAt(...top(X+1,Z));const b2=cell(X+1,Y,Z);
  V.setBlock(X,Y,Z+1,B.DIRT);V.setBlock(X,Y+1,Z+1,B.GLASS);useAt(X+0.5,Y+0.9,Z+1.05);const c2=V.getBlock(X,Y,Z+1);
  V.setBlock(X,Y+1,Z+1,B.AIR);V.setBlock(X,Y,Z-1,B.STONE);useAt(...top(X,Z-1));const e2=V.getBlock(X,Y,Z-1);
  ok('the hoe: grass -> '+a2+' and dirt -> '+b2+' (dry farmland), worn by '+wear+' a use; under a block: left alone; on stone: nothing',
    a2===B.FARMLAND+':0'&&b2===B.FARMLAND+':0'&&wear===1&&c2===B.DIRT&&e2===B.STONE);
  {/* 6.44: held down, the hoe tills every grass or dirt block the crosshair crosses */
    clear();for(let i=0;i<4;i++)V.setBlock(X,Y,Z-1+i,i===2?B.STONE:B.GRASS);
    hold(IT.HOE+2);const d1=D[IT.HOE+2].dur;V.MB.r=true;
    for(let i=0;i<4;i++){boot.aim(V,X+0.5,Y+1,Z-1+i+0.5);step(2);}
    V.MB.r=false;step(2);
    const row=[0,1,2,3].map(i=>V.getBlock(X,Y,Z-1+i)),used=d1-(P().inv[0].dur===undefined?d1:P().inv[0].dur);
    ok('the right button held and the crosshair swept along four blocks: the three of grass are farmland, the stone is stone, and the hoe is worn by 3 ('+used+')',
      row[0]===B.FARMLAND&&row[1]===B.FARMLAND&&row[2]===B.STONE&&row[3]===B.FARMLAND&&used===3);}
  /* ===== 3 ===== */
  clear();V.setBlock(X,Y,Z,B.FARMLAND,0);
  st=hold(IT.WCAN);const u0=V.wcanUses(st);
  V.setBlock(o.x+2,Y+1,o.z+2,B.WATER,3);useAt(o.x+2.5,Y+1.3,o.z+2.5);const uFlow=V.wcanUses(P().inv[0]);
  V.setBlock(o.x+2,Y+1,o.z+2,B.WATER,0);useAt(o.x+2.5,Y+1.3,o.z+2.5);const uSrc=V.wcanUses(P().inv[0]),still=cell(o.x+2,Y+1,o.z+2);
  V.setBlock(o.x+2,Y+1,o.z+2,B.AIR);V.LIQ.w.clear();for(let dx=1;dx<=5;dx++)for(let dz=-2;dz<=2;dz++)if(V.getBlock(o.x+dx,Y+1,o.z+dz)===B.WATER)V.setBlock(o.x+dx,Y+1,o.z+dz,B.AIR);V.LIQ.w.clear();
  ok('the watering can: made empty ('+u0+'), not filled by flowing water ('+uFlow+'), filled by a source ('+uSrc+'), and the source is still there ('+still+')',
    u0===0&&uFlow===0&&uSrc===8&&still===B.WATER+':0');
  /* ===== 4 ===== */
  useAt(...top(X,Z));const w1=cell(X,Y,Z),u1=V.wcanUses(P().inv[0]);
  useAt(...top(X,Z));const u2=V.wcanUses(P().inv[0]);
  V.setBlock(X+1,Y,Z,B.FARMLAND,0);P().inv[0].dur=0;useAt(...top(X+1,Z));const dry2=cell(X+1,Y,Z);
  ok('watering: dry -> '+w1+' (watered, 5 harvests), '+u1+' uses left; watered ground takes no more ('+u2+'); an empty can waters nothing ('+dry2+')',
    w1===B.FARMLAND+':13'&&u1===7&&u2===7&&dry2===B.FARMLAND+':0');
  /* ===== 5 ===== */
  clear();V.setBlock(X,Y,Z,B.FARMLAND,0);V.setBlock(X,Y+1,Z,B.WHEAT,7);V.setBlock(X+1,Y,Z,B.WATER,0);
  let rs=1;const rnd=()=>{rs=(rs*1103515245+12345)&0x7fffffff;return rs/0x7fffffff;};
  for(let i=0;i<3000;i++)V.farmTick(1,rnd);
  ok('water in the next block for 3000 seconds: the farmland is still dry, and the wheat on it has not grown',cell(X,Y,Z)===B.FARMLAND+':0'&&V.cropStage(V.getMeta(X,Y+1,Z))===0&&V.getBlock(X,Y+1,Z)===B.WHEAT);
  /* ===== 6 ===== */
  clear();for(let i=0;i<3;i++)V.setBlock(X,Y,Z-1+i,B.FARMLAND,13);V.setBlock(X+1,Y,Z,B.DIRT);
  const plant=(item,z)=>{hold(item,{count:3});useAt(...top(X,z));return [V.getBlock(X,Y+1,z),V.cropStage(V.getMeta(X,Y+1,z)),P().inv[0]?P().inv[0].count:0].join();};
  const p1=plant(IT.SEEDS,Z-1),p2=plant(IT.CARROT,Z),p3=plant(IT.HROOT,Z+1);
  hold(IT.SEEDS,{count:3});useAt(...top(X+1,Z));const onDirt=V.getBlock(X+1,Y+1,Z);
  ok('planting on farmland: seeds -> '+p1+', a carrot -> '+p2+', a hemlock root -> '+p3+' (block, stage 0, 2 left); on dirt: nothing',
    p1===B.WHEAT+',0,2'&&p2===B.CARROTS+',0,2'&&p3===B.HEMLOCK+',0,2'&&onDirt===B.AIR);
  {hold(IT.CARROT,{count:3});P().hunger=10;boot.aim(V,o.x+0.5,o.y+30,o.z+0.6);V.MB.r=true;step(60);V.MB.r=false;step(2);
    ok('a carrot aimed at nothing is eaten: hunger '+P().hunger+', '+(P().inv[0]?P().inv[0].count:0)+' left',P().hunger>10&&P().inv[0]&&P().inv[0].count<3);}
  /* ===== 7 ===== */
  clear();V.setBlock(X,Y,Z,B.FARMLAND,0);V.setBlock(X,Y+1,Z,B.WHEAT,7);V.setBlock(X+1,Y,Z,B.FARMLAND,13);V.setBlock(X+1,Y+1,Z,B.CARROTS,7);
  rs=7;let ripeAt=-1;for(let i=1;i<=6000;i++){V.farmTick(1,rnd);if(ripeAt<0&&V.cropStage(V.getMeta(X+1,Y+1,Z))===7)ripeAt=i;}
  ok('6000 seconds: the wheat on dry farmland is still at stage '+V.cropStage(V.getMeta(X,Y+1,Z))+'; the carrots on watered farmland were ripe after '+ripeAt+' s (a day is 1200)',
    V.cropStage(V.getMeta(X,Y+1,Z))===0&&ripeAt>300&&ripeAt<3600&&V.getMeta(X+1,Y+1,Z)===0&&!FARM.q.has((X+1)+','+(Y+1)+','+Z));
  {let tot=0,n=40;for(let k=0;k<n;k++){V.setBlock(X+1,Y+1,Z,B.AIR);V.setBlock(X+1,Y+1,Z,B.CARROTS,7);let t=0;while(V.getMeta(X+1,Y+1,Z)&7){V.farmTick(1,rnd);t++;if(t>20000)break;}tot+=t;}
    ok('over 40 plantings the average is '+Math.round(tot/n)+' s, about one day of 1200',tot/n>900&&tot/n<1500);}
  /* ===== 8, 9 ===== */
  P().mode='s';
  const harvest=(id,stage)=>{for(const e of V.entities)if(e.t==='drop')e.dead=true;V.setBlock(X+1,Y+1,Z,id,7-stage);{const p=P();p.inv[0]=null;p.sel=0;V.refreshHand();p.x=o.x+0.5;p.z=o.z+0.5;p.y=o.y;}V.breakBlock(X+1,Y+1,Z,true);
    const m={};for(const e of V.entities)if(e.t==='drop'&&!e.dead){m[e.st.id]=(m[e.st.id]||0)+e.st.count;e.dead=true;}return m;};
  V.setBlock(X+1,Y,Z,B.FARMLAND,13);
  harvest(B.WHEAT,3);const afterUnripe=cell(X+1,Y,Z);
  const left=[];for(let i=0;i<5;i++){harvest(B.WHEAT,7);left.push(cell(X+1,Y,Z));}
  ok('an unripe crop does not count ('+afterUnripe+'); five ripe harvests: '+left.join(' ')+' (watered through four, dry on the fifth)',
    afterUnripe===B.FARMLAND+':13'&&left.join(' ')===[12,11,10,9,0].map(v=>B.FARMLAND+':'+v).join(' '));
  {const R={w:[9,-1,9,-1],c:[9,-1],h:[9,-1]};let okU=true;
    for(let i=0;i<60;i++){V.setBlock(X+1,Y,Z,B.FARMLAND,13);
      let m=harvest(B.WHEAT,7);if(m[IT.WHEAT]!==1)okU=false;const sd=m[IT.SEEDS]||0;R.w[0]=Math.min(R.w[0],sd);R.w[1]=Math.max(R.w[1],sd);
      m=harvest(B.CARROTS,7);R.c[0]=Math.min(R.c[0],m[IT.CARROT]||0);R.c[1]=Math.max(R.c[1],m[IT.CARROT]||0);
      m=harvest(B.HEMLOCK,7);R.h[0]=Math.min(R.h[0],m[IT.HROOT]||0);R.h[1]=Math.max(R.h[1],m[IT.HROOT]||0);if(Object.keys(m).length!==1)okU=false;}
    const u=[harvest(B.WHEAT,2),harvest(B.CARROTS,6),harvest(B.HEMLOCK,0)];
    ok('yields over 60 harvests: wheat 1 and '+R.w[0]+'-'+R.w[1]+' seeds, carrots '+R.c[0]+'-'+R.c[1]+', hemlock roots '+R.h[0]+'-'+R.h[1]+'; unripe: one seed, one carrot, one root',
      okU&&R.w[0]===1&&R.w[1]===3&&R.c[0]===2&&R.c[1]===3&&R.h[0]===2&&R.h[1]===3&&JSON.stringify(u)===JSON.stringify([{[IT.SEEDS]:1},{[IT.CARROT]:1},{[IT.HROOT]:1}]));}
  /* ===== 10 ===== */
  clear();V.setBlock(X,Y,Z,B.FARMLAND,13);V.setBlock(X,Y+1,Z,B.HEMLOCK,4);
  V.setBlock(X,Y,Z,B.AIR);step(2);
  const popped=V.entities.filter(e=>e.t==='drop'&&!e.dead).map(e=>e.st.id+'x'+e.st.count).join();
  ok('the farmland dug out from under it: the hemlock is gone and one root lies there ('+popped+')',V.getBlock(X,Y+1,Z)===B.AIR&&popped===IT.HROOT+'x1');
  for(const e of V.entities)if(e.t==='drop')e.dead=true;
  V.setBlock(X,Y,Z,B.FARMLAND,13);V.setBlock(X,Y+1,Z,B.STONE);const under=cell(X,Y,Z);V.setBlock(X,Y+1,Z,B.AIR);
  V.setBlock(X+1,Y,Z,B.FARMLAND,13);V.setBlock(X+1,Y+1,Z,B.TORCH);const underTorch=V.getBlock(X+1,Y,Z);V.setBlock(X+1,Y+1,Z,B.AIR);
  V.breakBlock(X+1,Y,Z,true);step(1);const fd=V.entities.filter(e=>e.t==='drop'&&!e.dead).map(e=>e.st.id).join();
  ok('a solid block on farmland makes it dirt ('+under+'); a torch does not; broken farmland drops dirt',under===B.DIRT+':0'&&underTorch===B.FARMLAND&&fd===''+B.DIRT);
  /* ===== 11 ===== */
  {let seeds=0;const N=800;rs=11;const real=Math.random;Math.random=rnd;
    try{for(let i=0;i<N;i++){const r=D[B.TALLGRASS].pdrop(null,'Dan');if(r){if(r.id!==IT.SEEDS||r.count!==1)seeds=-9999;seeds++;}}}finally{Math.random=real;}
    ok('tall grass: seeds '+seeds+' times in '+N+' (one in eight is 100)',seeds>70&&seeds<130);}
  /* ===== 12 ===== */
  clear();V.setBlock(X,Y,Z,B.FARMLAND,8|3);V.setBlock(X,Y+1,Z,B.WHEAT,5);
  const snap=JSON.parse(JSON.stringify(V.snapshot('farm')));V.setBlock(X,Y+1,Z,B.AIR);V.setBlock(X,Y,Z,B.DIRT);
  V.applySave(snap);step(60);
  const back=cell(X,Y,Z)+' '+cell(X,Y+1,Z),listed=FARM.q.has(X+','+(Y+1)+','+Z);
  rs=3;for(let i=0;i<6000;i++)V.farmTick(1,rnd);
  ok('a save keeps them ('+back+'), the crop is on the growing list again, and it ripens after loading',back===B.FARMLAND+':11 '+B.WHEAT+':5'&&listed&&V.getMeta(X,Y+1,Z)===0);
  {let wild={[B.CARROTS]:0,[B.HEMLOCK]:0},ripe=true,onGrass=true;const px=Math.floor(V.P.x),pz=Math.floor(V.P.z);
    const G=V.genChunk;let n=0;
    if(typeof G==='function'){const pcx=Math.floor(V.P.x/16),pcz=Math.floor(V.P.z/16);for(let cx=pcx-12;cx<pcx+12;cx++)for(let cz=pcz-12;cz<pcz+12;cz++){const bl=G(cx,cz);for(let i=0;i<bl.length;i++)if(bl[i]===B.CARROTS||bl[i]===B.HEMLOCK){wild[bl[i]]++;n++;}}}
    /* 6.45: about one hemlock plant per hundred chunks of ordinary country. Counted over four million columns by the generator's own rule,
       and in the 576 real chunks round the start (where about one column in eight is bare grass) */
    let wc=0,wh=0;for(let x=0;x<2000;x++)for(let z=0;z<2000;z++){const w=V.farmWild(x*3+7,z*3-11);if(w===B.CARROTS)wc++;else if(w===B.HEMLOCK)wh++;}
    ok('the world has wild carrots ('+wild[B.CARROTS]+') and wild hemlock ('+wild[B.HEMLOCK]+') in the 576 chunks nearby, ripe (a generated plant has meta 0); over 4,000,000 columns the rule gives '+wc+' carrots and '+wh+' hemlock (2400 and 1200 expected)',
      typeof G!=='function'||(wild[B.CARROTS]>3&&wild[B.HEMLOCK]>=1&&wild[B.HEMLOCK]<40&&n<2000&&V.cropStage(0)===7&&wc>2100&&wc<2700&&wh>1000&&wh<1400&&V.FARM_WILD.hemlock===0.0003));}
  /* ===== 12. enchanted hoes (6.63): Unbreaking and Fortune; Fortune III doubles a ripe harvest, I and II in between ===== */
  {const hoe=(e)=>Object.assign({id:IT.HOE+2,count:1},e?{ench:e}:{});
    const seen=new Set();for(let i=0;i<60;i++)for(const k of V.rollOffers(hoe()))seen.add(k);
    const pick=new Set();for(let i=0;i<60;i++)for(const k of V.rollOffers({id:V.toolId(2,0),count:1}))pick.add(k);
    ok('a hoe can be enchanted with Unbreaking and Fortune, and nothing else ('+[...seen].sort().join(', ')+'); a pickaxe keeps its own ('+[...pick].sort().join(', ')+')',
      [...seen].sort().join()==='fort,unb'&&pick.has('fort')&&pick.has('eff')&&V.enchName(hoe({fort:3,unb:2}))==='Fortune III, Unbreaking II');
    const mul=(seed)=>{let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};};
    let dbl=true;const tot=[0,0,0,0];let edge=true;
    for(let i=0;i<3000;i++)for(const id of [B.WHEAT,B.CARROTS,B.HEMLOCK]){
      const base=V.cropYield(id,7,mul(i*7+id),0);
      for(let lv=0;lv<=3;lv++){const y=V.cropYield(id,7,mul(i*7+id),lv);tot[lv]+=y.reduce((a,q)=>a+q.count,0);
        y.forEach((q,j)=>{const x=base[j].count*(1+lv/3);if(q.id!==base[j].id||q.count<Math.floor(x+1e-9)||q.count>Math.ceil(x-1e-9))edge=false;});
        if(lv===3&&y.some((q,j)=>q.count!==base[j].count*2))dbl=false;}}
    const r1=tot[1]/tot[0],r2=tot[2]/tot[0];
    ok('Fortune III doubles every stack of a ripe harvest, every time (9000 harvests)',dbl&&tot[3]===tot[0]*2);
    ok('Fortune I and II land in between, on average x'+r1.toFixed(3)+' and x'+r2.toFixed(3)+' (each stack rounded to a neighbour of its exact share)',edge&&Math.abs(r1-4/3)<0.02&&Math.abs(r2-5/3)<0.02);
    ok('an unripe crop gives one seed back whatever the Fortune',[B.WHEAT,B.CARROTS,B.HEMLOCK].every(id=>V.cropYield(id,3,null,3).length===1&&V.cropYield(id,3,null,3)[0].count===1));
    const hv=(id,held)=>{for(const e of V.entities)if(e.t==='drop')e.dead=true;V.setBlock(X+1,Y,Z,B.FARMLAND,13);V.setBlock(X+1,Y+1,Z,id,0);
      {const p=P();p.inv[0]=held;p.sel=0;V.refreshHand();p.x=o.x+0.5;p.z=o.z+0.5;p.y=o.y;}V.breakBlock(X+1,Y+1,Z,true);
      let n=0;for(const e of V.entities)if(e.t==='drop'&&!e.dead){n+=e.st.count;e.dead=true;}return n;};
    const withHoe=[],withPick=[];for(let i=0;i<30;i++){withHoe.push(hv(B.CARROTS,hoe({fort:3})));withPick.push(hv(B.CARROTS,{id:V.toolId(2,0),count:1,ench:{fort:3}}));}
    ok('in the world: ripe carrots broken with a Fortune III hoe give 4 or 6 ('+[...new Set(withHoe)].sort().join(',')+'); a Fortune III pickaxe does not count ('+[...new Set(withPick)].sort().join(',')+')',
      withHoe.every(n=>n===4||n===6)&&withPick.every(n=>n===2||n===3));
    const wear=(e)=>{const p=P();p.mode='s';p.inv[0]=hoe(e);p.inv[0].dur=100000;p.sel=0;for(let i=0;i<2000;i++)V.damageHeld(1);return 100000-p.inv[0].dur;};
    const w0=wear(null),w3=wear({unb:3});P().inv[0]=null;V.refreshHand();
    ok('Unbreaking III on a hoe: 2000 uses wear it '+w3+' (a plain hoe '+w0+'), about a quarter',w0===2000&&w3>400&&w3<600);}

});
