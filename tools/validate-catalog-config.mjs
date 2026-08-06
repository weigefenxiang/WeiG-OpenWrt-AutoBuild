#!/usr/bin/env node
// 使用与网页相同的 Catalog 引擎验证 .config。pre-defconfig 信任 Catalog Target/Profile 契约；post-defconfig 要求全部依赖可判定且满足。
// Validates .config with the browser engine. pre-defconfig trusts the Catalog target contract; post-defconfig is fully strict.

import { readFileSync } from 'node:fs';
import {
  createCatalogModel,
  createCatalogValidationContext,
  formatViolations,
  parseConfigDocument,
  resolveCatalogTargetContext,
  validateConfig,
} from '../site/wrt/lib/catalog-engine.js';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i];
  if (!key.startsWith('--')) continue;
  args[key.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[++i] : '1';
}
const phase = String(args.phase || 'post-defconfig');
if (!args.catalog || !args.config || !['pre-defconfig', 'post-defconfig'].includes(phase)) {
  console.error('Usage: validate-catalog-config.mjs --catalog <catalog.json> --config <.config> --phase <pre-defconfig|post-defconfig>');
  process.exit(2);
}

try {
  const catalog = JSON.parse(readFileSync(args.catalog, 'utf8'));
  const config = readFileSync(args.config, 'utf8');
  const model = createCatalogModel(catalog);
  const parsed = parseConfigDocument(config);
  const target = resolveCatalogTargetContext(model, parsed);
  const context = createCatalogValidationContext(model, target, parsed, {
    phase,
    trustTargetContract: phase === 'pre-defconfig',
    deferred: phase === 'post-defconfig' ? 'error' : 'ignore',
  });
  const violations = validateConfig(model, context.values, context.validationOptions);
  if (violations.length) {
    console.error(`Catalog configuration validation failed (${phase}): ${formatViolations(violations)}`);
    process.exit(1);
  }
  console.log(`Catalog configuration valid (${phase}): ${args.config}`);
} catch (error) {
  console.error(`Catalog validation error: ${error.message}`);
  process.exit(1);
}
