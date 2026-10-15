import { DOMParser } from '@xmldom/xmldom';
import { unzipSync, strFromU8 } from 'fflate';

export const elements = (node, name) => Array.from(node.getElementsByTagName(name));
export const attr = (node, name) => node?.getAttribute(name);
export function openWorkbook(bytes) {
  const archive = unzipSync(bytes);
  const documents = {};
  for (const [name, data] of Object.entries(archive)) {
    if (/\.(xml|rels)$/.test(name)) {
      documents[name] = new DOMParser({onError: (level, message) => { throw new Error(`${name}: ${level}: ${message}`); }})
        .parseFromString(strFromU8(data), 'application/xml');
    }
  }
  const sheets = [1, 2].map(n => documents[`xl/worksheets/sheet${n}.xml`]);
  const styles = elements(elements(documents['xl/styles.xml'], 'cellXfs')[0], 'xf');
  return { archive, documents, sheets, styles };
}
export const cells = sheet => new Map(elements(sheet, 'c').map(cell => [attr(cell, 'r'), cell]));
export const text = cell => elements(cell, 't').map(n => n.textContent).join('');
export function column(index) {
  let result = '';
  for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result;
  return result;
}
