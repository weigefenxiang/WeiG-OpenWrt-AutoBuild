#!/usr/bin/env node
// Generate the browser and Bash projections from config/project.json.

import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_PROJECT_CONFIG_PATH,
  loadProjectConfig,
  projectToBuildDefaults,
  projectToSiteData,
} from './project-config.mjs';

const MODULE_PATH = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(MODULE_PATH), '..');
const DEFAULT_SITE_OUTPUT = resolve(ROOT, 'site', 'wrt', 'data', 'project.json');
const DEFAULT_SHELL_OUTPUT = resolve(ROOT, 'Shell', 'build-defaults.conf');

function usageError(message) {
  throw new Error(`${message}\nUsage: node tools/gen-project-config.mjs [--check] [--source path] [--site-output path] [--shell-output path]`);
}

function parseArgs(argv) {
  const options = {
    check: false,
    source: DEFAULT_PROJECT_CONFIG_PATH,
    siteOutput: DEFAULT_SITE_OUTPUT,
    shellOutput: DEFAULT_SHELL_OUTPUT,
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--check') options.check = true;
    else if (arg === '--source' || arg === '--config') {
      const value = argv[++index];
      if (!value) usageError(`${arg} requires a path`);
      options.source = resolve(value);
    } else if (arg === '--site-output' || arg === '--site' || arg === '--output') {
      const value = argv[++index];
      if (!value) usageError(`${arg} requires a path`);
      options.siteOutput = resolve(value);
    } else if (arg === '--shell-output' || arg === '--shell') {
      const value = argv[++index];
      if (!value) usageError(`${arg} requires a path`);
      options.shellOutput = resolve(value);
    } else {
      usageError(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function expectedFiles(options) {
  const config = loadProjectConfig(options.source);
  return {
    site: JSON.stringify(projectToSiteData(config), null, 2) + '\n',
    shell: projectToBuildDefaults(config),
  };
}

function actualText(path) {
  try { return readFileSync(path, 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function ensureParent(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function atomicWrite(path, text) {
  ensureParent(path);
  const temporary = join(dirname(path), `.${path.split(/[\\/]/).at(-1)}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  try {
    writeFileSync(temporary, text, { encoding: 'utf8', flag: 'wx' });
    renameSync(temporary, path);
  } catch (error) {
    try { unlinkSync(temporary); } catch { /* best-effort cleanup after a failed write */ }
    throw error;
  }
}

function writeOrCheck(path, expected, check, label) {
  const actual = actualText(path);
  if (check) {
    if (actual !== expected) {
      console.error(`[project-config] stale ${label}: ${path}`);
      return false;
    }
    console.log(`[project-config] ${label} is current`);
    return true;
  }
  if (actual !== expected) {
    atomicWrite(path, expected);
    console.log(`[project-config] generated ${path}`);
  } else {
    console.log(`[project-config] ${label} unchanged`);
  }
  return true;
}

export function generateProjectConfig({
  source = DEFAULT_PROJECT_CONFIG_PATH,
  siteOutput = DEFAULT_SITE_OUTPUT,
  shellOutput = DEFAULT_SHELL_OUTPUT,
  check = false,
} = {}) {
  const expected = expectedFiles({ source });
  const siteOk = writeOrCheck(siteOutput, expected.site, check, 'site projection');
  const shellOk = writeOrCheck(shellOutput, expected.shell, check, 'shell defaults');
  return { ok: siteOk && shellOk, site: expected.site, shell: expected.shell };
}

export function runCli(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    const result = generateProjectConfig(options);
    return result.ok ? 0 : 1;
  } catch (error) {
    console.error(`[project-config] ERROR: ${error?.message || error}`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(MODULE_PATH)) {
  process.exitCode = runCli();
}
