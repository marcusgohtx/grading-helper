# Independent workbook QA

Tested 14 October 2026 against the final `TYPE(cell)<>1` formula guard and numeric limits of 0.000001 to 1,000,000 with at most six decimal places.

No unresolved defect was found in the cases below. Browser submission, deployment and private hosting access are covered by the parent task, not this workbook QA.

- Parser: 25 independent syntax and boundary checks passed. Four extra dangerous numeric cases now reject: marks or weights near 1e308 and 1e-310.
- API route: 11 direct handler cases passed. Valid input returns a readable XLSX with the expected content type, attachment filename and no-store cache header. Invalid JSON, invalid request shapes, empty or malformed rubrics, excessive rubric/request length and extreme numeric input return 400 or 413. The test loads the current route source with only its import aliases resolved for Node; it does not establish hosted HTTP behavior.
- Native Microsoft Excel: a separate hidden instance opened a disposable generated workbook and recalculated it. All 13 scenarios passed: weighted scores, all-zero scores, missing score, numeric text, negative value, score over 100, decimals, text, absent student name, TRUE() logical formula, spreadsheet error formula, and students 50 and 100. Leading-zero IDs remained text. The instance was closed after testing.
- Example calculation: scores 80 and 60 with weights 2 and 1 earn 29.33333333333333 of 40. Score 90 earns 54 of 60. Final total is 83.33333333333333. Decimal case returned 84.33333333333334, within 1e-9 of the independent expected result.
- XML and openpyxl: both sheets load, all XML parts parse, 100 roster rows map to columns D through CY, first/middle/last references are correct, frozen panes are present, formulas are green and locked, input cells are unlocked with no fill, decimal validation covers only score rows, and totals follow all scoring rows. Formula-looking labels beginning with =, +, - and @ remain escaped literal strings. No external-link or macro parts are present.
- Artifact Tool: independently recalculated the example to the same component and final values. Both sheet previews were rendered and visually reviewed. Text, headers, inputs and totals were readable in the inspected ranges. The render process returned exit code 1 after producing the results and PNG files without a diagnostic; native Excel supplies the primary recalculation evidence.

Two defects found during testing were corrected by the workbook implementation agent and retested: unsafe extreme numeric inputs, and LibreOffice coercion of logical values in range-based numeric checks. The final per-cell TYPE checks passed native Excel, and the implementation agent reports its separate LibreOffice 13-scenario rerun passed.

Scripts: `independent-boundaries.mjs`, `independent-api.mjs`, `independent-xml.py`, `independent-excel.ps1`, and `independent-artifact.mjs`. Samples and evidence are in `independent-output/`; these are QA artifacts, not application assets.
