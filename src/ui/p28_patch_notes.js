/* PART 28 — patch notes (data only since Release 1.0)
   The in-game patch-notes screen was retired in Release 1.0: its buttons stay in the DOM, hidden, so old saves and the
   frozen core suite keep working, but players never see it. PATCH_LOG still feeds CHANGELOG.md (scripts/changelog.mjs)
   and the release tooling. Data-driven off GAME_VERSION so it can't drift from the shipped build. */
const PATCH_LOG=[
 {v:GAME_VERSION,label:RELEASE_LABEL,title:'Hands on the inventory',lines:[
    'HANDS ON THE INVENTORY. One click per slot was honest work. Now the mouse does what your hands expect.',
    'Hold a stack and drag left across empty slots: it is shared out evenly, and you watch the numbers as you go. Drag right: one item in each slot you cross, and another every time you cross it again.',
    'Double-click while holding a stack and every matching item in the window jumps onto it, part stacks first.',
    'Start a left drag on a slot that holds the same item and it gathers instead of sharing: every such slot you cross is pulled onto your cursor. With Shift, each is sent to the other side.',
    'Shift and drag with an empty hand: every slot you cross is quick-moved. Emptying a chest is now one sweep.',
    'The wheel: scroll down over a stack to send items out one at a time, scroll up to bring matching ones in.',
    'Over any slot: 1 to 9 swaps it with that hotbar slot, Q throws one, Ctrl+Q throws the stack. Click outside the window with a stack in hand to throw it (right click throws one).',
    'Creative: middle click gives a full stack of whatever you point at.',
    'Fixed along the way: right-clicking an enchanted item out of a slot used to quietly wipe the enchantment.',
  ]},
 {v:'6.22',label:'Release 1.1',title:'The debug screen',lines:[
    'THE DEBUG SCREEN. F3 used to say five things. It now says where you are to three decimals, which block that is, which way you face, your chunk, your section and your spot inside it, the biome, how much memory the game is using, and the local difficulty.',
    'Local difficulty is counted the usual way: the longer a world has been played and the longer anyone has stood in a chunk, the higher it climbs. It is only a number for now. Nothing spawns by it.',
    'F3 + B draws a box round everything that has one: mobs, dropped items, vehicles, other players. Mobs and players get a little line showing which way they face.',
    'F3 + G draws the borders of your chunk, with a ring every 16 blocks up, and the corners of the chunks around it.',
    'F3 now acts when you let go of it, so the combos do not flick the screen on and off.',
  ]},
 {v:'6.21',label:'Release 1.1',title:'Throw it and wait',lines:[
    'THROW IT AND WAIT. Press Q and the item used to bounce off the ground and straight back into your pocket, which made giving anybody anything a small comedy.',
    'Now the thrower waits 2 seconds before they can pick their own throw back up. Everybody else can grab it as fast as ever.',
    'Only throws count. What a broken block drops, what a mob leaves and what you spill when you die behave as before.',
    'On a server the server keeps the same clock, so nobody argues their way round it.',
  ]},
 {v:'6.20',label:'Release 1.1',title:'Looking up from underwater',lines:[
    'LOOKING UP FROM UNDERWATER. Dive in, look up, and there used to be nothing: the surface of the water was only painted on its top side, so from below the lake had no lid.',
    'Water now has both sides. The surface is there from underneath, and the wall of a waterfall is there when you look out of it.',
  ]},
 {v:'6.19',label:'Release 1.1',title:'No more tool swapping',lines:[
    'NO MORE TOOL SWAPPING. You could start a block with your good pickaxe, flick to an empty hand just before it broke, and let your bare knuckles take the wear. Or do it the other way round and borrow a diamond pick for the last tenth of a second.',
    'Not any more. Change the slot, or what is in your hand, and the block starts over with whatever you are holding now. The tool that breaks a block is the tool that did the whole job, and it pays for it.',
    'Mining without swapping costs exactly the time and the wear it always did.',
  ]},
 {v:'6.18',label:'Release 1.1',title:'A server is a server',lines:[
    'A SERVER IS A SERVER. Open a server&#x27;s address and the game you get is that server&#x27;s game: Multiplayer, and nothing else to click by mistake. Create New World, Load World, Continue and Import World are gone from it.',
    'Single player has not gone anywhere. It lives in the game itself: the html opened from a file, or the desktop client. Same game, same worlds, same everything.',
    'One catch, and it is a real one: a browser keeps worlds per address. If you made single-player worlds at a server&#x27;s address before, they are still in your browser, untouched, but that page no longer opens them. The server owner can switch the old page back on (singlePlayer in server.json) long enough for you to Export World.',
  ]},
 {v:'6.17',label:'Release 1.1',title:'Every dimension',lines:[
    'EVERY DIMENSION. The server now runs the Nether and the Aether the way it runs the Overworld: its own mobs, water, fire, falling blocks, spawners and vehicles, saved with the world.',
    'Each dimension gets its own copy of the game on the server, woken the moment the first of you steps through a portal. Imps no longer depend on whose computer is nearest.',
    'Mobs stay in their dimension, and so do their save files: server owners will find entities/nether next to entities/over.',
    'Puppet Purgatory is still yours alone. It was built around one player&#x27;s suffering and it would be rude to share.',
    'Server owners: each dimension somebody has visited since the server started costs about another 110 MB.',
  ]},
 {v:'6.16',label:'Release 1.1',title:'The world remembers',lines:[
    'THE WORLD REMEMBERS. A server used to forget everything about its world that was not a block. Which villages had been found, which bosses were dead, what the stocks cost: all of it lived in each player&#x27;s game and left when they did.',
    'Now the server keeps it. A village one of you finds is found for all of you, and is populated once. A dimension boss you kill stays dead for the friend who logs in tomorrow.',
    'ONE STOCK MARKET. The server runs it and everyone sees the same prices. Your shares and your balance are still yours. Yes, this means you can no longer both be right about the price of anything.',
    'Spawners are run by the server too, once, not once per bystander.',
    'What is yours stays yours: the Snail, your business with Malgorath, and your own paintings and songs now travel with your player. Until now a painting did not survive leaving the server. Sorry about that.',
    'Server owners: a new data folder in the world holds all of this, a readable file each.',
  ]},
 {v:'6.15',label:'Release 1.1',title:'The server runs the water',lines:[
    'THE SERVER RUNS THE WATER. And the fire. And the sand. In the Overworld of a server that plays along, those are now the server&#x27;s business and happen exactly once.',
    'Water: poured by you, flowed by the server. No more two games arguing about where the puddle ends.',
    'Sand and gravel: dig under it and the server drops it. Everyone watches it fall. Nobody gets a bonus sand item because three people were standing nearby.',
    'Fire: your fireball asks, the server lights. Everybody sees the flames, everybody standing in them regrets it, and each tree burns down once.',
    'Furnaces keep cooking when you walk away, when you log off, and when nobody is anywhere near them. One game cooks each furnace: yours while you have it open, the server&#x27;s the rest of the time.',
    'Loot is rolled once. A chest the world already knows can only be changed by the player who has it open, so the next visitor&#x27;s game can no longer refill a dungeon chest with treasure of its own invention.',
    'Other dimensions still do all this the old way.',
  ]},
 {v:'6.14',label:'Release 1.1',title:'Everyone sees it fly',lines:[
    'EVERYONE SEES IT FLY. Arrows, bullets, grenades, lit TNT, a boss&#x27;s rocks and fireballs, XP orbs: other players now see them in the air. Until now your friend&#x27;s arrow was a rumour and a skeleton&#x27;s was an injury with no warning.',
    'What you see is a copy. The real one still lives in the game that shot it, which alone decides what it hits. The copy looks the same and touches nothing.',
    'VEHICLES BELONG TO THE WORLD. On a server that runs its own game, a car, boat, plane, cart or skateboard you put down in the Overworld stays there for everyone, and is still there after a restart.',
    'Get on and it is yours for the ride, driven by your own game so it feels as it always did. If someone is already driving it you are told so. Get off and the server has it back.',
    'Break a parked car and it breaks for everybody, once, and drops one car. No more private parking.',
    'Server owners: the entities folder now lists vehicles next to the mobs and the dropped items.',
    'Still each player&#x27;s own: vehicles outside the Overworld, and everything in Purgatory and at Malgorath&#x27;s.',
  ]},
 {v:'6.13',label:'Release 1.1',title:'The server runs the mobs',lines:[
    'THE SERVER RUNS THE MOBS. Until now a mob on a server lived in whichever player&#x27;s game happened to be closest. Now the server plays the game too, without a screen, and every zombie, pig, villager, Nuke Keg and boss in the Overworld is its own.',
    'What you notice: mobs keep moving while you sit in a menu. They no longer hiccup when you and a friend swap places. A village has one set of villagers no matter how many of you walk in.',
    'Mobs are saved with the world. Stop the server, start it again, and the villager called Zorp is standing where you left him. Server owners can read the whole census in the entities folder.',
    'Spawn eggs, critter jars, spawners and the pig cannon all hand their mob to the server the instant it appears. The pig keeps its speed.',
    'A mob hits you through your own game, so your armour still counts and the death message still knows who did it.',
    'Server owners: this costs about 110 MB of memory. Set simulate to false in server.json to go back to the old way.',
    'Only the Overworld for now. The Nether, the Aether and Purgatory still work the old way, and so do arrows, vehicles and water. Those are next.',
  ]},
 {v:'6.12',label:'Release 1.1',title:'The world is a folder',lines:[
    'THE WORLD IS A FOLDER. Server owners: the one big world file is gone. A world is now a folder you can open and read, laid out like a certain other block game: level.json, region, entities, playerdata.',
    'region holds the changed blocks, chests and furnaces, 512 by 512 blocks to a file, each file named after its place in the world. entities holds what is lying around in that region. playerdata has one file per player who ever joined: where they are, their health, hunger, spawn point and every slot of their inventory, one per line.',
    'Saving writes only the files that changed. A big world no longer rewrites itself in full every 30 seconds because somebody placed a torch.',
    'Your old world.vxw.json is converted on the first start and left where it was, untouched, in case you want it back.',
    'New command for operators: /export writes the whole world as one file again, for taking it back to single player.',
    'Nothing changes for players. This is the ground floor for the next step: the server running the world itself.',
  ]},
 {v:'6.11',label:'Release 1.1',title:'Multiplayer, tightened',lines:[
    'MULTIPLAYER, TIGHTENED. Same server, fewer ways for it to let you down. Needs the 6.11 server: a 6.10 game and a 6.11 server politely refuse each other.',
    'Lost your connection? The game now tries to get back in by itself: five tries over about 25 seconds, and you come back where the server last saw you, not where you last saved. Kicks, bans and shutdowns are still final.',
    'A heartbeat every 2 seconds: the game notices a dead line in 12 seconds and the server gives up on a silent player after 20 (it used to be 45). Hold TAB to see everyone&#x27;s ping.',
    'Other players now wear their armour where you can see it, in the right metal, and when they drive past you there is a car under them. Also boats, planes, carts and skateboards.',
    'You hear your friends dig. A block placed or broken by another player nearby comes with its sound and its dust. Water going about its business stays quiet.',
    'Villagers, Nuke Kegs, the dungeon boss, the Stone Titan and the Nether and Aether bosses are shared: everybody sees the same one and can hit it. A boss fights the player whose game is running it. A village no longer comes with one set of villagers per visitor.',
    'When a player leaves or drops, the mobs their game was running are handed to whoever is nearest. They used to vanish.',
    'The server compresses what it sends, and sends chests and dropped items for the area around you, not for the whole world. Joining a big world is quicker.',
    'Server owners: optional TLS (cert and key in server.json, then it is https and wss), an origins list for who may connect, and a limit on how fast any one player may send anything. Flooders are shown the door.',
    'Still each player&#x27;s own: dragons, parked vehicles, what a boss throws at you, and the casts of Purgatory and Malgorath.',
  ]},
 {v:'6.10',label:'Release 1.1',title:'Multiplayer',lines:[
    'MULTIPLAYER. Other people. In your world. On purpose.',
    'Main menu: Multiplayer. Type a server address, press Join Server, and you are standing next to your friends, who each get their own shirt colour and their name floating over their head.',
    'Shared with everyone: every block placed or broken (in every dimension), chests and furnaces, dropped items, chat, the player list (hold TAB), the time of day, sleeping through the night and the game rules.',
    'The server remembers you by name: your inventory, armour, XP, Dingle Bucks and where you were standing are all waiting when you come back.',
    'You can punch each other. Swords count, and so do arrows, bullets and TNT. The server checks you were actually close enough, and the server owner can switch the whole thing off, and probably will.',
    'Dropped items are real for everyone: throw your friend a sword, loot the pile where they died, and when two of you dive for the same diamond the server picks exactly one winner.',
    'MOBS ARE SHARED. The zombie chasing your friend is the same zombie you can see, hit and loot. Each ordinary mob (zombies, skeletons, boomers, spiders, pigs, cows, sheep and the Nether and Aether locals) is run by the game of whoever is nearest and goes after them, and quietly changes hands when someone else gets closer.',
    'Sleeping is a vote now: the night is skipped when everyone is in bed (the server owner picks the percentage). One person in pyjamas no longer decides for the group.',
    'Chests and furnaces are one player at a time. If your friend is in it, you are told so, and nobody&#x27;s diamonds get eaten by a race.',
    'OPERATORS AND COMMANDS: the server owner can make players operators. Type / in chat: /tp, /give, /gamemode (per player), /time, /gamerule, /kick, /ban, /whitelist, /setworldspawn, plus /msg, /me, /list and /help for everyone.',
    'New players start at one world spawn, and on a server with operators the blocks around it are protected from everyone else.',
    'Death messages are written by the server and say what happened. You fell from a high place. You tried to swim in lava. You were slain by your so-called friend.',
    'Reconnecting after your wifi hiccups gives you your own name and inventory back instead of a stranger called You_2.',
    'Quietly better: big worlds join faster (the server sends the chunks around you and the rest as you travel), water is flowed by one game instead of all of them, and dropped items no longer age while the server is empty.',
    'Still your own: vehicles, bosses, dragons, villagers, the Purgatory and Malgorath casts and the AI players are played by each player&#x27;s own game and are not shared yet.',
    'Hosting: the new server/ folder has the server (nothing to install, it needs only Node.js). On Windows, double-click Start Server.bat. It keeps the world, saves it every 30 seconds, hands the game to anyone who opens its address in a browser, and can host a world you exported from single player.',
    'THE AI PLAYERS HAVE LOGGED OFF. BunkerBrad, xx_lilcreepah_xx and honeybee_mc have left the building, taking their brain server, their grudges and their bunker with them. You have real friends now. Old worlds still load; the three of them are simply not in them. The chat box, the player list and the Player Compass stay, and the compass now points at actual people.',
    'Single player is otherwise exactly as it was. Server worlds never touch your saved worlds.',
  ]},
 {v:'6.9',label:'Release 1.0',title:'Replays',lines:[
    'REPLAYS: the game keeps your last 30 seconds ready. Press F8 and it saves as an MP4 video, sound, records and paintings included. Turn it on or off in Settings.',
    'SCREENSHOTS: F2 saves a picture (PNG).',
    'First launch says hello: share your best moments on r/DanDingle.',
    'Main menu: Controls (just the controls now), an r/DanDingle button and a separate Credits screen.',
    'The menu music is half as loud, and Load World no longer shows a count.',
  ]},
 {v:'6.8',label:'Release 1.0',title:'Release 1.0 (final cut)',lines:[
    'Final cut of Release 1.0. Two of the things that stalk the night have moved out for good, and the whispers come ten times less often.',
  ]},
 {v:'6.7',label:'Release 1.0',title:'Release 1.0',lines:[
    'RELEASE 1.0. The proper one.',
    'A new title screen: a sharp 360 panorama of a real world, turning slowly on the spot like it should, with its own menu music (BATEHOVEN IS HALOUS).',
    'Create New World now has game rules: Keep Inventory, Mob Griefing, Peaceful, Fire Tick, The Eternal Snail, Guilt Ghosts, the Fullbright toggle, AI Players, the Dingle Store, Superpowers and Cheats. Cheats decide whether the debug menu exists at all.',
    'A warning on Create New World: worlds live in your browser, so clearing your history deletes them. Export often.',
    'Export World moved to the pause menu, right under Save World.',
    'Settings: Field of View, Mouse Sensitivity, Sound volume and Music volume sliders.',
    'Fixed the oldest bug in the game: picking something up now updates your hotbar straight away (and finally makes the pickup pop).',
    'First launch asks for your name. Type anything. Chat, the player list and the AI players all use it (change it any time in Settings).',
    'Right-click a saved world in Load World to change all of its game rules before you load it.',
    'No internet needed: everything the game needs is baked into the file now.',
    'Patch notes are retired. This is the last one. Enjoy it.',
  ]},
 {v:'6.6',label:'Release 1.0',title:'Release 1.0 (second cut)',lines:[
    'Second cut of Release 1.0: the sharp, always-turning title panorama.',
  ]},
 {v:'6.5',label:'Release 1.0',title:'Release 1.0 (first cut)',lines:[
    'First cut of Release 1.0. The same night, 6.6 made the title panorama sharp and keeps it turning.',
  ]},
 {v:'6.4',label:'Release 1.0 Preview',title:'Under New Management',lines:[
    'RELEASE 1.0. UNDER NEW MANAGEMENT. The purgatory theatre has changed hands. The new owners kept the building, let the entire cast go and hired the cheapest touring company they could find. It is now called Puppet Purgatory.',
    'Now headlining: THE DEMOLITIONIST (bomb suit, plunger, no hobbies), THE PIG (a very large pig with a very large ego) and, closing the show, THE MANAGEMENT.',
    'The supporting cast works for scale and nobody will tell you where it was hired. Go and meet them. Bring tomatoes.',
    'Your progress transfers to the new production. Kills, trunks, souvenirs and Programme ticks from older saves all load with the new names on them. Once a world has been opened in Release 1.0, keep it on Release 1.0.',
    'Elsewhere: the green walking bombs are now NUKE KEGS (gunpowder barrels on legs, same fuse, same crater). Mobs are now caught in a CRITTER JAR. The fortune ball is now a FORTUNE ORB with exactly the same attitude. The Gaming Rig now runs DEEP DIRT 2D, the cinema is showing ASTEROID ALLEY, and MALGORATH has a new title: THE WORLD-EATER.',
    'The Dingle Exchange now lists made-up companies only. Old portfolios were converted share for share, so nobody lost a diamond.',
    'Dan has a new outfit (orange and charcoal), and the zombies got new old clothes. In Hyperreal the aliens look like aliens again, and the boomers are walking powder kegs too: eye holes, a burnt grin, a fuse that spits sparks and a freshly packed gunpowder sac behind the chest doors.',
    'A few sound effects that only ever worked on one computer now use the in-engine versions for everyone.',
    'NEW TITLE SCREEN: the logo is big and proud, a floating island turns slowly behind it, and every button is chunky, clicky and works from the keyboard (arrow keys, Enter, Esc). Everything else got BIGGER too: the HUD, every menu, chat, the help book and these very patch notes. New in Settings: UI SCALE (Auto, 100%, 125%, 150% or 200%). Auto picks a size that suits your screen, and icons stay pixel-sharp at every size.',
    'Deleting a saved world now takes two clicks, and What’s New finally opens in front of the title screen instead of behind it. Toasts no longer land on top of whatever menu you have open, and F3 and the player list (hold Tab) keep out of the way of the boss bars, the chat and the compass.',
    'Under the hood: 3,773 checks (3,512 in the game suites, 261 in the tools), including test.js 69, smoke.js 221 (x6) and botsmoke.js 199 (x3). Every suite from the last release, an originality scan over every file, checks for every recast model, texture and old save, a privacy scan and a UI scale suite. All green.',
  ]},
 {v:'6.3',title:'The Malgorath Update',lines:[
    'v6.3 THE MALGORATH UPDATE. MALGORATH has been rebuilt from the bones up. Same address: X 1000, Z 1000. Different appetite.',
    'Whatever you remember about his arena, forget it. Something has taken a bite out of the world out there, and it is still chewing. Go and look over the edge. Then decide whether to poke anything.',
    'He is sixteen metres of hand-sculpted, wildly over-detailed demon in a world made of 16 pixel cubes, and the last world he ate is still stuck to his back. In Hyperreal he is now the most expensive-looking thing in the game by a distance.',
    'He is hard. Properly hard. Bring your best armour, your best sword and a lot of steak. In testing, a robot in full diamond with a Sharpness V sword beat him in eleven worlds out of twelve and died along the way in most of them. A robot in dragon armour that just stood there and swung lasted under a minute, every single time.',
    'He learns. So will you. When he kills you, you start again further along than you think.',
    'Beat him and he leaves you something to remember him by. It bites.',
    'Killed the old one in an old world? He remembers. He comes back anyway.',
    'If an old world of yours has anything built near X 1000, Z 1000, it has been cleared away. Anything that was in a chest there is waiting for you at the top of the stairs.',
    'Full disclosure: nobody here has heard a single note of his music or one of his sound effects. A computer measured every one of them (pitch, tempo, loudness, clicks) and swears they are horrible in the right way. Debug menu, Malgorath: sounds plays the lot. If anything sounds off, say so.',
    'Once a world has been opened in v6.3, keep it on v6.3. Older versions remember the old arena and do not know what he left you.',
    'Under the hood: test.js 69, smoke.js 221 (x6), botsmoke.js 199 (x3), every texture-pack, purgatory and creativity suite, thirteen new Malgorath suites (540 checks, including a fight harness that proves a skilled player can win and a careless one cannot) and two new og_trace sessions proving the rest of the world has not changed. All green.',
  ]},
 {v:'6.2',title:'The Creativity Update',lines:[
    'v6.2 THE CREATIVITY UPDATE. You can now make art. Actual art, signed by you, one of a kind, hanging next to the hole a Nuke Keg left in your wall.',
    'EASELS. Craft one (a stick frame around a block of wool), put it down and right-click it. Pick a canvas: Square 64x64, Wide 128x64 or Tall 64x128. Then paint with 24 colours, a pencil, an eraser, a fill bucket, an eyedropper and three brush sizes. Right-click erases with any tool, Ctrl+Z undoes, and every tool has a keyboard shortcut for the professionals.',
    'Walk away whenever you like. The easel keeps your painting exactly where you left it, through saves, deaths and the occasional nuke. Break the easel and the unfinished canvas pops out so you can carry it to another one.',
    'Press Done, give it a title and you get THE painting. Not a copy: there is only ever one. Hang it on any wall (2x2, 4x2 or 2x4 blocks), take it down, move house, hang it again. It is the same painting forever, with crisp pixels in OG and in Hyperreal.',
    'RECORD PLAYERS. Craft one (stick, iron ingot, stick over three planks) and build a song on a step grid: up to six tracks of piano, bass, lead synth, pluck guitar, bells and a four-piece drum kit. Click a square for a note, drag right to hold it, Space to play. Tempo, bars, key, octave and volume are one click away. Every row is in C major, so you cannot play a wrong note. You can still write a bad song. That part is on you.',
    'Press Done and the record player presses a music disc. Also the only one in existence.',
    'JUKEBOXES. Eight planks around a diamond, as tradition demands. Put a disc in and it loops for everyone nearby, louder as you walk up and coming from where the jukebox actually is, while the background music politely steps outside. Right-click again to get your disc back. Break the jukebox and the disc drops. Nothing you make gets lost by accident.',
    'Paintings and discs survive everything: chests, deaths far from home, saves, the Nether, the Big Dingle and a trip to Puppet Purgatory (they wait in your trunk, the frog has no taste in art). Drop one on the far side of the map and it waits right where it fell. BunkerBrad, xx_lilcreepah_xx and honeybee_mc will admire your work from a respectful distance. They will not touch it. We checked.',
    'Full disclosure: nobody here has actually heard the music. A computer listened very carefully, swears every note is in tune and on time, decided the bells were too loud (turned down) and gave the kick drum enough punch for laptop speakers. If anything else sounds off, say so.',
    'One warning: once a world has been opened in v6.2, keep it on v6.2. Older versions do not know what a painting is and forget them when they save. If it happens anyway, the lost ones turn up as Lost Works instead of breaking anything.',
    'Under the hood: test.js 69, smoke.js 221 (x6), botsmoke.js 199 (x3), every texture-pack and purgatory suite, seven new creativity suites (415 checks, including an offline ear that measures every note) and two new og_trace sessions proving nothing changes until you craft something. All green.',
  ]},
 {v:'6.1',title:'Puppet Purgatory',lines:[
    'v6.1 PUPPET PURGATORY. Somewhere in your world a door has appeared. Three headliners, one way out. Tune the structure compass to Stage Door, or survive 10 minutes.',
    'There is a frog on a stool beside it. It wants an empty hand. Everything you carry waits outside in a trunk with your name on it. BunkerBrad, xx_lilcreepah_xx and honeybee_mc go in with nothing too, and they want out as badly as you do.',
    'Inside is a whole new dimension: new ground, new ores, new tools, new food, new crafting, new monsters. Nothing from your world works in there, and nothing from in there comes home except three souvenirs.',
    'You are handed a Programme. Right-click it. The printed copy is very cheerful. Trust the handwriting in the margins.',
    'The Demolitionist, the Pig and the Management are headlining. Beat all three and find the EXIT. It is through the audience.',
    'Works in both texture packs: OG gets the full licensed-PC-game-from-1997 treatment, Hyperreal gets the flash photographs. The file is now about 40 MB.',
    'Under the hood: test.js 69, smoke.js 221 (x6), botsmoke.js 199 (x3), every texture-pack suite, ten new purgatory suites (over 1,000 checks) and a pilot that plays the whole thing from the door to the EXIT in about 31 minutes without a single free item. All green.',
  ]},
 {v:'6.0',title:'Hyperreal',lines:[
    'New in Settings: TEXTURE PACK. OG is the game you know, 16px, exactly as it was. HYPERREAL replaces every block, every light and most of the living things with photoreal versions. The world was not consulted.',
    'BLOCKS. Grass, dirt, stone, every ore, logs, planks, leaves, sand, snow, ice, glass, cactus, TNT, crafting tables, furnaces, chests, doors, beds, torches, wool, the Nether blocks and more are now high-resolution PBR materials with real bumps and real roughness. Every terrain block is turned at random so the ground never tiles. Leaves and flowers are cut out properly, water is see-through and catches the light at low angles, ice is glassy, and lava, torches and glowstone actually glow. Anything without a photoreal version yet keeps its OG pixels, lit by the new lights.',
    'LIGHT. A real sun and moon cast real shadows that follow you around, under a proper sky: golden hour, an orange sunset, a purple dusk and starlit nights. Torches, lava and glowstone throw actual light and flicker. Caves are dark until you light them. The Nether glows red, the Aether is blinding, underwater turns teal and murky, and the arena of MALGORATH is now graded in ash and embers. Bloom, ambient occlusion, haze, filmic tone mapping and anti-aliasing do the rest.',
    'THE CAST. Zombies, skeletons, boomers, spiders, pigs, cows, sheep and villagers have been replaced by the Hyperreal cast. They are not low-poly and they are not sorry. Heads turn to follow you. A zombie swing lands on the exact frame it hurts you. Skeletons draw and release with the arrow. Boomers swell and strobe before they go. The hurt flash only lights up the mob you actually hit.',
    'CORPSES. Mobs no longer vanish in a puff the instant they die. They die. The whole death animation plays out, the body lies there for a respectful moment, sinks into the ground, and THEN it is a puff. Up to eight bodies at a time; the oldest one leaves to make room. Drops and XP are exactly the same as before.',
    'YOU. In third person you are now Dan, in more detail than anyone asked for, still wearing your hat and armour and still holding your tools. In first person an empty hand is THE FIST: swollen, and very much yours. It bobs when you walk, jabs when you punch and throws splinters when you punch a tree. Hold a block and you are holding a real photoreal cube.',
    'BunkerBrad, xx_lilcreepah_xx and honeybee_mc got bodies to match. Same minds, same grudges, considerably more skin. When they die they leave a body like everybody else, then respawn just as Hyperreal.',
    'HYPERREAL QUALITY sits right under the pack switch: Auto, Low, Medium, High or Ultra. Auto picks Medium on a normal computer and Low on touch screens. High and Ultra are opt-in for machines that enjoy suffering: bigger shadow maps, more lights, ambient occlusion and film grain. The first switch takes a few seconds while the textures unpack, and you can switch back and forth mid-game.',
    'OG IS UNTOUCHED. Not basically the same: identical. One test plays the same 600-frame session on the old code and the new code and compares them every 40 frames. Another renders a frame, goes to Hyperreal and back, renders it again and checks that every pixel matches. The HUD, the inventory icons, figurines and particles stay 16px in both packs, on purpose.',
    'Fair warning: the game file is now about 31 MB, because every texture lives inside it, and Hyperreal needs WebGL2. If your browser cannot do it, the option says so and OG carries on as normal.',
    'Under the hood: test.js 69, smoke.js 221 (x6), botsmoke.js 199 (x3), plus 614 new texture-pack checks in 9 suites (contract 97 + 55 (x2), blocks 46 + 62 (x2), light 49 + 80 (x2), cast 101 + 93 (x2), OG trace 31). All green.',
  ]},
 {v:'5.9',title:'Other Players',lines:[
    'You are not alone any more. Three AI players now live in your world as if it were a real server: BunkerBrad (convinced everything is out to kill him, builds bunkers, moats, sky bases and traps), xx_lilcreepah_xx (steals, griefs and blows things up, and takes it VERY personally when it happens to him) and honeybee_mc (just wants a lovely flower-filled town where everyone gets along). They each have their own goals, memories, grudges and friendships, and they decide for themselves what to do next.',
    'They play by EXACTLY your survival rules. They join a new world with nothing, punch trees, craft planks, sticks, a crafting table and a wooden pickaxe, mine stone for stone tools, dig for coal and iron, smelt ore in real furnaces, and build only with blocks they actually carried there. Tools and armour wear out and break, stone without a pickaxe gives nothing, they get hungry and only heal when fed, they can\u2019t reach through walls, and when they run out of cobble halfway up a wall they have to go and get more. Every torch, door, bed, chest and stick of TNT was mined, smelted or crafted the hard way, and nobody else\u2019s furnace or chest is a free shop (the one mercy: a filled Water Bucket never runs dry for them).',
    'They place every single block themselves, so their houses look exactly as good (or bad) as they manage. They fight mobs, set up homes, raid chests, light TNT and hold grudges. PvP and griefing are on for everyone, including against each other. Ask one to team up and it is genuinely their call. Declare war and they will remember.',
    'Press T (or Enter) to talk in server chat, / for commands: /msg &lt;player&gt; to whisper, /think &lt;player&gt; to read their mind, /bots to see who is online, /help for the rest. Hold TAB for the player list. New PLAYER COMPASS (you are handed one when they join; craft more from 4 iron around 1 gold): right-click to cycle through players, sneak + right-click to go back, and it points to them with the distance and height. honeybee_mc is also collecting nine NEW FLOWERS that now grow in different biomes.',
    'Their minds run on Claude through a small local brain server (double-click "Start AI Brain.command" in the game folder - it opens the game for you). Without it they play on a simple survival autopilot and cannot chat; the game now says so in chat and shows an "AI players: autopilot" badge until the brain is connected (/brain shows the status). New worlds have them switched on; for older worlds use /bots join or the AI Players rule in the Debug Menu.',
    'Fix: mouse look no longer randomly snaps sideways. Some browsers occasionally report one giant bogus mouse movement while the pointer is locked (especially right after closing chat); the game now ignores those spikes.',
  ]},
 {v:'5.8',title:'Slow-Mo Studio',lines:[
    'New GAME SPEED slider in the Debug Menu (1x down to 0.1x). Turn it down and the whole world runs in slow motion for capturing clean footage \u2014 and it slows and smooths your mouse look by the same amount, so when you speed the recording back up in editing it looks like normal 1x gameplay. Default is 1x, full speed.',
    'Also a GUILT GHOSTS toggle: switch it off and slain mobs will not come back to haunt you, and any that are already lurking are sent packing.',
  ]},
 {v:'5.7',title:'Hold Still',lines:[
    'New FREEZE ALL MOBS toggle in the Debug Menu. Flip it on and every mob \u2014 pigs, zombies, bosses, all of them \u2014 stops dead where it stands: no walking, no attacking, no falling, frozen mid-stride until you switch it back off. They can still be hit and killed while frozen; they just cannot do anything about it.',
  ]},
 {v:'5.6',title:'One Hit Wonder',lines:[
    'New INSTANT KILL toggle in the Debug Menu. Flip it on and every hit you land drops a mob on the spot \u2014 does not matter if it is a gun, a sword, a pickaxe, an arrow, the boomerang, or your bare fist. One touch, one kill. Turn it off to go back to earning it.',
  ]},
 {v:'5.5',title:'Quieter Toggles',lines:[
    'Switching game mode, toggling X-Ray, and cycling the camera view (F) no longer pop a toast message on screen. The change is obvious the moment it happens, so the notifications were just noise. Everything still works exactly the same, just without the announcement.',
  ]},
 {v:'5.3',title:'Into the Void',lines:[
    'The AETHER has no floor, so anything that falls off an island now vanishes into the void the way it should. Mobs, skateboards, cars, boats, planes, and dropped items that tumble into the abyss poof into cloud instead of piling up invisibly at the bottom of the world. You still get bounced back to the overworld when YOU fall off. The rest is lost to the clouds.',
  ]},
 {v:'5.2',title:'Undead Vacation',lines:[
    'ZOMBIES and SKELETONS no longer burn in the daylight of the AETHER. The sky islands are bright, but their light does not smite the undead — the rotting and the bony can now wander the clouds in peace. Sunburn is still very much a thing back in the overworld.',
  ]},
 {v:'5.1',title:'Mercy Settings',lines:[
    'THE ETERNAL SNAIL now has an OFF switch, tucked in the Debug Menu with the other game rules. Flip it and he vanishes on the spot and stays gone. Flip it back if you miss him. He will not judge you. He will simply return.',
    'JUMPSCARES are now OFF by default (chance-per-frame set to 0). If you want them back, the slider is right where it always was, in the Debug Menu. Existing worlds keep whatever you last set.',
  ]},
 {v:'5.0',title:'THE BIG DINGLE',lines:[
    'You can now craft a NUCLEAR BOMB. It is called The Big Dingle and it is a mistake by design: 4 TNT, 2 diamonds, 2 gunpowder, glowstone core. Air delivery only — craft the PROP PLANE (5 iron + glass), place it, hop in, and fly with W to throttle, A/D to bank, and your own eyes to climb: it goes where you look.',
    'Right-click with the bomb while flying to let go. Then a 20 second countdown, sirens included, and then: catastrophic, unimaginable damage. A crater to the VOID — yes, through bedrock — across a huge area. Everything alive within EIGHT CHUNKS dies. The mushroom cloud is visible from everywhere and lingers for a minute and a half. The crater is permanent. It survives saving, loading, and your regret.',
    'The only block that says no: BUNKERCRETE (3 stone + iron, makes 8) and BUNKER GLASS (bunkercrete + glass, makes 4). Seal yourself in completely — floor, walls, roof, no gaps — and the blast cannot touch you. One missing block and it can. The snail also survives. The snail always survives.',
  ]},
 {v:'4.2',title:'Snail Mobility Assessment',lines:[
    'THE ETERNAL SNAIL has completed climbing school. He now pillar-jumps upward when you are above him, placing his own blocks beneath himself, and digs straight down when you are below. Altitude first, then the closing walk. He no longer wastes time building above you - every block he places is a step toward you, never past you.',
  ]},
 {v:'4.1',title:'Horror, Director&#x27;s Cut',lines:[
    'Jumpscares play their in-engine sounds on every computer, so everybody gets the same fright.',
  ]},
 {v:'4.0',title:'THE HORROR UPDATE',lines:[
    'THE ETERNAL SNAIL is here. He is slow. He is patient. His only purpose is to touch you, and his touch is instant death. He breaks walls when he must, builds bridges when he needs to, follows you across every dimension, and if you outrun him he simply... reappears. Fifty blocks away. Walking. There is no hiding. There is no killing. There is only distance, temporarily.',
    'JUMPSCARES: every single frame now has a configurable chance (default 1%) of a gnome greeting you at considerable volume, a sudden bass drop from nowhere, or THE MASCOT. All art and sounds are original and hand-made, which somehow makes it worse. The slider is in the Debug Menu: 0% for cowards, 100% for content creators.',
    'GUILT: 10% of your kills now come back as a translucent ghost of the exact mob you killed, following you for a full minute saying things designed to make you feel bad. They cannot hurt you. That was never the point of them.',
    'NEW HORRORS stalk the night and the deep: a tall pale thing that only moves when you are not looking, and something fast in the caves that freezes in torchlight. Neither can be killed. Sleep well.',
    'There are also things in this update we are not going to tell you about. You will know when you know.',
  ]},
 {v:'3.5',title:'THE GRAB BAG UPDATE',lines:[
    'LIVING BLOCKS: one in every 500 blocks does not consent to being mined. It sprouts legs, bursts into tears, and runs. You monster. (Killing it returns the block. Still a monster.)',
    'FISHING: craft a rod (2 sticks, 2 string), cast into water, wait for the dip, reel within the window. Fish cook in the furnace. There is also a REVERSE FISHING ROD (rod + gunpowder, or a rare catch) which reels YOU in. We are not fixing this. It is genuinely great for water travel.',
    'SNAKES roam the grass, hunting dropped apples - every apple makes them one segment longer. Eating an apple yourself makes YOU bigger for 25 seconds: taller, harder-hitting, higher-jumping. The snakes knew all along.',
    'MOB FIGURINES: every kill has a 5% chance to drop a figurine of the victim. Display them on a SHELF (planks ring) or in a JAR (glass + plank). Boss figurines exist. They rotate. Slowly. Menacingly.',
    'GUARD TURF: craft militarized soil (dirt + string + gunpowder) and plant it: roses shoot, dandelions heal, cacti maul, tall grass slows the horde. Any resemblance to other botanical defense programs is purely coincidental.',
    'DINGLE CINEMA (store, 3999 DB): place the kit and a whole cinema assembles itself. Three original films - and pressing E puts YOU inside the movie as the lead. Win for popcorn.',
    'FORTUNE ORB (obsidian + wool): right-click to consult. Twenty answers, all unhelpful in the correct way.',
  ]},
 {v:'3.4',title:'Mandatory Mantling Seminar',lines:[
    'CLIMBING CLAWS fixed: reaching the top of a block no longer leaves you bobbing at the lip like a confused seal. Once your chest clears the edge you now pop up and over onto the ledge. Hold W, climb, arrive.',
    'Hang Glider reminder, since people asked: keep it in your inventory, fall off something tall, HOLD SHIFT, steer with your face.',
  ]},
 {v:'3.3',title:'Applied Bounce Physics',lines:[
    'NEW BLOCK: the TRAMPOLINE. Craft it from 3 string over 3 planks, place it, and every fall becomes a bigger bounce (up to a serious amount of air). Sneak to land softly. Landing on one never hurts, even sneaking.',
    'Mobs bounce too. Indefinitely. Build a zombie bounce pit. We cannot legally stop you.',
    'Not to be confused with the Pocket Trampoline gadget, which is for people who bring the bounce with them.',
  ]},
 {v:'3.2',title:'Boss Attendance Review',lines:[
    'FIXED: INFERNIS and VALKYRA sometimes clocked in, noticed you were more than 64 blocks away, and clocked straight back out — permanently. Dimension bosses now spawn only when you actually arrive, are immune to distance-despawning, and RESPAWN on every visit until you genuinely kill them. Fortresses you already looted will have their boss waiting when you return.',
    'Boss kills are now recorded per-fortress and per-shrine in your save. Slaying stays slain.',
  ]},
 {v:'3.1',title:'Ocular Upgrade Program',lines:[
    'LASER EYES have been through the lab: the beam is now thick, white-hot with a red glow, holds steady instead of strobing, has an actual laser sound, hits for triple damage, and VAPORIZES THE FIRST BLOCK IT TOUCHES about eleven times per second. Bedrock and portals are immune. Nothing else is.',
    'Yes, it is slightly overpowered. That is a design decision and we stand behind it from a safe distance.',
  ]},
 {v:'3.0',title:'THE DIMENSIONS UPDATE',lines:[
    'THE NETHER: a roofed hell of netherrock, soul sand, glowstone and a lava sea. Build a 4x5 OBSIDIAN frame and light it with a TORCH. Home to nether fortresses, imps, hellhogs, and INFERNIS, THE MOLTEN DUKE.',
    'THE AETHER: islands in a bottomless sky. Build the frame from GLOWSTONE and pour a WATER BUCKET into it. Shrines, cherubs, and VALKYRA OF THE HIGH ISLES await. Fall off and you are returned to the overworld — from very, very high up.',
    'BUCKETS: craft from 3 iron. Scoop and pour water and lava. Water + lava = OBSIDIAN, which is also how you get portal frames. Overworld caves now bottom out in lava lakes (existing worlds get them too in unexplored terrain).',
    'TEN GADGETS hide in dimension dungeon chests and boss drops: Double-Jump Boots, Jetpack, Grappling Anchor, Hang Glider, Loot Magnet, Climbing Claws, Pocket Trampoline, Blink Pearl, Anti-Gravity Belt, and the Pig Cannon, which fires one (1) live pig. Passives work from your inventory; actives fire on right-click while held.',
    'Every gadget renders as a real 3D model in your hand (CC-BY 3.0 models by Poly by Google and Roman Miller, plus a CC0 cannon by Quaternius; see Help for credits).',
    'One world, three dimensions, one save file. Old worlds upgrade in place.',
  ]},
 {v:'2.13',title:'The Consumer Rights Update',lines:[
    'The Battle Pass can now be PAUSED. Click its button in the DINGLE STORE (it says PAUSE once owned) to stop the dirt deliveries; click again to resume. This is the most player-friendly battle pass in the industry and we are already regretting it.',
  ]},
 {v:'2.12',title:'The Totally Legitimate Mining Update',lines:[
    'NEW debug tool: X-RAY. Everything goes ghost-transparent except diamond ore, which stays solid and judgmental. Toggle it in the Debug Menu or with [ + X.',
    'Geology lesson: diamonds in DINGLECRAFT spawn at a FLAT rate everywhere below y=14, so any depth from y=1 to y=13 is equally good. Branch-mine around y=6 and thank us in the comments.',
    'X-Ray is a debug cheat: it is not saved, and your dignity does not survive the reload either.',
  ]},
 {v:'2.11',title:'The Quality of Life Update',lines:[
    'Patch notes are now a scrollable archive of every update from here on. You are reading the archive right now. Meta.',
    'NEW Settings toggle: Mouse Capture. Turn it OFF and the browser stops flashing its \u201cpress ESC to show your cursor\u201d note entirely — you aim by moving the mouse over the game instead. (That banner belongs to your browser, not us; this is the one legal workaround.)',
    'Help & Controls can no longer be escaped from. You will read the controls and you will be grateful. The Close button remains available to quitters.',
    'DINGLECRAFT releases now ship as separate files per version, so last night\u2019s build keeps working while the next one is cooking.',
  ]},
 {v:'2.10',title:'DEEP DIRT 2D: Dirt Harder',lines:[
    'DEEP DIRT 2D got its Big Content Patch: bigger worlds with TREES, a real hotbar (dirt/stone/wood/planks/brick/torch), CRAFTING (press C — planks, torches, brick, tool tiers), pick progression that actually speeds up mining, a gold sword, cave BATS, slime loot drops (hearts! ore!), fall damage, particles, cracking blocks, parallax hills, drifting clouds, starfields and torch glow. Collect 15 ore and craft the GOLDEN DINGLE to win.',
    'Old DEEP DIRT 2D saves still load. Your dirt is safe. Your dirt was always safe.',
    'Jumping in DEEP DIRT 2D no longer makes your actual body jump. The two of you are separate people now; the therapist said it was for the best.',
  ]},
];
const PATCH_NOTES=PATCH_LOG[0];
function renderPatch(){
  const b=$('patchbody');
  if(!b)return;
  let h='';
  for(const e of PATCH_LOG){
    h+='<div class="pnhead" data-v="v'+e.v+'">'+(e.label||'v'+e.v)+' — '+e.title+'</div><ul class="pnlist">';   /* a release shows its public label; data-v keeps the internal version */
    for(const line of e.lines)h+='<li>'+line+'</li>';
    h+='</ul>';
  }
  b.innerHTML=h;
}
let patchOpen=false;
function openPatch(){renderPatch();patchOpen=true;const el=$('patch');if(el)el.style.display='flex';}
function closePatch(){patchOpen=false;const el=$('patch');if(el)el.style.display='none';restorePause();}
{
  const tb=$('t_patch');if(tb)tb.onclick=()=>{openPatch();playS('click');};
  const pb=$('p_patch');if(pb)pb.onclick=()=>{hidePause();openPatch();playS('click');};
  const pc=$('patchclose');if(pc)pc.onclick=()=>{closePatch();};
}

