/* k25_vehicles.js (v6.57, lane CORE2, gate x1): sitting down and flying.
   1 the plane: Space is the throttle, W dives, S climbs, A/D turn, Alt brakes (and backs up when stopped on the ground);
     hands off, the nose comes back to level; where you look changes nothing (the same keys at five look angles fly the
     same path to the millimetre); the brake is a rebindable key
   2 every ridden vehicle: after each frame the rider is on the seat of where the vehicle is NOW (no frame of lag), car and
     plane at speed included; in a seated one (car, boat, cart, plane) the view turns with it, on a skateboard it does not
   3 the rider's model: the body faces (and in a plane tilts with) the vehicle, only the head follows the look (limited),
     a plane hides the legs and gives them back on getting off
   4 another player in a plane: the pose carries the vehicle id and the tilt, and their body sits on the seat of the
     vehicle this game sees (rider and vehicle move as one)
   5 the html and the code: the Controls row, the plane's rotation order, the server keeps the new pose fields */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const fs=require('fs');
const V=boot({seed:57});
const step=boot.stepper(700000);
const HH=fs.readFileSync(boot.BUILD+'head.html','utf8');
const near=(a,b,e)=>Math.abs(a-b)<(e||1e-9);
const wrap=a=>((a+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;

boot.run(async()=>{
  ok('the seams are on __vox',['rideSeatPos','rideSeat','rideHeadYaw','spawnPlane','spawnCar','spawnBoat','spawnCart','spawnSkate','setCam','getPlModel'].every(k=>typeof V[k]==='function')&&!!V.RIDE_SEATED);
  V.startNewWorld('k25','1337','s');V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;step(160);
  V.GR.god=true;
  const KEY=V.KEY,keys=o=>{for(const k of ['Space','KeyW','KeyS','KeyA','KeyD','AltLeft'])KEY[k]=!!(o&&o[k]);};
  const plane=y=>{V.spawnPlane(V.P.x+2,y,V.P.z,0);return V.entities.filter(e=>e.t==='plane'&&!e.dead).pop();};
  const off=e=>{V.P.ride=null;keys();step(2);e.dead=true;if(V.removeEnt)V.removeEnt(e);step(1);};

  /* ===== 1. the plane ===== */
  {const runs=[];
   for(const look of [-1.2,-0.5,0,0.5,1.2]){
     const e=plane(66);V.P.ride=e;V.P.pitch=look;V.P.yaw=0.3;keys({Space:1,KeyS:1});
     const x0=e.x,z0=e.z,y0=e.y;step(160);
     runs.push([+(e.x-x0).toFixed(6),+(e.y-y0).toFixed(6),+(e.z-z0).toFixed(6),+e.spd.toFixed(6)]);off(e);
   }
   ok('Space + S climbs away ('+runs[2].map(v=>v.toFixed(1)).join(', ')+'), the same path at five look angles',runs[2][1]>4&&runs[2][3]>14&&runs.every(r=>r.join()===runs[0].join()));}
  {const e=plane(70);V.P.ride=e;keys({Space:1});step(120);
   const sp=e.spd,y1=e.y;keys({Space:1,KeyW:1});step(30);
   ok('W dives: nose down ('+e.pitch.toFixed(2)+'), height falls ('+(e.y-y1).toFixed(1)+')',e.pitch<-0.3&&e.y<y1-1&&sp>14);
   keys({Space:1});step(60);
   ok('hands off the stick: the nose comes back toward level ('+e.pitch.toFixed(2)+')',Math.abs(e.pitch)<0.2);
   const yw=e.yaw;keys({Space:1,KeyD:1});step(30);
   ok('D turns right (yaw falls: forward is -sin, -cos) and banks',e.yaw<yw-0.3&&e.roll<-0.1);
   keys({Space:1,KeyA:1});step(30);const yw2=e.yaw;step(20);
   ok('A turns back',e.yaw>yw2+0.1);
   const s0=e.spd;keys({AltLeft:1});step(20);
   ok('Alt brakes in the air ('+s0.toFixed(1)+' -> '+e.spd.toFixed(1)+')',e.spd<s0-3);
   off(e);}
  {const P=V.P,gy=V.surfaceTop(Math.floor(P.x+2),Math.floor(P.z))+1,e=plane(gy+0.2);V.P.ride=e;keys();step(30);
   ok('a parked plane sits on the ground',e.onGround);
   keys({Space:1});step(40);const sp=e.spd;keys({AltLeft:1});step(60);
   const z0=e.z,x0=e.x;step(40);const back=e.spd;keys();
   ok('Alt stops it on the ground ('+sp.toFixed(1)+' -> stop), then backs it up slowly ('+back.toFixed(1)+')',sp>3&&back<-1&&back>=-3.01&&Math.hypot(e.x-x0,e.z-z0)>0.5);
   off(e);}
  ok('the brake is a key of its own you can move',V.kbCode('brake')==='AltLeft'&&V.kbSet('brake','KeyB')&&V.kbEv({code:'KeyB'}).code==='AltLeft'&&(V.kbReset(),V.kbCode('brake')==='AltLeft'));

  /* ===== 2. seated, without lag ===== */
  {const P=V.P,bad=[];
   const kinds=[['car',()=>V.spawnCar(P.x+2,P.y,P.z,0)],['boat',()=>V.spawnBoat(P.x+2,P.y,P.z,0)],['cart',()=>V.spawnCart(P.x+2,P.y,P.z,0)],
     ['plane',()=>V.spawnPlane(P.x+2,P.y+20,P.z,0)],['skate',()=>V.spawnSkate(P.x+2,P.y,P.z,0)]];
   const res={};
   for(const [k,mk] of kinds){
     mk();const e=V.entities.filter(q=>q.t===k&&!q.dead).pop();
     if(!e){bad.push(k+': not made');continue;}
     V.P.ride=e;keys(k==='plane'||k==='car'?{Space:k==='plane',KeyW:k==='car'}:{});step(3);
     let lag=0;
     for(let i=0;i<40;i++){step(1);if(V.P.ride!==e)break;const s=V.rideSeatPos(e);lag=Math.max(lag,Math.hypot(P.x-s[0],P.y-s[1],P.z-s[2]));}
     const d0=wrap(P.yaw-e.yaw),py=P.yaw;
     e.yaw+=Math.PI/2;step(1);
     res[k]={lag,follow:near(wrap(P.yaw-e.yaw),d0,1e-6),still:near(P.yaw,py,1e-9),spd:e.spd};
     if(lag>1e-9)bad.push(k+' lags '+lag.toFixed(4));
     off(e);
   }
   ok('every vehicle: the rider is on the seat of where it is now, every frame ('+bad.join('; ')+')',!bad.length);
   ok('...while moving: the car ('+(res.car?res.car.spd.toFixed(1):'?')+') and the plane ('+(res.plane?res.plane.spd.toFixed(1):'?')+')',res.car&&res.car.spd>2&&res.plane&&res.plane.spd>2);
   ok('car, boat, cart, plane: the view turns with the vehicle',['car','boat','cart','plane'].every(k=>res[k]&&res[k].follow));
   ok('the skateboard: it does not',res.skate&&res.skate.still);}

  /* ===== 3. the rider's model ===== */
  {V.setCam(1);step(2);const P=V.P,e=plane(70);V.P.ride=e;keys({Space:1});step(60);
   P.yaw=e.yaw+0.7;P.pitch=0.2;step(1);const M=V.getPlModel();
   ok('in a plane the body faces and tilts with it, only the head turns (0.7)',!!M&&near(M.G.rotation.y,e.yaw,1e-9)&&near(M.G.rotation.x,e.pitch,1e-9)&&near(M.G.rotation.z,e.roll,1e-9)&&
     near(M.head.rotation.y,wrap(P.yaw-e.yaw),1e-6)&&M.G.rotation.order==='YXZ');
   P.yaw=e.yaw+3;step(1);
   ok('the head turns at most 1.4 each way',near(Math.abs(M.head.rotation.y),1.4,1e-9));
   ok('no legs or arms in the cockpit (they would poke through its sides)',M.lL.visible===false&&M.lR.visible===false&&M.aL.visible===false&&M.aR.visible===false);
   off(e);step(2);
   ok('getting off: arms and legs back, body upright, facing the look, head straight',M.lL.visible&&M.lR.visible&&M.aL.visible&&M.aR.visible&&near(M.G.rotation.x,0)&&near(M.G.rotation.z,0)&&near(M.G.rotation.y,P.yaw,1e-9)&&near(M.head.rotation.y,0));
   V.spawnCar(P.x+2,P.y,P.z,1);const c=V.entities.filter(q=>q.t==='car'&&!q.dead).pop();V.P.ride=c;step(2);P.yaw=c.yaw-0.5;step(1);
   ok('in a car: the body faces the car, legs kept, head turned by the look',near(M.G.rotation.y,c.yaw,1e-9)&&M.lL.visible&&near(M.head.rotation.y,wrap(P.yaw-c.yaw),1e-6));
   off(c);V.setCam(0);}

  /* ===== 4. another player in a plane ===== */
  {const NT=V.NET||(V.NTEX&&V.NTEX.NET);
   ok('the net seams are on __vox',!!NT&&typeof V.ntPeerAdd==='function'&&typeof V.ntPeersTick==='function'&&typeof V.ntPoseNow==='function');
   if(NT&&V.ntPeersTick){
     const e=plane(72);V.P.ride=e;e.vid='a1v1';keys({Space:1,KeyS:1});step(60);
     const m=V.ntPoseNow();
     ok('the pose carries the vehicle id and the plane\'s tilt',m.rv==='plane'&&m.rid==='a1v1'&&near(m.rp,+e.pitch.toFixed(2),1e-9)&&near(m.rr,+e.roll.toFixed(2),1e-9));
     off(e);
     const v=plane(75);v.vid='b2v9';v.pup=true;v.yaw=0.8;v.tx=v.x;v.ty=v.y;v.tz=v.z;v.tyaw=0.8;NT.vehs.set(v.vid,v);
     const p=V.ntPeerAdd(7,'Ann',{x:v.x+3,y:v.y+2,z:v.z,yaw:2.1,pitch:0,dim:V.getDim(),fl:8,hp:20,rv:'plane',ry:0.8,rh:-0.1,rid:'b2v9',rp:0.4,rr:-0.2});
     NT.acc+=0.01;V.ntPeersTick(0.05);V.ntPeersTick(0.05);
     const s=V.rideSeatPos({x:v.x,y:v.y,z:v.z,yaw:v.yaw,pitch:v.pitch||0,seatY:v.seatY,seatF:v.seatF,t:'plane'}),M=p&&p.M;
     ok('their body sits on the seat of the plane this game sees, facing it, head turned, no legs',!!M&&Math.hypot(M.G.position.x-s[0],M.G.position.y-s[1],M.G.position.z-s[2])<1e-9&&
       near(M.G.rotation.y,v.yaw,1e-9)&&near(M.head.rotation.y,V.rideHeadYaw(2.1,v.yaw),1e-9)&&M.lL.visible===false&&M.aR.visible===false);
     V.ntVehPup&&V.ntVehPup(v,0.5);
     ok('and the plane takes the tilt their pose sent',v.pitch>0.1&&v.roll<-0.05);
     if(V.ntPeerDel)V.ntPeerDel(7);NT.vehs.delete('b2v9');v.dead=true;if(V.removeEnt)V.removeEnt(v);
   }}

  /* ===== 5. html and code ===== */
  {const a=HH.indexOf('<div id="help"'),h=HH.slice(a,HH.indexOf('<button id="h_close"',a));
   ok('Controls has a Plane row with the throttle, brake and stick keys',/<b>Plane<\/b> <span>[^\n]*<kbd data-k="jump">Space<\/kbd> throttle[^\n]*<kbd data-k="brake">Alt<\/kbd> brake[^\n]*<kbd data-k="fwd">W<\/kbd> nose down[^\n]*<kbd data-k="back">S<\/kbd> nose up/.test(h));
   const src=boot.readSrc('features/p51_prop_plane.js');
   ok('the plane is tilted in heading-pitch-roll order and never reads the look',/G\.rotation\.order='YXZ'/.test(src)&&!/lookDir\(\)/.test(src)&&!/P\.pitch/.test(src));
   const pr=fs.readFileSync(require('path').join(boot.BUILD,'..','server','lib','protocol.mjs'),'utf8');
   ok('the server keeps rid (a vehicle id), rp and rr (a plane\'s tilt, bounded) in a pose',/c\.pose\.rid = m\.rid/.test(pr)&&/VEH_ID_RE\.test\(m\.rid\)/.test(pr)&&/c\.pose\.rp = num\(m\.rp, -3\.2, 3\.2, 0\)/.test(pr));}
  keys();V.GR.god=false;
});
