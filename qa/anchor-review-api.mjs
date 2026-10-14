import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {unzipSync,strFromU8} from 'fflate';
const out=new URL('./anchor-review-output/',import.meta.url);
const source=await fs.readFile(new URL('../app/api/workbook/route.ts',import.meta.url),'utf8');
const testPath=new URL('route-under-test.ts',out);
await fs.writeFile(testPath,source.replaceAll('"@/lib/rubric"','"../../lib/rubric.ts"').replaceAll('"@/lib/workbook"','"../../lib/workbook.ts"'));
const {POST}=await import(testPath.href);
const results=[];
for(const [name,rubric,status] of [
 ['Anchored',await fs.readFile(new URL('source.txt',out),'utf8'),200],
 ['Gap','A | 40 marks | 21-40 | 0-19\n  Evidence | 1 | Strong | Weak',400],
 ['Label count','A | 40 marks | 21-40 | 0-20\n  Evidence | 1 | Strong',400],
 ['Optional decimals','A | 20.5 marks\n  Evidence | .5',200]
]){
 const response=await POST(new Request('http://localhost/api/workbook',{method:'POST',body:JSON.stringify({rubric})}));
 assert.equal(response.status,status,name);
 if(status===200){
  assert.match(response.headers.get('content-type'),/spreadsheetml/);
  assert.equal(response.headers.get('cache-control'),'no-store');
  const bytes=new Uint8Array(await response.arrayBuffer());
  assert.match(strFromU8(unzipSync(bytes)['xl/workbook.xml']),/sheet name="Grading"/);
 }else{assert.match((await response.json()).error,/Line 1:|Line 2:/)}
 results.push({name,status,passed:true});
}
await fs.writeFile(new URL('api-results.json',out),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
