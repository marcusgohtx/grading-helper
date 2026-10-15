import fs from 'node:fs/promises';
import path from 'node:path';
import { parseRubric } from '../lib/rubric.ts';
import { createWorkbook } from '../lib/workbook.ts';
import { weightedRubric, decimalRubric, capacityRubric } from './fixtures.mjs';

export async function generateFixtures(directory) {
  await fs.mkdir(directory, { recursive: true });
  const fixtures = [...Array.from({ length: 13 }, (_, n) => [`bands-${n}`, weightedRubric(n)]), ['decimal', decimalRubric], ['capacity', capacityRubric]];
  for (const [name, text] of fixtures) await fs.writeFile(path.join(directory, `${name}.xlsx`), await createWorkbook(parseRubric(text)));
  return fixtures.length;
}
