/* ===================================================================== */
/* PART 7 — sky, sound, hand, save system, menus, boot, main loop        */
/* ===================================================================== */
let scene=null,camera=null,renderer=null,matOp=null,matCut=null,matWat=null;
let timeOfDay=0.3;
/* ----- the parts of a day (6.31) -----
   timeOfDay is a fraction of a day: 0 the end of sunrise, 0.25 noon, 0.5 the start of sunset, 0.75 midnight. The sun and
   moon turn at an even speed; how bright it is does not follow them evenly: full day for half the day (10 of the 20
   minutes), a sunset of 1.5 minutes, full night for 7, a sunrise of 1.5. The server keeps the same numbers
   (isNight in server/lib/protocol.mjs). */
const DAY_DUSK=0.5,DAY_RAMP=0.075;                         /* sunset starts at 0.5 and takes 0.075 of a day; sunrise ends at 1 */
/* 1 in full day, 0 in full night, a straight line between during sunset and sunrise */
function dayRamp(t){
  const f=((t%1)+1)%1;
  if(f<=DAY_DUSK)return 1;
  if(f<DAY_DUSK+DAY_RAMP)return 1-(f-DAY_DUSK)/DAY_RAMP;
  if(f<=1-DAY_RAMP)return 0;
  return (f-(1-DAY_RAMP))/DAY_RAMP;
}
/* the same, eased: how much daylight there is */
function dayLight(t){const r=dayRamp(t);return r*r*(3-2*r);}
/* a stand-in for the sun's height for anything that colours the sky by it: 1 at noon, 0.18 where full day meets the
   sunset or the sunrise, -0.25 where they meet full night, -1 at midnight */
function dayElev(t){
  const f=((t%1)+1)%1,r=dayRamp(t);
  if(r>=1)return 0.18+0.82*Math.sin(f/DAY_DUSK*Math.PI);
  if(r<=0)return -0.25-0.75*Math.sin((f-DAY_DUSK-DAY_RAMP)/(1-DAY_DUSK-2*DAY_RAMP)*Math.PI);
  return -0.25+0.43*r;
}
function sunUp(){return dayRamp(timeOfDay)>0;}

/* ----- procedural sound (WebAudio) ----- */
let AC=null,noiseBuf=null;
let SFXVOL=1,MUSVOL=0.7;   /* Release 1.0: the Sound and Music volume sliders (Settings) */
/* every sound goes through a bus: AC.destination is shadowed by the SFX bus, music connects to musDest(a) */
function acBus(a){
  try{const real=a.destination,sfx=a.createGain(),mus=a.createGain();sfx.connect(real);mus.connect(real);
    sfx.gain.value=SFXVOL;mus.gain.value=MUSVOL;a.__real=real;a.__sfx=sfx;a.__mus=mus;
    Object.defineProperty(a,'destination',{configurable:true,get(){return sfx;}});}catch(e){}
}
function musDest(a){return (a&&a.__mus)||(a&&a.destination);}
function acVol(){try{if(AC&&AC.__sfx){AC.__sfx.gain.value=SFXVOL;AC.__mus.gain.value=MUSVOL;}}catch(e){}}
function audio(){
  if(!soundOn)return null;
  try{
    if(!AC){
      AC=new (window.AudioContext||window.webkitAudioContext)();
      acBus(AC);
      noiseBuf=AC.createBuffer(1,AC.sampleRate*0.6|0,AC.sampleRate);
      const d=noiseBuf.getChannelData(0);
      for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    }
    if(AC.state==='suspended')AC.resume();
    return AC;
  }catch(e){return null;}
}
function tone(f0,f1,dur,type,vol){
  const a=audio();if(!a)return;
  const o=a.createOscillator(),g=a.createGain(),t=a.currentTime;
  o.type=type;o.frequency.setValueAtTime(f0,t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
  g.gain.setValueAtTime(vol*SNDMUL,t);
  g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  o.connect(g).connect(a.destination);
  o.start(t);o.stop(t+dur+0.02);
}
function noiseS(dur,vol,fq0,fq1,hp){
  const a=audio();if(!a)return;
  const s=a.createBufferSource(),g=a.createGain(),f=a.createBiquadFilter(),t=a.currentTime;
  s.buffer=noiseBuf;s.loop=true;
  f.type=hp?'highpass':'lowpass';
  f.frequency.setValueAtTime(fq0,t);
  f.frequency.exponentialRampToValueAtTime(Math.max(40,fq1||fq0),t+dur);
  g.gain.setValueAtTime(vol*SNDMUL,t);
  g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  s.connect(f).connect(g).connect(a.destination);
  s.start(t);s.stop(t+dur+0.02);
}
function playS(n){
  if(!soundOn)return;
  try{
    switch(n){
      case 'dig':   noiseS(0.09,0.20,900,300);break;
      case 'place': noiseS(0.05,0.16,1200,500);tone(300,260,0.05,'square',0.06);break;
      case 'pop':   tone(520,940,0.08,'sine',0.22);break;
      case 'laser': tone(1600,220,0.18,'sawtooth',0.2);tone(3200,700,0.12,'square',0.07);break;
      case 'boing': tone(160,760,0.24,'sine',0.32);tone(90,340,0.18,'triangle',0.14);break;
      case 'squeak': tone(950,1500,0.11,'square',0.12);break;
      case 'honk':  tone(310,290,0.16,'square',0.32);tone(233,214,0.2,'square',0.3);tone(466,430,0.12,'square',0.18);break;
      case 'boomx': tone(72,22,1.0,'sine',0.6);noiseS(0.22,0.5,180,60);break;
      case 'scream':tone(1750,320,1.2,'sawtooth',0.5);tone(2600,540,0.9,'square',0.3);noiseS(0.7,0.45,2200,500,1);break;
      case 'whisper':noiseS(0.9,0.1,900,300,1);break;
      case 'knock': tone(150,95,0.08,'square',0.45);break;
      case 'hurt':  tone(230,110,0.2,'sawtooth',0.22);break;
      case 'hit':   noiseS(0.07,0.2,1400,500);tone(190,120,0.06,'square',0.1);break;
      case 'crit':  noiseS(0.09,0.24,2600,900);tone(880,1320,0.09,'square',0.16);tone(1320,1760,0.07,'sine',0.12);break;
      case 'eat':   noiseS(0.05,0.13,700+Math.random()*400,300);break;
      case 'burp':  tone(150,70,0.28,'square',0.16);break;
      case 'bow':   tone(380,900,0.13,'sine',0.14);noiseS(0.08,0.1,2500,900,true);break;
      case 'fuse':  noiseS(0.5,0.12,3000,2500,true);break;
      case 'boom':  noiseS(0.8,0.55,420,70);tone(70,38,0.55,'sine',0.4);break;
      case 'break2':tone(520,90,0.22,'square',0.2);break;
      case 'thud':  noiseS(0.07,0.22,320,140);break;
    }
  }catch(e){}
}
let stepAcc=0;
function playSStep(){
  if(!soundOn)return;
  try{noiseS(0.05,0.09,500+Math.random()*350,250);}catch(e){}
}

