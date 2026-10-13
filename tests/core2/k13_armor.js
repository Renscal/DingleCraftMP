/* k13_armor.js (v6.36, lane CORE2, gate x1): armour that shows the skin underneath (src/features/p53c_armor_layer.js).
   Headless: the pictures are read as raw pixels (armorPixels), the figures are the real builders'.
   1 each material's picture is 64 x 64, has solid and see-through pixels, and its solid ones are that material's colour
     family; the four are different pictures of the same shape
   2 the holes are where they should be: the face opening (with its nose guard), under the helmet, the ear slots, the neck,
     the sides of the chest, the elbows and hands, the back of the knees; and the plates are where they should be
   3 leggings live in the second layer's squares and the rest in the first, so no two pieces share a pixel
   4 the boxes: the helmet 1 px larger than the head, the chestplate 1 px over body and arms, leggings 0.5 px over hips and
     legs, boots 1 px over the legs; each on the limb it belongs to, mapped with the skin's own UV helper
   5 one slot at a time: the right boxes show, the others stay hidden; taking it off hides them
   6 Dan's own figure and another player's use the same builder and the very same material and picture: nothing new is
     made for a second figure, and each armour material has exactly one
   7 a golden helmet with diamond boots: each slot wears its own material */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:36});
const step=boot.stepper(600000);

boot.run(async()=>{
  ok('the seams are on __vox',['armorPixels','armorMat','armorLayer','skinModel','syncArmorModel','skinBoxData','armorId'].every(k=>typeof V[k]==='function')&&Array.isArray(V.ARMOR_TEX));
  boot.studio(V,step,{});
  const SB=V.SKIN_BOXES,faces=(B,l2)=>V.skinFaces(l2?B.ou:B.u,l2?B.ov:B.v,B.w,B.h,B.d);
  const PX=[0,1,2,3].map(m=>V.armorPixels(m));
  const A=(m,x,y)=>PX[m][(y*64+x)*4+3],at=(m,r,x,y)=>A(m,r[0]+x,r[1]+y);
  /* ===== 1 ===== */
  {const n=PX.map(p=>{let s=0;for(let i=3;i<p.length;i+=4)if(p[i])s++;return s;});
    const binary=PX.every(p=>{for(let i=3;i<p.length;i+=4)if(p[i]!==0&&p[i]!==255)return false;return true;});
    const sameShape=PX.every(p=>{for(let i=3;i<p.length;i+=4)if(!!p[i]!==!!PX[0][i])return false;return true;});
    const differ=new Set(PX.map(p=>{const r=V.SKIN_BOXES.head,f=faces(r).py,i=((f[1]+2)*64+f[0]+1)*4;return p[i]+','+p[i+1]+','+p[i+2];})).size===4;
    ok('four pictures, 64 x 64, every pixel solid or clear, '+n[0]+' solid of 4096; the same shape in four colours',PX.every(p=>p.length===64*64*4)&&binary&&n[0]>500&&n[0]<3000&&sameShape&&differ);}
  /* ===== 2 ===== */
  {const h=faces(SB.head),b=faces(SB.body),aR=faces(SB.armR),aL=faces(SB.armL),lR2=faces(SB.legR,true),lL2=faces(SB.legL,true),lR=faces(SB.legR);
    const all=f=>[0,1,2,3].every(f);
    ok('the helmet: a face opening in the front (the eyes and mouth show), a nose guard in it, solid brow, open underneath, a slot over each ear',
      all(m=>at(m,h.nz,1,5)===0&&at(m,h.nz,6,7)===0&&at(m,h.nz,3,3)===255&&at(m,h.nz,2,1)===255&&at(m,h.nz,0,5)===255&&at(m,h.ny,3,3)===0&&at(m,h.px,3,4)===0&&at(m,h.nx,4,5)===0&&at(m,h.pz,3,5)===255&&at(m,h.py,2,2)===255));
    ok('the chestplate: plates front and back, a neck notch, a collar hole, the sides open between two straps, nothing below the ribs or underneath',
      all(m=>at(m,b.nz,2,4)===255&&at(m,b.pz,5,8)===255&&at(m,b.nz,3,0)===0&&at(m,b.py,3,1)===0&&at(m,b.px,1,4)===0&&at(m,b.nx,2,5)===0&&at(m,b.px,1,0)===255&&at(m,b.nx,1,8)===255&&at(m,b.nz,2,11)===0&&at(m,b.ny,3,1)===0));
    ok('the arms: a shoulder guard and a bracer, the elbow and the hand bare, on both arms',
      all(m=>[aR,aL].every(f=>at(m,f.nz,1,1)===255&&at(m,f.py,1,1)===255&&at(m,f.nz,1,5)===0&&at(m,f.pz,2,4)===0&&at(m,f.nz,1,8)===255&&at(m,f.px,1,11)===0&&at(m,f.ny,1,1)===0)));
    ok('the leggings: a belt round the hips, legs covered down to the boot, the back of the knee open',
      all(m=>at(m,faces(SB.body,true).nz,3,9)===255&&at(m,faces(SB.body,true).nz,3,3)===0&&[lR2,lL2].every(f=>at(m,f.nz,1,2)===255&&at(m,f.pz,1,4)===0&&at(m,f.pz,2,5)===0&&at(m,f.pz,0,4)===255&&at(m,f.nz,1,10)===0)));
    ok('the boots: the bottom of each leg and the sole, nothing above the ankle',all(m=>at(m,lR.nz,1,10)===255&&at(m,lR.ny,1,1)===255&&at(m,lR.nz,1,6)===0&&at(m,faces(SB.legL).px,2,9)===255&&at(m,faces(SB.legL).nz,2,3)===0));}
  /* ===== 3 ===== */
  {const inRect=(x,y,B,l2)=>Object.values(faces(B,l2)).some(r=>x>=r[0]&&x<r[0]+r[2]&&y>=r[1]&&y<r[1]+r[3]);
    let stray=0;for(let y=0;y<64;y++)for(let x=0;x<64;x++){if(!A(0,x,y))continue;
      const first=[SB.head,SB.body,SB.armR,SB.armL,SB.legR,SB.legL].some(B=>inRect(x,y,B,false)),second=[SB.body,SB.legR,SB.legL].some(B=>inRect(x,y,B,true));
      if(first===second)stray++;}
    ok('every solid pixel is in exactly one piece: the first layer\'s squares or the leggings\' ('+stray+' strays)',stray===0);}
  /* ===== 4, 5 ===== */
  const tex=V.skinOwn?V.skinOwn().tex:null;
  const S=V.skinModel(tex),L=V.armorLayer(S),px=V.SKIN_PX;
  const ext=me=>{const p=me.geometry.attributes.position.array;let mx=[0,0,0];for(let i=0;i<p.length;i+=3)for(let a=0;a<3;a++)mx[a]=Math.max(mx[a],Math.abs(p[i+a]-(a===1?me._cy||0:0)));return mx;};
  const half=(me,w,h,d,g,cy)=>{const p=me.geometry.attributes.position.array;let X=0,Y0=1e9,Y1=-1e9,Z=0;for(let i=0;i<p.length;i+=3){X=Math.max(X,Math.abs(p[i]));Y0=Math.min(Y0,p[i+1]);Y1=Math.max(Y1,p[i+1]);Z=Math.max(Z,Math.abs(p[i+2]));}
    const near=(a,b)=>Math.abs(a-b)<1e-6;return near(X,(w/2+g)*px)&&near(Z,(d/2+g)*px)&&near(Y1-Y0,(h+2*g)*px)&&near((Y0+Y1)/2,cy);};
  ok('the boxes: helmet 1 px over the head; chestplate 1 px over body and both arms; leggings half a pixel over hips and legs; boots 1 px over the legs',
    L.parts[0].length===1&&L.parts[1].length===3&&L.parts[2].length===3&&L.parts[3].length===2&&
    half(L.parts[0][0],8,8,8,1,0)&&half(L.parts[1][0],8,12,4,1,0)&&half(L.parts[1][1],4,12,4,1,-6*px)&&half(L.parts[1][2],4,12,4,1,-6*px)&&
    half(L.parts[2][0],8,12,4,0.5,0)&&half(L.parts[2][1],4,12,4,0.5,-6*px)&&half(L.parts[3][0],4,12,4,1,-6*px)&&half(L.parts[3][1],4,12,4,1,-6*px));
  ok('  ... each hung on the limb it covers, and mapped with the skin\'s own UV helper',
    L.parts[0][0].parent===S.head&&L.parts[1][0].parent===S.chestA&&L.parts[1][1].parent===S.aR&&L.parts[1][2].parent===S.aL&&L.parts[2][0].parent===S.chestA&&L.parts[2][1].parent===S.lR&&L.parts[2][2].parent===S.lL&&L.parts[3][0].parent===S.lR&&L.parts[3][1].parent===S.lL&&
    JSON.stringify(Array.from(L.parts[0][0].geometry.attributes.uv.array))===JSON.stringify(Array.from(new Float32Array(V.skinBoxData(0,0,8,8,8,1,0,0,0).u)))&&
    JSON.stringify(Array.from(L.parts[2][1].geometry.attributes.uv.array))===JSON.stringify(Array.from(new Float32Array(V.skinBoxData(SB.legR.ou,SB.legR.ov,4,12,4,0.5,0,-6*px,0).u))));
  const vis=()=>L.parts.map(g=>g.every(q=>q.visible)?1:g.some(q=>q.visible)?'?':0).join('');
  const seq=[vis()];
  for(let s=0;s<4;s++){const ids=[0,0,0,0];ids[s]=V.armorId(0,s);L.sync(ids);seq.push(vis());}
  L.sync([0,0,0,0]);seq.push(vis());L.sync(null);seq.push(vis());
  ok('a slot at a time: '+seq.join(' '),seq.join(' ')==='0000 1000 0100 0010 0001 0000 0000');
  /* ===== 7 ===== */
  const cols=L.sync([V.armorId(1,0),0,0,V.armorId(2,3)]);
  ok('a golden helmet with diamond boots: each slot in its own material, the colours reported for the slots worn',
    L.parts[0][0].material===V.armorMat(1)&&L.parts[3][0].material===V.armorMat(2)&&L.parts[3][1].material===V.armorMat(2)&&cols[0]===V.ARM_M[1].col&&cols[3]===V.ARM_M[2].col&&cols[1]===''&&vis()==='1001');
  /* ===== 6 ===== */
  const made=()=>V.ARMOR_TEX.filter(Boolean).length;
  for(let m=0;m<4;m++)V.armorMat(m);
  const before=V.ARMOR_TEX.map(t=>t.mat),texB=V.ARMOR_TEX.map(t=>t.tex);
  const S2=V.skinModel(tex),L2=V.armorLayer(S2);L2.sync([V.armorId(3,0),V.armorId(3,1),V.armorId(3,2),V.armorId(3,3)]);L.sync([V.armorId(3,0),V.armorId(3,1),V.armorId(3,2),V.armorId(3,3)]);
  ok('a second figure makes no new picture or material: four of each, the same ones, and both figures wear the very same dragon material',
    made()===4&&V.ARMOR_TEX.every((t,i)=>t.mat===before[i]&&t.tex===texB[i])&&L.parts.flat().every(q=>q.material===before[3])&&L2.parts.flat().every(q=>q.material===before[3])&&
    before[3].alphaTest>0&&before[3].map===texB[3]&&new Set(before).size===4);
  /* Dan's own figure, through syncArmorModel, and a peer through ntPeerMesh */
  const P=V.P;P.armor=[{id:V.armorId(0,0)},null,{id:V.armorId(0,2)},null];
  const own=V.skinModel(tex);own.skinned=true;V.syncArmorModel(own);
  const p=V.ntPeerAdd(9,'Pawn',{x:P.x+3,y:P.y,z:P.z,yaw:0,pitch:0,dim:V.getDim(),held:0,hp:20,fl:0,ar:[V.armorId(0,0),0,V.armorId(0,2),0]});
  for(let i=0;i<6;i++){p.pt=V.NET.acc;V.ntPeersTick(0.05);}
  const pm=p.M;
  ok('Dan\'s own figure and another player wear the same layer: same slots showing, same shared iron material, and the peer reports its colours as before',
    !!own._al&&!!pm&&!!pm.al&&own._arm.map(g=>g[0].visible?1:0).join('')==='1010'&&pm.arm.map(a=>a.parts[0].visible?1:0).join('')==='1010'&&
    own._arm[0][0].material===V.armorMat(0)&&pm.arm[0].parts[0].material===V.armorMat(0)&&pm.arm[0].col===V.ARM_M[0].col&&!V.armorMat(0).ntOwn&&made()===4);
  P.armor=[null,null,null,null];
});
