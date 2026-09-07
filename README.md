# Rainfall

An endlessly repeating hour of rain, thunder, crickets, and frogs.

**Listen: https://boodler-storm.vercel.app**

A lightweight browser player with play/pause, volume, seeking, mobile layout,
and media-session controls. Tap play once to start. The original hour repeats
via the browser's native audio loop; browser/OS background restrictions apply.

## Run locally

Serve this directory with any static web server, for example:

```sh
python3 -u -m http.server 8000
```

Then open http://localhost:8000. No dependencies or build step are required.

## Deploy

```sh
vercel deploy --prod
```

Vercel configuration is included. Link to your own Vercel project when prompted.

## The sound

`audio/storm.mp3` is a full 60-minute render of original Boodler 1.6.1's
`owstorm.RainForever`, using its original February 19, 2002 sound library.
The recording uses stereo 44.1 kHz audio encoded at 160 kbps, with a one-second
ending fade. It is one repeating rendered performance, not a JavaScript port
of the random scheduler. The audio asset is approximately 72 MB.

Soundscape by Owen Williams, with pieces by Peter Williams; Boodler by Andrew
Plotkin. Original library information is in [credits.txt](credits.txt), and
sample attribution and usage terms are in [attribution/](attribution/).
The sound files retain their original owners' terms; this repository does not
relicense them. Consult those terms before commercial reuse.

Original sources:

- https://www.eblong.com/zarf/boodler/Boodler-1.6.1.tar.gz
- https://www.eblong.com/zarf/boodler/boodler-snd-021902.tar.gz

## Validation

Browser checks passed locally and on the live deployment for playback, pause,
volume, full-hour duration, looping across the recording boundary, mobile
layout without horizontal overflow, and absence of JavaScript errors.
The deployed audio supports HTTP range requests for seeking.
