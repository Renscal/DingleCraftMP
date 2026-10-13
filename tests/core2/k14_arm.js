/* k14_arm.js (v6.37, lane CORE2, gate x1): the first-person hand wears the skin (src/features/p53b_skin.js: skinArm;
   src/core/p07d_hand_camera.js: refreshHand). The Hyperreal fist is tC_smoke's.
   1 an empty hand in OG puts the arm in the hand group: the arm box and its sleeve layer, 4 x 12 x 4 pixels
   2 both wear the player's own skin texture (the very object the body wears), nearest-filtered, the sleeve see-through
   3 the UVs are the right arm's squares of the skin
   4 holding an item takes the arm away; emptying the hand brings the same arm back (nothing is made twice)
   5 a new skin repaints that texture: same texture, same arm, nothing rebuilt
   6 it swings and bobs with the hand group like a held item, and the hand end points away from the eye */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:37});
const step=boot.stepper(600000);

boot.run(async()=>{
  ok('the seams are on __vox',typeof V.skinArm==='function'&&typeof V.getHandG==='function'&&typeof V.refreshHand==='function'&&!!V.SKINS);
  boot.studio(V,step,{});
  const P=()=>V.P,B=V.B,H=()=>V.getHandG(),PX=V.SKIN_PX,SB=V.SKIN_BOXES.armR;
  for(let i=0;i<36;i++)P().inv[i]=null;P().sel=0;V.refreshHand();step(2);
  /* ===== 1 ===== */
  const arm=H().children[0];
  const size=me=>{const p=me.geometry.attributes.position.array;const lo=[9,9,9],hi=[-9,-9,-9];for(let i=0;i<p.length;i+=3)for(let a=0;a<3;a++){lo[a]=Math.min(lo[a],p[i+a]);hi[a]=Math.max(hi[a],p[i+a]);}return hi.map((v,a)=>+((v-lo[a])/PX).toFixed(3));};
  ok('an empty hand in OG: one thing in the hand, the arm, made of the arm box (4 x 12 x 4 px) and its sleeve a quarter pixel larger',
    H().children.length===1&&!!arm&&arm.isArm===true&&arm.children.length===2&&size(arm.children[0]).join()==='4,12,4'&&size(arm.children[1]).join()==='4.5,12.5,4.5');
  /* ===== 2, 3 ===== */
  const tex=V.skinOwn().tex,m0=arm.children[0].material,m1=arm.children[1].material;
  ok('both layers wear the player\'s own skin texture, nearest-filtered with no mipmaps; the sleeve is cut out by alpha',
    m0.map===tex&&m1.map===tex&&m0!==m1&&m1.alphaTest>0&&!(m0.alphaTest>0)&&tex.magFilter===global.THREE.NearestFilter&&tex.minFilter===global.THREE.NearestFilter&&tex.generateMipmaps===false);
  const uv=me=>JSON.stringify(Array.from(me.geometry.attributes.uv.array));
  ok('the UVs are the skin\'s right arm (40,16) and its sleeve (40,32)',uv(arm.children[0])===JSON.stringify(Array.from(new Float32Array(V.skinBoxData(40,16,4,12,4,0,0,0,0).u)))&&
    uv(arm.children[1])===JSON.stringify(Array.from(new Float32Array(V.skinBoxData(40,32,4,12,4,SB.grow,0,0,0).u)))&&SB.u===40&&SB.v===16&&SB.ou===40&&SB.ov===32);
  /* ===== 4 ===== */
  P().inv[0]={id:B.STONE,count:1};V.refreshHand();const held=H().children.slice();
  P().inv[0]={id:V.toolId(1,0),count:1};V.refreshHand();const tool=H().children.slice();
  P().inv[0]=null;V.refreshHand();const back=H().children.slice();
  ok('a block or a tool in the hand: no arm. The hand emptied: the very same arm again',held.length===1&&!held[0].isArm&&tool.length===1&&!tool[0].isArm&&back.length===1&&back[0]===arm&&V.skinArm()===arm);
  /* ===== 5 ===== */
  const cvBefore=V.SKINS.cv,r=V.skinSet('',false);step(2);
  ok('wearing another skin (here: back to the default) repaints the one texture: same texture, same picture, same arm in the hand',
    r&&r.ok===true&&V.skinOwn().tex===tex&&V.SKINS.cv===cvBefore&&H().children[0]===arm&&arm.children[0].material.map===tex);
  /* ===== 6 ===== */
  const rest=[H().position.x,H().position.y,H().position.z,H().rotation.x];
  P().swing=1;step(1);const mid=[H().position.x,H().position.y,H().rotation.x];
  for(let i=0;i<4;i++)step(1);
  const moved=Math.abs(H().rotation.x-rest[3])>1e-4||Math.abs(H().position.y-rest[1])>1e-4;
  /* the hand end: the bottom of the box, turned by the arm's own rotation; forward is -z in the camera's space */
  const e=arm.rotation,cx=Math.cos(e.x),sx=Math.sin(e.x);
  ok('a swing moves the hand group, arm and all; the arm\'s hand end points forward and up, away from the eye',moved&&(-sx)<-0.5&&(-cx)>0&&arm.parent===H());
});
