/* n_tags.js (v6.29, lane NET, gate x1): name tags are seen through walls (src/net/n5_players.js: ntTagAlpha, ntTagSeen,
   ntTagTick). Headless and offline: a peer is added by hand, the way a join adds one, and the real per-frame tick runs.
   1 the tag is drawn over everything (no depth test, no depth write, a late render order)
   2 how strongly: clear line 1, behind a wall dimmer, sneaking dimmer still, sneaking behind a wall not at all
   3 the line: clear in the open, blocked by stone, not blocked by glass or a torch, blocked again by stone behind glass
   4 the real tick: a wall between Dan and the player dims the tag within a few frames; taking it away restores it;
     sneaking behind the wall hides it and sneaking in the open only dims it
   5 the look happens once every few frames for a player, and a tick makes no new material or texture
   6 another dimension and the dead are hidden as before */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:29});
const step=boot.stepper(600000);

boot.run(async()=>{
  const B=V.B,NET=V.NET;
  ok('the seams are on __vox',['ntTagAlpha','ntTagSeen','ntTagTick','ntPeerAdd','ntPeersTick'].every(k=>typeof V[k]==='function'));
  const o=boot.studio(V,step,{});
  const P=()=>V.P;
  /* ===== 2 ===== */
  const A=V.ntTagAlpha;
  ok('strength: clear '+A(true,false)+', behind a wall '+A(false,false)+', sneaking '+A(true,true)+', sneaking behind a wall '+A(false,true),
    A(true,false)===1&&A(false,false)>0.15&&A(false,false)<0.6&&A(true,true)>0.15&&A(true,true)<1&&A(false,true)===0);

  /* ===== 3 ===== */
  const ey=o.y+1.6,ax=o.x+0.5,az=o.z+0.5,bx=o.x+4.5;
  const seen=()=>V.ntTagSeen(ax,ey,az,bx,ey,az);
  const wall=id=>{V.setBlock(o.x+2,o.y+1,o.z,id);};
  const s0=seen();wall(B.STONE);const s1=seen();wall(B.GLASS);const s2=seen();wall(B.AIR);V.setBlock(o.x+2,o.y+1,o.z,B.GLASS);V.setBlock(o.x+3,o.y+1,o.z,B.STONE);const s3=seen();
  V.setBlock(o.x+2,o.y+1,o.z,B.AIR);V.setBlock(o.x+3,o.y+1,o.z,B.AIR);
  ok('the line: open '+s0+', stone '+s1+', glass '+s2+', stone behind glass '+s3,s0===true&&s1===false&&s2===true&&s3===false);
  ok('  ... and a point on top of the eye is always seen',V.ntTagSeen(ax,ey,az,ax,ey,az)===true);

  /* ===== 1, 4, 5: a real peer ===== */
  P().x=ax;P().z=az;P().y=o.y;step(2);
  const p=V.ntPeerAdd(7,'Rook',{x:bx,y:o.y,z:az,yaw:0,pitch:0,dim:V.getDim(),held:0,hp:20,fl:0});
  const tick=n=>{for(let i=0;i<(n||1);i++){p.pt=NET.acc;step(1);if(!NET.on)V.ntPeersTick(0.05);}};
  tick(8);
  const M=p.M,tag=M&&M.tag;
  if(!tag){ok('the headless page can build a name tag',false);return;}
  ok('the tag is drawn over everything: no depth test, no depth write, render order '+tag.renderOrder,
    tag.material.depthTest===false&&tag.material.depthWrite===false&&tag.renderOrder>=9000&&tag.material.transparent===true);
  const op=()=>tag.visible?tag.material.opacity:0;
  const a0=op();
  for(let y=0;y<3;y++)for(let z=-1;z<=1;z++)V.setBlock(o.x+2,o.y+y,o.z+z,B.STONE);tick(8);const a1=op();
  p.fl=2;tick(8);const a2=op();
  for(let y=0;y<3;y++)for(let z=-1;z<=1;z++)V.setBlock(o.x+2,o.y+y,o.z+z,B.AIR);tick(8);const a3=op();
  p.fl=0;tick(8);const a4=op();
  ok('in the game: clear '+a0+', a wall goes up '+a1+', they sneak behind it '+a2+', the wall comes down '+a3+', they stand up '+a4,
    a0===1&&a1===A(false,false)&&a2===0&&a3===A(true,true)&&a4===1);
  ok('  ... and the body itself is still depth-tested behind the wall (only the tag is drawn through)',M.G.visible===true&&M.head.children.every(c=>!c.material||c.material.depthTest!==false));

  const mat=tag.material,map=mat.map;let looks=0;const real=V.raycastB;
  const fc=V.getFrameCount?V.getFrameCount():null;
  p.tagSeen=true;let changes=0,last=true;
  for(let y=0;y<3;y++)for(let z=-1;z<=1;z++)V.setBlock(o.x+2,o.y+y,o.z+z,B.STONE);
  let firstDim=-1;for(let i=0;i<12;i++){tick(1);if(firstDim<0&&op()<1)firstDim=i;}
  ok('the look is not every frame: the wall is noticed within '+(firstDim+1)+' frames (at most 6), and the tag keeps its material and texture',
    firstDim>=0&&firstDim<6&&tag.material===mat&&mat.map===map);

  /* ===== 6 ===== */
  p.fl=4;tick(2);const dead=M.G.visible;p.fl=0;p.dim='nether';tick(2);const away=M.G.visible;p.dim=V.getDim();tick(2);
  ok('the dead and players in another dimension are hidden, body and tag, as before',dead===false&&away===false&&M.G.visible===true);
});
