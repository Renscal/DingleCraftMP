/* n_disaster.js (v6.72, lane NET, gate x1): a disaster on a server is everyone's (src/net/n9_ents.js ntDisOut, ntDisIn,
   ntDisWatch; the twister copy in src/features/p11_thirdperson_lava_disasters.js; the 'dis' message in
   server/lib/protocol.mjs).
   1 the starter's game: twice a second it says what is raging, where, for how long and where its tornado is; once
     over, that it is over (and then nothing)
   2 a watcher's game: another player's tornado shows with its timer and wind, its copy follows the real one's
     position, pulls this player in, and shreds nothing (the real one's blocks arrive as edits); it ends when told,
     or quietly when its player has not been heard of for 3 s; this game's own disaster comes first
   3 another player's lava bomb burns the player it lands beside, and leaves no lava here
   4 the server: passes a disaster to the players within 160 blocks in the same dimension, not to one far off or in the
     Nether, drops an unknown kind and one started far from its player, and passes on its end */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const path=require('path'),{pathToFileURL}=require('url');
const {REPO}=require('../lib/paths.js');
const V=boot({seed:72});
const step=boot.stepper(600000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(f,ms)=>{const t=Date.now();while(Date.now()-t<ms){if(f())return true;await sleep(20);}return f();};

boot.run(async()=>{
  ok('the seams are on __vox',['ntDisOut','ntDisIn','ntDisWatch','ntFxIn','startDisaster','endDisaster'].every(k=>typeof V[k]==='function'));
  V.startNewWorld('n72','1337','s');V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;step(160);
  const NET=V.NET,P=()=>V.P,DIS=V.DIS||V.getDIS(),sent=[];
  const online=fn=>{const w=NET.ws,o=NET.on;NET.ws={readyState:1,send:s=>sent.push(JSON.parse(s))};NET.on=true;try{return fn();}finally{NET.ws=w;NET.on=o;}};
  const twisters=()=>V.entities.filter(e=>e.t==='twister'&&!e.dead);
  const p0={x:P().x,y:P().y,z:P().z};

  /* ===== 1. the starter ===== */
  {V.startDisaster('tornado',p0.x+30,p0.z);step(5);
    online(()=>{NET.acc+=1;V.ntDisOut();V.ntDisOut();});
    const m=sent.filter(x=>x.t==='dis');
    ok('a tornado here is announced: kind, centre, how long it has run, where its funnel is (and not twice in one half second)',m.length===1&&m[0].k==='tornado'&&m[0].x===Math.floor(p0.x+30)&&typeof m[0].at==='number'&&Array.isArray(m[0].tw)&&m[0].tw.length===2);
    V.endDisaster(true);sent.length=0;
    online(()=>{NET.acc+=1;V.ntDisOut();NET.acc+=1;V.ntDisOut();});
    ok('once it is over: one message saying so, then nothing',sent.length===1&&sent[0].t==='dis'&&sent[0].k==='');
    sent.length=0;}

  /* ===== 2. a watcher ===== */
  {const tx=Math.floor(p0.x)+12,tz=Math.floor(p0.z);
    /* a little grove right beside where the funnel will stand: the real one would shred it */
    const grove=[];for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){const x=tx+dx,z=tz+dz+3,y=V.surfaceTop(x,z)+1;V.setBlock(x,y,z,V.B.LEAF_O);grove.push([x,y,z]);}
    step(2);
    online(()=>V.ntDisIn({t:'dis',from:7,name:'Ann',k:'tornado',x:tx,z:tz,gy:V.surfaceTop(tx,tz)+1,at:20,tw:[tx,tz]}));
    const tw=twisters();
    ok('another player\'s tornado: it rages here too, as theirs (a copy of its funnel, 20 s in)',DIS.kind==='tornado'&&DIS.remote===true&&tw.length===1&&tw[0].remote===true&&Math.abs(DIS.t-20)<0.01);
    step(1);const hud=String(V.$?V.$('dis').textContent:document.getElementById('dis').textContent);
    ok('...with its timer ('+hud+')',/TORNADO/.test(hud)&&/2:40|2:39/.test(hud));
    online(()=>V.ntDisIn({t:'dis',from:7,name:'Ann',k:'tornado',x:tx,z:tz,at:21,tw:[tx+6,tz]}));
    for(let i=0;i<40;i++){step(1);NET.acc+=0.045;}
    ok('the copy goes where the real one was last seen ('+tw[0].x.toFixed(1)+')',Math.abs(tw[0].x-(tx+6))<0.6);
    ok('...and shreds nothing (the real one\'s blocks arrive as edits)',grove.every(([x,y,z])=>V.getBlock(x,y,z)===V.B.LEAF_O));
    V.GR.god=true;P().x=tw[0].x-6;P().z=tw[0].z;P().vx=P().vz=0;const d0=Math.hypot(P().x-tw[0].x,P().z-tw[0].z);
    online(()=>V.ntDisIn({t:'dis',from:7,name:'Ann',k:'tornado',x:tx,z:tz,at:23,tw:[tw[0].x,tw[0].z]}));
    step(6);const d1=Math.hypot(P().x-tw[0].x,P().z-tw[0].z);
    ok('...and pulls this player in, as the real one would ('+d0.toFixed(1)+' -> '+d1.toFixed(1)+')',d1<d0-0.5);
    online(()=>V.ntDisIn({t:'dis',from:9,k:''}));
    ok('an end from someone else\'s disaster changes nothing',DIS.kind==='tornado');
    online(()=>V.ntDisIn({t:'dis',from:7,k:''}));step(2);
    ok('its end: it is over here, the funnel gone',!DIS.kind&&!DIS.remote&&twisters().length===0);
    online(()=>V.ntDisIn({t:'dis',from:7,name:'Ann',k:'fire',x:tx,z:tz,at:5}));NET.acc+=4;step(2);
    ok('a watched disaster whose player falls silent for 3 s ends quietly',!DIS.kind&&!DIS.remote);
    V.startDisaster('tsunami',p0.x,p0.z);
    online(()=>V.ntDisIn({t:'dis',from:7,name:'Ann',k:'tornado',x:tx,z:tz,at:5}));
    ok('this game\'s own disaster comes first',DIS.kind==='tsunami'&&!DIS.remote);
    V.endDisaster(true);V.GR.god=false;P().x=p0.x;P().y=p0.y;P().z=p0.z;step(20);}

  /* ===== 3. another player's lava bomb ===== */
  {P().hp=20;P().hurtT=0;const x=P().x+1,y=P().y+3,z=P().z;
    online(()=>V.ntFxIn({t:'fx',from:7,f:[['7f9','lavab',x,y,z,0,0,0,19.2,6]]}));
    const cp=V.entities.find(e=>e.fxid==='7f9');
    for(let i=0;i<60&&cp&&!cp.dead;i++)step(1);
    let lava=0;for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let dy=-2;dy<=4;dy++)if(V.getBlock(Math.floor(x)+dx,Math.floor(P().y)+dy,Math.floor(z)+dz)===V.B.LAVA)lava++;
    ok('another player\'s lava bomb lands beside this player: it burns ('+P().hp+' hp), and is gone',!!cp&&cp.dead&&P().hp<=14);
    ok('...and leaves no lava here (theirs arrives as an edit)',lava===0);}

  /* ===== 4. the server ===== */
  {const {createServer}=await import(pathToFileURL(path.join(REPO,'server','dinglecraft-server.mjs')).href);
    const S=createServer({port:0,memory:true,world:'',noGame:true,quiet:true,seed:'72',simulate:false});await S.listen();
    const raw=name=>{const ws=new WebSocket('ws://127.0.0.1:'+S.port),R={got:[],by:t=>R.got.filter(m=>m.t===t),send:m=>ws.send(JSON.stringify(m)),close:()=>ws.close()};
      ws.onmessage=e=>R.got.push(JSON.parse(e.data));R.open=new Promise(r=>{ws.onopen=()=>{R.send({t:'hello',proto:V.NT_PROTO,v:V.GAME_VERSION,name,pw:''});r();};});
      R.pose=(x,z,dim)=>R.send({t:'pose',x,y:40,z,yaw:0,pitch:0,dim:dim||'over',held:0,hp:20,fl:0});return R;};
    const a=raw('Ann'),b=raw('Bob'),c=raw('Cyd'),d=raw('Dot');
    for(const r of [a,b,c,d])await r.open;
    await until(()=>[a,b,c,d].every(r=>r.by('ready').length),5000);
    a.pose(0,0);b.pose(100,0);c.pose(400,0);d.pose(10,0,'nether');await sleep(300);
    a.send({t:'dis',k:'volcano',x:2,z:1,gy:41,at:3.5});
    await until(()=>b.by('dis').length>0,2000);await sleep(150);
    const got=b.by('dis')[0];
    ok('the server passes a disaster to a player 100 blocks off, with who started it',!!got&&got.k==='volcano'&&got.name==='Ann'&&got.x===2&&got.at===3.5&&got.gy===41);
    ok('...not to one 400 blocks off, nor to one in the Nether',c.by('dis').length===0&&d.by('dis').length===0);
    a.send({t:'dis',k:'meteor',x:0,z:0});a.send({t:'dis',k:'tornado',x:900,z:0});await sleep(250);
    ok('an unknown kind, and a disaster far from the player who says they started it: dropped',b.by('dis').length===1);
    a.send({t:'dis',k:''});await until(()=>b.by('dis').length>1,2000);
    ok('its end is passed on',b.by('dis').length===2&&b.by('dis')[1].k==='');
    for(const r of [a,b,c,d])r.close();await S.close();}
});
