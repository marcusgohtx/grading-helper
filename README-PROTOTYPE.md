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

## Default demo

The default rubric has three 10-mark categories: Photo annotations & critique, Suggested improvements & sketch, and Rationale write-up. It covers one example, totals 30 marks and uses three bands: 0-3, 4-7 and 8-10. Its relative weights are illustrative, not an official assignment marking scheme. AI-related criteria and deductions are excluded from the demo.

## Calculations

Component score = sum(sub-item score × weight) / sum(weights).
Final score = sum(component scores).

For Research out of 40, scores 32 and 36 with weights 1 and 2 give 34.6666667 out of 40. There is no percentage conversion. Graders enter exact scores; descriptions are reference anchors. A range permits any whole-number score within it.

## Workbook

Students contains up to 100 names and optional IDs. Grading has criteria down rows and anchors across columns beside each sub-item. Component rows show the matching ranges. Criterion names, weights, anchor descriptions and student scores are editable. The widest category determines the number of anchor columns. Totals stay at the bottom and remain blank until all required inputs are valid. Do not reorder names after grading begins. The first three columns stay frozen while anchors and students scroll horizontally.

Keep default column widths, 11-point text, bold headers and green formula cells. Anchor descriptions wrap; Excel fits their row heights automatically. No merged cells, borders or extra display styling. Users may resize rows and columns. Formula cells stay protected. IDs use text input formatting to retain leading zeros.

When anchors are present, a protected separator column separates reference descriptions from student scores.

## Adding criteria in Excel

Select the row number of a category's “Insert new criteria above this row” marker and insert an entire blank row above it. Enter the new criterion name, positive weight, optional anchor descriptions and student scores. The category and final totals automatically include the inserted row. Missing or invalid names, weights or scores keep totals blank. Edit existing weights directly to change their relative contributions.

Keep category headings and insertion markers in place. New top-level categories or additional anchor columns require editing the website rubric and generating a new workbook. Do not insert cells with a partial-column shift; insert whole rows.

The Site is public. Only rubric text is sent to the server. Student names and scores are entered in the Excel file. The app has no persistence.
