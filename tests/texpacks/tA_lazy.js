/* tA_lazy.js (v6.62, Package A): the Hyperreal art is files beside the page, loaded the first time Hyperreal is switched on.
   1 the build: the page is head + game + hrart.js + tail and carries none of the art; build/art and dist/art hold the files
     the page names (hrart.js HRART.files = build.json art), each under its cap and named after its own content's hash
   2 the files, run, give back exactly what hrassets.js holds: every hr and mg key, every payload byte for byte
   3 the loader (hrart.js in a sandbox with a stand-in document): nothing before it is asked; two calls at once share one
     load, one script tag per file; a missing file resolves false and leaves no tag, and a later call loads it
   4 the game: Hyperreal waits for the art (progress starts at 0), switches on when it arrives, stays on OG with the reason
     when it cannot be loaded, and does not ask again once it is there; a page with no loader (the suites) is unchanged
   5 the multiplayer server hands out /art/<file> from the art folder beside its game file (cached for good), and nothing
     outside it (../, encoded, other kinds of file, no game file)
   Headless (stubs_A + fake_assets) for 4; the real build for the rest. */
'use strict';
const boot=require('../lib/hr_boot.js'),{ok}=boot;
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),{pathToFileURL}=require('url');
const P=require('../lib/paths.js');
const fetch=global.fetch;   /* taken before the boot: this suite talks to its own 127.0.0.1 server */
const V=boot({stubs:['A'],assets:'fake',seed:1337});
const step=boot.stepper(500000);
const W={only:['world']};
const md5=b=>crypto.createHash('md5').update(b).digest('hex'),sha1=b=>crypto.createHash('sha1').update(b).digest('hex');

boot.run(async()=>{
  const B=P.BUILD,info=JSON.parse(fs.readFileSync(B+'build.json','utf8')),GU=JSON.parse(fs.readFileSync(P.REPO+'scripts/guards.json','utf8'));
  const html=fs.readFileSync(path.join(P.DIST,info.html.file)),stub=fs.readFileSync(B+'hrart.js','latin1');
  const files=JSON.parse(/var HRART=\{files:(\[[^\]]*\])/.exec(stub)[1]);

  /* ===== 1. the build ===== */
  ok('the page is head + game + hrart.js + tail ('+(html.length/1e6).toFixed(1)+' MB, under its '+(GU.html_cap/1e6)+' MB cap)',
    html.equals(Buffer.concat(['head.html','game.js','hrart.js','tail.html'].map(f=>fs.readFileSync(B+f))))&&html.length<GU.html_cap&&html.length<12e6);
  {const keys=Object.keys(require(B+'hrassets.js').hrAssets()),t=html.toString('latin1');
    ok('...and carries none of the art: no art key, no payload in its script ('+keys.length+' keys checked)',keys.length>300&&!keys.some(k=>t.includes(JSON.stringify(k)))&&!/data:image\/webp/.test(stub));}
  ok('the page names the files build.json lists ('+files.join(', ')+')',files.length>=1&&JSON.stringify(files)===JSON.stringify((info.art||[]).map(a=>a.file)));
  const texts=files.map(f=>fs.readFileSync(B+f,'latin1'));
  ok('build/art and dist/art hold them, byte for byte, each under the '+(GU.art_file_cap/1e6)+' MB cap',files.every((f,i)=>fs.existsSync(path.join(P.DIST,f))&&md5(fs.readFileSync(path.join(P.DIST,f)))===info.art[i].md5&&
    md5(fs.readFileSync(B+f))===info.art[i].md5&&texts[i].length<GU.art_file_cap));
  ok('each is named after its own content (sha1 of what follows its name)',files.every((f,i)=>{const n=path.basename(f),at=texts[i].indexOf('hrArtArrived('+JSON.stringify(n)+',');
    return at>0&&n.includes('-'+sha1(Buffer.from(texts[i].slice(at+('hrArtArrived('+JSON.stringify(n)+',').length),'latin1')).slice(0,10)+'.js');}));
  ok('build/art holds nothing else',JSON.stringify(fs.readdirSync(B+'art').sort())===JSON.stringify(files.map(f=>path.basename(f)).sort()));

  /* ===== 2 + 3. the files and the loader, in a sandbox ===== */
  {let tags=[],serve=new Set(files);
    const doc={head:{appendChild(s){tags.push(s);s.parentNode=doc.head;setImmediate(()=>{const i=files.indexOf(s.src);
        if(serve.has(s.src)&&i>=0){vm.runInContext(texts[i],ctx,{filename:s.src});s.onload();}else s.onerror();});},removeChild(s){tags=tags.filter(x=>x!==s);s.parentNode=null;}},
      createElement:()=>({})};
    const ctx=vm.createContext({document:doc,Promise,Object,setImmediate});
    vm.runInContext(stub,ctx);
    ok('before it is asked: no art, no tag (hrAssets null, hrMgAssets empty, not ready)',ctx.hrAssets()===null&&Object.keys(ctx.hrMgAssets()).length===0&&ctx.hrArtReady()===false&&tags.length===0);
    serve=new Set(files.slice(1));
    const miss=await ctx.hrArtLoad();
    ok('a missing file: resolves false, and its tag is taken away again',miss===false&&!ctx.hrArtReady()&&tags.length===files.length-1&&ctx.hrAssets()===null);
    serve=new Set(files);tags=[];
    const p1=ctx.hrArtLoad(),p2=ctx.hrArtLoad();
    ok('two calls at once share one load',p1===p2);
    const r=await p1;
    ok('a later call loads only what is still missing ('+tags.length+' tag), and resolves true',r===true&&ctx.hrArtReady()&&tags.length===files.length-1);
    ok('...and once it is there, another call adds nothing',await ctx.hrArtLoad()===true&&tags.length===files.length-1);
    const A=require(B+'hrassets.js'),T=ctx.hrAssets(),M=ctx.hrMgAssets(),HT=A.hrAssets(),HM=A.hrMgAssets();
    ok('the files give back every hr key and payload hrassets.js holds ('+Object.keys(T).length+')',Object.keys(T).length===Object.keys(HT).length&&Object.keys(HT).every(k=>T[k]===HT[k]));
    ok('...and every Malgorath one ('+Object.keys(M).length+')',Object.keys(M).length===Object.keys(HM).length&&Object.keys(HM).every(k=>M[k]===HM[k]));
    ok('...and the same tile list (hrAssetMeta, kept in the page)',JSON.stringify(ctx.hrAssetMeta())===JSON.stringify(A.hrAssetMeta()));}

  /* ===== 4. the game ===== */
  {V.startNewWorld('lazy','1337','c');step(5);V.GR.mobSpawn=false;V.GR.dayCycle=false;
    V.forceChunksNear(Math.floor(V.P.x),Math.floor(V.P.z));step(30);
    let ready=false,answer=false,calls=0;
    global.hrArtReady=()=>ready;global.hrArtLoad=async()=>{calls++;await new Promise(r=>setTimeout(r,20));if(answer)ready=true;return answer;};
    const notes=await boot.capture('[TP] ',async()=>{ok('the art cannot be loaded: Hyperreal stays off, OG untouched',await V.setPack('hr',W)===false&&V.getTP().id==='og'&&!V.getHRW().on);});
    ok('...and says why ('+notes.join(' | ')+')',notes.some(n=>/its art is missing \(the art folder next to the game\)/.test(n))&&calls===1);
    answer=true;const prog=[];
    const r=await V.setPack('hr',Object.assign({progress:f=>prog.push(f)},W));
    ok('the art arrives: Hyperreal switches on, progress from 0 to 1',r===true&&V.getTP().id==='hr'&&V.getHRW().on&&prog[0]===0&&prog[prog.length-1]===1&&calls===2);
    await V.setPack('og',W);step(2);
    ok('switched off and on again: the art is not asked for again',await V.setPack('hr',W)===true&&calls===2);
    await V.setPack('og',W);step(2);
    delete global.hrArtReady;delete global.hrArtLoad;
    ok('a page with no loader (the art already in it) switches on as before',await V.setPack('hr',W)===true&&V.getTP().id==='hr');
    await V.setPack('og',W);}

  /* ===== 5. the multiplayer server ===== */
  {const {createServer}=await import(pathToFileURL(path.join(P.REPO,'server','dinglecraft-server.mjs')).href);
    const OUT=path.join(P.outDir('texpacks'),'lazy_'+process.pid);fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(path.join(OUT,'game','art'),{recursive:true});
    const game=path.join(OUT,'game','dinglecraft_v'+V.GAME_VERSION+'.html');fs.copyFileSync(path.join(P.DIST,info.html.file),game);
    for(const f of files)fs.copyFileSync(B+f,path.join(OUT,'game',f));
    fs.writeFileSync(path.join(OUT,'game','secret.js'),'nope');fs.writeFileSync(path.join(OUT,'game','art','x.json'),'{}');
    const S=createServer({port:0,data:path.join(OUT,'data'),game,quiet:true,simulate:false,accounts:false});await S.listen();
    const get=u=>fetch('http://127.0.0.1:'+S.port+u);
    const f0=files[0],res=await get('/'+f0);
    const body=Buffer.from(await res.arrayBuffer());
    ok('the server hands out /'+f0+' from the art folder beside its game, cached for good',res.status===200&&md5(body)===info.art[0].md5&&/immutable/.test(res.headers.get('cache-control')||'')&&/javascript/.test(res.headers.get('content-type')||''));
    const codes=[];for(const u of ['/art/../secret.js','/art/%2e%2e/secret.js','/art/..%2fsecret.js','/art/x.json','/art/','/art/nope.js','/secret.js'])codes.push(u+' '+(await get(u)).status);
    ok('...and nothing outside it ('+codes.join(', ')+')',codes.every(c=>/ 404$/.test(c)));
    await S.close();
    const S2=createServer({port:0,data:path.join(OUT,'data2'),noGame:true,quiet:true,simulate:false,accounts:false});await S2.listen();
    const n=await fetch('http://127.0.0.1:'+S2.port+'/'+f0);
    ok('a server with no game file has no art to hand out',n.status===404);
    await S2.close();fs.rmSync(OUT,{recursive:true,force:true});}
});
