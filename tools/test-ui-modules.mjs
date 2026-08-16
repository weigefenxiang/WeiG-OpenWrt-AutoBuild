#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createUiSessionState } from '../site/wrt/lib/ui-session-state.js';

const session = createUiSessionState();
assert.equal(session.compatibility.getAcknowledgement(), null);
assert.equal('getRememberDefault' in session.compatibility, false);
assert.equal('setRememberDefault' in session.compatibility, false);
const acknowledgement = { signature: 'test', audit: { forced: ['RULE'] } };
session.compatibility.setAcknowledgement(acknowledgement);
assert.equal(session.compatibility.getAcknowledgement(), acknowledgement);
session.compatibility.clearAcknowledgement();
assert.equal(session.compatibility.getAcknowledgement(), null);

const app = readFileSync(new URL('../site/wrt/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../site/wrt/index.html', import.meta.url), 'utf8');
const components = readFileSync(new URL('../site/wrt/lib/ui-components.js', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../site/wrt/lib/page-shell-ui.js', import.meta.url), 'utf8');
assert.match(html, /lib\/ui-session-state\.js/);
assert.match(html, /lib\/ui-components\.js/);
assert.match(html, /lib\/page-shell-ui\.js/);
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
assert.doesNotMatch(app, /const FONT_DEF = 17, FONT_MIN = 14, FONT_MAX = 24/);
assert.match(shell, /const FONT_DEF = 17, FONT_MIN = 14, FONT_MAX = 24/);
assert.match(components, /export function createUiActionRow/);
assert.match(components, /export function createUiButton/);
assert.match(components, /export function createUiCheckboxControl/);
assert.match(app, /payload\.customTarget = schema6TargetIdentity\(\);/);
console.log('shared UI module contracts passed');
