import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateManifest } from '../src/manifest.mjs';

const valid = { schemaVersion: 1, name: 'Garden', description: 'Track plant care.', entryUrl: 'https://example.com/app', iconUrl: 'https://example.com/icon.png', termsUrl: 'https://example.com/terms' };
test('complete publication metadata validates', () => assert.deepEqual(validateManifest(valid), []));
test('missing publication fields are reported together', () => {
  const fields = validateManifest({ schemaVersion: 1 }).map(x => x.field);
  assert.deepEqual(fields, ['name', 'description', 'entryUrl', 'iconUrl', 'termsUrl']);
});
test('credential and unsafe URLs are rejected without leaking contents', () => {
  for (const entryUrl of ['javascript:alert(1)', 'http://example.com', 'https://user:secret@example.com', ' https://example.com', null]) {
    const issues = validateManifest({ ...valid, entryUrl });
    assert.equal(issues[0].field, 'entryUrl');
    assert.ok(!JSON.stringify(issues).includes('secret'));
  }
});
test('capability declarations are unique and cannot be arbitrary objects', () => {
  for (const capabilities of [['storage.read', 'storage.read'], [{}], 'storage.read']) {
    assert.equal(validateManifest({ ...valid, capabilities })[0].field, 'capabilities');
  }
});
test('CLI returns actionable exit codes and machine-readable validation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lo-doctor-'));
  try {
    const path = join(dir, 'lo.app.json');
    await writeFile(path, JSON.stringify(valid));
    let result = spawnSync(process.execPath, ['bin/lo.mjs', 'doctor', path, '--json'], { encoding: 'utf8' });
    assert.equal(result.status, 0);
    assert.deepEqual(JSON.parse(result.stdout), { ok: true, issues: [] });
    await writeFile(path, '{invalid');
    result = spawnSync(process.execPath, ['bin/lo.mjs', 'doctor', path, '--json'], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).ok, false);
    result = spawnSync(process.execPath, ['bin/lo.mjs', 'publish'], { encoding: 'utf8' });
    assert.equal(result.status, 2);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
