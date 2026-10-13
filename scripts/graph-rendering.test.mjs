import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const html = fs.readFileSync(new URL('../Knowladge-Graph/index.html', import.meta.url), 'utf8');
const start = html.indexOf('    const textContext =');
const end = html.indexOf('    const legend =', start);
assert.ok(start >= 0 && end > start, 'generated explorer contains the text cache');
const cacheCode = html.slice(start, end);

function setup() {
  const nativeCalls = [];
  const imageCalls = [];
  const rasters = [];
  let pixelScale = 1.3;
  const state = { motionEnabled: true, selectedNodeId: null, rotationSpeed: 1 };
  const context = {
    font: '8px system-ui', textAlign: 'center', textBaseline: 'middle', direction: 'ltr',
    fillStyle: '#ffffff', strokeStyle: '#0b0f19', lineWidth: 2, lineJoin: 'round', miterLimit: 10,
    globalAlpha: 0.38, globalCompositeOperation: 'source-over', shadowBlur: 0,
    shadowOffsetX: 0, shadowOffsetY: 0,
    getTransform: () => ({ a: pixelScale, b: 0 }),
    measureText: text => ({ actualBoundingBoxLeft: 0, actualBoundingBoxRight: text.length * 8,
      actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
    fillText(...args) { nativeCalls.push(['fill', ...args]); },
    strokeText(...args) { nativeCalls.push(['stroke', ...args]); },
    drawImage(...args) { imageCalls.push(args); }
  };
  const label = { _drawText(ctx, text, x, y) {
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  } };
  const sandbox = vm.createContext({
    uiState: state,
    network: { getScale: () => pixelScale, body: { nodes: { node: { labelModule: label } }, edges: {} },
      canvas: { frame: { canvas: { getContext: () => context } } } },
    document: { createElement(tag) {
      assert.equal(tag, 'canvas');
      const raster = { paints: [], scale() {}, fillText() { this.paints.push('fill'); },
        strokeText() { this.paints.push('stroke'); } };
      rasters.push(raster);
      return { getContext: () => raster };
    } }
  });
  vm.runInContext(cacheCode, sandbox);
  return { context, state, nativeCalls, imageCalls, rasters, label,
    setScale(value) { pixelScale = value; },
    bytes: () => vm.runInContext('glyphCacheBytes', sandbox) };
}

test('moving labels reuse rasters across positions without changing context opacity', () => {
  const run = setup();
  run.context.fillText('GET', 10, 20);
  run.context.fillText('GET', 40, 60);
  assert.equal(run.rasters.length, 1);
  assert.equal(run.imageCalls.length, 2);
  assert.equal(run.nativeCalls.length, 0);
  assert.equal(run.context.globalAlpha, 0.38);
  assert.equal(run.imageCalls[1][1] - run.imageCalls[0][1], 30);
  assert.equal(run.imageCalls[1][2] - run.imageCalls[0][2], 40);
});

test('opaque label outline and fill use one combined cached image', () => {
  const run = setup();
  run.context.globalAlpha = 1;
  run.label._drawText(run.context, 'GET', 10, 20);
  run.label._drawText(run.context, 'GET', 40, 60);
  assert.equal(run.rasters.length, 1);
  assert.deepEqual(run.rasters[0].paints, ['stroke', 'fill']);
  assert.equal(run.imageCalls.length, 2);
  assert.equal(run.nativeCalls.length, 0);
});

test('non-unit opacity preserves separate outline and fill blending', () => {
  const run = setup();
  run.label._drawText(run.context, 'GET', 10, 20);
  assert.equal(run.imageCalls.length, 2);
  assert.equal(run.rasters.length, 2);
  assert.equal(run.context.globalAlpha, 0.38);
});

test('standalone text operations are never suppressed as a label pair', () => {
  const run = setup();
  run.context.globalAlpha = 1;
  run.context.strokeText('GET', 10, 20);
  run.context.fillText('GET', 10, 20);
  assert.equal(run.imageCalls.length, 2);
  assert.equal(run.rasters.length, 2);
});

test('inspection and paused views retain native text drawing', () => {
  for (const change of [{ selectedNodeId: 'model:User' }, { motionEnabled: false }, { rotationSpeed: 0 }]) {
    const run = setup();
    Object.assign(run.state, change);
    run.context.fillText('User', 10, 20);
    assert.deepEqual(run.nativeCalls, [['fill', 'User', 10, 20]]);
    assert.equal(run.rasters.length, 0);
  }
});

test('overview and extreme magnification retain native rendering', () => {
  for (const scale of [0.18, 0.4, 9]) {
    const run = setup();
    run.setScale(scale);
    run.context.strokeText('GET', 10, 20);
    assert.equal(run.nativeCalls.length, 1);
    assert.equal(run.rasters.length, 0);
  }
});

test('text styles invalidate cached rasters', () => {
  const run = setup();
  run.context.fillText('User', 10, 20);
  run.context.fillStyle = '#facc15';
  run.context.fillText('User', 10, 20);
  run.context.font = '12px system-ui';
  run.context.fillText('User', 10, 20);
  assert.equal(run.rasters.length, 3);
  assert.equal(run.rasters[2].font, '12px system-ui');
  assert.equal(run.rasters[2].fillStyle, '#facc15');
});

test('unsupported text operations use the original canvas implementation', () => {
  const run = setup();
  run.context.fillText('User', 10, 20, 50);
  run.context.shadowBlur = 4;
  run.context.strokeText('User', 10, 20);
  assert.deepEqual(run.nativeCalls, [['fill', 'User', 10, 20, 50], ['stroke', 'User', 10, 20]]);
  assert.equal(run.rasters.length, 0);
});

test('cache eviction bounds memory and oversized labels fall back safely', () => {
  const run = setup();
  for (let i = 0; i < 100; i++) run.context.fillText('x'.repeat(120) + i, 10, 20);
  assert.ok(run.bytes() > 0);
  assert.ok(run.bytes() <= 64 * 1024 * 1024);
  run.context.fillText('x'.repeat(100000), 10, 20);
  assert.equal(run.nativeCalls.length, 1);
});
