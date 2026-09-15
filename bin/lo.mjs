#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateManifest } from '../src/manifest.mjs';

const args = process.argv.slice(2);
if (!args.length || args[0] === '--help' || args[0] === 'help') {
  console.log('Usage: lo doctor [path/to/lo.app.json] [--json]\n\nValidate local app metadata. Does not register, publish, or contact a server.');
} else if (args[0] !== 'doctor' || args.filter(x => !x.startsWith('--')).length > 2 || args.some(x => x.startsWith('--') && x !== '--json')) {
  console.error('Unknown command or option. Run lo --help.');
  process.exitCode = 2;
} else {
  const file = resolve(args.slice(1).find(x => !x.startsWith('--')) ?? 'lo.app.json');
  let issues;
  try {
    issues = validateManifest(JSON.parse(await readFile(file, 'utf8')));
  } catch (error) {
    issues = [{ field: '$', message: error instanceof SyntaxError ? 'Manifest is not valid JSON.' : 'Cannot read manifest file.' }];
  }
  const ok = issues.length === 0;
  if (args.includes('--json')) console.log(JSON.stringify({ ok, issues }));
  else if (ok) console.log('Metadata is valid. Server registration and runtime capabilities still need verification.');
  else for (const issue of issues) console.error(`${issue.field}: ${issue.message}`);
  process.exitCode = ok ? 0 : 1;
}
