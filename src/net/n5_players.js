/* ---- PART 58: n5_players.js ---- */
/* The other players. A peer is {id, name, has (a pose has arrived), x y z yaw (where the body is drawn), tx ty tz tyaw
   (where the last pose says it is), pt (when that pose arrived, on NET.acc), pitch, dim, held, hp, fl (the pose flags, see
   ntPoseNow), M (the body, built on first sight), anim / sw / spd (walk cycle, arm swing, measured speed)}. Poses arrive about 15 times a second; ntPeersTick
   eases the body toward the latest one every frame. Bodies are only shown in the dimension the local player is in. */

const NT_SHIRTS=[0x3b82d9,0xd94a4a,0x3fae5a,0xa24bd1,0xe0b030,0x2fb5b5,0xd9648f,0x7a8a99];
/* ----- the other players ----- */
function ntHash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
/* a player joined (or was already there when we did) */
function ntPeerAdd(id,name,pose){
  id=id|0;if(!id||id===NET.id)return null;
  ntPeerDel(id);
  const p={id,name:''+(name||'Player'),has:false,x:0,y:0,z:0,yaw:0,pitch:0,tx:0,ty:0,tz:0,tyaw:0,pt:-9,dim:'over',held:0,hp:20,fl:0,M:null,anim:0,sw:0,spd:0};
  NET.peers.set(id,p);
  if(pose)ntPeerPose(p,pose);
  return p;
}
/* a pose arrived: set the target the body eases toward; a big jump or a new dimension snaps instead */
function ntPeerPose(p,m){
  if(typeof m.x!=='number'||typeof m.y!=='number'||typeof m.z!=='number')return;
  const far=!p.has||p.dim!==m.dim||Math.hypot(m.x-p.x,m.y-p.y,m.z-p.z)>12;
  p.tx=m.x;p.ty=m.y;p.tz=m.z;p.tyaw=+m.yaw||0;p.pitch=+m.pitch||0;p.pt=NET.acc;
  p.dim=''+(m.dim||'over');p.held=m.held|0;p.hp=+m.hp||0;
  if((m.fl&1)&&!(p.fl&1))p.sw=1;
  p.fl=m.fl|0;
  if(far){p.x=p.tx;p.y=p.ty;p.z=p.tz;p.yaw=p.tyaw;}
  p.has=true;
}
/* a player left */
function ntPeerDel(id){
  const p=NET.peers.get(id);if(!p)return;
  ntPeerUnmesh(p);NET.peers.delete(id);
}
/* forget everyone (leaving, or a fresh welcome) */
function ntClearPeers(){for(const p of NET.peers.values())ntPeerUnmesh(p);NET.peers.clear();}
/* take a player's body out of the scene and free what only it owned (shared tool models are left alone) */
function ntPeerUnmesh(p){
  const M=p.M;p.M=null;
  if(!M||!scene)return;
  scene.remove(M.G);
  if(typeof M.G.traverse==='function')M.G.traverse(o=>{if(o.isT3D||o.userData&&o.userData.shared)return;
    if(o.geometry&&!o.geometry.ntKeep)o.geometry.dispose();
    if(o.material&&o.material.ntOwn){if(o.material.map)o.material.map.dispose();o.material.dispose();}});
}
/* a boxy player like the third-person one, in this player's own colours, with the name over the head */
function ntPeerMesh(p){
  const G=new THREE.Group();
  const mat=c=>{const m=new THREE.MeshLambertMaterial({color:c});m.ntOwn=true;return m;};
  const h=ntHash(p.name.toLowerCase());
  const skin=mat(0xe8b88f),shirt=mat(NT_SHIRTS[h%NT_SHIRTS.length]),pants=mat(0x34343a),shoe=mat(0x2b2b30),eyeM=mat(0x2b2430);
  const head=new THREE.Group();head.position.y=1.62;G.add(head);
  head.add(new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5),skin));
  for(const sx of[-1,1]){const e=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.08,0.02),eyeM);e.position.set(sx*0.11,0.04,-0.26);head.add(e);}
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.72,0.27),shirt);body.position.y=1.0;G.add(body);
  const mkLimb=(m,w,hh)=>{const piv=new THREE.Group();const me=new THREE.Mesh(new THREE.BoxGeometry(w,hh,w),m);me.position.y=-hh/2;piv.add(me);G.add(piv);return piv;};
  const aL=mkLimb(shirt,0.18,0.66),aR=mkLimb(shirt,0.18,0.66);
  aL.position.set(-0.34,1.32,0);aR.position.set(0.34,1.32,0);
  const lL=mkLimb(pants,0.21,0.66),lR=mkLimb(pants,0.21,0.66);
  lL.position.set(-0.13,0.66,0);lR.position.set(0.13,0.66,0);
  for(const sx of[-1,1]){const s=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.1,0.26),shoe);s.position.set(sx*0.13,0.05,-0.02);G.add(s);}
  const M={G,head,aL,aR,lL,lR,tag:null,_toolId:0,_tool:null};
  try{
    if(typeof THREE.Sprite==='function'&&typeof THREE.CanvasTexture==='function'&&typeof document!=='undefined'){
      const cv=document.createElement('canvas'),c=cv.getContext('2d');
      cv.width=256;cv.height=48;
      c.font='bold 28px monospace';
      const w=Math.min(250,c.measureText(p.name).width+18);
      c.fillStyle='rgba(0,0,0,0.45)';c.fillRect((256-w)/2,6,w,36);
      c.fillStyle='#fff';c.textAlign='center';c.textBaseline='middle';c.fillText(p.name,128,25,244);
      const tx=new THREE.CanvasTexture(cv);tx.magFilter=THREE.NearestFilter;
      const sm=new THREE.SpriteMaterial({map:tx,transparent:true,depthWrite:false});sm.ntOwn=true;
      const sp=new THREE.Sprite(sm);sp.scale.set(1.6,0.3,1);sp.position.y=2.25;G.add(sp);M.tag=sp;
    }
  }catch(e){}
  scene.add(G);
  return M;
}
/* the tool or gun in the right hand, rebuilt only when it changes */
function ntPeerTool(p){
  const M=p.M,id=(toolIdParts(p.held)||gunIdParts(p.held))?p.held:0;
  if(M._toolId===id)return;
  M._toolId=id;
  if(M._tool){M.aR.remove(M._tool);M._tool=null;}
  if(!id)return;
  let g=null;
  try{
    if(toolIdParts(id)){g=mkTool3D(id,0.55);g.position.set(0,-0.6,-0.04);g.rotation.set(-1.1,0,0);}
    else{g=mkWpn3D(id,0.6);g.position.set(0,-0.62,-0.14);g.rotation.set(-0.15,0,0);}
  }catch(e){g=null;}
  if(g){g.isT3D=true;M.aR.add(g);M._tool=g;}
}
/* every frame: ease each body toward its last pose and animate it (walk, sit, sneak, swing) */
function ntPeersTick(dt){
  if(!NET.peers.size||!scene)return;
  const k=1-Math.exp(-Math.max(dt,0.001)*14);
  for(const p of NET.peers.values()){
    const show=p.has&&p.dim===DIM&&!(p.fl&4);
    if(!show){if(p.M)p.M.G.visible=false;continue;}
    const ox=p.x,oz=p.z;
    p.x+=(p.tx-p.x)*k;p.y+=(p.ty-p.y)*k;p.z+=(p.tz-p.z)*k;
    let dy=p.tyaw-p.yaw;dy=((dy+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;p.yaw+=dy*k;
    if(dt>0)p.spd+=(Math.hypot(p.x-ox,p.z-oz)/dt-p.spd)*0.3;
    if(!p.M){try{p.M=ntPeerMesh(p);}catch(e){p.M=null;}if(!p.M)continue;}
    const M=p.M;
    M.G.visible=true;
    M.G.position.set(p.x,p.y-((p.fl&2)?0.12:0),p.z);
    M.G.rotation.y=p.yaw;
    M.head.rotation.x=p.pitch*0.55;
    ntPeerTool(p);
    if(p.fl&8){M.lL.rotation.x=M.lR.rotation.x=-1.15;M.aL.rotation.x=M.aR.rotation.x=-0.5;}
    else{
      p.anim+=p.spd*dt*2.4;
      const sw=Math.sin(p.anim)*0.7*clamp(p.spd/4.4,0,1);
      M.lL.rotation.x=sw;M.lR.rotation.x=-sw;M.aL.rotation.x=-sw*0.8;M.aR.rotation.x=sw*0.8;
    }
    if(p.sw>0){p.sw=Math.max(0,p.sw-dt*4);M.aR.rotation.x=-1.5*Math.sin(p.sw*Math.PI);}
  }
}
/* the renderTab hook: one row per other player (name, health, where they are if not here) */
function ntTabRows(rows){
  for(const p of NET.peers.values())rows.push([p.name,(p.fl&16)?'creative':(p.fl&4)?'dead':Math.round(p.hp)+'❤','',
    p.dim!==DIM?(p.dim==='over'?'Overworld':p.dim==='puppet'?'Puppet Purgatory':p.dim==='nether'?'Nether':'Aether'):'']);
}
/* left click: is another player the nearest thing along the look ray? (e eye, d direction, lim the nearest mob or block) */
function ntMelee(e,d,lim){
  if(!NET.pvp||!NET.peers.size)return false;
  let best=null,bt=Math.min(3.2,lim);
  for(const p of NET.peers.values()){
    if(!p.has||p.dim!==DIM||(p.fl&4))continue;
    const mn=[p.x-0.3,p.y,p.z-0.3],mx=[p.x+0.3,p.y+1.8,p.z+0.3];
    let t0=0,t1=bt,ok=true;
    for(let a=0;a<3;a++){
      if(Math.abs(d[a])<1e-9){if(e[a]<mn[a]||e[a]>mx[a]){ok=false;break;}continue;}
      let ta=(mn[a]-e[a])/d[a],tb=(mx[a]-e[a])/d[a];
      if(ta>tb){const tmp=ta;ta=tb;tb=tmp;}
      if(ta>t0)t0=ta;
      if(tb<t1)t1=tb;
      if(t0>t1){ok=false;break;}
    }
    if(ok&&t0<bt){bt=t0;best=p;}
  }
  if(!best)return false;
  if(P.atkT<=0){
    P.atkT=0.32;P.swing=1;
    const st=heldStack(),tl=st&&DEFS[st.id].tool,E=st&&st.ench;
    let dmg=(tl?tl.dmg:1)+((P.bigT||0)>0?2:0);
    if(E&&E.sharp)dmg+=E.sharp*1.2;
    ntSend({t:'hit',to:best.id,dmg,kx:d[0],kz:d[2]});
    best.sw=0;playS('hit');
    if(tl)damageHeld(tl.type==='sword'?1:2);
  }
  return true;
}
/* ----- who runs the world here ----- */
/* is this peer's game running the world right now? (here, alive on the wire, not paused) */
function ntPeerLive(p){return p.has&&p.dim===DIM&&!(p.fl&32)&&NET.acc-p.pt<3;}
/* The tickFlow hook: should this game simulate the block column at x,z? Of the players within 48 blocks of it, the one with
   the lowest id does, and its results reach the others as ordinary block edits; if nobody is that close, everyone who has
   the chunk does (the old behaviour). So water flows once, not once per player, and what it washes loose drops once. */
function ntSimHere(x,z){
  let own=Math.hypot(P.x-x,P.z-z)<=48?NET.id:0;
  for(const p of NET.peers.values()){
    if(!ntPeerLive(p)||Math.hypot(p.tx-x,p.tz-z)>48)continue;
    if(!own||p.id<own)own=p.id;
  }
  return !own||own===NET.id;
}
/* The updateArrow and updateBullet hooks: did this player's arrow or bullet, now at x,y,z, reach another player? Then the
   server passes the hit on (it checks the range). true = it hit, the projectile is spent */
function ntShot(x,y,z,dmg,vx,vz){
  if(!NET.pvp||!NET.peers.size)return false;
  for(const p of NET.peers.values()){
    if(!p.has||p.dim!==DIM||(p.fl&4))continue;
    if(x>p.x-0.4&&x<p.x+0.4&&y>p.y-0.1&&y<p.y+1.9&&z>p.z-0.4&&z<p.z+0.4){
      const l=Math.hypot(vx,vz)||1;
      ntSend({t:'hit',to:p.id,dmg,kx:vx/l,kz:vz/l,shot:1});
      playS('hit');
      return true;
    }
  }
  return false;
}
