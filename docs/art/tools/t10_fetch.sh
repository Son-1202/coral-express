#!/bin/bash
# usage: t10_fetch.sh <name> <url>  -> assets/_raw/t10/<name>.png + scratch preview jpg (900px)
cd "$(dirname "$0")/../../.." || exit 1
P=${T10_PREV:-/tmp/t10prev}; mkdir -p "$P" assets/_raw/t10
curl -sSf -o "assets/_raw/t10/$1.png" "$2" && node -e "
const s=require('sharp');s('assets/_raw/t10/$1.png').flatten({background:'#ff00ff'}).resize({width:900}).jpeg({quality:78}).toFile('$P/$1.jpg').then(i=>console.log('$1',i.width+'x'+i.height))"
