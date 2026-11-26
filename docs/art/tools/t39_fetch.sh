#!/bin/bash
# T-39: usage t39_fetch.sh <name> <url> -> assets/_raw/t39/<name>.png + preview jpg (900px) in $T39_PREV
cd "$(dirname "$0")/../../.." || exit 1
P=${T39_PREV:-/tmp/t39prev}; mkdir -p "$P" assets/_raw/t39
curl -sSf -o "assets/_raw/t39/$1.png" "$2" && node -e "
const s=require('sharp');s('assets/_raw/t39/$1.png').flatten({background:'#ff00ff'}).resize({width:900}).jpeg({quality:80}).toFile('$P/$1.jpg').then(i=>console.log('$1',i.width+'x'+i.height))"
