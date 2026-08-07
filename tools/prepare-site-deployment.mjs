#!/usr/bin/env node
// Packages site/wrt from an exact Git commit. Local working-tree changes are never included.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareWebDeployment } from './prepare-web-deployment.mjs';
import { normalizeBuildEnvironment } from '../site/wrt/lib/build-identity.js';
import { verifySiteArchive, REQUIRED_SITE_ARCHIVE_ENTRIES } from './verify-site-archive.mjs';

function run(program, args, options = {}) {
  const result = spawnSync(program, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    stdio: options.capture ? 'pipe' : 'inherit',
  });
  if (result.error || result.status !== 0) {
    const detail = String(result.stderr || result.stdout || result.error?.message || '').trim();
    throw new Error(`${program} ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return result;
}

function gitText(repo, args) {
  return String(run('git', ['-C', repo, ...args], { capture: true }).stdout || '').trim();
}

export function prepareSiteDeployment({ repo = process.cwd(), ref = 'origin/staging', output, builtAt = '' } = {}) {
  const root = resolve(repo);
  const archive = resolve(output || join(process.cwd(), 'wrt-staging.tar.gz'));
  const commit = gitText(root, ['rev-parse', '--verify', `${ref}^{commit}`]).toLowerCase();
  const worktree = mkdtempSync(join(tmpdir(), 'weig-wrt-deploy-'));
  let added = false;
  try {
    run('git', ['-C', root, 'worktree', 'add', '--detach', '--force', worktree, commit]);
    added = true;
    const prepared = prepareWebDeployment({ root: worktree, commit, branch: normalizeBuildEnvironment(ref), builtAt });
    run('tar', ['-czf', archive, '-C', join(worktree, 'site', 'wrt'), '.']);
    const requiredEntries = [...REQUIRED_SITE_ARCHIVE_ENTRIES, 'data/build-meta.json'];
    const verified = verifySiteArchive(archive, { requiredEntries });
    if (!verified.ok) throw new Error(`Archive verification failed: ${verified.error}`);
    return { archive, commit, version: prepared.version, builtAt: prepared.payload.builtAt };
  } finally {
    if (added) {
      spawnSync('git', ['-C', root, 'worktree', 'remove', '--force', worktree], { stdio: 'ignore', shell: false, windowsHide: true });
      spawnSync('git', ['-C', root, 'worktree', 'prune'], { stdio: 'ignore', shell: false, windowsHide: true });
    }
    rmSync(worktree, { recursive: true, force: true });
  }
}

function parseCli(argv) {
  const options = { repo: process.cwd(), ref: 'origin/staging', output: '', builtAt: '' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--repo') options.repo = argv[++i] || '';
    else if (arg === '--ref') options.ref = argv[++i] || '';
    else if (arg === '--output') options.output = argv[++i] || '';
    else if (arg === '--built-at') options.builtAt = argv[++i] || '';
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!options.repo || !options.ref || !options.output) throw new Error('Usage: prepare-site-deployment --ref <git-ref> --output <archive> [--repo <path>]');
  return options;
}

try {
  const modulePath = fileURLToPath(import.meta.url);
  if (process.argv[1] && resolve(process.argv[1]) === resolve(modulePath)) {
    const result = prepareSiteDeployment(parseCli(process.argv.slice(2)));
    console.log(`Prepared exact staging package / 已准备精确候选包`);
    console.log(`Version: ${result.version}`);
    console.log(`Commit:  ${result.commit}`);
    console.log(`Built:   ${result.builtAt}`);
    console.log(`Archive: ${result.archive}`);
  }
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}
