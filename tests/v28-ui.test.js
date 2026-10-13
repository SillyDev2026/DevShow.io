import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {workspacePage,v28ProjectTools} from '../src/v28.js';
const text = file => readFileSync(file,'utf8');
test('workspace navigation and API integration are connected',()=>{
  assert.match(text('src/views.js'),/workspacePage\(s\.user\)/);
  assert.match(text('src/main.js'),/hydrateV28\(state\.user,notify\)/);
  assert.match(text('src/main.js'),/handleV28Click/);
  assert.match(text('src/main.js'),/handleV28Submit/);
  assert.match(workspacePage({id:'sample'}),/id="v28-find-form"/);
  assert.match(workspacePage(null),/Sign in to save searches/);
  assert.match(v28ProjectTools({id:'123',creatorId:'alice'},true),/v28-tasks/);
  assert.doesNotMatch(v28ProjectTools({id:'123',creatorId:'alice'},false),/v28-tasks/);
});
test('desktop build includes all source modules and changed release tag',()=>{
  assert.match(text('server/index.js'),/src\/v28\.js/);
  assert.match(text('tools/build-desktop.mjs'),/src\/v28\.js/);
  assert.match(text('tools/desktop-entry.mjs'),/2\.8\.0/);
  assert.match(text('.github/workflows/windows-exe.yml'),/tags: \['v2\.8\.\*'\]/);
  assert.match(text('.github/workflows/windows-exe.yml'),/DevShow-Desktop\.exe --self-test/);
});
