import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
test('a visible test window is confined to an off-screen desktop and its process exits', {
  skip: process.platform !== 'win32' || process.env.QA_TEST_ISOLATION !== '1',
}, async () => {
  const base = path.join(root, 'qa/test-output');
  await fs.mkdir(base, { recursive: true });
  const directory = await fs.mkdtemp(path.join(base, 'isolation-'));
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', 'qa/isolated-excel.ps1', '-OutputDirectory', directory, '-Probe'], {
    cwd: root, encoding: 'utf8', windowsHide: true, timeout: 60000,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const report = JSON.parse((await fs.readFile(path.join(directory, 'isolation-results.json'), 'utf8')).replace(/^\uFEFF/, ''));
  assert.equal(report.passed, true);
  assert.notEqual(report.desktop, report.inputDesktop);
  assert.equal(report.probeVisibleOnIsolatedDesktop, true);
  assert.equal(report.workerExited, true);
});

test('the native worker refuses the input desktop before creating a window or Excel', {
  skip: process.platform !== 'win32' || process.env.QA_TEST_ISOLATION !== '1',
}, async () => {
  const base = path.join(root, 'qa/test-output');
  await fs.mkdir(base, { recursive: true });
  const directory = await fs.mkdtemp(path.join(base, 'isolation-refusal-'));
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', 'qa/isolated-excel-worker.ps1', '-OutputDirectory', directory, '-DesktopName', 'Default', '-Probe'], {
    cwd: root, encoding: 'utf8', windowsHide: true, timeout: 30000,
  });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const report = JSON.parse((await fs.readFile(path.join(directory, 'isolation-results.json'), 'utf8')).replace(/^\uFEFF/, ''));
  assert.equal(report.passed, false);
  assert.match(report.error, /Worker desktop isolation failed/);
  assert.equal(report.excelProcessId, undefined);
});
