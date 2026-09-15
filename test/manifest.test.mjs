import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, mkdir, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateManifest } from '../src/manifest.mjs';

const valid = { schemaVersion: 1, name: 'Garden', description: 'Track plant care.', entryUrl: 'https://example.com/app', iconUrl: 'https://example.com/icon.png', termsUrl: 'https://example.com/terms' };
test('draft and complete publication metadata validate in their respective modes', () => {
  assert.deepEqual(validateManifest({ schemaVersion: 1, name: 'Draft', entryUrl: 'https://example.com/app' }), []);
  assert.deepEqual(validateManifest(valid, { publication: true }), []);
});
test('draft fields and publication-only fields are reported separately', () => {
  const fields = validateManifest({ schemaVersion: 1 }).map(x => x.field);
  assert.deepEqual(fields, ['name', 'entryUrl']);
  const publicationFields = validateManifest({ schemaVersion: 1 }, { publication: true }).map(x => x.field);
  assert.deepEqual(publicationFields, ['name', 'entryUrl', 'description', 'iconUrl', 'termsUrl']);
});
test('credential, fragmented, oversized and unsafe URLs are rejected without leaking contents', () => {
  for (const entryUrl of ['javascript:alert(1)', 'http://example.com', 'https:example.com', 'https://@example.com', 'https://user:secret@example.com', 'https://example.com/#private', 'https://example.com/%zz', `https://example.com/${'я'.repeat(1015)}`, null]) {
    const issues = validateManifest({ ...valid, entryUrl });
    assert.equal(issues[0].field, 'entryUrl');
    assert.ok(!JSON.stringify(issues).includes('secret'));
  }
  const prefix = 'https://example.com/';
  assert.deepEqual(validateManifest({ ...valid, entryUrl: prefix + 'a'.repeat(2048 - Buffer.byteLength(prefix)) }), []);
  assert.deepEqual(validateManifest({ ...valid, entryUrl: ' https://example.com/app ', privacyUrl: '' }), []);
});
test('URL normalization cannot turn a missing authority or backslash into a valid host', () => {
  for (const entryUrl of ['https:///example.com/app', 'https:////example.com/app', 'https://example.com\\app']) {
    assert.equal(validateManifest({ ...valid, entryUrl })[0].field, 'entryUrl');
  }
});
test('text limits count Unicode code points rather than UTF-16 units', () => {
  assert.deepEqual(validateManifest({ ...valid, name: '🌱'.repeat(64), description: '🌵'.repeat(512) }), []);
  assert.equal(validateManifest({ ...valid, name: '🌱'.repeat(65) })[0].field, 'name');
  assert.equal(validateManifest({ ...valid, description: '🌵'.repeat(513) })[0].field, 'description');
});
test('publication mode reports each malformed field once', () => {
  const issues = validateManifest({ ...valid, description: null, iconUrl: 'http://example.com/icon', termsUrl: false }, { publication: true });
  assert.deepEqual(issues.map(issue => issue.field), ['description', 'iconUrl', 'termsUrl']);
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
    await writeFile(path, JSON.stringify({ schemaVersion: 1, name: 'Draft', entryUrl: 'https://example.com/app' }));
    result = spawnSync(process.execPath, ['bin/lo.mjs', 'doctor', path, '--publish', '--json'], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.deepEqual(JSON.parse(result.stdout).issues.map(issue => issue.field), ['description', 'iconUrl', 'termsUrl']);
    await writeFile(path, '{invalid');
    result = spawnSync(process.execPath, ['bin/lo.mjs', 'doctor', path, '--json'], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).ok, false);
    result = spawnSync(process.execPath, ['bin/lo.mjs', 'publish'], { encoding: 'utf8' });
    assert.equal(result.status, 2);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('packed artifact contains documentation, public validation export and executable CLI', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lo-pack-'));
  try {
    const packed = spawnSync('npm', ['pack', '--json', '--pack-destination', dir], {
      encoding: 'utf8',
      env: { ...process.env, npm_config_cache: join(dir, 'npm-cache') },
    });
    assert.equal(packed.status, 0, packed.stderr);
    const [{ filename, files }] = JSON.parse(packed.stdout);
    assert.ok(files.some(file => file.path === 'docs/architecture.md'));
    assert.ok(files.some(file => file.path === 'docs/migration.md'));
    assert.ok(files.some(file => file.path === 'src/manifest.d.mts'));
    assert.equal(files.find(file => file.path === 'bin/lo.mjs').mode, 0o755);

    const unpacked = join(dir, 'unpacked');
    await mkdir(unpacked);
    const extracted = spawnSync('tar', ['-xzf', join(dir, filename), '-C', unpacked], { encoding: 'utf8' });
    assert.equal(extracted.status, 0, extracted.stderr);
    const executable = join(unpacked, 'package', 'bin', 'lo.mjs');
    assert.ok((await stat(executable)).mode & 0o111);
    const help = spawnSync(executable, ['--help'], { encoding: 'utf8' });
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /lo doctor/);

    const consumer = join(dir, 'consumer');
    const scope = join(consumer, 'node_modules', '@lo');
    await mkdir(scope, { recursive: true });
    await symlink(join(unpacked, 'package'), join(scope, 'developer-tools'), 'dir');
    const imported = spawnSync(process.execPath, ['--input-type=module', '--eval', "import { validateManifest } from '@lo/developer-tools'; if (validateManifest({ schemaVersion: 1, name: 'App', entryUrl: 'https://example.com' }).length) process.exit(1);"], { cwd: consumer, encoding: 'utf8' });
    assert.equal(imported.status, 0, imported.stderr);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
