#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createUiSessionState } from '../site/wrt/lib/ui-session-state.js';
import { createUiKconfigStateControl, updateUiKconfigStateControl, createUiConfigurationReview, fitUiContentColumns }
  from '../site/wrt/lib/ui-components.js';
import { readFrontendRuntimeSource } from './lib/frontend-source.mjs';

const session = createUiSessionState();
assert.deepEqual(fitUiContentColumns([150, 150, 150, 150], 1230, 4, 10), [300, 300, 300, 300]);
const fitted = fitUiContentColumns([340, 150, 160, 180], 1230, 4, 10);
assert.equal(fitted.length, 4); assert.equal(fitted[0], 340);
assert(Math.abs(fitted.reduce((sum, value) => sum + value, 0) - 1200) < 0.001);
assert(fitted.every((value, index) => value >= [340, 150, 160, 180][index]));
assert.equal(fitUiContentColumns([340, 350, 350, 350], 900, 4, 10).length, 2);
assert.deepEqual(fitUiContentColumns([800, 150, 160, 180], 300, 4, 10), [300]);
assert.equal(session.compatibility.getAcknowledgement(), null);
assert.equal('getRememberDefault' in session.compatibility, false);
assert.equal('setRememberDefault' in session.compatibility, false);
const acknowledgement = { signature: 'test', audit: { forced: ['RULE'] } };
session.compatibility.setAcknowledgement(acknowledgement);
assert.equal(session.compatibility.getAcknowledgement(), acknowledgement);
session.compatibility.clearAcknowledgement();
assert.equal(session.compatibility.getAcknowledgement(), null);

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFrontendRuntimeSource(appRoot);
const orchestrator = readFileSync(new URL('../site/wrt/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../site/wrt/index.html', import.meta.url), 'utf8');
const components = readFileSync(new URL('../site/wrt/lib/ui-components.js', import.meta.url), 'utf8');
const reviewSource = app.match(/function configurationReviewChanges\(before, after, manualSymbols = new Set\(\)\) \{[\s\S]*?\n\}/)?.[0];
assert(reviewSource);
const reviewChanges = Function('CATALOG_MODEL', reviewSource + '; return configurationReviewChanges;')({
  bySymbol: new Map([['SIZE', { type: 'int' }], ['APP', { type: 'bool' }]]) });
assert.deepEqual(reviewChanges(new Map([['SIZE', '512'], ['APP', 'y']]), new Map(), new Set(['APP'])), [
  { symbol: 'SIZE', from: '512', to: null, automatic: true },
  { symbol: 'APP', from: 'y', to: 'n', automatic: false },
]);
const shell = readFileSync(new URL('../site/wrt/lib/page-shell-ui.js', import.meta.url), 'utf8');
assert.match(html, /lib\/ui-session-state\.js/);
assert.match(html, /lib\/ui-components\.js/);
assert.match(html, /lib\/page-shell-ui\.js/);
assert.match(orchestrator, /lib\/core\/runtime\.js/);
assert.match(orchestrator, /lib\/diagnostics\/self-test\.js/);
assert.match(app, /UI_SESSION\.compatibility\.getAcknowledgement/);
assert.match(app, /UI_COMPONENTS\.createUiCheckboxControl/);
assert.match(app, /PAGE_SHELL_UI\.installPageShellUi/);
assert.match(app, /let PAGE_SHELL_CONTROLLER = null/);
assert.match(app, /PAGE_SHELL_CONTROLLER = PAGE_SHELL_UI\.installPageShellUi/);
assert.match(app, /PAGE_SHELL_CONTROLLER\?\.refreshThemeControl\(\)/);
assert.doesNotMatch(app, /\bapplyThemeIcon\s*\(/);
assert.match(shell, /return Object\.freeze\(\{ refreshThemeControl: applyThemeIcon \}\)/);
assert.doesNotMatch(app, /let compatibilityRememberDefault/);
assert.doesNotMatch(app, /let compatibilityPrefetchTimer = null, compatibilityAcknowledgement/);
assert.doesNotMatch(app, /const FONT_DEF = (?:17|18), FONT_MIN = 14, FONT_MAX = 24/);
assert.match(shell, /const FONT_DEF = 15, FONT_MIN = 14, FONT_MAX = 24/);
assert.match(shell, /wrt_font_default_v2/);
assert.match(html, /data-floating-preset="wide-filter"/);
assert.doesNotMatch(shell, /style\.zoom/);
assert.match(components, /export function createUiActionRow/);
assert.match(components, /export function createUiButton/);
assert.match(components, /export function createUiCheckboxControl/);
assert.match(app, /payload\.customTarget = schema6TargetIdentity\(\);/);
const buildController = readFileSync(new URL('../site/wrt/lib/build/build-controller.js', import.meta.url), 'utf8');
const rootfsSummary = buildController.match(/  const rootfs = rootfsPartitionInfo\(\);\n[\s\S]*?(?=  mb\.appendChild\(sum\);)/)?.[0];
assert.ok(rootfsSummary, 'submit confirmation must consume the effective RootFS helper');
for (const value of [160, 512, 1024, null]) {
  const nodes = [];
  Function('rootfsPartitionInfo', 'document', 't', 'sum', rootfsSummary)(
    () => value === null ? null : { value },
    { createElement: () => ({ dataset: {} }) },
    (key, parameters) => `${key}:${parameters.size}`,
    { appendChild: node => nodes.push(node) },
  );
  assert.equal(nodes.length, value === null ? 0 : 1, 'unavailable RootFS must not produce a guessed size');
  if (value !== null) {
    assert.equal(nodes[0].dataset.rootfsSize, String(value));
    assert.equal(nodes[0].textContent, `submit.rootfs:${value}`);
  }
}
// The same presentation primitive is used by Advanced, preflight and warnings.
// Constraints are inputs, never reinterpreted by another dependency evaluator.
class ControlNode {
  constructor(tag) {
    this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.classes = new Set();
    this.classList = { add: (name) => this.classes.add(name), contains: (name) => this.classes.has(name),
      toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name) };
  }
  set className(value) { this.classes = new Set(value.split(/\s+/)); }
  set textContent(value) { this.text = value; this.children = []; }
  setAttribute(key, value) { this.attributes[key] = value; }
  getAttribute(key) { return this.attributes[key]; }
  appendChild(child) { this.children.push(child); }
  append(...children) { this.children.push(...children); }
  querySelectorAll() { return this.children.filter(child => child.tag === 'button' && child.dataset.value); }
}
globalThis.document = { createElement: tag => new ControlNode(tag) };
try {
  const limits = { states: [{ value: 'n', selectable: false }, { value: 'm', selectable: false },
    { value: 'y', selectable: false, locked: true }] };
  const changes = [], blocked = [];
  const control = createUiKconfigStateControl({ type: 'tristate', value: 'y', constraints: limits,
    bindTooltip: (button, value) => { button.dataset.uiTooltipBody = value; },
    onChange: value => changes.push(value), onUnavailable: button => blocked.push(button.dataset.value) });
  const [n, , y] = control.querySelectorAll();
  assert.equal(y.getAttribute('aria-pressed'), 'true'); assert(y.classList.contains('is-current'));
  assert(y.classList.contains('is-locked')); assert.equal(y.children.length, 1);
  n.onclick({ preventDefault() {} }); assert.deepEqual(changes, []); assert.deepEqual(blocked, ['n']);
  updateUiKconfigStateControl(control, { value: 'n', constraints: { states: ['n','m','y'].map(value => ({ value, selectable: true })) } });
  assert(n.classList.contains('is-editable')); assert.equal(n.getAttribute('aria-pressed'), 'true');
  assert(!y.classList.contains('is-locked')); assert.equal(y.children.length, 0);
  y.onclick({ preventDefault() {} }); assert.deepEqual(changes, ['y']);
  const bool = createUiKconfigStateControl({ type: 'bool', value: 'n', constraints: limits });
  assert.equal(bool.querySelectorAll().length, 2); assert.equal(bool.children[1].attributes['aria-hidden'], 'true');
  const review = createUiConfigurationReview({ title: 'Before → after', changes: [{ symbol: 'APP', from: 'y', to: 'n' }],
    formatSymbol: value => value, formatValue: value => value.toUpperCase(), formatKind: () => 'Explicit' });
  assert.equal(review.children[1].children[1].text, 'Y → N');
  const folded = createUiConfigurationReview({ title: 'Review', automaticTitle: 'Automatic',
    changes: [{ symbol: 'APP', from: 'y', to: 'n' }, { symbol: 'SHARED', from: 'y', to: 'n', automatic: true }],
    formatSymbol: value => value, formatValue: value => value.toUpperCase(), formatKind: () => 'Change' });
  assert.equal(folded.children[2].tag, 'details'); assert(!folded.children[2].open);
  assert.equal(folded.children[2].children[0].text, 'Automatic · 1');
} finally { delete globalThis.document; }
console.log('shared UI module contracts and N/M/Y presentation behavior passed');
