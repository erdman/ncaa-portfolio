#!/bin/bash

# usage:  ./fcs-game.sh fbs-names.json 202???.json | sort

exclude_file="$1"
shift

for data_file in "$@"; do
  jq -r --slurpfile names "$exclude_file" '
    .[] 
    | select(.away.nameRaw as $n | $names[0] | index($n) | not)
    | "\(.home.nameRaw), \(.away.nameRaw)"
  ' "$data_file"
done
