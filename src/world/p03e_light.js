/* ----- block light (6.26): every torch counts ----- */
/* The six nearest torches used to be the only ones that lit anything (a pool of six point lights). Now light is a
   property of the world. Beside its blocks a chunk keeps a light value per cell (ch.lt, 0 to 15). A torch gives 14, lava
   and glowstone 15, and light spreads to the six neighbours losing 1 a block, through anything that is not opaque.
   It is never saved: a chunk's light is worked out when the chunk is built (from the lights in it and the light at its
   neighbours' edges), and kept up by every block change (setBlock -> lightEdit: taking a light away un-floods what it
   lit and lets the lights around flow back in). The server's own game does none of this: it has nobody to see by.
   The mesher writes the light at every vertex (bufLight: the average of the cells that meet at that corner, on the open
   side of the face) into an attribute, blight, and the world's materials add it as a warm glow that shows at night and
   stands back by day (blightObc; the amount is a uniform, so nothing is re-meshed as the sun moves). Mobs take the glow
   of the cell they stand in. Purgatory keeps its own lights. */
const LGT={q:[],rq:[],dirty:new Set(),E:null,U:null,day:1,cap:20000,cx:0,cz:0,ch:null};
const LGT_N=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
/* how much light a block gives off, 0 to 15 (the table is made on first use, once every block is defined) */
function lightEmit(id){
  if(!LGT.E){
    LGT.E=new Uint8Array(256);
    for(let i=1;i<256;i++){
      const d=DEFS[i];
      if(!d)continue;
      LGT.E[i]=(i===B.LAVA||i===B.GLOWSTONE)?15:((d.light||isTorch(i))?14:0);
    }
  }
  return LGT.E[id&255];
}
/* the chunk a column is in, remembering the last one asked for (a flood asks for the same few thousands of times; the
   memory is dropped at the start of every job, so it never outlives a chunk) */
function lightCh(x,z){
  const cx=Math.floor(x/CH),cz=Math.floor(z/CH);
  if(LGT.ch&&cx===LGT.cx&&cz===LGT.cz)return LGT.ch;
  LGT.cx=cx;LGT.cz=cz;
  return LGT.ch=chunks.get(ckey(cx,cz))||null;
}
/* the light at a cell (0 outside the world, in an unbuilt chunk, and on the server's own game) */
function getLight(x,y,z){
  if(y<0||y>=WH)return 0;
  const ch=lightCh(x,z);
  return ch&&ch.lt?ch.lt[bidx(x-ch.cx*CH,y,z-ch.cz*CH)]:0;
}
/* set it (no-op where there is no light map); the chunk, and a neighbour whose edge this is, are due a new mesh */
function setLight(x,y,z,v){
  if(y<0||y>=WH)return;
  const ch=lightCh(x,z);
  if(!ch||!ch.lt)return;
  const cx=ch.cx,cz=ch.cz,lx=x-cx*CH,lz=z-cz*CH;
  ch.lt[bidx(lx,y,lz)]=v;
  if(v&&y>ch.ltTop)ch.ltTop=y;                              /* the highest lit cell this chunk has had: the mesher skips everything above it */
  LGT.dirty.add(ch);
  if(lx===0||lx===CH-1||lz===0||lz===CH-1){                 /* an edge: the chunk next door draws this corner too */
    if(lx===0)LGT.dirty.add(ckey(cx-1,cz));else if(lx===CH-1)LGT.dirty.add(ckey(cx+1,cz));
    if(lz===0)LGT.dirty.add(ckey(cx,cz-1));else if(lz===CH-1)LGT.dirty.add(ckey(cx,cz+1));
  }
}
/* does light pass through the block at a cell? */
function lightOpen(x,y,z){
  if(y<0||y>=WH)return false;
  const ch=lightCh(x,z);
  if(!ch||!ch.lt)return false;
  return !DEFS[ch.bl[bidx(x-ch.cx*CH,y,z-ch.cz*CH)]].opq;
}
/* spread: every cell waiting in LGT.q lights its darker neighbours, which wait in turn. At most LGT.cap cells a call:
   a very large change (a crater, a flood) is finished over the next frames (lightTick). */
function lightFlood(){
  const q=LGT.q;
  let i=0,n=0;
  while(i<q.length&&n<LGT.cap){
    const x=q[i],y=q[i+1],z=q[i+2];i+=3;n++;
    const v=getLight(x,y,z)-1;
    if(v<=0)continue;
    for(const o of LGT_N){
      const X=x+o[0],Y=y+o[1],Z=z+o[2];
      if(!lightOpen(X,Y,Z)||getLight(X,Y,Z)>=v)continue;
      setLight(X,Y,Z,v);q.push(X,Y,Z);
    }
  }
  if(i>=q.length)q.length=0;else q.splice(0,i);
}
/* take away: every cell waiting in LGT.rq (with the light it had) darkens the neighbours it had lit; a neighbour lit by
   something else is put in LGT.q to flow back */
function lightUnflood(){
  const q=LGT.rq;
  let i=0;
  while(i<q.length){
    const x=q[i],y=q[i+1],z=q[i+2],was=q[i+3];i+=4;
    for(const o of LGT_N){
      const X=x+o[0],Y=y+o[1],Z=z+o[2],nl=getLight(X,Y,Z);
      if(!nl)continue;
      if(nl<was){setLight(X,Y,Z,lightEmit(getBlock(X,Y,Z)));q.push(X,Y,Z,nl);if(getLight(X,Y,Z))LGT.q.push(X,Y,Z);}
      else LGT.q.push(X,Y,Z);
    }
  }
  q.length=0;
}
/* the chunks whose light changed are meshed again. soft (a new chunk's light flowing into the ones around it): they are
   marked 2, not true, and updateChunks builds every missing chunk before it redraws those; anything else that dirties a
   chunk writes true over it */
function lightFlush(soft){
  for(const k of LGT.dirty){const ch=typeof k==='string'?chunks.get(k):k;if(ch&&!(soft&&ch.dirty))ch.dirty=soft?2:true;}
  LGT.dirty.clear();LGT.ch=null;
}
/* The setBlock hook: the block at a cell changed. What the cell gave or passed on is taken back, then the cell is lit
   afresh: by what it gives off itself, and (if light passes through it) by its neighbours. */
function lightEdit(x,y,z){
  if(NET.host)return;
  LGT.ch=null;
  const ch=chunkAt(x,z);
  if(!ch||!ch.lt)return;
  const id=getBlock(x,y,z),was=getLight(x,y,z);
  if(was){setLight(x,y,z,0);LGT.rq.push(x,y,z,was);lightUnflood();}
  let v=lightEmit(id);
  if(!DEFS[id].opq)for(const o of LGT_N){const nl=getLight(x+o[0],y+o[1],z+o[2])-1;if(nl>v)v=nl;}
  if(v>0){setLight(x,y,z,v);LGT.q.push(x,y,z);}
  lightFlood();lightFlush();
}
/* The createChunk hook: a chunk was built. Its own lights are found and spread, and the light standing at the edges of
   the chunks around it flows in. */
function lightChunk(ch){
  if(NET.host)return;
  LGT.ch=null;
  const bl=ch.bl,lt=ch.lt=new Uint8Array(bl.length),x0=ch.cx*CH,z0=ch.cz*CH;
  ch.ltTop=-1;
  lightEmit(0);
  const E=LGT.E;
  for(let lx=0;lx<CH;lx++)for(let lz=0;lz<CH;lz++){
    const base=(lx*WH)*CH+lz;
    for(let y=0;y<WH;y++){const i=base+y*CH,e=E[bl[i]];if(e){lt[i]=e;if(y>ch.ltTop)ch.ltTop=y;LGT.q.push(x0+lx,y,z0+lz);}}
  }
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const nb=chunks.get(ckey(ch.cx+dx,ch.cz+dz));
    if(!nb||!nb.lt)continue;
    for(let a=0;a<CH;a++){
      const lx=dx?(dx>0?0:CH-1):a,lz=dz?(dz>0?0:CH-1):a;
      for(let y=0;y<WH;y++)if(nb.lt[bidx(lx,y,lz)]>1)LGT.q.push(nb.cx*CH+lx,y,nb.cz*CH+lz);
    }
  }
  lightFlood();lightFlush(true);
}
/* forget everything (a new world, a loaded one) */
function lightReset(){LGT.q.length=0;LGT.rq.length=0;LGT.dirty.clear();LGT.ch=null;}

/* ----- drawing it ----- */
/* The light at every vertex of a mesh buffer, 0 to 1, into b.l: the average over the cells that meet at the vertex on the
   open side of its face (one cell where the vertex is not on a corner), leaving out opaque ones. gl reads a light and gb
   a block, both in chunk-local coordinates. Done after the mesh is built, so every kind of block is lit the same way,
   whoever made its faces. top: no cell above this height is lit here or next door, so vertices above it are dark at once
   (most of a chunk, most of the time: the light is down in the caves, or round a few torches). C: the cells already
   looked up, shared between calls for one chunk (made here if not given). */
function bufLight(b,gl,gb,top,C){
  const n=b.vc,l=b.l=new Array(n),p=b.p,nm=b.n,c=[0,0,0],lo=[0,0,0],hi=[0,0,0],cut=top+2,W=CH+2,H=WH+2;
  if(!C)C=new Int8Array(W*W*H).fill(-2);
  /* a cell's light, or -1 if it is opaque: asked for once (C remembers; a chunk's three buffers share one C) */
  const cell=(x,y,z)=>{
    if(x<-1||x>CH||z<-1||z>CH||y<-1||y>WH)return DEFS[gb(x,y,z)].opq?-1:gl(x,y,z);
    const i=((x+1)*W+z+1)*H+y+1;
    let v=C[i];
    if(v===-2)v=C[i]=DEFS[gb(x,y,z)].opq?-1:gl(x,y,z);
    return v;
  };
  for(let i=0;i<n;i++){
    if(p[i*3+1]>cut){l[i]=0;continue;}
    const j=i*3,ax=Math.abs(nm[j]),ay=Math.abs(nm[j+1]),az=Math.abs(nm[j+2]),a=ay>=ax&&ay>=az?1:(ax>=az?0:2);
    for(let t=0;t<3;t++){
      const v=p[j+t];
      if(t===a){lo[t]=hi[t]=nm[j+t]>0?Math.floor(v+1e-4):Math.floor(v-1e-4);}
      else if(Math.abs(v-Math.round(v))<1e-4){hi[t]=Math.round(v);lo[t]=hi[t]-1;}
      else lo[t]=hi[t]=Math.floor(v);
    }
    let sum=0,cnt=0;
    for(c[0]=lo[0];c[0]<=hi[0];c[0]++)for(c[1]=lo[1];c[1]<=hi[1];c[1]++)for(c[2]=lo[2];c[2]<=hi[2];c[2]++){
      const v=cell(c[0],c[1],c[2]);
      if(v<0)continue;
      sum+=v;cnt++;
    }
    l[i]=cnt?sum/cnt/15:0;
  }
}
/* The shader patch for the world's materials: the vertex's light arrives as blight, and the fragment adds
   colour x blight^1.6 x uBlCol just before fog. uBlCol is the warm torch colour times how dark it is. Each replace is a
   no-op if its marker is not there, so a material this does not fit is left as it was. */
function blightObc(sh){
  sh.uniforms.uBlCol=LGT.U;
  const rep=(s,a,b)=>s.indexOf(a)>=0?s.replace(a,b):s;
  let v=sh.vertexShader,f=sh.fragmentShader;
  v=rep(v,'#include <common>','#include <common>\nattribute float blight;\nvarying float vBl;');
  v=rep(v,'#include <begin_vertex>','#include <begin_vertex>\nvBl=blight;');
  f=rep(f,'#include <common>','#include <common>\nvarying float vBl;\nuniform vec3 uBlCol;');
  f=rep(f,'#include <fog_fragment>','gl_FragColor.rgb+=diffuseColor.rgb*pow(max(vBl,0.0),1.6)*uBlCol;\n#include <fog_fragment>');
  sh.vertexShader=v;sh.fragmentShader=f;
}
/* the same, as the two pieces the Hyperreal world shader needs (it has its own patch: tA_world.js adds these to it) */
const BLIGHT_VP='attribute float blight;\nvarying float vBl;\n',BLIGHT_VM='vBl=blight;\n',BLIGHT_FP='varying float vBl;\nuniform vec3 uBlCol;\n',
  BLIGHT_FE='totalEmissiveRadiance+=diffuseColor.rgb*pow(max(vBl,0.0),1.6)*uBlCol;\n';
/* give a material the patch (at boot, for the three OG world materials) */
function blightPatch(m){
  if(!LGT.U)LGT.U={value:new THREE.Vector3(1,0.78,0.48)};
  m.onBeforeCompile=blightObc;
  m.customProgramCacheKey=()=>'blight1';
  return m;
}
/* how much of the torch glow shows: all of it at night, a quarter by day (0 night .. 1 day) */
function lightDay(t){return clamp(Math.sin(t*Math.PI*2)*4+0.4,0,1);}
/* once a frame (from updateChunks): finish any spreading left over, set the glow for the hour, tint the mobs */
function lightTick(){
  if(NET.host)return;
  LGT.ch=null;
  if(LGT.q.length){lightFlood();lightFlush(true);}
  const k=1-0.75*lightDay(timeOfDay);
  LGT.day=k;
  if(LGT.U)LGT.U.value.set(k,0.78*k,0.48*k);
  if(frameCount%6)return;
  for(const e of entities){
    if(e.dead||e.t!=='mob'||!e.mats||e.hrM||e.hurtT>0.2||e.fuse>0||(e.pfl&2))continue;
    const w=Math.pow(getLight(Math.floor(e.x),Math.floor(e.y+0.5),Math.floor(e.z))/15,1.6)*k*0.4;
    if(e.ltW===w)continue;
    e.ltW=w;
    for(const m of e.mats)m.emissive&&m.emissive.setRGB(w,w*0.78,w*0.48);
  }
}
