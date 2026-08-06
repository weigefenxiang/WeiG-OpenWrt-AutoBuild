#!/usr/bin/env node
// 把主仓库 site/wrt/ 精确镜像到 Hexo 博客 source/wrt/。
// Exact-mirrors the main repository's site/wrt/ into the Hexo blog's source/wrt/.
// 用法 / Usage: node tools/sync-blog.mjs [博客仓库路径 blog repo path] [--check]

import {
  cpSync,
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_PATH = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(MODULE_PATH), '..');
const DEFAULT_SOURCE = join(ROOT, 'site', 'wrt');
const DEFAULT_BLOG = resolve(ROOT, '..', 'weige-share-blog');
const REQUIRED_SOURCE_FILES = ['index.html', 'app.js', join('data', 'site-version.json')];

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
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`${label} must be a real directory / 必须是真实目录: ${path}`);
  }
}

function assertRegularFile(path, label) {
  if (!existsSync(path)) throw new Error(`${label} does not exist / 不存在: ${path}`);
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`${label} must be a regular file / 必须是普通文件: ${path}`);
  }
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
      if (stat.isSymbolicLink()) {
        throw new Error(`Symbolic links are not allowed in the web mirror / 网页镜像不允许符号链接: ${path}`);
      }
      if (stat.isDirectory()) {
        entries.set(rel, { type: 'dir', path, size: 0 });
        walk(path);
      } else if (stat.isFile()) {
        entries.set(rel, { type: 'file', path, size: stat.size });
      } else {
        throw new Error(`Unsupported filesystem entry / 不支持的文件类型: ${path}`);
      }
    }
  };

  walk(normalizedRoot);
  return entries;
}

export function directoriesMatch(sourceDir, destinationDir) {
  if (!existsSync(destinationDir)) return false;
  const source = collectTree(sourceDir);
  const destination = collectTree(destinationDir);
  if (source.size !== destination.size) return false;

  for (const [rel, sourceEntry] of source) {
    const destinationEntry = destination.get(rel);
    if (!destinationEntry || sourceEntry.type !== destinationEntry.type) return false;
    if (sourceEntry.type === 'file') {
      if (sourceEntry.size !== destinationEntry.size) return false;
      if (!readFileSync(sourceEntry.path).equals(readFileSync(destinationEntry.path))) return false;
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
  for (const rel of REQUIRED_SOURCE_FILES) {
    assertRegularFile(join(source, rel), `Required site file ${rel} / 必需网页文件 ${rel}`);
  }

  assertRegularDirectory(blog, 'Blog repository / 博客仓库');
  if (!existsSync(join(blog, '.git'))) {
    throw new Error(`Blog repository is missing .git / 博客仓库缺少 .git: ${blog}`);
  }
  assertRegularFile(join(blog, '_config.yml'), 'Hexo _config.yml');
  assertRegularDirectory(blogSource, 'Hexo source / Hexo source 目录');

  if (!isDirectChild(blogSource, destination, 'wrt') ||
      !isDirectChild(blogSource, temporary, 'wrt.sync-tmp') ||
      !isDirectChild(blogSource, previous, 'wrt.sync-prev')) {
    throw new Error('Refusing unsafe blog destination paths / 拒绝不安全的博客目标路径');
  }
  if (samePath(source, destination) || samePath(source, blog) || samePath(destination, blogSource)) {
    throw new Error('Source and destination paths overlap / 源目录与目标目录发生重叠');
  }

  return { source, blog, blogSource, destination, temporary, previous };
}

function treeStats(root) {
  const entries = collectTree(root);
  let files = 0;
  let directories = 0;
  let bytes = 0;
  for (const entry of entries.values()) {
    if (entry.type === 'dir') directories++;
    else {
      files++;
      bytes += entry.size;
    }
  }
  return { files, directories, bytes };
}

export function syncBlogMirror({
  sourceDir = DEFAULT_SOURCE,
  blogRepo = DEFAULT_BLOG,
  checkOnly = false,
  hooks = {},
} = {}) {
  const layout = validateLayout(sourceDir, blogRepo);
  const { source, destination, temporary, previous } = layout;

  if (checkOnly) {
    return {
      ...layout,
      current: directoriesMatch(source, destination),
      stats: treeStats(source),
    };
  }

  // Recover an interrupted previous activation before starting a new copy.
  if (existsSync(previous)) {
    if (existsSync(destination)) rmSync(previous, { recursive: true, force: true });
    else renameSync(previous, destination);
  }
  rmSync(temporary, { recursive: true, force: true });

  try {
    cpSync(source, temporary, {
      recursive: true,
      force: false,
      errorOnExist: true,
      verbatimSymlinks: true,
    });
    if (typeof hooks.afterCopy === 'function') hooks.afterCopy({ ...layout });
    if (!directoriesMatch(source, temporary)) {
      throw new Error('Temporary mirror verification failed / 临时镜像校验失败');
    }
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true });
    throw error;
  }

  let previousStaged = false;
  try {
    if (existsSync(destination)) {
      rmSync(previous, { recursive: true, force: true });
      renameSync(destination, previous);
      previousStaged = true;
    }
    renameSync(temporary, destination);
    if (typeof hooks.afterActivate === 'function') hooks.afterActivate({ ...layout });
    if (!directoriesMatch(source, destination)) {
      throw new Error('Activated mirror verification failed / 启用后的镜像校验失败');
    }
    rmSync(previous, { recursive: true, force: true });
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true });
    rmSync(destination, { recursive: true, force: true });
    if (previousStaged && existsSync(previous)) renameSync(previous, destination);
    throw error;
  }

  return {
    ...layout,
    current: true,
    stats: treeStats(destination),
  };
}

function parseCli(argv) {
  let checkOnly = false;
  let blogRepo = '';
  for (const arg of argv) {
    if (arg === '--check') {
      checkOnly = true;
      continue;
    }
    if (arg.startsWith('--')) throw new Error(`Unknown option / 未知选项: ${arg}`);
    if (blogRepo) throw new Error('Only one blog repository path is allowed / 只能指定一个博客仓库路径');
    blogRepo = arg;
  }
  return { checkOnly, blogRepo: blogRepo || DEFAULT_BLOG };
}

function runCli() {
  try {
    const options = parseCli(process.argv.slice(2));
    const result = syncBlogMirror({
      sourceDir: DEFAULT_SOURCE,
      blogRepo: options.blogRepo,
      checkOnly: options.checkOnly,
    });

    if (options.checkOnly) {
      if (result.current) {
        console.log('Blog source/wrt is an exact mirror / 博客 source/wrt 已是精确镜像。');
        return 0;
      }
      console.log('Blog source/wrt needs exact-mirror synchronization / 博客 source/wrt 需要精确镜像同步。');
      return 3;
    }

    console.log(`[blog:source] ${result.source}`);
    console.log(`[blog:destination] ${result.destination}`);
    console.log('[blog:verify] Exact mirror confirmed / 已确认精确镜像');
    console.log(`[blog:summary] ${result.stats.files} files, ${result.stats.directories} directories, ${result.stats.bytes} bytes`);
    return 0;
  } catch (error) {
    console.error(`[blog:error] ${error?.message || error}`);
    return 1;
  }
}

if (process.argv[1] && samePath(process.argv[1], MODULE_PATH)) {
  process.exitCode = runCli();
}
