#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_POLICY = join(ROOT, '.github', 'automation-policy.json');

function cleanString(value) {
  return String(value ?? '').trim();
}

export function normalizeStandaloneSuffixes(value) {
  if (!Array.isArray(value)) throw new Error('buildArtifacts.standaloneSuffixes must be an array');
  const suffixes = value.map(cleanString);
  for (const suffix of suffixes) {
    if (!/^\.[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/.test(suffix)) {
      throw new Error(`invalid standalone artifact suffix: ${suffix || '(empty)'}`);
    }
  }
  if (new Set(suffixes).size !== suffixes.length) {
    throw new Error('buildArtifacts.standaloneSuffixes contains duplicate values');
  }
  return suffixes;
}

export function readArtifactPublishPolicy(path = DEFAULT_POLICY) {
  const policy = JSON.parse(readFileSync(path, 'utf8'));
  if (Number(policy?.schema) !== 1) throw new Error('automation policy schema 1 is required');
  return {
    schema: 1,
    standaloneSuffixes: normalizeStandaloneSuffixes(policy?.buildArtifacts?.standaloneSuffixes),
  };
}

export function isStandaloneArtifact(name, suffixes) {
  const value = String(name ?? '');
  return normalizeStandaloneSuffixes(suffixes).some((suffix) => value.endsWith(suffix));
}

function listTargetFiles(root) {
  if (!existsSync(root)) return [];
  const output = [];
  for (const target of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!target.isDirectory()) continue;
    const targetDir = join(root, target.name);
    for (const subtarget of readdirSync(targetDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!subtarget.isDirectory()) continue;
      const subtargetDir = join(targetDir, subtarget.name);
      for (const entry of readdirSync(subtargetDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (!entry.isFile()) continue;
        const path = join(subtargetDir, entry.name);
        output.push({ path, relative: relative(root, path).replaceAll('\\', '/') });
      }
    }
  }
  return output;
}

function validateArtifactRef(value) {
  const ref = cleanString(value);
  if (!ref || /[\\/\u0000-\u001f\u007f]/.test(ref)) throw new Error('artifact ref is empty or contains a path/control character');
  return ref;
}

export function stageArtifacts({ sourceDir, stagingDir, artifactRef, policy }) {
  const source = resolve(sourceDir);
  const staging = resolve(stagingDir);
  const ref = validateArtifactRef(artifactRef);
  const suffixes = normalizeStandaloneSuffixes(policy?.standaloneSuffixes);
  const standaloneDir = join(staging, 'STANDALONE');
  const otherDir = join(staging, 'FIRMWARE-OTHER');

  rmSync(standaloneDir, { recursive: true, force: true });
  rmSync(otherDir, { recursive: true, force: true });
  mkdirSync(standaloneDir, { recursive: true });
  mkdirSync(otherDir, { recursive: true });

  const outputs = new Map();
  const standalone = [];
  const other = [];
  for (const file of listTargetFiles(source)) {
    const base = basename(file.path);
    const name = `${ref}-${base}`;
    if (outputs.has(name)) {
      throw new Error(`duplicate artifact output name: ${name} (${outputs.get(name)}; ${file.relative})`);
    }
    outputs.set(name, file.relative);
    const selected = isStandaloneArtifact(base, suffixes);
    const targetDir = selected ? standaloneDir : otherDir;
    copyFileSync(file.path, join(targetDir, name));
    (selected ? standalone : other).push({ name, source: file.relative });
  }

  standalone.sort((a, b) => a.name.localeCompare(b.name));
  other.sort((a, b) => a.name.localeCompare(b.name));
  return {
    schema: 1,
    standaloneSuffixes: suffixes,
    hasStandalone: standalone.length > 0,
    standalone,
    other,
    matrix: standalone.length
      ? standalone.map(({ name }) => ({ name, enabled: true }))
      : [{ name: '__none__', enabled: false }],
  };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) throw new Error(`unexpected argument: ${key}`);
    const value = argv[++i];
    if (value == null || value.startsWith('--')) throw new Error(`missing value for ${key}`);
    args[key.slice(2)] = value;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const key of ['source', 'staging', 'artifact-ref', 'plan']) {
    if (!args[key]) throw new Error(`--${key} is required`);
  }
  const policy = readArtifactPublishPolicy(args.policy || DEFAULT_POLICY);
  const plan = stageArtifacts({
    sourceDir: args.source,
    stagingDir: args.staging,
    artifactRef: args['artifact-ref'],
    policy,
  });
  writeFileSync(args.plan, JSON.stringify(plan, null, 2) + '\n');
  console.log(`Artifact publication planned: standalone=${plan.standalone.length}, other=${plan.other.length}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error?.message || error);
    process.exit(1);
  }
}
