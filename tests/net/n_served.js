/* n_served.js (v6.18, lane NET, gate x1, real clock): the game a server hands out is that server's game.
   The server adds one line to the page it serves (window.DC_SERVER = 1); this suite boots the game with that set, the
   way a browser that opened the server's address would have it. The same build without the line is the whole game, and
   every other suite boots it that way.
   1 the page: what the server sends is the file with exactly that one line added at the top of <head>, and the right length;
     a file with no <head> goes out as it is
   2 the served game knows what it is; Create New World, Load World, Continue and Import are off its menu and switched off
   3 the functions behind them do nothing there: no world is created, loaded or imported
   4 it still joins the server, plays, and comes back to a menu that still has no worlds of its own */
'use strict';
const realFetch=global.fetch;
global.DC_SERVER=1;                          /* what the server's line does, before the game loads */
const boot=require('../lib/c_boot.js'),{ok}=boot;
const path=require('path'),fs=require('fs'),{pathToFileURL}=require('url');
const {REPO,outDir}=require('../lib/paths.js');
const V=boot({});
const step=boot.stepper(900000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f,ms){const t0=Date.now();while(Date.now()-t0<(ms||4000)){if(f())return true;await sleep(10);}return !!f();}

boot.run(async()=>{
  const {createServer}=await import(pathToFileURL(path.join(REPO,'server','dinglecraft-server.mjs')).href);
  const NET=V.NET,$=id=>document.getElementById(id);

  /* ===== 1. the page ===== */
  {const OUT=path.join(outDir('net'),'served_data');fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
    const page='<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>x</title>\n</head>\n<body>'+'y'.repeat(200000)+'</body></html>\n',file=path.join(OUT,'dinglecraft_v'+V.GAME_VERSION+'.html');
    fs.writeFileSync(file,page);
    const S1=createServer({port:0,data:OUT,memory:true,world:'',simulate:false,quiet:true});await S1.listen();
    const r=await realFetch('http://127.0.0.1:'+S1.port+'/'),body=await r.text(),tag='<script>window.DC_SERVER=1</script>\n';
    ok('the page a server hands out is the game file with one line added at the top of its head',body.startsWith('<!DOCTYPE html>\n<html lang="en">\n<head>\n'+tag+'<meta charset')&&body.replace(tag,'')===page&&body.split(tag).length===2);
    ok('...and says how long it really is',+r.headers.get('content-length')===Buffer.byteLength(page)+tag.length&&+(await realFetch('http://127.0.0.1:'+S1.port+'/',{method:'HEAD'})).headers.get('content-length')===Buffer.byteLength(page)+tag.length);
    fs.writeFileSync(file,'<!doctype html><title>stand-in</title>');
    ok('a file with no head goes out exactly as it is',await realFetch('http://127.0.0.1:'+S1.port+'/').then(x=>x.text())==='<!doctype html><title>stand-in</title>');
    S1.opts.singlePlayer=true;fs.writeFileSync(file,page+' ');
    ok('"singlePlayer": true in the settings hands out the whole game: the file exactly as it is',await realFetch('http://127.0.0.1:'+S1.port+'/').then(x=>x.text())===page+' ');
    S1.opts.singlePlayer=false;fs.writeFileSync(file,'<!doctype html><title>stand-in</title>');
    ok('the file on disk is never touched',fs.readFileSync(file,'utf8')==='<!doctype html><title>stand-in</title>');
    await S1.close();fs.rmSync(OUT,{recursive:true,force:true});}

  /* ===== 2. the menu ===== */
  ok('the game knows a server handed it out',NET.served===true);
  ok('Create New World, Load World, Continue and Import World are off the menu and switched off',['t_continue','t_go_new','t_go_load','t_import'].every(id=>$(id).hidden===true&&$(id).disabled===true)&&!$('t_go_mp').hidden&&!$('t_go_mp').disabled);
  ok('Multiplayer is the one way left to play, with this server\'s address ready (and the controls and credits are still there)',V.ntServedMenu()===true&&!$('t_go_mp').hidden&&!$('t_help').hidden&&!$('t_credits').hidden&&(V.ntOpenMenu(),document.getElementById('tmp').hidden===false));

  /* ===== 3. no worlds of its own ===== */
  V.startNewWorld('nope','1','s');step(5);
  ok('Create New World does nothing: no world, no player, still on the title',V.playing===false&&!V.P);
  await window.storage.set('vxw:left',JSON.stringify({f:1,seed:5,mode:'s',edits:{},be:{},player:{x:0,y:40,z:0},dim:'over'}));
  ok('a world already saved in this browser is not loaded',(await V.loadWorldByName('left'))===false&&V.playing===false);
  {let read=false;global.FileReader=function(){read=true;this.readAsText=()=>{};};V.importWorldFile({name:'w.vxw.json'});
    ok('...and none is imported',read===false&&V.playing===false);}
  ok('nothing in the browser\'s own worlds was changed',JSON.parse((await window.storage.get('vxw:left')).value).seed===5);

  /* ===== 4. it still joins the server ===== */
  {const S=createServer({port:0,memory:true,world:'',noGame:true,quiet:true,seed:'4242',rules:{mobSpawn:false,snail:false}});await S.listen();
    V.setPName('Dan');V.ntConnect('127.0.0.1:'+S.port,'');
    ok('joining the server works as ever: in the world, playing',await until(()=>NET.on&&V.playing,10000)&&!!V.P);
    step(40);
    await V.quitToTitle();
    ok('back on the title it is still a server\'s game',V.playing===false&&NET.served===true&&$('t_go_new').hidden===true&&$('t_go_load').disabled===true);
    await S.close();}
  await window.storage.delete('vxw:left');
});
