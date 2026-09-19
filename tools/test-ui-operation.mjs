import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../site/wrt/lib/ui/ui-runtime.js', import.meta.url), 'utf8');
const begin = source.indexOf('let activeUiOperation'), end = source.indexOf('/*', begin);
class Element {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.inert = false; this.isConnected = true; this.attributes = {}; this.classList = { toggle() {} }; }
  append(...children) { this.children.push(...children); }
  setAttribute(key, value) { this.attributes[key] = value; }
  querySelector(selector) { for (const child of this.children) { if (child.className === selector.slice(1)) return child; const found = child.querySelector(selector); if (found) return found; } return null; }
  closest() { return null; }
  focus() { this.focused = true; }
}
const app = new Element(), modal = new Element(), body = new Element(), focus = new Element();
app.id = 'app'; modal.id = 'modal'; body.append(app, modal);
const events = new Map();
const context = vm.createContext({ document: { body, activeElement: focus, createElement: (tag) => new Element(tag), addEventListener: (type, listener) => events.set(type, listener) },
  $: (id) => id === 'app' ? app : id === 'modal' ? modal : null,
  t: (key) => key, setTimeout, clearTimeout, requestAnimationFrame: (fn) => setTimeout(fn, 0),
  MutationObserver: class { observe() {} } });
vm.runInContext(source.slice(begin, end), context);
const run = (text) => vm.runInContext(text, context);
await run(`withUiOperation('Import', async (operation) => {
  globalThis.locked = $('app').inert && $('modal').inert;
  let rejected = false;
  try { createUiOperation('Duplicate'); } catch { rejected = true; }
  globalThis.duplicateRejected = rejected;
  await withUiOperationInteraction(async () => {
    globalThis.dialogAccessible = !$('modal').inert && $('app').inert;
    await withUiComputation('Recommendation', () => { globalThis.nestedLocked = $('modal').inert; });
    globalThis.dialogRestored = !$('modal').inert && $('app').inert;
  });
  await operation.checkpoint('Done');
})`);
for (const key of ['locked', 'duplicateRejected', 'dialogAccessible', 'nestedLocked', 'dialogRestored']) assert.equal(context[key], true, key);
assert.equal(app.inert, false); assert.equal(modal.inert, false); assert.equal(focus.focused, true);
assert.equal(run('activeUiOperation'), null);
await assert.rejects(run(`withUiOperation('Failure', () => { throw new Error('fixture'); })`), /fixture/);
assert.equal(app.inert, false); assert.equal(run('activeUiOperation'), null);
run(`globalThis.operation = createUiOperation('Blocked');`);
let prevented = 0;
const event = { key: 'PageDown', target: focus, preventDefault() { prevented++; }, stopImmediatePropagation() {} };
events.get('keydown')(event); assert.equal(prevented, 0, 'page scrolling keys remain available');
event.key = 'Enter'; events.get('keydown')(event); assert.equal(prevented, 1);
events.get('click')(event); assert.equal(prevented, 2, 'synthetic clicks cannot bypass inert');
run('operation.close()');
events.get('click')(event); assert.equal(prevented, 2);
console.log('Shared UI operation ownership, nested dialogs, scroll keys, click guard and failure cleanup passed');
