import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=readFileSync('styles.css','utf8');
const fluid=readFileSync('styles-fluid.css','utf8');
const editor=readFileSync('styles-v30.css','utf8');
const html=readFileSync('index.html','utf8');

test('all responsive layers loaded in cascade order',()=>{
  const links=['styles.css','styles-fluid.css','styles-v30.css'];
  let last=-1;
  for(const name of links){const at=html.indexOf('href="./'+name+'"');assert.ok(at>last,name+' should follow preceding stylesheet');last=at;}
});
test('phone and foldable widths have mobile navigation and grid collapse',()=>{
  assert.match(fluid,/@media\(max-width:40\.625rem\)/);
  assert.match(fluid,/\.mobile-bottom small\{display:block;max-width:100%/);
  assert.match(fluid,/\.dialog \.form-row\{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(fluid,/safe-area-inset-bottom/);
});
test('tablet rail avoids clipped icon navigation',()=>{
  assert.match(fluid,/@media\(min-width:40\.626rem\) and \(max-width:56\.25rem\)/);
  assert.match(fluid,/\.sidebar \.nav-link \.nav-glyph\{font-size:1\.35rem/);
  assert.match(fluid,/grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,15rem\),1fr\)\)/);
});
test('desktop cards flow with their available width',()=>{
  assert.match(fluid,/@media\(min-width:70\.001rem\)/);
  assert.match(fluid,/repeat\(auto-fit,minmax\(min\(100%,18rem\),1fr\)\)/);
  assert.match(fluid,/\.page-container\s*>\s*\*/);
});
test('Luau editor tracks and line metrics remain synchronized',()=>{
  assert.match(editor,/\.v30-gutter,\.v30-input,\.v30-highlight\{font-family:/);
  assert.match(editor,/grid-template-columns:clamp\(2\.5rem,5%,3\.4rem\) minmax\(0,1fr\)/);
  assert.match(editor,/@media\(max-width:32rem\)/);
});
test('base UI retains keyboard focus and compact navigation',()=>{
  assert.match(base,/:focus-visible/);
  assert.match(base,/\.mobile-bottom/);
});
