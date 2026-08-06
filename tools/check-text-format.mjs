#!/usr/bin/env node
// Validate text-file encoding, line endings and EOF shape for changed files.
// 校验变更文本文件的编码、换行符和文件末尾格式；只检查，不自动改写。

import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';

const MODULE_PATH = fileURLToPath(import.meta.url);
const PROJECT_ROOT = resolve(dirname(MODULE_PATH), '..');

const LF_EXTENSIONS = new Set([
  '.config', '.css', '.html', '.js', '.json', '.md', '.mjs', '.sh', '.yaml', '.yml',
]);
const CRLF_EXTENSIONS = new Set(['.bat', '.cmd', '.ps1']);
const LF_FILENAMES = new Set(['.gitattributes', '.gitignore', 'VERSION']);
const EXCLUDED_DIRECTORIES = new Set(['.git', 'node_modules']);
const CRITICAL_FILES = [
  '.gitattributes',
  '.gitignore',
  'VERSION',
  'OpenWebPage_打开网页.bat',
  'site/wrt/app.js',
  'site/wrt/lib/catalog-engine.js',
  'site/wrt/lib/catalog-loader.js',
  'site/wrt/lib/package.json',
  'tools/check-all.mjs',
  'tools/check-text-format.mjs',
  'tools/sync-blog.mjs',
  'tools/verify-site-archive.mjs',
  'docs-private/Sync_Deploy.bat',
];

function slash(path) {
  return path.split(sep).join('/');
}

function isInside(root, path) {
  const rel = relative(resolve(root), resolve(path));
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}

function isExcluded(relativePath) {
  return slash(relativePath).split('/').some((part, index, parts) =>
    EXCLUDED_DIRECTORIES.has(part) ||
    (part === 'temp' && index > 0 && parts[index - 1] === 'docs-private'));
}

export function expectedLineEnding(relativePath) {
  const normalized = slash(relativePath);
  const name = normalized.slice(normalized.lastIndexOf('/') + 1);
  if (CRLF_EXTENSIONS.has(extname(name).toLowerCase())) return 'crlf';
  if (LF_FILENAMES.has(name) || LF_EXTENSIONS.has(extname(name).toLowerCase())) return 'lf';
  return '';
}

function decodeUtf8(buffer) {
  return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
}

export function inspectTextBuffer(buffer, expected) {
  const issues = [];
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
  if (buffer.includes(0)) {
    issues.push('contains NUL bytes and is not valid text');
    return issues;
  }
  if (buffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
    issues.push('UTF-8 BOM is not allowed');
  }

  let text;
  try {
    text = decodeUtf8(buffer);
  } catch {
    issues.push('is not valid UTF-8');
    return issues;
  }

  const withoutCrLf = text.replace(/\r\n/g, '');
  const hasCrLf = text.includes('\r\n');
  const hasLoneLf = withoutCrLf.includes('\n');
  const hasLoneCr = withoutCrLf.includes('\r');

  if (expected === 'lf') {
    if (hasCrLf) issues.push('expected LF but found CRLF');
    if (hasLoneCr) issues.push('contains lone CR characters');
  } else if (expected === 'crlf') {
    if (hasLoneLf) issues.push('expected CRLF but found LF');
    if (hasLoneCr) issues.push('contains lone CR characters');
  }
  if (hasCrLf && hasLoneLf) issues.push('contains mixed line endings');

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (normalized.length > 0 && !normalized.endsWith('\n')) {
    issues.push('must end with exactly one newline');
  }
  if (/\n[\t ]*\n$/.test(normalized)) {
    issues.push('has a blank line at EOF');
  }
  return [...new Set(issues)];
}

function gitOutput(root, args) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: null });
  if (result.status !== 0) return null;
  return result.stdout;
}

function nulPaths(buffer) {
  if (!buffer?.length) return [];
  return buffer.toString('utf8').split('\0').filter(Boolean);
}

export function collectChangedFiles(root) {
  const repo = resolve(root);
  const inside = spawnSync('git', ['-C', repo, 'rev-parse', '--is-inside-work-tree'], {
    encoding: 'utf8',
  });
  if (inside.status !== 0 || inside.stdout.trim() !== 'true') return null;

  const paths = new Set();
  for (const args of [
    ['diff', '--name-only', '--diff-filter=ACMR', '-z'],
    ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'],
    ['ls-files', '--others', '--exclude-standard', '-z'],
  ]) {
    const output = gitOutput(repo, args);
    if (output === null) throw new Error(`git ${args.join(' ')} failed`);
    for (const path of nulPaths(output)) paths.add(slash(path));
  }
  return [...paths].sort();
}

function walkAllFiles(root, current = root, output = []) {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) continue;
    const path = join(current, entry.name);
    const rel = slash(relative(root, path));
    if (isExcluded(rel)) continue;
    if (entry.isDirectory()) walkAllFiles(root, path, output);
    else if (entry.isFile()) output.push(rel);
  }
  return output;
}

export function checkTextFiles(root, files) {
  const repo = resolve(root);
  const results = [];
  for (const rawPath of [...new Set(files.map(slash))].sort()) {
    if (!rawPath || isExcluded(rawPath)) continue;
    const expected = expectedLineEnding(rawPath);
    if (!expected) continue;
    const absolute = resolve(repo, rawPath.split('/').join(sep));
    if (!isInside(repo, absolute) || !existsSync(absolute)) continue;
    const stat = lstatSync(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) continue;
    const issues = inspectTextBuffer(readFileSync(absolute), expected);
    if (issues.length) results.push({ path: rawPath, expected, issues });
  }
  return results;
}

function parseCli(argv) {
  let root = '';
  let mode = 'changed';
  for (const arg of argv) {
    if (arg === '--changed') mode = 'changed';
    else if (arg === '--critical') mode = 'critical';
    else if (arg === '--all') mode = 'all';
    else if (arg.startsWith('--')) throw new Error(`Unknown option / 未知选项: ${arg}`);
    else if (!root) root = arg;
    else throw new Error('Only one repository path is allowed / 只能指定一个仓库路径');
  }
  return { root: resolve(root || PROJECT_ROOT), mode };
}

function selectedFiles(root, mode) {
  if (mode === 'all') return walkAllFiles(root);
  if (mode === 'critical') return CRITICAL_FILES.filter((file) => existsSync(join(root, file)));
  const changed = collectChangedFiles(root);
  if (changed !== null) return changed;
  console.log('[text-format] Git metadata unavailable; checking critical files only.');
  return CRITICAL_FILES.filter((file) => existsSync(join(root, file)));
}

function runCli() {
  try {
    const { root, mode } = parseCli(process.argv.slice(2));
    if (!existsSync(root) || !lstatSync(root).isDirectory()) {
      throw new Error(`Repository directory does not exist / 仓库目录不存在: ${root}`);
    }
    const files = selectedFiles(root, mode);
    const checked = files.filter((file) => expectedLineEnding(file) && existsSync(join(root, file))).length;
    const failures = checkTextFiles(root, files);
    console.log(`[text-format] ${mode}: ${checked} text file(s) checked under ${root}`);
    if (!failures.length) {
      console.log('[text-format] OK: UTF-8 without BOM, expected line endings, one final newline.');
      return 0;
    }

    console.error('[text-format] FAILED:');
    for (const failure of failures) {
      console.error(`  - ${failure.path} (${failure.expected.toUpperCase()}): ${failure.issues.join('; ')}`);
    }
    console.error('[text-format] No files were changed automatically. Fix the listed files and rerun this command.');
    console.error('[text-format] Git messages about future CRLF/LF conversion are warnings; the failures above are the blocking errors.');
    return 1;
  } catch (error) {
    console.error(`[text-format] ERROR: ${error?.message || error}`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(MODULE_PATH)) {
  process.exitCode = runCli();
}
