#!/usr/bin/env node
// 把 site/wrt/ 同步到 Hexo 博客仓库的 source/wrt/,剔除所有大体积 *.config / Syncs site/wrt/ into the Hexo blog's source/wrt/, excluding all bulky *.config files.
// 博客端页面本地取 config 404 后会自动走 jsDelivr → raw,剔除可省博客仓库体积与流量 / The blog page falls back to jsDelivr → raw when a local config 404s, so excluding them saves blog repo size and bandwidth.
// 用法 / Usage: node tools/sync-blog.mjs [博客仓库路径 blog repo path]   默认 / default: ../weige-share-blog

import { cpSync, rmSync, renameSync, existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'site', 'wrt');
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const blogRepo = args.find((arg) => arg !== '--check') || join(ROOT, '..', 'weige-share-blog');
const DEST = join(blogRepo, 'source', 'wrt');

if (!existsSync(join(blogRepo, '_config.yml')) || !existsSync(join(blogRepo, 'source'))) {
  console.error(`目标不是 Hexo 仓库(缺 _config.yml 或 source/): ${blogRepo}`);
  process.exit(1);
}

function sourceFiles(dir, root = dir, files = new Map()) {
  if (!existsSync(dir)) return files;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const relative = path.slice(root.length + 1);
    const stat = statSync(path);
    if (stat.isDirectory()) sourceFiles(path, root, files);
    else if (!relative.endsWith('.config')) files.set(relative, path);
  }
  return files;
}

function directoriesMatch() {
  const source = sourceFiles(SRC);
  const destination = sourceFiles(DEST);
  if (source.size !== destination.size) return false;
  for (const [relative, sourcePath] of source) {
    const destinationPath = destination.get(relative);
    if (!destinationPath || !readFileSync(sourcePath).equals(readFileSync(destinationPath))) return false;
  }
  return true;
}

if (checkOnly) {
  if (directoriesMatch()) {
    console.log('Blog copy is already current; no site file changes.');
    process.exit(0);
  }
  console.log('Blog copy needs synchronization.');
  process.exit(3);
}

// 先拷到临时目录,成功后再原子替换,拷贝中途失败不会丢已有副本 / copy into a temp dir first, then swap atomically — a mid-copy failure never destroys the existing copy
const TMP = DEST + '.tmp';
rmSync(TMP, { recursive: true, force: true });
cpSync(SRC, TMP, {
  recursive: true,
  filter: (p) => !p.endsWith('.config'),
});
rmSync(DEST, { recursive: true, force: true });
renameSync(TMP, DEST);

let files = 0, bytes = 0;
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else { files++; bytes += st.size; }
  }
})(DEST);
console.log(`已同步到 ${DEST}`);
console.log(`${files} 个文件,共 ${Math.round(bytes / 1024)}KB(base config 已剔除,走 CDN)`);
