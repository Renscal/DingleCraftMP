/* ---- PART 58: n5_players.js ---- */
/* The other players. A peer is {id, name, has (a pose has arrived), x y z yaw (where the body is drawn), tx ty tz tyaw
   (where the last pose says it is), pt (when that pose arrived, on NET.acc), pitch, dim, held, hp, fl (the pose flags, see
   ntPoseNow), ar (the four armour item ids, or null), rv ry rh (the vehicle they ride: kind, heading, how far below them),
   ms (their ping), skin (the skin they sent, a data address, or '' for the default), M (the body, built on first sight), anim / sw / spd (walk cycle, arm swing, measured speed)}. Poses arrive about 15 times a second; ntPeersTick
   eases the body toward the latest one every frame. Bodies are only shown in the dimension the local player is in. */

const NT_SHIRTS=[0x3b82d9,0xd94a4a,0x3fae5a,0xa24bd1,0xe0b030,0x2fb5b5,0xd9648f,0x7a8a99];
/* the vehicles a player can be seen riding (entity kinds); each has a mesh builder in the core, looked up when needed */
const NT_RIDES={car:1,skate:1,cart:1,boat:1,plane:1};
/* ----- name tags (6.29) -----
   A name is drawn over everything, so you can find your friends through a hill: at full strength with a clear line from
   your eye to their head, dimmer with something solid in the way. Someone sneaking shows a dimmer name, and none at all
   through a wall: that is what sneaking is for. The line is looked along once every NT_TAGEVERY frames for each player
   (not all on the same frame), with the same ray the crosshair uses; blocks you can see through (glass, leaves, a torch)
   do not count as being in the way. */
const NT_TAGORDER=9990,NT_TAGEVERY=6;
/* how strongly a name is drawn: seen = a clear line to the head, sneak = they are sneaking. 0 = not drawn */
function ntTagAlpha(seen,sneak){return sneak?(seen?0.45:0):(seen?1:0.35);}
/* is there a clear line from (ax,ay,az) to (bx,by,bz)? */
function ntTagSeen(ax,ay,az,bx,by,bz){
  let dx=bx-ax,dy=by-ay,dz=bz-az,d=Math.hypot(dx,dy,dz);
  if(d<0.01)return true;
  dx/=d;dy/=d;dz/=d;
  let t0=0;
  for(let i=0;i<6;i++){                                    /* through at most five see-through blocks */
    const h=raycastB(ax+dx*t0,ay+dy*t0,az+dz*t0,dx,dy,dz,d-t0);
    if(!h)return true;
    if(DEFS[h.id].opq)return false;
    t0+=h.t+1.01;
    if(t0>=d)return true;
  }
  return false;
}
/* once a frame for a visible player: look along the line when it is this player's turn, then set the tag */
function ntTagTick(p,M){
  const tag=M.tag;
  if(!tag)return;
  if(p.tagSeen===undefined||(frameCount+p.id)%NT_TAGEVERY===0)
    p.tagSeen=ntTagSeen(camera.position.x,camera.position.y,camera.position.z,p.x,p.y+((p.fl&2)?1.4:1.62),p.z);
  const a=ntTagAlpha(p.tagSeen,!!(p.fl&2));
  tag.visible=a>0;
  if(tag.material.opacity!==a)tag.material.opacity=a;
}
/* ----- the other players ----- */
function ntHash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
/* a player joined (or was already there when we did) */
function ntPeerAdd(id,name,pose){
  id=id|0;if(!id||id===NET.id)return null;
  ntPeerDel(id);
  const p={id,name:''+(name||'Player'),has:false,x:0,y:0,z:0,yaw:0,pitch:0,tx:0,ty:0,tz:0,tyaw:0,pt:-9,dim:'over',held:0,hp:20,fl:0,M:null,anim:0,sw:0,spd:0,
    ar:null,rv:'',ry:0,rh:0,ms:0,skin:''};
  NET.peers.set(id,p);
  if(pose)ntPeerPose(p,pose);
  return p;
}
/* a pose arrived: set the target the body eases toward; a big jump or a new dimension snaps instead */
function ntPeerPose(p,m){
  if(typeof m.x!=='number'||typeof m.y!=='number'||typeof m.z!=='number')return;
  const far=!p.has||p.dim!==m.dim||Math.hypot(m.x-p.x,m.y-p.y,m.z-p.z)>12;
  p.tx=m.x;p.ty=m.y;p.tz=m.z;p.tyaw=+m.yaw||0;p.pitch=+m.pitch||0;p.pt=NET.acc;
  p.dim=''+(m.dim||'over');p.held=m.held|0;p.hp=+m.hp||0;p.ms=m.ms|0;
  p.ar=Array.isArray(m.ar)&&m.ar.length===4?m.ar.map(v=>v|0):null;
  p.rv=typeof m.rv==='string'&&NT_RIDES[m.rv]===1?m.rv:'';p.ry=+m.ry||0;p.rh=+m.rh||0;
  p.rid=p.rv&&typeof m.rid==='string'?m.rid:'';p.rp=p.rv?+m.rp||0:0;p.rr=p.rv?+m.rr||0:0;   /* 6.57 */
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
  if(p.M&&p.M.veh){const f=p.fl;p.fl=0;ntPeerRide(p);p.fl=f;}   /* the vehicle first: it owns its own geometry */
  const M=p.M;p.M=null;
  if(!M||!scene)return;
  scene.remove(M.G);
  if(typeof M.G.traverse==='function')M.G.traverse(o=>{if(o.isT3D||o.userData&&o.userData.shared)return;
    if(o.geometry&&!o.geometry.ntKeep)o.geometry.dispose();
    if(o.material&&o.material.ntOwn){if(o.material.map)o.material.map.dispose();o.material.dispose();}});
}
/* the address of a skin as the server passes it on (bare base64), or '' if it is not a skin after all */
function ntSkinUrl(png){
  if(typeof png!=='string'||!png)return '';
  const url='data:image/png;base64,'+png;
  return skinCheck(skinBytes(url)).ok?url:'';
}
/* tell the server what this player wears ('' is the default) */
function ntSkinSend(){ntSend({t:'skin',png:SKINS.url?SKINS.url.replace(/^data:image\/png;base64,/,''):''});}
/* the hoodie a player without a skin of their own wears: one of eight colours, by name */
function ntHood(p){return '#'+NT_SHIRTS[ntHash(p.name.toLowerCase())%NT_SHIRTS.length].toString(16).padStart(6,'0');}
/* The same figure the player's own third-person view has (skinModel, features/p53b_skin.js), in the skin that player sent,
   or the default one with a hoodie in their own colour, and the name over the head. */
function ntPeerMesh(p){
  const cv=skinCanvas(),tex=skinTexture(cv);
  skinLoadInto(cv,tex,p.skin||'',ntHood(p));
  const S=skinModel(tex);
  for(const m of S.skinMats)m.ntOwn=true;
  const G=S.G,head=S.head,aL=S.aL,aR=S.aR,lL=S.lL,lR=S.lR;
  const mat=c=>{const m=new THREE.MeshLambertMaterial({color:c});m.ntOwn=true;return m;};
  /* armour: plates a little larger than the limb under them, hidden until worn. Slot 0 helmet, 1 chestplate (body and
     arms), 2 leggings, 3 boots; each slot has one material, tinted to what is worn (ntPeerArmor). */
  /* 6.36: the same textured layer the player's own figure wears (features/p53c_armor_layer.js); its pictures and materials
     are shared by everyone and are not this player's to throw away */
  const AL=armorLayer(S),arm=[0,1,2,3].map(i=>({parts:AL.parts[i],col:''}));
  const M={G,head,aL,aR,lL,lR,tag:null,_toolId:0,_tool:null,arm,al:AL,_arS:'',veh:null,_veh:'',skinCv:cv,skinTex:tex,_skin:p.skin||''};
  try{
    if(typeof THREE.Sprite==='function'&&typeof THREE.CanvasTexture==='function'&&typeof document!=='undefined'){
      const cv=document.createElement('canvas'),c=cv.getContext('2d');
      cv.width=256;cv.height=48;
      c.font='bold 28px monospace';
      const w=Math.min(250,c.measureText(p.name).width+18);
      c.fillStyle='rgba(0,0,0,0.45)';c.fillRect((256-w)/2,6,w,36);
      c.fillStyle='#fff';c.textAlign='center';c.textBaseline='middle';c.fillText(p.name,128,25,244);
      const tx=new THREE.CanvasTexture(cv);tx.magFilter=THREE.NearestFilter;
      const sm=new THREE.SpriteMaterial({map:tx,transparent:true,depthWrite:false,depthTest:false});sm.ntOwn=true;   /* 6.29: drawn over everything; ntTagTick dims it behind a wall */
      const sp=new THREE.Sprite(sm);sp.scale.set(1.6,0.3,1);sp.position.y=2.25;sp.renderOrder=NT_TAGORDER;G.add(sp);M.tag=sp;
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
/* show the armour this player wears, rebuilt only when it changes */
function ntPeerArmor(p){
  const M=p.M,s=p.ar?p.ar.join(','):'';
  if(M._arS===s)return;
  M._arS=s;
  const cols=M.al.sync(p.ar);
  for(let i=0;i<4;i++)if(cols[i])M.arm[i].col=cols[i];
}
/* the vehicle under a riding player: the core's own model for that kind, built when they get on and dropped when they
   get off. It hangs off the body (so it shows, hides and leaves with it) and is turned to the vehicle's own heading. */
function ntPeerRide(p){
  const M=p.M,kind=(p.fl&8)&&!ntHosted()?p.rv:'';   /* where the server keeps the vehicles, the real one is there to see */
  if(M._veh!==kind){
    M._veh=kind;
    if(M.veh){M.G.remove(M.veh);if(typeof M.veh.traverse==='function')M.veh.traverse(o=>{if(o.geometry)o.geometry.dispose();
      for(const mm of (Array.isArray(o.material)?o.material:o.material?[o.material]:[]))mm.dispose();});M.veh=null;}
    if(kind){
      let r=null;
      try{r=kind==='car'?mkCarMesh():kind==='skate'?mkSkateMesh():kind==='cart'?mkCartMesh():kind==='boat'?mkBoatMesh():mkPlaneMesh();}catch(e){r=null;}
      const g=r&&r.G?r.G:null;
      if(g){g.userData.shared=true;g.traverse&&g.traverse(o=>{o.userData.shared=true;});M.G.add(g);M.veh=g;}   /* shared: ntPeerUnmesh leaves it to the code above */
    }
  }
  if(M.veh){
    if(RIDE_SEATED[p.rv]===1){                             /* 6.57: the body already faces (and tilts with) the vehicle */
      M.veh.rotation.set(0,0,0);
      if(p.rv==='plane')M.veh.position.set(0,0.15,0.3);    /* the cockpit: seatY -0.15, seatF 0.3 (p51) */
      else M.veh.position.set(0,-p.rh,0);
    }else{M.veh.rotation.y=p.ry-p.yaw;M.veh.position.set(0,-p.rh+((p.fl&2)?0.12:0),0);}
  }
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
    /* 6.57: seated, the body faces the vehicle and only the head follows the look; on a vehicle this game can see (the
       server's, ridden by them) the body is put on its seat, so rider and vehicle move as one */
    const seat=(p.fl&8)&&RIDE_SEATED[p.rv]===1,v=seat&&p.rid?NET.vehs.get(p.rid):null,veh=v&&!v.dead&&v.pup?v:null;
    M.G.rotation.order='YXZ';M.head.rotation.order='YXZ';
    if(seat){
      const ry=veh?(veh.yaw||0):p.ry,pl=p.rv==='plane';
      if(veh&&pl){veh._rp=+p.rp||0;veh._rr=+p.rr||0;veh._rpT=NET.acc;}
      if(veh){const s=rideSeatPos(pl?{x:veh.x,y:veh.y,z:veh.z,yaw:ry,pitch:veh.pitch||0,seatY:veh.seatY,seatF:veh.seatF,t:'plane'}:veh);p.x=s[0];p.y=s[1];p.z=s[2];M.G.position.set(p.x,p.y,p.z);}
      M.G.rotation.set(pl?(veh?veh.pitch||0:+p.rp||0):0,ry,pl?(veh?veh.roll||0:+p.rr||0):0);
      M.head.rotation.y=rideHeadYaw(p.yaw,ry);
    }else{M.G.rotation.x=0;M.G.rotation.z=0;M.head.rotation.y=0;}
    M.lL.visible=M.lR.visible=M.aL.visible=M.aR.visible=!(seat&&p.rv==='plane');
    ntTagTick(p,M);
    M.head.rotation.x=p.pitch*0.55;
    if(M._skin!==(p.skin||'')){M._skin=p.skin||'';skinLoadInto(M.skinCv,M.skinTex,M._skin,ntHood(p));}   /* they changed their skin */
    ntPeerTool(p);ntPeerArmor(p);ntPeerRide(p);
    if(p.fl&8){M.lL.rotation.x=M.lR.rotation.x=-1.15;M.aL.rotation.x=M.aR.rotation.x=-0.5;}
    else{
      p.anim+=p.spd*dt*2.4;
      const sw=Math.sin(p.anim)*0.7*clamp(p.spd/4.4,0,1);
      M.lL.rotation.x=sw;M.lR.rotation.x=-sw;M.aL.rotation.x=-sw*0.8;M.aR.rotation.x=sw*0.8;
    }
    if(p.sw>0){p.sw=Math.max(0,p.sw-dt*4);M.aR.rotation.x=-1.5*Math.sin(p.sw*Math.PI);}
  }
}
/* the renderTab hook: one row per other player (name, health, ping, where they are if not here), and this player's ping */
function ntTabRows(rows){
  if(rows[0])rows[0][2]=NET.ms+' ms';
  for(const p of NET.peers.values())rows.push([p.name,(p.fl&16)?'creative':(p.fl&4)?'dead':Math.round(p.hp)+'❤',p.ms+' ms',
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
    const crit=critNow()&&!(st&&DEFS[st.id].pg);
    if(crit)dmg*=CRIT_MUL;
    if(E&&E.sharp)dmg+=E.sharp*1.2;
    const pz=psnHit(st,null);                              /* 6.40: a coated blade poisons the player it hits */
    ntSend({t:'hit',to:best.id,dmg,kx:d[0],kz:d[2],crit:crit?1:0,...(pz?{psn:1}:{})});   /* the server shows the burst to everyone else nearby */
    if(pz)redrawHotbar();
    if(crit)critFx(best.x,best.y+1.1,best.z);
    best.sw=0;playS('hit');
    if(tl)damageHeld(tl.type==='sword'?1:2);
  }
  return true;
}
/* a critical hit on a mob in this game: the players nearby see the burst (6.30) */
function ntCrit(x,y,z){ntSend({t:'crit',x,y,z});}
/* ----- who runs the world here ----- */
/* is this peer's game running the world right now? (here, alive on the wire, not paused) */
function ntPeerLive(p){return p.has&&p.dim===DIM&&!(p.fl&32)&&NET.acc-p.pt<3;}
/* The tickFlow hook: should this game simulate the block column at x,z? Of the players within 48 blocks of it, the one with
   the lowest id does, and its results reach the others as ordinary block edits; if nobody is that close, everyone who has
   the chunk does (the old behaviour). So water flows once, not once per player, and what it washes loose drops once. */
function ntSimHere(x,z){
  if(NET.host)return true;                                 /* the server's game runs the water wherever it has the land */
  if(ntHosted())return false;                              /* ...and where it does, a player's game runs none */
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
