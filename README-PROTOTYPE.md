# Grading helper prototype

This working prototype replaces the earlier specification's broad web marking workflow with one rubric input and an Excel download.

Run `npm run dev` from this directory. Submit posts the rubric to `/api/workbook`, which validates it and generates a real `.xlsx` file.

Use `Component | 40 marks` on unindented lines and `  Sub-item | 2` on indented lines. Every component needs at least one sub-item. Weights are positive relative numbers, and do not need to sum to 100.

The workbook contains Students and Grading sheets. Enter up to 100 students, then enter each sub-item score from 0 to 100. Component scores use weighted averages scaled to the component's marks. Final totals remain blank until grading is complete. Do not reorder the roster after entering grades.

No student data is uploaded. Only rubric text is sent to the server. The app has no persistence.
