# Grading helper prototype

<!-- impeccable:product-schema 1 -->

## Platform

web

## Purpose

Lecturers enter core grading components and weighted sub-items in a single text box, then download an Excel workbook. This prototype follows the user's simplified October 2026 request, which supersedes the earlier grading-helper-specification.md for this implementation.

## Workflow

Unindented components have maximum marks. Indented sub-items have relative weights. Submit runs a backend workbook generator. Sheet 1 contains a student roster. Sheet 2 lists criteria vertically and students horizontally, with component and final totals at the bottom.

## Prototype assumptions

Sub-item scores use a 0 to 100 scale. Component marks equal the weighted average divided by 100 and multiplied by the component maximum. Unmarked items remain incomplete. The workbook supports 100 students. These implementation defaults are stated on the page and in the workbook.

## Constraints

Keep the interface very simple. No accounts within the app, saved rubrics, student uploads, automated grading or feedback system. Sites supplies private access. Student names and scores are entered in the downloaded workbook.

## Stack

Sites Vinext starter with a server route and a small OOXML generator. This stack supports the explicitly requested backend generation and GPT Site hosting.
