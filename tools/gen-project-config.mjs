#!/usr/bin/env node
// Generate the Shell defaults from the canonical site and build documents.

import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_BUILD_CONFIG_PATH,
  DEFAULT_SITE_CONFIG_PATH,
  loadProjectConfiguration,
  projectToBuildDefaults,
} from './project-config.mjs';

const MODULE_PATH = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(MODULE_PATH), '..');
const DEFAULT_OUTPUT = resolve(ROOT, 'Shell', 'build-defaults.conf');

function usageError(message) {
  throw new Error(`${message}\nUsage: node tools/gen-project-config.mjs [--check] [--site path] [--build path] [--shell-output path]`);
}

function parseArgs(argv) {
  const options = {
    check: false,
    siteSource: DEFAULT_SITE_CONFIG_PATH,
    buildSource: DEFAULT_BUILD_CONFIG_PATH,
    shellOutput: DEFAULT_OUTPUT,
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--check') options.check = true;
    else if (arg === '--site' || arg === '--site-source' || arg === '--site-config') {
      const value = argv[++index];
      if (!value) usageError(`${arg} requires a path`);
      options.siteSource = resolve(value);
    } else if (arg === '--build' || arg === '--build-source' || arg === '--build-config') {
      const value = argv[++index];
      if (!value) usageError(`${arg} requires a path`);
      options.buildSource = resolve(value);
    } else if (arg === '--shell-output' || arg === '--shell' || arg === '--output') {
      const value = argv[++index];
      if (!value) usageError(`${arg} requires a path`);
      options.shellOutput = resolve(value);
    } else usageError(`Unknown option: ${arg}`);
  }
  return options;
}

function expectedFile(options) {
  return projectToBuildDefaults(loadProjectConfiguration(options));
}

function actualText(path) {
  try { return readFileSync(path, 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function atomicWrite(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = resolve(dirname(path), `.${basename(path)}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  try {
    writeFileSync(temporary, text, { encoding: 'utf8', flag: 'wx' });
    renameSync(temporary, path);
  } catch (error) {
    try { unlinkSync(temporary); } catch { /* best-effort cleanup after a failed write */ }
    throw error;
  }
}

function writeOrCheck(path, expected, check) {
  const actual = actualText(path);
  if (check) {
    if (actual !== expected) {
      console.error(`[project-config] stale Shell defaults: ${path}`);
      return false;
    }
    console.log('[project-config] Shell defaults are current');
    return true;
  }
  if (actual !== expected) {
    atomicWrite(path, expected);
    console.log(`[project-config] generated ${path}`);
  } else console.log('[project-config] Shell defaults unchanged');
  return true;
}

export function generateBuildDefaults({
  siteSource = DEFAULT_SITE_CONFIG_PATH,
  buildSource = DEFAULT_BUILD_CONFIG_PATH,
  shellOutput = DEFAULT_OUTPUT,
  check = false,
} = {}) {
  const expected = expectedFile({ siteSource, buildSource });
  return {
    ok: writeOrCheck(shellOutput, expected, check),
    shell: expected,
  };
}

// Compatibility export for callers that only need the generated build file.
export const generateProjectConfig = generateBuildDefaults;

export function runCli(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    return generateBuildDefaults(options).ok ? 0 : 1;
  } catch (error) {
    console.error(`[project-config] ERROR: ${error?.message || error}`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(MODULE_PATH)) {
  process.exitCode = runCli();
}
