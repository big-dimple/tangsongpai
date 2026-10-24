"""Prepare complete owner-selected songs; requires Python 3 and FFmpeg/ffprobe.

Delivery matches board-race ab72bf69's measured 48k stereo Vorbis 160k / MP3
192k and ~-16 LUFS approach. That repository does not retain encoder commands.
This script records our exact commands and never writes to the input directory.
"""
import argparse
import array
import hashlib
import json
import math
import pathlib
import re
import subprocess

NAMES = ('tianhu-begin', 'moon-shop', 'go-cake', 'vsboss')
REFERENCE = 'ab72bf69cae445df466c9cd204dba9fda96ce5dc'


def run(args, binary=False):
    return subprocess.run(args, check=True, capture_output=True, text=not binary)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def probe(path):
    return json.loads(run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)]).stdout)


def measure(path):
    result = run(['ffmpeg', '-hide_banner', '-nostdin', '-i', str(path), '-map', '0:a:0',
                  '-af', 'volumedetect,loudnorm=I=-16:TP=-2:LRA=11:print_format=json', '-f', 'null', '-'])
    loud = json.loads(re.search(r'\{\s*"input_i".*?\}', result.stderr, re.S).group())
    return {'integratedLufs': float(loud['input_i']), 'truePeakDbTP': float(loud['input_tp']),
            'loudnessRangeLU': float(loud['input_lra']),
            'samplePeakDbFS': float(re.search(r'max_volume: ([-\d.]+)', result.stderr).group(1)),
            'fullDecodeExit': result.returncode}


def decode(path):
    raw = run(['ffmpeg', '-v', 'error', '-nostdin', '-i', str(path), '-map', '0:a:0',
               '-ar', '48000', '-ac', '2', '-f', 'f32le', '-'], binary=True).stdout
    pcm = array.array('f')
    pcm.frombytes(raw)
    return pcm


def windows(original, delivered):
    rows = []
    for ratio in (.1, .5, .9):
        start = int(len(original) * ratio) // 2 * 2
        a, b = original[start:start+96000], delivered[start:start+96000]
        aa, bb = sum(x*x for x in a), sum(x*x for x in b)
        correlation = sum(x*y for x, y in zip(a, b)) / math.sqrt(aa*bb) if aa and bb else None
        rows.append({'atFraction': ratio, 'seconds': len(a)/96000, 'correlation': correlation})
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=pathlib.Path, required=True)
    parser.add_argument('--output', type=pathlib.Path, required=True)
    parser.add_argument('--report', type=pathlib.Path, required=True)
    parser.add_argument('--input-analysis', type=pathlib.Path)
    args = parser.parse_args()
    source_root, output_root = args.input.resolve(), args.output.resolve()
    if source_root == output_root or source_root in output_root.parents:
        raise ValueError('Output must be outside the original input directory')
    output_root.mkdir(parents=True, exist_ok=True)
    previous = {r['name']: r for r in json.loads(args.input_analysis.read_text())} if args.input_analysis else {}
    report = {'referenceRepository': 'https://github.com/big-dimple/board-race', 'referenceCommit': REFERENCE,
              'referencePaths': ['src/audio/audio.ts', 'src/assets/audio/LICENSES.md', 'src/assets/audio/board-race-rock.ogg', 'src/assets/audio/board-race-rock.mp3'],
              'targetLufs': -16, 'truePeakCeilingDbTP': -2, 'edgeFadeMs': 8,
              'preserveCompleteArrangement': True, 'tracks': []}
    for name in NAMES:
        source = source_root / (name + '.mp3')
        source_hash = sha(source)
        info, pcm = probe(source), decode(source)
        duration = len(pcm)/96000
        old = previous.get(source.name)
        if old:
            if old['sha256'] != source_hash:
                raise ValueError('Original changed since analysis: ' + name)
            measured = {'integratedLufs': float(old['loudness']['input_i']), 'truePeakDbTP': float(old['loudness']['input_tp']),
                        'loudnessRangeLU': float(old['loudness']['input_lra']), 'samplePeakDbFS': old['samplePeakDbFS'], 'fullDecodeExit': old['fullDecodeExit']}
        else:
            measured = measure(source)
        gain = min(-16-measured['integratedLufs'], -2-measured['truePeakDbTP'])
        filters = f'volume={gain:.4f}dB,afade=t=in:st=0:d=0.008,afade=t=out:st={duration-.008:.8f}:d=0.008'
        row = {'name': name, 'source': {'file': source.name, 'sha256': source_hash, 'bytes': source.stat().st_size,
                'codec': info['streams'][0]['codec_name'], 'sampleRate': int(info['streams'][0]['sample_rate']),
                'channels': info['streams'][0]['channels'], 'containerDuration': float(info['format']['duration']),
                'decodedFrames': len(pcm)//2, 'decodedDuration': duration, **measured},
               'gainDb': gain, 'filter': filters, 'outputs': []}
        for extension, codec in [('ogg', ['-c:a', 'libvorbis', '-b:a', '160k']),
                                 ('mp3', ['-c:a', 'libmp3lame', '-b:a', '192k', '-write_xing', '1', '-id3v2_version', '3'])]:
            output = output_root / (name + '.' + extension)
            command = ['ffmpeg', '-v', 'error', '-nostdin', '-n', '-i', str(source), '-map', '0:a:0', '-vn',
                       '-map_metadata', '-1', '-ar', '48000', '-ac', '2', '-af', filters, *codec, str(output)]
            run(command)
            delivered, meta, levels = decode(output), probe(output), measure(output)
            if abs(len(delivered)-len(pcm))/96000 > .05:
                raise ValueError('Complete decoded duration changed: ' + output.name)
            if levels['truePeakDbTP'] > -1 or abs(levels['integratedLufs']+16) > .4:
                raise ValueError('Delivery loudness/peak outside preparation bounds: ' + output.name)
            boundary = max(abs(delivered[c]-delivered[-2+c]) for c in (0, 1))
            row['outputs'].append({'file': output.name, 'bytes': output.stat().st_size, 'sha256': sha(output),
                'codec': meta['streams'][0]['codec_name'], 'sampleRate': int(meta['streams'][0]['sample_rate']), 'channels': meta['streams'][0]['channels'],
                'containerDuration': float(meta['format']['duration']), 'decodedFrames': len(delivered)//2,
                'decodedDuration': len(delivered)/96000, 'boundaryJumpDbFS': 20*math.log10(max(boundary, 1e-12)),
                'completeSongWindows': windows(pcm, delivered), **levels,
                'command': [str(source.name) if arg == str(source) else output.name if arg == str(output) else arg for arg in command]})
        if sha(source) != source_hash:
            raise ValueError('Original was modified: ' + name)
        row['sourceUnchanged'] = True
        report['tracks'].append(row)
        print(json.dumps(row, ensure_ascii=False), flush=True)
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')


if __name__ == '__main__':
    main()
