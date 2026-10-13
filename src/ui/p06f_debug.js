/* ----- the debug screen (6.22): what F3 shows, hitboxes (F3+B), chunk borders (F3+G) ----- */
/* F3 toggles the screen when it is let go, and only if no other key was pressed while it was down: F3+B and F3+G are
   combos, and work whether the screen is showing or not. Neither toggle is saved.
   Two things are counted for it and saved with the world: how long the world has been played (WAGE, seconds) and how long
   a player has spent in each chunk (INHAB). They feed the "local difficulty" line, which is the usual regional-difficulty
   sum (the longer a world and a chunk have been lived in, the higher). It is only shown: nothing spawns by it. */
const DBG={held:false,combo:false,boxes:false,borders:false,pool:[],used:0,geo:null,dir:null,mat:null,cb:null,cbKey:''};
var WAGE=0;
const INHAB=new Map();

/* the two counters as save fields (the chunk times only once there are any) */
function dbgSaveFields(){
  const o={age:+WAGE.toFixed(1)};
  if(INHAB.size){o.inhab={};for(const [k,v] of INHAB)o.inhab[k]=+v.toFixed(1);}
  return o;
}
/* ...and back; an old save has neither */
function dbgLoad(d){
  WAGE=+(d&&d.age)||0;
  INHAB.clear();
  const h=d&&d.inhab;
  if(h&&typeof h==='object')for(const k of Object.keys(h))if(h[k]>0)INHAB.set(k,+h[k]);
}
/* where the player is, by chunk: {cx, cz, sy (16-block section), lx, ly, lz (inside the chunk and section)} */
function dbgSection(x,y,z){
  const bx=Math.floor(x),by=Math.floor(y),bz=Math.floor(z),cx=Math.floor(bx/CH),cz=Math.floor(bz/CH),sy=Math.floor(by/16);
  return {bx,by,bz,cx,cz,sy,lx:bx-cx*CH,ly:by-sy*16,lz:bz-cz*CH};
}
/* which way a yaw looks: forward is (-sin yaw, -cos yaw), so 0 is north (-z) and a quarter turn to the left is west */
function dbgFacing(yaw){
  const fx=-Math.sin(yaw),fz=-Math.cos(yaw);
  return Math.abs(fx)>Math.abs(fz)?(fx>0?'east (+X)':'west (-X)'):(fz>0?'south (+Z)':'north (-Z)');
}
/* Local difficulty: [raw, clamped]. diff is 2 (normal), or 0 with Peaceful on; ageS and inhabS are seconds, counted at 20
   ticks a second; moon is how bright the moon is, 0..1 (this game has no phases: 1). */
function dbgDifficulty(diff,ageS,inhabS,moon){
  if(!(diff>0))return [0,0];
  const g=clamp((ageS*20-72000)/1440000,0,1)*0.25;
  let h=clamp(inhabS*20/3600000,0,1)*(diff===3?1:0.75)+clamp((moon==null?1:moon)*0.25,0,g);
  if(diff===1)h*=0.5;
  const raw=diff*(0.75+g+h);
  return [raw,raw<2?0:(raw>4?1:(raw-2)/2)];
}
/* memory in use, where the browser tells (Chromium does); "n/a" elsewhere, and never an error */
function dbgMemory(){
  try{
    const m=typeof performance!=='undefined'&&performance.memory;
    if(!m||!(m.usedJSHeapSize>0))return 'n/a';
    const mb=v=>Math.round(v/1048576);
    return mb(m.usedJSHeapSize)+' / '+mb(m.totalJSHeapSize)+' MB (limit '+mb(m.jsHeapSizeLimit)+' MB)';
  }catch(e){return 'n/a';}
}
/* everything the debug screen says, as text */
function dbgText(){
  const s=dbgSection(P.x,P.y,P.z),bi=colInfo(s.bx,s.bz);
  const ld=dbgDifficulty(GR.mobSpawn===false?0:2,WAGE,INHAB.get(ckey(s.cx,s.cz))||0,1);
  const deg=v=>(v*180/Math.PI).toFixed(1);
  return 'DINGLECRAFT '+RELEASE_LABEL+'  '+fpsShow+' fps\n'+
    'XYZ: '+P.x.toFixed(3)+' / '+P.y.toFixed(3)+' / '+P.z.toFixed(3)+'\n'+
    'Block: '+s.bx+' '+s.by+' '+s.bz+'\n'+
    'Facing: '+dbgFacing(P.yaw)+' (yaw '+deg(P.yaw)+' / pitch '+deg(P.pitch)+', up is positive)\n'+
    'Chunk: '+s.cx+' '+s.cz+'  Section: '+s.sy+'  In chunk: '+s.lx+' '+s.ly+' '+s.lz+'\n'+
    'Biome: '+BIOME_NAME[bi.b]+'  Seed: '+SEED+'\n'+
    'Local Difficulty: '+ld[0].toFixed(2)+' // '+ld[1].toFixed(2)+' (Day '+(Math.floor(WAGE/DAY_LEN)+1)+')\n'+
    'Memory: '+dbgMemory()+'\n'+
    'Chunks: '+chunks.size+'  Entities: '+entities.length+'\n'+
    'Time: '+(timeOfDay%1).toFixed(2)+'  Mode: '+(P.mode==='c'?'Creative':'Survival')+'\n'+
    'Hitboxes (F3+B): '+(DBG.boxes?'on':'off')+'  Chunk borders (F3+G): '+(DBG.borders?'on':'off');
}

/* ----- the keys ----- */
/* a key went down while playing. true = it was F3's business (the caller does nothing else with it). */
function dbgKeyDown(e){
  if(e.code==='F3'){if(e.preventDefault)e.preventDefault();if(!DBG.held){DBG.held=true;DBG.combo=false;}return true;}
  if(!DBG.held)return false;
  if(e.code==='KeyB'){if(e.preventDefault)e.preventDefault();DBG.combo=true;dbgBoxes(!DBG.boxes);return true;}
  if(e.code==='KeyG'){if(e.preventDefault)e.preventDefault();DBG.combo=true;dbgBorders(!DBG.borders);return true;}
  DBG.combo=true;                                         /* any other key spoils the plain F3, as it should */
  return false;
}
/* a key came up */
function dbgKeyUp(e){
  if(e.code!=='F3'||!DBG.held)return;
  DBG.held=false;
  if(!DBG.combo)debugOn=!debugOn;
}

/* ----- hitboxes ----- */
/* the line object type (the headless suites have no LineSegments: any object will do there) */
function dbgLine(geo,mat){return new (THREE.LineSegments||THREE.Mesh)(geo,mat);}
/* the shared shapes: a unit wire box standing on the origin, a unit line pointing north, one material */
function dbgShapes(){
  if(DBG.geo)return;
  const c=[[-.5,0,-.5],[.5,0,-.5],[.5,0,.5],[-.5,0,.5],[-.5,1,-.5],[.5,1,-.5],[.5,1,.5],[-.5,1,.5]];
  const ed=[0,1,1,2,2,3,3,0,4,5,5,6,6,7,7,4,0,4,1,5,2,6,3,7],p=[];
  for(const i of ed)p.push(c[i][0],c[i][1],c[i][2]);
  DBG.geo=new THREE.BufferGeometry();DBG.geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(p),3));
  DBG.dir=new THREE.BufferGeometry();DBG.dir.setAttribute('position',new THREE.BufferAttribute(new Float32Array([0,0,0,0,0,-1]),3));
  DBG.mat=new THREE.LineBasicMaterial({color:0xffffff});
}
/* one box (and its facing line) from the pool, made if the pool is short */
function dbgBoxAt(x,y,z,hw,h,yaw,north){
  let o=DBG.pool[DBG.used];
  if(!o){o={box:dbgLine(DBG.geo,DBG.mat),dir:dbgLine(DBG.dir,DBG.mat)};o.box.userData.dbg=o.dir.userData.dbg=true;scene.add(o.box);scene.add(o.dir);DBG.pool.push(o);}
  DBG.used++;
  o.box.visible=true;o.box.position.set(x,y,z);o.box.scale.set(hw*2,h,hw*2);
  if(yaw==null){o.dir.visible=false;return;}
  o.dir.visible=true;o.dir.position.set(x,y+h*0.85,z);o.dir.rotation.y=yaw;o.dir.scale.set(1,1,north?1:-1);
}
/* hitboxes on or off; off gives everything back */
function dbgBoxes(on){
  DBG.boxes=!!on;
  if(DBG.boxes||!scene)return;
  for(const o of DBG.pool){scene.remove(o.box);scene.remove(o.dir);}
  DBG.pool.length=0;DBG.used=0;
}
/* every frame while they are on: a box for each thing with a size (mobs, drops, vehicles, puppets) and each other player */
function dbgBoxesTick(){
  dbgShapes();
  DBG.used=0;
  for(const e of entities){
    if(e.dead||!(e.hw>0)||!(e.h>0))continue;
    dbgBoxAt(e.x,e.y,e.z,e.hw,e.h,e.t==='mob'?(e.yaw||0):null,false);   /* a mob's face is on its +z side */
  }
  if(NET.on)for(const p of NET.peers.values())if(p.has&&p.dim===DIM&&!(p.fl&4))dbgBoxAt(p.x,p.y,p.z,0.3,1.8,p.yaw,true);
  for(let i=DBG.used;i<DBG.pool.length;i++){DBG.pool[i].box.visible=false;DBG.pool[i].dir.visible=false;}
}

/* ----- chunk borders ----- */
/* The lines of one chunk and its eight neighbours, built once around the origin and moved when the player changes chunk:
   the four corner posts and the section rings (every 16 blocks up) of the middle chunk, and the neighbours' outer posts,
   fainter. */
function dbgBorders(on){
  DBG.borders=!!on;
  if(!scene)return;
  if(!DBG.borders){if(DBG.cb){scene.remove(DBG.cb);if(DBG.cb.traverse)DBG.cb.traverse(o=>{if(o.geometry&&o.geometry.dispose)o.geometry.dispose();if(o.material&&o.material.dispose)o.material.dispose();});DBG.cb=null;}DBG.cbKey='';return;}
  if(DBG.cb)return;
  const near=[],far=[],post=(a,x,z)=>a.push(x,0,z,x,WH,z);
  for(const x of [0,CH])for(const z of [0,CH])post(near,x,z);
  for(let y=0;y<=WH;y+=16)near.push(0,y,0,CH,y,0, CH,y,0,CH,y,CH, CH,y,CH,0,y,CH, 0,y,CH,0,y,0);
  for(const x of [-CH,0,CH,2*CH])for(const z of [-CH,0,CH,2*CH])if(x<0||x>CH||z<0||z>CH)post(far,x,z);
  const mk=(p,col,op)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(p),3));
    return dbgLine(g,new THREE.LineBasicMaterial({color:col,transparent:op<1,opacity:op}));};
  DBG.cb=new THREE.Group();DBG.cb.add(mk(near,0xffe14d,1));DBG.cb.add(mk(far,0xff5a4d,0.5));
  DBG.cb.userData.dbg=true;
  scene.add(DBG.cb);DBG.cbKey='';
}
/* move them when the player has changed chunk */
function dbgBordersTick(){
  if(!DBG.cb)return;
  const cx=Math.floor(Math.floor(P.x)/CH),cz=Math.floor(Math.floor(P.z)/CH),k=cx+','+cz;
  if(k===DBG.cbKey)return;
  DBG.cbKey=k;DBG.cb.position.set(cx*CH,0,cz*CH);
}

/* once a frame (from drawDebug): the two counters while the world is running, and the overlays that are on */
function dbgTick(dt){
  if(!paused&&dt>0){
    WAGE+=dt;
    const k=ckey(Math.floor(Math.floor(P.x)/CH),Math.floor(Math.floor(P.z)/CH));
    INHAB.set(k,(INHAB.get(k)||0)+dt);
  }
  if(DBG.boxes)dbgBoxesTick();
  if(DBG.borders)dbgBordersTick();
}
