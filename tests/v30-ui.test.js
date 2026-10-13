import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {collabPage} from '../src/v30.js';
import {highlightLuau,newlineIndent} from '../src/editor/playground-luau.js';
const read=p=>readFileSync(p,'utf8');
test('v3 editor page is mounted from the DevShow router and works on mobile',()=>{
  assert.match(read('src/views.js'),/\['collab','⌘','Live editor'\]/);
  assert.match(read('src/views.js'),/collabPage\(s\.user\)/);
  assert.match(read('src/main.js'),/hydrateCollab\(state\.user,notify\)/);
  assert.match(read('src/main.js'),/handleCollabClick\(v30\)/);
  assert.match(read('src/main.js'),/handleCollabSubmit\(e\.target\)/);
  assert.match(read('styles-v30.css'),/@media\(max-width:28rem\)/);
  assert.match(collabPage({id:'owner'}),/v30-root/);
  assert.match(collabPage(null),/Sign in/);
});
test('LuauForge highlighter safely escapes markup and maintains logical lines',()=>{
  const markup=highlightLuau('local example = "<script>"\nprint(example)');
  assert.match(markup,/token keyword/);
  assert.match(markup,/&lt;script&gt;/);
  assert.doesNotMatch(markup,/<script>/);
  assert.equal(newlineIndent('if true then',12),'\n    ');
  assert.equal(newlineIndent('local a = b',11),'\n');
});
test('desktop and server package all 3.0 editor dependencies',()=>{
  for(const name of ['server/index.js','tools/build-desktop.mjs']){
    assert.match(read(name),/src\/v30\.js/);
    assert.match(read(name),/src\/editor\/playground-luau\.js/);
    assert.match(read(name),/styles-v30\.css/);
  }
  assert.match(read('tools/desktop-entry.mjs'),/3\.0\.1/);
  assert.match(read('.github/workflows/windows-exe.yml'),/v3\.0\.\*/);
});

test('durable inbox and desktop asset are part of the v3 release',()=>{
  assert.match(read('server/index.js'),/src\/notification-inbox\.js/);
  assert.match(read('tools/build-desktop.mjs'),/src\/notification-inbox\.js/);
  assert.match(read('server/api.js'),/notifications\/inbox/);
  assert.match(read('src/live.js'),/onMessage\(\{type,payload\}\)/);
  assert.match(read('src/main.js'),/recoverNotifications/);
  assert.match(read('src/v30.js'),/Reconnecting automatically/);
});
