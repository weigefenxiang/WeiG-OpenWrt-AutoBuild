#!/usr/bin/env node
// 使用与网页相同的 Catalog 引擎检查提交配置；官方 make defconfig 成功后不再执行项目自定义后置验证。
// Validates the submitted config with the browser engine; a successful upstream make defconfig is not post-validated.

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
if (!args.catalog || !args.config) {
  console.error('Usage: validate-catalog-config.mjs --catalog <catalog.json> --config <submitted.config>');
  process.exit(2);
}
if (args.phase && args.phase !== 'pre-defconfig') {
  console.error('Catalog post-defconfig validation has been removed; validate only the submitted config.');
  process.exit(2);
}

try {
  const catalog = JSON.parse(readFileSync(args.catalog, 'utf8'));
  const config = readFileSync(args.config, 'utf8');
  const model = createCatalogModel(catalog);
  const parsed = parseConfigDocument(config);
  const target = resolveCatalogTargetContext(model, parsed);
  const context = createCatalogValidationContext(model, target, parsed, {
    phase: 'pre-defconfig',
    deferred: 'ignore',
  });
  const violations = validateConfig(model, context.values, context.validationOptions);
  if (violations.length) {
    console.error(`Submitted Catalog configuration is invalid: ${formatViolations(violations)}`);
    process.exit(1);
  }
  console.log(`Submitted Catalog configuration valid: ${args.config}`);
} catch (error) {
  console.error(`Catalog validation error: ${error.message}`);
  process.exit(1);
}
