#!/usr/bin/env bash
# The History page's judging batch, on the playground (dev server on :5183):
#   tools/render/history-batch.sh apps/playground/out/history-rN
# Every moment the judge reads: desktop 1440 (light, dark), Home Assistant's widths (1152, 736, es), a tablet (600),
# phones (412 es, 360 en, 320 en + es), Spanish with Home Assistant's words.
set -euo pipefail
out=$(realpath -m "$1")
mkdir -p "$out"
cd "$(dirname "$0")"
shoot() { node history-states.mjs "$@" > /dev/null; }
run() {
  local pids=()
  for job in "$@"; do eval "shoot $job" & pids+=($!); done
  for pid in "${pids[@]}"; do wait "$pid"; done
}
run "--viewport 1440 --height 1000 --lang en --out $out/desktop-1440" \
    "--viewport 1440 --height 1000 --lang en --mode dark --only plain,month,states,scrub,sources,dates --out $out/desktop-1440-dark" \
    "--viewport 1152 --height 900 --lang es --only plain,week,month,states,scrub,bottom --out $out/ha-1152-es"
run "--viewport 736 --height 900 --lang es --only plain,week,states,dates,sources,bottom --out $out/ha-736-es" \
    "--viewport 600 --height 900 --lang en --only plain,month,states,dates --out $out/tablet-600" \
    "--viewport 412 --height 915 --lang es --out $out/phone-412-es"
run "--viewport 412 --height 915 --lang es --mode dark --only plain,month,states,scrub --out $out/phone-412-es-dark" \
    "--viewport 360 --height 800 --lang en --only plain,week,month,states,many,dates,sources,scrub,bottom --out $out/phone-360" \
    "--viewport 320 --height 720 --lang en --only plain,week,states,many,dates,empty,bottom --out $out/phone-320"
run "--viewport 320 --height 720 --lang es --only plain,month,states,dates,bottom --out $out/phone-320-es" \
    "--viewport 360 --height 800 --lang es --only plain,states,sources,bottom --out $out/phone-360-es"
ls "$out"/*.png | wc -l
