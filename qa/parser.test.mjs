import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRubric } from '../lib/rubric.ts';
import { weightedRubric, capacityRubric, maximumCategories } from './fixtures.mjs';

test('preserves positional anchors and literal commas even when ranges are unordered', () => {
  const rubric = parseRubric('Research | 10 marks | 8-10 | 0-3 | 4-7\n  Evidence | 2 | Clear, specific | Limited | Adequate');
  assert.deepEqual(rubric.components[0].ranges.map(r => r.label), ['8-10', '0-3', '4-7']);
  assert.deepEqual(rubric.components[0].items[0].anchors, ['Clear, specific', 'Limited', 'Adequate']);
  assert.equal(rubric.totalMarks, 10);
  assert.equal(rubric.components[0].items[0].weight, 2);
});

for (let count = 0; count <= 12; count++) {
  test(`accepts ${count} anchor bands alongside an unanchored category`, () => {
    const rubric = parseRubric(weightedRubric(count));
    assert.equal(rubric.components[0].ranges.length, count);
    assert.equal(rubric.components[1].ranges.length, 0);
    assert.equal(rubric.itemCount, 4);
    assert.equal(rubric.totalMarks, 60);
  });
}

test('accepts BOM, blank lines, CRLF, tabs and unanchored decimal marks', () => {
  const rubric = parseRubric('\uFEFFPart | 2.5 marks\r\n\r\n\tItem | .5\r\n');
  assert.equal(rubric.totalMarks, 2.5);
  assert.equal(rubric.components[0].items[0].weight, .5);
});

const invalidInputs = [
  ['empty', ''], ['orphan item', '  Item | 1'], ['missing marks unit', 'Part | 1\n  Item | 1'],
  ['empty category', 'Part | 1 marks'], ['empty intermediate category', 'Part | 1 marks\nNext | 1 marks\n  Item | 1'],
  ['mixed indentation', 'Part | 1 marks\n  First | 1\n\tSecond | 1'],
  ['nested indentation', 'Part | 1 marks\n    Item | 1'], ['one-space indentation', 'Part | 1 marks\n Item | 1'],
  ['empty label', 'Part | 1 marks\n  | 1'], ['long label', `${'P'.repeat(181)} | 1 marks\n  Item | 1`],
  ['control character', 'Part | 1 marks\n  Bad\u0001name | 1'], ['embedded tab', 'Part | 1 marks\n  Bad\tname | 1'],
  ['gap', 'Part | 10 marks | 0-3 | 5-10\n  Item | 1 | Low | High'],
  ['overlap', 'Part | 10 marks | 0-5 | 5-10\n  Item | 1 | Low | High'],
  ['missing zero', 'Part | 10 marks | 1-10\n  Item | 1 | High'],
  ['missing maximum', 'Part | 10 marks | 0-9\n  Item | 1 | Low'],
  ['reversed range', 'Part | 10 marks | 10-0\n  Item | 1 | Low'],
  ['fractional anchored marks', 'Part | 10.5 marks | 0-10\n  Item | 1 | Low'],
  ['missing anchor', 'Part | 10 marks | 0-3 | 4-10\n  Item | 1 | Low'],
  ['extra anchor', 'Part | 10 marks | 0-10\n  Item | 1 | Low | High'],
  ['empty anchor', 'Part | 10 marks | 0-10\n  Item | 1 | '],
  ['long anchor', `Part | 10 marks | 0-10\n  Item | 1 | ${'A'.repeat(181)}`],
  ['anchor without ranges', 'Part | 10 marks\n  Item | 1 | Low'],
  ['thirteen bands', `Part | 12 marks | ${Array.from({length:13},(_,i)=>i).join(' | ')}\n  Item | 1`],
  ['oversized text', 'x'.repeat(30001)],
  ['201 items', capacityRubric + '\n  Extra | 1 | ' + Array(12).fill('A').join(' | ')],
  ['31 categories', maximumCategories + '\nExtra | 1 marks\n  Item | 1'],
];
for (const [name, text] of invalidInputs) test(`rejects ${name}`, () => assert.throws(() => parseRubric(text)));

for (const token of ['0', '-1', '+1', 'NaN', 'Infinity', '1e309', '0x10', '1,000', '1/2', '100%', '=1+1', '0.0000001', '1000000.000001', '1.1234567']) {
  test(`rejects unsafe or unsupported marks and weights: ${token}`, () => {
    assert.throws(() => parseRubric(`Part | ${token} marks\n  Item | 1`));
    assert.throws(() => parseRubric(`Part | 1 marks\n  Item | ${token}`));
  });
}

test('accepts numeric and capacity boundaries', () => {
  for (const value of ['0.000001', '1000000', '999999.999999', '1.']) {
    assert.equal(parseRubric(`Part | ${value} marks\n  Item | ${value}`).totalMarks, Number(value));
  }
  assert.equal(parseRubric(capacityRubric).itemCount, 200);
  const maximum = parseRubric(maximumCategories);
  assert.equal(maximum.components.length, 30);
  assert.equal(maximum.itemCount, 200);
});
