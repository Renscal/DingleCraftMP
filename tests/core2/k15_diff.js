/* k15_diff.js (v6.38, lane CORE2, gate x1): difficulty, DingleCore and spectating (src/features/p53d_difficulty.js).
   1 the rule: normal by default and in a save from before it; four names; levels 1, 2, 3, 3
   2 a mob's hit of 6: Easy 4, Normal 6, Hard 9, DingleCore 9. Never more than Normal on Easy. A fall of 6 is 6 everywhere,
     and one hit is never scaled twice
   3 starvation stops at 10 health on Easy and at 1 on Normal, and kills on Hard
   4 the lock: a world cannot be made DingleCore later, a DingleCore world cannot be made anything else (in the game, in the
     rules editor, by the debug menu's button, which only steps Easy, Normal, Hard)
   5 Create New World is where DingleCore is chosen, and it also offers the three dimension rules
   6 dying in DingleCore: the death screen offers Spectate and Back to title, no Respawn; asking to respawn anyway makes a
     spectator, not a living player
   7 a spectator: breaks nothing, places nothing, picks nothing up, takes no damage, passes through blocks, opens nothing
   8 the world's save remembers: it loads as a spectator again; a normal world's death screen still has Respawn
   9 the DingleCore heart is its own drawing, and the hearts are drawn with it */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:38});
const step=boot.stepper(600000);

boot.run(async()=>{
  const B=V.B,GR=V.GR,MB=V.MB;
  ok('the seams are on __vox',['diffKey','diffLevel','diffCore','diffMobDmg','diffStarveFloor','diffSet','specStart','specStop','diffDeathUI','tgrDiff','grToggle','setLastDmg','damagePlayer','respawn','die'].every(k=>typeof V[k]==='function'));
  const o=boot.studio(V,step,{});
  const P=()=>V.P;
  const quiet=()=>{V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;V.GR.ghosts=false;for(const e of V.entities)if(e.mob)e.dead=true;};
  quiet();
  /* ===== 1 ===== */
  const lv=k=>{GR.difficulty=k;return V.diffLevel();};
  const L=[lv('easy'),lv('normal'),lv('hard'),lv('dinglecore')];const coreOnly=[(GR.difficulty='hard',V.diffCore()),(GR.difficulty='dinglecore',V.diffCore())];
  GR.difficulty='banana';const bad=V.diffKey();GR.difficulty='normal';
  ok('normal by default; Easy, Normal, Hard, DingleCore are levels '+L.join(', ')+'; only DingleCore is DingleCore; nonsense reads as normal',
    V.GR_DEF?V.GR_DEF().difficulty==='normal':true&&L.join()==='1,2,3,3'&&coreOnly.join()==='false,true'&&bad==='normal'&&Object.keys(V.DIFF_NAMES).join()==='easy,normal,hard,dinglecore');
  {const snap=JSON.parse(JSON.stringify(V.snapshot('diff')));delete snap.gr.difficulty;GR.difficulty='hard';V.applySave(snap);step(40);quiet();
    ok('a save from before difficulties loads as Normal',V.GR.difficulty==='normal'&&V.diffLevel()===2);}
  /* ===== 2 ===== */
  const hit=(k,how,by,n)=>{V.GR.difficulty=k;const p=P();p.mode='s';p.hp=20;p.hurtT=0;p.armor=[null,null,null,null];p.dead=false;V.GR.god=false;V.setLastDmg({by:by||null,how});V.damagePlayer(n);return +(20-p.hp).toFixed(3);};
  const mob=['easy','normal','hard','dinglecore'].map(k=>hit(k,'mob','Zombie',6));
  ok('a mob\'s hit of 6: Easy '+mob[0]+', Normal '+mob[1]+', Hard '+mob[2]+', DingleCore '+mob[3],mob.join()==='4,6,9,9');
  ok('Easy never makes a hit bigger: 1 stays 1, 2 stays 2, 20 becomes 11',hit('easy','mob','Z',1)===1&&hit('easy','mob','Z',2)===2&&hit('easy','mob','Z',20)===11);
  ok('a skeleton\'s arrow and a Boomer\'s blast count as a mob\'s; a fall, lava and another player\'s arrow do not (Hard, 6 each)',
    hit('hard','arrow','Skeleton',6)===9&&hit('hard','tnt','Boomer',6)===9&&hit('hard','fall',null,6)===6&&hit('hard','lava',null,6)===6&&hit('hard','arrow','Ann',6)===6);
  {V.GR.difficulty='hard';const p=P();p.hp=20;p.hurtT=0;const one={by:'Zombie',how:'mob'};V.setLastDmg(one);V.damagePlayer(4);p.hurtT=0;V.damagePlayer(4);
    ok('one hit is scaled once: the same cause looked at again adds a plain 4 (6 + 4 = '+(20-p.hp)+')',20-p.hp===10);
    p.hp=20;p.hurtT=0.5;V.setLastDmg({by:'Zombie',how:'mob'});V.damagePlayer(4);p.hurtT=0;V.damagePlayer(4);
    ok('a mob\'s hit that landed while he could not be hurt does not make the next thing hurt more ('+(20-p.hp)+')',20-p.hp===4);}
  /* ===== 3 ===== */
  const starve=k=>{V.GR.difficulty=k;const p=P();p.mode='s';p.dead=false;p.hp=20;p.hunger=0;p.hurtT=0;p.armor=[null,null,null,null];
    for(let i=0;i<40&&!P().dead;i++){P().hunger=0;P().starveT=3.99;P().hurtT=0;step(1);}
    const r=P().dead?'dead':P().hp;if(P().dead){P().dead=false;const dm=document.getElementById('death');if(dm)dm.style.display='none';for(const e of V.entities)if(e.t==='drop')e.dead=true;}P().hp=20;P().hunger=20;return r;};
  const st=[starve('easy'),starve('normal'),starve('hard')];
  ok('starving: Easy stops at '+st[0]+', Normal at '+st[1]+', Hard ends '+st[2],st[0]===10&&st[1]===1&&st[2]==='dead');
  /* ===== 4 ===== */
  V.GR.difficulty='normal';
  const s1=[V.diffSet('hard'),V.GR.difficulty,V.diffSet('dinglecore'),V.GR.difficulty,V.diffSet('moon'),V.GR.difficulty];
  V.GR.difficulty='dinglecore';const s2=[V.diffSet('easy'),V.GR.difficulty];
  ok('in the game: Normal to Hard yes; to DingleCore no; to nonsense no; and out of DingleCore no',s1.join()==='true,hard,false,hard,false,hard'&&s2.join()==='false,dinglecore');
  ok('the rules editor: easy->hard changes, anything->dinglecore does not, dinglecore->anything does not',
    V.tgrDiff('easy','hard')==='hard'&&V.tgrDiff('normal','dinglecore')==='normal'&&V.tgrDiff('dinglecore','easy')==='dinglecore'&&V.tgrDiff(undefined,'hard')==='hard'&&V.tgrDiff('hard','x')==='hard');
  V.GR.difficulty='easy';const cyc=[];for(let i=0;i<4;i++){V.grToggle('difficulty');cyc.push(V.GR.difficulty);}
  V.GR.difficulty='dinglecore';V.grToggle('difficulty');
  ok('the debug menu\'s button steps '+cyc.join(' > ')+' and does nothing in DingleCore',cyc.join()==='normal,hard,easy,normal'&&V.GR.difficulty==='dinglecore');
  /* ===== 5 ===== */
  {const el=id=>document.getElementById(id);const d=el('t_diff');
    if(d){d.value='dinglecore';for(const k of ['tr_nether','tr_aether','tr_puppet'])if(el(k))el(k).checked=k!=='tr_aether';
      V.GR.difficulty='normal';V.grFromCreate();
      ok('Create New World: the difficulty picked there is the world\'s (DingleCore), and the three dimension rules are read from its boxes',V.GR.difficulty==='dinglecore'&&V.GR.nether===true&&V.GR.aether===false&&V.GR.puppet===true);
      d.value='normal';if(el('tr_aether'))el('tr_aether').checked=true;V.GR.aether=true;}
    else ok('Create New World has a difficulty box',false);}
  /* ===== 6 ===== */
  quiet();V.GR.difficulty='dinglecore';V.GR.god=false;V.GR.keepInv=true;
  {const p=P();p.mode='s';p.spec=false;p.dead=false;p.hp=20;p.hurtT=0;p.x=o.x+0.5;p.z=o.z+0.5;p.y=o.y;p.inv[0]={id:B.STONE,count:5};}
  step(2);V.setLastDmg({by:'Zombie',how:'mob'});P().hurtT=0;V.damagePlayer(50);
  const btn=id=>document.getElementById(id),shown=id=>!!btn(id)&&btn(id).style.display!=='none';
  ok('a DingleCore death: dead, and the death screen offers Spectate and Back to title, with no Respawn',P().dead===true&&!shown('d_respawn')&&shown('d_spec')&&/Back to title/.test(btn('d_title').textContent));
  V.respawn();
  ok('asking to respawn anyway does not bring him back to life: he is a spectator',P().spec===true&&P().dead===false&&P().mode==='c'&&P().flying===true);
  /* ===== 7 ===== */
  step(3);
  {const p=P();p.x=o.x+0.5;p.z=o.z+0.5;p.y=o.y;p.vx=p.vy=p.vz=0;
    V.setBlock(o.x+2,o.y,o.z,B.DIRT);V.setBlock(o.x+2,o.y+1,o.z,B.DIRT);
    boot.aim(V,o.x+2.5,o.y+1.4,o.z+0.5);MB.l=true;step(60);MB.l=false;const kept=V.getBlock(o.x+2,o.y+1,o.z)===B.DIRT;
    P().inv[0]={id:B.STONE,count:5};P().sel=0;boot.aim(V,o.x+2.5,o.y+1.4,o.z+0.5);boot.rclick(V,step);const placed=V.getBlock(o.x+1,o.y+1,o.z)!==B.AIR||P().inv[0].count!==5;
    ok('a spectator breaks nothing (a second of holding the button on dirt) and places nothing',kept&&!placed);
    V.spawnDrop(P().x,P().y+0.5,P().z,{id:B.GLASS,count:3},0,0,0);step(60);
    const lying=V.entities.filter(e=>e.t==='drop'&&!e.dead&&e.st.id===B.GLASS).reduce((n,e)=>n+e.st.count,0),got=P().inv.some(s=>s&&s.id===B.GLASS);
    ok('  ... picks nothing up (3 glass at his feet for three seconds: '+lying+' still lying)',lying===3&&!got);
    P().hurtT=0;V.setLastDmg({by:null,how:'lava'});V.damagePlayer(9);V.openModal('inv');
    ok('  ... takes no damage and opens no window',P().hp===20&&!P().dead&&!V.modalOpen()&&!V.getMODAL().kind);
    /* through the wall: the studio's wall is at x = o.x + 6 */
    for(let y=0;y<4;y++)for(let dz=-1;dz<=1;dz++)V.setBlock(o.x+3,o.y+y,o.z+dz,B.STONE);
    P().x=o.x+1.5;P().y=o.y+0.5;P().z=o.z+0.5;P().yaw=-Math.PI/2;P().pitch=0;V.KEY.KeyW=true;step(40);V.KEY.KeyW=false;
    ok('  ... and flies straight through a stone wall (x '+P().x.toFixed(1)+', the wall at '+(o.x+3)+')',P().x>o.x+4.2&&P().spec===true&&P().flying===true);}
  /* ===== 8 ===== */
  {const snap=JSON.parse(JSON.stringify(V.snapshot('core')));
    V.GR.difficulty='normal';P().spec=false;V.applySave(snap);step(30);
    ok('the save remembers: it holds the mark, and the world opens again as a DingleCore spectator',snap.player.spec===1&&V.GR.difficulty==='dinglecore'&&V.P.spec===true&&V.P.mode==='c'&&V.P.flying===true&&!V.P.dead);}
  V.specStop('s');
  ok('an operator\'s word puts a spectator back among the living (survival, not flying)',V.P.spec===false&&V.P.mode==='s'&&V.P.flying===false);
  V.GR.difficulty='normal';V.diffDeathUI();
  ok('a Normal world\'s death screen still offers Respawn, and no Spectate',shown('d_respawn')&&!shown('d_spec')&&/Quit to Title/.test(btn('d_title').textContent));
  /* ===== 9 ===== */
  {const cv=document.getElementById('stats');let rects=[];
    const g={fillStyle:'',clearRect(){rects=[];},fillRect(x,y,w,h){rects.push(this.fillStyle);}};cv.getContext=()=>g;cv.width=510;cv.height=36;
    V.P.mode='s';V.P.hp=20;V.GR.difficulty='normal';V.drawStats();const n=new Set(rects);
    V.GR.difficulty='dinglecore';V.drawStats();const c=new Set(rects);V.GR.difficulty='normal';
    ok('the DingleCore heart is its own drawing (a face in it), drawn in its own red only in a DingleCore world',
      V.PIX.core.join('|')!==V.PIX.heart.join('|')&&V.PIX.core.join('').includes('o')&&c.has('#b3122b')&&c.has('#2a0508')&&!n.has('#b3122b')&&n.has('#e23b3b'));}
});
