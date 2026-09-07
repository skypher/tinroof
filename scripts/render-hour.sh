#!/usr/bin/env bash
set -euo pipefail
if [[ ${1:-} == -h || ${1:-} == --help || $# != 2 ]]; then
  echo 'Usage: render-hour.sh BOODLER_WORKSPACE HOUR_NUMBER (2–8); renders a distinct original storm to audio/hour-N.mp3'
  exit 0
fi
root=$(realpath "$1")
number=$2
[[ $number =~ ^[2-8]$ ]] || { echo 'Hour must be 2–8' >&2; exit 1; }
out="$root/web/audio/hour-$number.mp3"
[[ ! -e $out ]] || { echo "Already rendered: $out"; exit 0; }
raw=$(mktemp /tmp/rainfall-hour-XXXXXX.raw)
trap 'rm -f "$raw"' EXIT
export PYTHONPATH="$root/Boodler-1.6.1/src"
export BOODLER_SOUND_PATH="$root/boodler-snd"
export BOODLER_EFFECTS_PATH="$root/Boodler-1.6.1/effects"
echo "Hour $number: rendering original storm"
"$root/pypy2.7-v7.3.17-linux64/bin/pypy" -u "$root/Boodler-1.6.1/script/boodler.py" -v -o file -d "$raw" -D time=3600 --stats 300 owstorm.RainForever
echo "Hour $number: encoding"
ffmpeg -nostdin -hide_banner -nostats -progress pipe:1 -stats_period 5 -y -threads 1 -f s16le -ar 44100 -ac 2 -i "$raw" -t 3600 -af 'afade=t=out:st=3599:d=1' -c:a libmp3lame -b:a 128k -threads 1 "$out.partial.mp3"
mv "$out.partial.mp3" "$out"
echo "Hour $number: complete"
