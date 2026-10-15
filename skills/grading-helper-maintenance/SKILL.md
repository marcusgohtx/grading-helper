---
name: grading-helper-maintenance
description: Maintain the grading-helper application's rubric parser, Excel generator, demo and QA. Use for changes or bug fixes in this repository, including verifying workbook calculations and synchronizing an authorized release. Not for grading students or general spreadsheet tasks.
---

Work from the selected grading-helper checkout. All paths below are relative to that checkout's root. Read `PRODUCT.md` for product constraints, `README-PROTOTYPE.md` for syntax and scoring, and `qa/README.md` before choosing verification. Keep the requested change bounded; a demo edit does not require changes to scoring.

## Behavior changes and TDD

Use `mattpocock-skills:tdd` when available. The existing test boundaries are `parseRubric`, the real `POST /api/workbook` handler and the exported workbook opened in an XML reader or Microsoft Excel. They are established for this repository; agree any new boundary with the user before adding tests there.

For new behavior or a bug, add one failing regression at the relevant boundary, run it to observe the intended failure, make the smallest fix, then run it again. Continue one behavior at a time. For consolidation of existing tests, retain their behavioral coverage and demonstrate that the runner propagates failures. Record the red and green results accurately; a test that began green is characterization, not a new regression caught by TDD.

Use fixed rubrics from `qa/fixtures.mjs`, independent of the website demo. Expected calculated scores come from worked examples, not by translating the production formula into test code. Resolve application imports with the QA loader; keep the route source unchanged and unmocked.

## Workbook invariants

- Each sub-item is scored out of its parent category's marks. Category scores are weighted averages; the final total sums category scores. There is no extra percentage conversion.
- Anchor descriptions match ranges by position, even when ranges are entered out of order. Commas are text, pipes delimit fields. Anchored scores are whole numbers; unanchored scores may be decimals.
- A missing or invalid required score, name or weight leaves totals incomplete. Zero is a valid score. Literal labels that look like formulas remain text.
- Criteria are vertical, anchors horizontal and students occupy columns. Formula cells are protected and green; anchor descriptions wrap. Preserve plain formatting, native row sizing and frozen headers.
- New criteria inserted as entire rows above a category's marker participate in totals. New top-level categories require regenerating the workbook. Preserve that distinction unless the user requests a change.

## Verify and finish

Run `npm test`. On Windows this includes the full native Excel suite through `qa/isolated-excel.ps1`, which uses a separate off-screen desktop. Never replace that isolation with `Visible = false`, switch to the test desktop, attach to the user's Excel, or fall back to the working desktop. Preserve process ownership checks, timeout and cleanup. Changes to formulas, row insertion, validation or workbook protection need native verification; use `npm.cmd test -- --require-excel` to require it. In PowerShell, use `npm.cmd` when passing test flags so npm's PowerShell wrapper cannot swallow them. A portable pass does not verify Excel calculations: report any native skip and its reason. If native testing cannot run, finish portable work and identify the remaining verification without claiming completion of that coverage.

For interface or default-example changes, also check the browser preview and actual download. Backend handler tests do not exercise the browser or hosted routing. Keep student data out of test fixtures; use synthetic roster names.

Use the existing Sites skill/tools for authorized live updates and the configured GitHub remote for authorized pushes. A GitHub push does not deploy Sites. For a release to both destinations, verify that the saved Sites version and GitHub branch identify the same commit. A QA-only request does not itself require republishing the website.

Report the changed behavior, test results including skips, and which destinations were updated. Keep temporary rubric review notes local; document accepted product decisions in the maintained project docs.
