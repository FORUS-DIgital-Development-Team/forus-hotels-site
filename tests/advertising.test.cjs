const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('advertising.js', 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture({ enabled = 'true', origin = 'https://hotels.coop', path = '/', placement = 'placement_test' } = {}) {
  let dialog = false, mounts = 0, destroys = 0, options;
  const scripts = [], listeners = {};
  const target = { dataset: { enabled, placementId: placement }, replaceChildren() {} };
  const document = { visibilityState: 'visible', querySelector: selector => selector === '#forus-advertising' ? target : dialog ? {} : null,
    createElement: () => ({ remove() {} }), head: { append(script) { scripts.push(script); } },
    addEventListener(name, fn) { listeners[name] = fn; } };
  const window = { addEventListener(name, fn) { listeners[name] = fn; } };
  vm.runInNewContext(source, { window, document, location: { origin, pathname: path }, Promise });
  function loaded() { window.ForusAds = { mount(_, config) { mounts++; options = config; return { destroy() { destroys++; } }; } }; scripts[0].onload(); }
  return { scripts, listeners, document, loaded, state: () => ({ mounts, destroys, options }), dialog(value) { dialog = value; } };
}
test('committed integration is off; wrong origins, routes and incomplete config never load the SDK', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /id="forus-advertising"[^>]*data-enabled="false"[^>]*data-placement-id=""/);
  for (const config of [{enabled:'false'}, {origin:'https://hotels.forus.digital'}, {origin:'https://other.coop'}, {path:'/checkout'}, {placement:''}]) {
    assert.equal(fixture(config).scripts.length, 0);
  }
});
test('configured slot keeps neutral/denied context and excludes dialogs and hidden pages', async () => {
  const f = fixture(); f.loaded(); await flush();
  assert.equal(f.state().mounts, 1);
  const o = f.state().options;
  assert.equal(o.baseUrl, 'https://staging-advertising.forus.digital');
  assert.equal(o.context.sport, 'none'); assert.equal(o.consent.storage, 'denied'); assert.equal(o.consent.personalisation, 'denied');
  assert.equal(o.isVisible(), true);
  f.dialog(true); assert.equal(o.isVisible(), false);
  f.dialog(false); f.document.visibilityState = 'hidden'; assert.equal(o.isVisible(), false);
  f.listeners.pagehide(); assert.equal(f.state().destroys, 1);
  f.document.visibilityState = 'visible'; f.listeners.pageshow(); await flush(); assert.equal(f.state().mounts, 2);
});
test('a late SDK load cannot mount on a page that has been left', async () => {
  const f = fixture(); f.listeners.pagehide(); f.loaded(); await flush();
  assert.equal(f.state().mounts, 0);
  f.listeners.pageshow(); await flush(); assert.equal(f.state().mounts, 1);
});
test('SDK failure leaves the optional slot empty without retrying on every focus', async () => {
  const f = fixture(); f.scripts[0].onerror(); await flush();
  f.listeners.visibilitychange(); await flush(); assert.equal(f.scripts.length, 1); assert.equal(f.state().mounts, 0);
});
