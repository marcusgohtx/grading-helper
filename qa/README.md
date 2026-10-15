# Grading helper QA

Run from the repository root after `npm ci`, with Node 22.13 or newer:

```sh
npm test
```

This command checks TypeScript and runs Node's test suite. On Windows, it also runs all native Excel checks on a separate off-screen Windows desktop. It never switches your desktop or attaches to your open Excel workbooks. No network calls, real student data or live deployments are used.

Failures return a nonzero exit code. On Windows, missing Excel, isolation failure or a ten-minute native timeout fails the full run. No fallback can launch Excel on your working desktop. Non-Windows runs explicitly report native checks as **SKIPPED**, never as a calculation pass. Reports and generated workbooks are saved under ignored `qa/test-output/run-*` directories.

```sh
npm test -- --portable
npm test -- --require-excel
npm test -- --portable --test-file qa/parser.test.mjs
```

`--portable` skips native Excel. `--require-excel` fails unless native checks pass, including on unsupported platforms. Native verification is needed before releasing changes to formulas, insertion, validation or protection. The two flags cannot be combined. `--test-file` runs one test file and omits TypeScript and native Excel for a focused TDD loop, unless `--require-excel` is also supplied.

In Windows PowerShell, replace `npm` with `npm.cmd` in commands with flags. This avoids npm's PowerShell wrapper swallowing the arguments. For example, use `npm.cmd test -- --require-excel`.

## Desktop isolation

The Windows launcher creates a uniquely named desktop with `CreateDesktop` and starts its worker and a new Excel `/x` process there using `STARTUPINFO.lpDesktop`. It does not call `SwitchDesktop`. The worker attaches through the owned process's `EXCEL7` window, verifies its process ID and desktop, and then runs the existing native assertions. It does not use COM activation or a global running-Excel lookup. Excel can activate sheets within that desktop without exposing their windows on the user's desktop.

Windows job objects contain only the worker and its descendants. Closing them cleans up those processes on success, failure or timeout. Isolation evidence is saved in `isolation-results.json`; detailed formula results remain in `native-excel-results.json`. No workbook changes are saved.

Run the isolation tests in an interactive Windows session with `$env:QA_TEST_ISOLATION='1'; node --test qa/isolation.test.mjs`. They deliberately show a disposable window on the off-screen desktop and verify that the worker refuses the input desktop. They do not start Excel. Without that environment variable, these two tests are explicitly skipped. The native run itself always verifies desktop isolation.

The full suite requires Windows desktop access and a registered Excel installation. Sandboxed environments may block desktop creation. Office can still hang on a dialog inside its isolated desktop; the timeout reports failure and cleans up the owned processes. Microsoft documents these automation limitations in [unattended Office automation](https://learn.microsoft.com/en-us/office/client-developer/integration/considerations-unattended-automation-office-microsoft-365-for-unattended-rpa).

## Coverage and limits

| Boundary | Covered | Not established |
| --- | --- | --- |
| Rubric parser | Syntax, positive weights, range coverage/order, positional labels, commas, 0-12 bands, precision and resource limits | Browser input behavior |
| Real download handler | Valid attachment and readable validation errors, size limits, cache headers | Hosted routing or browser downloads |
| Exported XLSX | XML parsing, two sheets, 100 roster links, every anchor count, horizontal wrapped anchors, plain formatting, protection, freezes, validation and literal labels | Recalculated values |
| Native Excel | Weighted totals, zero/missing/invalid inputs, decimals, first/middle/last students, inserted rows, inherited validation/protection and wrapping | Other spreadsheet engines and browser layout |
| Test command | Executes passing/failing probes and propagates assertion failures | Live deployment |
| Windows isolation | Off-screen visible-window probe, refusal of input desktop, owned Excel process and desktop verification | Other Windows/Office configurations not tested locally |

Fixtures are maintained separately from `app/page.tsx`. Workbook tests find cells from labels and exported metadata; they do not assert a particular formula implementation. Native expected totals are worked examples with literal expected results. Native Excel remains the authority for calculation and row-insertion behavior.

The older `anchor-review-*`, `independent-*`, `test-workbook.mjs`, rendering scripts and reports have been superseded. Their historical versions remain in Git history. The new suite generates its own inputs and does not depend on their ignored output folders, a personal filesystem path, Python or LibreOffice.

## Extending the suite

For a behavior change, choose the existing boundary that exposes it, add one failing case, observe the failure, implement the smallest fix, and rerun. Use the maintenance skill in `skills/grading-helper-maintenance/SKILL.md` for repository-specific constraints. Tests for new behavior belong in the relevant `.test.mjs` file or in `native-excel.ps1` when calculation is the observable result. Keep native checks serial because Excel COM is not a parallel test fixture.

GitHub Actions runs the portable command on Linux and Windows. Hosted runners do not provide a licensed desktop Excel installation, so their green status is not a native calculation pass.
