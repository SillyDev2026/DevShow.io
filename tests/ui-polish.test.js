import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { when } from '../src/components.js';

const read = path => readFileSync(path,'utf8');
const html = read('index.html');
const css = read('styles-ui.css');
const base = read('styles.css');
const main = read('src/main.js');
const view = read('src/views.js');
const server = read('server/index.js');
const desktop = read('tools/build-desktop.mjs');

test('UI override loads after base, fluid and editor CSS in document',()=>{
  const sequence=['styles.css','styles-fluid.css','styles-v30.css','styles-ui.css'];
  let last = -1;
  for(const file of sequence){
    const at=html.indexOf('href="./'+file+'"');
    assert.ok(at > last, file+' must follow prior stylesheets');
    last=at;
  }
  assert.match(server, /'\/styles-ui\.css':'styles-ui\.css'/);
  assert.match(desktop, /'styles-ui\.css'/);
});
test('phone, narrow foldable, tablet and large desktop layout are all constrained',()=>{
  assert.match(css, /--ui-gutter:clamp\(/);
  assert.match(css, /grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,18rem\),1fr\)\)/);
  assert.match(css, /@media\(max-width:23rem\)/);
  assert.match(css, /@media\(max-width:40\.625rem\)/);
  assert.match(css, /@media\(max-width:48rem\)/);
  assert.match(css, /@media\(min-width:40\.626rem\) and \(max-width:56\.25rem\)/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /width:min\(100%,45rem\)/);
});
test('Luau editor retains synchronized line and scroll geometry',()=>{
  assert.match(css, /\.v30-gutter,\.v30-input,\.v30-highlight\{line-height:1\.55;letter-spacing:0;tab-size:4;/);
  assert.match(css, /grid-template-columns:clamp\(2\.6rem,5%,3\.4rem\) minmax\(0,1fr\)/);
  assert.match(css, /\.v30-input,\.v30-highlight\{padding:\.85rem \.75rem;white-space:pre;overflow-wrap:normal\}/);
});
test('navigation remains keyboard and assistive-tech accessible',()=>{
  assert.match(html, /Skip to content/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(view, /aria-keyshortcuts="\/ Control\+K Meta\+K"/);
  assert.match(view, /aria-label="Open navigation menu"/);
  assert.match(view, /aria-label="Publish a project"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});
test('live refreshes do not discard active dialog form state',()=>{
  assert.match(main, /paintDeferred=true/);
  assert.match(main, /if\(paintDeferred\)\{paintDeferred=false;render\(\);\}/);
  assert.match(main, /clearTimeout\(toastTimer\)/);
});
test('search shortcuts and input synchronize the active Explore route',()=>{
  assert.match(main, /history\.replaceState\(null,'','#explore'\)/);
  assert.match(main, /e\.key==='\/'/);
  assert.match(main, /e\.key\.toLowerCase\(\)==='k'/);
  assert.match(main, /e\.ctrlKey\|\|e\.metaKey/);
  assert.match(main, /nav\.setAttribute\('aria-current','page'\)/);
  assert.match(main, /input\.setSelectionRange\(start,start\)/);
});
test('date labels accept UTC and offset strings and reject corrupt input',()=>{
  for(const value of ['2026-10-13T12:34:56Z','2026-10-13T12:34:56+00:00','2026-10-13 12:34:56','2026-10-13']){
    const formatted=when(value);
    assert.ok(formatted&&!formatted.includes('Invalid'),String(value));
  }
  assert.equal(when('not a date'),'');
  assert.equal(when(null),'');
});
test('base page retains accessible navigation, forms, and live status',()=>{
  assert.match(base, /:focus-visible/);
  assert.match(view, /id="main-content"/);
  assert.match(html, /id="live-status"/);
});
