/* n_accounts.js (v6.49, lane NET, gate x1): accounts, made by an operator, kept with the player, replacing the server password.
   The real server in this process (on an ephemeral 127.0.0.1 port) and raw sockets speaking the protocol; the game is
   booted for its version number and for its login box. Writes only under out/.
   1 accounts on: a hello without a login is asked for one (login), a wrong one is asked again, the fifth wrong one is
     thrown out; one try a second
   2 /account add, then a login: in, as the account's own name (whatever case was typed); a remembered login in the hello
     goes straight in; the same account again throws the older connection out
   3 the password never leaves the server: not in welcome, not in /status, not in the export, not in the log of a command;
     a game cannot give itself a password or take its locks off with a save, and a save keeps the account an account
   4 on disk: the password is the second line of playerdata/<name>.json, in plain text
   5 a player changes their own password (the old one first) and their own name (the ops list follows, everyone is told);
     the three locks, for one player and for everyone, refuse; /account remove; /account list shows the console the passwords
   6 skins: an operator dresses a player (everyone sees it, them too, and they get it back on joining); a locked skin cannot
     be changed by the player's game
   7 accounts off (open): anyone joins by name, but a name that is an account needs its password
   8 the program: an old server.json with a password turns accounts on and loses the password; a new one has accounts on;
     an old open one stays open
   9 the game: its Multiplayer screen has no server password, shows the login box when asked and logs in; Settings has the
     account box with the plain-text warning */
'use strict';
const fetch=global.fetch;   /* the boot rig replaces global fetch with one that throws; this suite talks to its own 127.0.0.1 server */
const boot=require('../lib/c_boot.js'),{ok}=boot;
const path=require('path'),fs=require('fs'),{pathToFileURL}=require('url'),{spawn}=require('child_process');
const {REPO,outDir}=require('../lib/paths.js');
const V=boot({});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f,ms){const t0=Date.now();while(Date.now()-t0<(ms||3000)){if(f())return true;await sleep(5);}return !!f();}
/* the smallest thing the server takes for a skin: a PNG signature and a 64 x 64 header */
const PNG=(()=>{const b=Buffer.alloc(33);b.writeUInt32BE(0x89504e47,0);b.writeUInt32BE(0x0d0a1a0a,4);b.writeUInt32BE(13,8);b.write('IHDR',12,'latin1');b.writeUInt32BE(64,16);b.writeUInt32BE(64,20);b[24]=8;b[25]=6;return b.toString('base64');})();
const PNG2=(()=>{const b=Buffer.from(PNG,'base64');b[24]=16;return b.toString('base64');})();

boot.run(async()=>{
  const lib=f=>import(pathToFileURL(path.join(REPO,'server',f)).href);
  const {createServer}=await lib('dinglecraft-server.mjs');
  const {exportWorld}=await lib('lib/world.mjs');
  const OUT=path.join(outDir('net'),'accounts');fs.rmSync(OUT,{recursive:true,force:true});
  const logs=[];
  const S=createServer({port:0,data:OUT,world:'world',noGame:true,quiet:true,seed:'49',accounts:true,maxPlayers:6,onLog:l=>logs.push(l)});
  await S.listen();
  const port=S.port,W=S.world();
  /* a raw player: says hello (with a login, or not) and waits for ready, a login request or the door */
  async function conn(name,extra){
    const ws=new WebSocket('ws://127.0.0.1:'+port),R={ws,got:[],closed:false,by:t=>R.got.filter(m=>m.t===t),last:t=>R.by(t).pop(),
      send:m=>ws.send(JSON.stringify(m)),clear:()=>{R.got.length=0;},quit:async()=>{ws.close();await until(()=>R.closed);await sleep(20);}};
    ws.onmessage=e=>R.got.push(JSON.parse(e.data));ws.onclose=()=>{R.closed=true;};
    await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=()=>rej(new Error('socket'));});
    R.send({t:'hello',proto:V.NT_PROTO,v:V.GAME_VERSION,name,...extra});
    await until(()=>!!R.last('ready')||!!R.last('login')||R.closed);
    R.in=()=>{const w=R.last('welcome');R.id=w?w.id:0;R.as=w?w.name:'';return !!R.last('ready');};R.in();
    R.login=async(user,pass)=>{const n=R.by('login').length;R.send({t:'login',user,pass});await until(()=>!!R.last('ready')||R.by('login').length>n||R.closed);return R.in();};
    R.cmd=async txt=>{await sleep(130);R.clear();R.send({t:'cmd',txt});await until(()=>!!R.last('sys'),1500);return (R.last('sys')||{}).txt||'';};
    return R;
  }

  /* ===== 1. asked to log in ===== */
  {const a=await conn('Bea');
    ok('accounts on: a hello with no login gets no world, only a request to log in',!a.last('welcome')&&!!a.last('login')&&a.last('login').accounts===true&&!a.closed);
    await a.login('Bea','nope');
    ok('a login for an account that does not exist is asked again, with the reason',!a.last('welcome')&&/Wrong username or password/.test(a.last('login').why));
    a.send({t:'login',user:'Bea',pass:'again'});await sleep(150);
    ok('...and a second try within the second is told to wait',/Wait a second/.test(a.last('login').why));
    for(let i=0;i<5&&!a.closed;i++){await sleep(1050);a.send({t:'login',user:'Bea',pass:'wrong'+i});await until(()=>a.closed,300);}
    ok('the fifth wrong login is thrown out, with the reason',a.closed&&a.by('kick').some(k=>/Too many wrong logins/.test(k.why)));}

  /* ===== 2. an account ===== */
  const made=S.command('account add Bea s3cret!');
  ok('/account add from the console makes the account ('+made+')',/Account Bea made/.test(made)&&W.players.bea&&W.players.bea.password==='s3cret!');
  ok('...and refuses a password with a space, or a second account of one name',/no spaces/.test(S.command('account add Cal my pass'))&&/already has an account/.test(S.command('account add bea other')));
  const bea=await conn('whoever');
  ok('a login with the right password, the name typed in any case: in, as the account\'s own name',await bea.login('bEA','s3cret!')&&bea.as==='Bea');
  ok('...and told about the account: accounts on, it is one, nothing locked',(w=>w&&w.acct&&w.acct.accounts===true&&w.acct.account===true&&w.acct.locks.name===false)(bea.last('welcome')));
  {const r=await conn('x',{user:'Bea',pass:'s3cret!'});
    ok('a login the game remembers goes in with the hello, without being asked',r.in()&&!r.last('login')&&r.as==='Bea');
    ok('...and the account is one person: the older connection is thrown out',await until(()=>bea.closed,1500)&&bea.by('kick').some(k=>/another location/.test(k.why)));
    await r.quit();}

  /* ===== 3. the password stays on the server ===== */
  S.command('op Bea');
  const B2=await conn('x',{user:'Bea',pass:'s3cret!'});
  {const w=B2.last('welcome');ok('welcome carries the player\'s record but never the password',!JSON.stringify(w).includes('s3cret!')&&!('password' in (w.player||{})));}
  {const r=await fetch('http://127.0.0.1:'+port+'/status').then(x=>x.json());ok('/status says accounts are on and nothing about passwords',r.accounts===true&&!('password' in r)&&!JSON.stringify(r).includes('s3cret!'));}
  ok('the world exported for single player keeps no password',!exportWorld(W).includes('s3cret!')&&!exportWorld(W).includes('"password"'));
  {logs.length=0;const rep=await B2.cmd('/account add Dee hunter2');
    ok('an operator makes an account in the game ('+rep+'), and the log shows the command with the password hidden',/Account Dee made/.test(rep)&&logs.some(l=>/ran \/account add Dee \*\*\*\*/.test(l))&&!logs.some(l=>l.includes('hunter2')));}
  B2.send({t:'save',player:{x:1,y:40,z:1,inv:[],password:'mine',locks:{}}});await sleep(60);
  ok('a game cannot give itself a password with a save, and the save keeps the account an account',W.players.bea.password==='s3cret!'&&W.players.bea.x===1);

  /* ===== 4. on disk ===== */
  S.saveWorld('test');
  {const t=fs.readFileSync(path.join(OUT,'world','playerdata','bea.json'),'utf8').split('\n');
    ok('playerdata/bea.json: the password is its second line, in plain text',t[0]==='{'&&/^  "player": "bea",$/.test(t[1])&&t[2]==='  "password": "s3cret!",');}

  /* ===== 5. changing things ===== */
  {B2.clear();B2.send({t:'acct',old:'wrong',pass:'n3w'});await until(()=>!!B2.last('acct'));
    ok('changing the password needs the old one',B2.last('acct').ok===false&&W.players.bea.password==='s3cret!');
    await sleep(600);B2.clear();B2.send({t:'acct',old:'s3cret!',pass:'n3w'});await until(()=>!!B2.last('acct'));
    ok('...with it, it changes',B2.last('acct').ok===true&&W.players.bea.password==='n3w');}
  const cal=await conn('Cal');S.command('account add Cal pw');await cal.login('Cal','pw');
  {B2.clear();cal.clear();await sleep(600);B2.send({t:'acct',name:'Beatrix'});await until(()=>!!B2.last('rename'));
    ok('changing one\'s name: the record moves, everyone (them too) is told, and the ops list follows',!!W.players.beatrix&&!W.players.bea&&W.players.beatrix.name==='Beatrix'&&
      B2.last('rename').name==='Beatrix'&&await until(()=>cal.by('rename').some(m=>m.id===B2.id&&m.name==='Beatrix'))&&S.opts.ops.includes('beatrix')&&!S.opts.ops.includes('bea'));
    await sleep(600);B2.clear();B2.send({t:'acct',name:'Cal'});await until(()=>!!B2.last('acct'));
    ok('...to a name that is taken: refused',B2.last('acct').ok===false&&/taken/.test(B2.last('acct').why));}
  {const r=S.command('account lock Cal name on');cal.clear();await sleep(50);
    ok('/account lock <player> name: '+r,/may no longer change their name/.test(r)&&W.players.cal.locks.name===true);
    ok('...their game is told at once',await until(()=>cal.by('acct').some(m=>m.locks&&m.locks.name===true)));
    cal.clear();cal.send({t:'acct',name:'Calvin'});await until(()=>!!cal.last('acct'));
    ok('...and the change is refused',cal.last('acct').ok===false&&/locked/.test(cal.last('acct').why)&&!!W.players.cal);
    S.command('account lock * password on');await sleep(1100);cal.clear();cal.send({t:'acct',old:'pw',pass:'x'});await until(()=>!!cal.last('acct'));
    ok('/account lock * password: nobody may change their password',S.opts.lockPasswords===true&&cal.last('acct').ok===false&&W.players.cal.password==='pw');
    S.command('account lock * password off');S.command('account lock Cal name off');}
  {const l=S.command('account list');
    ok('/account list shows the console every account, with its password ('+l.slice(0,60)+'…)',/Beatrix \(password: n3w\)/.test(l)&&/Cal \(password: pw\)/.test(l)&&/Dee \(password: hunter2\)/.test(l));
    const fromGame=await B2.cmd('/account list');
    ok('...an operator in the game sees the names but not the passwords',/Cal/.test(fromGame)&&!/pw\)/.test(fromGame)&&!fromGame.includes('hunter2'));}
  {const r=S.command('account remove Dee');
    ok('/account remove: the login is gone, what they had is kept',/is gone/.test(r)&&!!W.players.dee&&!('password' in W.players.dee));}

  /* ===== 6. skins ===== */
  {B2.clear();cal.clear();const r=S.setSkin('Cal',PNG);
    ok('an operator dresses Cal ('+r+'): kept with Cal, and everyone sees it, Cal too',/now wears/.test(r)&&W.players.cal.skin===PNG&&
      await until(()=>B2.by('skin').some(m=>m.id===cal.id&&m.png===PNG))&&await until(()=>cal.by('skin').some(m=>m.id===cal.id&&m.png===PNG)));
    S.command('account lock Cal skin on');cal.clear();cal.send({t:'skin',png:PNG2});await until(()=>cal.by('skin').length>0);
    ok('with skins locked, Cal\'s own game cannot change it: refused, and the server\'s is sent back',W.players.cal.skin===PNG&&cal.last('skin').png===PNG);
    await cal.quit();const c2=await conn('x',{user:'Cal',pass:'pw'});
    ok('...and on joining Cal is given it, and the lock',c2.last('welcome').acct.skin===PNG&&c2.last('welcome').acct.locks.skin===true);
    ok('/setskin <player> reset: the default again',/default skin/.test(S.command('setskin Cal reset'))&&!('skin' in W.players.cal));
    await c2.quit();}
  await B2.quit();await S.close();

  /* ===== 7. accounts off ===== */
  {const S2=createServer({port:0,memory:true,world:'',noGame:true,quiet:true,seed:'49',accounts:false});await S2.listen();
    S2.command('account add Eve pw');
    const c=async(name,extra)=>{const ws=new WebSocket('ws://127.0.0.1:'+S2.port),R={got:[],closed:false};ws.onmessage=e=>R.got.push(JSON.parse(e.data));ws.onclose=()=>{R.closed=true;};
      await new Promise(r=>{ws.onopen=r;});ws.send(JSON.stringify({t:'hello',proto:V.NT_PROTO,v:V.GAME_VERSION,name,...extra}));
      await until(()=>R.got.some(m=>m.t==='ready'||m.t==='login'));R.ws=ws;return R;};
    const f=await c('Finn');ok('accounts off: anyone joins by name, as before',f.got.some(m=>m.t==='ready'));
    const e=await c('Eve');ok('...but a name that is an account is asked for its password',!e.got.some(m=>m.t==='ready')&&e.got.some(m=>m.t==='login'&&m.accounts===false&&m.user==='Eve'));
    const e2=await c('Eve',{user:'Eve',pass:'pw'});ok('...and with it, is let in',e2.got.some(m=>m.t==='ready'));
    for(const R of [f,e,e2])R.ws.close();await S2.close();}

  /* ===== 8. the program ===== */
  {const run=async(dir,cfg,players)=>{fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
      if(cfg)fs.writeFileSync(path.join(dir,'server.json'),JSON.stringify(cfg));
      if(players){fs.mkdirSync(path.join(dir,'world','playerdata'),{recursive:true});fs.writeFileSync(path.join(dir,'world','playerdata','old.json'),'{"player":"old"}');}
      const ch=spawn(process.execPath,[path.join(REPO,'server','dinglecraft-server.mjs'),'--data',dir,'--port','0','--world','world'],{stdio:['pipe','pipe','pipe']});
      let out='';ch.stdout.on('data',d=>{out+=d;});ch.stderr.on('data',d=>{out+=d;});
      await until(()=>/listening on port/.test(out),15000);ch.kill();await new Promise(r=>ch.on('exit',r));
      return {out,cfg:JSON.parse(fs.readFileSync(path.join(dir,'server.json'),'utf8'))};};
    const a=await run(path.join(OUT,'p_old_pw'),{name:'Old',password:'letmein'},true);
    ok('an old server.json with a password: accounts on, the password gone, and the console says why',a.cfg.accounts===true&&!('password' in a.cfg)&&/Server passwords are gone/.test(a.out)&&/accounts: players log in/.test(a.out));
    const b=await run(path.join(OUT,'p_new'),null,false);
    ok('a new server: accounts on',b.cfg.accounts===true&&/accounts: players log in/.test(b.out));
    const c=await run(path.join(OUT,'p_old_open'),{name:'Open'},true);
    ok('an old open server with players: it stays open',c.cfg.accounts===false&&/open: anyone may join/.test(c.out));}

  /* ===== 9. the game ===== */
  {const HH=fs.readFileSync(path.join(REPO,'build','head.html'),'utf8'),has=id=>HH.split('id="'+id+'"').length===2;
    ok('the Multiplayer screen has no server password any more, and a login box: username, password, remember',!HH.includes('id="t_mp_pw"')&&['t_mp_login','t_mp_user','t_mp_pass','t_mp_keep'].every(has)&&/<input id="t_mp_pass"[^>]*type="password"/.test(HH));
    ok('Settings has the account box, with the plain-text warning',['s_acct','s_acname','s_acname_go','s_acold','s_acnew','s_acpw_go','s_acmsg'].every(has)&&HH.includes('can read your password in plain text'));
    const N=V.NET,sent=[];N.ws={readyState:1,send:t=>sent.push(JSON.parse(t)),close(){}};N.st='connecting';N.addr='127.0.0.1:1';N.cred=null;
    V.ntOpenMenu();V.ntMsg({t:'login',user:'Bea',why:'',accounts:true});
    const box=global.document.getElementById('t_mp_login'),go=global.document.getElementById('t_mp_go');
    ok('asked to log in, the game shows the box (username filled in) and Join Server becomes Log in',box.hidden===false&&global.document.getElementById('t_mp_user').value==='Bea'&&go.textContent==='Log in'&&N.loginWait===true);
    global.document.getElementById('t_mp_pass').value='s3cret!';V.ntMenuGo();
    ok('...and Log in sends the login',sent.some(m=>m.t==='login'&&m.user==='Bea'&&m.pass==='s3cret!')&&N.cred&&N.cred.u==='Bea');
    V.ntLoginHide();N.ws=null;N.st='off';N.cred=null;V.tmShow('main');}
  fs.rmSync(OUT,{recursive:true,force:true});
});
