#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const config = resolve(args.config || 'openwrt/.config');
const bin = resolve(args.bin || 'openwrt/bin');
const out = resolve(args.out || 'optional-packages');
if (!existsSync(config)) throw new Error(`config not found: ${config}`);

const modules = [...readFileSync(config, 'utf8').matchAll(/^CONFIG_PACKAGE_([A-Za-z0-9._+-]+)=m$/gm)]
  .map((match) => match[1]).sort();
const files = [];
const walk = (dir) => {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(?:ipk|apk)$/i.test(name)) files.push(path);
  }
};
walk(bin);
mkdirSync(out, { recursive: true });
const copied = [];
for (const name of modules) {
  const hits = files.filter((path) => {
    const file = basename(path);
    return file.startsWith(`${name}_`) || file.startsWith(`${name}-`);
  });
  for (const path of hits) {
    const file = basename(path);
    if (!copied.some((item) => item.file === file)) {
      copyFileSync(path, join(out, file));
      copied.push({ package: name, file });
    }
  }
}
const missing = modules.filter((name) => !copied.some((item) => item.package === name));
writeFileSync(join(out, 'manifest.json'), JSON.stringify({ schema: 1, modules, copied, missing }, null, 2) + '\n');
writeFileSync(join(out, 'README.txt'),
  'OPTIONAL PACKAGES\n\n' +
  'Packages selected as M were built but not embedded in the firmware.\n' +
  'Verify that the package architecture, kernel, and dependencies exactly match this firmware before installing.\n\n' +
  '中文翻译 / Chinese translation:\n' +
  '这些包在 menuconfig 中选择为 M：已编译，但未写入固件。\n' +
  '安装前请确认包与本次固件的架构、内核和依赖完全一致。\n');
console.log(`optional packages: ${copied.length} files for ${modules.length} CONFIG_PACKAGE_*=m symbols; missing=${missing.length}`);
