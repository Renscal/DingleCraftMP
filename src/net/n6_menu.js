/* ---- PART 58: n6_menu.js ---- */
/* The Multiplayer view of the title menu (#tmp in html/dom/title.html; the title's own code knows it as view 'mp' through
   tmEls in ui/p07g_title.js). The buttons are wired once, at load, by the block at the bottom, like every other panel. */

/* ----- the Multiplayer screen on the title ----- */
/* the address of the server that served this page. A page on plain http port 80 has no port in location.host, and a bare
   host would get the game's default port (ntUrl), so the 80 is spelled out; https needs nothing (wss, port 443). */
function ntHostHere(l){return l.host+(l.protocol==='http:'&&!l.port?':80':'');}
/* show the Multiplayer screen and prefill the address: this page's own server, else the last one used */
function ntOpenMenu(){
  if(typeof tmShow!=='function')return;
  tmShow('mp');
  const a=$('t_mp_addr');
  if(a&&!a.value){
    a.value=typeof location!=='undefined'&&/^https?:$/.test(location.protocol)&&location.host?ntHostHere(location):(NET.addr||'');
    if(!a.value){try{window.storage.get('vox_mp').then(r=>{if(r&&r.value&&!a.value){const o=JSON.parse(r.value);if(o&&o.addr)a.value=''+o.addr;}}).catch(()=>{});}catch(e){}}
  }
  const n=$('t_mp_name');if(n)n.textContent='You will join as '+PNAME+' (change your name in Settings).';
  ntStatus(NET.msg||'',true);
  try{if(a&&a.focus)a.focus();}catch(e){}
}
/* the Join Server button (and Enter in either field) */
function ntMenuGo(){
  const a=$('t_mp_addr'),p=$('t_mp_pw');
  ntConnect(a?a.value:'',p?p.value:'');
}
{
  const on=(id,f)=>{const b=$(id);if(b)b.onclick=f;};
  on('t_go_mp',()=>{ntOpenMenu();playS('click');});
  on('t_back_mp',()=>{if(NET.st==='connecting'){const ws=NET.ws;NET.ws=null;NET.st='off';NET.pend=null;if(ws){try{ws.onclose=null;ws.close();}catch(e){}}ntStatus('');}
    tmShow('main','t_go_mp');playS('click');});
  on('t_mp_go',()=>{ntMenuGo();playS('click');});
  for(const id of ['t_mp_addr','t_mp_pw']){const i=$(id);
    if(i&&i.addEventListener)i.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();ntMenuGo();}});}
}
