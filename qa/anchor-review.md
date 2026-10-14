# Independent anchor review

Reviewed on 2026-10-14 against the anchor implementation in `lib/rubric.ts`, `lib/workbook.ts`, `app/page.tsx`, and the real API route. QA scripts and disposable evidence are under `qa/anchor-review*`.

No confirmed implementation defects remain in the checks completed below. A potential formula size/argument issue seen while the implementation was changing is resolved in the stable generator and passed the native 200-item test.

## Parser and workbook structure

`node --experimental-strip-types qa/anchor-review.mjs` passed 17 checks. The independent fixture uses a 40-mark component and a 20-mark component with weights 1, 2, 0.5 and 1.5. It puts the 40-mark ranges in the order 31-40, 0-10, 21-30, 11-20. The parser preserves that order and the corresponding comma-containing labels.

The parser rejects gaps, overlaps, missing zero or maximum, descending endpoints, fractional ranged marks, too few/many/empty descriptions, and zero/negative weights. A component without ranges accepts decimal marks and weights. A 22,361-character input with 200 items and 12 bands parses successfully. Item 201 and band 13 are rejected.

ZIP/XML inspection confirms Students and Grading sheets, D:CY score columns, per-item whole-number validations, frozen grading headers and first three columns, text-formatted roster inputs, 11-point fonts, bold emphasis and green formula fills. There are no custom row heights, column widths, merges, alignments, or colored fonts. Description rows contain only literal column-A cells. Formula-looking names and descriptions, commas, ampersands and XML brackets remain strings.

A direct generator stress fixture with 200 items, 12 single-score bands, and 180-character descriptions produced a 143,223-byte XLSX. Its longest decoded formula is 3,310 characters, below Excel's 8,192-character limit. This fixture intentionally calls the generator directly because the parser's separate 30,000-character input limit prevents all these maximum label lengths occurring together in a submitted rubric.

## Native Excel recalculation

`powershell -NoProfile -File qa/anchor-review-excel.ps1` ran in a separate hidden Excel application with macros disabled. The sandbox initially denied COM activation. The approved retry completed and closed its own instance. `anchor-review-output/native-results.json` records 26 passing checks.

- Research scores 32 and 36 with weights 1 and 2 recalculate to 34.666666666666664 out of 40.
- Adding the 20-mark component scores 10 and 20 with weights 0.5 and 1.5 gives 52.166666666666664 out of 60.
- All full scores give 60. Complete zeros give 0.
- Missing input, numeric text, ordinary text, Excel errors, booleans, negatives, values above the parent maximum, fractional anchored scores, and missing names give blank final totals.
- Student 1, student 50 and student 100 names link to the correct columns. IDs `0001`, `0050` and `00100` retain their leading zeros.
- Ranged input cells have whole-number validation, score cells are editable, formula cells and descriptions are protected.
- An unanchored 20.5-mark component accepts scores 10.25 and 20.5 with weights 0.5 and 1.5 and recalculates to 17.9375. Its validation is decimal with maximum 20.5.
- The 200-item, 12-band workbook recalculates full scores to 11. Alternating scores 10 and 11 with weights 0.5 and 1.5 give 10.75. A fraction or boolean in the last item makes its total blank.

## API and website source

`node --experimental-strip-types qa/anchor-review-api.mjs` imports the actual route after resolving only its TypeScript path aliases. Four cases pass. Anchored and optional decimal rubrics return XLSX with the expected media type and no-store header. A gap and a label count mismatch return HTTP 400 with line-specific messages.

The website source matches the revised input syntax, positional label preview, explicit category maximum, weight meaning, A-only anchor examples, two sheets and 100 students. The Research example displays the correct rounded totals, 34.67 and 30.67. The submit path creates the XLSX download and retains a download-again link. Invalid parser output disables submission.

I inspected `.impeccable/review/anchor-desktop.png` and `.impeccable/review/anchor-mobile.png`. The syntax guide, sample, comma-containing labels, weighted preview, and expanded Research anchor descriptions match. The mobile layout stacks the preview below the editor and wraps the rubric within its scrollable text area. No visible overlap or source/preview mismatch appears in the captured views. Live deployment review is pending parent coordination.

## Visual evidence and limits

Artifact Tool imports and renders representative ranges in `students-preview.png`, `anchors-preview.png`, and `totals-preview.png`. I inspected the anchor and total PNGs. They show the expected plain styling, source range order, comma labels, blank spacer rows, and green formula cells. Default-width columns clip the long component header, consistent with the user's explicit request for no custom dimensions.

Artifact Tool's recalculation returned blank component totals for the populated review copy and its preview coerced linked text IDs. Its rendered totals are therefore layout evidence only. The separate native Excel recalculation above verifies numerical results and text ID behavior. The render command wrote all three PNGs but exited with status 1 without a further diagnostic. No workbook produced by Artifact Tool is being delivered or used by the site.

An additional hidden Excel check in `anchor-review-save.ps1` confirms Excel can save a disposable copy through SaveCopyAs. `native-saved.xlsx` contains the populated native workbook. I inspected `native-totals.png`, rendered by Poppler from Excel's own `native-totals.pdf` export. It shows native component values 40 and 20 and final total 60 in green formula cells. The source opened read-only in this COM session, so a saved copy was used for this verification. The generated workbook source was not altered.
