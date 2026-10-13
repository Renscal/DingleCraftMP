/* k11_day.js (v6.31, lane CORE2, gate x1): a day is 20 minutes, and not half of it is dark
   (src/core/p07a_render_sound.js: dayRamp, dayLight, dayElev, sunUp; DAY_LEN in the game and in the server).
   1 DAY_LEN is 1200 in the game and in the server, and the two speak the same protocol number
   2 the parts: full day 10 minutes, sunset 1.5, full night 7, sunrise 1.5 (counted over a whole day)
   3 where they fall: noon 0.25 in the middle of the day, midnight 0.75 in the middle of the night
   4 the curves have no jumps; the sky's stand-in for the sun's height is 1 at noon and -1 at midnight
   5 "is it night" is the same question in the game and in the server, at every minute of the day
   6 /time day, noon, sunset, night and midnight land in the part of the day they name
   7 the clock runs at one day in 1200 seconds of play
   8 a saved time of day loads to the same point of the day; a bed still wakes you in full daylight
   9 the OG sky: day colour at noon, night colour at midnight, and the torch glow follows the same curve */
'use strict';
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
const boot=require('../lib/c_boot.js'),{ok}=boot;
const {REPO}=require('../lib/paths.js');
const V=boot({seed:31});
const step=boot.stepper(600000);

boot.run(async()=>{
  ok('the seams are on __vox',['dayRamp','dayLight','dayElev','sunUp','setTime','getTime'].every(k=>typeof V[k]==='function'));
  const cfg=await import(pathToFileURL(path.join(REPO,'server','lib','config.mjs')).href);
  /* ===== 1 ===== */
  ok('a day is 1200 seconds in the game and in the server ('+V.DAY_LEN+', '+cfg.DAY_LEN+'), protocol '+V.NT_PROTO+' on both',V.DAY_LEN===1200&&cfg.DAY_LEN===1200&&V.NT_PROTO===cfg.PROTO);

  /* ===== 2, 3 ===== */
  const N=24000;let day=0,night=0,set=0,rise=0;
  for(let i=0;i<N;i++){const t=(i+0.5)/N,r=V.dayRamp(t);if(r>=1)day++;else if(r<=0)night++;else if(t<0.75)set++;else rise++;}
  const min=n=>+(n/N*20).toFixed(2);
  ok('the parts of a 20-minute day: full day '+min(day)+' min, sunset '+min(set)+', full night '+min(night)+', sunrise '+min(rise),
    min(day)===10&&min(set)===1.5&&min(night)===7&&min(rise)===1.5);
  V.setTime(0.25);const noonUp=V.sunUp();V.setTime(0.75);const midUp=V.sunUp();
  let nightN=0;for(let i=0;i<N;i++){V.setTime((i+0.5)/N);if(!V.sunUp())nightN++;}
  ok('it is night for 7/20 of a day ('+(nightN/N).toFixed(4)+'), day at noon (0.25), night at midnight (0.75)',Math.abs(nightN/N-0.35)<0.001&&noonUp&&!midUp);
  ok('noon is the middle of the full day and midnight the middle of the full night',
    V.dayRamp(0.001)===1&&V.dayRamp(0.499)===1&&V.dayRamp(0.576)===0&&V.dayRamp(0.924)===0&&Math.abs(V.dayRamp(0.5375)-0.5)<1e-9&&Math.abs(V.dayRamp(0.9625)-0.5)<1e-9);

  /* ===== 4 ===== */
  let jl=0,je=0,lo=9,hi=-9;
  for(let i=0;i<N;i++){const a=i/N,b=(i+1)/N;jl=Math.max(jl,Math.abs(V.dayLight(b)-V.dayLight(a)));je=Math.max(je,Math.abs(V.dayElev(b)-V.dayElev(a)));lo=Math.min(lo,V.dayElev(a));hi=Math.max(hi,V.dayElev(a));}
  ok('no jumps: the biggest step in 1/24000 of a day is '+jl.toFixed(5)+' of light and '+je.toFixed(5)+' of height; height runs '+lo.toFixed(2)+' to '+hi.toFixed(2),
    jl<0.002&&je<0.002&&Math.abs(V.dayElev(0.25)-1)<1e-9&&Math.abs(V.dayElev(0.75)+1)<1e-9&&lo>=-1&&hi<=1&&V.dayLight(0.25)===1&&V.dayLight(0.75)===0);

  /* ===== 5 ===== */
  const proto=fs.readFileSync(path.join(REPO,'server','lib','protocol.mjs'),'utf8');
  const m=/const isNight = (\(time\) => \{[^\n]+\});/.exec(proto);
  let agree=!!m,bad=0;
  if(m){const isNight=eval(m[1]);for(let i=0;i<1200;i++){const t=(i+0.5)/1200;V.setTime(t);if(isNight(t)===V.sunUp())bad++;}agree=bad===0;}
  ok('the server\'s "is it night" agrees with the game\'s at every second-and-a-bit of the day ('+bad+' disagree)',agree);

  /* ===== 6 ===== */
  const cmd=fs.readFileSync(path.join(REPO,'server','lib','commands.mjs'),'utf8');
  const w=/const words = (\{[^}]+\});/.exec(cmd),W=w?eval('('+w[1]+')'):{};
  ok('/time names: day '+W.day+' and noon '+W.noon+' are full day, sunset '+W.sunset+' is where the light starts to go, night '+W.night+' and midnight '+W.midnight+' are full night',
    V.dayRamp(W.day)===1&&W.noon===0.25&&V.dayRamp(W.noon)===1&&W.sunset===0.5&&V.dayRamp(W.sunset+0.01)<1&&V.dayRamp(W.night)===0&&W.midnight===0.75&&V.dayRamp(W.midnight)===0);

  /* ===== 7 ===== */
  V.startNewWorld('day','1337','c');V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;step(60);
  V.GR.dayCycle=true;V.setTime(0.1);const t0=V.getTime();step(400);const adv=V.getTime()-t0;
  ok('400 frames of 40 ms move the clock by 16 s of a 1200 s day ('+(adv*1200).toFixed(2)+' s)',Math.abs(adv*1200-16)<1.2);

  /* ===== 8 ===== */
  V.setTime(3.6234);const snap=V.snapshot('day');V.setTime(0.1);V.applySave(snap);
  ok('a save keeps the point of the day (0.6234 -> '+(V.getTime()%1).toFixed(4)+'), and it is still full night there',Math.abs((V.getTime()%1)-0.6234)<1e-3&&!V.sunUp());
  V.setTime(0.8);const P=V.P;V.doSleep(Math.floor(P.x),Math.floor(P.y),Math.floor(P.z));
  ok('a bed at night wakes you in full daylight ('+(V.getTime()%1).toFixed(2)+')',V.sunUp()&&V.dayRamp(V.getTime())===1);

  /* ===== 9 ===== */
  const bg=()=>{const c=V.getScene().background;return [Math.round(c.r*255),Math.round(c.g*255),Math.round(c.b*255)];};
  V.GR.dayCycle=false;V.P.y=Math.max(V.P.y,70);V.P.flying=true;
  V.setTime(0.25);step(40);const noon=bg();V.setTime(0.75);step(40);const mid=bg();V.setTime(0.5375);step(3);const dusk=bg();
  ok('the OG sky: '+noon.join(',')+' at noon, '+mid.join(',')+' at midnight, warmer than either halfway through the sunset ('+dusk.join(',')+')',
    noon.join()==='135,206,235'&&mid.join()==='7,10,24'&&dusk[0]>noon[0]&&dusk[0]>mid[0]);
  ok('the torch glow follows the same curve: full by night, a quarter by day',V.lightDay(0.75)===0&&V.lightDay(0.25)===1&&V.lightDay(0.6)===0&&V.lightDay(0.45)===1);
});
