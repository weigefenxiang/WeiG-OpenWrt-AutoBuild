import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function frontendRuntimeFiles(root) {
  const appPath = join(root, 'site', 'wrt', 'app.js');
  const app = readFileSync(appPath, 'utf8');
  const modules = [...app.matchAll(/^\s*'([^']+\.js)',\s*$/gm)].map((match) => match[1]);
  if (!modules.length || modules.some((path) => path.includes('..') || path.startsWith('/'))) {
    throw new Error('app.js does not declare a valid frontend module sequence');
  }
  return [appPath, ...modules.map((path) => join(root, 'site', 'wrt', ...path.split('/')))];
}

export function readFrontendRuntimeSource(root) {
  return frontendRuntimeFiles(root).map((path) => readFileSync(path, 'utf8')).join('\n');
}
