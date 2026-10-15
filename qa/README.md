# Grading helper QA

Run from the repository root after `npm ci`, with Node 22.13 or newer:

```sh
npm test
```

This command checks TypeScript, runs Node's test suite, then opens disposable generated fixtures in a separate hidden Microsoft Excel instance on Windows. It closes its own workbooks and Excel instance without touching an existing user session. No network calls, real student data or live deployments are used.

Failures return a nonzero exit code. Excel unavailability is explicitly reported as **SKIPPED**, never as a calculation pass. Reports and generated workbooks are saved under ignored `qa/test-output/run-*` directories.

```sh
npm test -- --portable
npm test -- --require-excel
npm test -- --portable --test-file qa/parser.test.mjs
```

`--portable` intentionally skips native Excel. `--require-excel` fails unless native checks pass; use it before releasing changes to formulas, insertion, validation or protection. The two flags cannot be combined. `--test-file` runs one test file and omits the full TypeScript check for a focused TDD loop.

In Windows PowerShell, replace `npm` with `npm.cmd` in commands with flags. This avoids npm's PowerShell wrapper swallowing the arguments. For example, use `npm.cmd test -- --require-excel`.

## Coverage and limits

| Boundary | Covered | Not established |
| --- | --- | --- |
| Rubric parser | Syntax, positive weights, range coverage/order, positional labels, commas, 0-12 bands, precision and resource limits | Browser input behavior |
| Real download handler | Valid attachment and readable validation errors, size limits, cache headers | Hosted routing or browser downloads |
| Exported XLSX | XML parsing, two sheets, 100 roster links, every anchor count, horizontal wrapped anchors, plain formatting, protection, freezes, validation and literal labels | Recalculated values |
| Native Excel | Weighted totals, zero/missing/invalid inputs, decimals, first/middle/last students, inserted rows, inherited validation/protection and wrapping | Other spreadsheet engines and browser layout |
| Test command | Executes passing/failing probes and propagates assertion failures | Live deployment |

Fixtures are maintained separately from `app/page.tsx`. Workbook tests find cells from labels and exported metadata; they do not assert a particular formula implementation. Native expected totals are worked examples with literal expected results. Native Excel remains the authority for calculation and row-insertion behavior.

The older `anchor-review-*`, `independent-*`, `test-workbook.mjs`, rendering scripts and reports have been superseded. Their historical versions remain in Git history. The new suite generates its own inputs and does not depend on their ignored output folders, a personal filesystem path, Python or LibreOffice.

## Extending the suite

For a behavior change, choose the existing boundary that exposes it, add one failing case, observe the failure, implement the smallest fix, and rerun. Use the maintenance skill in `skills/grading-helper-maintenance/SKILL.md` for repository-specific constraints. Tests for new behavior belong in the relevant `.test.mjs` file or in `native-excel.ps1` when calculation is the observable result. Keep native checks serial because Excel COM is not a parallel test fixture.

GitHub Actions runs the portable command on Linux and Windows. Hosted runners do not provide a licensed desktop Excel installation, so their green status is not a native calculation pass.
