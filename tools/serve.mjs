#!/usr/bin/env node
// 零依赖本地静态文件服务器,仅用于本地预览 site/ 页面,不做缓存/压缩 / Zero-dependency static file server for previewing site/ locally; no caching or compression on purpose.
// 用法 / Usage: node tools/serve.mjs <目录 dir> [端口 port, 默认 default 8642] [--interactive]
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { createBuildMeta } from './gen-build-meta.mjs';

const ROOT = resolve(process.argv[2] || '.');
const PORT = Number(process.argv[3] || 8642);
const INTERACTIVE = process.argv.includes('--interactive');
const BUILD_META_ROOT_INDEX = process.argv.indexOf('--build-meta-root');
if (BUILD_META_ROOT_INDEX >= 0 && (!process.argv[BUILD_META_ROOT_INDEX + 1] ||
    process.argv[BUILD_META_ROOT_INDEX + 1].startsWith('--'))) {
  console.error('[ERROR] --build-meta-root requires a repository path.');
  process.exit(2);
}
const BUILD_META_ROOT = BUILD_META_ROOT_INDEX >= 0
  ? resolve(process.argv[BUILD_META_ROOT_INDEX + 1])
  : '';
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.config': 'text/plain; charset=utf-8' };

function gitOutput(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch { return ''; }
}

let localBuildMetaEnabled = false;
let localBuildTime = '';
if (BUILD_META_ROOT) {
  try {
    const payload = createBuildMeta({ root: BUILD_META_ROOT });
    if (!payload.branch || !payload.commit) {
      throw new Error('a canonical branch and full Git commit are required');
    }
    localBuildMetaEnabled = true;
    localBuildTime = payload.builtAt;
    const dirty = gitOutput(BUILD_META_ROOT, ['status', '--porcelain', '--untracked-files=no']);
    if (dirty) {
      console.warn('[WARN] Local changes are preview-only; cloud builds use the committed HEAD shown below.');
    }
    const upstreamCommit = gitOutput(BUILD_META_ROOT, ['rev-parse', '--verify', '@{upstream}']);
    if (!upstreamCommit || upstreamCommit !== payload.commit) {
      console.warn('[WARN] Current HEAD is not equal to its upstream branch; a cloud request may be rejected until it is pushed.');
    }
    console.log(`[identity] ${payload.branch}@${payload.commit}`);
  } catch (error) {
    console.error(`[ERROR] Cannot prepare local deployment identity: ${error.message}`);
    process.exit(1);
  }
}

function currentLocalBuildMeta() {
  const payload = createBuildMeta({ root: BUILD_META_ROOT, builtAt: localBuildTime });
  if (!payload.branch || !payload.commit) {
    throw new Error('a canonical branch and full Git commit are required');
  }
  return Buffer.from(JSON.stringify(payload, null, 2) + '\n');
}

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(ROOT, p));
    // 规范化后必须仍在 ROOT 内,防 ../ 目录穿越 / normalized path must stay inside ROOT to block ../ directory traversal
    if (!file.startsWith(normalize(ROOT))) { res.writeHead(403).end(); return; }
    const virtualBuildMeta = localBuildMetaEnabled && p === '/data/build-meta.json';
    const data = virtualBuildMeta ? currentLocalBuildMeta() : await readFile(file);
    res.writeHead(200, {
      'content-type': virtualBuildMeta ? MIME['.json'] : MIME[extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    res.end(data);
  } catch (error) {
    if (error?.code === 'ENOENT') res.writeHead(404).end('not found');
    else res.writeHead(500).end('preview server error');
  }
});

let closing = false;
function stopServer(exitCode = 0) {
  if (closing) return;
  closing = true;
  server.close(() => process.exit(exitCode));
  server.closeIdleConnections?.();
  setTimeout(() => server.closeAllConnections?.(), 1000).unref();
}

server.listen(PORT, () => {
  const address = server.address();
  const listeningPort = typeof address === 'object' && address ? address.port : PORT;
  console.log(`serving ${ROOT} on http://localhost:${listeningPort}`);
  if (!INTERACTIVE) return;
  console.log('');
  console.log('0. Stop local preview and return');
  const input = createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY && process.stdout.isTTY) });
  const prompt = () => input.question('Select: ', (answer) => {
    if (answer.trim() === '0') {
      input.close();
      stopServer(0);
      return;
    }
    console.log('Enter 0 to stop local preview and return.');
    prompt();
  });
  input.on('close', () => {
    if (!closing && process.stdin.readableEnded) stopServer(0);
  });
  prompt();
});

process.on('SIGINT', () => stopServer(0));
process.on('SIGTERM', () => stopServer(0));
