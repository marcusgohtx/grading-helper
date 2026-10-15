import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const passes of [false, true]) {
  test(`test command ${passes ? 'succeeds for passing checks' : 'propagates an assertion failure'}`, async () => {
    const base = path.join(root, 'qa', 'test-output');
    await fs.mkdir(base, { recursive: true });
    const directory = await fs.mkdtemp(path.join(base, 'runner-'));
    const fixture = path.join(directory, 'probe.test.mjs');
    await fs.writeFile(fixture, `import test from 'node:test'; import assert from 'node:assert/strict'; test('runner probe', () => assert.equal(1, ${passes ? 1 : 2}));`);
    const result = spawnSync(process.execPath, ['qa/run.mjs', '--portable', '--test-file', fixture], { cwd: root, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, passes ? 0 : 1, result.stdout + result.stderr);
    assert.match(result.stdout, /runner probe/, 'the runner must actually execute the selected test');
    assert.match(result.stdout, /Excel.*SKIPPED/i);
  });
}
