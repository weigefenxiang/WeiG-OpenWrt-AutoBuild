#!/usr/bin/env node
// Checks exact-commit branch promotion safety. It never changes refs or pushes.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
    source: candidateRef,
    candidate,
    version: versionFor(repo, candidate),
    baseRef,
    base,
    createsStaging: !stagingExists,
    command: `git push origin ${candidate}:refs/heads/staging`,
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
    candidate: staging,
    version: versionFor(repo, staging),
    baseRef: 'origin/main',
    base: main,
    command: `git push origin ${staging}:refs/heads/main`,
  };
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
  return { repo, command: args[0] || 'status', candidate: args[1] || 'origin/dev' };
}

function printPromotion(result) {
  console.log('\nSAFE TO PROMOTE');
  console.log(`Version:   ${result.version}`);
  console.log(`Commit:    ${result.candidate}`);
  console.log(`From base: ${result.baseRef} @ ${result.base.slice(0, 12)}`);
  if (result.createsStaging) console.log('Staging:   will be created by this fast-forward promotion');
  console.log('\nReview and run manually:');
  console.log(`  ${result.command}`);
  console.log('\nNo Git ref was changed by this tool.');
}

function main() {
  try {
    const { repo, command, candidate } = parseCli(process.argv.slice(2));
    if (command === 'status') {
      console.log('Release status:');
      for (const row of releaseStatus(repo)) {
        console.log(row.exists
          ? `  ${row.ref.padEnd(16)} ${row.commit.slice(0, 12)}  ${row.version}`
          : `  ${row.ref.padEnd(16)} (missing)`);
      }
      return;
    }
    if (command === 'dev-staging') return printPromotion(checkDevToStaging(repo, candidate));
    if (command === 'staging-main') return printPromotion(checkStagingToMain(repo));
    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    console.error(`BLOCKED: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) main();
