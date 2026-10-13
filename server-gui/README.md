# The DINGLECRAFT server window

The multiplayer server as a desktop program: a window with buttons instead of a terminal. It is an
[Electron](https://www.electronjs.org) app around the same server that lives in [`../server`](../server/README.md); that
server is not changed, and its terminal form (`Start Server.bat`, `start-server.sh`) works as it always did.

## Run it

It needs [Node.js](https://nodejs.org) 20 or newer to install; after that it runs on Electron's own Node.

```sh
npm install     # once: downloads Electron
npm start
```

`npm start -- --data <folder>` adds that folder to the list as a server. New servers live in the program's own user-data
folder (the Dashboard shows where, and has a button to open it).

## What is in the window

The layout follows the server managers people already know: your servers down the left, the one you picked on the right.

- **The list (left):** every server with a dot for running, starting or stopped, its port and how many are online. **New server** makes one with its own folder and the first free port; **Add existing folder** adopts a data folder you already have (the terminal server's `data/`, say). Removing one from the list leaves its folder alone.
- **The header:** Start, Stop (saves first), Restart, and Kill (ends it at once, without saving) for the server that is picked. Several servers can run at once, each on its own port.
- **Dashboard:** status, players, memory and world as cards; the addresses to give players (with Copy) and Open in browser; which dimensions the server is running a game for.
- **Console:** the log, and a box for commands (the same ones operators type in the game). Up and Down recall earlier commands.
- **Players:** who is online, where, and buttons to kick, ban, op or deop, and teleport one player to another.
- **Settings** and **Game rules:** `server.json` as two forms. Values are checked before they are written, and the window says which changes need a restart.
- **Worlds:** the worlds in the data folder, switch world, make a new one (name, seed, mode, difficulty).
- **Backups:** Back up now (a running server saves first), and every dated copy under `backups/` with Restore (the world as it is now is kept as a backup first, so a restore can be undone) and Delete.
- **Scheduler:** every so many minutes, back up the world (keeping the newest N), restart the server, or run a command. Tasks run while that server runs, counted from when it started.

Closing the window with a server running asks whether to stop everything or keep running in the tray. The list of servers and their tasks is `servers.json` in the program's own user-data folder; each server's settings stay in its own data folder.

## How it works

`main.js` starts the server as a child process with Electron's own Node (`ELECTRON_RUN_AS_NODE=1`) in its `--ipc` mode
([`server/lib/admin.mjs`](../server/lib/admin.mjs)): the server reports status, log lines and players over the fork
channel and takes commands the same way. Nothing is read off its output. A server that crashes cannot take the window
with it, and the window can start it again. `lib/store.cjs` is the file handling (the server list, settings, worlds, backups,
scheduled tasks), kept apart from Electron so the test suites can run it.

## A Windows program (.exe)

`npm run dist` builds a Windows installer and a portable exe with electron-builder (the settings are in `package.json`).
That has to be run on Windows (or under Wine), with the server and a game html copied into `server/` here first, as
`npm run package` lays them out in the release zip. The exe is unsigned, so Windows SmartScreen will warn the
first time it is started. It has the default Electron icon: the picture in this folder is called `tray.png` because the
builder takes any `icon.png` here as the program's icon and refuses one smaller than 256 x 256.
