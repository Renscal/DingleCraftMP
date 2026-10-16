/* PART 51 - THE PROP PLANE (Dingle Airlines: one seat, no refunds) */
function mkPlaneMesh(){
  const G=new THREE.Group(),mats=[];
  G.rotation.order='YXZ';   /* 6.57: heading, then pitch, then roll (the default XYZ tilts the wrong way once it turns) */
  const M=(c,o)=>{const m=new THREE.MeshLambertMaterial(Object.assign({color:c},o||{}));mats.push(m);return m;};
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.85,0.85,3.3),M(0xe8e2d0));
  body.position.y=0.95;G.add(body);
  const nose=new THREE.Mesh(new THREE.BoxGeometry(0.72,0.72,0.5),M(0xb8322a));
  nose.position.set(0,0.95,-1.85);G.add(nose);
  const canopy=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.55,0.9),M(0x9fd4ff,{transparent:true,opacity:0.6}));
  canopy.position.set(0,1.55,-0.3);G.add(canopy);   /* 6.57: big enough for a head */
  const wing=new THREE.Mesh(new THREE.BoxGeometry(4.8,0.12,0.95),M(0xb8322a));
  wing.position.set(0,1.3,-0.45);G.add(wing);
  const tail=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.1,0.5),M(0xb8322a));
  tail.position.set(0,1.15,1.5);G.add(tail);
  const fin=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.75,0.55),M(0xe8e2d0));
  fin.position.set(0,1.5,1.52);G.add(fin);
  const prop=new THREE.Group();
  prop.add(new THREE.Mesh(new THREE.BoxGeometry(0.12,1.5,0.08),M(0x2c2c30)));
  prop.add(new THREE.Mesh(new THREE.BoxGeometry(1.5,0.12,0.08),M(0x2c2c30)));
  prop.position.set(0,0.95,-2.14);
  G.add(prop);
  const wg=new THREE.BoxGeometry(0.16,0.4,0.4);
  const wm=M(0x1a1a1e);
  for(const sx of[-1,1]){const w=new THREE.Mesh(wg,wm);w.position.set(sx*0.55,0.2,-0.7);G.add(w);}
  const tw=new THREE.Mesh(wg,wm);tw.position.set(0,0.2,1.6);G.add(tw);
  return {G,prop,mats};
}
function spawnPlane(x,y,z,yaw){
  const {G,prop,mats}=mkPlaneMesh();
  scene.add(G);
  entities.push({t:'plane',x,y,z,vx:0,vy:0,vz:0,hw:0.95,h:1.6,hp:40,spd:0,
    yaw:yaw||0,pitch:0,onGround:false,hurtT:0,mesh:G,prop,mats,seatY:-0.15,seatF:0.3,eyeH:1.75});   /* 6.57: in the cockpit */
}
function updatePlane(e,dt){
  if(!chunkAt(Math.floor(e.x),Math.floor(e.z)))return;
  e.hurtT=Math.max(0,e.hurtT-dt);
  if(e.hurtT<0.15)for(const m of e.mats)m.emissive&&m.emissive.setRGB(0,0,0);
  const ridden=P&&P.ride===e&&!P.dead;
  /* 6.57: flown like a plane, not pointed like a camera. W dives and S climbs, A/D turn, Space is the throttle, Alt the
     brake (each follows its binding: p06h). Where the rider looks changes nothing.
     6.66: the throttle (e.thr, 0 to 1) stays where it is put: Space opens it, Alt closes it (and brakes while held), and
     the speed follows it up to thr x 28. Held from a standstill it climbs exactly as before (the 6/s rate is always the
     lower limit). Nobody aboard: it closes. */
  let pin=0,s=0,thr=false,brk=false;
  if(ridden&&!modalOpen()&&!paused){
    pin=clamp((KEY.KeyS?1:0)-(KEY.KeyW?1:0)-TOUCH.f,-1,1);
    s=clamp((KEY.KeyD?1:0)-(KEY.KeyA?1:0)+TOUCH.s,-1,1);
    thr=!!KEY.Space;brk=!!KEY.AltLeft;
  }
  if(e.pitch==null)e.pitch=0;
  e.thr=ridden?clamp((e.thr||0)+(thr?dt*0.5:(brk?-dt*0.5:0)),0,1):0;
  const tgt=e.thr*28;
  if(brk&&!thr)e.spd=e.spd>0.05?Math.max(0,e.spd-dt*(e.onGround?12:6)):(e.onGround?Math.max(-3,e.spd-dt*2):e.spd);
  else if(e.spd<tgt)e.spd=Math.min(tgt,Math.max(0,e.spd)+dt*(e.onGround?7:6));
  else if(e.spd>tgt)e.spd=Math.max(tgt,e.spd-dt*(e.onGround?3:0.5+e.spd*0.02));
  else if(e.spd<0)e.spd=Math.min(0,e.spd+dt*3);
  if(!e.onGround)e.spd=clamp(e.spd-Math.sin(e.pitch)*dt*5,0,34);   /* climbing costs speed, diving pays it back */
  if(Math.abs(e.spd)>0.5)e.yaw-=s*dt*(e.onGround?1.7:1.05);
  const lift=clamp((e.spd-8)/9,0,1);
  if(pin)e.pitch+=pin*dt*1.1;
  else e.pitch-=e.pitch*Math.min(1,dt*0.8);                        /* hands off: the nose comes back to level */
  if(lift<1&&!e.onGround)e.pitch-=(1-lift)*dt*0.9;                 /* too slow to fly: the nose drops */
  e.pitch=clamp(e.pitch,e.onGround?0:-0.9,lift>0?0.9:0);
  const cp=Math.cos(e.pitch),fx=-Math.sin(e.yaw)*cp,fz=-Math.cos(e.yaw)*cp;
  const gl=1-Math.exp(-dt*3.2);
  e.vx=lerp(e.vx,fx*e.spd,gl);
  e.vz=lerp(e.vz,fz*e.spd,gl);
  const tv=Math.sin(e.pitch)*e.spd*lift;
  e.vy=lerp(e.vy,tv,1-Math.exp(-dt*2.6))-GRAV*dt*(1-lift);
  if(e.vy<-38)e.vy=-38;
  const spdWas=Math.abs(e.spd),air=!e.onGround,vyIn=e.vy;
  const wall=moveBody(e,e.vx*dt,e.vy*dt,e.vz*dt,false);
  if(air&&e.onGround&&(vyIn<-8||(spdWas>20&&vyIn<-3))){e.spd*=0.5;e.thr*=0.5;playS('thud');}   /* 6.66: hitting the ground (a drop of two blocks or more, or fast and sinking) costs speed and throttle; a ledge while taxiing, a hop on the take-off run and a gentle landing do not */
  if(wall){
    if(spdWas>11){
      e.hp-=Math.round(spdWas*0.5);e.hurtT=0.4;playS('thud');
      for(const m of e.mats)m.emissive&&m.emissive.setRGB(0.4,0.1,0);
      if(e.hp<=0){killCar(e);return;}
    }
    e.spd*=0.3;e.thr*=0.5;
  }
  if(e.y<-40){if(P&&P.ride===e)P.ride=null;removeEnt(e);return;}
  e.prop.rotation.z+=dt*(3+Math.abs(e.spd)*1.6);
  e.mesh.position.set(e.x,e.y,e.z);
  e.mesh.rotation.y=e.yaw;
  e.mesh.rotation.x=e.pitch;
  e.roll=lerp(e.roll||0,e.onGround?0:s*-0.4,1-Math.exp(-dt*3));
  e.mesh.rotation.z=e.roll;
}
/* 6.66: the throttle gauge on the right of the screen, while riding a plane (written only when it changes) */
let _thrLast=-1;
function tickThrottleHud(){
  const el=$('thrhud'),f=$('thrfill');
  if(!el||!f)return;
  const e=P&&!P.dead&&!CUT.on&&P.ride&&P.ride.t==='plane'?P.ride:null,v=e?Math.round((e.thr||0)*100):-1;
  if(v===_thrLast)return;
  _thrLast=v;
  el.style.display=v<0?'none':'block';
  if(v>=0){f.style.height=v+'%';f.className=v>=100?'full':'';}
}
IT.PLANE=283;
idef(IT.PLANE,{name:'Prop Plane',icon:'i_plane',stack:1,plane:1});
tile('i_plane',c=>{c.clearRect(0,0,16,16);
  c.fillStyle='#e8e2d0';c.fillRect(2,7,11,3);
  c.fillStyle='#b8322a';c.fillRect(1,7,2,3);c.fillRect(5,4,3,8);c.fillRect(11,5,2,3);
  c.fillStyle='#9fd4ff';c.fillRect(9,6,2,2);
  c.fillStyle='#2c2c30';c.fillRect(0,5,1,7);
  c.fillStyle='#1a1a1e';c.fillRect(4,10,2,2);c.fillRect(10,10,2,2);});
RS([IT.IRON,IT.IRON,IT.IRON,IT.IRON,IT.IRON,B.GLASS],IT.PLANE,1);

