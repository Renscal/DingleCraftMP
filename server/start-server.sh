#!/bin/sh
# DINGLECRAFT multiplayer server launcher for Linux and macOS. Needs Node.js 20 or newer (https://nodejs.org).
# Settings: data/server.json next to this file (written on the first run), or pass options after the script name.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found. Install version 20 or newer from https://nodejs.org and run this again."
  exit 1
fi
exec node dinglecraft-server.mjs "$@"
