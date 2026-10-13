/* k8_light.js (v6.26, lane CORE2, gate x1): block light (src/world/p03e_light.js). Headless: the light map and the mesh
   attribute are checked as numbers, and the shader patch as text; how it looks on a screen is not checked here.
   1 one torch in a sealed dark room: 14 at the torch, 13 beside it, one less a block by the shortest way round, 0 at 14
   2 fifty torches: every one of them is lit (the old limit was six)
   3 taking a torch away takes its light away; a second torch nearby keeps its own
   4 an opaque block set in a corridor cuts the light off behind it; taking it out lets the light back
   5 light crosses a chunk border
   6 lava gives 15; glowstone gives 15 (and is opaque itself)
   7 the mesher writes the light at each vertex, and it matches the light map there
   8 a save does not hold light: it is worked out again on load and comes to the same
   9 a block edit arriving from another player updates the light here
   10 the shader patch: the text it adds, on materials that have the markers and not on ones that do not; the OG pool of
      point lights is dark outside Purgatory; the server's own game keeps no light at all
   11 the cost: mesher time with and without the light pass */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:26});
const step=boot.stepper(600000);

boot.run(async()=>{
  const B=V.B,LGT=V.LGT,L=(x,y,z)=>V.lightAt(x,y,z);
  ok('the seams are on __vox',['lightEmit','lightAt','lightEdit','lightChunk','bufLight','blightObc','lightDay'].every(k=>typeof V[k]==='function')&&!!LGT);
  V.startNewWorld('lit','1337','c');V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;step(100);
  let P=V.P;P.flying=true;
  /* a block of solid stone high in the air, with whatever is carved out of it sealed inside */
  const ox=Math.floor(P.x)-20,oz=Math.floor(P.z)-8,oy=44,W=40,H=9,D=17;
  const solid=()=>{for(let x=0;x<W;x++)for(let y=0;y<H;y++)for(let z=0;z<D;z++)V.setBlock(ox+x,oy+y,oz+z,B.STONE);step(2);};
  const air=(x0,x1,y0,y1,z0,z1)=>{for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)V.setBlock(ox+x,oy+y,oz+z,B.AIR);};
  P.x=ox+W/2;P.z=oz+D/2;P.y=oy+H+4;step(60);

  /* ===== 1. one torch in a dark room ===== */
  solid();air(1,W-2,1,3,8,8);                               /* a corridor 38 long, 3 high, 1 wide */
  ok('a sealed corridor in solid stone is dark',L(ox+5,oy+1,oz+8)===0&&L(ox+20,oy+2,oz+8)===0);
  V.setBlock(ox+3,oy+1,oz+8,B.TORCH);step(2);
  {let good=true;for(let d=0;d<=16;d++){const want=Math.max(0,14-d);if(L(ox+3+d,oy+1,oz+8)!==want)good=false;}
    ok('one torch: 14 where it stands, 13 beside it, one less every block, 0 from 14 blocks on',good&&L(ox+3,oy+1,oz+8)===14&&L(ox+4,oy+1,oz+8)===13&&L(ox+17,oy+1,oz+8)===0);
    ok('...counted by the shortest way: one up is 13, one up and one along is 12; inside the stone, nothing',L(ox+3,oy+2,oz+8)===13&&L(ox+4,oy+2,oz+8)===12&&L(ox+3,oy+1,oz+9)===0&&L(ox+3,oy+0,oz+8)===0);}
  solid();air(1,10,1,3,3,3);air(10,10,1,3,3,9);air(1,10,1,3,9,9);   /* a U: along, round the corner, and back */
  V.setBlock(ox+1,oy+1,oz+3,B.TORCH);step(2);
  ok('round a wall the light goes the long way: 9 along and 6 across is 15 steps, so the far arm starts dark',L(ox+10,oy+1,oz+3)===5&&L(ox+10,oy+1,oz+8)===0&&L(ox+1,oy+1,oz+9)===0);

  /* ===== 2. fifty torches ===== */
  solid();air(1,W-2,1,3,2,14);
  {const at=[];for(let i=0;i<50;i++)at.push([ox+2+(i%10)*3+ (i%2),oy+1,oz+3+Math.floor(i/10)*2]);
    for(const t of at)V.setBlock(t[0],t[1],t[2],B.TORCH);step(3);
    const lit=at.filter(t=>V.getBlock(t[0],t[1],t[2])===B.TORCH&&L(t[0],t[1],t[2])===14).length,mid=L(ox+15,oy+3,oz+8),end=L(ox+30,oy+2,oz+12);
    ok('fifty torches in one room: all fifty are lit, and the room is bright from end to end (the old limit was six) ['+lit+' lit, '+mid+' in the middle, '+end+' at the end]',lit===50&&mid>=10&&end>=10);
    ok('the old pool of six point lights is dark: it is not what lights the room',V.getTLIGHTS().length===6&&(step(20),V.getTLIGHTS().every(l=>l.intensity===0)));}

  /* ===== 3. taking a torch away ===== */
  solid();air(1,W-2,1,3,8,8);
  V.setBlock(ox+3,oy+1,oz+8,B.TORCH);V.setBlock(ox+12,oy+1,oz+8,B.TORCH);step(2);
  ok('two torches nine blocks apart: between them each cell has the brighter of the two',L(ox+7,oy+1,oz+8)===10&&L(ox+8,oy+1,oz+8)===10&&L(ox+10,oy+1,oz+8)===12);
  V.setBlock(ox+3,oy+1,oz+8,B.AIR);step(2);
  ok('take the first away: its end goes dark, and the second still lights its own reach',L(ox+12,oy+1,oz+8)===14&&L(ox+3,oy+1,oz+8)===5&&L(ox+1,oy+1,oz+8)===3&&L(ox+7,oy+1,oz+8)===9);
  V.setBlock(ox+12,oy+1,oz+8,B.AIR);step(2);
  {let dark=true;for(let x=1;x<=W-2;x++)for(let y=1;y<=3;y++)if(L(ox+x,oy+y,oz+8))dark=false;
    ok('take the second away: nothing is left lit',dark&&LGT.q.length===0&&LGT.rq.length===0);}

  /* ===== 4. a block in the way ===== */
  V.setBlock(ox+3,oy+1,oz+8,B.TORCH);step(2);
  {const before=L(ox+8,oy+1,oz+8);for(let y=1;y<=3;y++)V.setBlock(ox+6,oy+y,oz+8,B.STONE);step(2);
    ok('a wall across the corridor cuts the light off behind it',before===9&&L(ox+5,oy+1,oz+8)===12&&L(ox+7,oy+1,oz+8)===0&&L(ox+8,oy+1,oz+8)===0);
    V.setBlock(ox+6,oy+2,oz+8,B.AIR);step(2);
    ok('one block out of the wall: the light comes through the gap and on down the corridor',L(ox+6,oy+2,oz+8)===10&&L(ox+7,oy+2,oz+8)===9&&L(ox+7,oy+1,oz+8)===8);
    V.setBlock(ox+6,oy+2,oz+8,B.GLASS);step(2);
    ok('glass in the gap lets it through just the same',L(ox+7,oy+2,oz+8)===9);}

  /* ===== 5. across a chunk border ===== */
  {const bx=Math.floor((ox+10)/16)*16+16;                    /* the first chunk border east of the room's west end */
    solid();air(1,W-2,1,3,8,8);
    V.setBlock(bx-3,oy+1,oz+8,B.TORCH);step(2);
    ok('light crosses a chunk border as if it were not there',V.chunkAt(bx-1,oz+8)!==V.chunkAt(bx,oz+8)&&L(bx-1,oy+1,oz+8)===12&&L(bx,oy+1,oz+8)===11&&L(bx+3,oy+1,oz+8)===8);}

  /* ===== 6. lava and glowstone ===== */
  solid();air(1,W-2,1,3,8,8);
  V.setBlock(ox+5,oy+1,oz+8,B.LAVA,0);V.LIQ.l.clear();step(2);
  ok('lava gives 15',V.lightEmit(B.LAVA)===15&&L(ox+5,oy+1,oz+8)===15&&L(ox+6,oy+1,oz+8)===14);
  V.setBlock(ox+5,oy+1,oz+8,B.AIR);V.setBlock(ox+20,oy+0,oz+8,B.GLOWSTONE);step(2);
  ok('glowstone gives 15 too, set in the floor: the cell above it is 14',V.lightEmit(B.GLOWSTONE)===15&&V.lightEmit(B.TORCH)===14&&V.lightEmit(B.STONE)===0&&L(ox+20,oy+0,oz+8)===15&&L(ox+20,oy+1,oz+8)===14&&L(ox+5,oy+1,oz+8)===0);
  V.setBlock(ox+20,oy+0,oz+8,B.STONE);step(2);

  /* ===== 7. the mesh ===== */
  V.setBlock(ox+20,oy+1,oz+8,B.TORCH);step(2);
  {const ch=V.chunkAt(ox+18,oz+8),b=V.meshChunk(ch).op,lx=ox+18-ch.cx*16,lz=oz+8-ch.cz*16;
    ok('the mesher writes a light value for every vertex, between 0 and 1',Array.isArray(b.l)&&b.l.length===b.vc&&b.l.every(v=>v>=0&&v<=1)&&b.l.some(v=>v>0));
    /* the floor of the corridor two blocks from the torch: its top face looks up into cells lit 12 (above it) and its neighbours */
    let got=[];for(let q=0;q<b.vc/4;q++){if(b.n[q*12+1]!==1)continue;const ys=[0,1,2,3].map(i=>b.p[q*12+i*3+1]);if(!ys.every(y=>y===oy+1))continue;
      const xs=[0,1,2,3].map(i=>b.p[q*12+i*3]),zs=[0,1,2,3].map(i=>b.p[q*12+i*3+2]);
      if(Math.min(...xs)===lx&&Math.min(...zs)===lz)for(let i=0;i<4;i++)got.push([xs[i]-lx,zs[i]-lz,b.l[q*4+i]]);}
    if(lx>=1&&lx<=14&&lz>=1&&lz<=14){
      /* a corner of that face touches the corridor cells on either side along x (the cells across z are stone) */
      const want=(dx)=>(L(ox+18+dx-1,oy+1,oz+8)+L(ox+18+dx,oy+1,oz+8))/2/15;
      ok('at each corner it is the average of the open cells that meet there: for the floor two blocks from a torch, the two corridor cells either side of the corner',got.length===4&&got.every(g=>Math.abs(g[2]-want(g[0]))<1e-9)&&got.some(g=>g[2]>0.8));
    }else boot.skip('the corner averages','the test corridor straddles a chunk border here');
    const far=V.meshChunk(V.chunkAt(ox+18,oz+8)).op;
    ok('a vertex well above every lit cell is dark without being looked up',far.l.filter((v,i)=>far.p[i*3+1]>ch.ltTop+2).every(v=>v===0));}

  /* ===== 8. saves ===== */
  {const s=JSON.parse(JSON.stringify(V.snapshot('lit')));
    ok('a save holds no light: only the blocks',!JSON.stringify(Object.keys(s)).includes('lt')&&!('light' in s));
    const before=[3,8,14,20,21,26].map(d=>L(ox+d,oy+1,oz+8));
    V.applySave(s);P=V.P;P.flying=true;P.mode='c';step(80);
    ok('loading it works the light out again, to the same values',JSON.stringify([3,8,14,20,21,26].map(d=>L(ox+d,oy+1,oz+8)))===JSON.stringify(before)&&before[3]===14);}

  /* ===== 9. an edit from another player ===== */
  {const x=ox+30,y=oy+1,z=oz+8,ck=Math.floor(x/16)+','+Math.floor(z/16),lk=(x-Math.floor(x/16)*16)+','+y+','+(z-Math.floor(z/16)*16);
    const was=L(x,y,z);V.ntApplyEdit(ck,lk,B.TORCH,false,false);step(2);
    ok('a torch another player places lights up here',was<14&&L(x,y,z)===14&&L(x+1,y,z)===13);
    V.ntApplyEdit(ck,lk,B.AIR,false,false);step(2);
    ok('...and goes out here when they take it',L(x,y,z)===was);}

  /* ===== 10. the shader, the pool, the server ===== */
  {const sh={uniforms:{},vertexShader:'#include <common>\nvoid main(){\n#include <begin_vertex>\n}',fragmentShader:'#include <common>\nvoid main(){\n#include <fog_fragment>\n}'};
    V.blightObc(sh);
    ok('the patch adds the attribute and passes it on in the vertex shader',sh.vertexShader.includes('attribute float blight;')&&sh.vertexShader.includes('varying float vBl;')&&sh.vertexShader.indexOf('vBl=blight;')>sh.vertexShader.indexOf('#include <begin_vertex>'));
    ok('...and adds colour x light^1.6 x the glow just before fog in the fragment shader',sh.fragmentShader.includes('uniform vec3 uBlCol;')&&sh.fragmentShader.indexOf('gl_FragColor.rgb+=diffuseColor.rgb*pow(max(vBl,0.0),1.6)*uBlCol;')<sh.fragmentShader.indexOf('#include <fog_fragment>')&&sh.fragmentShader.indexOf('gl_FragColor.rgb+=')>0&&sh.uniforms.uBlCol===LGT.U);
    const odd={uniforms:{},vertexShader:'void main(){}',fragmentShader:'void main(){}'};V.blightObc(odd);
    ok('a shader without the markers is left exactly as it was',odd.vertexShader==='void main(){}'&&odd.fragmentShader==='void main(){}');
    const M=V.getMats();
    ok('the three world materials carry the patch, under one program key',['op','cut','wat'].every(k=>M[k].onBeforeCompile===V.blightObc&&M[k].customProgramCacheKey()==='blight1'));
    ok('the glow is full at night and a quarter by day, and changing the hour re-meshes nothing',V.lightDay(0.75)===0&&V.lightDay(0.25)===1&&(V.setTime(0.75),step(2),Math.abs(LGT.U.value.x-1)<1e-9)&&(V.setTime(0.25),step(2),Math.abs(LGT.U.value.x-0.25)<1e-9)&&Math.abs(LGT.U.value.z-0.12)<1e-9);
    V.NET.host=true;const ch=V.chunkAt(ox+18,oz+8),keep=ch.lt;ch.lt=null;V.lightChunk(ch);const none=ch.lt===null;V.lightEdit(ox+18,oy+1,oz+8);V.NET.host=false;ch.lt=keep;
    ok('the server\'s own game keeps no light map and does no light work',none);}

  /* ===== 11. the cost ===== */
  {const chs=[...V.chunks.values()].slice(0,60);
    let t=Date.now();for(const ch of chs)V.meshChunk(ch);const withL=(Date.now()-t)/chs.length;
    for(const ch of chs){ch._lt=ch.lt;ch.lt=null;}
    t=Date.now();for(const ch of chs)V.meshChunk(ch);const without=(Date.now()-t)/chs.length;
    for(const ch of chs){ch.lt=ch._lt;delete ch._lt;}
    ok('the light pass costs the mesher less than its own time again ('+without.toFixed(2)+' ms a chunk without it, '+withL.toFixed(2)+' ms with)',withL<without*2+1);}
  await V.quitToTitle();await window.storage.delete('vxw:lit').catch(()=>{});
});
