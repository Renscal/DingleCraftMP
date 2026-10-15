/* n_files.js (v6.60, lane NET, gate x1): what fills the world is packed (server/lib/region.mjs), shown and searched. The real
   server in this process with a world folder under out/, its command line in-process and once as a program. Nothing
   leaves the machine.
   1 the format: 200 random regions (odd keys and values, liquid levels, chests) and their entity files come back exactly;
     small numbers are one byte, 2-decimal places a few; a built-up region is a small part of its JSON
   2 a damaged file: every cut-short copy and every flipped byte either reads or fails saying which file, and a count that
     claims more than the file holds is refused at once; a newer format says so
   3 the server writes region/<dim>/r.x.z.dcr and entities/<dim>/r.x.z.dce only (players stay JSON), reads them back to the
     same world, and a later save leaves an unchanged region alone
   4 a world from before 6.60 (JSON regions, the Brotli regions and players of 6.53 to 6.59, a level.json with region dates)
     is read and written in the new form at once: the same world, the old files gone, the passwords kept; where a region
     has both forms the packed one wins
   5 the command line: view, unpack (and pack it back to the same bytes, also as Notepad saves it), pack, files and find, in-process and through the
     front door, with no server started; bad options and damaged files are refused saying why
   6 search: by name, by #id, by mob type; kinds can be left out, files picked, hits capped; a dug-out chunk is one line;
     a chest is not listed twice; what players carry; the contents view adds up stacks
   7 the compress settings are gone (defaults, the window's form, what needs a restart); an old server.json with them passes
   8 names.json is the game's own (npm run names --check), and the server window has the World files tab wired through */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const path=require('path'),fs=require('fs'),zlib=require('zlib'),cp=require('child_process'),{pathToFileURL}=require('url');
const {REPO,outDir}=require('../lib/paths.js');
const V=boot({});

/* mulberry32 (Math.imul): never a float LCG */
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
/* a value with its keys sorted, so two documents compare whatever order their keys came in */
const norm=v=>JSON.stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(q=>[q,x[q]])):x);
/* the runs of 6.53 to 6.59 (world.mjs encodeRuns), to write a cold region the way those servers did */
function oldRuns(blocks){const a=[];for(const lk of Object.keys(blocks)){const p=lk.split(',').map(Number);a.push([p[1]*256+p[2]*16+p[0],blocks[lk]]);}a.sort((x,y)=>x[0]-y[0]);
  const out=[];for(let i=0;i<a.length;){let j=i;while(j+1<a.length&&a[j+1][0]===a[j][0]+1&&a[j+1][1]===a[i][1])j++;out.push(a[i][0].toString(36)+(j>i?'+'+(j-i+1).toString(36):'')+'='+a[i][1].toString(36));i=j+1;}return out.join(' ');}

boot.run(async()=>{
  const lib=f=>import(pathToFileURL(path.join(REPO,'server',f)).href);
  const R=await lib('lib/region.mjs'),{createServer}=await lib('dinglecraft-server.mjs'),{filesMain}=await lib('lib/files.mjs');
  const C=await lib('lib/config.mjs'),A=await lib('lib/admin.mjs');
  const OUT=path.join(outDir('net'),'files_'+process.pid);fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});

  /* ===== 1. the format ===== */
  const R1=rng(60);
  const randRegion=(R1)=>{const rx=Math.floor(R1()*8)-4,rz=Math.floor(R1()*8)-4,chunks={};
    for(let c=0;c<1+R1()*12;c++){const cx=rx*32+Math.floor(R1()*32),cz=rz*32+Math.floor(R1()*32),blocks={},be={};
      for(let b=0;b<R1()*400;b++)blocks[Math.floor(R1()*16)+','+Math.floor(R1()*80)+','+Math.floor(R1()*16)]=R1()<0.25?(22|(Math.floor(R1()*9)<<8)):Math.floor(R1()*256);
      for(let y=30;y<30+R1()*6;y++)for(let x=0;x<16;x++)blocks[x+','+y+',5']=0;
      if(R1()<0.15)blocks['17,3,2']=4;if(R1()<0.15)blocks['01,3,2']=4;if(R1()<0.15)blocks['1,2,3']='x';if(R1()<0.1)blocks['1,5000,3']=1;
      for(let b=0;b<R1()*3;b++)be[(cx*16+Math.floor(R1()*16))+','+Math.floor(R1()*80)+','+(cz*16+Math.floor(R1()*16))]=R1()<0.5
        ?{t:'chest',inv:Array.from({length:27},()=>R1()<0.3?{id:Math.floor(R1()*400),count:1+Math.floor(R1()*64),...(R1()<0.2?{dur:Math.round(R1()*1000)/10,ench:{sharp:2}}:{})}:null)}
        :{t:'furnace',in:{id:18,count:3},fuel:{id:101,count:1},out:null,prog:R1(),burn:-3.25,big:2**60,neg:-77777,tag:'é ✓'};
      if(R1()<0.1)be['0,0,0']={t:'not here'};
      chunks[cx+','+cz]={blocks,blockEntities:be};}
    if(R1()<0.1)chunks['NaN,NaN']={blocks:{'1,1,1':3},blockEntities:{}};
    return{dimension:R1()<0.5?'over':'nether',region:[rx,rz],blocksFrom:[rx*512,rz*512],chunks};};
  {let same=0,eSame=0;
    for(let t=0;t<200;t++){const doc=randRegion(R1),back=R.decodeFile(R.encodeRegion(doc),'t');if(back.kind==='region'&&back.form==='packed'&&norm(back.doc)===norm(doc))same++;
      const e={dimension:'aether',region:doc.region,items:{['d'+t]:{x:1.25,y:30,z:-4.5,item:{id:4,count:3},ageSeconds:t}},mobs:[{type:'zombie',x:10.33,y:31,z:-2.07,yaw:1.57,health:19.5},{type:'villager',x:1e-9,y:2**60,z:-3,yaw:0,health:20,name:'Bob',origin:[3,4]}],vehicles:[{type:'boat',x:0.5,y:30,z:0.5,yaw:-3.14,health:5}]};
      const eb=R.decodeFile(R.encodeEntities(e),'e');if(eb.kind==='entities'&&norm(eb.doc)===norm(e))eSame++;}
    ok('200 random regions come back exactly (odd keys and values, liquid levels, chests, furnaces, numbers of every kind)',same===200);
    ok('...and their entity files (items, mobs, vehicles, a name, an origin)',eSame===200);}
  {const v=R.encodeRegion({dimension:'over',region:[0,0],chunks:{'0,0':{blocks:{'0,0,0':7},blockEntities:{}}}});
    ok('a region with one changed block is '+v.length+' bytes; an empty one reads back empty',v.length<=20&&Object.keys(R.decodeFile(R.encodeRegion({dimension:'over',region:[3,-2],chunks:{}})).doc.chunks).length===0);
    const m=R.encodeEntities({dimension:'over',region:[0,0],items:{},mobs:Array.from({length:100},(_,i)=>({type:'zombie',x:i+0.25,y:31.5,z:-i-0.75,yaw:1.57,health:20})),vehicles:[]});
    ok('100 mobs at 2-decimal places are '+m.length+' bytes (about '+Math.round(m.length/100)+' each)',m.length<100*20);}
  {const R2=rng(7),chunks={};
    for(let c=0;c<40;c++){const cx=c%8,cz=Math.floor(c/8),blocks={},be={};
      for(let x=0;x<16;x++)for(let z=0;z<16;z++)for(let y=30;y<34;y++)if(R2()<0.5)blocks[x+','+y+','+z]=0;
      for(let x=2;x<9;x++)for(let y=40;y<45;y++){blocks[x+','+y+',2']=5;blocks[x+','+y+',8']=5;}
      if(c<30)be[(cx*16+3)+',41,'+(cz*16+3)]={t:'chest',inv:Array.from({length:27},()=>R2()<0.4?{id:100+Math.floor(R2()*50),count:1+Math.floor(R2()*64)}:null)};
      chunks[cx+','+cz]={blocks,blockEntities:be};}
    const doc={dimension:'over',region:[0,0],blocksFrom:[0,0],chunks},text=R.docText('region',doc),buf=R.encodeRegion(doc);
    ok('a built-up region (40 chunks, 30 chests) is '+buf.length+' bytes packed, '+text.length+' as JSON ('+Math.round(buf.length/text.length*100)+'%)',buf.length<text.length*0.15&&norm(JSON.parse(text))===norm(doc));}

  /* ===== 2. damaged files ===== */
  {const doc=randRegion(rng(9)),buf=R.encodeRegion(doc);let cutOK=true,flipOK=true,named=true;
    for(let n=1;n<buf.length;n++){try{R.decodeFile(buf.subarray(0,n),'r.cut.dcr');cutOK=false;}catch(e){if(!(e instanceof Error)||!e.message.includes('r.cut.dcr'))named=false;}}
    const F=rng(3);
    for(let t=0;t<300;t++){const b=Buffer.from(buf),at=4+Math.floor(F()*(b.length-4));b[at]^=1+Math.floor(F()*255);try{R.decodeFile(b,'r.flip.dcr');}catch(e){if(!(e instanceof Error)||!/r\.flip\.dcr/.test(e.message))flipOK=false;}}
    ok('every cut-short copy of a region file ('+(buf.length-1)+') fails, naming the file',cutOK&&named);
    ok('300 copies with a flipped byte each either read or fail naming the file (no other kind of error)',flipOK);
    const bomb=Buffer.concat([Buffer.from('DCR\x01\x04over\x00\x00','latin1'),Buffer.from([0xff,0xff,0xff,0xff,0x0f])]);let why='';const t0=Date.now();
    try{R.decodeFile(bomb,'r.bomb.dcr');}catch(e){why=e.message;}
    ok('a count larger than the file is refused at once ('+why+')',/larger than the file/.test(why)&&Date.now()-t0<200);
    const newer=Buffer.from(buf);newer[3]=R.FORMAT+1;let nw='';try{R.decodeFile(newer,'r.new.dcr');}catch(e){nw=e.message;}
    ok('a file in a newer format says so ('+nw+')',/newer server/.test(nw));}

  /* ===== 3. the server writes packed files ===== */
  const logs=[];
  const mk=(o)=>createServer({port:0,data:OUT,world:'world',noGame:true,quiet:true,seed:'60',accounts:true,onLog:l=>logs.push(l),...o});
  const WD=path.join(OUT,'world'),ls=d=>{try{return fs.readdirSync(path.join(WD,d)).sort();}catch{return [];}};
  let S=mk({});await S.listen();let W=S.world();
  {const house={};for(let x=3;x<12;x++)for(let z=3;z<12;z++)for(let y=31;y<36;y++)house[x+','+y+','+z]=(x===3||x===11||z===3||z===11||y===31)?5:0;
    W.edits['2,2']=house;W.edits['3,2']={'1,40,1':22|(3<<8)};W.be['40,32,40']={t:'chest',inv:[{id:104,count:7},null,{id:109,count:12}]};
    W.edits['900,900']={'0,40,0':4};W.edits['n;5,5']={'1,1,1':87};
    W.drops.x1={dim:'over',x:10.5,y:40,z:10.5,st:{id:104,count:1},age:3};
    W.mobs=[{t:'zombie',x:20.25,y:31,z:20.75,yaw:0,hp:20},{t:'villager',x:-20,y:31,z:-20,yaw:1,hp:20,name:'Bea'}];
    S.command('account add Gus pw');S.setTime(0.3);S.saveWorld('test');}
  const mobs=list=>list.map(m=>norm(m)).sort();   /* mobs come back region by region, in another order */
  const before=norm({e:W.edits,be:W.be,d:W.drops,m:mobs(W.mobs)});
  ok('a new world writes packed regions only ('+ls('region/over').join(' ')+'; nether: '+ls('region/nether').join(' ')+')',ls('region/over').length===2&&ls('region/over').every(f=>/^r\.-?\d+\.-?\d+\.dcr$/.test(f))&&ls('region/nether').join()==='r.0.0.dcr');
  ok('...and packed entity files ('+ls('entities/over').join(' ')+'), players stay JSON with the password on line two',ls('entities/over').length>=1&&ls('entities/over').every(f=>f.endsWith('.dce'))&&
    ls('playerdata').join()==='gus.json'&&fs.readFileSync(path.join(WD,'playerdata','gus.json'),'utf8').split('\n')[2].includes('"password": "pw"'));
  ok('level.json has no region dates any more',!('rvisit' in JSON.parse(fs.readFileSync(path.join(WD,'level.json'),'utf8'))));
  await S.close();
  {const reg=path.join(WD,'region','over','r.0.0.dcr'),t0=fs.statSync(reg).mtimeMs;
    S=mk({});await S.listen();W=S.world();
    ok('a restarted server reads the same world back (blocks, liquid levels, chests, drops, mobs)',norm({e:W.edits,be:W.be,d:W.drops,m:mobs(W.mobs)})===before);
    await new Promise(r=>setTimeout(r,30));S.setTime(0.6);S.saveWorld('test');
    ok('a later save leaves an unchanged region file alone',fs.statSync(reg).mtimeMs===t0);
    await S.close();}

  /* ===== 4. a world from before 6.60 ===== */
  const OLD=path.join(OUT,'old'),OW=path.join(OLD,'world');
  {fs.mkdirSync(path.join(OW,'region','over'),{recursive:true});fs.mkdirSync(path.join(OW,'entities','over'),{recursive:true});fs.mkdirSync(path.join(OW,'playerdata'),{recursive:true});
    fs.writeFileSync(path.join(OW,'level.json'),JSON.stringify({layout:1,regionSize:32,chunkSize:16,name:'old',seed:5,mode:'s',time:0.2,gr:{},rvisit:{'over/0.0':1,'over/1.0':2}},null,2));
    fs.writeFileSync(path.join(OW,'region','over','r.0.0.json'),R.docText('region',{dimension:'over',region:[0,0],blocksFrom:[0,0],chunks:{'1,1':{blocks:{'2,40,3':31,'2,41,3':22|(2<<8)},blockEntities:{'18,40,19':{t:'chest',inv:[null,{id:20,count:2}]}}}}}));
    const cold={'33,0':{runs:oldRuns({'0,30,0':0,'1,30,0':0,'2,30,0':0,'5,31,5':4}),blockEntities:{}}};
    fs.writeFileSync(path.join(OW,'region','over','r.1.0.json.br'),zlib.brotliCompressSync(JSON.stringify({dimension:'over',region:[1,0],blocksFrom:[512,0],chunks:cold})));
    fs.writeFileSync(path.join(OW,'region','over','r.5.5.json'),R.docText('region',{dimension:'over',region:[5,5],chunks:{'160,160':{blocks:{'0,50,0':1},blockEntities:{}}}}));
    fs.writeFileSync(path.join(OW,'region','over','r.5.5.dcr'),R.encodeRegion({dimension:'over',region:[5,5],chunks:{'160,160':{blocks:{'0,50,0':2},blockEntities:{}}}}));
    fs.writeFileSync(path.join(OW,'entities','over','r.0.0.json'),R.docText('entities',{dimension:'over',region:[0,0],items:{d9:{x:1,y:40,z:1,item:{id:4,count:5},ageSeconds:9}},mobs:[{type:'pig',x:3.5,y:31,z:3.5,yaw:0,health:10}],vehicles:[]}));
    fs.writeFileSync(path.join(OW,'playerdata','ivy.json.br'),zlib.brotliCompressSync('{\n  "player": "ivy",\n  "password": "secret",\n  "x": 1, "y": 40, "z": 1,\n  "inv": [{"id":104,"count":2}]\n}\n'));
    logs.length=0;S=createServer({port:0,data:OLD,world:'world',noGame:true,quiet:true,accounts:true,onLog:l=>logs.push(l)});await S.listen();W=S.world();
    const rd=fs.readdirSync(path.join(OW,'region','over')).sort(),ed=fs.readdirSync(path.join(OW,'entities','over')),pd=fs.readdirSync(path.join(OW,'playerdata'));
    ok('an old world is written in the new form at once ('+(logs.find(l=>/6\.60 form/.test(l))||'no log line')+')',logs.some(l=>/5 files from an older server written in the 6\.60 form/.test(l)));
    ok('...the old files are gone ('+rd.join(' ')+' | '+ed.join(' ')+' | '+pd.join(' ')+')',rd.join()==='r.0.0.dcr,r.1.0.dcr,r.5.5.dcr'&&ed.join()==='r.0.0.dce'&&pd.join()==='ivy.json');
    ok('...the same world: blocks with their liquid level, a chest, a cold region\'s runs, a drop, a pig',W.edits['1,1']['2,41,3']===(22|(2<<8))&&W.be['18,40,19'].inv[1].id===20&&
      Object.keys(W.edits['33,0']).length===4&&W.edits['33,0']['5,31,5']===4&&W.drops.d9&&W.drops.d9.st.count===5&&W.mobs.some(m=>m.t==='pig'));
    ok('...a compressed player is plain again with their password, and level.json lost its region dates',fs.readFileSync(path.join(OW,'playerdata','ivy.json'),'utf8').split('\n')[2].includes('"password": "secret"')&&
      !('rvisit' in JSON.parse(fs.readFileSync(path.join(OW,'level.json'),'utf8')))&&!('rvisit' in W));
    ok('where a region had both forms, the packed one was read and the other removed',W.edits['160,160']['0,50,0']===2);
    await S.close();}

  /* ===== 5. the command line ===== */
  const cli=async(...a)=>{let o='',e='';const code=await filesMain(a,s=>{o+=s;},s=>{e+=s;});return{code,o,e};};
  const reg00=path.join(WD,'region','over','r.0.0.dcr');
  {const v=await cli('view',reg00),j=JSON.parse(v.o);
    ok('view prints a region as JSON a person reads (one chunk a line block)',v.code===0&&j.dimension==='over'&&j.chunks['2,2']&&Object.keys(j.chunks['2,2'].blocks).length===9*9*5&&v.o.split('\n').length<30);
    const U=path.join(OUT,'cli');fs.mkdirSync(U,{recursive:true});
    const u=await cli('unpack',reg00,path.join(U,'r.0.0.json'));
    const p=await cli('pack',path.join(U,'r.0.0.json'));
    ok('unpack writes it as JSON and pack makes the very same bytes again',u.code===0&&p.code===0&&fs.readFileSync(path.join(U,'r.0.0.dcr')).equals(fs.readFileSync(reg00))&&/Stop the server/.test(p.o));
    fs.writeFileSync(path.join(U,'bom.json'),'\uFEFF'+fs.readFileSync(path.join(U,'r.0.0.json'),'utf8').replace(/\n/g,'\r\n'));
    const bom=await cli('pack',path.join(U,'bom.json'),path.join(U,'bom.dcr'));
    ok('a JSON file saved by Notepad (a byte-order mark, Windows line ends) packs to the same bytes',bom.code===0&&fs.readFileSync(path.join(U,'bom.dcr')).equals(fs.readFileSync(reg00)));
    fs.copyFileSync(path.join(OW,'region','over','r.0.0.dcr'),path.join(U,'self.dcr'));
    const self=await cli('pack',path.join(U,'self.dcr'),path.join(U,'self.dcr'));
    ok('pack will not write over the file it reads',self.code===1&&/write over/.test(self.e));
    const bad=path.join(U,'bad.dcr');fs.writeFileSync(bad,fs.readFileSync(reg00).subarray(0,20));
    const b=await cli('view',bad),o=await cli('find','x','--nope');
    ok('a damaged file and an unknown option are refused saying why',b.code===1&&/bad\.dcr is damaged/.test(b.e)&&o.code===2&&/unknown option --nope/.test(o.e));
    const f=await cli('files','--data',OUT);
    ok('files lists the world\'s files with what is in them',f.code===0&&/region\/over\/r\.0\.0\.dcr .*\d+ blocks/.test(f.o)&&/entities\/over\/r\.0\.0\.dce .*mobs/.test(f.o));
    const d=await cli('find','diamond','--data',OUT);
    ok('find diamond: the chest, the dropped one, and what Gus carries is searched too',d.code===0&&/40 32 40 +7 x +Diamond #104 +chest, slot 0/.test(d.o)&&/dropped/.test(d.o));
    const n=await cli('find','#22','--data',OUT,'--blocks');
    ok('find #22 --blocks: water by its id, with its level',/Water \(meta 3\) #22/.test(n.o)&&!/dropped/.test(n.o));
    const only=await cli('find','zombie','--data',OUT,'--in','region/over/r.0.0.dcr');
    ok('--in searches only that file',/nothing matching "zombie"/.test(only.o)&&/1 file searched/.test(only.o));
    const door=cp.spawnSync(process.execPath,[path.join(REPO,'server','dinglecraft-server.mjs'),'find','villager','--data',OUT],{encoding:'utf8',timeout:20000});
    ok('the front door runs find without starting a server ('+door.stdout.trim().split('\n').pop()+')',door.status===0&&/villager "Bea"/.test(door.stdout)&&!/listening on port/.test(door.stdout));}

  /* ===== 6. search ===== */
  {const all=await R.searchWorld(WD,{query:'oak planks'});
    ok('a chunk with many of one block is one line with the count ('+all.hits.map(h=>h.count+' x '+h.name).join(', ')+')',all.hits.length===1&&all.hits[0].count>100&&/first at/.test(all.hits[0].in));
    const air=await R.searchWorld(WD,{query:'#0'});
    ok('#0 finds the dug-out blocks',air.hits.length>=1&&air.hits.every(h=>h.id===0));
    W.be['41,32,40']={t:'chest',inv:[]};
    const S2=mk({});await S2.listen();S2.world().edits['2,2']['8,32,8']=31;S2.world().be['40,32,41']={t:'chest',inv:[]};S2.setTime(0.1);S2.saveWorld('test');await S2.close();
    const ch=await R.searchWorld(WD,{query:'chest',items:false,mobs:false,players:false});
    ok('a chest that is a changed block is listed once, one that is not (a village\'s) still is ('+ch.hits.map(h=>h.in+' '+h.at.join(' ')).join('; ')+')',
      ch.hits.length===2&&ch.hits.some(h=>h.in==='changed block'&&h.at.join()==='40,32,40')&&ch.hits.some(h=>h.in==='chest'&&h.at.join()==='40,32,41'));
    const noB=await R.searchWorld(WD,{query:'diamond',blocks:false,items:false,mobs:false});
    ok('leaving out every kind but players finds only what players carry (nothing here: Gus holds nothing)',noB.hits.length===0);
    const ivy=await R.searchWorld(OW,{query:'diamond'});
    ok('what a player carries: "ivy\'s inventory (slot 0)"',ivy.hits.some(h=>h.player==='ivy'&&/ivy's inventory \(slot 0\)/.test(h.in)&&h.count===2));
    const cap=await R.searchWorld(WD,{query:'#0',limit:1});
    ok('hits are capped and say so',cap.hits.length===1&&cap.truncated===true);
    const r=R.readWorldFile(WD,'region/over/r.0.0.dcr'),t=R.describeDoc(r.kind,r.doc);
    ok('the contents view names the blocks and adds up what a chest holds ("7 x Diamond, 12 x Arrow")',t.some(s=>s.rows.some(x=>x[0]==='Oak Planks'))&&t.some(s=>s.rows.some(x=>x[2]==='7 x Diamond, 12 x Arrow')));
    let esc='';try{R.readWorldFile(WD,'../../outside.dcr');}catch(e){esc=e.message;}
    ok('a file outside the world is never read',/not a file of this world/.test(esc));}

  /* ===== 7. the compress settings are gone ===== */
  {const sch=A.formSchema();
    ok('compressAfter and compressPlayersAfter are gone from the defaults, the window\'s form and the restart list',!('compressAfter' in C.DEFAULTS)&&!('compressPlayersAfter' in C.DEFAULTS)&&
      !sch.settings.some(s=>/compress/.test(s.key))&&!A.RESTART_KEYS.some(k=>/compress/.test(k)));
    ok('an old server.json that still has them passes the settings check',A.validateSettings({...C.DEFAULTS,compressAfter:7,compressPlayersAfter:7}).ok);
    ok('the command line drops them from server.json',/delete cfg\.compressAfter; delete cfg\.compressPlayersAfter;/.test(fs.readFileSync(path.join(REPO,'server','lib','cli.mjs'),'utf8')));}

  /* ===== 8. names, and the window ===== */
  {const n=cp.spawnSync(process.execPath,[path.join(REPO,'scripts','names.mjs'),'--check'],{encoding:'utf8',timeout:120000});
    ok('server/lib/names.json is the game\'s own ('+(n.stdout||n.stderr).trim()+')',n.status===0);
    ok('names: 31 is a Chest, 104 a Diamond, 0 Air, and a zombie is a mob type',R.itemName(31)==='Chest'&&R.itemName(104)==='Diamond'&&R.blockName(0)==='Air'&&R.names().mobs.includes('zombie'));
    const G=f=>fs.readFileSync(path.join(REPO,'server-gui',f),'utf8'),main=G('main.js'),pre=G('preload.js'),html=G('index.html'),ren=G('renderer.js');
    ok('the window: a World files tab, its five calls wired from the page to the program, and the reader taken from a 6.60 server version',
      /data-tab="files"/.test(html)&&/id="t_files"/.test(html)&&['wfiles','wfile:read','wfile:export','wfind','wsave'].every(c=>main.includes("h('"+c+"'")&&pre.includes("call('"+c+"')"))&&
      /lib', 'region\.mjs'/.test(main)&&/loadFiles\(\)/.test(ren));
    ok('the window is version 1.2.0',JSON.parse(G('package.json')).version==='1.2.0');}

  fs.rmSync(OUT,{recursive:true,force:true});
});
