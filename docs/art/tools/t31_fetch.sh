#!/bin/bash
# usage: t31_fetch.sh <name> <url>  -> assets/_raw/t31/<name>.png + preview jpg (900px, magenta under alpha) in $T31_PREV
cd "$(dirname "$0")/../../.." || exit 1
P=${T31_PREV:-/tmp/t31prev}; mkdir -p "$P" assets/_raw/t31
curl -sSf -o "assets/_raw/t31/$1.png" "$2" && node -e "
const s=require('sharp');s('assets/_raw/t31/$1.png').flatten({background:'#ff00ff'}).resize({width:900}).jpeg({quality:78}).toFile('$P/$1.jpg').then(i=>console.log('$1',i.width+'x'+i.height))"
