// Fixed grading scenarios, independent of the website's editable demonstration.
export function bands(count, marks = 40) {
  return Array.from({ length: count }, (_, i) => {
    const low = Math.floor(i * (marks + 1) / count);
    const high = Math.floor((i + 1) * (marks + 1) / count) - 1;
    return low === high ? `${low}` : `${low}-${high}`;
  });
}

export function weightedRubric(count = 3) {
  const ranges = bands(count);
  const suffix = ranges.length ? ` | ${ranges.join(' | ')}` : '';
  const anchors = ranges.length ? ` | ${ranges.map((_, i) => `Level ${i + 1}, with a complete description`).join(' | ')}` : '';
  return `Research | 40 marks${suffix}\n  Evidence | 1${anchors}\n  Analysis | 2${anchors}\n\nReflection | 20 marks\n  Insight | 1\n  Plan | 3`;
}

export const decimalRubric = 'Decimal | 20.5 marks\n  First | .5\n  Second | 1.5';
export const capacityRubric = `Capacity | 11 marks | ${bands(12, 11).join(' | ')}\n${Array.from({ length: 200 }, (_, i) => `  Item${i + 1} | ${i % 2 ? '1.5' : '.5'} | ${Array(12).fill('Anchor').join(' | ')}`).join('\n')}`;
export const maximumCategories = Array.from({ length: 30 }, (_, i) => `Category ${i + 1} | 1 marks\n${Array.from({ length: i < 20 ? 7 : 6 }, (_, j) => `  Item ${i + 1}-${j + 1} | 1`).join('\n')}`).join('\n');
