#!/usr/bin/env node
// Prepares optional deployment metadata without changing VERSION or source identity.

import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeBuildMeta } from './gen-build-meta.mjs';

export function prepareWebDeployment({ root = process.cwd(), commit = '', builtAt = '' } = {}) {
  const projectRoot = resolve(root);
  const version = readFileSync(join(projectRoot, 'VERSION'), 'utf8').trim();
  if (!/^v\d{10}$/.test(version)) throw new Error(`Invalid VERSION: ${version}`);
  const versionFile = join(projectRoot, 'site', 'wrt', 'data', 'site-version.json');
  const siteVersion = JSON.parse(readFileSync(versionFile, 'utf8'));
  if (siteVersion.version !== version) {
    throw new Error(`VERSION/site-version mismatch: ${version} != ${siteVersion.version || '(missing)'}`);
  }
  for (const rel of ['site/wrt/index.html', 'site/wrt/app.js', 'site/wrt/lib/catalog-engine.js']) {
    if (!existsSync(join(projectRoot, rel))) throw new Error(`Required web file is missing: ${rel}`);
  }
  const result = writeBuildMeta({ root: projectRoot, commit, builtAt });
  return { ...result, version };
}

function parseCli(argv) {
  const options = { root: process.cwd(), commit: '', builtAt: '' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') options.root = argv[++i] || '';
    else if (arg === '--commit') options.commit = argv[++i] || '';
    else if (arg === '--built-at') options.builtAt = argv[++i] || '';
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!options.root) throw new Error('--root requires a path.');
  return options;
}

const MODULE_PATH = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(MODULE_PATH)) {
  try {
    const result = prepareWebDeployment(parseCli(process.argv.slice(2)));
    console.log(`Prepared web deployment metadata: ${result.version} ${result.payload.commit || '(no commit)'}`);
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
