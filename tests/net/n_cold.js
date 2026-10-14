/* n_cold.js (v6.51, lane NET, gate x1): land and players nobody has visited for a while are written compressed. The real
   server in this process with a world folder under out/, and a raw socket for a player. Nothing leaves the machine.
   1 the runs: every changed cell of a chunk by its index, a stretch of one block written once; back again exactly (meta
     included, an empty chunk, a dug-out chunk in a few bytes)
   2 a region nobody has been near for compressAfter days is written as .json.br only (Brotli, the runs inside), much
     smaller, and reads back to the same blocks and chests; a fresh region stays plain
   3 a player comes near: the next save writes it plain again and the .br is gone
   4 a player not seen for compressPlayersAfter days: playerdata/<name>.json.br; they can still log in (6.49) and are
     plain again once they have; 0 means never, for both
   5 a world from before 6.51 (no dates) counts as visited now: nothing is compressed at once */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const path=require('path'),fs=require('fs'),zlib=require('zlib'),{pathToFileURL}=require('url');
const {REPO,outDir}=require('../lib/paths.js');
const V=boot({});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f,ms){const t0=Date.now();while(Date.now()-t0<(ms||3000)){if(f())return true;await sleep(5);}return !!f();}

boot.run(async()=>{
  const lib=f=>import(pathToFileURL(path.join(REPO,'server',f)).href);
  const {createServer}=await lib('dinglecraft-server.mjs');
  const {encodeRuns,decodeRuns,readWorldDir}=await lib('lib/world.mjs');
  const OUT=path.join(outDir('net'),'cold');fs.rmSync(OUT,{recursive:true,force:true});

  /* ===== 1. the runs ===== */
  {let rs=51;const R=()=>{rs=(rs*1103515245+12345)&0x7fffffff;return rs/0x7fffffff;};
    let same=true;for(let t=0;t<40;t++){const b={};const n=Math.floor(R()*400);for(let i=0;i<n;i++)b[Math.floor(R()*16)+','+Math.floor(R()*80)+','+Math.floor(R()*16)]=Math.floor(R()*4)===0?(22|(Math.floor(R()*8)<<8)):Math.floor(R()*256);
      const back=decodeRuns(encodeRuns(b));if(JSON.stringify(Object.keys(b).sort().map(k=>[k,b[k]]))!==JSON.stringify(Object.keys(back).sort().map(k=>[k,back[k]])))same=false;}
    const dug={};for(let x=0;x<16;x++)for(let z=0;z<16;z++)for(let y=31;y<50;y++)dug[x+','+y+','+z]=0;
    ok('the runs give back exactly the blocks they were made from (40 random chunks, liquid levels included), and an empty chunk is empty',same&&encodeRuns({})===''&&Object.keys(decodeRuns('')).length===0);
    ok('a chunk dug out 16 x 16 x 19 is '+encodeRuns(dug).length+' characters as runs ('+JSON.stringify(dug).length+' as blocks)',encodeRuns(dug).length<20&&Object.keys(decodeRuns(encodeRuns(dug))).length===16*16*19);}

  /* ===== 2. a cold region ===== */
  const mk=(o)=>createServer({port:0,data:OUT,world:'world',noGame:true,quiet:true,seed:'51',accounts:true,...o});
  let S=mk({});await S.listen();let W=S.world();
  {const house={};for(let x=3;x<12;x++)for(let z=3;z<12;z++)for(let y=31;y<36;y++)house[x+','+y+','+z]=(x===3||x===11||z===3||z===11||y===31)?5:0;
    W.edits['2,2']=house;W.edits['3,2']={'1,40,1':22|(3<<8)};W.be['40,32,40']={t:'chest',inv:[{id:1,count:7}]};
    W.edits['900,900']={'0,40,0':4};                       /* far away, in another region */
    S.command('account add Gus pw');
    S.saveWorld('test');}
  const rdir=path.join(OUT,'world','region','over'),list=()=>fs.readdirSync(rdir).sort();
  const plain=list();
  {const big=plain.find(f=>f.endsWith('.json')&&fs.readFileSync(path.join(rdir,f),'utf8').includes('"2,2"'));
    const rk='over/'+big.replace(/^r\./,'').replace(/\.json$/,'');
    ok('a fresh world is written plain ('+plain.join(' ')+')',plain.every(f=>f.endsWith('.json'))&&!!W.rvisit[rk]);
    const sz=fs.statSync(path.join(rdir,big)).size;
    W.rvisit[rk]=Date.now()-8*864e5;S.setTime(0.3);S.saveWorld('test');
    const now=list(),br=big+'.br';
    ok('a region nobody has been near for 8 days (compressAfter 7) is written as .json.br only',now.includes(br)&&!now.includes(big)&&now.filter(f=>f.endsWith('.json')).length===plain.length-1);
    const bsz=fs.statSync(path.join(rdir,br)).size,inside=zlib.brotliDecompressSync(fs.readFileSync(path.join(rdir,br))).toString('utf8');
    ok('...at '+bsz+' bytes instead of '+sz+' ('+Math.round(100*bsz/sz)+'%), with the runs inside',bsz<sz*0.1&&inside.includes('"runs": "')&&!inside.includes('"blocks"'));
    const back=readWorldDir(path.join(OUT,'world')).world;
    ok('...and it reads back to the same blocks (water level too) and the same chest',JSON.stringify(back.edits['2,2'])===JSON.stringify(Object.fromEntries(Object.entries(W.edits['2,2']).map(([k,v])=>[k,v])))||Object.keys(back.edits['2,2']).length===Object.keys(W.edits['2,2']).length&&Object.keys(W.edits['2,2']).every(k=>back.edits['2,2'][k]===W.edits['2,2'][k]));
    ok('...every cell of it',back.edits['3,2']['1,40,1']===(22|(3<<8))&&back.be['40,32,40'].inv[0].count===7&&back.edits['900,900']['0,40,0']===4);

  /* ===== 3. visited again ===== */
    const ws=new WebSocket('ws://127.0.0.1:'+S.port),got=[];ws.onmessage=e=>got.push(JSON.parse(e.data));await new Promise(r=>{ws.onopen=r;});
    ws.send(JSON.stringify({t:'hello',proto:V.NT_PROTO,v:V.GAME_VERSION,name:'Gus',user:'Gus',pass:'pw'}));await until(()=>got.some(m=>m.t==='ready'));
    ws.send(JSON.stringify({t:'pose',x:40,y:40,z:40,yaw:0,pitch:0,dim:'over',held:0,hp:20,fl:0}));
    await until(()=>Date.now()-W.rvisit[rk]<5000,3000);S.setTime(0.3);S.saveWorld('test');
    ok('a player comes near: the next save writes the region plain again and the .br is gone',list().includes(big)&&!list().includes(br));
    ws.close();await sleep(100);}

  /* ===== 4. players ===== */
  {const pdir=path.join(OUT,'world','playerdata');
    W.players.gus.seen=new Date(Date.now()-9*864e5).toISOString();S.setTime(0.3);S.saveWorld('test');
    ok('a player not seen for 9 days: playerdata/gus.json.br only',fs.existsSync(path.join(pdir,'gus.json.br'))&&!fs.existsSync(path.join(pdir,'gus.json')));
    const t=zlib.brotliDecompressSync(fs.readFileSync(path.join(pdir,'gus.json.br'))).toString('utf8').split('\n');
    ok('...inside, the same file: the password still its second line',t[1]==='  "player": "gus",'&&t[2]==='  "password": "pw",');
    await S.close();
    S=mk({});await S.listen();W=S.world();
    ok('a restarted server reads it',W.players.gus&&W.players.gus.password==='pw');
    const ws=new WebSocket('ws://127.0.0.1:'+S.port),got=[];ws.onmessage=e=>got.push(JSON.parse(e.data));await new Promise(r=>{ws.onopen=r;});
    ws.send(JSON.stringify({t:'hello',proto:V.NT_PROTO,v:V.GAME_VERSION,name:'Gus',user:'Gus',pass:'pw'}));
    ok('...and Gus logs in as before',await until(()=>got.some(m=>m.t==='ready')));
    ws.send(JSON.stringify({t:'save',player:{x:1,y:40,z:1,inv:[]}}));await sleep(80);S.saveWorld('test');
    ok('...after which his file is plain again',fs.existsSync(path.join(pdir,'gus.json'))&&!fs.existsSync(path.join(pdir,'gus.json.br')));
    ws.close();await sleep(100);await S.close();}
  {S=mk({compressAfter:0,compressPlayersAfter:0});await S.listen();W=S.world();
    for(const k of Object.keys(W.rvisit))W.rvisit[k]=Date.now()-400*864e5;W.players.gus.seen=new Date(Date.now()-400*864e5).toISOString();S.setTime(0.3);S.saveWorld('test');
    ok('compressAfter 0 and compressPlayersAfter 0: nothing is ever compressed',list().every(f=>f.endsWith('.json'))&&fs.readdirSync(path.join(OUT,'world','playerdata')).every(f=>f.endsWith('.json')));
    await S.close();}

  /* ===== 5. an older world ===== */
  {const lf=path.join(OUT,'world','level.json'),L=JSON.parse(fs.readFileSync(lf,'utf8'));delete L.rvisit;fs.writeFileSync(lf,JSON.stringify(L));
    S=mk({});await S.listen();W=S.world();S.setTime(0.3);S.saveWorld('test');
    ok('a world from before 6.51 (no dates): every region counts as visited now, and nothing is compressed',Object.keys(W.rvisit).length>=2&&Object.values(W.rvisit).every(t=>Date.now()-t<60000)&&list().every(f=>f.endsWith('.json')));
    await S.close();}
  fs.rmSync(OUT,{recursive:true,force:true});
});
