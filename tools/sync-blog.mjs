#!/usr/bin/env node
// Exact-mirrors site/wrt into a Hexo blog source/wrt. Optional --ref uses an exact Git commit.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  closeSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shanghaiIsoNow } from './gen-build-meta.mjs';
import { assertSiteRelease } from './site-release.mjs';

const MODULE_PATH = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(MODULE_PATH), '..');
const DEFAULT_SOURCE = join(ROOT, 'site', 'wrt');
const DEFAULT_BLOG = resolve(ROOT, '..', 'weige-share-blog');
const REQUIRED_SOURCE_FILES = ['index.html', 'app.js', join('data', 'site-version.json')];
const SOURCE_META_FILE = '.wrt-source.json';
const HASH_BUFFER_BYTES = 1024 * 1024;
const COPY_PROGRESS_INTERVAL = 100;

function samePath(left, right) {
  const a = resolve(left);
  const b = resolve(right);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function isDirectChild(parent, child, expectedName) {
  const rel = relative(resolve(parent), resolve(child));
  if (!rel || isAbsolute(rel) || rel.startsWith(`..${sep}`) || rel === '..') return false;
  return rel === expectedName;
}

function assertRegularDirectory(path, label) {
  if (!existsSync(path)) throw new Error(`${label} does not exist / 不存在: ${path}`);
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`${label} must be a real directory / 必须是真实目录: ${path}`);
}

function assertRegularFile(path, label) {
  if (!existsSync(path)) throw new Error(`${label} does not exist / 不存在: ${path}`);
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`${label} must be a regular file / 必须是普通文件: ${path}`);
}

function sha256File(path) {
  const hash = createHash('sha256');
  const buffer = Buffer.allocUnsafe(HASH_BUFFER_BYTES);
  const descriptor = openSync(path, 'r');
  try {
    while (true) {
      const bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    closeSync(descriptor);
  }
  return hash.digest('hex');
}

export function collectTree(root) {
  const normalizedRoot = resolve(root);
  assertRegularDirectory(normalizedRoot, 'Tree root / 目录根');
  const entries = new Map();
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      const rel = relative(normalizedRoot, path).split(sep).join('/');
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in the web mirror / 网页镜像不允许符号链接: ${path}`);
      if (stat.isDirectory()) {
        entries.set(rel, { type: 'dir', path, size: 0 });
        walk(path);
      } else if (stat.isFile()) entries.set(rel, { type: 'file', path, size: stat.size });
      else throw new Error(`Unsupported filesystem entry / 不支持的文件类型: ${path}`);
    }
  };
  walk(normalizedRoot);
  return entries;
}

function sortedTreeEntries(entries, type) {
  return [...entries.entries()].filter(([, entry]) => entry.type === type).sort(([left], [right]) => {
    if (type === 'dir') {
      const depthDifference = left.split('/').length - right.split('/').length;
      if (depthDifference) return depthDifference;
    }
    return left.localeCompare(right);
  });
}

function treeStatsFromEntries(entries) {
  let files = 0;
  let directories = 0;
  let bytes = 0;
  for (const entry of entries.values()) {
    if (entry.type === 'dir') directories++;
    else { files++; bytes += entry.size; }
  }
  return { files, directories, bytes };
}

function copyTree(sourceDir, destinationDir, hooks = {}) {
  const source = resolve(sourceDir);
  const destination = resolve(destinationDir);
  if (existsSync(destination)) throw new Error(`Temporary destination already exists / 临时目标已存在: ${destination}`);
  const entries = collectTree(source);
  const directories = sortedTreeEntries(entries, 'dir');
  const files = sortedTreeEntries(entries, 'file');
  const stats = treeStatsFromEntries(entries);
  mkdirSync(destination);
  for (const [rel] of directories) mkdirSync(join(destination, ...rel.split('/')));
  const reportProgress = (copied, relativePath = '') => {
    if (typeof hooks.onProgress !== 'function') return;
    if (copied === 0 || copied === files.length || copied % COPY_PROGRESS_INTERVAL === 0) {
      hooks.onProgress({ copied, total: files.length, relativePath, stats });
    }
  };
  reportProgress(0);
  for (let index = 0; index < files.length; index++) {
    const [rel, sourceEntry] = files[index];
    const destinationPath = join(destination, ...rel.split('/'));
    const details = { index, copied: index, total: files.length, relativePath: rel, source: sourceEntry.path, destination: destinationPath };
    if (typeof hooks.beforeCopyFile === 'function') hooks.beforeCopyFile(details);
    try { copyFileSync(sourceEntry.path, destinationPath); }
    catch (error) { throw new Error(`File copy failed / 文件复制失败 (${rel}): ${error?.message || error}`, { cause: error }); }
    if (typeof hooks.afterCopyFile === 'function') hooks.afterCopyFile({ ...details, copied: index + 1 });
    reportProgress(index + 1, rel);
  }
  return { entries, stats };
}

export function directoriesMatch(sourceDir, destinationDir, { ignoredPaths = [] } = {}) {
  if (!existsSync(destinationDir)) return false;
  const ignored = new Set(ignoredPaths);
  const source = collectTree(sourceDir);
  const destination = collectTree(destinationDir);
  for (const rel of ignored) { source.delete(rel); destination.delete(rel); }
  if (source.size !== destination.size) return false;
  for (const [rel, sourceEntry] of source) {
    const destinationEntry = destination.get(rel);
    if (!destinationEntry || sourceEntry.type !== destinationEntry.type) return false;
    if (sourceEntry.type === 'file') {
      if (sourceEntry.size !== destinationEntry.size) return false;
      if (sha256File(sourceEntry.path) !== sha256File(destinationEntry.path)) return false;
    }
  }
  return true;
}

function validateLayout(sourceDir, blogRepo) {
  const source = resolve(sourceDir);
  const blog = resolve(blogRepo);
  const blogSource = join(blog, 'source');
  const destination = join(blogSource, 'wrt');
  const temporary = join(blogSource, 'wrt.sync-tmp');
  const previous = join(blogSource, 'wrt.sync-prev');
  assertRegularDirectory(source, 'Main site/wrt / 主仓库 site/wrt');
  for (const rel of REQUIRED_SOURCE_FILES) assertRegularFile(join(source, rel), `Required site file ${rel} / 必需网页文件 ${rel}`);
  assertRegularDirectory(blog, 'Blog repository / 博客仓库');
  if (!existsSync(join(blog, '.git'))) throw new Error(`Blog repository is missing .git / 博客仓库缺少 .git: ${blog}`);
  assertRegularFile(join(blog, '_config.yml'), 'Hexo _config.yml');
  assertRegularDirectory(blogSource, 'Hexo source / Hexo source 目录');
  if (!isDirectChild(blogSource, destination, 'wrt') || !isDirectChild(blogSource, temporary, 'wrt.sync-tmp') || !isDirectChild(blogSource, previous, 'wrt.sync-prev')) {
    throw new Error('Refusing unsafe blog destination paths / 拒绝不安全的博客目标路径');
  }
  if (samePath(source, destination) || samePath(source, blog) || samePath(destination, blogSource)) {
    throw new Error('Source and destination paths overlap / 源目录与目标目录发生重叠');
  }
  return { source, blog, blogSource, destination, temporary, previous, sourceMeta: join(blog, SOURCE_META_FILE) };
}

function treeStats(root) {
  return treeStatsFromEntries(collectTree(root));
}

function sourceMetaMatches(path, identity) {
  if (!identity) return true;
  if (!existsSync(path)) return false;
  try {
    const current = JSON.parse(readFileSync(path, 'utf8'));
    return current.schema === 2 && current.version === identity.version && current.commit === identity.commit &&
      current.siteSha256 === identity.siteSha256;
  } catch (error) { return false; }
}


function writeDeploymentMeta(root, identity) {
  if (!identity) return;
  const target = join(root, 'data', 'build-meta.json');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify({
    version: identity.version,
    commit: identity.commit,
    branch: 'main',
    builtAt: shanghaiIsoNow(),
    timezone: 'Asia/Shanghai',
    siteSha256: identity.siteSha256,
  }, null, 2) + '\n');
}

function deploymentMetaMatches(root, identity) {
  if (!identity) return true;
  const target = join(root, 'data', 'build-meta.json');
  if (!existsSync(target)) return false;
  try {
    const meta = JSON.parse(readFileSync(target, 'utf8'));
    return meta.version === identity.version && meta.commit === identity.commit && meta.branch === 'main' &&
      meta.siteSha256 === identity.siteSha256 && meta.timezone === 'Asia/Shanghai' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/.test(meta.builtAt || '');
  } catch (error) { return false; }
}

function writeSourceMeta(path, identity) {
  if (!identity) return;
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, JSON.stringify({ schema: 2, version: identity.version, commit: identity.commit, siteSha256: identity.siteSha256 }, null, 2) + '\n');
  renameSync(temporary, path);
}

export function syncBlogMirror({ sourceDir = DEFAULT_SOURCE, blogRepo = DEFAULT_BLOG, checkOnly = false, sourceIdentity = null, hooks = {} } = {}) {
  const layout = validateLayout(sourceDir, blogRepo);
  const { source, destination, temporary, previous, sourceMeta } = layout;
  const sourceRelease = assertSiteRelease(source);
  if (sourceIdentity && (sourceIdentity.version !== sourceRelease.pointer.version || sourceIdentity.siteSha256 !== sourceRelease.siteSha256)) {
    throw new Error('Source Git identity and site release identity disagree / Git 源身份与全站发布身份不一致');
  }
  const mirrorReleaseMatches = (root) => {
    try {
      const release = assertSiteRelease(root);
      return release.siteSha256 === sourceRelease.siteSha256;
    } catch (error) { return false; }
  };
  if (typeof hooks.onStart === 'function') hooks.onStart({ ...layout, checkOnly, sourceIdentity });
  if (checkOnly) {
    const ignoredPaths = sourceIdentity ? ['data/build-meta.json'] : [];
    return {
      ...layout,
      current: directoriesMatch(source, destination, { ignoredPaths }) && mirrorReleaseMatches(destination) &&
        sourceMetaMatches(sourceMeta, sourceIdentity) && deploymentMetaMatches(destination, sourceIdentity),
      stats: treeStats(source),
    };
  }
  if (existsSync(previous)) {
    if (existsSync(destination)) rmSync(previous, { recursive: true, force: true });
    else renameSync(previous, destination);
  }
  rmSync(temporary, { recursive: true, force: true });
  try {
    copyTree(source, temporary, hooks);
    writeDeploymentMeta(temporary, sourceIdentity);
    if (typeof hooks.afterCopy === 'function') hooks.afterCopy({ ...layout });
    const ignoredPaths = sourceIdentity ? ['data/build-meta.json'] : [];
    if (!directoriesMatch(source, temporary, { ignoredPaths }) || !mirrorReleaseMatches(temporary) || !deploymentMetaMatches(temporary, sourceIdentity)) {
      throw new Error('Temporary mirror verification failed / 临时镜像校验失败');
    }
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
  const previousMeta = existsSync(sourceMeta) ? readFileSync(sourceMeta) : null;
  let previousStaged = false;
  try {
    if (existsSync(destination)) {
      rmSync(previous, { recursive: true, force: true });
      renameSync(destination, previous);
      previousStaged = true;
    }
    renameSync(temporary, destination);
    if (typeof hooks.afterActivate === 'function') hooks.afterActivate({ ...layout });
    const ignoredPaths = sourceIdentity ? ['data/build-meta.json'] : [];
    if (!directoriesMatch(source, destination, { ignoredPaths }) || !mirrorReleaseMatches(destination) || !deploymentMetaMatches(destination, sourceIdentity)) {
      throw new Error('Activated mirror verification failed / 启用后的镜像校验失败');
    }
    writeSourceMeta(sourceMeta, sourceIdentity);
    if (!sourceMetaMatches(sourceMeta, sourceIdentity)) throw new Error('WRT source identity verification failed / WRT 源身份校验失败');
    rmSync(previous, { recursive: true, force: true });
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true });
    rmSync(destination, { recursive: true, force: true });
    if (previousStaged && existsSync(previous)) renameSync(previous, destination);
    if (previousMeta === null) rmSync(sourceMeta, { force: true });
    else writeFileSync(sourceMeta, previousMeta);
    throw error;
  }
  return { ...layout, current: true, stats: treeStats(destination), sourceIdentity, siteSha256: sourceRelease.siteSha256 };
}

function gitText(args, cwd = ROOT) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function exactSourceSnapshot(ref, sourceRepo = ROOT) {
  const repo = resolve(sourceRepo);
  const commit = gitText(['rev-parse', '--verify', `${ref}^{commit}`], repo).toLowerCase();
  const worktree = mkdtempSync(join(tmpdir(), 'weig-blog-source-'));
  let added = false;
  try {
    execFileSync('git', ['-C', repo, 'worktree', 'add', '--detach', '--force', worktree, commit], { stdio: 'ignore' });
    added = true;
    const version = readFileSync(join(worktree, 'VERSION'), 'utf8').trim();
    if (!/^v\d{10}$/.test(version)) throw new Error(`Invalid VERSION at ${ref}: ${version}`);
    const release = assertSiteRelease(join(worktree, 'site', 'wrt'));
    if (release.pointer.version !== version) {
      throw new Error(`VERSION/site-version mismatch at ${ref}: ${version} != ${release.pointer.version || '(missing)'}`);
    }
    return {
      sourceDir: join(worktree, 'site', 'wrt'),
      sourceIdentity: { version, commit, siteSha256: release.siteSha256 },
      cleanup() {
        if (added) {
          try { execFileSync('git', ['-C', repo, 'worktree', 'remove', '--force', worktree], { stdio: 'ignore' }); } catch (error) { /* cleanup below */ }
          try { execFileSync('git', ['-C', repo, 'worktree', 'prune'], { stdio: 'ignore' }); } catch (error) { /* best effort */ }
        }
        rmSync(worktree, { recursive: true, force: true });
      },
    };
  } catch (error) {
    if (added) {
      try { execFileSync('git', ['-C', repo, 'worktree', 'remove', '--force', worktree], { stdio: 'ignore' }); } catch (cleanupError) { /* best effort */ }
    }
    rmSync(worktree, { recursive: true, force: true });
    throw error;
  }
}

function parseCli(argv) {
  let checkOnly = false;
  let blogRepo = '';
  let ref = '';
  let sourceRepo = ROOT;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') checkOnly = true;
    else if (arg === '--source-repo') {
      sourceRepo = argv[++i] || '';
      if (!sourceRepo) throw new Error('--source-repo requires a path / --source-repo 需要路径');
    } else if (arg === '--ref') {
      ref = argv[++i] || '';
      if (!ref) throw new Error('--ref requires a Git ref / --ref 需要 Git 引用');
    } else if (arg.startsWith('--')) throw new Error(`Unknown option / 未知选项: ${arg}`);
    else {
      if (blogRepo) throw new Error('Only one blog repository path is allowed / 只能指定一个博客仓库路径');
      blogRepo = arg;
    }
  }
  return { checkOnly, blogRepo: blogRepo || DEFAULT_BLOG, ref, sourceRepo };
}

function runCli() {
  let snapshot = null;
  try {
    const options = parseCli(process.argv.slice(2));
    if (options.ref) snapshot = exactSourceSnapshot(options.ref, options.sourceRepo);
    const sourceDir = snapshot?.sourceDir || DEFAULT_SOURCE;
    const sourceIdentity = snapshot?.sourceIdentity || null;
    const hooks = options.checkOnly ? {} : {
      onStart: ({ source, destination }) => {
        console.log(`[blog:source] ${source}`);
        console.log(`[blog:destination] ${destination}`);
        if (sourceIdentity) {
          console.log(`[blog:identity] ${sourceIdentity.version} ${sourceIdentity.commit}`);
          console.log(`[blog:site-sha256] ${sourceIdentity.siteSha256}`);
        }
      },
      onProgress: ({ copied, total, relativePath }) => {
        const suffix = relativePath ? ` (${relativePath})` : '';
        console.log(`[blog:copy] ${copied}/${total} files${suffix}`);
      },
    };
    const result = syncBlogMirror({ sourceDir, blogRepo: options.blogRepo, checkOnly: options.checkOnly, sourceIdentity, hooks });
    if (options.checkOnly) {
      if (result.current) {
        console.log('Blog source/wrt and source identity are current / 博客 WRT 镜像与源身份均一致。');
        return 0;
      }
      console.log('Blog WRT mirror needs synchronization / 博客 WRT 镜像需要同步。');
      return 3;
    }
    console.log('[blog:verify] Exact mirror + siteSha256 confirmed / 已确认精确镜像与全站 SHA-256');
    console.log(`[blog:site-sha256] ${result.siteSha256}`);
    console.log(`[blog:summary] ${result.stats.files} files, ${result.stats.directories} directories, ${result.stats.bytes} bytes`);
    return 0;
  } catch (error) {
    console.error(`[blog:error] ${error?.message || error}`);
    return 1;
  } finally {
    snapshot?.cleanup();
  }
}

if (process.argv[1] && samePath(process.argv[1], MODULE_PATH)) process.exitCode = runCli();
