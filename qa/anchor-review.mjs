import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {unzipSync,strFromU8} from 'fflate';
import {parseRubric} from '../lib/rubric.ts';
import {createWorkbook} from '../lib/workbook.ts';
const out = new URL('./anchor-review-output/',import.meta.url);
await fs.mkdir(out,{recursive:true});
const results=[];
const source=`Research | 40 marks | 31-40 | 0-10 | 21-30 | 11-20
  Evidence | 1 | Strong, clear evidence | Little or no evidence | Moderate evidence | Weak evidence
  Analysis | 2 | Thorough analysis | Little analysis | Sound analysis | Limited analysis
Presentation | 20 marks | 11-20 | 0-10
  Structure | 0.5 | Clear structure | Developing structure
  Clarity | 1.5 | Clear delivery | Developing delivery`;
const parsed=parseRubric(source);
assert.deepEqual(parsed.components[0].ranges.map(r=>r.label),['31-40','0-10','21-30','11-20']);
assert.equal(parsed.components[0].items[0].anchors[0],'Strong, clear evidence');
assert.equal(parsed.totalMarks,60);
results.push({name:'range order and comma labels',passed:true});
for(const [name,text] of [
 ['gap','A | 40 marks | 21-40 | 0-19\n  x | 1 | a | b'],
 ['overlap','A | 40 marks | 20-40 | 0-20\n  x | 1 | a | b'],
 ['missing zero','A | 40 marks | 1-40\n  x | 1 | a'],
 ['missing max','A | 40 marks | 0-39\n  x | 1 | a'],
 ['reversed range','A | 40 marks | 40-0\n  x | 1 | a'],
 ['decimal anchored marks','A | 40.5 marks | 0-40\n  x | 1 | a'],
 ['too few labels','A | 40 marks | 21-40 | 0-20\n  x | 1 | a'],
 ['too many labels','A | 40 marks | 21-40 | 0-20\n  x | 1 | a | b | c'],
 ['empty label','A | 40 marks | 21-40 | 0-20\n  x | 1 | a | '],
 ['zero weight','A | 40 marks\n  x | 0'],
 ['negative weight','A | 40 marks\n  x | -1'],
]){assert.throws(()=>parseRubric(text),undefined,name);results.push({name,passed:true});}
assert.equal(parseRubric('A | 20.5 marks\n  x | .5\n  y | 1.5').totalMarks,20.5);
results.push({name:'optional unanchored decimal marks and relative weights',passed:true});
const maximumInput=`Boundary | 11 marks | ${Array.from({length:12},(_,i)=>i).join(' | ')}\n${Array.from({length:200},(_,i)=>`  Item ${i+1} | .5 | ${Array.from({length:12},()=> 'Label').join(' | ')}`).join('\n')}`;
assert.equal(parseRubric(maximumInput).itemCount,200);
assert.throws(()=>parseRubric(maximumInput+'\n  Extra | .5 | '+Array.from({length:12},()=> 'Label').join(' | ')));
assert.throws(()=>parseRubric(`Boundary | 12 marks | ${Array.from({length:13},(_,i)=>i).join(' | ')}\n  Item | 1 | ${Array.from({length:13},()=> 'Label').join(' | ')}`));
results.push({name:'parser accepts 200 items and 12 bands; rejects item201 and band13',characters:maximumInput.length,passed:true});
const bytes=await createWorkbook(parsed); await fs.writeFile(new URL('standard.xlsx',out),bytes);
await fs.writeFile(new URL('source.txt',out),source);
const files=unzipSync(bytes); const xml=strFromU8(files['xl/worksheets/sheet2.xml']);
const sheet1=strFromU8(files['xl/worksheets/sheet1.xml']); const styles=strFromU8(files['xl/styles.xml']);
assert.equal((strFromU8(files['xl/workbook.xml']).match(/<sheet /g)||[]).length,2);
for(const sheet of [xml,sheet1])assert.doesNotMatch(sheet,/<cols|customHeight|ht=|<merge|<alignment/);
assert.doesNotMatch(styles,/<alignment|<color/);
assert.equal((styles.match(/<sz val="11"/g)||[]).length,2);
const validations=[...xml.matchAll(/<dataValidation [^>]*sqref="([^"]+)"[^>]*>/g)].map(m=>m[1]);
assert.deepEqual(validations,['D11:CY11','D16:CY16','D23:CY23','D26:CY26']);
assert.match(xml,/xSplit="3" ySplit="8"/);
assert.match(styles,/numFmtId="49"/);
for(const m of xml.matchAll(/<row r="(\d+)">([\s\S]*?)<\/row>/g)){
 if(/31-40 \||0-10 \||21-30 \||11-20 \|/.test(m[2]))assert.equal((m[2].match(/<c /g)||[]).length,1);
}
results.push({name:'two sheets, capacity, default dimensions, A-only anchors, freezes, text IDs, plain formatting',passed:true});
const injected=await createWorkbook(parseRubric('=1+1 | 1 marks | 0-1\n  @unsafe | 1 | =HYPERLINK("x", "y") & <tag>'));
const injectionXml=strFromU8(unzipSync(injected)['xl/worksheets/sheet2.xml']);
assert.match(injectionXml,/<c r="A10"[^>]*t="inlineStr"/); assert.match(injectionXml,/&amp; &lt;tag&gt;/);
assert.doesNotMatch(injectionXml,/<f>HYPERLINK/); results.push({name:'formula-looking labels and XML special characters remain literal',passed:true});
await fs.writeFile(new URL('decimal.xlsx',out),await createWorkbook(parseRubric('Decimal | 20.5 marks\n  First | .5\n  Second | 1.5')));
const longRanges=Array.from({length:12},(_,i)=>({min:i,max:i,label:String(i)}));
const stress={components:[{name:'Boundary',marks:11,ranges:longRanges,items:Array.from({length:200},(_,i)=>({name:`Item ${i+1}`,weight:i%2?1.5:.5,anchors:longRanges.map(()=> 'L'.repeat(180))}))}],totalMarks:11,itemCount:200};
const stressBytes=await createWorkbook(stress); await fs.writeFile(new URL('limit200.xlsx',out),stressBytes);
const stressXml=strFromU8(unzipSync(stressBytes)['xl/worksheets/sheet2.xml']);
const formulaLengths=[...stressXml.matchAll(/<f>(.*?)<\/f>/g)].map(m=>m[1].replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').length);
assert.ok(Math.max(...formulaLengths)<=8192);
results.push({name:'200 items, 12 bands, 180-character labels',longestFormula:Math.max(...formulaLengths),bytes:stressBytes.length,passed:true});
// Native engine assertions consume these exact row addresses.
await fs.writeFile(new URL('manifest.json',out),JSON.stringify({itemRows:[11,16,23,26],componentRows:[31,32],totalRow:33,stressItemRows:Array.from({length:200},(_,i)=>11+i*13),stressTotalRow:2614},null,2));
await fs.writeFile(new URL('static-results.json',out),JSON.stringify(results,null,2)); console.log(JSON.stringify(results,null,2));
