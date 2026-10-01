import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitIntoChunks } from '../src/text-chunker';

test('keeps paragraphs within the limit as separate chunks', () => {
  const a = 'あ'.repeat(150);
  const b = 'い'.repeat(150);
  assert.deepEqual(splitIntoChunks(`${a}\r\n\r\n${b}\r\n`, 120, 350), [a, b]);
});

test('merges short paragraphs into the following one', () => {
  const body = 'う'.repeat(200);
  assert.deepEqual(splitIntoChunks(`タイトル\n\n見出し\n\n${body}`, 120, 350), [
    `タイトル\n\n見出し\n\n${body}`,
  ]);
});

test('attaches a short trailing paragraph to the previous chunk', () => {
  const body = 'え'.repeat(200);
  assert.deepEqual(splitIntoChunks(`${body}\n\n以上です。`, 120, 350), [`${body}\n\n以上です。`]);
});

test('does not merge past the upper limit', () => {
  const short = 'お'.repeat(100);
  const long = 'か'.repeat(300);
  assert.deepEqual(splitIntoChunks(`${short}\n\n${long}`, 120, 350), [short, long]);
});

test('splits long paragraphs at sentence boundaries', () => {
  const sentence = `${'き'.repeat(99)}。`;
  const chunks = splitIntoChunks(sentence.repeat(5), 120, 350);
  assert.deepEqual(chunks, [sentence.repeat(3), sentence.repeat(2)]);
  assert.ok(chunks.every((c) => c.length <= 350));
});

test('drops empty paragraphs', () => {
  assert.deepEqual(splitIntoChunks('\n\n\n'), []);
});
