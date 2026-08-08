#!/usr/bin/env node
// Generates optional static deployment metadata for the web UI. The file is not a source of truth.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeBuildCommit, normalizeBuildEnvironment } from '../site/wrt/lib/build-identity.js';

const MODULE_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = join(dirname(MODULE_PATH), '..');


function resolveBranch(root, explicitBranch = '') {
  for (const value of [
    explicitBranch,
    process.env.WEIG_BUILD_BRANCH,
    process.env.CF_PAGES_BRANCH,
    process.env.GITHUB_REF_NAME,
    process.env.GITHUB_REF,
  ]) {
    const environment = normalizeBuildEnvironment(value);
    if (environment) return environment;
  }
  try {
    const value = execFileSync('git', ['-C', root, 'branch', '--show-current'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return normalizeBuildEnvironment(value);
  } catch (error) { /* static copies can work without Git */ }
  return '';
}

function resolveCommit(root, explicitCommit = '') {
  const explicit = String(explicitCommit || '').trim();
  if (explicit) return normalizeBuildCommit(explicit);
  for (const value of [process.env.WEIG_BUILD_COMMIT, process.env.CF_PAGES_COMMIT_SHA, process.env.GITHUB_SHA]) {
    const commit = normalizeBuildCommit(value);
    if (commit) return commit;
  }
  try {
    const value = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return normalizeBuildCommit(value);
  } catch (error) { /* static copies can work without Git */ }
  return '';
}

export function shanghaiIsoNow(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+08:00`;
}

export function writeBuildMeta({ root = DEFAULT_ROOT, commit = '', branch = '', builtAt = '', out = '' } = {}) {
  const projectRoot = resolve(root);
  const output = resolve(out || join(projectRoot, 'site', 'wrt', 'data', 'build-meta.json'));
  const version = readFileSync(join(projectRoot, 'VERSION'), 'utf8').trim();
  if (!/^v\d{10}$/.test(version)) throw new Error(`Invalid VERSION: ${version}`);
  const buildTime = builtAt || process.env.WEIG_BUILD_TIME || shanghaiIsoNow();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/.test(buildTime)) {
    throw new Error(`Invalid WEIG_BUILD_TIME: ${buildTime}`);
  }
  const resolvedCommit = resolveCommit(projectRoot, commit);
  const resolvedBranch = resolveBranch(projectRoot, branch);
  if (String(commit || '').trim() && !resolvedCommit) throw new Error('Explicit deployment commit must be a full 40-character Git SHA.');
  if (String(branch || '').trim() && !resolvedBranch) throw new Error('Explicit deployment branch is invalid.');
  const payload = {
    version,
    commit: resolvedCommit,
    branch: resolvedBranch,
    builtAt: buildTime,
    timezone: 'Asia/Shanghai',
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(payload, null, 2) + '\n');
  return { output, payload };
}

function parseCli(argv) {
  const options = { root: DEFAULT_ROOT, commit: '', branch: '', builtAt: '', out: '' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') options.root = argv[++i] || '';
    else if (arg === '--commit') options.commit = argv[++i] || '';
    else if (arg === '--branch') options.branch = argv[++i] || '';
    else if (arg === '--built-at') options.builtAt = argv[++i] || '';
    else if (arg === '--out') options.out = argv[++i] || '';
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!options.root) throw new Error('--root requires a path.');
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(MODULE_PATH)) {
  try {
    const result = writeBuildMeta(parseCli(process.argv.slice(2)));
    console.log(`Generated web build metadata / 已生成网页部署元数据: ${result.payload.version} ${result.payload.commit || '(no git commit)'}`);
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
