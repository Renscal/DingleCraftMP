/* n_passwords.js (v6.61, lane NET, gate x1): passwords are hashed, and a server can ask for good ones. The real server in this
   process with a world folder under out/, raw sockets for players. Nothing leaves the machine.
   1 the hash: scrypt with a salt of its own (the same password twice is two hashes), right and wrong passwords, a plain-text
     one (from before 6.61, or written by hand) still opens, a hash with costs out of bounds opens nothing, at once
   2 the rule: passwordProblem for none (even "1"), medium (7 characters, a number) and high (14 characters, 2 numbers, a
     symbol), at each edge, with the reason in words
   3 the server: /account add and /account password refuse a weak password under its level, a player's own change too,
     and the welcome tells the game the rule; none takes anything
   4 an older world: plain-text passwords are hashed on start and saved at once (no password text left in the folder),
     and still log in; a plain one put in by hand is hashed on that player's next login
   5 a login does not stall the server: five at once, and the server's clock keeps ticking meanwhile; an unknown name takes
     about as long as a wrong password
   6 the setting: passwordSecurity in the defaults (none), checked, in the window's form as a choice of three, and it needs a
     restart; the window shows no passwords and masks them in its console; the game says nobody can read them and shows the rule */
'use strict';
const fetch=global.fetch;
const boot=require('../lib/c_boot.js'),{ok}=boot;
const path=require('path'),fs=require('fs'),{pathToFileURL}=require('url');
const {REPO,outDir}=require('../lib/paths.js');
const V=boot({});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f,ms){const t0=Date.now();while(Date.now()-t0<(ms||4000)){if(f())return true;await sleep(5);}return !!f();}

boot.run(async()=>{
  const lib=f=>import(pathToFileURL(path.join(REPO,'server',f)).href);
  const {createServer}=await lib('dinglecraft-server.mjs');
  const K=await lib('lib/commands.mjs'),C=await lib('lib/config.mjs'),A=await lib('lib/admin.mjs');
  const OUT=path.join(outDir('net'),'passwords_'+process.pid);fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});

  /* ===== 1. the hash ===== */
  {const h1=K.hashPassword('s3cret!'),h2=K.hashPassword('s3cret!');
    ok('a hash is scrypt with its own salt ('+h1.slice(0,24)+'…): the same password twice is two different hashes',/^scrypt\$32768\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/.test(h1)&&h1!==h2&&K.isHashed(h1)&&!K.isHashed('s3cret!'));
    ok('the right password opens it, a wrong one, an empty one and no account do not',await K.checkPassword({password:h1},'s3cret!')&&await K.checkPassword({password:h2},'s3cret!')&&
      !await K.checkPassword({password:h1},'s3cret')&&!await K.checkPassword({password:h1},'')&&!await K.checkPassword(null,'s3cret!'));
    ok('a plain-text password (from before 6.61, or written into the file by hand) still opens',await K.checkPassword({password:'old pw'},'old pw')&&!await K.checkPassword({password:'old pw'},'old'));
    const big='scrypt$1048576$32$4$'+h1.split('$')[4]+'$'+h1.split('$')[5];const t0=Date.now();
    ok('a hash with costs out of bounds (a damaged or tampered file) opens nothing, and at once',!await K.checkPassword({password:big},'s3cret!')&&Date.now()-t0<50);
    const later=await K.hashPasswordLater('n3w!');ok('a hash made off the main thread is the same kind',K.isHashed(later)&&await K.checkPassword({password:later},'n3w!'));}

  /* ===== 2. the rule ===== */
  {const P=K.passwordProblem,cases=[
      ['none','1',true],['none','a b',false],['none','x'.repeat(65),false],
      ['medium','abcdef1',true],['medium','abcdefg',false],['medium','abc123',false],['medium','1234567',true],
      ['high','abcdefghijk12!',true],['high','abcdefghijkl12',false],['high','abcdefghijk1!x',false],['high','abcdefghij12!',false],['high','12!@#$%^&*()_+',true]];
    const wrong=cases.filter(([l,p,want])=>(P(p,l)==='')!==want).map(([l,p])=>l+':'+p);
    ok('the three levels at their edges: none takes "1", medium wants 7 characters and a number, high 14, two numbers and a symbol'+(wrong.length?' (wrong: '+wrong.join(' ')+')':''),wrong.length===0);
    ok('...and say why in words ('+P('abc','high')+')',P('abc','medium')==='This server asks for passwords of at least 7 characters, with at least 1 number.'&&
      P('abc','high')==='This server asks for passwords of at least 14 characters, with at least 2 numbers and 1 symbol.'&&K.passwordRule('none')==='');}

  /* ===== 3. the server ===== */
  const logs=[];
  let S=createServer({port:0,data:OUT,world:'world',noGame:true,quiet:true,seed:'61',accounts:true,passwordSecurity:'medium',onLog:l=>logs.push(l)});
  await S.listen();let W=S.world();
  async function conn(extra){
    const ws=new WebSocket('ws://127.0.0.1:'+S.port),R={ws,got:[],closed:false,by:t=>R.got.filter(m=>m.t===t),last:t=>R.by(t).pop(),send:m=>ws.send(JSON.stringify(m)),
      clear:()=>{R.got.length=0;},quit:async()=>{ws.close();await until(()=>R.closed);await sleep(20);}};
    ws.onmessage=e=>R.got.push(JSON.parse(e.data));ws.onclose=()=>{R.closed=true;};
    await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=()=>rej(new Error('socket'));});
    R.send({t:'hello',proto:V.NT_PROTO,v:V.GAME_VERSION,name:'x',...extra});
    await until(()=>!!R.last('ready')||!!R.last('login')||R.closed);
    return R;
  }
  {const weak=S.command('account add Bea abc'),strong=S.command('account add Bea abcdef1');
    ok('medium: /account add refuses "abc" ('+weak+') and takes "abcdef1"',/at least 7 characters, with at least 1 number/.test(weak)&&/Account Bea made/.test(strong)&&K.isHashed(W.players.bea.password));
    ok('...and /account password too',/at least 7/.test(S.command('account password Bea short'))&&/New password set/.test(S.command('account password Bea longer1'))&&await K.checkPassword(W.players.bea,'longer1'));
    const b=await conn({user:'Bea',pass:'longer1'});
    ok('the player logs in, and the welcome tells their game the rule',!!b.last('ready')&&b.last('welcome').acct.rule==='at least 7 characters, with at least 1 number');
    b.clear();b.send({t:'acct',old:'longer1',pass:'weak'});await until(()=>!!b.last('acct'));
    ok('their own change to a weak one is refused with the rule',b.last('acct').ok===false&&/at least 7/.test(b.last('acct').why)&&await K.checkPassword(W.players.bea,'longer1'));
    await sleep(300);b.clear();b.send({t:'acct',old:'longer1',pass:'better12'});await until(()=>!!b.last('acct'),3000);
    ok('...a good one goes through, hashed',b.last('acct').ok===true&&K.isHashed(W.players.bea.password)&&await K.checkPassword(W.players.bea,'better12'));
    await b.quit();await S.close();}
  {S=createServer({port:0,data:OUT,world:'world',noGame:true,quiet:true,accounts:true,passwordSecurity:'none'});await S.listen();W=S.world();
    ok('none: "1" is a password',/Account Cal made/.test(S.command('account add Cal 1'))&&await K.checkPassword(W.players.cal,'1'));
    const c=await conn({user:'Cal',pass:'1'});ok('...that logs in, and the game is told there is no rule',!!c.last('ready')&&c.last('welcome').acct.rule==='');
    await c.quit();S.saveWorld('test');await S.close();}

  /* ===== 4. an older world ===== */
  {const pd=path.join(OUT,'world','playerdata');
    for(const [n,pw] of [['dan','hunter2'],['eve','correct horse']]) fs.writeFileSync(path.join(pd,n+'.json'),'{\n  "player": "'+n+'",\n  "password": "'+pw+'",\n  "x": 1,\n  "y": 40,\n  "z": 1\n}\n');
    logs.length=0;S=createServer({port:0,data:OUT,world:'world',noGame:true,quiet:true,accounts:true,onLog:l=>logs.push(l)});await S.listen();W=S.world();
    const all=[];(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true}))e.isDirectory()?walk(path.join(d,e.name)):all.push(fs.readFileSync(path.join(d,e.name),'utf8'));})(path.join(OUT,'world'));
    ok('plain-text passwords are hashed on start and saved at once ('+(logs.find(l=>/hashed/.test(l))||'no log')+')',logs.some(l=>/2 passwords kept as plain text until now: hashed/.test(l))&&K.isHashed(W.players.dan.password)&&K.isHashed(W.players.eve.password));
    ok('...no password text is left anywhere in the world folder',!all.some(t=>t.includes('hunter2')||t.includes('correct horse')));
    const d=await conn({user:'Dan',pass:'hunter2'});ok('...and the old password still logs in',!!d.last('ready'));await d.quit();
    W.players.eve.password='by hand';S.dirty=true;
    const e=await conn({user:'Eve',pass:'by hand'});
    ok('a plain password put into a record by hand logs in, and is hashed then',!!e.last('ready')&&K.isHashed(W.players.eve.password)&&await K.checkPassword(W.players.eve,'by hand'));
    await e.quit();}

  /* ===== 5. a login does not stall the server ===== */
  {let worst=0,last=Date.now();const iv=setInterval(()=>{const n=Date.now();worst=Math.max(worst,n-last);last=n;},5);
    const t0=Date.now(),five=await Promise.all([0,1,2,3,4].map(()=>conn({user:'Dan',pass:'hunter2'})));const took=Date.now()-t0;
    clearInterval(iv);
    ok('five logins to one account at once: each is let in and replaced by the next, one stays ('+took+' ms), and the server\'s clock never stood still longer than '+worst+' ms',five.every(r=>!!r.last('welcome')||r.closed)&&five.filter(r=>!r.closed).length===1&&worst<80);
    for(const r of five)if(!r.closed)await r.quit();
    const tm=async(extra)=>{const t=Date.now(),r=await conn(extra);const d=Date.now()-t;await r.quit();return d;};
    await sleep(1100);const tw=await tm({user:'Dan',pass:'wrong1'});await sleep(1100);const tu=await tm({user:'Nobody',pass:'wrong1'});
    ok('a name with no account takes about as long as a wrong password ('+tu+' ms against '+tw+' ms): the time gives nothing away',tu>tw/3);
    await S.close();}

  /* ===== 6. the setting, the window, the game ===== */
  {const F=A.formSchema().settings.find(x=>x.key==='passwordSecurity');
    ok('passwordSecurity: none by default, one of none, medium, high, a choice of three in the window\'s form, and it needs a restart',C.DEFAULTS.passwordSecurity==='none'&&
      A.validateSettings({...C.DEFAULTS,passwordSecurity:'high'}).ok&&A.validateSettings({...C.DEFAULTS,passwordSecurity:'extreme'}).errors.some(x=>x.key==='passwordSecurity')&&
      !!F&&F.kind==='select'&&F.options.map(o=>o[0]).join()==='none,medium,high'&&/Enforce password security/.test(F.label)&&A.RESTART_KEYS.includes('passwordSecurity'));
    const G=f=>fs.readFileSync(path.join(REPO,'server-gui',f),'utf8'),ren=G('renderer.js'),html=G('index.html');
    ok('the window shows no passwords any more, says why, and masks one typed for add or password in its console',!ren.includes('ac_show')&&!html.includes('ac_show')&&html.includes('id="acmsg"')&&
      /nobody can read them/.test(html)&&/i === 3 \? '\*\*\*\*'/.test(ren));
    const HH=fs.readFileSync(path.join(REPO,'build','head.html'),'utf8');
    ok('the game says nobody can read the password, not even the owner',HH.includes('nobody can read it, not even its owner')&&!HH.includes('plain text'));
    const N=V.NET,was={on:N.on,acct:N.acct};N.on=true;N.acct={accounts:true,account:true,locks:{},rule:'at least 7 characters, with at least 1 number'};V.ntAcctSync();
    const shown=(document.getElementById('s_acrule')||{}).textContent;N.acct.locks={password:true};V.ntAcctSync();const locked=(document.getElementById('s_acrule')||{}).textContent;
    N.on=was.on;N.acct=was.acct;
    ok('the game shows the server\'s rule by the password box ('+shown+'), and not when password changes are locked',shown==='A new password here needs at least 7 characters, with at least 1 number.'&&locked==='');}

  fs.rmSync(OUT,{recursive:true,force:true});
});
