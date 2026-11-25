#!/bin/bash
# usage: t34_fetch.sh <name> <url>  -> assets/_raw/t34/<name>.png + preview jpg (900px) in $T34_PREV
cd "$(dirname "$0")/../../.." || exit 1
P=${T34_PREV:-/tmp/t34prev}; mkdir -p "$P" assets/_raw/t34
curl -sSf -o "assets/_raw/t34/$1.png" "$2" && node -e "
const s=require('sharp');s('assets/_raw/t34/$1.png').flatten({background:'#ff00ff'}).resize({width:900}).jpeg({quality:80}).toFile('$P/$1.jpg').then(i=>console.log('$1',i.width+'x'+i.height))"
