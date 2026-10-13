import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync('styles-fluid.css','utf8');
const view=readFileSync('src/views.js','utf8');
const main=readFileSync('src/main.js','utf8');
const html=readFileSync('index.html','utf8');
const server=readFileSync('server/index.js','utf8');
const builder=readFileSync('tools/build-desktop.mjs','utf8');
test('fluid responsive design is loaded and uses proportions',()=>{
  assert.match(html,/styles-fluid\.css/);
  assert.match(server,/styles-fluid\.css/);
  assert.match(builder,/styles-fluid\.css/);
  assert.match(css,/--sidebar-width: clamp\(/);
  assert.match(css,/repeat\(auto-fill, minmax/);
  assert.match(css,/aspect-ratio: 16\/9/);
  assert.match(css,/@media \(max-width: 44rem\)/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
});
test('responsive navigation and discovery controls are wired',()=>{
  for(const action of ['focus-search','quick-category','view']){
    assert.match(view,new RegExp(`data-action="${action}"`));
    assert.match(main,new RegExp(`action==='${action}'`));
  }
  assert.match(view,/aria-current="page"/);
  assert.match(view,/is-list/);
  assert.match(main,/devshow-layout/);
  assert.match(html,/Skip to content/);
});
