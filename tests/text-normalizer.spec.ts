import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  flattenParentheses,
  normalizeForTts,
  removeDigitGroupSeparators,
} from '../src/text-normalizer';

test('removes digit group separators', () => {
  assert.equal(removeDigitGroupSeparators('4,000以上のアプリ'), '4000以上のアプリ');
  assert.equal(removeDigitGroupSeparators('1,234,567円'), '1234567円');
  assert.equal(removeDigitGroupSeparators('１，２００人'), '１２００人');
});

test('keeps commas that are not digit group separators', () => {
  assert.equal(removeDigitGroupSeparators('1,2,3'), '1,2,3');
  assert.equal(removeDigitGroupSeparators('12,3456'), '12,3456');
  assert.equal(removeDigitGroupSeparators('Slack, Teams'), 'Slack, Teams');
});

test('turns parenthetical notes into comma-delimited phrases', () => {
  assert.equal(
    flattenParentheses('ユーザーの承認（自動レビュー）が求められます。'),
    'ユーザーの承認、自動レビュー、が求められます。',
  );
  assert.equal(
    flattenParentheses('管理機能（Agent 365など）との統合'),
    '管理機能、Agent 365など、との統合',
  );
});

test('does not double punctuation around parentheses', () => {
  assert.equal(flattenParentheses('対応します（予定）。'), '対応します、予定。');
  assert.equal(flattenParentheses('、(補足)、'), '、補足、');
  assert.equal(flattenParentheses('空（）です'), '空です');
});

test('normalizeForTts applies all rules', () => {
  assert.equal(
    normalizeForTts('4,000以上（約4,500）のアプリ'),
    '4000以上、約4500、のアプリ',
  );
});
