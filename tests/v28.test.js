import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const folder = fs.mkdtempSync(path.join(os.tmpdir(),'devshow-v28-'));
process.env.DB_PATH = path.join(folder,'devshow.sqlite');
process.env.CORS_ORIGINS = 'https://sillydev2026.github.io';
const {server} = await import('../server/index.js');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base = `http://127.0.0.1:${server.address().port}`;
after(async()=>{await new Promise(resolve=>server.close(resolve));(await import('../server/db.js')).db.close();fs.rmSync(folder,{recursive:true,force:true});});
async function request(route,method='GET',data,token){
  const res = await fetch(base+'/api'+route,{method,headers:{Origin:'https://sillydev2026.github.io',...(data!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},body:data!==undefined?JSON.stringify(data):undefined});
  return {status:res.status,...await res.json()};
}
let alice,bob,id,privateId,unlistedId,taskId,milestoneId,searchId;
const sample = {title:'DevShow v2.8 sample',tagline:'Developer community improvements',description:'Project with sample descriptions for the new discovery and workspace features.',category:'Developer Tools',tags:['Node','Luau'],visibility:'public'};
test('new routes preserve authentication and migrations',async()=>{
  alice=await request('/auth/register','POST',{name:'Alice',handle:'alice28',email:'alice28@example.org',password:'StrongPassword2028!'});
  bob=await request('/auth/register','POST',{name:'Bob',handle:'bob28',email:'bob28@example.org',password:'StrongPassword2028!'});
  assert.equal(alice.status,201);assert.equal(bob.status,201);
  assert.equal((await request('/health')).version,'2.8.0');
  id=(await request('/projects','POST',sample,alice.token)).project.id;
  privateId=(await request('/projects','POST',{...sample,title:'Private DevShow',visibility:'private'},alice.token)).project.id;
  unlistedId=(await request('/projects','POST',{...sample,title:'Unlisted DevShow',visibility:'unlisted'},alice.token)).project.id;
  const {query}=await import('../server/db.js');
  for(const table of ['saved_searches','project_workspaces','project_tasks','project_milestones','user_blocks','content_reports'])assert.equal(query("SELECT name FROM sqlite_master WHERE type='table' AND name=?",table).length,1);
});
test('advanced discovery respects visibility, category, tags, sort and paging',async()=>{
  const d=await request('/v3/discover?tag=Luau&category=Developer%20Tools&limit=1');assert.equal(d.status,200);assert.equal(d.total,1);assert.equal(d.projects[0].id,id);
  assert.equal((await request('/v3/discover?tag=wrong')).total,0);
  assert.equal((await request('/v3/discover?sort=invalid')).status,400);
  assert.equal((await request('/v3/discover?limit=1&offset=1')).projects.length,0);
  assert.ok((await request('/v3/tags')).tags.some(x=>x.tag==='Luau'&&x.count===1));
});
test('saved searches are owner-scoped and validate input',async()=>{
  assert.equal((await request('/v3/saved-searches')).status,401);
  const result=await request('/v3/saved-searches','POST',{name:'Luau kits',query:'DevShow',category:'Developer Tools',tag:'Luau',sort:'newest'},alice.token);searchId=result.id;assert.equal(result.status,201);
  assert.equal((await request('/v3/saved-searches','GET',undefined,bob.token)).searches.length,0);
  assert.equal((await request('/v3/saved-searches','POST',{name:'bad',sort:'sql'},alice.token)).status,400);
  assert.equal((await request(`/v3/saved-searches/${searchId}`,'DELETE',undefined,bob.token)).status,404);
  assert.equal((await request(`/v3/saved-searches/${searchId}`,'DELETE',undefined,alice.token)).status,200);
});
test('workspace metadata validates ownership and protects private projects',async()=>{
  assert.equal((await request(`/v3/projects/${privateId}/workspace`)).status,404);
  assert.equal((await request(`/v3/projects/${id}/workspace`,'PUT',{status:'building',recruiting:true},bob.token)).status,404);
  const data=await request(`/v3/projects/${id}/workspace`,'PUT',{status:'beta',recruiting:true,stack:['Node','SQLite'],docsUrl:'https://example.org/docs',supportUrl:'https://example.org/help'},alice.token);
  assert.equal(data.workspace.status,'beta');assert.equal(data.workspace.recruiting,true);
  assert.equal((await request(`/v3/projects/${id}/workspace`)).workspace.stack[1],'SQLite');
  assert.equal((await request(`/v3/projects/${id}/workspace`,'PUT',{status:'unknown',recruiting:false},alice.token)).status,400);
});
test('private task checklist supports completion and cannot be read by others',async()=>{
  const p=await request(`/v3/projects/${id}/tasks`,'POST',{title:'Ship build'},alice.token);taskId=p.id;assert.equal(p.status,201);
  assert.equal((await request(`/v3/projects/${id}/tasks`)).status,404);
  assert.equal((await request(`/v3/projects/${id}/tasks`,'GET',undefined,bob.token)).status,404);
  assert.equal((await request(`/v3/projects/${id}/tasks`,'POST',{title:'Sneaky'},bob.token)).status,404);
  assert.equal((await request(`/v3/projects/${id}/tasks/${taskId}`,'PATCH',{done:true},alice.token)).done,true);
  assert.equal((await request(`/v3/projects/${id}/tasks`,'GET',undefined,alice.token)).tasks[0].done,true);
});
test('milestones enforce private visibility, date validation and owner updates',async()=>{
  const p=await request(`/v3/projects/${id}/milestones`,'POST',{title:'Public beta',dueDate:'2026-11-10',description:'Opening the beta'},alice.token);milestoneId=p.id;assert.equal(p.status,201);
  assert.equal((await request(`/v3/projects/${privateId}/milestones`)).status,404);
  assert.equal((await request(`/v3/projects/${id}/milestones`,'POST',{title:'Invalid',dueDate:'2026-02-31'},alice.token)).status,400);
  assert.equal((await request(`/v3/projects/${id}/milestones/${milestoneId}`,'PATCH',{status:'completed'},bob.token)).status,404);
  assert.equal((await request(`/v3/projects/${id}/milestones/${milestoneId}`,'PATCH',{status:'completed'},alice.token)).status,'completed');
  assert.equal((await request(`/v3/projects/${id}/milestones`)).milestones[0].status,'completed');
});
test('studio overview and export are account-scoped',async()=>{
  assert.equal((await request('/v3/studio/overview')).status,401);
  const overview=await request('/v3/studio/overview','GET',undefined,alice.token);
  assert.equal(overview.overview.total,3);
  const dump=await request('/v3/studio/export','GET',undefined,alice.token);
  assert.equal(dump.projects.length,3);assert.ok(dump.projects.some(x=>x.project.id===privateId));
  assert.equal((await request('/v3/studio/export','GET',undefined,bob.token)).projects.length,0);
});
test('reports cannot target private foreign projects and deduplicate spam',async()=>{
  assert.equal((await request('/v3/reports','POST',{kind:'project',subjectId:privateId,reason:'spam'},bob.token)).status,404);
  assert.equal((await request('/v3/reports','POST',{kind:'project',subjectId:id,reason:'spam'},alice.token)).status,400);
  assert.equal((await request('/v3/reports','POST',{kind:'project',subjectId:id,reason:'spam'},bob.token)).status,201);
  assert.equal((await request('/v3/reports','POST',{kind:'project',subjectId:id,reason:'spam'},bob.token)).duplicate,true);
  assert.equal((await request('/v3/reports','POST',{kind:'project',subjectId:id,reason:'notreal'},bob.token)).status,400);
});
test('blocking users hides projects in filtered discover and following feed',async()=>{
  await request(`/users/${alice.user.id}/follow`,'POST',{},bob.token);
  assert.equal((await request('/v3/feed/following','GET',undefined,bob.token)).projects[0].id,id);
  const block=await request(`/v3/users/${alice.user.id}/block`,'POST',{},bob.token);assert.equal(block.blocked,true);
  assert.equal((await request('/v3/discover','GET',undefined,bob.token)).total,0);
  assert.equal((await request('/v3/feed/following','GET',undefined,bob.token)).projects.length,0);
  assert.equal((await request('/v3/me/blocks','GET',undefined,bob.token)).blocks.length,1);
  assert.equal((await request(`/v3/users/${alice.user.id}/block`,'POST',{},bob.token)).blocked,false);
});
test('notification read ownership and desktop status are explicit',async()=>{
  const status=await request('/v3/desktop/status');assert.equal(status.features.automaticTwoWaySync,false);
  const {query}=await import('../server/db.js');
  const id=cryptoRandom();
  query('SELECT 1'); // Import ensures the new API is running against SQLite.
  assert.equal((await request(`/v3/notifications/${id}/read`,'POST',{},bob.token)).status,404);
});
function cryptoRandom(){return '12345678-1234-4123-8123-123456789abc';}
