#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'site', 'wrt', 'lib', 'ui', 'ui-runtime.js'), 'utf8');
const start = source.indexOf('const viewportNumber');
const end = source.indexOf('/* ============ 轻提示 / Toast ============ */');
assert.ok(start >= 0 && end > start, 'viewport geometry block must remain self-contained');

const context = { console };
context.globalThis = context;
vm.runInNewContext(source.slice(start, end), context, { filename: 'ui-runtime-viewport-geometry.js' });
const geometry = context.__WEIG_VIEWPORT_GEOMETRY__;
assert.ok(geometry?.readViewportRect && geometry?.calculateFloatingGeometry,
  'shared viewport geometry contract must be exposed');

assert.deepEqual({ ...geometry.readViewportRect({
  visualViewport: { width: 300, height: 400, offsetLeft: 20, offsetTop: 30 },
  document: { documentElement: { clientWidth: 900, clientHeight: 700 } },
}) }, { left: 20, top: 30, right: 320, bottom: 430, width: 300, height: 400 },
  'visualViewport dimensions and offsets must be authoritative');

assert.deepEqual({ ...geometry.readViewportRect({
  document: { documentElement: { clientWidth: 640, clientHeight: 480 } },
  innerWidth: 800,
  innerHeight: 600,
}) }, { left: 0, top: 0, right: 640, bottom: 480, width: 640, height: 480 },
  'documentElement must be the deterministic fallback');

const viewport = { left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600 };
const above = geometry.calculateFloatingGeometry({
  anchorRect: { left: 400, top: 500, right: 500, bottom: 540, width: 100, height: 40 },
  layerRect: { width: 240, height: 200 }, viewportRect: viewport,
  placements: ['below', 'above'], margin: 8, gap: 8,
});
assert.equal(above.placement, 'above', 'layer must flip above when below space is insufficient');
assert.ok(above.top >= viewport.top && above.top + above.height <= viewport.bottom,
  'flipped layer must stay inside the viewport');

const rightClamped = geometry.calculateFloatingGeometry({
  anchorRect: { left: 930, top: 180, right: 990, bottom: 220, width: 60, height: 40 },
  layerRect: { width: 300, height: 120 }, viewportRect: viewport,
  placements: ['below', 'above'], margin: 8, gap: 8,
});
assert.equal(rightClamped.left + rightClamped.width, 992, 'horizontal placement must clamp to the viewport edge');

const short = geometry.calculateFloatingGeometry({
  anchorRect: { left: 20, top: 52, right: 120, bottom: 72, width: 100, height: 20 },
  layerRect: { width: 250, height: 400 },
  viewportRect: { left: 0, top: 0, right: 320, bottom: 90, width: 320, height: 90 },
  placements: ['below', 'above'], margin: 8, gap: 8,
});
assert.ok(short.maxHeight >= 1 && short.height >= 1, 'short viewports must retain a non-zero visible layer');
assert.ok(short.top >= 8 && short.top + short.height <= 82, 'short layer must be clamped vertically');

const actionbar = geometry.calculateFloatingGeometry({
  anchorRect: { left: 440, top: 580, right: 560, bottom: 620, width: 120, height: 40 },
  layerRect: { width: 260, height: 180 }, viewportRect: {
    left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800,
  },
  avoidRects: [{ left: 0, top: 700, right: 1000, bottom: 800, width: 1000, height: 100 }],
  placements: ['below', 'above'], margin: 8, gap: 8,
});
assert.equal(actionbar.placement, 'above', 'actionbar must remove obstructed below space');
assert.ok(actionbar.top + actionbar.height <= 692, 'layer must stay above the actionbar clearance');

const anchorInsideActionbar = geometry.calculateFloatingGeometry({
  anchorRect: { left: 180, top: 255, right: 220, bottom: 275, width: 40, height: 20 },
  layerRect: { width: 160, height: 60 }, viewportRect: {
    left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300,
  },
  avoidRects: [{ left: 0, top: 240, right: 400, bottom: 300, width: 400, height: 60 }],
  placements: ['below', 'above'], margin: 8, gap: 8,
});
assert.equal(anchorInsideActionbar.placement, 'above',
  'an anchor inside an obstruction must prefer the safe side');
assert.ok(anchorInsideActionbar.top + anchorInsideActionbar.height <= 232,
  'an anchor inside an actionbar must keep the layer outside its safe boundary');

const anchorInsideHeader = geometry.calculateFloatingGeometry({
  anchorRect: { left: 180, top: 25, right: 220, bottom: 45, width: 40, height: 20 },
  layerRect: { width: 160, height: 60 }, viewportRect: {
    left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300,
  },
  avoidRects: [{ left: 0, top: 0, right: 400, bottom: 60, width: 400, height: 60 }],
  placements: ['below', 'above'], margin: 8, gap: 8,
});
assert.equal(anchorInsideHeader.placement, 'below',
  'an anchor inside a top obstruction must prefer the safe region below it');
assert.ok(anchorInsideHeader.top >= 68,
  'an anchor inside a top obstruction must keep the layer below its safe boundary');

const centeredContainingObstruction = geometry.calculateFloatingGeometry({
  anchorRect: { left: 180, top: 180, right: 220, bottom: 200, width: 40, height: 20 },
  layerRect: { width: 160, height: 60 }, viewportRect: {
    left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400,
  },
  avoidRects: [{ left: 0, top: 180, right: 400, bottom: 260, width: 400, height: 80 }],
  placements: ['below', 'above'], margin: 8, gap: 8,
});
assert.equal(centeredContainingObstruction.placement, 'above',
  'a containing obstruction must choose the larger outside safe region');
assert.ok(centeredContainingObstruction.top + centeredContainingObstruction.height <= 172,
  'a containing obstruction must leave the layer on its selected safe side');

const owner = geometry.calculateFloatingGeometry({
  anchorRect: { left: 260, top: 140, right: 300, bottom: 180, width: 40, height: 40 },
  layerRect: { width: 300, height: 120 }, viewportRect: viewport,
  boundaryRect: { left: 200, top: 80, right: 600, bottom: 400, width: 400, height: 320 },
  placements: ['below', 'above'], margin: 8, gap: 8,
});
assert.ok(owner.left >= 208 && owner.left + owner.width <= 592,
  'owner boundary must constrain horizontal geometry');
assert.ok(owner.top >= 88 && owner.top + owner.height <= 392,
  'owner boundary must constrain vertical geometry');

console.log('viewport geometry contracts passed');
