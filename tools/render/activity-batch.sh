#!/usr/bin/env bash
# The Activity page's judging batch, on the playground (dev server on :5183):
#   tools/render/activity-batch.sh apps/playground/out/activity-rN
# Every moment the judge reads: desktop 1440 (light, dark), Home Assistant's widths (1152, 736, es), a tablet (600),
# phones (412 es, 360 en, 320 en + es), card mode (1440, 640, 412, 360, 320), Spanish with Home Assistant's words.
set -euo pipefail
out=$(realpath -m "$1")
mkdir -p "$out"
cd "$(dirname "$0")"
shoot() { node activity-states.mjs "$@" > /dev/null; }
run() {
  local pids=()
  for job in "$@"; do eval "shoot $job" & pids+=($!); done
  for pid in "${pids[@]}"; do wait "$pid"; done
}
run "--viewport 1440 --height 900 --lang en --out $out/desktop-1440" \
    "--viewport 1440 --height 900 --lang en --mode dark --only top,detail,dates,sources,burst,end --out $out/desktop-1440-dark" \
    "--viewport 1152 --height 860 --lang es --only top,detail,dates,linked,week,end --out $out/ha-1152-es" \
    "--viewport 736 --height 860 --lang es --only top,detail,dates,linked,week,end --out $out/ha-736-es"
run "--viewport 412 --height 915 --lang es --out $out/phone-412-es" \
    "--viewport 412 --height 915 --lang es --mode dark --only top,detail,dates,scrub --out $out/phone-412-es-dark" \
    "--viewport 360 --height 800 --lang en --only top,detail,burst,dates,linked,week,scrub,end --out $out/phone-360" \
    "--viewport 1440 --height 900 --lang en --card 1 --only top,detail,scrolled,end --out $out/card-1440"
run "--viewport 412 --height 915 --lang es --card 1 --only top,detail --out $out/card-412-es" \
    "--viewport 640 --height 900 --lang es --card 1 --only top,detail --out $out/card-640-es" \
    "--viewport 600 --height 900 --lang en --only top,detail,dates --out $out/tablet-600" \
    "--viewport 360 --height 800 --lang es --card 1 --only top,detail,burst,linked,week,end --out $out/card-360-es" \
    "--viewport 360 --height 800 --lang en --card 1 --only top,detail,week,end --out $out/card-360"
run "--viewport 360 --height 800 --lang es --only top,detail,end --out $out/phone-360-es" \
    "--viewport 320 --height 720 --lang en --only top,detail,burst,dates,week,linked,end --out $out/phone-320" \
    "--viewport 320 --height 720 --lang es --only top,detail,end --out $out/phone-320-es" \
    "--viewport 320 --height 720 --lang es --card 1 --only top,detail,burst,week,end --out $out/card-320-es"
ls "$out"/*.png | wc -l
