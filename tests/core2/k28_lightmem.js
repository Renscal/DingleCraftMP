/* k28_lightmem.js (v6.65, lane CORE2, gate x1): the light's memory of chunks (lightCh in src/world/p03e_light.js) and the
   ground finder (surfaceTop in src/world/p03c_chunk_store.js), both made faster in 6.65 without changing an answer.
   1 lightCh remembers two chunks: asked back and forth between two, and round three, it always gives the chunk the map
     holds there
   2 dropping its memory (LGT.ch=null, what every job starts with) drops both: a chunk swapped in the map is found
   3 a change of dimension drops it: the Overworld's chunk is not given back in the Nether; every other place that lets
     chunks go drops it too (read from the source)
   4 the light is what 6.64 worked out: an 8 x 8 block of new chunks far away has the block and sky light of the golden
     hash (made with 6.64's lightCh), and lighting them again in the other order comes to the same
   5 surfaceTop finds the same height as a plain column search, over 400 columns, with a block placed near the top of the
     world and a torch (not solid) standing on the ground */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const {readSrc}=require('../lib/paths.js');
const V=boot({seed:65});
const step=boot.stepper(600000);
const GOLD=-1865794280;                  /* the hash of section 4, made with the 6.64 build */

boot.run(async()=>{
  const B=V.B,LGT=V.LGT,CH=16;
  ok('the seams are on __vox',['lightCh','lightChunk','surfaceTop','setDim','forceChunksNear','getBlock'].every(k=>typeof V[k]==='function')&&!!LGT&&!!V.chunks);
  V.startNewWorld('lightmem','6650','c');V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;step(100);
  const P=V.P;P.flying=true;
  const pcx=Math.floor(P.x/CH),pcz=Math.floor(P.z/CH);
  V.forceChunksNear(P.x,P.z);
  const at=(cx,cz)=>V.chunks.get(cx+','+cz);
  const A=[pcx,pcz],Bc=[pcx+1,pcz],C=[pcx,pcz+1];

  /* ===== 1. two remembered ===== */
  ok('the three chunks are built',!!at(...A)&&!!at(...Bc)&&!!at(...C));
  LGT.ch=null;
  {let good=true;
    for(let i=0;i<40;i++){const c=i%2?Bc:A;if(V.lightCh(c[0]*CH+(i%CH),c[1]*CH+3)!==at(...c))good=false;}
    ok('back and forth between two chunks, 40 times: always the chunk the map holds',good);
    good=true;
    for(let i=0;i<60;i++){const c=[A,Bc,C][i%3];if(V.lightCh(c[0]*CH+5,c[1]*CH+(i%CH))!==at(...c))good=false;}
    ok('round three chunks, 60 times: always the right one',good);
    good=true;
    for(let i=0;i<30;i++){const c=[A,A,Bc,C,Bc,A][i%6];if(V.lightCh(c[0]*CH+7,c[1]*CH+7)!==at(...c))good=false;}
    ok('in an uneven order: always the right one',good);
    ok('a column in no built chunk is null',V.lightCh(1e6,1e6)===null&&V.lightCh(A[0]*CH,A[1]*CH)===at(...A));}

  /* ===== 2. dropping the memory drops both ===== */
  {V.lightCh(A[0]*CH,A[1]*CH);V.lightCh(Bc[0]*CH,Bc[1]*CH);   /* both remembered */
    const kA=A[0]+','+A[1],kB=Bc[0]+','+Bc[1],realA=at(...A),realB=at(...Bc),fakeA={...realA},fakeB={...realB};
    LGT.ch=null;V.chunks.set(kA,fakeA);V.chunks.set(kB,fakeB);
    const gotB=V.lightCh(Bc[0]*CH,Bc[1]*CH),gotA=V.lightCh(A[0]*CH,A[1]*CH);
    V.chunks.set(kA,realA);V.chunks.set(kB,realB);LGT.ch=null;
    ok('after LGT.ch=null neither remembered chunk is given: the map is asked again for both',gotA===fakeA&&gotB===fakeB);}

  /* ===== 3. letting chunks go ===== */
  {const old=at(...A);
    V.lightCh(A[0]*CH,A[1]*CH);V.lightCh(Bc[0]*CH,Bc[1]*CH);
    V.setDim('nether',P.x,40,P.z);
    const got=V.lightCh(A[0]*CH,A[1]*CH),gotB=V.lightCh(Bc[0]*CH,Bc[1]*CH);
    ok('in the Nether the Overworld chunks at the same place are not given back',got!==old&&gotB!==old&&got===(V.chunks.get('n;'+A[0]+','+A[1])||null));
    V.setDim('over',P.x,60,P.z);step(30);}
  {const files=['world/p03d_mesher.js','net/n8_host.js','world/p37_dimensions.js'];
    let sites=0,bad=[];
    for(const f of files){const s=readSrc(f).split('\n');s.forEach((l,i)=>{if(/chunks\.(delete|clear)\(/.test(l)){sites++;if(!/LGT\.ch=null/.test(l))bad.push(f+':'+(i+1));}});}
    const sl=readSrc('core/p07e_save_load.js'),ri=sl.indexOf('lightReset();'),ci=sl.indexOf('chunks.clear();');
    ok('every place that lets chunks go drops the light memory on the same line ('+sites+' places'+(bad.length?'; not: '+bad.join(', '):'')+')',sites===3&&!bad.length);
    ok('...and a new world resets the light before it clears the chunks',ri>0&&ci>ri);}

  /* ===== 4. the light itself ===== */
  {const N=8,cx0=300,cz0=-300;
    for(let i=0;i<N;i++)for(let j=0;j<N;j++)V.forceChunksNear((cx0+i)*CH+8,(cz0+j)*CH+8);
    const hash=()=>{let h=0;for(let i=0;i<N;i++)for(let j=0;j<N;j++){const ch=at(cx0+i,cz0+j);for(const a of [ch.lt,ch.sl])for(let k=0;k<a.length;k++)h=(Math.imul(h,31)+a[k])|0;}return h;};
    const all=[];for(let i=0;i<N;i++)for(let j=0;j<N;j++)all.push(at(cx0+i,cz0+j));
    const h1=hash();
    ok('the block and sky light of 64 new chunks is what 6.64 worked out (hash '+h1+')',h1===GOLD);
    for(const ch of all.slice().reverse())V.lightChunk(ch);
    const h2=hash();
    ok('lighting them again, the last first, comes to the same ('+h2+')',h2===h1);}

  /* ===== 5. surfaceTop ===== */
  {const ref=(x,z)=>{for(let y=79;y>=0;y--){const id=V.getBlock(x,y,z);if(id!==B.AIR&&V.DEFS[id].solid!==false)return y;}return 0;};
    const x0=A[0]*CH,z0=A[1]*CH;
    V.setBlock(x0+2,75,z0+2,B.STONE);
    const g=ref(x0+9,z0+9);V.setBlock(x0+9,g+1,z0+9,B.TORCH);
    let good=0,first='';
    for(let i=0;i<400;i++){const x=x0-16+(Math.imul(i,7919)>>>0)%48,z=z0-16+(Math.imul(i,104729)>>>0)%48,a=V.surfaceTop(x,z),r=ref(x,z);if(a===r)good++;else if(!first)first=x+','+z+': '+a+' not '+r;}
    ok('400 columns: surfaceTop is the highest solid block, as a plain search finds it ('+good+'/400'+(first?'; '+first:'')+')',good===400);
    ok('...a block at y 75 is found, a torch on the ground is not',V.surfaceTop(x0+2,z0+2)===75&&V.surfaceTop(x0+9,z0+9)===g);}
});
