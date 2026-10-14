import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const toolPath=require.resolve('@oai/artifact-tool',{paths:['C:/Users/marcu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node']});
const {FileBlob,SpreadsheetFile}=await import(pathToFileURL(toolPath).href);
const out=new URL('./anchor-review-output/',import.meta.url);
const book=await SpreadsheetFile.importXlsx(await FileBlob.load(new URL('standard.xlsx',out).pathname.replace(/^\/(\w:)/,'$1')));
const roster=book.worksheets.getItem('Students');
const grading=book.worksheets.getItem('Grading');
roster.getRange('B8:C10').values=[['Weighted','001'],['Full','002'],['Zero','003']];
for(const [row,values] of [[11,[32,40,0]],[16,[36,40,0]],[23,[10,20,0]],[26,[20,20,0]]]) grading.getRange(`D${row}:F${row}`).values=[values];
book.recalculate();
const inspect=await book.inspect({kind:'table',range:'Grading!A30:G33',include:'values,formulas',tableMaxRows:4,tableMaxCols:7,maxChars:5000});
await fs.writeFile(new URL('artifact-inspect.ndjson',out),inspect.ndjson);console.log(inspect.ndjson);
for(const [sheetName,range,name] of [['Students','A7:F12','students'],['Grading','A7:G20','anchors'],['Grading','A30:G33','totals']]){
 const blob=await book.render({sheetName,range,scale:1.5,format:'png'});
 await fs.writeFile(new URL(`${name}-preview.png`,out),new Uint8Array(await blob.arrayBuffer()));
 console.log(`Rendered ${name}`);
}
