#!/usr/bin/env bash
set -euo pipefail
mkdir -p assets/frames
states=(archer_idle archer_walk archer_attack goblin_walk goblin_death)
counts=(4 6 4 6 6)
names=()
for s in "${!states[@]}"; do
  state="${states[$s]}"; count="${counts[$s]}"; cell=$((2172 / count))
  for ((i=0; i<count; i++)); do
    name=$(printf '%s_%02d' "$state" "$i"); names+=("$name")
    convert "assets/source/$state.png" -crop "${cell}x724+$((i * cell))+0" +repage -trim +repage -resize '170x155>' -gravity south -background none -extent 192x192 "assets/frames/$name.png"
  done
done
cells=(); for name in "${names[@]}"; do cells+=("assets/frames/$name.png"); done
for ((i=${#names[@]}; i<30; i++)); do convert -size 192x192 xc:none "assets/frames/_blank_$i.png"; cells+=("assets/frames/_blank_$i.png"); done
montage "${cells[@]}" -tile 6x5 -geometry 192x192+0+0 -background none assets/characters.png
convert -size 80x24 xc:none -stroke '#4c2b16' -strokewidth 4 -draw 'line 8,12 65,12' -fill '#d7aa55' -stroke '#4c2b16' -strokewidth 2 -draw 'polygon 64,5 77,12 64,19' -fill '#f2e3bb' -draw 'polygon 14,12 2,4 9,12 2,20' assets/arrow.png
node tools/write-atlas-json.mjs
