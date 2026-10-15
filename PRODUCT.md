# Grading helper prototype

<!-- impeccable:product-schema 1 -->

## Platform

web

## Purpose

Lecturers enter categories, weighted sub-items and scoring anchors in a single text box, then download an Excel workbook. The simplified October 2026 user request supersedes the earlier grading-helper-specification.md.

## Workflow

Unindented categories specify maximum marks and score ranges. Indented sub-items specify weights and matching anchor labels. Labels match ranges by position; commas are ordinary text and pipes separate fields. Download Excel runs a backend generator. Students holds the roster. Grading lists criteria vertically, wrapped anchors horizontally on each sub-item row, then student score columns. Category rows show anchor ranges. Criterion names, weights and anchor descriptions can be edited; totals are protected at the bottom. Insert whole rows above a category's marked end row to add criteria that are automatically included in totals. New top-level categories require regenerating the workbook.

## Scoring

Each sub-item is scored out of its category maximum. The category result is the weighted average of its sub-item scores. Final marks sum the category results. Anchored ranges use inclusive whole numbers and cover zero to the maximum without gaps or overlaps. Ranges and labels may be omitted together. All scores may contain halves and decimals from zero to the category maximum; anchor ranges remain whole-number reference labels. Unmarked or invalid inputs keep totals incomplete. An Example student starts with sample scores, followed by 100 blank student slots.

## Constraints

Keep the page simple and the workbook plain. Keep 11-point fonts and default column widths. Anchor text wraps and Excel fits its row height; bold headers and green formula cells provide emphasis. Invalid score entries are rejected; pasted invalid scores are flagged red and keep totals blank. No student uploads, automated grading or saved data. The Site is publicly accessible. Students and grades stay in the downloaded workbook.

## Stack

Sites Vinext starter, server route and fflate OOXML generator.
