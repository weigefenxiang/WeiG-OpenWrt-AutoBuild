#!/usr/bin/env node
/*
 * Zero-dependency browser regression for site/wrt.
 *
 * This deliberately talks to headless Chrome through the Chrome DevTools
 * Protocol (CDP).  It does not require npm, Playwright, Puppeteer, or a
 * chromedriver binary.  The test is safe for CI: it never clicks the real
 * cloud-build button and the file chooser is stubbed before exercising the
 * Load config entry.
 */

import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { connect, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_ROOT = join(ROOT, 'site', 'wrt');
const REQUIRED_IDS = Object.freeze([
  'sideDock', 'dockToggle', 'langSel', 'selfTestBtn', 'densityBtn', 'themeBtn',
  'fontPanel', 'fontDec', 'fontInput', 'fontInc', 'fontReset',
  'helpBtn', 'actionbar', 'siteVersion', 'buildInfo', 'buildInfoCard', 'buildInfoClose',
  'importBtn', 'configImport', 'submitBtn', 'modal', 'modalClose', 'modalBody',
  'uiTooltip', 'catalogLocator', 'timezoneBox', 'timezoneMenu',
  'menuconfigBox', 'menuconfigToggle', 'menuconfigBody',
]);
const VIEWPORTS = Object.freeze([
  { name: 'phone-320x568', width: 320, height: 568 },
  { name: 'phone-360x640', width: 360, height: 640 },
  { name: 'phone-390x844', width: 390, height: 844 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'short-1024x600', width: 1024, height: 600 },
  { name: 'desktop-1366x768', width: 1366, height: 768 },
  { name: 'desktop-1920x1080', width: 1920, height: 1080 },
]);
const THEMES = Object.freeze(['light', 'dark']);
const DOCK_CONTROL_SELECTORS = Object.freeze([
  '#dockToggle', '#langSel', '#selfTestBtn', '#densityBtn', '#themeBtn',
]);
const CI = /^(1|true|yes)$/i.test(String(process.env.CI || ''));
const REQUIRED = CI || /^(1|true|yes)$/i.test(String(process.env.WEIG_UI_BROWSER_REQUIRED || ''));
const LOAD_TIMEOUT_MS = Number(process.env.WEIG_UI_LOAD_TIMEOUT_MS) > 0
  ? Number(process.env.WEIG_UI_LOAD_TIMEOUT_MS) : 45_000;
const COMMAND_TIMEOUT_MS = Number(process.env.WEIG_UI_COMMAND_TIMEOUT_MS) > 0
  ? Number(process.env.WEIG_UI_COMMAND_TIMEOUT_MS) : 20_000;
const TARGET_URL = String(process.env.WEIG_UI_URL || '').trim();
const requestedBrowser = String(process.env.WEIG_CHROME_PATH || process.env.CHROME_BIN || '').trim();

function findOnPath(command) {
  const result = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [command], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true,
  });
  if (result.status !== 0) return '';
  return String(result.stdout || '').split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
}

function firstExisting(paths) {
  return paths.find((path) => path && existsSync(path)) || '';
}

function findChrome() {
  if (requestedBrowser && existsSync(requestedBrowser)) return requestedBrowser;
  const candidates = process.platform === 'win32' ? [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe',
  ] : process.platform === 'darwin' ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ] : [
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ];
  return firstExisting(candidates) || findOnPath('google-chrome') ||
    findOnPath('google-chrome-stable') || findOnPath('chromium') || findOnPath('chromium-browser');
}

function findChromeDriver() {
  const requested = String(process.env.WEIG_CHROMEDRIVER_PATH || process.env.CHROMEDRIVER_PATH || '').trim();
  if (requested && existsSync(requested)) return requested;
  const candidates = process.platform === 'win32' ? [
    'C:/WebDriver/bin/chromedriver.exe',
    'C:/tools/chromedriver.exe',
    'C:/Program Files/Google/Chrome/Application/chromedriver.exe',
  ] : ['/usr/bin/chromedriver', '/usr/local/bin/chromedriver'];
  return firstExisting(candidates) || findOnPath(process.platform === 'win32' ? 'chromedriver.exe' : 'chromedriver');
}

function httpJson(port, path, { method = 'GET', body = undefined, timeoutMs = 5_000 } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const request = httpRequest({
      host: '127.0.0.1', port, path, method,
      headers: payload ? { 'content-type': 'application/json', 'content-length': payload.length } : {},
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let value = null;
        try { value = text ? JSON.parse(text) : null; } catch (error) {
          reject(new Error(`HTTP ${method} ${path}: invalid JSON (${error.message})`));
          return;
        }
        if ((response.statusCode || 0) >= 400) {
          reject(new Error(`HTTP ${method} ${path}: ${response.statusCode} ${text.slice(0, 300)}`));
          return;
        }
        resolve(value);
      });
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error(`HTTP ${method} ${path}: timeout`)));
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

function allocatePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitFor(label, callback, timeoutMs = LOAD_TIMEOUT_MS, intervalMs = 150) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started <= timeoutMs) {
    try {
      const value = await callback();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }
  throw new Error(`${label} timed out after ${timeoutMs}ms${lastError ? `: ${lastError.message}` : ''}`);
}

function copyTree(source, destination) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(destination, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else if (entry.isFile()) writeFileSync(to, readFileSync(from));
  }
}

async function startPreview() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'weig-ui-preview-'));
  const fixtureSite = join(fixtureRoot, 'site', 'wrt');
  copyTree(SITE_ROOT, fixtureSite);

  // Keep the optional deployment identity valid in a working tree.  The
  // source repository may be ahead of its committed site-version pointer
  // while a design change is being reviewed; this rewrite is temp-only.
  const pointerPath = join(fixtureSite, 'data', 'site-version.json');
  const pointer = JSON.parse(readFileSync(pointerPath, 'utf8'));
  const commitResult = spawnSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  const commit = String(commitResult.stdout || '').trim();
  writeFileSync(join(fixtureSite, 'data', 'build-meta.json'), `${JSON.stringify({
    version: pointer.version,
    siteSha256: pointer.siteSha256,
    commit: /^[a-f0-9]{40}$/.test(commit) ? commit : '0'.repeat(40),
    branch: 'dev',
    builtAt: '2026-08-30T00:00:00+08:00',
    timezone: pointer.timezone,
  }, null, 2)}\n`);

  const port = await allocatePort();
  const child = spawn(process.execPath, [join(ROOT, 'tools', 'serve.mjs'), fixtureSite, String(port)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');
  child.stdout?.on('data', (chunk) => { stdout += chunk; });
  child.stderr?.on('data', (chunk) => { stderr += chunk; });
  try {
    await waitFor('local preview server', () => /serving .* on http:\/\/localhost:\d+/.test(stdout), 10_000, 50);
    return {
      child,
      fixtureRoot,
      url: `http://127.0.0.1:${port}/?r=${encodeURIComponent(pointer.siteSha256)}`,
      stop() { if (child.exitCode === null) child.kill(); },
    };
  } catch (error) {
    if (child.exitCode === null) child.kill();
    rmSync(fixtureRoot, { recursive: true, force: true });
    throw new Error(`${error.message}; stdout=${stdout.slice(0, 400)} stderr=${stderr.slice(0, 400)}`);
  }
}

class CdpConnection {
  constructor(webSocketUrl) {
    this.url = new URL(webSocketUrl);
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.handshakeDone = false;
    this.handshakePromise = null;
    this.pending = new Map();
    this.fragments = [];
    this.fragmentOpcode = 0;
    this.nextId = 0;
  }

  async connect() {
    this.socket = await new Promise((resolve, reject) => {
      const socket = connect({ port: Number(this.url.port), host: this.url.hostname }, () => resolve(socket));
      socket.once('error', reject);
    });
    this.handshakePromise = new Promise((resolve, reject) => {
      this._handshakeResolve = resolve;
      this._handshakeReject = reject;
    });
    this.socket.on('data', (chunk) => this._onData(chunk));
    this.socket.on('error', (error) => {
      this._handshakeReject?.(error);
      for (const { reject: fail } of this.pending.values()) fail(error);
      this.pending.clear();
    });
    this.socket.on('close', () => {
      const error = new Error('CDP websocket closed');
      this._handshakeReject?.(error);
      for (const { reject: fail } of this.pending.values()) fail(error);
      this.pending.clear();
    });
    const key = randomBytes(16).toString('base64');
    const host = `${this.url.hostname}:${this.url.port}`;
    this.socket.write(
      `GET ${this.url.pathname}${this.url.search} HTTP/1.1\r\n` +
      `Host: ${host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
      `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`,
    );
    await Promise.race([
      this.handshakePromise,
      delay(COMMAND_TIMEOUT_MS).then(() => { throw new Error('CDP websocket handshake timed out'); }),
    ]);
    return this;
  }

  _onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (!this.handshakeDone) {
      const marker = this.buffer.indexOf('\r\n\r\n');
      if (marker < 0) return;
      const header = this.buffer.subarray(0, marker).toString('latin1');
      this.buffer = this.buffer.subarray(marker + 4);
      if (!/^HTTP\/1\.1 101\s/i.test(header)) {
        this._handshakeReject?.(new Error(`CDP websocket handshake failed: ${header.split('\r\n')[0]}`));
        return;
      }
      this.handshakeDone = true;
      this._handshakeResolve?.();
    }
    this._parseFrames();
  }

  _parseFrames() {
    while (this.buffer.length >= 2) {
      const first = this.buffer[0];
      const second = this.buffer[1];
      const fin = Boolean(first & 0x80);
      const opcode = first & 0x0f;
      const masked = Boolean(second & 0x80);
      let length = second & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (this.buffer.length < offset + 2) return;
        length = this.buffer.readUInt16BE(offset);
        offset += 2;
      } else if (length === 127) {
        if (this.buffer.length < offset + 8) return;
        const high = this.buffer.readUInt32BE(offset);
        const low = this.buffer.readUInt32BE(offset + 4);
        if (high > 0x1fffff) throw new Error('CDP websocket frame is too large');
        length = high * 0x100000000 + low;
        offset += 8;
      }
      const maskOffset = masked ? 4 : 0;
      if (this.buffer.length < offset + maskOffset + length) return;
      const mask = masked ? this.buffer.subarray(offset, offset + 4) : null;
      if (masked) offset += 4;
      const payload = Buffer.from(this.buffer.subarray(offset, offset + length));
      this.buffer = this.buffer.subarray(offset + length);
      if (mask) for (let index = 0; index < payload.length; index++) payload[index] ^= mask[index % 4];

      if (opcode === 0x8) {
        this.socket?.end();
        return;
      }
      if (opcode === 0x9) {
        this._sendFrame(payload, 0xA);
        continue;
      }
      if (opcode === 0x0) {
        this.fragments.push(payload);
        if (!fin) continue;
        this._handleMessage(this.fragmentOpcode, Buffer.concat(this.fragments));
        this.fragments = [];
        this.fragmentOpcode = 0;
        continue;
      }
      if (!fin) {
        this.fragmentOpcode = opcode;
        this.fragments = [payload];
        continue;
      }
      this._handleMessage(opcode, payload);
    }
  }

  _handleMessage(opcode, payload) {
    if (opcode !== 0x1) return;
    let message;
    try { message = JSON.parse(payload.toString('utf8')); } catch { return; }
    if (!message.id || !this.pending.has(message.id)) return;
    const pending = this.pending.get(message.id);
    this.pending.delete(message.id);
    if (message.error) pending.reject(new Error(`CDP ${message.error.code}: ${message.error.message}`));
    else pending.resolve(message.result);
  }

  _sendFrame(payload, opcode = 0x1) {
    const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    const length = data.length;
    let header;
    if (length < 126) header = Buffer.from([0x80 | opcode, 0x80 | length]);
    else if (length <= 0xffff) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode; header[1] = 0x80 | 126; header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode; header[1] = 0x80 | 127;
      header.writeUInt32BE(Math.floor(length / 0x100000000), 2);
      header.writeUInt32BE(length >>> 0, 6);
    }
    const mask = randomBytes(4);
    const masked = Buffer.from(data);
    for (let index = 0; index < masked.length; index++) masked[index] ^= mask[index % 4];
    this.socket?.write(Buffer.concat([header, mask, masked]));
  }

  command(method, params = {}) {
    if (!this.socket || !this.handshakeDone) return Promise.reject(new Error('CDP websocket is not connected'));
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} timed out after ${COMMAND_TIMEOUT_MS}ms`));
      }, COMMAND_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      });
      this._sendFrame(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.command('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true, userGesture: true,
    });
    if (result?.exceptionDetails) {
      const description = result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'JavaScript exception';
      throw new Error(description);
    }
    return result?.result?.value;
  }

  async close() {
    try { this._sendFrame(Buffer.alloc(0), 0x8); } catch { /* socket may already be closed */ }
    this.socket?.end();
    this.socket?.destroy();
  }
}

async function launchChrome(browser, url, viewport) {
  const port = await allocatePort();
  const profile = mkdtempSync(join(tmpdir(), 'weig-ui-chrome-'));
  const args = [
    '--headless=new', '--disable-gpu', '--disable-dev-shm-usage',
    '--remote-allow-origins=*', `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`, `--window-size=${viewport.width},${viewport.height}`,
    '--force-device-scale-factor=1', '--no-first-run', '--no-default-browser-check',
    url,
  ];
  if (process.platform !== 'win32') args.splice(2, 0, '--no-sandbox');
  const child = spawn(browser, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  let stderr = '';
  child.stderr?.setEncoding('utf8');
  child.stderr?.on('data', (chunk) => { stderr += chunk; });
  try {
    const version = await waitFor('Chrome DevTools endpoint', async () => {
      try { return await httpJson(port, '/json/version'); } catch { return null; }
    }, 15_000, 100);
    const target = await waitFor('Chrome page target', async () => {
      try {
        const pages = await httpJson(port, '/json/list');
        return pages.find((page) => page.type === 'page' && page.webSocketDebuggerUrl) || null;
      } catch { return null; }
    }, 15_000, 100);
    const connection = await new CdpConnection(target.webSocketDebuggerUrl).connect();
    await connection.command('Page.enable');
    await connection.command('Runtime.enable');
    return {
      child, profile, port, connection, stderr,
      async close() {
        await connection.close();
        if (child.exitCode === null) {
          child.kill();
          await new Promise((resolve) => {
            const timer = setTimeout(resolve, 2_000);
            child.once('exit', () => { clearTimeout(timer); resolve(); });
          });
        }
        for (let attempt = 0; attempt < 5; attempt++) {
          try { rmSync(profile, { recursive: true, force: true }); break; }
          catch (error) { if (error.code !== 'EBUSY' && error.code !== 'EPERM') throw error; await delay(200); }
        }
      },
      browserVersion: version?.Browser || '',
    };
  } catch (error) {
    if (child.exitCode === null) child.kill();
    await new Promise((resolve) => {
      if (child.exitCode !== null) { resolve(); return; }
      const timer = setTimeout(resolve, 2_000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
    try { rmSync(profile, { recursive: true, force: true }); } catch (cleanupError) {
      if (cleanupError.code !== 'EBUSY' && cleanupError.code !== 'EPERM') throw cleanupError;
    }
    throw new Error(`${error.message}; Chrome stderr=${stderr.slice(0, 600)}`);
  }
}

function argsExpression(args) {
  return JSON.stringify(args).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

async function evaluateFunction(browser, functionSource, args = []) {
  const expression = `(() => { const __args = ${argsExpression(args)}; return (${functionSource})(...__args); })()`;
  return browser.connection.evaluate(expression);
}

function viewportRect(value) {
  const vv = value?.visualViewport || {};
  const left = Number(vv.left ?? vv.offsetLeft ?? 0);
  const top = Number(vv.top ?? vv.offsetTop ?? 0);
  const width = Number(vv.width || value?.innerWidth || 0);
  const height = Number(vv.height || value?.innerHeight || 0);
  return { left, top, right: left + width, bottom: top + height, width, height };
}

async function getViewport(browser) {
  return browser.connection.evaluate(`(() => {
    const vv = window.visualViewport;
    return {
      innerWidth: window.innerWidth, innerHeight: window.innerHeight,
      visualViewport: vv ? { left: vv.offsetLeft, top: vv.offsetTop, width: vv.width, height: vv.height } : null,
      devicePixelRatio: window.devicePixelRatio,
    };
  })()`);
}

async function getElement(browser, selector) {
  return evaluateFunction(browser, `(selector) => {
    const element = document.querySelector(selector);
    if (!element) return { selector, present: false };
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      selector, present: true, connected: element.isConnected,
      hidden: Boolean(element.hidden), display: style.display, visibility: style.visibility,
      opacity: Number(style.opacity), rect: {
        left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
        width: rect.width, height: rect.height,
      }, ariaExpanded: element.getAttribute('aria-expanded'),
      className: typeof element.className === 'string' ? element.className : '',
      debugRuntimeGeometry: element.dataset.geometryDebug || null,
      debugGeometry: selector === '#uiTooltip' ? (() => {
        const target = document.getElementById('repoLink');
        const anchor = target?.getBoundingClientRect();
        const actionbar = document.getElementById('actionbar');
        const header = document.querySelector('.site-header');
        const rects = [header, actionbar].filter((node) => node && !node.hidden).map((node) => node.getBoundingClientRect()).map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }));
        const vv = window.visualViewport;
        const viewport = vv ? { left: vv.offsetLeft, top: vv.offsetTop, width: vv.width, height: vv.height } : { left: 0, top: 0, width: innerWidth, height: innerHeight };
        const cardRect = element.getBoundingClientRect();
        const geometry = window.__WEIG_VIEWPORT_GEOMETRY__?.calculateFloatingGeometry?.({
          anchorRect: anchor, layerRect: { width: cardRect.width, height: cardRect.height }, viewportRect: viewport,
          avoidRects: rects, margin: 8, gap: 9, maxWidth: 400, preferredHeight: cardRect.height, minHeight: 1,
          placements: ['below', 'above', 'right', 'left'], align: 'start',
        });
        return { rects, viewport, geometry };
      })() : undefined,
    };
  }`, [selector]);
}

function isVisible(record) {
  return Boolean(record?.present && record.connected && !record.hidden && record.display !== 'none' &&
    record.visibility !== 'hidden' && record.opacity !== 0 && record.rect.width > 0 && record.rect.height > 0);
}

function intersectionArea(a, b) {
  if (!a || !b) return 0;
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

function formatContext(context) {
  return `${context.theme}/${context.viewport.name} ${context.viewport.width}x${context.viewport.height}`;
}

async function main() {
  const browserPath = findChrome();
  const driverPath = findChromeDriver();
  console.log(`[ui-browser] Chrome: ${browserPath || '(not found)'}`);
  console.log(`[ui-browser] ChromeDriver: ${driverPath || '(not found; CDP mode does not require it)'}`);
  if (!browserPath) {
    const message = 'Headless Chrome is required for browser UI regression; install Chrome or set WEIG_CHROME_PATH.';
    if (REQUIRED) throw new Error(`[required] ${message}`);
    console.log(`[ui-browser] SKIP (local, no browser): ${message}`);
    return;
  }

  const preview = TARGET_URL ? null : await startPreview();
  const url = TARGET_URL || preview.url;
  const screenshotDir = { path: '' };
  const failures = [];
  let browser = null;
  const fail = (context, message, detail = undefined) => {
    const entry = `${formatContext(context)} — ${message}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`;
    failures.push(entry);
    console.error(`[ui-browser] ✗ ${entry}`);
  };
  const expect = (condition, context, message, detail = undefined) => {
    if (!condition) fail(context, message, detail);
  };

  async function screenshot(context) {
    if (!browser?.connection) return '';
    try {
      if (!screenshotDir.path) screenshotDir.path = mkdtempSync(join(tmpdir(), 'weig-ui-browser-fail-'));
      const payload = await browser.connection.command('Page.captureScreenshot', { format: 'png' });
      const filename = `${context.theme}-${context.viewport.name}.png`.replace(/[^A-Za-z0-9._-]/g, '_');
      const path = join(screenshotDir.path, filename);
      writeFileSync(path, Buffer.from(payload.data, 'base64'));
      return path;
    } catch (error) {
      console.error(`[ui-browser] screenshot unavailable: ${error.message}`);
      return '';
    }
  }

  async function click(selector) {
    await evaluateFunction(browser, `(selector) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error('missing ' + selector);
      element.click();
      return true;
    }`, [selector]);
  }

  async function pointerClick(selector) {
    await evaluateFunction(browser, `(selector) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error('missing ' + selector);
      element.scrollIntoView({ block: 'center', inline: 'nearest' });
      return true;
    }`, [selector]);
    const record = await getElement(browser, selector);
    if (!isVisible(record)) throw new Error(`${selector} is not visible for pointer activation`);
    const x = record.rect.left + (record.rect.width / 2);
    const y = record.rect.top + (record.rect.height / 2);
    await browser.connection.command('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await browser.connection.command('Input.dispatchMouseEvent', {
      type: 'mousePressed', x, y, button: 'left', clickCount: 1,
    });
    await browser.connection.command('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x, y, button: 'left', clickCount: 1,
    });
  }

  async function waitVisible(selector, context, timeoutMs = 5_000) {
    try {
      return await waitFor(`${selector} visible`, async () => {
        const record = await getElement(browser, selector);
        return isVisible(record) ? record : null;
      }, timeoutMs, 100);
    } catch (error) {
      fail(context, `${selector} did not become visible`, await getElement(browser, selector).catch(() => ({ error: error.message })));
      return null;
    }
  }

  async function waitState(context) {
    try {
      await waitFor('page application ready', async () => evaluateFunction(browser, `() => {
        const form = document.getElementById('form');
        const actionbar = document.getElementById('actionbar');
        return Boolean(window.__WEIG_UI_RUNTIME__ && form && !form.hidden && actionbar && !actionbar.hidden);
      }`), LOAD_TIMEOUT_MS, 200);
    } catch (error) {
      fail(context, 'page application did not become ready', await evaluateFunction(browser, `() => ({
        readyState: document.readyState,
        runtime: Boolean(window.__WEIG_UI_RUNTIME__),
        loading: document.getElementById('loading')?.textContent || '',
        formHidden: document.getElementById('form')?.hidden,
        actionbarHidden: document.getElementById('actionbar')?.hidden,
      })`).catch(() => ({ error: error.message })));
      return false;
    }
    const missing = await evaluateFunction(browser, (ids) => {
      return ids.filter((id) => !document.getElementById(id));
    }, [REQUIRED_IDS]);
    expect(!missing.length, context, 'required UI ids missing', missing);
    return true;
  }

  async function assertInside(selector, context, { actionbarSafe = false, required = true } = {}) {
    const [record, rawViewport] = await Promise.all([getElement(browser, selector), getViewport(browser)]);
    const viewport = viewportRect(rawViewport);
    if (!isVisible(record)) {
      if (required) fail(context, `${selector} is not visible`, { record, viewport });
      return record;
    }
    const rect = record.rect;
    const epsilon = 2;
    const inside = rect.left >= viewport.left - epsilon && rect.top >= viewport.top - epsilon &&
      rect.right <= viewport.right + epsilon && rect.bottom <= viewport.bottom + epsilon;
    expect(inside, context, `${selector} is outside visualViewport`, { rect, viewport });
    if (actionbarSafe) {
      const actionbar = await getElement(browser, '#actionbar');
      if (isVisible(actionbar)) {
        const overlap = intersectionArea(rect, actionbar.rect);
        expect(overlap <= 4, context, `${selector} overlaps actionbar`, { rect, actionbar: actionbar.rect, overlap, viewport, record });
      }
    }
    return record;
  }

  async function ensureDockControlsVisible(context) {
    const dockState = await evaluateFunction(browser, `() => {
      const dock = document.getElementById('sideDock');
      return {
        collapsed: Boolean(dock?.classList.contains('collapsed')),
        mode: dock?.dataset.dockMode || '',
      };
    }`);
    if (dockState?.mode === 'auto-collapsed') {
      const gear = await waitVisible('#dockToggle', context);
      expect(Boolean(gear), context, 'dock auto-collapse gear is not visible', dockState);
    }

    const readControls = () => Promise.all(
      DOCK_CONTROL_SELECTORS.map((selector) => getElement(browser, selector)),
    );
    let controls = await readControls();
    if (!controls.every(isVisible)) {
      await click('#dockToggle');
      try {
        controls = await waitFor('dock controls visible', async () => {
          const records = await readControls();
          return records.every(isVisible) ? records : null;
        }, 5_000, 100);
      } catch (error) {
        fail(context, 'dock controls did not become visible', {
          error: error.message,
          controls: await readControls().catch(() => []),
          dock: await getElement(browser, '#sideDock').catch(() => null),
        });
        return null;
      }
    }
    return controls;
  }

  async function resetFloatingState() {
    await evaluateFunction(browser, `() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const input = document.getElementById('timezoneBox');
      input?.blur();
      return true;
    }`).catch(() => {});
    await waitFor('floating layers reset', () => evaluateFunction(browser, `() => {
      const tooltip = document.getElementById('uiTooltip');
      const modal = document.getElementById('modal');
      const fontPanel = document.getElementById('fontPanel');
      const timezoneMenu = document.getElementById('timezoneMenu');
      return Boolean(tooltip?.hidden && modal?.hidden && fontPanel?.hidden && timezoneMenu?.hidden);
    }`), 3_000, 40).catch(() => {});
  }

  async function headerTooltipState(selector) {
    return evaluateFunction(browser, `(selector) => {
      const target = document.querySelector(selector);
      const tooltip = document.getElementById('uiTooltip');
      if (!target || !tooltip) return null;
      const tooltipRect = tooltip.getBoundingClientRect();
      const header = document.querySelector('.site-header')?.getBoundingClientRect();
      const actionbar = document.getElementById('actionbar')?.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const body = document.getElementById('uiTooltipBody');
      const bodyStyle = body ? getComputedStyle(body) : null;
      return {
        target: target.id || target.className,
        expected: target.dataset.uiTooltipBody || '',
        actual: body?.textContent || '',
        hidden: Boolean(tooltip.hidden),
        placement: tooltip.dataset.placement || '',
        targetRect: { left: targetRect.left, top: targetRect.top, right: targetRect.right, bottom: targetRect.bottom },
        tooltipRect: { left: tooltipRect.left, top: tooltipRect.top, right: tooltipRect.right, bottom: tooltipRect.bottom },
        header: header ? { left: header.left, top: header.top, right: header.right, bottom: header.bottom } : null,
        actionbar: actionbar ? { left: actionbar.left, top: actionbar.top, right: actionbar.right, bottom: actionbar.bottom } : null,
        active: document.activeElement === target,
        singleLine: tooltip.classList.contains('is-single-line'),
        singleLineCandidate: tooltip.dataset.tooltipSingleLine === 'true',
        bodyWhiteSpace: bodyStyle?.whiteSpace || '',
        bodyHeight: body?.getBoundingClientRect().height || 0,
        bodyLineHeight: bodyStyle ? parseFloat(bodyStyle.lineHeight) || 0 : 0,
      };
    }`, [selector]);
  }

  function tooltipSafe(state, context) {
    if (!state || state.hidden) return false;
    const rect = state.tooltipRect;
    const overlaps = (a, b) => a && b && Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
      Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);
    return rect.left >= -2 && rect.top >= -2 && rect.right <= context.viewport.width + 2 &&
      rect.bottom <= context.viewport.height + 2 && !overlaps(rect, state.header) &&
      !overlaps(rect, state.actionbar);
  }

  async function exerciseHeaderTooltips(context) {
    const selectors = ['#repoLink', '.header-actions .blog-link'];
    const initial = [];
    for (const selector of selectors) {
      const target = await evaluateFunction(browser, `(selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        element.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
        return { body: element.dataset.uiTooltipBody || '', aria: element.getAttribute('aria-label') || '' };
      }`, [selector]);
      const hovered = await waitFor(`${selector} hover tooltip`, async () => {
        const state = await headerTooltipState(selector);
        return state && !state.hidden && state.actual === state.expected && state.actual === target?.body &&
          tooltipSafe(state, context) ? state : null;
      }, 3_000, 40);
      initial.push({ selector, body: target?.body || '', aria: target?.aria || '', hovered });

      await evaluateFunction(browser, `(selector) => {
        const element = document.querySelector(selector);
        element?.focus({ preventScroll: true });
        return true;
      }`, [selector]);
      const focused = await waitFor(`${selector} focus tooltip`, async () => {
        const state = await headerTooltipState(selector);
        return state && state.active && !state.hidden && state.actual === state.expected &&
          tooltipSafe(state, context) ? state : null;
      }, 3_000, 40);
      if (!focused) throw new Error(`${selector} focus tooltip did not settle`);

      const updatedBody = `${target?.body || target?.aria || selector} · updated`;
      await evaluateFunction(browser, `(selector, value) => {
        const element = document.querySelector(selector);
        if (!element) return false;
        element.dataset.uiTooltipBody = value;
        element.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
        return true;
      }`, [selector, updatedBody]);
      const updated = await waitFor(`${selector} updated tooltip`, async () => {
        const state = await headerTooltipState(selector);
        return state && !state.hidden && state.actual === updatedBody && tooltipSafe(state, context) ? state : null;
      }, 3_000, 40);
      if (!updated) throw new Error(`${selector} tooltip content update did not settle`);
      await evaluateFunction(browser, `(selector, value) => {
        const element = document.querySelector(selector);
        if (!element) return false;
        element.dataset.uiTooltipBody = value;
        element.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
        return true;
      }`, [selector, target?.body || '']);
      await waitFor(`${selector} tooltip restored`, async () => {
        const state = await headerTooltipState(selector);
        return state && !state.hidden && state.actual === (target?.body || '') ? state : null;
      }, 3_000, 40);
    }

    const first = initial[0];
    const second = initial[1];
    await evaluateFunction(browser, `(selector) => document.querySelector(selector)?.focus({ preventScroll: true })`, [first.selector]);
    await waitFor('repo tooltip before adjacent retarget', async () => {
      const state = await headerTooltipState(first.selector);
      return state && state.active && state.actual === first.body ? state : null;
    }, 3_000, 40);
    await evaluateFunction(browser, `(selector) => document.querySelector(selector)?.focus({ preventScroll: true })`, [second.selector]);
    const retargeted = await waitFor('adjacent blog tooltip retarget', async () => {
      const state = await headerTooltipState(second.selector);
      return state && state.active && !state.hidden && state.actual === second.body && tooltipSafe(state, context) ? state : null;
    }, 3_000, 40);
    if (!retargeted) throw new Error('adjacent header tooltip retarget did not settle');

    const beforeResize = retargeted.tooltipRect;
    await evaluateFunction(browser, `() => { window.dispatchEvent(new Event('resize')); return true; }`);
    const reanchored = await waitFor('adjacent tooltip re-anchor', async () => {
      const state = await headerTooltipState(second.selector);
      return state && state.active && !state.hidden && state.actual === second.body && tooltipSafe(state, context) ? state : null;
    }, 3_000, 40);
    if (!reanchored) throw new Error('adjacent header tooltip re-anchor did not settle');
    if (Math.abs(reanchored.tooltipRect.left - beforeResize.left) > context.viewport.width + 2 ||
        Math.abs(reanchored.tooltipRect.top - beforeResize.top) > context.viewport.height + 2) {
      throw new Error('adjacent header tooltip moved outside viewport while re-anchoring');
    }
    await resetFloatingState();
  }

  async function exerciseDockTooltips(context) {
    const selectors = ['#selfTestBtn', '#densityBtn', '#themeBtn'];
    for (const selector of selectors) {
      const target = await evaluateFunction(browser, `(selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        element.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
        return { body: element.dataset.uiTooltipBody || '', aria: element.getAttribute('aria-label') || '' };
      }`, [selector]);
      const hovered = await waitFor(`${selector} hover tooltip`, async () => {
        const state = await headerTooltipState(selector);
        return state && !state.hidden && state.actual === state.expected && state.actual === target?.body &&
          tooltipSafe(state, context) ? state : null;
      }, 3_000, 40);
      if (!hovered) throw new Error(`${selector} hover tooltip did not settle`);
      expect(hovered.singleLineCandidate === true, context,
        `${selector} tooltip was not classified as a single-block message`, hovered);
      if (hovered.singleLine) {
        expect(hovered.bodyWhiteSpace === 'nowrap' && hovered.bodyHeight <= hovered.bodyLineHeight + 2,
          context, `${selector} short tooltip wrapped despite fitting`, hovered);
      }
      if (context.viewport.width >= 768) {
        expect(hovered.singleLine === true, context,
          `${selector} desktop tooltip did not use the single-line layout`, hovered);
      }

      await evaluateFunction(browser, `(selector) => {
        const element = document.querySelector(selector);
        element?.focus({ preventScroll: true });
        return true;
      }`, [selector]);
      const focused = await waitFor(`${selector} focus tooltip`, async () => {
        const state = await headerTooltipState(selector);
        return state && state.active && !state.hidden && state.actual === state.expected &&
          tooltipSafe(state, context) ? state : null;
      }, 3_000, 40);
      if (!focused) throw new Error(`${selector} focus tooltip did not settle`);
    }
    await resetFloatingState();
  }

  async function assertShortPageFooter(context) {
    await evaluateFunction(browser, `() => {
      const main = document.getElementById('app');
      for (const child of main?.children || []) child.style.display = 'none';
      for (const child of document.body.children) {
        if (!child.matches('.site-header, #app, .site-footer')) child.style.display = 'none';
      }
      window.scrollTo(0, 0);
      return true;
    }`);
    await waitFor('short-page layout settled', () => evaluateFunction(browser,
      `() => window.scrollY === 0 && document.querySelector('.site-footer')?.getBoundingClientRect().bottom > 0`),
    3_000, 40);
    const state = await evaluateFunction(browser, `() => {
      const body = document.body;
      const main = document.getElementById('app');
      const footer = document.querySelector('.site-footer');
      if (!body || !main || !footer) return null;
      const footerRect = footer.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      const bodyStyle = getComputedStyle(body);
      const mainStyle = getComputedStyle(main);
      return {
        bodyDisplay: bodyStyle.display,
        bodyDirection: bodyStyle.flexDirection,
        mainFlexGrow: Number(mainStyle.flexGrow),
        footerTop: footerRect.top,
        footerBottom: footerRect.bottom,
        bodyTop: bodyRect.top,
        bodyBottom: bodyRect.bottom,
        mainHeight: mainRect.height,
        scrollY: window.scrollY,
        viewportHeight: window.innerHeight,
        scrollHeight: document.documentElement.scrollHeight,
      };
    }`);
    expect(Boolean(state), context, 'short-page footer geometry is unavailable');
    if (!state) return;
    expect(state.bodyDisplay === 'flex' && state.bodyDirection === 'column' && state.mainFlexGrow > 0,
      context, 'page shell is not a growing column flex layout', state);
    expect(Math.abs(state.footerBottom - state.viewportHeight) <= 2,
      context, 'short-page footer leaves unused viewport space below it', state);
    expect(state.scrollHeight <= state.viewportHeight + 2,
      context, 'short-page shell creates avoidable document overflow', state);
  }

  async function runInteractions(context) {
    const { viewport } = context;
    await assertInside('#sideDock', context, { actionbarSafe: true });
    await assertInside('#helpBtn', context);
    await assertInside('#actionbar', context, { required: true });
    await assertInside('#importBtn', context);
    await assertInside('#siteVersion', context);

    const visualContract = await evaluateFunction(browser, `() => {
      const actions = [...document.querySelectorAll('.header-actions > .icon-btn, .header-actions > .text-btn')];
      const boxes = actions.map((element) => {
        const rect = element.getBoundingClientRect();
        return { height: rect.height, width: rect.width, display: getComputedStyle(element).display };
      });
      const lang = document.getElementById('langSel');
      const option = lang?.options?.[0];
      return {
        actionCount: actions.length,
        boxes,
        colorScheme: lang ? getComputedStyle(lang).colorScheme : '',
        optionColor: option ? getComputedStyle(option).color : '',
        optionBackground: option ? getComputedStyle(option).backgroundColor : '',
        starfield: getComputedStyle(document.body).backgroundImage.includes('radial-gradient'),
        bodyAnimation: getComputedStyle(document.body).animationName,
      };
    }`);
    const heights = (visualContract?.boxes || []).map((box) => Number(box.height));
    expect(visualContract?.actionCount === 3 && heights.every((height) => height >= 43) &&
      Math.max(...heights) - Math.min(...heights) <= 1,
    context, 'header actions do not share one 44px control height', visualContract);
    expect(visualContract?.colorScheme === context.theme, context,
      'native selects do not follow the active color scheme', visualContract);
    expect(visualContract?.starfield === true && visualContract?.bodyAnimation === 'none', context,
      'page starfield is missing or uses continuous body animation', visualContract);

    // Header actions share one tooltip layer. Exercise adjacent repository and
    // blog triggers in sequence so hover, focus, content replacement and
    // re-anchoring all use the same viewport-safe geometry contract.
    await exerciseHeaderTooltips(context);

    // The dock may start collapsed or return to gear-only after Escape. Open
    // the shared dock panel whenever a test needs one of its child controls.
    await ensureDockControlsVisible(context);
    await assertInside('#sideDock', context, { actionbarSafe: true });
    await exerciseDockTooltips(context);

    // Font panel: use the public Aa controls and exercise its maximum value.
    await click('#densityBtn');
    await waitVisible('#fontPanel', context);
    await assertInside('#fontPanel', context, { actionbarSafe: true });
    await evaluateFunction(browser, `() => {
      const input = document.getElementById('fontInput');
      input.value = input.max || '24';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return input.value;
    }`);
    const fontValue = await waitFor('Aa maximum value applied', async () => {
      const value = await evaluateFunction(browser, `() => document.getElementById('fontInput')?.value`);
      return Number(value) === 24 ? value : null;
    }, 3_000, 40);
    expect(Number(fontValue) === 24, context, 'Aa maximum value was not applied', { value: fontValue });
    await assertInside('#fontPanel', context, { actionbarSafe: true });
    await click('#fontReset');
    await resetFloatingState();

    // Theme button must be able to enter both explicit modes.  The media
    // preference is set before each page run; here we verify the controls.
    await ensureDockControlsVisible(context);
    await click('#themeBtn');
    const firstTheme = await evaluateFunction(browser, `() => ({ mode: document.documentElement.dataset.theme || 'auto', colorScheme: document.documentElement.style.colorScheme })`);
    await click('#themeBtn');
    const secondTheme = await evaluateFunction(browser, `() => ({ mode: document.documentElement.dataset.theme || 'auto', colorScheme: document.documentElement.style.colorScheme })`);
    expect(firstTheme.mode !== secondTheme.mode || firstTheme.colorScheme !== secondTheme.colorScheme,
      context, 'theme control did not change theme state', { firstTheme, secondTheme });
    await assertInside('#themeBtn', context);
    await resetFloatingState();

    // Help modal and Build Information panel.
    await click('#helpBtn');
    await waitVisible('#modal', context);
    // The shared modal has a short entrance animation; wait for the panel,
    // rather than treating its initial opacity:0 animation frame as a miss.
    await waitVisible('#modal .modal', context);
    await assertInside('#modal .modal', context);
    await click('#modalClose');
    await resetFloatingState();

    await click('#siteVersion');
    await waitFor('Build Information panel open', async () => {
      return await evaluateFunction(browser, `() => document.getElementById('buildInfo')?.classList.contains('is-open')`);
    }, 3_000, 80);
    await waitVisible('#buildInfoCard', context);
    await assertInside('#buildInfoCard', context, { actionbarSafe: true });
    await click('#buildInfoClose');
    await resetFloatingState();

    // Load config entry: replace the hidden file input's click method so no
    // native chooser can be opened by headless Chrome.
    const importClicked = await evaluateFunction(browser, `() => {
      const input = document.getElementById('configImport');
      const original = input.click;
      let called = false;
      input.click = () => { called = true; };
      try { document.getElementById('importBtn').click(); } finally { input.click = original; }
      return called;
    }`);
    expect(importClicked === true, context, 'Load config entry did not invoke file input');

    // The advanced menuconfig entry may be unavailable only if Catalog data
    // failed to load.  That is a real UI failure, so report it with geometry.
    const menuBox = await waitVisible('#menuconfigBox', context, Math.min(20_000, LOAD_TIMEOUT_MS));
    if (menuBox) {
      await click('#menuconfigToggle');
      await waitFor('Advanced menuconfig body open', () => evaluateFunction(browser,
        `() => document.getElementById('menuconfigBody')?.hidden === false`), 3_000, 80);
      const expanded = await evaluateFunction(browser, `() => ({
        bodyHidden: document.getElementById('menuconfigBody')?.hidden,
        expanded: document.getElementById('menuconfigToggle')?.getAttribute('aria-expanded'),
      })`);
      expect(expanded.bodyHidden === false && expanded.expanded === 'true', context,
        'Advanced menuconfig did not expand', expanded);
      await click('#menuconfigToggle');
    }

    // A declared dropdown must be kept within the same viewport by the
    // shared floating-layer controller.  Timezone is deterministic and does
    // not depend on a selected package.
    // The combobox opens from native focus/pointer ordering, so exercise it
    // through CDP mouse input instead of HTMLElement.click(). First settle
    // the combobox's zero-delay blur cleanup so it cannot close a newly opened
    // menu after Chrome restores field focus across a remote navigation.
    await evaluateFunction(browser, `async () => {
      document.getElementById('timezoneBox')?.blur();
      await new Promise((resolve) => setTimeout(resolve, 0));
      return true;
    }`);
    await pointerClick('#timezoneBox');
    try {
      await waitFor('timezone dropdown viewport geometry', async () => {
        const [record, rawViewport] = await Promise.all([
          getElement(browser, '#timezoneMenu'), getViewport(browser),
        ]);
        if (!isVisible(record)) return null;
        const viewport = viewportRect(rawViewport);
        const epsilon = 2;
        return record.rect.left >= viewport.left - epsilon && record.rect.top >= viewport.top - epsilon &&
          record.rect.right <= viewport.right + epsilon && record.rect.bottom <= viewport.bottom + epsilon
          ? record : null;
      }, 5_000, 80);
    } catch (error) {
      fail(context, '#timezoneMenu did not settle inside visualViewport', await evaluateFunction(browser, `() => {
        const input = document.getElementById('timezoneBox');
        const menu = document.getElementById('timezoneMenu');
        return {
          active: document.activeElement === input,
          expanded: input?.getAttribute('aria-expanded'),
          floatingBound: input?.dataset.floatingDropdownBound || '',
          menuHidden: Boolean(menu?.hidden),
          optionCount: menu?.children.length || 0,
          menuClass: menu?.className || '',
        };
      }`).catch(() => ({ error: error.message })));
    }
    await assertInside('#timezoneMenu', context, { actionbarSafe: true });
    await resetFloatingState();

    // On the smallest viewports the controls above are the highest-risk
    // geometry.  Keep the requested dimensions visible in failures.
    const actual = await getViewport(browser);
    const visual = viewportRect(actual);
    // Desktop Chrome reserves scrollbar width in visualViewport while keeping
    // the requested CSS layout viewport width.  Assert the layout dimensions
    // and use the actual visualViewport for every geometry boundary check.
    expect(Math.abs(Number(actual.innerWidth) - viewport.width) <= 2 &&
      Math.abs(Number(actual.innerHeight) - viewport.height) <= 2,
      context, 'CDP layout viewport dimensions differ from requested size', { requested: viewport, actual, visual });

    // Collapse the page content to reproduce a short result page. The shared
    // shell must keep the real footer at the viewport edge without synthetic
    // footer height or a blank document tail.
    await assertShortPageFooter(context);
  }

  try {
    browser = await launchChrome(browserPath, url, VIEWPORTS[0]);
    console.log(`[ui-browser] browser=${browser.browserVersion || '(unknown)'} url=${url}`);
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        const context = { theme, viewport };
        try {
          await browser.connection.command('Emulation.setDeviceMetricsOverride', {
            width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false,
            screenWidth: viewport.width, screenHeight: viewport.height,
          });
          await browser.connection.command('Emulation.setEmulatedMedia', {
            features: [{ name: 'prefers-color-scheme', value: theme }],
          });
          await evaluateFunction(browser, `() => { try { localStorage.clear(); } catch {} return true; }`);
          const navigationToken = `${theme}-${viewport.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const scenarioUrl = new URL(url);
          scenarioUrl.searchParams.set('uiTestScenario', navigationToken);
          await browser.connection.command('Page.navigate', { url: scenarioUrl.href });
          await waitFor('document navigation', async () => evaluateFunction(browser, `(token) => {
            const current = new URL(location.href);
            const ready = document.readyState === 'complete' || document.readyState === 'interactive';
            return ready && current.searchParams.get('uiTestScenario') === token;
          }`, [navigationToken]), 20_000, 100);
          if (await waitState(context)) await runInteractions(context);
          if (failures.length && !screenshotDir.path) {
            const shot = await screenshot(context);
            if (shot) console.error(`[ui-browser] failure screenshot: ${shot}`);
          }
        } catch (error) {
          fail(context, 'scenario crashed', { error: error.message });
          const shot = await screenshot(context);
          if (shot) console.error(`[ui-browser] failure screenshot: ${shot}`);
        }
        console.log(`[ui-browser] checked ${formatContext(context)}`);
      }
    }
  } finally {
    await browser?.close?.();
    preview?.stop?.();
    if (preview?.fixtureRoot) rmSync(preview.fixtureRoot, { recursive: true, force: true });
  }

  if (failures.length) {
    if (screenshotDir.path) console.error(`[ui-browser] screenshots: ${screenshotDir.path}`);
    throw new Error(`${failures.length} browser UI regression(s) failed`);
  }
  console.log(`[ui-browser] all ${THEMES.length * VIEWPORTS.length} viewport/theme scenarios passed`);
}

main().catch((error) => {
  console.error(`[ui-browser] ${error.stack || error.message}`);
  process.exitCode = 1;
});
