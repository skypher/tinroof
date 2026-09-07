#!/usr/bin/env python3
"""Convert the original storm's AIFF samples to browser-readable lossless WAV."""
import argparse
import json
from pathlib import Path
import re
import subprocess
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('workspace', type=Path)
args = parser.parse_args()
root = args.workspace.resolve()
sources = [root / 'Boodler-1.6.1/effects' / name for name in ('owstorm.py', 'pwrain.py')]
names = sorted(set(re.findall(r"'([^']+\.aiff)'", '\n'.join(p.read_text() for p in sources))))
manifest = {}
for i, name in enumerate(names):
    target = name.replace('/', '--').replace('.aiff', '.wav')
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', str(root / 'boodler-snd' / name), '-c:a', 'pcm_s16le', str(root / 'web/samples' / target)], check=True)
    manifest[name] = 'samples/' + target
    print(f'Sample {i + 1}/{len(names)}: {name}', flush=True)
(root / 'web/samples/manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
