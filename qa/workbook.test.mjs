import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkbook } from '../lib/workbook.ts';
import { parseRubric } from '../lib/rubric.ts';
import { weightedRubric, capacityRubric, maximumCategories } from './fixtures.mjs';
import { openWorkbook, elements, attr, cells, text, column } from './xlsx.mjs';

test('Example student has editable in-range sample scores and leaves 100 real students blank', async () => {
  for (const input of [weightedRubric(3), 'Tiny | 0.000001 marks\n  Item | 1', capacityRubric]) {
    const rubric = parseRubric(input);
    const book = openWorkbook(await createWorkbook(rubric));
    const roster = cells(book.sheets[0]), grades = cells(book.sheets[1]);
    assert.equal(text(roster.get('B8')), 'Example');
    for (let row = 9; row <= 108; row++) assert.equal(text(roster.get(`B${row}`)), '');
    const count = Math.max(...rubric.components.map(c => c.ranges.length));
    const first = count ? count + 5 : 4;
    for (const component of rubric.components) for (const item of component.items) {
      const label = [...grades.values()].find(c => attr(c, 'r').startsWith('A') && text(c) === item.name);
      const row = attr(label, 'r').slice(1);
      const sample = grades.get(`${column(first)}${row}`);
      const score = Number(elements(sample, 'v')[0]?.textContent);
      assert.ok(Number.isFinite(score) && score >= 0 && score <= component.marks);
      assert.equal(attr(elements(book.styles[Number(attr(sample, 's'))], 'protection')[0], 'locked'), '0');
      for (let student = 1; student <= 100; student++) assert.equal(elements(grades.get(`${column(first + student)}${row}`), 'v').length, 0);
    }
  }
});

for (let count = 0; count <= 12; count++) {
  test(`${count} bands: readable workbook, horizontal anchors and 100 linked student columns`, async () => {
    const book = openWorkbook(await createWorkbook(parseRubric(weightedRubric(count))));
    const [students, grading] = book.sheets;
    assert.deepEqual(elements(book.documents['xl/workbook.xml'], 'sheet').map(n => attr(n, 'name')), ['Students', 'Grading']);
    const roster = cells(students), grades = cells(grading);
    const firstStudent = count ? count + 5 : 4;
    const names = elements(grading, 'row').find(n => attr(n, 'r') === '7');
    assert.equal(elements(names, 'f').length, 101);
    const item = Array.from(grades.values()).find(c => attr(c, 'r').startsWith('A') && text(c) === 'Evidence');
    const row = Number(attr(item, 'r').slice(1));
    for (const position of [1, 50, 100]) {
      const col = column(firstStudent + position);
      assert.match(elements(grades.get(`${col}7`), 'f')[0].textContent, new RegExp(`'Students'!B${position + 8}`));
      assert.match(elements(grades.get(`${col}8`), 'f')[0].textContent, new RegExp(`'Students'!C${position + 8}`));
      assert.equal(attr(elements(book.styles[Number(attr(grades.get(`${col}${row}`), 's'))], 'protection')[0], 'locked'), '0');
      assert.equal(attr(elements(book.styles[Number(attr(roster.get(`C${position + 8}`), 's'))], 'protection')[0], 'locked'), '0');
      assert.equal(attr(book.styles[Number(attr(roster.get(`C${position + 8}`), 's'))], 'numFmtId'), '49');
    }
    for (let i = 0; i < count; i++) {
      const anchor = grades.get(`${column(4 + i)}${row}`);
      assert.equal(text(anchor), `Level ${i + 1}, with a complete description`);
      const style = book.styles[Number(attr(anchor, 's'))];
      assert.equal(attr(elements(style, 'alignment')[0], 'wrapText'), '1');
      assert.equal(attr(elements(style, 'protection')[0], 'locked'), '0');
    }
    const scoreValidations = elements(grading, 'dataValidation').filter(n => attr(n, 'sqref').startsWith(column(firstStudent)));
    assert.equal(scoreValidations.length, 4);
    assert.deepEqual(scoreValidations.map(n => attr(n, 'type')), ['decimal', 'decimal', 'decimal', 'decimal']);
    assert.deepEqual(scoreValidations.map(n => elements(n, 'formula2')[0].textContent), ['40', '40', '20', '20']);
    for (const validation of scoreValidations) {
      assert.equal(attr(validation, 'errorStyle'), 'stop');
      assert.equal(attr(validation, 'showErrorMessage'), '1');
      assert.match(attr(validation, 'error'), /0 to (40|20)/);
    }
    const flags = elements(grading, 'conditionalFormatting');
    assert.equal(flags.length, 2, 'invalid pasted scores flagged in both categories');
    for (const flag of flags) {
      const rule = elements(flag, 'cfRule')[0];
      assert.equal(attr(rule, 'type'), 'expression');
      const dxf = elements(book.documents['xl/styles.xml'], 'dxf')[Number(attr(rule, 'dxfId'))];
      assert.equal(attr(elements(dxf, 'fgColor')[0], 'rgb'), 'FFFFC7CE');
    }
    assert.equal(attr(elements(grading, 'pane')[0], 'topLeftCell'), 'D9');
    assert.equal(attr(elements(grading, 'pane')[0], 'xSplit'), '3');
    assert.equal(attr(elements(grading, 'pane')[0], 'ySplit'), '8');
    assert.equal(attr(elements(students, 'pane')[0], 'topLeftCell'), 'A8');
    assert.equal(attr(elements(grading, 'sheetProtection')[0], 'insertRows'), '0');
    for (const sheet of book.sheets) {
      assert.equal(elements(sheet, 'col').length, 0, 'default column widths');
      assert.equal(elements(sheet, 'mergeCell').length, 0);
      for (const r of elements(sheet, 'row')) assert.equal(r.hasAttribute('ht'), false, 'no fixed row heights');
      for (const c of elements(sheet, 'c').filter(c => elements(c, 'f').length)) {
        const style = book.styles[Number(attr(c, 's'))];
        const fill = elements(book.documents['xl/styles.xml'], 'fill')[Number(attr(style, 'fillId'))];
        assert.equal(attr(elements(fill, 'fgColor')[0], 'rgb'), 'FFE2F0D9');
        assert.notEqual(attr(elements(style, 'protection')[0], 'locked'), '0');
        assert.equal(elements(c, 'v')[0].textContent, '', 'blank formula cache before recalculation');
      }
    }
    assert.ok(Object.keys(book.archive).every(path => !/externalLink|vbaProject/.test(path)));
  });
}

test('formula-like labels and XML special characters remain plain text', async () => {
  const input = '=SUM(A1) & <tag> | 1 marks | 0-1\n  @Literal "quotes" | 1 | =HYPERLINK("x", "y") & <tag>';
  const book = openWorkbook(await createWorkbook(parseRubric(input)));
  for (const label of ['=SUM(A1) & <tag>', '@Literal "quotes"', '=HYPERLINK("x", "y") & <tag>']) {
    const cell = elements(book.sheets[1], 'c').find(c => text(c) === label);
    assert.ok(cell);
    assert.equal(attr(cell, 't'), 'inlineStr');
    assert.equal(elements(cell, 'f').length, 0);
  }
});

test('largest accepted rubrics export within Excel formula limits', async () => {
  for (const input of [capacityRubric, maximumCategories]) {
    const book = openWorkbook(await createWorkbook(parseRubric(input)));
    assert.ok(elements(book.sheets[1], 'f').every(f => f.textContent.length <= 8192));
    assert.equal(elements(book.sheets[1], 'dataValidation').filter(n => attr(n, 'errorTitle') === 'Invalid subitem score').length, 200);
  }
});

test('generator rejects invalid direct callers as well as parsed text', async () => {
  const valid = parseRubric(weightedRubric(3));
  for (const mutate of [r => r.components.splice(0), r => r.components[0].items.splice(0), r => r.components[0].marks = Infinity,
    r => r.components[0].items[0].weight = 0, r => r.components[0].items[0].anchors.pop(), r => r.components[0].ranges[0].min = 1]) {
    const rubric = structuredClone(valid); mutate(rubric);
    await assert.rejects(() => createWorkbook(rubric));
  }
});
