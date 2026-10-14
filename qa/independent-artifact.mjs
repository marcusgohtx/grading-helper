import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const toolPath = require.resolve('@oai/artifact-tool', { paths: ['C:/Users/marcu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node'] });
const { FileBlob, SpreadsheetFile } = await import(pathToFileURL(toolPath).href);
const directory = new URL('./independent-output/', import.meta.url);
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(new URL('standard.xlsx', directory).pathname.replace(/^\/(\w:)/,'$1')));
const students = workbook.worksheets.getItem('Students');
const grading = workbook.worksheets.getItem('Grading');
students.getRange('B8').values = [['First student']];
grading.getRange('D11:D12').values = [[80],[60]];
grading.getRange('D15').values = [[90]];
workbook.recalculate();
const result = await workbook.inspect({kind:'table',range:'Grading!A18:F20',include:'values,formulas',tableMaxRows:3,tableMaxCols:6,maxChars:4000});
await fs.writeFile(new URL('artifact-results.ndjson',directory),result.ndjson);
console.log(result.ndjson);
for (const [sheetName, range] of [['Students','A1:C12'],['Grading','A1:H20']]) {
  const blob = await workbook.render({sheetName,range,scale:1.5,format:'png'});
  await fs.writeFile(new URL(`${sheetName.toLowerCase()}-preview.png`,directory),new Uint8Array(await blob.arrayBuffer()));
}
