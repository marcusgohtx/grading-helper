# Grading helper prototype

This prototype turns rubric text into a plain Excel grading workbook.

Run `npm run dev` from this directory. Download Excel posts the rubric to `/api/workbook`.

## Syntax

```text
Research | 40 marks | 31-40 | 21-30 | 11-20 | 0-10
  Evidence | 1 | Strong evidence | Moderate evidence | Weak evidence | Little or no evidence
  Analysis | 2 | Thorough, well-supported analysis | Sound analysis | Limited analysis | Little or no analysis
```

Category lines specify maximum marks and inclusive whole-number ranges. Each indented sub-item supplies its relative weight and one label per range, in the same order. Commas are normal label text. The pipe is reserved as a separator. Use two spaces or one tab consistently for sub-items. Each category needs a sub-item. Ranges must cover zero through the maximum without gaps or overlaps. A single score, such as `0`, is also a valid range.

Ranges and labels may be omitted together. Such categories allow decimal scores. Every sub-item is scored out of its category's maximum, including when ranges are omitted.

## Calculations

Component score = sum(sub-item score × weight) / sum(weights).
Final score = sum(component scores).

For Research out of 40, scores 32 and 36 with weights 1 and 2 give 34.6666667 out of 40. There is no percentage conversion. Graders enter exact scores; descriptions are reference anchors. A range permits any whole-number score within it.

## Workbook

Students contains up to 100 names and optional IDs. Grading has students across columns and criteria down rows, with anchor descriptions beneath their sub-items and totals at the bottom. Totals stay blank until all required inputs are valid. Do not reorder names after grading begins.

Use default row heights and column widths, 11-point text, bold headers and green formula cells. No merged cells, borders, wrapping or other display styling. Users may resize rows and columns. Formula cells stay protected. IDs use text input formatting to retain leading zeros.

The Site is public. Only rubric text is sent to the server. Student names and scores are entered in the Excel file. The app has no persistence.
