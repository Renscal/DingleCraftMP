# The DINGLECRAFT desktop client

An [Electron](https://www.electronjs.org) window around the game's one html file. **Nobody needs it to play**: the html
opens in any browser, and a multiplayer server hands the game out at its own address. This folder exists so the desktop
version has somewhere to grow (its own window, shortcuts, menus, anything a browser tab cannot do).

## Run it

It needs [Node.js](https://nodejs.org) 20 or newer.

```sh
npm install     # once: downloads Electron
npm start
```

It opens the newest `dinglecraft_v<version>.html` next to `main.js` (the release zip ships one there). In a checkout of
the repository it falls back to the newest build in `dist/`, so `npm run build` at the top of the repo is enough.
`npm start -- --game <file>` opens any other build.

F11 toggles full screen. Every other key belongs to the game.

## Change it

Everything the wrapper does is in `main.js`, about 50 lines. The game is not modified: the window loads the same html,
byte for byte, so worlds and multiplayer behave exactly as in a browser. Worlds are kept by the window's own profile, so
they are separate from the worlds of a browser on the same machine (Export World in the pause menu moves one across).

`package.json`'s version is filled in with the game version when a release is packaged (`npm run package`).
