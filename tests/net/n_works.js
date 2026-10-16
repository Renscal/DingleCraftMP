/* n_works.js (v6.73, lane NET, gate x1): a server's Creativity works are the world's (server/lib/world.mjs migrateWorks and
   cleanWork, server/lib/protocol.mjs grantWorks and takeWork, src/net/n9_ents.js ntCrTake ntCrWork ntCrIn ntCrApplyBE
   ntCrDropBE, the crNew hook in src/creativity/c0_contract.js).
   1 the move from the players into the world (once): every work gets a world number above every old one, its owner's own
     things follow it, a chest or ground work follows its owner when only one player had that number (otherwise it keeps
     an old number no new work will take), the players' records lose their works, and a second start changes nothing
   2 what the server accepts: a work at a legal size with its data under the cap, nothing else
   3 live: each game holds three numbers ahead of need; a new work under one of them reaches the others (without its
     owner) and the maker gets a new number; a number it was not handed, someone else's work, or a finished work being
     changed is refused and the sender is put right; finishing signs it with the player's name; throwing an unfinished one
     away reaches everyone; numbers not used come back when a player leaves; a new player gets every work; the works are
     saved in data/works.json and back after a restart
   4 in a player's game: a work from the server becomes an item with its name; on a server a new work takes the number it
     was handed (none left: none made), edits go out at most once a second; someone else's easel waits for its block before
     Creativity counts it; one broken in another game goes without a second copy of its work; a jukebox someone filled plays */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
const {REPO,outDir}=require('../lib/paths.js');
const V=boot({seed:73});
const step=boot.stepper(600000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(f,ms)=>{const t=Date.now();while(Date.now()-t<ms){if(f())return true;await sleep(20);}return f();};
const OUT=path.join(outDir('net'),'works_'+process.pid);

boot.run(async()=>{
  const W=await import(pathToFileURL(path.join(REPO,'server','lib','world.mjs')).href);
  const {createServer}=await import(pathToFileURL(path.join(REPO,'server','dinglecraft-server.mjs')).href);
  const art=(t,st)=>({k:'art',st:st||'done',t,by:'Dan',d:'px'+t,u:1,w:64,h:64}),song=t=>({k:'song',st:'done',t,by:'Dan',d:{tr:[]},u:0});

  /* ===== 1. the move ===== */
  {const w={players:{
      ann:{name:'Ann',inv:[{id:10001,count:1},{id:10002,count:1},{id:5,count:3}],cr:{v:1,n:3,w:{1:art('Sun'),2:song('Hum')}}},
      bob:{name:'Bob',inv:[null,{id:10001,count:1}],cr:{v:1,n:2,w:{1:art('Moon')}}},
      cyd:{name:'Cyd',inv:[]}},
    be:{'1,2,3':{t:'chest',inv:[{id:10002,count:1},{id:10001,count:1},{id:10007,count:1},null]}},
    drops:{d1:{dim:'over',x:0,y:0,z:0,st:{id:10002,count:1}}}};
    const moved=W.migrateWorks(w),nums=Object.keys(w.crw).map(Number).sort((a,b)=>a-b);
    const byT=t=>+Object.keys(w.crw).find(n=>w.crw[n].t===t);
    ok('three works move into the world ('+moved+'), numbered above every old number (old top 7: '+nums.join(',')+')',moved===3&&nums.length===3&&nums[0]>7&&w.crn===nums[2]+1);
    ok('...each knows its owner',w.crw[byT('Sun')].o==='ann'&&w.crw[byT('Hum')].o==='ann'&&w.crw[byT('Moon')].o==='bob');
    ok('their owners\' own things follow (Ann: Sun and Hum, Bob: Moon; stone untouched)',w.players.ann.inv[0].id===10000+byT('Sun')&&w.players.ann.inv[1].id===10000+byT('Hum')&&w.players.ann.inv[2].id===5&&w.players.bob.inv[1].id===10000+byT('Moon'));
    const ch=w.be['1,2,3'].inv;
    ok('in a chest: old 2 (only Ann had it) becomes Hum; old 1 (Ann and Bob both had one) and old 7 (nobody) keep their old numbers',ch[0].id===10000+byT('Hum')&&ch[1].id===10001&&ch[2].id===10007);
    ok('on the ground the same (old 2: Hum)',w.drops.d1.st.id===10000+byT('Hum'));
    ok('the players\' records lose their works',!('cr' in w.players.ann)&&!('cr' in w.players.bob));
    const snap=JSON.stringify(w);ok('a second start moves nothing',W.migrateWorks(w)===0&&JSON.stringify(w)===snap);
    const e={players:{}};W.migrateWorks(e);ok('a world with no works: an empty registry from number 1',JSON.stringify(e.crw)==='{}'&&e.crn===1&&e.crv===1);}

  /* ===== 2. what the server accepts ===== */
  ok('a work at a legal size passes, cleaned',JSON.stringify(W.cleanWork({...art('A'),extra:1}))===JSON.stringify(art('A')));
  ok('a canvas at a size the game cannot make, an unknown kind, too much data: refused',W.cleanWork({...art('B'),w:65})===null&&W.cleanWork({k:'film',st:'done',t:'x'})===null&&W.cleanWork({...art('C'),d:'x'.repeat(7001)})===null);

  /* ===== 3. live ===== */
  fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
  const raw=(port,name)=>{const ws=new WebSocket('ws://127.0.0.1:'+port),R={got:[],by:t=>R.got.filter(m=>m.t===t),last:t=>R.by(t).pop(),send:m=>ws.send(JSON.stringify(m)),close:()=>ws.close()};
    ws.onmessage=e=>R.got.push(JSON.parse(e.data));R.open=new Promise(r=>{ws.onopen=()=>{R.send({t:'hello',proto:V.NT_PROTO,v:V.GAME_VERSION,name,pw:''});r();};});return R;};
  {const S=createServer({port:0,data:OUT,world:'world',quiet:true,noGame:true});await S.listen();
    const a=raw(S.port,'Ann'),b=raw(S.port,'Bob');await a.open;await b.open;
    await until(()=>a.last('crres')&&b.last('crres'),4000);
    const ra=a.last('crres').n.slice(),rb=b.last('crres').n.slice();
    ok('each game holds three numbers ahead of need, none shared ('+ra+' / '+rb+')',ra.length===3&&rb.length===3&&!ra.some(n=>rb.includes(n)));
    const n1=ra[0];a.got.length=0;b.got.length=0;
    a.send({t:'crw',n:n1,r:art('','wip')});
    await until(()=>b.by('crw').length&&a.by('crres').length,3000);
    const g=b.last('crw');
    ok('a new work under a number it holds reaches the others, without who owns it',!!g&&g.n===n1&&g.r.k==='art'&&g.r.st==='wip'&&!('o' in g.r)&&S.world().crw[n1].o==='ann');
    ok('...and the maker is handed a new number in its place',a.last('crres').n.length===3&&!a.last('crres').n.includes(n1));
    a.got.length=0;b.got.length=0;
    a.send({t:'crw',n:rb[0],r:art('stolen','wip')});b.send({t:'crw',n:n1,r:art('mine now','wip')});
    await until(()=>a.by('crw').length&&b.by('crw').length,3000);
    ok('a number this game was not handed: refused, and it is told there is none',a.last('crw').n===rb[0]&&a.last('crw').r===null&&!S.world().crw[rb[0]]);
    ok('someone else\'s work: refused, and they are sent it as it is',b.last('crw').n===n1&&b.last('crw').r.t===''&&S.world().crw[n1].t==='');
    a.got.length=0;b.got.length=0;
    a.send({t:'crw',n:n1,r:{...art('Dawn','done'),by:'Dan'}});
    await until(()=>a.by('crw').length&&b.by('crw').length,3000);
    ok('finishing it signs it with the player\'s name, for everyone and back to the maker',S.world().crw[n1].by==='Ann'&&a.last('crw').r.by==='Ann'&&b.last('crw').r.by==='Ann'&&b.last('crw').r.t==='Dawn');
    a.got.length=0;a.send({t:'crw',n:n1,r:art('Dusk','done')});await until(()=>a.by('crw').length,2000);
    ok('a finished work never changes: refused, the maker is put right',S.world().crw[n1].t==='Dawn'&&a.last('crw').r.t==='Dawn');
    const n2=a.last('crres')?a.last('crres').n[0]:ra[1];a.got.length=0;b.got.length=0;
    a.send({t:'crw',n:n2,r:art('','wip')});await until(()=>b.by('crw').length,2000);b.got.length=0;
    a.send({t:'crw',n:n2,r:null});await until(()=>b.by('crw').length,2000);
    ok('an unfinished work thrown away: gone for everyone',!S.world().crw[n2]&&b.last('crw').n===n2&&b.last('crw').r===null);
    const held=b.last('crres')?b.last('crres').n:rb;
    b.close();await until(()=>S.players().length===1,3000);
    ok('a player who leaves gives back the numbers they did not use',held.every(n=>S.world().crfree.includes(n)));
    const c=raw(S.port,'Cyd');await c.open;await until(()=>c.last('ready')&&c.last('crres'),4000);
    const wl=c.last('welcome');
    ok('a new player gets every work (without owners) and numbers given back first',!!wl&&wl.world.crw&&wl.world.crw[n1]&&wl.world.crw[n1].t==='Dawn'&&!('o' in wl.world.crw[n1])&&!('crfree' in wl.world)&&c.last('crres').n.some(n=>held.includes(n)));
    a.close();c.close();S.saveWorld();await S.close();
    const doc=JSON.parse(fs.readFileSync(path.join(OUT,'world','data','works.json'),'utf8'));
    ok('the works are kept in data/works.json',!!doc.crw&&doc.crw[n1].t==='Dawn'&&doc.crw[n1].o==='ann'&&doc.crv===1);
    const S2=createServer({port:0,data:OUT,world:'world',quiet:true,noGame:true});
    ok('...and are back after a restart',!!S2.world().crw[n1]&&S2.world().crw[n1].by==='Ann'&&S2.world().crn===S.world().crn);
    await S2.close?.();}
  fs.rmSync(OUT,{recursive:true,force:true});

  /* ===== 4. in a player's game ===== */
  V.startNewWorld('n73','1337','s');V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;step(120);
  const NET=V.NET,sent=[],CR=()=>V.getCR();
  const online=fn=>{const w=NET.ws,o=NET.on;NET.ws={readyState:1,send:s=>sent.push(JSON.parse(s))};NET.on=true;try{return fn();}finally{NET.ws=w;NET.on=o;}};
  {online(()=>V.ntCrIn({t:'crw',n:42,r:{...art('Harbour'),by:'Ann'}}));
    ok('a work from the server: in the registry, an item with its name',!!CR().CRW[42]&&V.DEFS[10042]&&/Harbour/.test(V.DEFS[10042].name));
    online(()=>V.ntCrIn({t:'crw',n:42,r:null}));ok('...and gone when it is thrown away',!CR().CRW[42]&&!V.DEFS[10042]);}
  V.ntCrHook();ok('joining a server listens to Creativity\'s own registry of work changes (once)',(V.ntCrHook(),V.CRREG.onWork.filter(f=>f===V.ntCrWork).length===1));
  {NET.crRes=[77,78];const before=CR().CRN;sent.length=0;
    const n=online(()=>V.crNew('art',{w:64,h:64}));
    ok('on a server a new work takes the number it was handed ('+n+'), not the game\'s own count',n===77&&CR().CRN===before&&NET.crRes.join()==='78');
    ok('...and goes to the server at once',sent.some(m=>m.t==='crw'&&m.n===77&&m.r&&m.r.st==='wip'));
    sent.length=0;online(()=>{V.crSetData(77,'a');V.crSetData(77,'ab');});
    ok('edits wait',sent.length===0);
    online(()=>{NET.acc+=1.2;V.ntCrFlush();});
    ok('...and go out together, once (the latest)',sent.length===1&&sent[0].r.d==='ab');
    NET.crRes=[];const n0=online(()=>V.crNew('song',{}));
    ok('no number left: no work is made (the server is still sending one)',n0===0);}
  {const P=V.P,x=Math.floor(P.x)+3,z=Math.floor(P.z),y=V.surfaceTop(x,z)+1,k=x+','+y+','+z,ck=Math.floor(x/16)+','+Math.floor(z/16),lk=(x-Math.floor(x/16)*16)+','+y+','+(z-Math.floor(z/16)*16);
    online(()=>V.ntApplyBE(k,{t:'crease',f:0,id:10077}));
    ok('someone else\'s easel before its block: kept, but Creativity does not count it yet (it would think it knocked down)',!!V.blockEnts.get(k)&&!CR().CRBE.has(k));
    online(()=>V.ntApplyEdit(ck,lk,V.B.CR_EASEL));
    ok('...its block arrives: counted',CR().CRBE.get(k)===V.blockEnts.get(k));
    const drops=()=>V.entities.filter(e=>e.t==='drop'&&!e.dead&&e.st&&e.st.id===10077).length;
    online(()=>V.ntApplyEdit(ck,lk,V.B.AIR));for(let i=0;i<20;i++)step(1);
    ok('broken in another game: it goes, and no second copy of its work drops here',!V.blockEnts.get(k)&&!CR().CRBE.has(k)&&drops()===0);
    online(()=>V.ntCrIn({t:'crw',n:43,r:{...song('Tune'),by:'Ann'}}));
    online(()=>V.ntApplyEdit(ck,lk,V.B.CR_JUKE));online(()=>V.ntApplyBE(k,{t:'crjuke',f:0,id:10043,s:9999}));
    const jb=V.blockEnts.get(k);
    ok('a jukebox someone filled plays here, from this game\'s own clock',!!jb&&jb.id===10043&&jb.s===CR().CRF.clock&&CR().CRBE.get(k)===jb);
    online(()=>V.ntApplyBE(k,null));ok('...and stops and goes when they take it away',!V.blockEnts.get(k)&&!CR().CRBE.has(k));}
});
