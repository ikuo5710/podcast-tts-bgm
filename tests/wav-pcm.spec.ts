import { test } from 'node:test';
import assert from 'node:assert/strict';
import { concatPcm, parseWav } from '../src/wav-pcm';

function chunk(id: string, body: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.write(id, 0, 'latin1');
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body, body.length & 1 ? Buffer.alloc(1) : Buffer.alloc(0)]);
}

function wav(pcm: Buffer, trailing: Buffer[] = []): Buffer {
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0);
  fmt.writeUInt16LE(1, 2);
  fmt.writeUInt32LE(24000, 4);
  fmt.writeUInt32LE(48000, 8);
  fmt.writeUInt16LE(2, 12);
  fmt.writeUInt16LE(16, 14);
  const body = Buffer.concat([Buffer.from('WAVE', 'latin1'), chunk('fmt ', fmt), chunk('data', pcm), ...trailing]);
  return chunk('RIFF', body);
}

test('parseWav returns only the data chunk, ignoring a trailing C2PA chunk', () => {
  const pcm = Buffer.from([1, 0, 2, 0, 3, 0]);
  const parsed = parseWav(wav(pcm, [chunk('C2PA', Buffer.from('metadata'))]));
  assert.deepEqual(parsed, { channels: 1, sampleRate: 24000, bitDepth: 16, pcm });
});

test('parseWav rejects non-WAV input', () => {
  assert.throws(() => parseWav(Buffer.from('not a wav file')));
});

test('concatPcm inserts silence between parts', () => {
  const fmt = { channels: 1, sampleRate: 10, bitDepth: 16 };
  const a = { ...fmt, pcm: Buffer.from([1, 1]) };
  const b = { ...fmt, pcm: Buffer.from([2, 2]) };
  const merged = concatPcm([a, b], 0.2);
  assert.deepEqual([...merged.pcm], [1, 1, 0, 0, 0, 0, 2, 2]);
});

test('concatPcm rejects mismatched formats', () => {
  const a = { channels: 1, sampleRate: 24000, bitDepth: 16, pcm: Buffer.alloc(2) };
  assert.throws(() => concatPcm([a, { ...a, sampleRate: 48000 }], 0.5));
});
