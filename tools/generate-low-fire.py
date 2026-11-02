#!/usr/bin/env python3
"""Create the original, synthetic low fire loop used by the score presentation.

Requires numpy, scipy and ffmpeg for offline asset generation only. This is not
Freesound 794817 or any other recording. The runtime ships the encoded file.
"""
from pathlib import Path
import subprocess
import tempfile
import numpy as np
from scipy import signal
from scipy.io import wavfile

RATE = 24000
SECONDS = 24
OVERLAP = 2
rng = np.random.default_rng(0x7942026)
length = (SECONDS + OVERLAP) * RATE

def band(low, high, count=length):
    sos = signal.butter(4, [low, high], btype='bandpass', fs=RATE, output='sos')
    raw = signal.sosfilt(sos, rng.standard_normal(count))
    return raw / max(np.std(raw), 1e-9)

def drift(minimum, maximum):
    times = np.arange(0, length / RATE + 2, .7)
    values = rng.uniform(minimum, maximum, len(times))
    interp = np.interp(np.arange(length) / RATE, times, values)
    return signal.sosfilt(signal.butter(2, .7, fs=RATE, output='sos'), interp)

# Several low, slowly changing layers, with no bright hiss/crackle track.
bed = band(36, 105) * drift(.10, .30) + band(90, 230) * drift(.025, .09)
bed += band(200, 500) * drift(.04, .10)
# Infrequent softened breath-like puffs. Each is a low-mid filtered body with
# a long rounded envelope and independent duration, strength and spacing.
pos = .8
while pos < (SECONDS + OVERLAP) - 1.2:
    duration = rng.uniform(.38, 1.05)
    count = int(duration * RATE)
    t = np.linspace(0, 1, count, endpoint=False)
    envelope = np.sin(np.pi * t) ** 2
    puff = .65 * band(48, 150, count) + .35 * band(150, 350, count)
    start = int(pos * RATE)
    bed[start:start+count] += puff * envelope * rng.uniform(.12, .25)
    pos += rng.uniform(1.05, 2.65)
# Keep the level bounded and close the seam with a two-second equal-power
# overlap; normalize after the seam is assembled.
bed = signal.sosfilt(signal.butter(3, 25, btype='highpass', fs=RATE, output='sos'), bed)
loop = bed[:SECONDS * RATE].copy()
n = OVERLAP * RATE
w = np.sin(np.linspace(0, np.pi / 2, n)) ** 2
loop[:n] = bed[SECONDS*RATE:(SECONDS+OVERLAP)*RATE] * (1-w) + loop[:n] * w
loop *= .74 / max(np.max(np.abs(loop)), 1e-9)
output = Path(__file__).resolve().parents[1] / 'public/assets/audio/high-multiplier/low-fire.mp3'
with tempfile.TemporaryDirectory() as temp:
    wav = Path(temp) / 'low-fire.wav'
    wavfile.write(wav, RATE, np.int16(np.clip(loop, -1, 1) * 32767))
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '64k', '-write_xing', '1', str(output)], check=True)
print(output)
