import { strToU8, zipSync } from "fflate";
import type { Rubric } from "./rubric";

const STUDENT_CAPACITY = 100;
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function column(index: number): string {
  let result = "";
  for (let value = index; value > 0; value = Math.floor((value - 1) / 26)) {
    result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
  }
  return result;
}

function textCell(address: string, value: string, style = 0): string {
  // Inline strings prevent rubric labels beginning with =, +, - or @ from becoming formulas.
  return `<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function numberCell(address: string, value: number, style = 0): string {
  return `<c r="${address}" s="${style}"><v>${value}</v></c>`;
}

function blankCell(address: string, style: number): string {
  return `<c r="${address}" s="${style}"/>`;
}

function formulaCell(address: string, formula: string, style = 0): string {
  // A blank string cache avoids displaying zero before Excel's first recalculation.
  return `<c r="${address}" s="${style}" t="str"><f>${escapeXml(formula)}</f><v></v></c>`;
}

function row(index: number, cells: string[]): string {
  return `<row r="${index}">${cells.join("")}</row>`;
}

// Keep the existing style indices so this appearance-only change leaves formulas intact.
// Text format on roster inputs preserves identifiers such as 001; other values use General.
const cellStyles = Array.from({ length: 14 }, (_, index) => {
  const bold = [1, 2, 5, 6, 8, 9, 12].includes(index);
  const formula = [7, 9, 12, 13].includes(index);
  const editable = index === 3 || index === 4;
  return `<xf numFmtId="${index === 3 ? 49 : 0}" fontId="${bold ? 1 : 0}" fillId="${formula ? 2 : 0}" borderId="0" xfId="0"${editable ? ' applyProtection="1"' : ''}>${editable ? '<protection locked="0"/>' : ''}</xf>`;
}).join("");

const styles = `${XML_HEADER}<styleSheet xmlns="${NS}">
<fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2F0D9"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="14">${cellStyles}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function studentsSheet(): string {
  const rows = [
    row(1, [textCell("A1", "Student list", 1)]),
    row(2, [textCell("A2", "1. Enter up to 100 student names below. Student IDs are optional.", 10)]),
    row(3, [textCell("A3", "2. Open Grading and enter each subitem score as a number from 0 to 100.", 10)]),
    row(4, [textCell("A4", "Keep students in the same rows after marking starts. Do not sort or reorder names.", 10)]),
    row(5, [textCell("A5", "Blank names have no totals. Green cells contain protected formulas.", 10)]),
    row(7, [textCell("A7", "No.", 2), textCell("B7", "Student name", 2), textCell("C7", "Student ID (optional)", 2)]),
  ];
  for (let index = 0; index < STUDENT_CAPACITY; index += 1) {
    const r = index + 8;
    rows.push(row(r, [numberCell(`A${r}`, index + 1), blankCell(`B${r}`, 3), blankCell(`C${r}`, 3)]));
  }
  return `${XML_HEADER}<worksheet xmlns="${NS}"><dimension ref="A1:C107"/><sheetViews><sheetView showGridLines="1" workbookViewId="0"><pane ySplit="7" topLeftCell="A8" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${rows.join("")}</sheetData><sheetProtection sheet="1" objects="1" scenarios="1" formatColumns="0" formatRows="0" selectLockedCells="0" selectUnlockedCells="0"/></worksheet>`;
}

/** Create a standalone XLSX using only web-compatible APIs, including in a Worker. */
export async function createWorkbook(rubric: Rubric): Promise<Uint8Array> {
  const itemCount = rubric.components.reduce((sum, component) => sum + component.items.length, 0);
  if (!rubric.components.length || rubric.components.length > 30 || itemCount > 200) throw new Error("The rubric exceeds workbook limits.");
  const validValue = (value: number) => Number.isFinite(value) && value >= 0.000001 && value <= 1_000_000 && Math.round(value * 1_000_000) / 1_000_000 === value;
  for (const component of rubric.components) {
    if (!component.items.length || !validValue(component.marks) || component.items.some((item) => !validValue(item.weight))) {
      throw new Error("Each component needs a subitem. Marks and weights must be from 0.000001 to 1,000,000 with at most 6 decimal places.");
    }
  }
  const lastColumn = column(STUDENT_CAPACITY + 3);
  const rows = [
    row(1, [textCell("A1", "Grading workbook", 1)]),
    row(2, [textCell("A2", "Enter names on Students first. Each column below belongs to that student row.", 10)]),
    row(3, [textCell("A3", "Enter scores from 0 to 100, including decimals. Enter 80 for 80%. Green cells contain formulas.", 10)]),
    row(4, [textCell("A4", "Component marks = weighted average score / 100 × component marks. Weights are relative within each component.", 10)]),
    row(5, [textCell("A5", "Totals stay blank until all required scores are valid. Do not reorder student names after marking.", 10)]),
  ];
  const headers = [textCell("A7", "Criterion", 2), textCell("B7", "Weight", 2), textCell("C7", "Component marks", 2)];
  const ids = [textCell("A8", "Student ID (optional)", 11), blankCell("B8", 11), blankCell("C8", 11)];
  for (let index = 0; index < STUDENT_CAPACITY; index += 1) {
    const col = column(index + 4);
    const sourceRow = index + 8;
    headers.push(formulaCell(`${col}7`, `IF('Students'!B${sourceRow}="","",'Students'!B${sourceRow})`, 12));
    ids.push(formulaCell(`${col}8`, `IF('Students'!C${sourceRow}="","",'Students'!C${sourceRow})`, 13));
  }
  rows.push(row(7, headers), row(8, ids));

  let nextRow = 10;
  const sections: { heading: number; first: number; last: number; count: number; summary: number }[] = [];
  const inputRanges: string[] = [];
  for (const component of rubric.components) {
    const heading = nextRow;
    const cells = [textCell(`A${heading}`, component.name, 5), blankCell(`B${heading}`, 5), numberCell(`C${heading}`, component.marks, 6)];
    for (let index = 0; index < STUDENT_CAPACITY; index += 1) cells.push(blankCell(`${column(index + 4)}${heading}`, 5));
    rows.push(row(heading, cells));
    nextRow += 1;
    const first = nextRow;
    for (const item of component.items) {
      const itemCells = [textCell(`A${nextRow}`, item.name, 10), numberCell(`B${nextRow}`, item.weight), blankCell(`C${nextRow}`, 0)];
      for (let index = 0; index < STUDENT_CAPACITY; index += 1) itemCells.push(blankCell(`${column(index + 4)}${nextRow}`, 4));
      rows.push(row(nextRow, itemCells));
      nextRow += 1;
    }
    const last = nextRow - 1;
    sections.push({ heading, first, last, count: component.items.length, summary: 0 });
    inputRanges.push(`D${first}:${lastColumn}${last}`);
    nextRow += 1;
  }

  rows.push(row(nextRow, [textCell(`A${nextRow}`, "Marks earned", 8), textCell(`B${nextRow}`, "", 8), textCell(`C${nextRow}`, "Out of", 8)]));
  nextRow += 1;
  sections.forEach((section, index) => {
    section.summary = nextRow;
    const component = rubric.components[index];
    const cells = [textCell(`A${nextRow}`, component.name, 10), blankCell(`B${nextRow}`, 0), formulaCell(`C${nextRow}`, `$C$${section.heading}`, 7)];
    for (let student = 0; student < STUDENT_CAPACITY; student += 1) {
      const col = column(student + 4);
      const scores = `${col}${section.first}:${col}${section.last}`;
      const weights = `$B$${section.first}:$B$${section.last}`;
      // TYPE on individual cells also rejects logical values in spreadsheet engines
      // that coerce TRUE/FALSE to numbers inside range-based functions.
      const invalidTypes = Array.from({ length: section.count }, (_, item) => `TYPE(${col}${section.first + item})<>1`).join(",");
      const formula = `IF(${col}$7="","",IF(OR(COUNT(${scores})<>${section.count},${invalidTypes}),"",IF(OR(MIN(${scores})<0,MAX(${scores})>100),"",SUMPRODUCT(${scores},${weights})/SUM(${weights})/100*$C$${section.heading})))`;
      cells.push(formulaCell(`${col}${nextRow}`, formula, 7));
    }
    rows.push(row(nextRow, cells));
    nextRow += 1;
  });
  const totalCells = [textCell(`A${nextRow}`, "Final total", 8), blankCell(`B${nextRow}`, 8), formulaCell(`C${nextRow}`, `SUM(${sections.map((section) => `$C$${section.heading}`).join(",")})`, 9)];
  for (let student = 0; student < STUDENT_CAPACITY; student += 1) {
    const col = column(student + 4);
    const totals = sections.map((section) => `${col}${section.summary}`).join(",");
    totalCells.push(formulaCell(`${col}${nextRow}`, `IF(${col}$7="","",IF(COUNT(${totals})<>${sections.length},"",SUM(${totals})))`, 9));
  }
  rows.push(row(nextRow, totalCells));

  const grading = `${XML_HEADER}<worksheet xmlns="${NS}"><dimension ref="A1:${lastColumn}${nextRow}"/><sheetViews><sheetView showGridLines="1" workbookViewId="0"><pane xSplit="3" ySplit="8" topLeftCell="D9" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><sheetData>${rows.join("")}</sheetData><sheetProtection sheet="1" objects="1" scenarios="1" formatColumns="0" formatRows="0" selectLockedCells="0" selectUnlockedCells="0"/><dataValidations count="1"><dataValidation type="decimal" errorStyle="stop" operator="between" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="Enter a score from 0 to 100" error="Use a number from 0 to 100. For 80%, enter 80." promptTitle="Subitem score" prompt="Enter 0 to 100. Decimal scores are allowed." sqref="${inputRanges.join(" ")}"><formula1>0</formula1><formula2>100</formula2></dataValidation></dataValidations></worksheet>`;

  const files: Record<string, string> = {
    "[Content_Types].xml": `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    "_rels/.rels": `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `${XML_HEADER}<workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="Students" sheetId="1" r:id="rId1"/><sheet name="Grading" sheetId="2" r:id="rId2"/></sheets><calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`,
    "xl/_rels/workbook.xml.rels": `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": styles,
    "xl/worksheets/sheet1.xml": studentsSheet(),
    "xl/worksheets/sheet2.xml": grading,
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, contents]) => [name, strToU8(contents)])), { level: 6 });
}
