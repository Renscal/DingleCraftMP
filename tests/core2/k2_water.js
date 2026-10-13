/* k2_water.js (v6.20, lane CORE2, gate x1): water has both sides.
   The water surface was drawn on its top side only, so from underneath there was no surface at all. The mesher now adds,
   for every visible face of a liquid, the same quad seen from behind (addQuadBack). Static: it meshes a chunk and reads
   the buffers; nothing is rendered (the look itself is a browser matter and is not checked here).
   1 a block of water standing in air: six faces, each with a twin behind it (same corners, opposite normal, wound the
     other way), and the lowered top is lowered on both
   2 the twin is really the other side: its triangles face the way its normal says
   3 two water blocks side by side: no faces between them, front or back
   4 lava gets the same; ice (the same bucket, but solid) and stone do not
   5 every index stays inside its buffer */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:3});
const step=boot.stepper(600000);

boot.run(async()=>{
  const B=V.B;
  ok('the mesher is on __vox',typeof V.meshChunk==='function'&&typeof V.chunkAt==='function');
  const S=boot.studio(V,step,{});
  const bx=S.x+2,by=S.y+3,bz=S.z+1;
  /* the quads of one buffer that lie in the unit cell at (x,y,z), as {n:[..], p:[4 corners], tri:[winding normal]} */
  const quadsAt=(buf,ch,x,y,z)=>{const lx=x-ch.cx*16,lz=z-ch.cz*16,out=[];
    for(let q=0;q<buf.vc/4;q++){const P=[],N=[buf.n[q*12],buf.n[q*12+1],buf.n[q*12+2]];
      for(let i=0;i<4;i++)P.push([buf.p[q*12+i*3],buf.p[q*12+i*3+1],buf.p[q*12+i*3+2]]);
      if(!P.every(p=>p[0]>=lx-1e-6&&p[0]<=lx+1+1e-6&&p[1]>=y-1e-6&&p[1]<=y+1+1e-6&&p[2]>=lz-1e-6&&p[2]<=lz+1+1e-6))continue;
      const ix=buf.ix.slice(q*6,q*6+3).map(i=>i-q*4),a=P[ix[0]],b=P[ix[1]],c=P[ix[2]];
      const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],w=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
      out.push({n:N,p:P,tri:[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]]});}
    return out;};
  const key=q=>q.p.map(p=>p.map(v=>v.toFixed(3)).join(',')).sort().join('|');
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const mesh=()=>{const ch=V.chunkAt(bx,bz);return {ch,b:V.meshChunk(ch)};};

  /* ===== 1, 2. one block of water in air ===== */
  V.setBlock(bx,by,bz,B.WATER);step(2);
  {const {ch,b}=mesh(),Q=quadsAt(b.wat,ch,bx,by,bz);
    const front=Q.filter(q=>dot(q.n,q.tri)>0),back=Q.filter(q=>dot(q.n,q.tri)>0&&false);
    const byKey={};for(const q of Q)(byKey[key(q)]||(byKey[key(q)]=[])).push(q);
    const pairs=Object.values(byKey);
    ok('a block of water in air: six faces, each with a twin at the same four corners (12 quads)',Q.length===12&&pairs.length===6&&pairs.every(p=>p.length===2));
    ok('each pair looks opposite ways: the normals are exact opposites',pairs.every(p=>p[0].n[0]===-p[1].n[0]&&p[0].n[1]===-p[1].n[1]&&p[0].n[2]===-p[1].n[2]));
    ok('...and each is wound to face the way its normal says, so one of the two is drawn from either side',Q.every(q=>dot(q.n,q.tri)>0)&&front.length===12&&back.length===0);
    const tops=Q.filter(q=>q.p.every(p=>Math.abs(p[1]-(by+0.88))<1e-6));
    ok('the lowered surface is lowered on both of its sides',tops.length===2&&tops.some(q=>q.n[1]===1)&&tops.some(q=>q.n[1]===-1));}

  /* ===== 3. two side by side ===== */
  V.setBlock(bx+1,by,bz,B.WATER);step(2);
  {const {ch,b}=mesh(),Q=quadsAt(b.wat,ch,bx,by,bz).concat(V.chunkAt(bx+1,bz)===ch?[]:[]);
    const shared=Q.filter(q=>q.p.every(p=>Math.abs(p[0]-(bx+1-ch.cx*16))<1e-6));
    ok('between two water blocks there is no face at all, front or back',shared.length===0&&Q.length===10);}
  V.setBlock(bx+1,by,bz,B.AIR);V.setBlock(bx,by,bz,B.AIR);step(2);

  /* ===== 4. lava yes; ice and stone no ===== */
  for(const [name,id,want,buf] of [['lava',B.LAVA,12,'wat'],['ice',B.ICE,6,'wat'],['stone',B.STONE,6,'op']]){
    V.setBlock(bx,by,bz,id);step(2);
    const {ch,b}=mesh(),Q=quadsAt(b[buf],ch,bx,by,bz);
    ok(name+' standing in air: '+want+' quads'+(want===12?' (both sides)':' (one side only, as before)'),Q.length===want&&Q.every(q=>dot(q.n,q.tri)>0));
    V.setBlock(bx,by,bz,B.AIR);step(2);}

  /* ===== 5. the buffers are sound ===== */
  V.setBlock(bx,by,bz,B.WATER);step(2);
  {const {b}=mesh();
    ok('every buffer is whole: four corners a quad, six indices a quad, no index out of range',['op','cut','wat'].every(k=>{const u=b[k];
      return u.p.length===u.vc*3&&u.n.length===u.vc*3&&u.u.length===u.vc*2&&u.c.length===u.vc*3&&u.ix.every(i=>i>=0&&i<u.vc);}));}
});
