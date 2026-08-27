#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const project = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'project.json'), 'utf8'));
const controller = readFileSync(join(ROOT, 'site', 'wrt', 'lib', 'core', 'application-controller.js'), 'utf8');
const parser = readFileSync(join(ROOT, 'tools', 'parse-request.mjs'), 'utf8');
const workflow = readFileSync(join(ROOT, '.github', 'workflows', 'custom-build.yml'), 'utf8');

assert.ok(project.customization, 'generated site project must expose customization');
assert.match(controller, /PROJECT\.blogUrl/);
assert.match(controller, /removeAttribute\('href'\)/,
  'an empty project blog URL must not leave the built-in blog destination active');
assert.match(controller, /https:[^)]*\.test\(blogUrl\)/,
  'project blog links must accept HTTPS only');
assert.match(controller, /const previousExplicit = packageMirrorSelectionExplicit;\s+packageMirrorSelectionExplicit = true;/,
  'the project package mirror must be treated as a temporary explicit initial preference');
assert.match(controller, /finally \{\s+packageMirrorSelectionExplicit = previousExplicit;/,
  'the project package mirror must not become a permanent user choice');
assert.match(parser, /PROJECT_FIRMWARE/);
assert.match(parser, /own\(req, 'lanip'\)/,
  'omitted LAN IP must use the project default while explicit input remains distinct');
assert.match(parser, /project build job policy must be auto or an integer/,
  'invalid generated job policy must fail closed');
assert.match(parser, /Number\.isInteger\(value\)/,
  'generated job policy must reject numeric strings');
assert.match(parser, /固件主题不在当前 Catalog\/Kconfig 范围/,
  'explicit unavailable themes must fail closed');
assert.match(workflow, /DEFAULT_ROOT_PASSWORD: \$\{\{ secrets\.DEFAULT_ROOT_PASSWORD \}\}/);
assert.match(workflow, /::add-mask::\$RPW/);
assert.match(workflow, /printf '%s' "\$RPW" \| openssl passwd -6 -stdin/,
  'passwords must be hashed from stdin on the runner');
assert.match(workflow, /ROOT_HASH/);
assert.match(workflow, /sed -i 's\|\^root:\[\^:\]\*:\|root:\$\{ROOT_HASH\}:\|'/,
  'the generated init script must only contain a hash');
assert.doesNotMatch(workflow, /printf[^\n]*\$RPW[^\n]*passwd root/,
  'the generated init script must not format the plaintext password');
assert.match(workflow, /steps\.req\.outputs\.compile_jobs/);
assert.match(workflow, /steps\.req\.outputs\.download_jobs/);

console.log('Project customization runtime contracts passed.');
