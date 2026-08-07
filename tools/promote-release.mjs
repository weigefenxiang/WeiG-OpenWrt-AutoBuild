#!/usr/bin/env node
// Exact-commit branch promotion with explicit confirmation and post-push verification.

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

function git(repo, args, { allowFailure = false } = {}) {
  const result = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', shell: false, windowsHide: true });
  if (!allowFailure && (result.error || result.status !== 0)) {
    const detail = String(result.stderr || result.stdout || result.error?.message || '').trim();
    throw new Error(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return result;
}

function gitText(repo, args) {
  return String(git(repo, args).stdout || '').trim();
}

function refExists(repo, ref) {
  return git(repo, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { allowFailure: true }).status === 0;
}

function resolveCommit(repo, ref) {
  return gitText(repo, ['rev-parse', '--verify', `${ref}^{commit}`]).toLowerCase();
}

function isAncestor(repo, ancestor, descendant) {
  return git(repo, ['merge-base', '--is-ancestor', ancestor, descendant], { allowFailure: true }).status === 0;
}

function showFile(repo, ref, path) {
  return gitText(repo, ['show', `${ref}:${path}`]);
}

function versionFor(repo, ref) {
  const version = showFile(repo, ref, 'VERSION').trim();
  if (!/^v\d{10}$/.test(version)) throw new Error(`Invalid VERSION at ${ref}: ${version}`);
  const siteVersion = JSON.parse(showFile(repo, ref, 'site/wrt/data/site-version.json'));
  if (siteVersion.version !== version) {
    throw new Error(`VERSION/site-version mismatch at ${ref}: ${version} != ${siteVersion.version || '(missing)'}`);
  }
  return version;
}

function fetchOrigin(repo) {
  git(repo, ['fetch', '--prune', 'origin']);
}

export function checkDevToStaging(repoPath, candidateRef = 'origin/dev') {
  const repo = resolve(repoPath);
  if (!refExists(repo, 'origin/main')) throw new Error('origin/main is missing.');
  if (!refExists(repo, 'origin/dev')) throw new Error('origin/dev is missing.');
  const candidate = resolveCommit(repo, candidateRef);
  const dev = resolveCommit(repo, 'origin/dev');
  if (!isAncestor(repo, candidate, dev)) {
    throw new Error(`Candidate ${candidate.slice(0, 12)} is not part of origin/dev history.`);
  }
  const stagingExists = refExists(repo, 'origin/staging');
  const baseRef = stagingExists ? 'origin/staging' : 'origin/main';
  const base = resolveCommit(repo, baseRef);
  if (!isAncestor(repo, base, candidate)) {
    throw new Error(`${baseRef} is not an ancestor of candidate ${candidate.slice(0, 12)}; fast-forward promotion is unsafe.`);
  }
  return {
    kind: 'dev-staging',
    sourceRef: 'origin/dev',
    targetRef: 'origin/staging',
    targetBranch: 'staging',
    candidateRef,
    candidate,
    version: versionFor(repo, candidate),
    baseRef,
    base,
    targetExists: stagingExists,
    target: stagingExists ? base : null,
    createsStaging: !stagingExists,
  };
}

export function checkStagingToMain(repoPath) {
  const repo = resolve(repoPath);
  if (!refExists(repo, 'origin/main')) throw new Error('origin/main is missing.');
  if (!refExists(repo, 'origin/staging')) throw new Error('origin/staging is missing.');
  const main = resolveCommit(repo, 'origin/main');
  const staging = resolveCommit(repo, 'origin/staging');
  if (!isAncestor(repo, main, staging)) {
    throw new Error('origin/main is not an ancestor of origin/staging; fast-forward production promotion is unsafe.');
  }
  return {
    kind: 'staging-main',
    sourceRef: 'origin/staging',
    targetRef: 'origin/main',
    targetBranch: 'main',
    candidate: staging,
    version: versionFor(repo, staging),
    baseRef: 'origin/main',
    base: main,
    targetExists: true,
    target: main,
  };
}

function promotionPlan(repo, kind) {
  if (kind === 'dev-staging') return checkDevToStaging(repo, 'origin/dev');
  if (kind === 'staging-main') return checkStagingToMain(repo);
  throw new Error(`Unknown promotion kind: ${kind}`);
}

function sameInitialTarget(before, after) {
  if (before.targetExists !== after.targetExists) return false;
  if (!before.targetExists) return true;
  return before.target === after.target;
}

async function defaultConfirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(question);
    return /^[Yy]$/.test(answer.trim());
  } finally {
    rl.close();
  }
}

function printPlan(plan, writeLine) {
  writeLine('');
  writeLine('SAFE TO PROMOTE');
  writeLine(`Source:    ${plan.sourceRef}`);
  writeLine(`Target:    ${plan.targetRef}`);
  writeLine(`Version:   ${plan.version}`);
  writeLine(`Commit:    ${plan.candidate}`);
  if (plan.targetExists) writeLine(`Current:   ${plan.target.slice(0, 12)}`);
  else writeLine(`Current:   (missing; baseline ${plan.baseRef} @ ${plan.base.slice(0, 12)})`);
}

function printVerified(plan, writeLine) {
  writeLine('');
  writeLine('============================================');
  writeLine('PROMOTION VERIFIED');
  writeLine(`Version: ${plan.version}`);
  writeLine(`Commit:  ${plan.candidate}`);
  writeLine(`${plan.sourceRef} == ${plan.targetRef}`);
  writeLine('============================================');
}

export async function promoteExact(repoPath, kind, {
  confirm = defaultConfirm,
  writeLine = (line = '') => console.log(line),
} = {}) {
  const repo = resolve(repoPath);
  writeLine('Fetching remote refs...');
  fetchOrigin(repo);
  const initial = promotionPlan(repo, kind);

  if (initial.targetExists && initial.target === initial.candidate) {
    writeLine('');
    writeLine('ALREADY PROMOTED');
    writeLine(`Version: ${initial.version}`);
    writeLine(`Commit:  ${initial.candidate}`);
    writeLine(`${initial.sourceRef} == ${initial.targetRef}`);
    return { status: 'already', ...initial };
  }

  printPlan(initial, writeLine);
  writeLine('');
  const accepted = await confirm(`Push this exact commit to ${initial.targetRef} now? [y/N]: `);
  if (!accepted) {
    writeLine('');
    writeLine('CANCELLED: no Git ref was changed.');
    return { status: 'cancelled', ...initial };
  }

  writeLine('');
  writeLine('Revalidating remote refs before push...');
  fetchOrigin(repo);
  const fresh = promotionPlan(repo, kind);
  if (fresh.candidate !== initial.candidate) {
    throw new Error(`${initial.sourceRef} changed while awaiting confirmation; rerun promotion.`);
  }
  if (!sameInitialTarget(initial, fresh)) {
    if (fresh.targetExists && fresh.target === initial.candidate) {
      printVerified(fresh, writeLine);
      return { status: 'verified', ...fresh };
    }
    throw new Error(`${initial.targetRef} changed while awaiting confirmation; rerun promotion.`);
  }

  writeLine('Pushing exact commit...');
  git(repo, ['push', 'origin', `${initial.candidate}:refs/heads/${initial.targetBranch}`]);

  writeLine('Fetching remote refs again...');
  fetchOrigin(repo);
  const sourceAfter = resolveCommit(repo, initial.sourceRef);
  const targetAfter = resolveCommit(repo, initial.targetRef);
  if (sourceAfter !== initial.candidate) {
    throw new Error(`${initial.sourceRef} changed during promotion; target was not verified for release.`);
  }
  if (targetAfter !== initial.candidate) {
    throw new Error(`${initial.targetRef} does not match the exact promoted commit.`);
  }

  printVerified(initial, writeLine);
  return { status: 'promoted', ...initial };
}

export function releaseStatus(repoPath) {
  const repo = resolve(repoPath);
  const refs = ['origin/main', 'origin/staging', 'origin/dev'];
  return refs.map((ref) => {
    if (!refExists(repo, ref)) return { ref, exists: false };
    const commit = resolveCommit(repo, ref);
    let version = '';
    try { version = versionFor(repo, commit); } catch (error) { version = `INVALID (${error.message})`; }
    return { ref, exists: true, commit, version };
  });
}

function parseCli(argv) {
  let repo = process.cwd();
  const args = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--repo') {
      repo = argv[++i] || '';
      if (!repo) throw new Error('--repo requires a path.');
    } else args.push(argv[i]);
  }
  return { repo, command: args[0] || 'status', kind: args[1] || '' };
}

async function main() {
  try {
    const { repo, command, kind } = parseCli(process.argv.slice(2));
    if (command === 'status') {
      console.log('Fetching remote refs...');
      fetchOrigin(resolve(repo));
      console.log('Release status:');
      for (const row of releaseStatus(repo)) {
        console.log(row.exists
          ? `  ${row.ref.padEnd(16)} ${row.commit.slice(0, 12)}  ${row.version}`
          : `  ${row.ref.padEnd(16)} (missing)`);
      }
      return;
    }
    if (command === 'promote') {
      await promoteExact(repo, kind);
      return;
    }
    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    console.error(`BLOCKED: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) await main();
