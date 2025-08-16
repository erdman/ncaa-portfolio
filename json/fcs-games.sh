#!/bin/bash

# usage:  ./fcs-game.sh fbs-names.json 202???.json | sort

exclude_file="$1"
shift

for data_file in "$@"; do
  jq -r --argfile names "$exclude_file" '
    .[] 
    | select(.away.nameRaw as $n | $names | index($n) | not)
    | "\(.home.nameRaw), \(.away.nameRaw)"
  ' "$data_file"
done
