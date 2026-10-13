/* ---- PART 58: n0_contract.js ---- */
/* ===================================================================== */
/* PART 58 — MULTIPLAYER (v6.10, Release 1.1)                            */
/* A client for server/dinglecraft-server.mjs. The server keeps one      */
/* world: the seed, the game rules, the time of day, every block edit,   */
/* every chest and furnace, and each player (inventory, position) by     */
/* name, and every dropped item (who picks one up is the server's call). */
/* It relays positions, chat and hits, and checks what it can (reach,    */
/* rights, who holds a chest). It does not run the game: an ordinary mob */
/* is run by the game of the player nearest to it and shown to the       */
/* others (n7_mobs.js): since 6.11 that includes the villagers, the Nuke */
/* Kegs and the dungeon, titan and dimension bosses. Dragons, snakes,    */
/* blocklings and the casts of Purgatory and Malgorath stay local to     */
/* each player's own game. A vehicle is seen under the player riding it; */
/* a parked one is still each player's own.                              */
/*                                                                       */
/* The files (src/net/, in load order):                                  */
/*   n0_contract.js  this file: the protocol number, the NET state, the  */
/*                   test exports (NTEX), the map of everything          */
/*   n1_link.js      the connection: connect, leave, reconnect, every    */
/*                   incoming message (ntMsg), entering the world        */
/*   n2_world.js     block edits and block entities (chests, furnaces)   */
/*   n3_drops.js     dropped items                                       */
/*   n4_self.js      this player: save, pose, chat, death, the heartbeat */
/*                   and the per-frame tick (ntFrame)                    */
/*   n5_players.js   the other players: bodies, armour, what they ride,  */
/*                   name tags, the Tab list (with ping), melee hits     */
/*   n6_menu.js      the Multiplayer screen on the title                 */
/*   n7_mobs.js      shared mobs, and explosions that reach other players*/
/*   n8_host.js      the server's own game (6.13): it runs the Overworld */
/*                   mobs; the players' games only draw them             */
/*   n9_ents.js      what flies (seen by everyone, 6.14) and what you    */
/*                   ride (kept by the server's game, 6.14)              */
/*   na_data.js      what the world remembers (6.16): found structures,  */
/*                   dead bosses, spawners, nukes, the stock market      */
/*                                                                       */
/* Load rules: PART 58 loads before PARTs 57-54, so their names are      */
/* runtime-only here (typeof-guarded). No THREE constructor, clock,      */
/* random number or socket at load time: everything starts in ntConnect. */
/* Names: nt* / NET / NT_* / NTEX only.                                  */
/*                                                                       */
/* Core hooks (all behind NET.on, so single player is untouched):        */
/*   setBlock -> ntEdit            saveToStorage -> ntSave               */
/*   quitToTitle -> ntLeave        frame -> ntFrame                      */
/*   doMine -> ntMelee             die -> ntDied                         */
/*   chatSubmit -> ntChat          renderTab -> ntTabRows                */
/*   spawnDrop -> ntDropSpawned    updateDrop -> ntDropTake              */
/*   chatSubmit -> ntCmd (a slash command goes to the server)            */
/*   doSleep -> ntSleep            openModal -> ntBeAsk (chest locks)    */
/*   doMine, doUse -> ntGuard (spawn protection)                         */
/*   updateEntities -> ntMobPup    hurtMob -> ntMobHit                   */
/*   explode -> ntBoom             tickFlow -> ntSimHere                 */
/*   updateArrow, updateBullet -> ntShot                                 */
/*   (and three guards: stashEnts skips e.nid and e.pup, drops do not    */
/*   merge online)                                                       */
/* Hooks for the server's own game (behind NET.host, n8_host.js):        */
/*   damagePlayer -> ntHostHurt    updateEntities -> ntHostAim           */
/*   mobFarFromAll -> ntHostFar    mobClearOfPlayers -> ntHostClear      */
/*   countMobs -> ntHostNear       mobsTick -> ntHosted (a player's game */
/*   spawns nothing natural where the server does)                       */
/* And two for n9_ents.js: updateEntities -> ntEntPup (behind e.pup),    */
/*   hitCar -> ntVehHit (behind e.pup)                                   */
/* And four for the world the server runs (6.15, behind NET.on):         */
/*   checkFalling -> ntHosted      igniteAt -> ntIgnite                  */
/*   updateFires -> ntHosted       furnaceTick -> ntNoTick               */
/*   tickSpawners -> ntHosted      updateStocks -> NET.hosted (6.16)     */
/*                                                                       */
/* Protocol: JSON text frames over one WebSocket, {t:'<type>', ...}.     */
/*   client -> server: hello pose rd edits open close be drop dropAt     */
/*                     take chat cmd hit save spawn time gr sleep death  */
/*                     mobs mgone mgive mhit boom ping fx fxgone vehs    */
/*                     vgive vtake vfree vgone vhit ign wd               */
/*   the server's game -> server, also: mkt                              */
/*   the server's game -> server, also: hurt xp hsnap                    */
/*   server -> client: welcome perm edits bes drops ready (the join),    */
/*                     then join leave pose edits be lock drop undrop    */
/*                     took chat sys hit time gr kick tp give mode perm  */
/*                     mobs mgone mgive mhit boom pong mheir hurt xp     */
/*                     fx fxgone vehs vgone vno vhit fire wd mkt         */
/* Messages are compressed by the browser and the server between them    */
/* (permessage-deflate); nothing here knows about it.                    */
/* NT_PROTO must equal PROTO in the server (tests/net/n_static.js).      */
/* ===================================================================== */
const NT_PROTO=3,NT_PORT=40162;
/* All multiplayer state, in one object:
     on      true while playing on a server (every core hook checks this)
     st      'off' | 'connecting' | 'on'          ws    the WebSocket
     id name this player on the server            server pvp motd   what the welcome said
     ap      true while a block edit from another player is being applied (so it is not sent back, and makes no drops)
     apd     the same on the server's own game, where only the drops are held back: what the edit sets off does go out
     pend    the world while it is still arriving (between welcome and ready), else null
     why     the reason for the next disconnect (a kick message), shown on the title
     peers   id -> the other players (n5_players.js)
     drops   id -> every dropped item the server knows (n3_drops.js); dropIn / dseq / dim belong to it
     q       block edits waiting to be sent (n2_world.js)      beS   block-entity key -> last sent signature
     acc     seconds played on this server (the clock for the timers below)
     poseT poseS scanT   when the pose was last sent, what it was, when the once-a-second scans last ran
     grS     the game rules as last agreed with the server (JSON)      tPrev  the time of day last frame
     stats   message and edit counters (the suites read them)
     op prot spawn   this player's rights: an operator, the radius of the protected spawn area (0: none), the world spawn
     lockK lockWant  the chest or furnace this player holds open on the server, and the one being asked for
     saveT   when the next "save soon" is due (-1: none)         rdS   the draw distance as last told to the server
     mobs    id -> every shared mob this game knows, its own and other players' (n7_mobs.js); mseq mobT ownT belong to it
     dmgRef  the last damage record from before the current hurt (so a death can tell what caused it)   guardT  toast timer
     pw      the password last used (memory only, for reconnecting)   retryN retryH   the reconnect attempt number and its timer
     pingT pingN pingAt ms   the heartbeat: when the last ping went (NET.acc), its number, when it went (wall clock), the last
             round trip in milliseconds      rxAt    when the last message arrived (wall clock): silence means the line is dead
     act     this player's own hand is about to change a block (set by ntGuard, spent by ntEdit): others hear and see that one
     hosted  the server runs the Overworld's mobs (the welcome said so)      host   this game IS the server's (n8_host.js)
     hp0 hpl hrr hsnT hchT   the host's own: its idle P, the players as stand-ins this tick, whose turn it is to be spawned
             for, when the mobs were last reported for saving, when the chunks were last trimmed */

const NET={on:false,st:'off',ws:null,id:0,name:'',server:'',pvp:true,ap:false,pend:null,why:'',
  peers:new Map(),drops:new Map(),dropIn:false,dseq:0,dim:'over',q:[],acc:0,poseT:0,poseS:'',scanT:0,beS:new Map(),grS:'',tPrev:0,tSet:false,stats:{in:0,out:0,edIn:0,edOut:0},
  op:false,prot:0,spawn:null,lockK:null,lockWant:null,saveT:-1,rdS:0,mobs:new Map(),mseq:0,mobT:0,ownT:0,dmgRef:null,guardT:-9,
  pw:'',retryN:0,retryH:0,pingT:0,pingN:0,pingAt:0,ms:0,rxAt:0,act:false,
  hosted:false,host:false,hp0:null,hpl:[],hrr:0,hsnT:0,hchT:0,
  fx:new Map(),fseq:0,vehs:new Map(),vseq:0,vehT:0,ignQ:[],fbT:0,apd:false,
  wd:{},wdT:0,mktT:0};   /* na_data.js: each world list as last agreed with the server, the timers for them and for the market */   /* ignQ: cells to light (to the server's game) or lit (to the players); fbT: the host's furnace report timer */   /* n9_ents.js: flying things and vehicles by id, their counters, the vehicle timer */

/* everything the suites reach, spread into window.__vox by src/boot/export_boot.js */

const NTEX={NET,NT_PROTO,NT_PORT,ntUrl,ntConnect,ntLeave,ntDown,ntMsg,ntSend,ntEnter,ntEdit,ntFlush,ntApplyEdit,ntApplyBE,ntBeScan,ntBeSig,
  ntSave,ntPoseNow,ntFrame,ntPeerAdd,ntPeerDel,ntPeersTick,ntMelee,ntTabRows,ntOpenMenu,ntHash,ntHostHere,ntDropSpawned,ntDropTake,ntDropsScan,ntDropIn,ntDropGone,ntDropTook,
  ntCmd,ntSleep,ntBeAsk,ntLockMsg,ntLockTick,ntGuard,ntSaveSoon,ntSimHere,ntShot,ntMobShared,ntMobsTick,ntMobsIn,ntMobsGone,ntMobTaken,ntMobHurt,ntMobHit,ntMobPup,ntBoom,ntBoomIn,
  ntRetry,ntRetryStop,ntPing,ntMobAdopt,ntPeerArmor,ntPeerRide,ntMobState,ntMobTwin,
  ntHosted,ntHostStart,ntHostTick,ntHostSnap,ntHostPlayers,ntHostAim,ntHostHurt,ntMobFull,
  ntFxTick,ntFxIn,ntFxGone,ntFxPup,ntVehTick,ntVehsIn,ntVehsGone,ntVehHit,ntVehPup,ntEntPup,ntHostVehSnap,
  spawnArrow,spawnBoat,hitCar,ntIgnite,ntFireIn,ntNoTick,ntHostBeScan,checkFalling,igniteAt,updateFires,furnaceTick,tickFlow,getFires:()=>fires,
  ntWdGet,ntWdTick,ntWdIn,ntWdReset,ntMktIn,ntHostMkt,tickSpawners,updateStocks,getMKT:()=>MKT,getSPW:()=>SPW,getNUKES:()=>NUKES,getVSEEN:()=>VSEEN,getINFKILL:()=>INFKILL};   /* three core names the suites need to shoot, launch and hit with */
