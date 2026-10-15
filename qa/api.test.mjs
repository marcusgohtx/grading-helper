import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { POST } from '../app/api/workbook/route.ts';

test('download API returns an Excel attachment for a weighted rubric', async () => {
  const response = await POST(new Request('http://localhost/api/workbook', {
    method: 'POST', body: JSON.stringify({ rubric: 'Research | 40 marks\n  Evidence | 1\n  Analysis | 2' }),
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="grading-workbook.xlsx"');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
  assert.match(strFromU8(files['xl/workbook.xml']), /name="Students"/);
  assert.match(strFromU8(files['xl/workbook.xml']), /name="Grading"/);
});

for (const [name, body, status] of [
  ['invalid JSON', '{', 400], ['null', 'null', 400], ['array', '[]', 400],
  ['missing rubric', '{}', 400], ['numeric rubric', '{"rubric":3}', 400],
  ['empty rubric', '{"rubric":""}', 400],
  ['malformed rubric', JSON.stringify({rubric: 'No separator'}), 400],
  ['oversized rubric', JSON.stringify({rubric: 'a'.repeat(30001)}), 400],
  ['oversized request', ' '.repeat(60001), 413],
  ['gap', JSON.stringify({rubric: 'A | 10 marks | 0-3 | 5-10\n  Item | 1 | Low | High'}), 400],
  ['missing anchor', JSON.stringify({rubric: 'A | 10 marks | 0-3 | 4-10\n  Item | 1 | Low'}), 400],
]) {
  test(`download API rejects ${name} with a readable error`, async () => {
    const response = await POST(new Request('http://localhost/api/workbook', {method: 'POST', body}));
    assert.equal(response.status, status);
    assert.ok((await response.json()).error.length > 0);
  });
}
