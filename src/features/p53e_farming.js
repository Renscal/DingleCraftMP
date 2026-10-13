/* ----- farming (6.39): a hoe, a watering can, three crops -----
   Farmland is made with a hoe (grass or dirt with air above) and is dry until a watering can wets it. Nothing else wets
   it: not water next to it, not rain. Watered farmland stays watered for five harvests of a ripe crop, then is dry again.
   Crops (wheat, carrots, hemlock) are planted on farmland by hand and grow only while it is watered, a stage at a time at
   random, about one day from seed to ripe. They grow in loaded chunks, in the game that runs the land (the server's own
   where there is one).
   What is stored, all in the block's meta byte (6.25):
     farmland   8: watered. 0-7: harvests left before it dries (5 when watered).
     a crop     0-7: stages still to grow. 0 is ripe, so a plant the world generator puts down (meta 0) is a ripe wild one.
   Hemlock is drawn to pass for a carrot: same shape, paler and bluer leaves, purple-spotted stems, a cream root.
   Ids: blocks 217 farmland, 218 wheat, 219 carrots, 248 hemlock; items 366-370 hoes (wood, stone, iron, diamond, golden),
   371 watering can, 372 wheat seeds, 373 wheat, 374 bread, 375 carrot, 376 hemlock root. */
B.FARMLAND=217;B.WHEAT=218;B.CARROTS=219;B.HEMLOCK=248;
IT.HOE=366;IT.WCAN=371;IT.SEEDS=372;IT.WHEAT=373;IT.BREAD=374;IT.CARROT=375;IT.HROOT=376;
const FARM={q:new Map(),t:0,dim:null,last:null,p:7/DAY_LEN,uses:8,harvests:5};
/* ---- art ---- */
/* The pictures are registered at boot (farmTiles, called at the top of buildAtlas after Creativity's), not as this file
   loads: every older tile keeps its slot in the atlas, and these take the slots after the last one. The recipes go on
   the end of the list at the same moment, for the same reason. */
function farmTiles(){
if(FARM.tiled)return;FARM.tiled=1;FARM.tile0=_tn;
tile('farm_dry',(c,r)=>{c.fillStyle='#8a5a2b';c.fillRect(0,0,16,16);
  for(let y=1;y<16;y+=4){c.fillStyle='#6f4520';c.fillRect(0,y,16,2);c.fillStyle='#9b6a36';c.fillRect(0,y+2,16,1);}
  for(let i=0;i<14;i++){c.fillStyle=r()<0.5?'#7a4f25':'#a17240';c.fillRect((r()*16)|0,(r()*16)|0,1,1);}});
tile('farm_wet',(c,r)=>{c.fillStyle='#55361a';c.fillRect(0,0,16,16);
  for(let y=1;y<16;y+=4){c.fillStyle='#3d2610';c.fillRect(0,y,16,2);c.fillStyle='#64421f';c.fillRect(0,y+2,16,1);}
  for(let i=0;i<10;i++){c.fillStyle=r()<0.5?'#472c14':'#6b4a26';c.fillRect((r()*16)|0,(r()*16)|0,1,1);}});
/* four pictures a crop (growth stages 0-1, 2-3, 4-5, 6-7) */
for(let s=0;s<4;s++){
  tile('wheat_'+s,c=>{c.clearRect(0,0,16,16);const h=4+s*4,ripe=s===3;
    for(let x=1;x<16;x+=2){const hh=h-((x*7)%3);c.fillStyle=ripe?'#c9a53a':(s===2?'#9fb04a':'#5fa33a');c.fillRect(x,16-hh,1,hh);
      if(s>=2){c.fillStyle=ripe?'#e6c659':'#b9c35e';c.fillRect(x,16-hh,1,3);if(ripe){c.fillStyle='#a8842a';c.fillRect(x-(x%4?0:1),16-hh+1,1,1);}}}});
  /* carrots and hemlock share a shape: tufts of leaves that get taller, and at the last stage the top of the root showing */
  const leafy=(name,leaf,leaf2,stem,spot,root)=>tile(name+'_'+s,c=>{c.clearRect(0,0,16,16);const h=3+s*3;
    for(const x of [3,8,12]){const hh=h-((x*5)%2);
      c.fillStyle=stem;c.fillRect(x,16-hh,1,hh);
      if(spot&&hh>3){c.fillStyle=spot;c.fillRect(x,15-((x+s)%Math.max(2,hh-2)),1,1);}
      c.fillStyle=leaf;for(let k=0;k<hh-1;k+=2){c.fillRect(x-1-(k%4?0:1),16-hh+k,1,1);c.fillRect(x+1+(k%4?1:0),16-hh+k+1,1,1);}
      c.fillStyle=leaf2;c.fillRect(x-1,16-hh,3,1);if(hh>5)c.fillRect(x-2,16-hh+2,1,1),c.fillRect(x+2,16-hh+3,1,1);
      if(s===3){c.fillStyle=root;c.fillRect(x-1,15,3,1);}}});
  leafy('carrot','#3f9a3a','#5cb84e','#2f7d2f',null,'#e8842a');
  leafy('hemlock','#7fb9a0','#a3d2bd','#4f8f7a','#7a3f8f','#e9dfc4');
}
for(let m=0;m<5;m++)(mm=>tile('hoe_'+mm,c=>{c.clearRect(0,0,16,16);const col=TOOLMAT[mm].col,dk=shade(col,-.35);
  for(let i=0;i<10;i++){c.fillStyle=i%3?'#7a5b30':'#5f4522';c.fillRect(3+i,13-i,1,1);c.fillStyle='#8f6c3a';c.fillRect(4+i,13-i,1,1);}
  c.fillStyle=col;c.fillRect(8,2,5,2);c.fillRect(8,4,2,2);c.fillStyle=dk;c.fillRect(8,4,5,1);c.fillRect(8,6,2,1);c.fillRect(13,2,1,2);}))(m);
tile('i_wcan',c=>{c.clearRect(0,0,16,16);c.fillStyle='#8f9aa3';c.fillRect(4,6,7,7);c.fillStyle='#b9c4cc';c.fillRect(4,6,7,1);c.fillRect(4,6,1,7);
  c.fillStyle='#6b757d';c.fillRect(10,7,1,6);c.fillRect(4,12,7,1);c.fillStyle='#8f9aa3';c.fillRect(11,8,2,1);c.fillRect(12,6,1,2);c.fillRect(13,5,2,1);
  c.fillStyle='#b9c4cc';c.fillRect(13,4,2,1);c.fillStyle='#6b757d';c.fillRect(2,7,2,1);c.fillRect(1,8,1,3);c.fillRect(2,11,2,1);c.fillStyle='#4a90d9';c.fillRect(5,7,5,1);});
tile('i_seeds',c=>{c.clearRect(0,0,16,16);for(const p of [[4,5],[9,4],[6,9],[11,8],[8,12],[3,11],[12,12]]){c.fillStyle='#8fae3c';c.fillRect(p[0],p[1],2,2);c.fillStyle='#5d7a22';c.fillRect(p[0]+1,p[1]+1,1,1);}});
tile('i_wheat',c=>{c.clearRect(0,0,16,16);for(let i=0;i<3;i++){const x=4+i*3;c.fillStyle='#c9a53a';for(let k=0;k<9;k++)c.fillRect(x+((k+i)%2),4+k,1,1);c.fillStyle='#e6c659';c.fillRect(x,3,2,3);}
  c.fillStyle='#8a6a22';c.fillRect(3,11,9,1);});
tile('i_bread',c=>{c.clearRect(0,0,16,16);c.fillStyle='#b97a34';c.fillRect(2,7,12,5);c.fillRect(3,6,10,1);c.fillStyle='#d79a4c';c.fillRect(3,7,10,2);
  c.fillStyle='#8f5a22';c.fillRect(2,11,12,1);for(const x of [5,8,11]){c.fillRect(x,7,1,3);}});
const farmRootIcon=(name,body,dark,leaf)=>tile(name,c=>{c.clearRect(0,0,16,16);
  for(let i=0;i<8;i++){const w=Math.max(1,4-(i>>1));c.fillStyle=body;c.fillRect(9-i,5+i,w,1);c.fillStyle=dark;c.fillRect(9-i+w-1,5+i,1,1);}
  c.fillStyle=leaf;c.fillRect(10,2,1,3);c.fillRect(12,3,1,2);c.fillRect(11,4,2,1);c.fillRect(13,2,1,1);});
farmRootIcon('i_carrot','#e8842a','#b8601a','#3f9a3a');
farmRootIcon('i_hroot','#e9dfc4','#bdb08f','#7fb9a0');
psnTiles();                                              /* 6.40: poison's two pictures and two recipes (features/p53f_poison.js) */
FARM.tileN=_tn-FARM.tile0;
for(let m=0;m<5;m++)R(['MM',' S',' S'],{M:TOOL_MATS[m],S:IT.STICK},IT.HOE+m,1);
R(['WWW'],{W:IT.WHEAT},IT.BREAD,1);
R(['I I','IBI',' I '],{I:IT.IRON,B:IT.BUCKET},IT.WCAN,1);
}
const FARM_RECIPE_N=9;                                    /* 7 of farming's, 2 of poison's */
/* ---- blocks and items ---- */
const CROPS={
  [B.WHEAT]:  {name:'wheat',  seed:IT.SEEDS, pic:'wheat'},
  [B.CARROTS]:{name:'carrot', seed:IT.CARROT,pic:'carrot'},
  [B.HEMLOCK]:{name:'hemlock',seed:IT.HROOT, pic:'hemlock'}};
/* a crop's growth stage, 0 (just planted) to 7 (ripe), from its meta */
function cropStage(meta){return 7-(meta&7);}
/* what a crop gives when a player breaks it: [first stack, ...more stacks] (first is what breakBlock itself drops) */
function cropYield(id,stage,rnd){
  const R=rnd||Math.random,ripe=stage>=7;
  if(id===B.WHEAT)return ripe?[{id:IT.WHEAT,count:1},{id:IT.SEEDS,count:Math.floor(R()*4)}]:[{id:IT.SEEDS,count:1}];
  if(id===B.CARROTS)return ripe?[{id:IT.CARROT,count:2+Math.floor(R()*3)}]:[{id:IT.CARROT,count:1}];
  return ripe?[{id:IT.HROOT,count:1+Math.floor(R()*3)}]:[{id:IT.HROOT,count:1}];
}
/* breakBlock's drop for a crop. The block is already air: FARM.last (farmNote) says where it stood and how grown it was.
   A ripe one counts as a harvest for the farmland under it. */
function cropDrop(){
  const L=FARM.last;
  if(!L)return null;
  FARM.last=null;
  const Y=cropYield(L.id,L.stage);
  for(let i=1;i<Y.length;i++)if(Y[i].count>0)spawnDrop(L.x+0.5,L.y+0.4,L.z+0.5,Y[i],(Math.random()-0.5)*1.5,2.2,(Math.random()-0.5)*1.5);
  if(L.stage>=7)farmHarvest(L.x,L.y-1,L.z);
  return Y[0];
}
def(B.FARMLAND,{name:'Farmland',tiles:{top:'farm_dry',side:'dirt',bot:'dirt'},hard:0.6,toolClass:'shovel',drop:B.DIRT,
  topM:m=>(m&8)?Tl.farm_wet:Tl.farm_dry});
for(const idS of Object.keys(CROPS)){const id=+idS,C=CROPS[id];
  def(id,{name:id===B.WHEAT?'Wheat':id===B.CARROTS?'Carrots':'Hemlock',tiles:C.pic+'_3',hard:0,solid:false,opq:false,bucket:'cut',cross:true,
    drop:null,hide:true,crop:true,crossM:m=>Tl[C.pic+'_'+(cropStage(m)>>1)],pdrop:cropDrop});}
for(let m=0;m<5;m++)idef(IT.HOE+m,{name:TOOLMAT[m].n+' Hoe',icon:'hoe_'+m,stack:1,hoe:true,dur:TOOLMAT[m].dur});
idef(IT.WCAN,{name:'Watering Can',icon:'i_wcan',stack:1,wcan:true,dur:FARM.uses});
idef(IT.SEEDS,{name:'Wheat Seeds',icon:'i_seeds',plant:B.WHEAT});
idef(IT.WHEAT,{name:'Wheat',icon:'i_wheat'});
idef(IT.BREAD,{name:'Bread',icon:'i_bread',food:5});
idef(IT.CARROT,{name:'Carrot',icon:'i_carrot',food:3,plant:B.CARROTS});
idef(IT.HROOT,{name:'Hemlock Root',icon:'i_hroot',plant:B.HEMLOCK});
/* tall grass gives seeds now and then */
DEFS[B.TALLGRASS].pdrop=()=>Math.random()<0.125?{id:IT.SEEDS,count:1}:null;
/* ---- the rules ---- */
/* how many waterings a can holds (a can never filled holds none) */
function wcanUses(st){return st&&st.dur!=null?Math.max(0,st.dur|0):0;}
/* a ripe crop was harvested on the farmland at x,y,z: one fewer to go; at none it is dry again */
function farmHarvest(x,y,z){
  if(getBlock(x,y,z)!==B.FARMLAND)return;
  const m=getMeta(x,y,z);
  if(!(m&8))return;
  const left=(m&7)-1;
  setBlock(x,y,z,B.FARMLAND,left>0?(8|left):0);
}
/* the right click of a hoe, a watering can or something that can be planted (from doUse, before the eating branch, so a
   carrot aimed at farmland is planted and not eaten). Returns true if it did something. */
function farmUse(st,d,hit){
  if(d.wcan){
    const e=eyePos(),l=lookDir();
    for(let t=0.5;t<=4.5;t+=0.2){                          /* the pick ray looks through water: find it the way a bucket does */
      const x=Math.floor(e[0]+l[0]*t),y=Math.floor(e[1]+l[1]*t),z=Math.floor(e[2]+l[2]*t),id=getBlock(x,y,z);
      if(id===B.WATER){
        if((getMeta(x,y,z)&15)!==0||wcanUses(st)>=FARM.uses)break;
        st.dur=FARM.uses;redrawHotbar();playS('pop');P.swing=1;return true;   /* the source stays */
      }
      if(DEFS[id].solid)break;
    }
    if(!hit)return false;
    let fx=hit.x,fy=hit.y,fz=hit.z;
    if(CROPS[hit.id])fy--;                                 /* aimed at the crop: the ground under it */
    if(getBlock(fx,fy,fz)!==B.FARMLAND||(getMeta(fx,fy,fz)&8))return false;
    if(wcanUses(st)<=0){showToast('The watering can is empty. Fill it at water.');return true;}
    setBlock(fx,fy,fz,B.FARMLAND,8|FARM.harvests);
    if(P.mode!=='c')st.dur=wcanUses(st)-1;
    burstParticles(fx+0.5,fy+1.1,fz+0.5,B.WATER,8,0.5);playS('pop');P.swing=1;redrawHotbar();
    return true;
  }
  if(!hit)return false;
  if(d.hoe){
    if((hit.id!==B.GRASS&&hit.id!==B.DIRT)||getBlock(hit.x,hit.y+1,hit.z)!==B.AIR)return false;
    if(MGP_ON&&mgProtected(hit.x,hit.y,hit.z,'place'))return false;
    setBlock(hit.x,hit.y,hit.z,B.FARMLAND,0);
    damageHeld(1);playS('dig');P.swing=1;
    return true;
  }
  if(d.plant){
    if(hit.id!==B.FARMLAND||hit.ny!==1||getBlock(hit.x,hit.y+1,hit.z)!==B.AIR)return false;
    setBlock(hit.x,hit.y+1,hit.z,d.plant,7);
    if(P.mode!=='c'){st.count--;if(st.count<=0)P.inv[P.sel]=null;}
    redrawHotbar();playS('place');P.swing=1;
    return true;
  }
  return false;
}
/* from setBlock, when the kind of block at a cell changed (old with its meta om, now id with meta). Keeps the list of
   crops still growing, remembers a crop that was just removed (for its drop), and does what follows from the change:
   a crop whose farmland went pops off as its seed, and farmland with something solid put on it is dirt again. What
   follows is done once, by the game that runs the land. */
function farmNote(x,y,z,old,om,id,meta){
  const k=x+','+y+','+z;
  if(CROPS[id]&&(meta&7))FARM.q.set(k,[x,y,z]);
  else if(CROPS[old])FARM.q.delete(k);
  if(CROPS[old]&&!CROPS[id])FARM.last={x,y,z,id:old,stage:cropStage(om)};
  if(NET.on&&(NET.ap||ntHosted()))return;
  if(old===B.FARMLAND&&id!==B.FARMLAND){
    const a=getBlock(x,y+1,z);
    if(CROPS[a]){setBlock(x,y+1,z,B.AIR);FARM.last=null;spawnDrop(x+0.5,y+1.3,z+0.5,{id:CROPS[a].seed,count:1},0,2,0);}
  }
  if(id!==B.AIR&&DEFS[id].solid!==false&&y>0&&getBlock(x,y-1,z)===B.FARMLAND)setBlock(x,y-1,z,B.DIRT);
}
/* a chunk was built: the crops in it that are still growing go on the list (they are all edits: wild ones are ripe) */
function farmResume(ch){
  if(FARM.dim!==DIM){FARM.dim=DIM;FARM.q.clear();}
  for(const [lk,v] of ch.edits){
    if(!CROPS[v&255]||!((v>>8)&7))continue;
    const p=lk.split(','),X=ch.cx*CH+ +p[0],Y=+p[1],Z=ch.cz*CH+ +p[2];
    FARM.q.set(X+','+Y+','+Z,[X,Y,Z]);
  }
}
/* once a second of play: every growing crop on watered farmland may grow a stage (rnd: 0..1, for the suites) */
function farmTick(dt,rnd){
  FARM.t+=dt;
  if(FARM.t<1)return;
  FARM.t-=1;
  if(FARM.dim!==DIM){FARM.dim=DIM;FARM.q.clear();return;}
  const R=rnd||Math.random;
  for(const [k,c] of FARM.q){
    const x=c[0],y=c[1],z=c[2];
    if(!chunkAt(x,z))continue;                             /* not loaded: it waits */
    const id=getBlock(x,y,z);
    if(!CROPS[id]){FARM.q.delete(k);continue;}
    if(NET.on&&ntSimHere(x,z)===false)continue;          /* on a server: only the game that runs this land grows it */
    if(getBlock(x,y-1,z)!==B.FARMLAND||!(getMeta(x,y-1,z)&8))continue;   /* dry: nothing grows */
    if(R()>=FARM.p)continue;
    const m=(getMeta(x,y,z)&7)-1;
    setBlock(x,y,z,id,m);
    if(m<=0)FARM.q.delete(k);
  }
}
/* forget everything (a new world, a loaded one) */
function farmReset(){FARM.q.clear();FARM.t=0;FARM.dim=null;FARM.last=null;}
