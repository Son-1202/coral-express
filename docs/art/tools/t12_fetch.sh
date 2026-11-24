#!/bin/bash
# usage: t12_fetch.sh <name> <url>  -> assets/_raw/t12/<name>.png + 1000px preview jpg (magenta under alpha) in $T12_PREV
cd "$(dirname "$0")/../../.." || exit 1
P=${T12_PREV:-/tmp/t12prev}; mkdir -p "$P" assets/_raw/t12
curl -sSf -o "assets/_raw/t12/$1.png" "$2" && node -e "
const s=require('sharp');s('assets/_raw/t12/$1.png').flatten({background:'#ff00ff'}).resize({width:1000}).jpeg({quality:80}).toFile('$P/$1.jpg').then(i=>console.log('$1',i.width+'x'+i.height))"
