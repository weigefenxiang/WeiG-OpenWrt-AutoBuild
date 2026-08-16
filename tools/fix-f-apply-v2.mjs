#!/usr/bin/env node
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const original = resolve(root, 'tools/fix-f-apply.mjs');
const generated = resolve(root, 'tools/fix-f-runtime.mjs');
let source = readFileSync(original, 'utf8');
const startMarker = "app = replaceOnce(app,\n  '    MENU_CATALOG = null;\\n    CATALOG_MODEL = null;\\n    catalogShardLoader = null;";
const nextMarker = "app = replaceOnce(app,\n  '  state.device = device;\\n  const needsBaseline";
const start = source.indexOf(startMarker);
const next = source.indexOf(nextMarker, start + 1);
if (start < 0 || next < 0) throw new Error('cannot locate non-unique Catalog cleanup patch block');
source = source.slice(0, start) + source.slice(next);
source = source.replace(
  "rmSync(resolve(ROOT, 'tools/fix-f-apply.mjs'));\nrmSync(resolve(ROOT, '.github/workflows/fix-f-apply.yml'));",
  "rmSync(resolve(ROOT, 'tools/fix-f-apply.mjs'));\nrmSync(resolve(ROOT, 'tools/fix-f-apply-v2.mjs'));\nrmSync(resolve(ROOT, 'tools/fix-f-runtime.mjs'));\nrmSync(resolve(ROOT, '.github/workflows/fix-f-apply.yml'));",
);
writeFileSync(generated, source, 'utf8');
const result = spawnSync(process.execPath, [generated], { cwd: root, encoding: 'utf8', stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
