# Rainfall

Original Boodler weather, for as long as you want to stay.

**Listen: https://boodler-storm.vercel.app**

## Listening modes

- **Original hour:** the original 60-minute storm recording, repeating.
- **Four-hour recording:** four distinct original-engine storm performances,
  played in sequence and repeated after four hours.
- **Eight-hour recording:** eight distinct performances, repeated after eight hours.
- **Endless:** the original samples mixed in the browser, with newly randomized
  storms, thunder, droplets, crickets and frogs. There is no fixed recording loop.

In endless mode, choose a **1-, 2- or 3-hour storm cycle** and a **½×, 1× or 2×
weather speed**. A three-hour cycle at half speed unfolds over six hours.
These controls stretch the weather stages without changing sample pitch or
slowing down individual animal calls. Storm strength, crickets and frogs each
have independent controls. Wildlife still fades during heavy rain and returns
afterward. Set storm strength to zero for wildlife without rain or thunder.

All modes include pause/resume, master volume, seeking and restart. Tap play
once to start. The four/eight-hour modes prefetch the next hour; a brief fade
separates recorded hours. Live scheduling and mixing run in an AudioWorklet,
independent of page timers. Mobile browsers and operating systems can still
suspend background audio; recording mode is the safer choice for locked screens.

## Run locally

```sh
npx http-server . -p 8000 -c-1
```

Open http://localhost:8000. Use a static server with HTTP range support so
recorded seeking works (Python’s basic http.server does not supply that).
There is no application build or runtime dependency.
Live mode requires AudioWorklet (HTTPS or localhost in a modern browser).

## Test

```sh
npm ci
npx playwright install chromium
npm test
npm run test:browser -- http://localhost:8000
```

To use an existing Chromium binary, set `CHROMIUM_PATH` for the browser test.
Engine tests exercise an eight-hour simulation, all seven weather stages,
cycle stretching, unchanged sample pitch, wildlife envelopes, muting, bounded
voice counts, seeking and extreme random stage durations. Browser tests check
recorded transitions and wrap, live audio output, controls, pause/resume, mode
switching, page-thread blocking, and mobile layout.

## Deploy

```sh
vercel deploy --prod
```

This is a static Vercel site; no server functions are needed. The recordings
and samples total roughly 480 MB. This deployment uses a Pro account, whose
CLI upload allowance accommodates these assets. Git tracks each recorded hour
separately, below GitHub's 100 MB per-file limit. The browser loads the selected
recording and prefetches the next; it does not download all eight hours on entry.

## Sound sources and differences

Recordings use Boodler 1.6.1's `owstorm.RainForever` and the February 19, 2002
sound library. The original hour is 160 kbps MP3; the seven additional hours
are 128 kbps MP3, all stereo 44.1 kHz with a one-second ending fade.
They are independently generated performances, not copies of the first hour.

`storm-core.js` adapts `owstorm.py`, `pwrain.py`, `play.py` and `manager.py`:
original sample names, layer volumes, modulation intervals, intermittent event
ranges and pitch ranges are retained. Web Audio uses floating-point mixing
and linear resampling. Live mode blends stage levels, keeps background sample
loops running, and scales the weather timeline; it is not a bit-identical port
of Boodler's C mixer and agent/channel graph. Recovery is reserved at the end
of every cycle, including extreme random duration draws. Raw samples are
losslessly converted from AIFF to WAV, without time-stretching or pitch shifts.

Soundscape by Owen Williams, with pieces by Peter Williams; Boodler by Andrew
Plotkin. [credits.txt](credits.txt) and [attribution/](attribution/) retain the
original sample owners' attribution and usage terms. These assets are not
relicensed by this repository; consult their terms before commercial reuse.

Original archives:

- https://www.eblong.com/zarf/boodler/Boodler-1.6.1.tar.gz
- https://www.eblong.com/zarf/boodler/boodler-snd-021902.tar.gz

## Regenerate assets

The scripts accept `-h` and `--help`. They expect an external workspace
containing `Boodler-1.6.1/` (built with the file driver), `boodler-snd/`,
`pypy2.7-v7.3.17-linux64/`, and this repository at `web/`, plus FFmpeg on PATH.
These legacy components are not required to run the website.

```sh
python3 -u scripts/convert-samples.py /path/to/workspace
./scripts/render-hour.sh /path/to/workspace 2
```

Render hour numbers 2 through 8 to replace missing extra recordings. The
renderer prints original-engine stats and FFmpeg's encoding progress and
renames each temporary output only after successful completion.
