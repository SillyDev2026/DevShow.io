import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const load=file=>fs.readFileSync(file,'utf8');
const build=load('tools/build-desktop.mjs');
const apiServer=load('server/index.js');
const editor=load('src/v30.js');
const projectStream=load('server/v30-live.js');
const communityStream=load('server/live.js');

test('every bundled desktop asset exists and is explicitly served by Node',()=>{
  const match=/const assets=\[([\s\S]*?)\];/.exec(build);
  assert.ok(match,'Desktop SEA asset manifest required');
  const assets=[...match[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
  assert.ok(assets.length>=18,'Missing website assets');
  assert.equal(new Set(assets).size,assets.length,'Duplicate desktop assets');
  for(const asset of assets){
    assert.ok(fs.existsSync(asset),'Missing desktop asset '+asset);
    assert.ok(apiServer.includes("'/" + asset + "'"),'Static server cannot serve '+asset);
  }
  assert.ok(assets.includes('src/editor/local-drafts.js'),'Offline edit recovery must be packaged');
  assert.ok(assets.includes('styles-ui.css'),'Responsive CSS must be packaged');
});

test('every browser module import is included in the Windows SEA',()=>{
  const block=/const assets=\[([\s\S]*?)\];/.exec(build)?.[1]||'';
  const bundled=new Set([...block.matchAll(/'([^']+)'/g)].map(x=>x[1]));
  const visited=new Set(),stack=['src/main.js'];
  while(stack.length){
    const file=stack.pop();
    if(visited.has(file))continue;
    visited.add(file);
    const text=load(file);
    const re=/\bfrom\s*['"](\.[^'"]+)['"]|\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;
    for(const match of text.matchAll(re)){
      const dependency=path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1]||match[2]));
      assert.ok(bundled.has(dependency),file+' imports '+dependency+' missing from EXE');
      stack.push(dependency);
    }
  }
  assert.ok(visited.has('src/v30.js'));
  assert.ok(visited.has('src/editor/local-drafts.js'));
});

test('remote deletion of active document recovers the workspace without fetching deleted file',()=>{
  assert.match(editor,/data\.action==='delete'&&state\.documentId===data\.id/);
  assert.match(editor,/state\.document=null;state\.documentId='';state\.localDraft=null/);
  assert.match(editor,/if\(state\.dirty\)\{backupLocal\(\);state\.conflict=true/);
  assert.match(editor,/await refreshData\(\)/);
});
test('permanently revoked shared editor sessions do not reconnect endlessly',()=>{
  assert.match(editor,/if\(\[401,403,404\]\.includes\(res\.status\)\)/);
  assert.match(editor,/stopCollab\(\);state\.projectId=''/);
  assert.match(editor,/if\(!ctl\.signal\.aborted&&state\.stream===ctl&&state\.projectId===pid\)/);
});
test('SSE clients are safely discarded on write failures and backpressure',()=>{
  assert.match(projectStream,/catch\{client\.res\.destroy\(\);\}/);
  assert.match(projectStream,/catch\{cleanup\(\);res\.destroy\(\);\}/);
  assert.match(communityStream,/if\(!res\.write\(packet\)\)/);
});
