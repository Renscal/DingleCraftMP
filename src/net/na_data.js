/* ---- PART 58: na_data.js ---- */
/* What the world remembers (6.16). A save keeps a dozen things about the world that are not blocks: which villages,
   dungeons, parks and roosts have been found and populated, which dimension bosses are dead, where the spawners stand,
   where a mega nuke went off, what the stocks cost. On a server these used to live in each player's own game and be
   forgotten when they left, so a structure was populated again for every player and a dead boss came back.
   Now the server keeps them (data/ in the world folder) and every game works from the same lists:
     the lists (NT_WD)   Each game compares its own with what it last agreed on, once a second, and sends what is new
                         ({t:'wd', k, add, del}); the server merges, stores and passes it on; ntWdIn puts it into the
                         game's own sets. They only ever grow, except the spawners (a broken spawner is taken off).
     the stock market    On a server with its own game that game runs it (updateStocks) and announces the prices every 2
                         seconds ({t:'mkt'}); the players' games run none and show what they are told.
     the spawners        Likewise run by the server's game where it runs the world (tickSpawners returns at once on a
                         player's game there).
   Four things stay with the player and now travel with their save (n4_self.js, n1_link.js): the Snail, Malgorath, the
   old demon, and their own Creativity works. */

/* the lists that are the world's */
const NT_WD=['vseen','nseen','aseen','pseen','wdseen','lsseen','rseen','infkill','valkill','spw','nukes'];
/* the dimension a nuke record names, as a number in its key, and back */
const NT_NDIM=['over','nether','aether','puppet'];

/* one of the lists as this game has it right now, as an array of strings */
function ntWdGet(k){
  switch(k){
    case 'vseen':return [...VSEEN];
    case 'nseen':return [...NSEEN];
    case 'aseen':return [...ASEEN];
    case 'pseen':return [...PSEEN];
    case 'wdseen':return [...WDSEEN];
    case 'lsseen':return [...LSSEEN];
    case 'rseen':return [...RSEEN];
    case 'infkill':return [...INFKILL];
    case 'valkill':return [...VALKILL];
    case 'spw':return [...SPW.keys()];
    case 'nukes':return NUKES.map(n=>n.x+','+n.y+','+n.z+','+Math.max(0,NT_NDIM.indexOf(n.d)));
    default:return [];
  }
}
/* the Set behind a list, for the ones that are plain sets */
function ntWdSet(k){
  return k==='vseen'?VSEEN:k==='nseen'?NSEEN:k==='aseen'?ASEEN:k==='pseen'?PSEEN:k==='wdseen'?WDSEEN:k==='lsseen'?LSSEEN:k==='rseen'?RSEEN:k==='infkill'?INFKILL:k==='valkill'?VALKILL:null;
}
/* what the game agrees with the server on from here: called once the world is loaded */
function ntWdReset(){
  NET.wd={};NET.wdT=0;
  for(const k of NT_WD)NET.wd[k]=new Set(ntWdGet(k).map(String));
}
/* once a second: send what this game has learnt (and, for the spawners, lost) since */
function ntWdTick(){
  if(NET.acc-NET.wdT<1)return;
  NET.wdT=NET.acc;
  for(const k of NT_WD){
    const cur=new Set(ntWdGet(k).map(String)),last=NET.wd[k]||new Set(),add=[],del=[];
    for(const v of cur)if(!last.has(v))add.push(v);
    if(k==='spw')for(const v of last)if(!cur.has(v))del.push(v);
    if(!add.length&&!del.length)continue;
    NET.wd[k]=cur;
    ntSend({t:'wd',k,add:add.slice(0,200),del:del.slice(0,200)});
  }
}
/* {t:'wd'}: another game learnt something about the world */
function ntWdIn(m){
  const k=m.k;
  if(NT_WD.indexOf(k)<0)return;
  const last=NET.wd[k]||(NET.wd[k]=new Set()),S=ntWdSet(k);
  for(const v0 of (Array.isArray(m.add)?m.add:[])){
    const v=''+v0;
    last.add(v);
    if(S){if(!S.has(v0)&&!S.has(v))S.add(v0);}
    else if(k==='spw'){if(!SPW.has(v))SPW.set(v,1+Math.random()*2);}
    else if(k==='nukes'){
      const p=v.split(',').map(Number);
      if(p.length===4&&p.every(Number.isFinite)&&!NUKES.some(n=>n.x===p[0]&&n.y===p[1]&&n.z===p[2]&&n.d===NT_NDIM[p[3]|0]))NUKES.push({x:p[0],y:p[1],z:p[2],d:NT_NDIM[p[3]|0]||'over'});
    }
  }
  if(k==='spw')for(const v0 of (Array.isArray(m.del)?m.del:[])){const v=''+v0;last.delete(v);SPW.delete(v);}
}

/* ----- the stock market ----- */
/* on the server's game, every 2 seconds: what the stocks cost now */
function ntHostMkt(){
  if(NET.acc-NET.mktT<2)return;
  NET.mktT=NET.acc;
  const p={},mu={};
  for(const s of STOX){p[s]=+MKT.p[s].toFixed(3);mu[s]=+MKT.mu[s].toFixed(6);}
  ntSend({t:'mkt',p,mu});
}
/* {t:'mkt'}: the prices, from the server's game. They go into the chart like a tick of this game's own market would. */
function ntMktIn(m){
  if(!m.p||typeof m.p!=='object'||NET.host)return;
  for(const s of STOX){
    if(typeof m.p[s]!=='number'||!(m.p[s]>0))continue;
    MKT.p[s]=m.p[s];
    if(m.mu&&typeof m.mu[s]==='number')MKT.mu[s]=m.mu[s];
    const h=MKT.h[s]||(MKT.h[s]=[]);h.push(MKT.p[s]);if(h.length>64)h.shift();
  }
  if(typeof pcOpen!=='undefined'&&pcOpen&&typeof renderPC==='function')renderPC();
}
