import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { generateFixtures } from './generate-fixtures.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
let portable = false, requireExcel = false, selectedFile;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--portable') portable = true;
  else if (args[i] === '--require-excel') requireExcel = true;
  else if (args[i] === '--test-file' && args[i + 1]) selectedFile = path.resolve(args[++i]);
  else throw new Error(`Unknown or incomplete option: ${args[i]}`);
}
if (portable && requireExcel) throw new Error('--portable and --require-excel cannot be combined.');
const output = path.join(root, 'qa', 'test-output');
await fs.mkdir(output, { recursive: true });
const directory = await fs.mkdtemp(path.join(output, 'run-'));
const summary = { typescript: 'not run', portable: 'not run', excel: 'not run', output: directory };
let failed = false;
function execute(command, arguments_) {
  // A fresh Node test process must not inherit the parent's test-worker marker.
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  const result = spawnSync(command, arguments_, { cwd: root, env: environment, stdio: 'inherit', windowsHide: true });
  if (result.error) console.error(result.error.message);
  return result.status ?? 1;
}
try {
  if (!selectedFile) {
    summary.typescript = execute(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit']) === 0 ? 'passed' : 'failed';
    failed ||= summary.typescript === 'failed';
  }
  const files = selectedFile ? [selectedFile] : (await fs.readdir(path.join(root, 'qa')))
    .filter(name => name.endsWith('.test.mjs')).sort().map(name => path.join(root, 'qa', name));
  if (!files.length) throw new Error('No test files found.');
  const code = execute(process.execPath, ['--import', './qa/register.mjs', '--test', '--test-reporter=spec', ...files]);
  summary.portable = code === 0 ? 'passed' : 'failed';
  failed ||= code !== 0;
  if (portable || (selectedFile && !requireExcel) || process.platform !== 'win32' || failed) {
    summary.excel = `SKIPPED: ${portable ? 'portable mode requested' : selectedFile && !requireExcel ? 'focused test run' : failed ? 'earlier checks failed' : 'Windows with Microsoft Excel required'}`;
  } else {
    await generateFixtures(directory);
    const excelCode = execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'qa', 'isolated-excel.ps1'), '-OutputDirectory', directory]);
    summary.excel = excelCode === 0 ? 'passed' : 'failed';
    failed ||= excelCode !== 0;
  }
  if (requireExcel && summary.excel !== 'passed') failed = true;
} catch (error) {
  summary.error = error.message; failed = true;
} finally {
  summary.passed = !failed;
  await fs.writeFile(path.join(directory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(`\nTypeScript: ${summary.typescript}\nPortable tests: ${summary.portable}\nExcel: ${summary.excel}\nReport: ${path.join(directory, 'summary.json')}`);
  if (summary.error) console.error(summary.error);
  process.exitCode = failed ? 1 : 0;
}
