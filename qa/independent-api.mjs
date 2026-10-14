import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
const directory = new URL('./independent-output/',import.meta.url);
const routeSource = await fs.readFile(new URL('../app/api/workbook/route.ts',import.meta.url),'utf8');
// Load the real route with only its Next alias imports resolved for Node's test runner.
const routeTestPath = new URL('route-under-test.ts',directory);
await fs.writeFile(routeTestPath,routeSource.replaceAll('"@/lib/rubric"','"../../lib/rubric.ts"').replaceAll('"@/lib/workbook"','"../../lib/workbook.ts"'));
const { POST } = await import(routeTestPath.href);
const results = [];
const rubric = 'Presentation | 40 marks\n  Content | 2\n  Delivery | 1\nReport | 60 marks\n  Analysis | 1';
for (const [name,body,status] of [
  ['invalid JSON','{',400],['null','null',400],['array','[]',400],
  ['missing rubric','{}',400],['numeric rubric','{"rubric":3}',400],
  ['empty rubric','{"rubric":""}',400],
  ['bad syntax',JSON.stringify({rubric:'No separator'}),400],
  ['oversized rubric',JSON.stringify({rubric:'a'.repeat(30001)}),400],
  ['oversized request',' '.repeat(60001),413],
  ['huge numeric value',JSON.stringify({rubric:`A | 1${'0'.repeat(308)} marks\n  x | 1`}),400],
]) {
  const response=await POST(new Request('http://localhost/api/workbook',{method:'POST',body}));
  assert.equal(response.status,status,name);
  const payload=await response.json();
  assert.equal(typeof payload.error,'string',name);
  results.push({name,status:response.status});
}
const response=await POST(new Request('http://localhost/api/workbook',{method:'POST',body:JSON.stringify({rubric})}));
assert.equal(response.status,200);
assert.match(response.headers.get('content-type'),/application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet/);
assert.equal(response.headers.get('content-disposition'),'attachment; filename="grading-workbook.xlsx"');
assert.equal(response.headers.get('cache-control'),'no-store');
const bytes=new Uint8Array(await response.arrayBuffer());
const files=unzipSync(bytes);
assert.equal(Object.keys(files).length,7);
assert.match(strFromU8(files['xl/workbook.xml']),/sheet name="Students"/);
assert.match(strFromU8(files['xl/workbook.xml']),/sheet name="Grading"/);
await fs.writeFile(new URL('api.xlsx',directory),bytes);
results.push({name:'valid workbook',status:200,bytes:bytes.length});
await fs.writeFile(new URL('api-results.json',directory),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
