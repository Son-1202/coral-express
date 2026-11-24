#!/bin/bash
# usage: fetch.sh <name> <url>  -> assets/_raw/T09_<name>.png + preview jpg in scratch
cd "$(dirname "$0")/../../.." || exit 1
curl -sSf -o "assets/_raw/T09_$1.png" "$2" && echo "$1 ok $(stat -c%s assets/_raw/T09_$1.png)"
