jq -r --slurpfile names fbs-names.json '
  .[]
  | select(.away.nameRaw as $n | $names[0] | index($n) | not)
  | .home.nameRaw
' 202???.json | awk 'NR==FNR {fbs[$0]; next} $0 in fbs {count[$0]++} END {
    for (team in fbs) print team ", " (count[team] ? count[team] : 0)
}' <(jq -r '.[]' fbs-names.json) - | sort

