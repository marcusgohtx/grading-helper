---
name: Grading helper
description: Rubric entry and Excel workbook download.
colors:
  paper: "#fbfaf7"
  ink: "#25362f"
  muted: "#64716a"
  line: "#dce1d9"
  primary: "#1d6555"
  primary-dark: "#174e42"
  error: "#a03728"
typography:
  heading:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "clamp(28px, 3.7vw, 38px)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "15px"
    lineHeight: 1.55
  rubric:
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace'
    fontSize: "14px"
    lineHeight: 1.78
rounded:
  field: "8px"
  button: "7px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.button}"
    padding: "12px 21px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
---

# Design system: Grading helper

## Overview

A small task utility centered on one rubric textbox and a bottom Download Excel button. Keep the interface sparse, with clear instructions and a read-only preview. Use plain wording and no marketing sections.

## Colors

Warm paper surrounds a white editing field. Dark green ink carries primary text. Restrained teal marks links, the Download Excel button, and the total. Muted text supports instructions. Rust identifies errors in text as well as field borders.

## Typography

Use the system sans stack for the interface. Reserve monospace for rubric syntax. Headings use 600 weight with tight tracking. Supporting labels range from 11px to 15px. The rubric field uses 14px text, increased to 16px on mobile to avoid focus zoom.

## Layout

The container is 1136px wide including 40px side padding. At 1400px it expands to 1196px. Desktop pairs the flexible editor with a 287px preview and a 36px gap. At 800px, use 26px side padding and a 235px preview. At 640px, stack the preview below the editor and use 20px side padding. The Download Excel button fills the mobile width.

## Elevation & Depth

Use 1px borders and surface colors for separation. No decorative shadows. The textarea focus state adds a 2px pale green focus treatment around a teal border. Buttons and links receive a 3px teal focus outline with a 5px offset.

## Shapes

The syntax guide and field share 8px outer corners. The primary button uses a 7px radius. Small labels use 4px or 5px corners. Dividers separate content without card containers.

## Components

The textarea stays dominant and resizes vertically. Its guide shows a component, marks, indented sub-item, and weight. Preview rows show relative weights and component marks. Invalid text receives a line-specific explanation from the shared parser and disables submission.

Download Excel changes to a loading state while the workbook is generated. Errors explain the failure. Success provides another download link. Sample replacement requires an inline confirmation after edits. Tab keeps its normal focus behavior.

## Do's and Don'ts

- Do keep one rubric textbox and one primary action.
- Do show keyboard focus and readable error messages.
- Do label example content as a sample.
- Use compact spreadsheet examples for workbook instructions. Avoid decorative imagery and marketing copy.
- Don't add student data fields to the web page. Student names and scores belong in the workbook.

