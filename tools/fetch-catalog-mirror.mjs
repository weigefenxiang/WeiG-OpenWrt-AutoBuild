import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
const outputRoot = args.get('--out');
if (!outputRoot) throw new Error('Usage: node tools/fetch-catalog-mirror.mjs --out <directory>');

const branch = String(args.get('--branch') || 'catalog-data').trim();
if (!/^[A-Za-z0-9._/-]+$/.test(branch) || branch.split('/').some((part) => !part || part === '.' || part === '..')) {
  throw new Error(`Invalid branch: ${branch}`);
}
const project = JSON.parse(await readFile(new URL('../site/wrt/data/project.json', import.meta.url), 'utf8'));
const repository = String(args.get('--repo') || project.catalogRepository || '').trim();
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
  throw new Error(`Invalid Catalog repository: ${repository}`);
}
const base = `https://raw.githubusercontent.com/${repository}/${branch}`;
const catalogDir = resolve(outputRoot, 'catalog-data');
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

async function download(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((done) => setTimeout(done, attempt * 1_000));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Download failed after ${attempts} attempts: ${url}: ${lastError?.message || lastError}`);
}

await rm(catalogDir, { recursive: true, force: true });
await mkdir(catalogDir, { recursive: true });

try {
  const indexBytes = await download(`${base}/index.json`);
  const index = JSON.parse(indexBytes.toString('utf8'));
  const rows = (index.sources || []).flatMap((source) => source.branches || [])
    .filter((row) => row && row.asset && row.state !== 'unavailable');
  if (!rows.length) throw new Error('Catalog index has no downloadable branch assets');

  for (const row of rows) {
    const asset = String(row.asset);
    if (basename(asset) !== asset || !/^[A-Za-z0-9._-]+\.json\.gz$/.test(asset)) {
      throw new Error(`Unsafe Catalog asset name: ${asset}`);
    }
    const expectedBytes = Number(row.bytes ?? row.compressedBytes);
    const expectedHash = String(row.hash || row.compressedSha256 || '').toLowerCase();
    const expectedJsonHash = String(row.sha256 || '').toLowerCase();
    if (!Number.isSafeInteger(expectedBytes) || expectedBytes <= 0 || !/^[a-f0-9]{64}$/.test(expectedHash)) {
      throw new Error(`Catalog asset is missing bytes/hash contract: ${asset}`);
    }

    const compressed = await download(`${base}/${asset}`);
    if (compressed.byteLength !== expectedBytes) {
      throw new Error(`Catalog byte length mismatch: ${asset}: ${compressed.byteLength} != ${expectedBytes}`);
    }
    const compressedHash = sha256(compressed);
    if (compressedHash !== expectedHash) {
      throw new Error(`Catalog compressed SHA-256 mismatch: ${asset}`);
    }
    if (expectedJsonHash) {
      const jsonHash = sha256(gunzipSync(compressed));
      if (jsonHash !== expectedJsonHash) throw new Error(`Catalog JSON SHA-256 mismatch: ${asset}`);
    }
    await writeFile(join(catalogDir, asset), compressed);
    process.stdout.write(`[catalog-mirror] ${asset} ${compressed.byteLength} bytes OK\n`);
  }

  await writeFile(join(catalogDir, 'index.json'), indexBytes);
  await writeFile(join(catalogDir, 'mirror-manifest.json'), `${JSON.stringify({
    schema: 1,
    mirroredAt: new Date().toISOString(),
    source: `${base}/index.json`,
    indexSha256: sha256(indexBytes),
    assets: rows.length,
  }, null, 2)}\n`);
  process.stdout.write(`[catalog-mirror] complete: ${rows.length} assets\n`);
} catch (error) {
  await rm(catalogDir, { recursive: true, force: true });
  throw error;
}
