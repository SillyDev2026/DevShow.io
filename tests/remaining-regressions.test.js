import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {writeLocalDraft,readLocalDraft,removeLocalDraft,localDraftKey} from '../src/editor/local-drafts.js';

const memory=()=>{const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,val)=>map.set(key,String(val)),removeItem:key=>map.delete(key)};};

test('device backup is scoped to account, server, project and file',()=>{
  const storage=memory(),scope=['https://api.example.com','alice','project1','file1'];
  assert.ok(writeLocalDraft(scope,'local x = 2',3,storage));
  assert.equal(readLocalDraft(scope,storage).content,'local x = 2');
  assert.equal(readLocalDraft(['https://api.example.com','bob','project1','file1'],storage),null);
  assert.equal(readLocalDraft(['https://another.example','alice','project1','file1'],storage),null);
  assert.equal(readLocalDraft(['https://api.example.com','alice','project1','file2'],storage),null);
  assert.ok(removeLocalDraft(scope,storage));
  assert.equal(readLocalDraft(scope,storage),null);
});
test('oversized and invalid local drafts fail safely',()=>{
  const storage=memory(),scope=['origin','user','project','file'];
  assert.equal(writeLocalDraft(scope,'x'.repeat(90001),0,storage),false);
  assert.equal(writeLocalDraft(scope,'ok',-1,storage),false);
  storage.setItem(localDraftKey(...scope),'{broken');
  assert.equal(readLocalDraft(scope,storage),null);
  storage.setItem(localDraftKey(...scope),JSON.stringify({content:'x',baseRevision:1,savedAt:Date.now()-31*86400000}));
  assert.equal(readLocalDraft(scope,storage),null);
  const full={...memory(),setItem(){throw Error('quota');}};
  assert.equal(writeLocalDraft(scope,'ok',1,full),false);
});
test('recovery buttons, safe conflict state and desktop assets are wired',()=>{
  const source=fs.readFileSync('src/v30.js','utf8');
  const server=fs.readFileSync('server/index.js','utf8');
  const build=fs.readFileSync('tools/build-desktop.mjs','utf8');
  assert.match(source,/restore-draft/);
  assert.match(source,/discard-draft/);
  assert.match(source,/state.document.content=draft.content/);
  assert.match(source,/draft.baseRevision!==state.document.revision/);
  assert.match(source,/state.retryDelay=Math.min\(20000/);
  assert.match(server,/src\/editor\/local-drafts\.js/);
  assert.match(build,/src\/editor\/local-drafts\.js/);
});

const folder=fs.mkdtempSync(path.join(os.tmpdir(),'devshow-regress-'));
process.env.DB_PATH=path.join(folder,'db.sqlite');
const {db,exec,query}=await import('../server/db.js');
await import('../server/v30-db.js');
const {inbox}=await import('../server/notifications.js');
const {projects}=await import('../server/projects.js');
const {routeV28}=await import('../server/v28.js');
after(()=>{db.close();fs.rmSync(folder,{recursive:true,force:true});});
const user=randomUUID();
exec('INSERT INTO users(id,email,handle,password_hash,name) VALUES(?,?,?,?,?)',user,'literal@example.com','literal_dev','testhash','Literal Developer');
const data=[
 ['100% Done','percent'],
 ['100x Done','notpercent'],
 ['Under_score','underscore'],
 ['UnderZscore','notunderscore'],
 ['folder\\source','backslash']
];
for(const [title,label] of data)exec('INSERT INTO projects(id,creator_id,title,tagline,description,category,tags) VALUES(?,?,?,?,?,?,?)',randomUUID(),user,title,label,'A regression project for safe literal searching.','Developer Tools','[]');

async function filtered(queryText){
  let status=null,output=null;
  const url=new URL('http://localhost/api/v3/discover?q='+encodeURIComponent(queryText));
  await routeV28({method:'GET'},url,(code,data)=>{status=code;output=data;},()=>{},null);
  assert.equal(status,200);
  return output.projects;
}
test('project searches treat percent, underscore, and backslash as literal characters',async()=>{
  for(const [queryText,title] of [['%','100% Done'],['_','Under_score'],['\\','folder\\source']]){
    assert.deepEqual(projects({q:queryText}).map(p=>p.title),[title]);
    assert.deepEqual((await filtered(queryText)).map(p=>p.title),[title]);
  }
  assert.equal((await filtered('does-not-exist')).length,0);
});
test('desktop status accurately reflects the current release',async()=>{
  let status=null,body;
  await routeV28({method:'GET'},new URL('http://localhost/api/v3/desktop/status'),(s,d)=>{status=s;body=d;},()=>{},null);
  assert.equal(status,200);
  assert.equal(body.version,'3.0.1');
});

test('private collaboration notifications follow membership and invitation visibility',()=>{
  const member=randomUUID(),privateProject=randomUUID();
  exec('INSERT INTO users(id,email,handle,password_hash,name) VALUES(?,?,?,?,?)',member,'member@example.com','member_dev','testhash','Member');
  exec('INSERT INTO projects(id,creator_id,title,tagline,description,category,tags,visibility) VALUES(?,?,?,?,?,?,?,?)',
    privateProject,user,'Private Source','Private repository','Source shared only with accepted collaborators.','Developer Tools','[]','private');
  exec("INSERT INTO collaborative_members(project_id,user_id,role,state,invited_by) VALUES(?,?,'viewer','pending',?)",privateProject,member,user);
  const invitation=randomUUID(),message=randomUUID();
  exec('INSERT INTO notifications(id,user_id,actor_id,kind,project_id) VALUES(?,?,?,?,?)',invitation,member,user,'collaboration',privateProject);
  exec('INSERT INTO notifications(id,user_id,actor_id,kind,project_id) VALUES(?,?,?,?,?)',message,member,user,'message',privateProject);
  assert.deepEqual(inbox(member).items.map(x=>x.id),[invitation]);
  exec("UPDATE collaborative_members SET state='active' WHERE project_id=? AND user_id=?",privateProject,member);
  assert.deepEqual(inbox(member).items.map(x=>x.id),[invitation,message]);
  exec('DELETE FROM collaborative_members WHERE project_id=? AND user_id=?',privateProject,member);
  assert.deepEqual(inbox(member).items,[]);
});
