/* n_admin.js (v6.41, lane NET, gate x1): the server run by another program (server/lib/admin.mjs, --ipc).
   The real front door, forked the way the server window forks it, with a data folder under out/. Nothing leaves the
   machine. The terminal server without --ipc is n_smoke's and n_rules's.
   1 it says it is ready, with a status: name, port, addresses, players, the game rules' difficulty, the hosts
   2 a status when asked, and by itself about once a second
   3 a console command gets its reply: list, and a nonsense one; the server's log lines arrive as messages, not on stdout
   4 a player joining and leaving is reported, and shows in the status with their dimension and place
   5 save on demand; stop saves the world, says so and exits 0; the world folder is on disk
   6 without a parent listening (no --ipc) the same program prints its banner and takes commands from stdin as ever
   7 the settings check: good settings pass; bad ports, names, world folders, lists and rules are each named; what needs
     a restart is listed
   8 the window's file handling (server-gui/lib/store.cjs); npm run package (Server and Client) and npm run package:gui
     (the window on its own version, with no server in it)
   9 server versions: a Server zip or folder imports into the window's library, the bad ones are refused saying why,
     nothing escapes the zip, a running version is not replaced, servers carry a version (the newest by default), a
     version in use is not removed, and a server forked from the library runs; (window 1.1) GitHub's release list read offline
     into the versions it offers, a download checked against its fingerprint
   10 the server describes every setting and game rule for the window (formSchema): none left out, the limits it shows are
     the ones validateSettings enforces */
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),{pathToFileURL}=require('url');
const boot=require('../lib/c_boot.js'),{ok}=boot;
const {REPO,outDir}=require('../lib/paths.js');
const V=boot({});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f,ms){const t0=Date.now();while(Date.now()-t0<(ms||4000)){if(f())return true;await sleep(10);}return !!f();}

boot.run(async()=>{
  const OUT=path.join(outDir('net'),'admin_data');fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
  fs.writeFileSync(path.join(OUT,'server.json'),JSON.stringify({name:'Window Test',port:0,simulate:false,seed:'41',rules:{difficulty:'hard'}}));
  const ENTRY=path.join(REPO,'server','dinglecraft-server.mjs');
  const got=[];let outText='';
  const child=cp.fork(ENTRY,['--ipc','--data',OUT],{stdio:['ignore','pipe','pipe','ipc']});
  child.on('message',m=>got.push(m));child.stdout.on('data',d=>{outText+=d;});child.stderr.on('data',d=>{outText+=d;});
  let exit=null;child.on('exit',c=>{exit=c;});
  const by=t=>got.filter(m=>m&&m.t===t),last=t=>by(t)[by(t).length-1];
  let seq=0;const cmd=async line=>{const id=++seq;child.send({t:'cmd',id,line});await until(()=>by('reply').some(r=>r.id===id),3000);return (by('reply').find(r=>r.id===id)||{}).text;};
  /* ===== 1 ===== */
  await until(()=>by('ready').length>0,8000);
  const st=(last('ready')||{}).status||{};
  ok('ready, with a status: "'+st.name+'" on port '+st.port+', '+(st.addresses||[]).length+' network address(es), no players, difficulty '+st.difficulty,
    st.name==='Window Test'&&st.port>0&&Array.isArray(st.addresses)&&Array.isArray(st.players)&&st.players.length===0&&st.difficulty==='hard'&&st.version===V.GAME_VERSION&&Array.isArray(st.hosts)&&st.hosts.length===3&&st.memory>1e6);
  /* ===== 2 ===== */
  const n0=by('status').length;child.send({t:'status'});await until(()=>by('status').length>n0,2000);
  const n1=by('status').length;await sleep(2300);
  ok('a status when asked, and '+(by('status').length-n1)+' more by itself in 2.3 seconds; uptime counts ('+last('status').status.uptime+' s)',n1>n0&&by('status').length-n1>=2&&last('status').status.uptime>=2);
  /* ===== 3 ===== */
  const l1=await cmd('list'),l2=await cmd('/florp'),l3=await cmd('gamerule difficulty');
  ok('commands answer: list -> "'+String(l1).slice(0,40)+'", a nonsense one is told so, gamerule difficulty -> "'+l3+'"',/0|no|player/i.test(String(l1))&&/unknown|help/i.test(String(l2))&&/hard/.test(String(l3)));
  ok('the log arrives as messages ('+by('log').length+' lines), and the banner is still printed for anyone reading the output',by('log').length>0&&by('log').every(m=>typeof m.line==='string')&&/Window Test/.test(outText));
  /* ===== 4 ===== */
  /* 6.49: a new server has accounts: the window makes Vera one first */
  const made=await cmd('account add Vera v3ra');await until(()=>(last('status').status.accountList||[]).some(a=>a.name==='Vera'),3000);
  {const st2=last('status').status,a=(st2.accountList||[]).find(x=>x.name==='Vera')||{};
    ok('a new server has accounts on; one made from the window is in the next status, with its password for the window to show ('+made+')',st2.accounts===true&&a.password==='v3ra'&&a.online===false&&st2.locks&&st2.locks.skin===false);}
  const ws=new WebSocket('ws://127.0.0.1:'+st.port+'/');const inbox=[];
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=()=>rej(new Error('no connection'));});
  ws.onmessage=e=>{try{inbox.push(JSON.parse(e.data));}catch(x){}};
  ws.send(JSON.stringify({t:'hello',proto:V.NT_PROTO,name:'Vera',user:'Vera',pass:'v3ra',v:V.GAME_VERSION}));
  await until(()=>inbox.some(m=>m.t==='welcome'),3000);
  ws.send(JSON.stringify({t:'pose',x:12,y:40,z:-7,yaw:0,pitch:0,dim:'over',held:0,hp:20,fl:0}));
  await until(()=>by('event').some(e=>e.what==='join')&&last('status').status.players.some(p=>p.name==='Vera'&&p.x===12),4000);
  const pv=(last('status').status.players||[]).find(p=>p.name==='Vera')||{};
  ok('a player joins: an event, and the status lists her with her dimension and place ('+[pv.dim,pv.x,pv.y,pv.z].join(' ')+')',by('event').some(e=>e.what==='join'&&e.name==='Vera')&&pv.dim==='over'&&pv.x===12&&pv.y===40&&pv.z===-7&&pv.op===false);
  const opd=await cmd('op Vera');await until(()=>(last('status').status.players.find(p=>p.name==='Vera')||{}).op===true,3000);
  ok('op from the window shows in the next status',/vera/i.test(String(opd))&&last('status').status.players.find(p=>p.name==='Vera').op===true);
  {const b=Buffer.alloc(33);b.writeUInt32BE(0x89504e47,0);b.writeUInt32BE(0x0d0a1a0a,4);b.writeUInt32BE(13,8);b.write('IHDR',12,'latin1');b.writeUInt32BE(64,16);b.writeUInt32BE(64,20);
    child.send({t:'setskin',id:901,name:'Vera',png:b.toString('base64')});await until(()=>by('reply').some(x=>x.id===901),3000);
    ok('a skin from the window (too long for a command line) is its own message, and Vera wears it at once',/now wears/.test((by('reply').find(x=>x.id===901)||{}).text||'')&&await until(()=>inbox.some(m=>m.t==='skin'&&m.png===b.toString('base64')),2000));}
  ws.send(JSON.stringify({t:'save',player:{x:12,y:40,z:-7,hp:20,inv:[]}}));await sleep(80);
  ws.close();await until(()=>by('event').some(e=>e.what==='leave'&&e.name==='Vera'),4000);
  ok('she leaves: an event, and the list is empty again',by('event').some(e=>e.what==='leave'&&e.name==='Vera')&&(await until(()=>last('status').status.players.length===0,3000)));
  /* ===== 5 ===== */
  child.send({t:'save',id:900});await until(()=>by('reply').some(r=>r.id===900),3000);
  child.send({t:'stop'});await until(()=>exit!==null,8000);
  ok('save answers; stop says stopped and the program exits 0 ('+exit+'), leaving the world folder and the player\'s file on disk',
    by('reply').some(r=>r.id===900&&r.text==='saved')&&by('stopped').length===1&&exit===0&&fs.existsSync(path.join(OUT,'world','level.json'))&&fs.existsSync(path.join(OUT,'world','playerdata','vera.json')));
  /* ===== 6 ===== */
  {let text='',code=null;const plain=cp.spawn(process.execPath,[ENTRY,'--data',OUT,'--port','0'],{stdio:['pipe','pipe','pipe']});
    plain.stdout.on('data',d=>{text+=d;});plain.on('exit',c=>{code=c;});
    await until(()=>/listening on port/.test(text),8000);plain.stdin.write('list\n');await sleep(300);plain.stdin.write('stop\n');await until(()=>code!==null,8000);
    ok('without --ipc: the banner, a typed command and stop work as they always did (exit '+code+')',/listening on port \d+/.test(text)&&/Commands: list/.test(text)&&code===0);}
  /* ===== 7 ===== */
  const A=await import(pathToFileURL(path.join(REPO,'server','lib','admin.mjs')).href),C=await import(pathToFileURL(path.join(REPO,'server','lib','config.mjs')).href);
  const keys=o=>A.validateSettings(o).errors.map(e=>e.key).sort().join();
  ok('good settings pass: the defaults, and what the server wrote for itself',A.validateSettings({...C.DEFAULTS}).ok&&A.validateSettings({...JSON.parse(fs.readFileSync(path.join(OUT,'server.json'),'utf8')),port:40162}).ok&&A.validateSettings({}).ok);
  ok('bad ports and names: '+[keys({port:0}),keys({port:70000}),keys({port:'40162'}),keys({name:''}),keys({maxPlayers:0}),keys({mode:'x'})].join(' | '),
    keys({port:0})==='port'&&keys({port:70000})==='port'&&keys({port:'40162'})==='port'&&keys({port:8080.5})==='port'&&keys({name:''})==='name'&&keys({name:'x'.repeat(61)})==='name'&&keys({maxPlayers:0})==='maxPlayers'&&keys({mode:'x'})==='mode');
  ok('bad world folders, lists and rules are each named',keys({world:'../up'})==='world'&&keys({world:'a/b'})==='world'&&keys({world:''})==='world'&&keys({ops:['Ann','this name is much too long']})==='ops'&&keys({bans:'Ann'})==='bans'&&
    keys({rules:{difficulty:'brutal'}})==='rules.difficulty'&&keys({rules:{keepInv:'yes'}})==='rules.keepInv'&&keys({rules:{moon:true}})==='rules.moon'&&keys({cert:'a.pem'})==='cert'&&keys({pvp:1,viewChunks:99})==='pvp,viewChunks');
  const rs=A.validateSettings({...C.DEFAULTS,port:5000,ops:['ann'],rules:{keepInv:true}},{...C.DEFAULTS,rules:{keepInv:false}}).restart;
  ok('what needs a restart: a new port does, a new operator or game rule does not; a move into DingleCore does ('+rs.join()+')',rs.join()==='port'&&
    A.validateSettings({...C.DEFAULTS,rules:{difficulty:'dinglecore'}},{...C.DEFAULTS,rules:{difficulty:'hard'}}).restart.join()==='rules.difficulty');
  /* ===== 8. the window's file handling (server-gui/lib/store.cjs) and its package ===== */
  {const store=require(path.join(REPO,'server-gui','lib','store.cjs'));
    const W=store.listWorlds(OUT),w=W.find(x=>x.name==='world')||{};
    ok('the worlds in a data folder are listed with seed, mode, difficulty and size ('+W.map(x=>x.name).join()+': seed '+w.seed+', '+w.difficulty+', '+w.bytes+' B)',W.length===1&&w.seed==='41'&&w.mode==='s'&&w.difficulty==='hard'&&w.bytes>100);
    const to=store.backupWorld(OUT,'world',new Date(2026,9,13,8,5,9)),to2=store.backupWorld(OUT,'world',new Date(2026,9,13,8,5,9));
    ok('Back up now copies the whole world folder to backups/world-20261013-080509 (a second one in the same second gets its own name), and a backup is not listed as a world',
      path.basename(to)==='world-20261013-080509'&&path.basename(to2)==='world-20261013-080509-2'&&fs.readFileSync(path.join(to,'level.json'),'utf8')===fs.readFileSync(path.join(OUT,'world','level.json'),'utf8')&&
      fs.existsSync(path.join(to,'playerdata','vera.json'))&&store.listWorlds(OUT).length===1);
    let e1='',e2='',e3='';try{store.backupWorld(OUT,'../x');}catch(e){e1=e.message;}try{store.backupWorld(OUT,'nope');}catch(e){e2=e.message;}try{store.newWorld(OUT,{},{name:'world'});}catch(e){e3=e.message;}
    const cur=store.readSettings(OUT),nw=store.newWorld(OUT,cur,{name:'Second World',seed:'abc',mode:'c',difficulty:'dinglecore'});
    ok('a new world: its name, seed, mode and difficulty go into the settings (the rest is kept); a taken name, a bad name and a missing world are refused',
      nw.world==='Second World'&&nw.seed==='abc'&&nw.mode==='c'&&nw.rules.difficulty==='dinglecore'&&nw.name===cur.name&&A.validateSettings({...nw,port:40162}).ok&&/world name/.test(e1)&&/no such world/.test(e2)&&/already/.test(e3));
    store.writeSettings(OUT,nw);
    ok('settings are written as readable JSON and read back the same; uptime and sizes read like a person wrote them',JSON.stringify(store.readSettings(OUT))===JSON.stringify(nw)&&fs.readFileSync(path.join(OUT,'server.json'),'utf8').split('\n').length>10&&
      store.fmtUptime(59)==='59 s'&&store.fmtUptime(200)==='3 min 20 s'&&store.fmtUptime(7500)==='2 h 05 min'&&store.fmtBytes(5*1048576)==='5 MB'&&store.fmtBytes(900)==='900 B');
    /* backups: listed newest first, restored (the world as it was is kept), deleted, pruned */
    {const B0=store.listBackups(OUT);const t3=store.backupWorld(OUT,'world',new Date(2026,9,14,9,0,0));
      fs.writeFileSync(path.join(OUT,'world','marker.txt'),'after the backups');
      const B1=store.listBackups(OUT),r=store.restoreBackup(OUT,path.basename(t3),new Date(2026,9,15,9,0,0));
      ok('backups are listed newest first with their world and size ('+B1.map(b=>b.name).join(', ')+')',B0.length===2&&B1.length===3&&B1[0].name==='world-20261014-090000'&&B1.every(b=>b.world==='world'&&b.bytes>100));
      ok('restoring one puts the world back as it was then, and first keeps the world as it is now as a backup of its own',r.world==='world'&&path.basename(r.kept)==='world-20261015-090000'&&!fs.existsSync(path.join(OUT,'world','marker.txt'))&&
        fs.existsSync(path.join(r.kept,'marker.txt'))&&fs.existsSync(path.join(OUT,'world','level.json'))&&store.listBackups(OUT).length===4);
      const gone=store.pruneBackups(OUT,'world',2),left=store.listBackups(OUT).map(b=>b.name);
      store.deleteBackup(OUT,left[1]);let bad='';try{store.deleteBackup(OUT,'../world');}catch(e){bad=e.message;}try{store.restoreBackup(OUT,'world');}catch(e){bad+='|'+e.message;}
      ok('keeping the newest two removes the older '+gone+'; one can be deleted by name; a name that is not a backup is refused',gone===2&&left.join()==='world-20261015-090000,world-20261014-090000'&&store.listBackups(OUT).length===1&&/not a backup name\|not a backup name/.test(bad)&&fs.existsSync(path.join(OUT,'world','level.json')));}
    /* the list of servers */
    {const ROOT=path.join(OUT,'gui');let L=[];const a1=store.addServer(L,ROOT,{name:'My DINGLECRAFT Server'});L=a1.list;const a2=store.addServer(L,ROOT,{name:'My DINGLECRAFT Server'});L=a2.list;const a3=store.addServer(L,ROOT,{name:'Old one',dataDir:OUT});L=a3.list;
      let dup='';try{store.addServer(L,ROOT,{name:'again',dataDir:OUT});}catch(e){dup=e.message;}
      store.writeServers(path.join(ROOT,'servers.json'),L);const back=store.readServers(path.join(ROOT,'servers.json'));
      ok('servers: a new one gets its own folder, a server.json with its name and a port nobody else has ('+a1.entry.id+' '+store.portOf(a1.entry.dataDir)+', '+a2.entry.id+' '+store.portOf(a2.entry.dataDir)+'); an existing folder is adopted as it is; the same folder twice is refused',
        a1.entry.id==='my-dinglecraft-server'&&a2.entry.id==='my-dinglecraft-server-2'&&store.portOf(a1.entry.dataDir)===40162&&store.portOf(a2.entry.dataDir)===40163&&store.readSettings(a2.entry.dataDir).name==='My DINGLECRAFT Server'&&
        a3.entry.dataDir===OUT&&store.readSettings(OUT).world==='Second World'&&/already in the list/.test(dup)&&A.validateSettings(store.readSettings(a2.entry.dataDir)).ok);
      ok('the list is kept in a file and read back; removing a server leaves its folder alone; a broken file reads as an empty list',JSON.stringify(back)===JSON.stringify(L)&&store.removeServer(L,a1.entry.id).length===2&&fs.existsSync(path.join(a1.entry.dataDir,'server.json'))&&
        (fs.writeFileSync(path.join(ROOT,'servers.json'),'{nope'),store.readServers(path.join(ROOT,'servers.json')).length===0));}
    /* the scheduler */
    {const T=o=>{try{return store.cleanTask(o);}catch(e){return e.message;}};
      const b=T({every:60,what:'backup'}),c=T({every:5,what:'command',command:' say hi '}),r=T({every:1440,what:'restart',on:false});
      ok('tasks: a backup (keeps 10 unless told), a command, a restart; each gets an id; nonsense is refused with the reason',b.what==='backup'&&b.keep===10&&b.on===true&&typeof b.id==='string'&&c.command==='say hi'&&r.on===false&&
        /minutes/.test(T({every:0,what:'backup'}))&&/minutes/.test(T({every:1.5,what:'backup'}))&&/backs up/.test(T({every:5,what:'explode'}))&&/Type the command/.test(T({every:5,what:'command'}))&&/restart task/.test(T({every:5,what:'command',command:'/stop'})));
      const tasks=[{id:'a',every:10,what:'backup',keep:5,on:true},{id:'b',every:60,what:'restart',on:true},{id:'c',every:1,what:'command',command:'list',on:false}];
      const min=60000,d=(now,last)=>store.dueTasks(tasks,last,now,0).map(t=>t.id).join();
      ok('what is due: nothing before its time, a task every 10 minutes from when the server started and then from when it last ran, a task that is switched off never',
        d(9*min,{})===''&&d(10*min,{})==='a'&&d(15*min,{a:10*min})===''&&d(20*min,{a:10*min})==='a'&&d(61*min,{a:60*min})==='b'&&d(999*min,{a:999*min,b:999*min})==='');}
    /* the server describes its own settings and rules (the window builds its forms from it): none may be left out, and the limits it shows are the ones it checks */
    {const F=A.formSchema(),sk=F.settings.map(x=>x.key),rk=F.rules.map(x=>x.key);
     const noSet=Object.keys(C.DEFAULTS).filter(k=>!sk.includes(k)&&!F.elsewhere.includes(k)),noRule=Object.keys(C.RULES).filter(k=>!rk.includes(k));
     const extra=[...sk.filter(k=>!(k in C.DEFAULTS)),...rk.filter(k=>!(k in C.RULES))];
     ok('every setting and every game rule is described for the window, with a label (missing: '+[...noSet,...noRule].join(', ')+'; unknown: '+extra.join(', ')+')',
       !noSet.length&&!noRule.length&&!extra.length&&new Set(sk).size===sk.length&&new Set(rk).size===rk.length&&[...F.settings,...F.rules].every(x=>typeof x.label==='string'&&x.label.length>2));
     const kindOk=(x,v)=>x.kind==='bool'?typeof v==='boolean':x.kind==='int'?Number.isInteger(v)&&Number.isInteger(x.min)&&Number.isInteger(x.max)&&x.min<=v&&v<=x.max:
       x.kind==='list'?Array.isArray(v):x.kind==='text'?typeof v==='string':x.kind==='select'?Array.isArray(x.options)&&x.options.some(o=>o[0]===v):false;
     const wrong=[...F.settings.filter(x=>!kindOk(x,C.DEFAULTS[x.key])).map(x=>x.key),...F.rules.filter(x=>!kindOk(x,C.RULES[x.key])).map(x=>x.key)];
     ok('each description fits its default (a number within its limits, a choice among its options)'+(wrong.length?' (wrong: '+wrong.join()+')':''),!wrong.length);
     const edge=[];
     for(const x of F.settings.filter(x=>x.kind==='int')){const at=v=>A.validateSettings({...C.DEFAULTS,[x.key]:v}).errors.some(e=>e.key===x.key);
       if(at(x.min)||at(x.max)||!at(x.min-1)||!at(x.max+1))edge.push(x.key);}
     for(const x of F.rules.filter(x=>x.kind==='int')){const at=v=>A.validateSettings({...C.DEFAULTS,rules:{[x.key]:v}}).errors.some(e=>e.key==='rules.'+x.key);
       if(at(x.min)||at(x.max)||!at(x.min-1)||!at(x.max+1))edge.push('rules.'+x.key);}
     for(const x of F.settings.filter(x=>x.kind==='select'))for(const [v] of x.options)if(A.validateSettings({...C.DEFAULTS,[x.key]:v}).errors.some(e=>e.key===x.key))edge.push(x.key+'='+v);
     for(const x of F.rules.filter(x=>x.kind==='select'))for(const [v] of x.options)if(A.validateSettings({...C.DEFAULTS,rules:{[x.key]:v}}).errors.length)edge.push('rules.'+x.key+'='+v);
     ok('the limits and choices the window shows are exactly the ones the server accepts'+(edge.length?' (off: '+edge.join()+')':''),!edge.length);}
    const fd=A.formDefaults();
    ok('the forms start from every setting and every game rule (the new ones included)',fd.port===40162&&fd.rules.difficulty==='normal'&&fd.rules.nether===true&&Object.keys(fd.rules).length===Object.keys(C.RULES).length);
    /* the packages: built into out/, read back. The window is no longer in a game release (1.0 of the window): it has its own */
    const PK=path.join(outDir('net'),'admin_pkg');fs.rmSync(PK,{recursive:true,force:true});
    const Z=await import(pathToFileURL(path.join(REPO,'scripts','lib','zip.mjs')).href);
    const r=cp.spawnSync(process.execPath,[path.join(REPO,'scripts','package.mjs'),'--beta'],{env:{...process.env,DC_OUT_DIR:PK},encoding:'utf8'});
    const rel=fs.existsSync(path.join(PK,'release'))?fs.readdirSync(path.join(PK,'release')).sort():[];
    const szf=path.join(PK,'release','DINGLECRAFT-Server-v'+V.GAME_VERSION+'.zip'),snames=fs.existsSync(szf)?Z.readZip(fs.readFileSync(szf)).map(e=>e.name):[];
    ok('npm run package makes the Server and Client downloads and no window ('+rel.join(', ')+'); the Server zip has the admin module the window drives and the game',
      r.status===0&&rel.join()===['DINGLECRAFT-Client-v'+V.GAME_VERSION+'.zip','DINGLECRAFT-Server-v'+V.GAME_VERSION+'.zip','notes.md'].sort().join()&&
      snames.includes('DINGLECRAFT-Server/lib/admin.mjs')&&snames.includes('DINGLECRAFT-Server/dinglecraft_v'+V.GAME_VERSION+'.html')&&!/ServerGUI-v/.test(r.stdout)&&
      /Server window/.test(fs.readFileSync(path.join(PK,'release','notes.md'),'utf8')));
    const rg=cp.spawnSync(process.execPath,[path.join(REPO,'scripts','package-gui.mjs')],{env:{...process.env,DC_OUT_DIR:PK},encoding:'utf8'});
    const gver=JSON.parse(fs.readFileSync(path.join(REPO,'server-gui','package.json'),'utf8')).version,zf=path.join(PK,'release-gui','DINGLECRAFT-ServerGUI-v'+gver+'.zip');
    const names=fs.existsSync(zf)?Z.readZip(fs.readFileSync(zf)).map(e=>e.name):[];
    const has=n=>names.includes('DINGLECRAFT-ServerGUI/'+n);
    ok('npm run package:gui makes the window on its own version ('+gver+', '+names.length+' files): its own files and an icon, no server, no game, no node_modules; published as server-gui-v'+gver,
      rg.status===0&&/^\d+\.\d+\.\d+$/.test(gver)&&gver!=='0.0.0'&&has('main.js')&&has('preload.js')&&has('index.html')&&has('renderer.js')&&has('style.css')&&has('lib/store.cjs')&&has('lib/zip.cjs')&&
      has('package.json')&&has('README.md')&&has('tray.png')&&!has('icon.png')&&!names.some(n=>/node_modules|\/data\/|dinglecraft-server\.mjs|dinglecraft_v/.test(n))&&
      new RegExp('gh release create server-gui-v'+gver.replace(/\./g,'\\.')+' ').test(rg.stdout)&&!/"server\/\*\*"/.test(fs.readFileSync(path.join(REPO,'server-gui','package.json'),'utf8')));
    /* ===== 9. server versions: the window's library (store.cjs) ===== */
    {const VR=path.join(PK,'gui_root'),inUse=()=>false;
     const v1=store.importVersion(VR,szf,inUse);
     const L1=store.listVersions(VR);
     ok('a Server zip as downloaded imports as its version ('+v1.version+'), unpacked under versions/ with its front door, admin module and game',
       v1.version===V.GAME_VERSION&&L1.length===1&&L1[0].version===V.GAME_VERSION&&fs.existsSync(path.join(v1.dir,'dinglecraft-server.mjs'))&&fs.existsSync(path.join(v1.dir,'lib','admin.mjs'))&&
       fs.existsSync(path.join(v1.dir,'dinglecraft_v'+V.GAME_VERSION+'.html'))&&!fs.readdirSync(path.join(VR,'versions')).some(n=>n.startsWith('.import')));
     /* an older version, made from the same files: a folder import */
     const OLD=path.join(PK,'v6.42');fs.cpSync(v1.dir,OLD,{recursive:true});fs.renameSync(path.join(OLD,'dinglecraft_v'+V.GAME_VERSION+'.html'),path.join(OLD,'dinglecraft_v6.42.html'));fs.mkdirSync(path.join(OLD,'data'));fs.writeFileSync(path.join(OLD,'data','server.json'),'{}');
     const v2=store.importVersion(VR,OLD,inUse),L2=store.listVersions(VR).map(v=>v.version);
     ok('an unpacked folder imports too (its data/ left behind); the list is newest first; 6.9 is older than 6.10',v2.version==='6.42'&&L2.join()===V.GAME_VERSION+',6.42'&&!fs.existsSync(path.join(v2.dir,'data'))&&
       store.cmpVersion('6.9','6.10')<0&&store.cmpVersion('6.57','6.57')===0&&store.cmpVersion('7.0','6.99')>0);
     const err=f=>{try{f();return '';}catch(e){return e.message;}};
     const NOADM=path.join(PK,'v6.40');fs.cpSync(OLD,NOADM,{recursive:true});fs.rmSync(path.join(NOADM,'lib','admin.mjs'));fs.renameSync(path.join(NOADM,'dinglecraft_v6.42.html'),path.join(NOADM,'dinglecraft_v6.40.html'));
     const NOHTML=path.join(PK,'nohtml');fs.cpSync(OLD,NOHTML,{recursive:true});fs.rmSync(path.join(NOHTML,'dinglecraft_v6.42.html'));
     const EVIL=path.join(PK,'evil.zip');fs.writeFileSync(EVIL,Z.writeZip([...Z.readZip(fs.readFileSync(szf)).filter(e=>!/\.html$/.test(e.name)),
       {name:'DINGLECRAFT-Server/dinglecraft_v6.30.html',data:Buffer.from('x'),mode:0o644},{name:'DINGLECRAFT-Server/../../escaped.txt',data:Buffer.from('no'),mode:0o644}]));
     const e1=err(()=>store.importVersion(VR,zf,inUse)),e2=err(()=>store.importVersion(VR,NOADM,inUse)),e3=err(()=>store.importVersion(VR,NOHTML,inUse)),e4=err(()=>store.importVersion(VR,path.join(REPO,'server-gui'),inUse));
     const v3=store.importVersion(VR,EVIL,inUse);
     ok('refused, saying why: the window\'s own zip (no server), a server older than 6.41 (no admin module), one with no game to name its version, a folder that is no server; a path out of the zip is never written',
       /no DINGLECRAFT server/.test(e1)&&/6\.41 or newer/.test(e2)&&/no game file/.test(e3)&&/no dinglecraft-server\.mjs/.test(e4)&&v3.version==='6.30'&&!fs.existsSync(path.join(PK,'escaped.txt'))&&!fs.existsSync(path.join(VR,'escaped.txt'))&&
       store.listVersions(VR).length===3);
     const busy=err(()=>store.importVersion(VR,OLD,v=>v==='6.42'));
     ok('a version is not replaced under a running server, and is replaced when nothing runs it',/is running/.test(busy)&&store.importVersion(VR,OLD,inUse).version==='6.42');
     let L=[];L=store.addServer(L,VR,{name:'Old one',version:'6.42'}).list;L=store.addServer(L,VR,{name:'No version'}).list;L=store.addServer(L,VR,{name:'Bad',version:'../x'}).list;
     const fill=store.fillVersions(L,store.listVersions(VR));
     ok('each server says its version; one without gets the newest ('+fill.list.map(e=>e.version).join()+')',L[0].version==='6.42'&&L[1].version===''&&L[2].version===''&&fill.changed&&
       fill.list.map(e=>e.version).join()===['6.42',V.GAME_VERSION,V.GAME_VERSION].join()&&!store.fillVersions(fill.list,store.listVersions(VR)).changed);
     const rm=err(()=>store.removeVersion(VR,'6.42',fill.list));store.removeVersion(VR,'6.30',fill.list);
     ok('a version a server is set to cannot be removed; one nobody uses can',/Old one/.test(rm)&&store.listVersions(VR).map(v=>v.version).join()===V.GAME_VERSION+',6.42');
     /* 1.1: versions on GitHub. GitHub's list of releases, read without the network (the shape its API answers with) */
     const gh=(tag,pre,assets,more)=>({tag_name:tag,prerelease:pre,draft:false,published_at:'2026-10-14T20:00:04Z',assets,...more});
     const as=(name,url,size,digest)=>({name,size,digest,browser_download_url:url||'https://github.com/Renscal/DingleCraftMP/releases/download/x/'+name});
     const RV=store.releaseVersions([
       gh('v6.58',true,[as('DINGLECRAFT-Client-v6.58.zip'),as('DINGLECRAFT-Server-v6.58.zip',null,31438988,'sha256:'+'a'.repeat(64)),as('DINGLECRAFT-ServerGUI-v6.58.zip')]),
       gh('v6.59',false,[as('DINGLECRAFT-Server-v6.59.zip')],{draft:true}),
       gh('v6.57',false,[as('DINGLECRAFT-Server-v6.57.zip')]),
       gh('v6.57b',false,[as('DINGLECRAFT-Server-v6.57.zip','https://github.com/elsewhere/v6.57b.zip')]),
       gh('v6.10',false,[as('DINGLECRAFT-Server-v6.10.zip')]),
       gh('v6.41',false,[as('DINGLECRAFT-Server-v6.41.zip')]),
       gh('evil',false,[as('DINGLECRAFT-Server-v6.60.zip','https://example.com/DINGLECRAFT-Server-v6.60.zip')]),
       gh('server-gui-v1.0.0',true,[as('DINGLECRAFT-ServerGUI-v1.0.0.zip')])]);
     ok('the releases on GitHub become the server versions they offer, newest first ('+RV.map(r=>r.version).join()+'): only Server zips, 6.41 and newer, no drafts, only github.com downloads, the first of a version wins',
       RV.map(r=>r.version).join()==='6.58,6.57,6.41'&&RV[0].size===31438988&&RV[0].prerelease===true&&RV[0].date==='2026-10-14'&&/^sha256:a{64}$/.test(RV[0].digest)&&
       RV[1].url==='https://github.com/Renscal/DingleCraftMP/releases/download/x/DINGLECRAFT-Server-v6.57.zip'&&store.releaseVersions(null).length===0&&store.releaseVersions({message:'rate limited'}).length===0);
     {const zb=fs.readFileSync(szf),h='sha256:'+require('crypto').createHash('sha256').update(zb).digest('hex');
      ok('a download is checked against GitHub\'s fingerprint: the right one passes (any case), a wrong or malformed one fails, none at all has nothing to check',
        store.digestOK(zb,h)&&store.digestOK(zb,h.toUpperCase().replace('SHA256','sha256'))&&!store.digestOK(Buffer.concat([zb,Buffer.from('x')]),h)&&!store.digestOK(zb,'sha256:'+'0'.repeat(64))&&
        !store.digestOK(zb,'md5:abc')&&store.digestOK(zb,''));}
     {const N=store.releaseName,named=store.releaseVersions([gh('v6.58',false,[as('DINGLECRAFT-Server-v6.58.zip')],{name:'DingleCraft Multiplayer 2.0'}),gh('v6.57',true,[as('DINGLECRAFT-Server-v6.57.zip')],{name:'Release 1.1 (v6.57) Sit down and fly'})]);
      const lv=store.listVersions(VR),mine=lv.find(v=>v.version===V.GAME_VERSION);
      ok('1.1.1: each version has its release name: from GitHub\'s title ('+named.map(x=>x.label+'/'+x.title).join(', ')+'), and from an imported game file ('+(mine&&mine.label)+'), remembered in .label',
        N('Release 1.1 (v6.57) Sit down and fly','6.57').join('|')==='Release 1.1|Sit down and fly'&&N('DingleCraft Multiplayer 2.0','6.58').join('|')==='DingleCraft Multiplayer 2.0|'&&N('','6.41').join('|')==='|'&&
        named[0].label==='DingleCraft Multiplayer 2.0'&&named[0].title===''&&named[0].prerelease===false&&named[1].label==='Release 1.1'&&named[1].title==='Sit down and fly'&&
        !!mine&&mine.label===V.RELEASE_LABEL&&fs.readFileSync(path.join(mine.dir,'.label'),'utf8').trim()===V.RELEASE_LABEL);}
     ok('the window asks this repository\'s releases (or DC_RELEASES_REPO for a fork)',store.releasesUrl()==='https://api.github.com/repos/Renscal/DingleCraftMP/releases?per_page=100'&&store.releasesUrl('a/b').endsWith('/repos/a/b/releases?per_page=100'));
     /* the imported version runs: forked from the library the way the window forks it */
     const D2=path.join(PK,'run_data');fs.mkdirSync(D2,{recursive:true});fs.writeFileSync(path.join(D2,'server.json'),JSON.stringify({name:'From the library',port:0,simulate:false}));
     const kid=cp.fork(path.join(v1.dir,'dinglecraft-server.mjs'),['--ipc','--data',D2],{stdio:['ignore','pipe','pipe','ipc']}),msgs=[];let kx=null;
     kid.on('message',m=>msgs.push(m));kid.on('exit',c=>{kx=c;});kid.stdout.resume();kid.stderr.resume();
     await until(()=>msgs.some(m=>m.t==='ready'),20000);const rd=msgs.find(m=>m.t==='ready');
     kid.send({t:'stop'});await until(()=>kx!==null,15000);
     ok('a server run from the library is ready and hands out its own game ('+(rd&&rd.status.version)+', game '+(rd&&rd.status.game)+'), and stops cleanly',!!rd&&rd.status.name==='From the library'&&rd.status.game===true&&kx===0);}
    for(const f of ['main.js','preload.js','renderer.js','lib/store.cjs']){const c=cp.spawnSync(process.execPath,['--check',path.join(REPO,'server-gui',f)],{encoding:'utf8'});if(c.status!==0)ok('server-gui/'+f+' parses',false);}
    const html=fs.readFileSync(path.join(REPO,'server-gui','index.html'),'utf8'),js=fs.readFileSync(path.join(REPO,'server-gui','renderer.js'),'utf8');
    const ids=[...js.matchAll(/\$\('([a-z_]+)'\)/g)].map(m=>m[1]),missing=[...new Set(ids)].filter(i=>!new RegExp('id="'+i+'"').test(html));
    const calls=[...new Set([...js.matchAll(/window\.dc\.([a-zA-Z]+)/g)].map(m=>m[1]))],pre=fs.readFileSync(path.join(REPO,'server-gui','preload.js'),'utf8'),mainJs=fs.readFileSync(path.join(REPO,'server-gui','main.js'),'utf8');
    const chans=[...pre.matchAll(/call\('([a-z:]+)'\)/g)].map(m=>m[1]);
    ok('the page and the program agree: every element the page script uses is in the page ('+missing.join()+'), every window.dc call is offered by the preload, and every preload channel has a handler',
      missing.length===0&&calls.every(c=>new RegExp('\\b'+c+':').test(pre))&&chans.length>=14&&chans.every(c=>mainJs.includes("h('"+c+"'")));
    fs.rmSync(PK,{recursive:true,force:true});}
  fs.rmSync(OUT,{recursive:true,force:true});
});
