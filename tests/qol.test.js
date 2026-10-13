import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectExe,getDesktopRelease} from '../src/releases.js';
import {probeServer} from '../src/api.js';

const download='https://github.com/SillyDev2026/DevShow.io/releases/download/desktop-latest/DevShow-Desktop.exe';
const release={tag_name:'desktop-latest',assets:[
  {name:'DevShow-Desktop.exe',state:'uploaded',size:44000000,browser_download_url:download,updated_at:'2026-10-13T12:00:00Z'},
  {name:'DevShow-Desktop.exe.sha256',state:'uploaded',browser_download_url:download+'.sha256'}
]};
test('release picker only trusts a ready standalone Windows EXE',()=>{
  const picked=selectExe(release);
  assert.equal(picked.url,download);
  assert.equal(picked.checksum,download+'.sha256');
  assert.equal(selectExe({...release,tag_name:'v2.2.0'}),null);
  assert.equal(selectExe({...release,assets:[{...release.assets[0],size:100}]}),null);
  assert.equal(selectExe({...release,assets:[{...release.assets[0],browser_download_url:'https://example.com/DevShow-Desktop.exe'}]}),null);
  assert.equal(selectExe({...release,assets:[{...release.assets[0],state:'starter'}]}),null);
});
test('GitHub release endpoint handles missing releases and server errors',async()=>{
  assert.equal(await getDesktopRelease(async()=>({status:404})),null);
  const info=await getDesktopRelease(async()=>({ok:true,status:200,json:async()=>release}));
  assert.equal(info.url,download);
  await assert.rejects(getDesktopRelease(async()=>({status:403,ok:false})),/403/);
});
test('connection preflight checks for a compatible DevShow API',async()=>{
  const endpoints=[];
  const result=await probeServer('https://devshow-api.example.com',async(url)=>{endpoints.push(url);return {ok:true,json:async()=>({ok:true,service:'DevShow API',version:'2.7.0'})};});
  assert.equal(result.version,'2.7.0');
  assert.deepEqual(endpoints,['https://devshow-api.example.com/api/health']);
  await assert.rejects(probeServer('http://not-secure.example.com',async()=>({ok:true})),/HTTPS/);
  await assert.rejects(probeServer('https://devshow-api.example.com',async()=>({ok:true,json:async()=>({ok:true,service:'Different API',version:'2.7.0'})})),/compatible/);
});
test('website, Windows builder and release workflow are consistent',()=>{
  const frontend=readFileSync('src/views.js','utf8');
  const main=readFileSync('src/main.js','utf8');
  const workflow=readFileSync('.github/workflows/windows-exe.yml','utf8');
  const build=readFileSync('tools/build-desktop.mjs','utf8');
  assert.match(frontend,/id="windows-release"/);
  assert.match(main,/hydrateRelease/);
  assert.match(build,/src\/releases\.js/);
  assert.match(readFileSync('server/index.js','utf8'),/src\/releases\.js/);
  assert.match(workflow,/branches: \[main\]/);
  assert.match(workflow,/tags: \['v2\.7\.\*'\]/);
  assert.match(workflow,/DevShow-Desktop\.exe\.sha256/);
  assert.match(workflow,/--self-test/);
  assert.match(readFileSync('tools/desktop-entry.mjs','utf8'),/EADDRINUSE/);
});
