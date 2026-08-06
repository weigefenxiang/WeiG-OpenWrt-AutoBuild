#!/usr/bin/env node
// Verify the static-site deployment archive without CMD pipes or shell parsing.
// 不经过 CMD 管道或 shell 解析，校验静态站点部署压缩包。

import { existsSync, lstatSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_PATH = fileURLToPath(import.meta.url);

export const REQUIRED_SITE_ARCHIVE_ENTRIES = Object.freeze([
  'index.html',
  'app.js',
  'data/site-version.json',
  'lib/catalog-engine.js',
  'lib/catalog-loader.js',
  'lib/package.json',
]);

export const FORBIDDEN_SITE_ARCHIVE_ENTRIES = Object.freeze([
  'lib/catalog-engine.mjs',
  'lib/catalog-loader.mjs',
]);

function normalizeArchiveEntry(rawEntry) {
  let entry = String(rawEntry ?? '').replace(/\r$/, '').replace(/\\/g, '/');
  while (entry.startsWith('./')) entry = entry.slice(2);
  while (entry.startsWith('/')) entry = entry.slice(1);
  while (entry.endsWith('/') && entry.length > 1) entry = entry.slice(0, -1);
  return entry;
}

function commandFailure(result, tarCommand) {
  if (result.error) {
    const code = result.error.code ? ` (${result.error.code})` : '';
    return `Unable to start ${tarCommand}${code}: ${result.error.message}`;
  }
  const detail = String(result.stderr || result.stdout || '').trim();
  const status = result.status === null ? 'unknown' : String(result.status);
  return `${tarCommand} exited with status ${status}${detail ? `: ${detail}` : ''}`;
}

export function verifySiteArchive(archivePath, options = {}) {
  const archive = resolve(String(archivePath || ''));
  const tarCommand = options.tarCommand || 'tar';
  const requiredEntries = options.requiredEntries || REQUIRED_SITE_ARCHIVE_ENTRIES;
  const forbiddenEntries = options.forbiddenEntries || FORBIDDEN_SITE_ARCHIVE_ENTRIES;

  if (!archivePath) {
    return { ok: false, category: 'usage', archive, error: 'Archive path is required.' };
  }
  if (!existsSync(archive)) {
    return { ok: false, category: 'archive', archive, error: `Archive does not exist: ${archive}` };
  }
  const stat = lstatSync(archive);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    return { ok: false, category: 'archive', archive, error: `Archive is not a regular file: ${archive}` };
  }
  if (stat.size === 0) {
    return { ok: false, category: 'archive', archive, error: `Archive is empty: ${archive}` };
  }

  const result = spawnSync(tarCommand, ['-tzf', archive], {
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    return {
      ok: false,
      category: result.error?.code === 'ENOENT' ? 'tool' : 'listing',
      archive,
      error: commandFailure(result, tarCommand),
    };
  }

  const entries = new Set(
    String(result.stdout || '')
      .split(/\r?\n/)
      .map(normalizeArchiveEntry)
      .filter(Boolean),
  );
  const missing = requiredEntries.filter((entry) => !entries.has(normalizeArchiveEntry(entry)));
  const forbidden = forbiddenEntries.filter((entry) => entries.has(normalizeArchiveEntry(entry)));

  return {
    ok: missing.length === 0 && forbidden.length === 0,
    category: missing.length ? 'missing' : forbidden.length ? 'forbidden' : 'ok',
    archive,
    entries,
    missing,
    forbidden,
  };
}

function runCli() {
  const archivePath = process.argv[2];
  if (!archivePath || process.argv.length > 3) {
    console.error('Usage / 用法: node tools/verify-site-archive.mjs <site-archive.tar.gz>');
    return 2;
  }

  const report = verifySiteArchive(archivePath);
  if (!report.ok) {
    if (report.error) console.error(`[deploy:archive] ${report.error}`);
    if (report.missing?.length) {
      console.error(`[deploy:archive] Missing required file(s): ${report.missing.join(', ')}`);
    }
    if (report.forbidden?.length) {
      console.error(`[deploy:archive] Legacy .mjs Catalog module(s) found: ${report.forbidden.join(', ')}`);
    }
    console.error('[deploy:archive] Archive rejected before upload; the active VPS site was not changed.');
    return 1;
  }

  console.log(`[deploy:archive] Required files confirmed: ${REQUIRED_SITE_ARCHIVE_ENTRIES.join(', ')}`);
  console.log('[deploy:archive] Legacy .mjs Catalog modules are absent.');
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(MODULE_PATH)) {
  process.exitCode = runCli();
}
