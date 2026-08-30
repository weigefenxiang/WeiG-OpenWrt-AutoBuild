#!/usr/bin/env node
// Cross-platform local preparation and verification helper. It never stages, commits, or pushes Git changes.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BLOG = join(ROOT, '..', 'weige-share-blog');
const command = process.argv[2] || 'status';
const keepVersion = process.argv.includes('--keep-version');

function run(program, args, options = {}) {
  const result = spawnSync(program, args, { cwd: options.cwd || ROOT, encoding: 'utf8', stdio: options.capture ? 'pipe' : 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowStatus?.includes(result.status)) process.exit(result.status ?? 1);
  return result;
}
function gitAvailable() {
  return existsSync(join(ROOT, '.git')) && spawnSync('git', ['--version'], { stdio: 'ignore', shell: false }).status === 0;
}
function gitText(args) {
  return run('git', ['-C', ROOT, ...args], { capture: true }).stdout.trim();
}
function verifyGitState() {
  if (!gitAvailable()) {
    console.log('[git] Repository metadata is unavailable; Git-only checks are skipped.');
    return;
  }
  const unmerged = gitText(['diff', '--name-only', '--diff-filter=U']);
  if (unmerged) throw new Error(`Unmerged files detected:\n${unmerged}`);
  for (const marker of ['MERGE_HEAD', 'CHERRY_PICK_HEAD']) {
    if (spawnSync('git', ['-C', ROOT, 'rev-parse', '-q', '--verify', marker], { stdio: 'ignore', shell: false }).status === 0) {
      throw new Error(`Unfinished Git operation detected: ${marker}`);
    }
  }
}
function diffCheck() {
  if (gitAvailable()) run('git', ['-C', ROOT, 'diff', '--check']);
  else console.log('[git] git diff --check skipped because .git is unavailable.');
}
function prepare() {
  verifyGitState();
  run(process.execPath, ['tools/gen-site-css.mjs']);
  run(process.execPath, ['tools/gen-project-config.mjs']);
  run(process.execPath, ['tools/canonicalize-site-release.mjs']);
  run(process.execPath, ['tools/check-text-format.mjs', 'site/wrt', '--all']);
  run(process.execPath, ['tools/stamp-site-version.mjs', ...(keepVersion ? ['--keep-version'] : [])]);
  run(process.execPath, ['tools/check-text-format.mjs', '.', '--changed']);
  run(process.execPath, ['tools/check-all.mjs']);
  diffCheck();
  status();
}
function verify() {
  verifyGitState();
  run(process.execPath, ['tools/gen-site-css.mjs', '--check']);
  run(process.execPath, ['tools/check-text-format.mjs', 'site/wrt', '--all']);
  run(process.execPath, ['tools/stamp-site-version.mjs', '--check']);
  run(process.execPath, ['tools/check-text-format.mjs', '.', '--changed']);
  run(process.execPath, ['tools/check-all.mjs']);
  diffCheck();
  status();
}
function status() {
  if (!gitAvailable()) {
    console.log('READY: project checks can run, but commit suggestions require a real Git checkout.');
    return;
  }
  const branch = gitText(['branch', '--show-current']) || '(detached)';
  const version = readFileSync(join(ROOT, 'VERSION'), 'utf8').trim();
  console.log(`\nBranch:  ${branch}`);
  console.log(`Version: ${version}`);
  run('git', ['-C', ROOT, 'status', '--short']);
  console.log('\nGit remains manual. Suggested sequence after review:');
  console.log('  git add -- <reviewed-files>');
  console.log('  git commit -m "<English commit title>"');
  console.log(`  git push origin ${branch}`);
}
function syncBlog(checkOnly = false, ref = '') {
  if (!existsSync(BLOG)) throw new Error(`Blog repository not found: ${BLOG}`);
  run(process.execPath, ['tools/sync-blog.mjs', BLOG, ...(checkOnly ? ['--check'] : []), ...(ref ? ['--ref', ref] : [])]);
}

try {
  if (keepVersion && command !== 'prepare') throw new Error('--keep-version is only valid with prepare');
  if (command === 'prepare') prepare();
  else if (command === 'verify') verify();
  else if (command === 'status') status();
  else if (command === 'sync-blog') syncBlog(false, process.argv[3] || '');
  else if (command === 'verify-blog') syncBlog(true, process.argv[3] || '');
  else throw new Error(`Unknown command: ${command}`);
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
}
