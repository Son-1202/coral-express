#!/bin/bash
# usage: t16_fetch.sh <name> <url>  -> assets/_raw/t16/<name>.png + preview jpg (900px) in $T16_PREV
cd "$(dirname "$0")/../../.." || exit 1
P=${T16_PREV:-/tmp/t16prev}; mkdir -p "$P" assets/_raw/t16
curl -sSf -o "assets/_raw/t16/$1.png" "$2" && node -e "
const s=require('sharp');s('assets/_raw/t16/$1.png').flatten({background:'#ff00ff'}).resize({width:900}).jpeg({quality:78}).toFile('$P/$1.jpg').then(i=>console.log('$1',i.width+'x'+i.height))"
