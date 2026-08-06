#!/usr/bin/env node
// 零依赖本地静态文件服务器,仅用于本地预览 site/ 页面,不做缓存/压缩 / Zero-dependency static file server for previewing site/ locally; no caching or compression on purpose.
// 用法 / Usage: node tools/serve.mjs <目录 dir> [端口 port, 默认 default 8642]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';

const ROOT = process.argv[2];
const PORT = Number(process.argv[3] || 8642);
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.config': 'text/plain; charset=utf-8' };

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(ROOT, p));
    // 规范化后必须仍在 ROOT 内,防 ../ 目录穿越 / normalized path must stay inside ROOT to block ../ directory traversal
    if (!file.startsWith(normalize(ROOT))) { res.writeHead(403).end(); return; }
    const data = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    res.end(data);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));
