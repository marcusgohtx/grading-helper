import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const runtimeRequire = createRequire("C:/Users/marcu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json");
const { FileBlob, SpreadsheetFile } = await import(pathToFileURL(runtimeRequire.resolve("@oai/artifact-tool")).href);
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(new URL("./output/grading.xlsx", import.meta.url).pathname.replace(/^\//, "")));
workbook.recalculate();
for (const [sheetName, range] of [["Students", "A1:C15"], ["Grading", "A1:H21"]]) {
  const preview = await workbook.render({ sheetName, range, scale: 1.5, format: "png" });
  await fs.writeFile(new URL(`./output/${sheetName.toLowerCase()}.png`, import.meta.url), new Uint8Array(await preview.arrayBuffer()));
}
console.log("Rendered both sheets for visual inspection.");
