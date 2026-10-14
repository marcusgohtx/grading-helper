import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { parseRubric } from '../lib/rubric.ts';
import { createWorkbook } from '../lib/workbook.ts';

const directory = new URL('./independent-output/', import.meta.url);
await fs.mkdir(directory, { recursive: true });
const checks = [];
function pass(name, run) { run(); checks.push(name); }
const standard = 'A | 40 marks\n  one | 2\n  two | 1\nB | 60 marks\n  three | 1';
pass('ordinary decimal marks and trailing dot accepted', () => assert.equal(parseRubric('A | 2.50 marks\n  x | 1.').totalMarks, 2.5));
pass('blank lines and CR line endings accepted', () => assert.equal(parseRubric('\rA | 40 marks\r\r  x | 1\r').totalMarks, 40));
for (const token of ['-0', '+1', '1,000', '0x10', '1/2', '100%', '=1+1', '1e309', '0.0']) {
  pass(`invalid numeric token ${token}`, () => assert.throws(() => parseRubric(`A | 1 marks\n  x | ${token}`)));
}
for (const [name, text] of [
  ['missing separator', 'A 40 marks\n  x | 1'],
  ['tab and space indentation', 'A | 40 marks\n \tx | 1'],
  ['embedded extra separator', 'A | 40 marks\n  x | y | 1'],
  ['dangling empty component', 'A | 40 marks\n  x | 1\nB | 1 marks'],
]) pass(name, () => assert.throws(() => parseRubric(text)));
for (const value of ['0.000001','1000000','0.5','999999.999999']) {
  pass(`numeric boundary ${value} accepted`, () => assert.equal(parseRubric(`A | ${value} marks\n  x | ${value}`).totalMarks, Number(value)));
}
for (const value of ['0.0000001','1000000.000001','1.1234567']) {
  pass(`numeric boundary ${value} rejected`, () => assert.throws(() => parseRubric(`A | ${value} marks\n  x | 1`)));
  pass(`weight boundary ${value} rejected`, () => assert.throws(() => parseRubric(`A | 1 marks\n  x | ${value}`)));
}

await fs.writeFile(new URL('standard.xlsx', directory), await createWorkbook(parseRubric(standard)));
await fs.writeFile(new URL('literal-labels.xlsx',directory),await createWorkbook(parseRubric('=SUM(A1) & <tag> | 40 marks\n  +Literal "quotes" | 1\n-Label | 60 marks\n  @Literal | 1')));
const extremes = [
  ['large-weight', `A | 40 marks\n  x | 1${'0'.repeat(307)}\n  y | 1`],
  ['tiny-weight', `A | 40 marks\n  x | 0.${'0'.repeat(309)}1`],
  ['large-marks', `A | 1${'0'.repeat(308)} marks\n  x | 1`],
  ['tiny-marks', `A | 0.${'0'.repeat(309)}1 marks\n  x | 1`],
];
const extremeResults = [];
for (const [name, text] of extremes) {
  try {
    const rubric = parseRubric(text);
    await fs.writeFile(new URL(`${name}.xlsx`, directory), await createWorkbook(rubric));
    extremeResults.push({ name, accepted: true, marks: rubric.totalMarks, weight: rubric.components[0].items[0].weight });
  } catch(error) {
    extremeResults.push({ name, accepted: false, error: error.message });
    await fs.rm(new URL(`${name}.xlsx`, directory), { force: true });
  }
}
const result = { checks, extremeResults };
await fs.writeFile(new URL('parser-results.json', directory), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
