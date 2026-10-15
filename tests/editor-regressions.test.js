import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CodeEditor,highlightLuau} from '../src/editor/playground-luau.js';

function keyboard(key,{readOnly=false,ctrlKey=false}={}){
  let shortcuts=[],prevented=0,changes=0;
  const editor={input:{readOnly,disabled:false,selectionStart:0,selectionEnd:0,value:'text',setRangeText(){changes++;},setSelectionRange(){}},onShortcut:key=>shortcuts.push(key),replace(){changes++;}};
  CodeEditor.prototype.keydown.call(editor,{key,ctrlKey,metaKey:false,altKey:false,isComposing:false,preventDefault(){prevented++;}});
  return {shortcuts,prevented,changes};
}
test('read-only collaborator cannot alter code with editor shortcuts',()=>{
  for(const key of ['Tab','Enter','(','{','"']){
    const action=keyboard(key,{readOnly:true});
    assert.equal(action.prevented,0);
    assert.equal(action.changes,0);
  }
});
test('Ctrl+S saves but Ctrl+P is not hijacked by the source editor',()=>{
  assert.deepEqual(keyboard('s',{ctrlKey:true}).shortcuts,['save']);
  assert.equal(keyboard('s',{ctrlKey:true}).prevented,1);
  assert.equal(keyboard('p',{ctrlKey:true}).prevented,0);
  assert.deepEqual(keyboard('s',{ctrlKey:true,readOnly:true}).shortcuts,[]);
});
test('Luau highlighting continues to escape unsafe markup',()=>{
  const highlighted=highlightLuau('print("<script>alert(1)</script>")');
  assert.match(highlighted,/&lt;script&gt;/);
  assert.doesNotMatch(highlighted,/<script>/);
});
test('switching projects or files cannot allow stale responses to overwrite editor state',()=>{
  const script=readFileSync('src/v30.js','utf8');
  assert.match(script,/state\.generation/);
  assert.match(script,/request!==state\.fileRequest/);
  assert.match(script,/generation!==state\.generation\|\|projectId!==state\.projectId/);
  assert.match(script,/state\.stream===ctl&&state\.projectId===pid/);
  assert.match(script,/state\.dirty&&!confirm\('Discard unsaved editor changes/);
});
test('live stream handles authorization failures and caps event size',()=>{
  const script=readFileSync('src/live.js','utf8');
  assert.match(script,/response\.status===401\|\|response\.status===403/);
  assert.match(script,/buffer\.length>262144/);
});
