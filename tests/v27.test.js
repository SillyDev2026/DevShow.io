import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'devshow-v27-'));
process.env.DB_PATH=path.join(folder,'devshow.sqlite');
process.env.CORS_ORIGINS='https://sillydev2026.github.io';
const {server}=await import('../server/index.js');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
after(async()=>{await new Promise(resolve=>server.close(resolve));(await import('../server/db.js')).db.close();fs.rmSync(folder,{force:true,recursive:true});});
async function request(route,method='GET',data,token){
  const response=await fetch(base+'/api'+route,{method,headers:{Origin:'https://sillydev2026.github.io',...(data!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},body:data!==undefined?JSON.stringify(data):undefined});
  return {status:response.status,...await response.json()};
}
const example={title:'DevShow integrations',tagline:'Open-source project collaborations',description:'A comprehensive demonstration of secure developer collaboration and source code showcase.',category:'Open Source',tags:['Node.js'],repo:'https://github.com/SillyDev2026/DevShow.io',website:'',cover:'',visibility:'public'};
let a,b,c,id,hidden,teamId,feedbackId;
test('v2.7 migrations preserve core data and authentication',async()=>{
  a=await request('/auth/register','POST',{name:'Alice',email:'alice-v27@example.org',handle:'alice27',password:'valid_password_27a'});
  b=await request('/auth/register','POST',{name:'Bob',email:'bob-v27@example.org',handle:'bob27',password:'valid_password_27b'});
  c=await request('/auth/register','POST',{name:'Carol',email:'carol-v27@example.org',handle:'carol27',password:'valid_password_27c'});
  assert.equal(a.status,201);assert.equal(b.status,201);assert.equal(c.status,201);
  assert.equal((await request('/health')).version,'3.0.0');
  id=(await request('/projects','POST',example,a.token)).project.id;
  hidden=(await request('/projects','POST',{...example,title:'Hidden',visibility:'private'},a.token)).project.id;
  const {query}=await import('../server/db.js');
  for(const table of ['dev_teams','dev_team_members','project_launches','feedback_votes','desktop_sync','dashboard_preferences','notification_preferences'])assert.equal(query(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`,table).length,1);
});
test('activity includes public projects and releases but no private projects',async()=>{
  await request(`/projects/${id}/logs`,'POST',{title:'Version released',body:'The first public release is available.',version:'1.0'},a.token);
  const timeline=(await request('/v2/activity')).items;
  assert.ok(timeline.some(x=>x.projectId===id&&x.kind==='release'));
  assert.ok(!timeline.some(x=>x.projectId===hidden));
});
test('demos enforce ownership and private access, reject unsafe URLs',async()=>{
  assert.equal((await request(`/v2/projects/${id}/demo`,'PUT',{url:'https://demo.example.org/play'},b.token)).status,403);
  assert.equal((await request(`/v2/projects/${id}/demo`,'PUT',{url:'http://localhost:3000'},a.token)).status,400);
  assert.equal((await request(`/v2/projects/${id}/demo`,'PUT',{url:'https://example.com/demo'},a.token)).status,200);
  assert.equal((await request(`/v2/projects/${id}/demo`)).url,'https://example.com/demo');
  assert.equal((await request(`/v2/projects/${hidden}/demo`)).status,404);
});
test('team invites, roles, ownership and private project linking are checked',async()=>{
  const t=await request('/v2/teams','POST',{name:'DevShow Builders',description:'Team workspace'},a.token);teamId=t.id;assert.equal(t.status,201);
  assert.equal((await request(`/v2/teams/${teamId}`)).status,401);
  assert.equal((await request(`/v2/teams/${teamId}/invite`,'POST',{handle:'bob27',role:'contributor'},b.token)).status,404);
  assert.equal((await request(`/v2/teams/${teamId}/invite`,'POST',{handle:'bob27',role:'contributor'},a.token)).status,200);
  assert.equal((await request(`/v2/teams/${teamId}/projects`,'POST',{projectId:id},b.token)).status,403);
  assert.equal((await request(`/v2/teams/${teamId}/members`,'POST',{action:'accept'},b.token)).status,200);
  assert.equal((await request(`/v2/teams/${teamId}/projects`,'POST',{projectId:id},a.token)).status,200);
  assert.equal((await request(`/v2/teams/${teamId}/projects`,'POST',{projectId:hidden},a.token)).status,200);
  const bobTeam=await request(`/v2/teams/${teamId}`,'GET',undefined,b.token);
  assert.ok(bobTeam.projects.some(x=>x.id===id));assert.ok(!bobTeam.projects.some(x=>x.id===hidden));
  assert.equal((await request(`/v2/teams/${teamId}/members`,'POST',{action:'remove',userId:a.user.id},b.token)).status,403);
});
test('dashboard widgets are validated and user-scoped',async()=>{
  assert.equal((await request('/v2/dashboard')).status,401);
  assert.equal((await request('/v2/dashboard','PUT',{widgets:['projects','teams','teams']},a.token)).status,400);
  assert.equal((await request('/v2/dashboard','PUT',{widgets:['teams','activity']},a.token)).status,200);
  assert.deepEqual((await request('/v2/dashboard','GET',undefined,a.token)).widgets,['teams','activity']);
  assert.notDeepEqual((await request('/v2/dashboard','GET',undefined,b.token)).widgets,['teams','activity']);
});
test('suggestion voting is distinct per user, reputation rewards accepted feedback',async()=>{
  const f=await request(`/projects/${id}/feedback`,'POST',{body:'Please add a folder browser and code previews.'},b.token);feedbackId=f.id;
  assert.equal((await request(`/v2/projects/${id}/suggestions/${feedbackId}/vote`,'POST',{},b.token)).voted,true);
  assert.equal((await request(`/v2/projects/${id}/suggestions/${feedbackId}/vote`,'POST',{},c.token)).voted,true);
  assert.equal((await request(`/v2/projects/${id}/suggestions`)).items[0].votes,2);
  assert.equal((await request(`/v2/projects/${id}/suggestions/${feedbackId}/vote`,'POST',{},b.token)).voted,false);
  await request(`/projects/${id}/feedback/${feedbackId}`,'PATCH',{status:'accepted'},a.token);
  assert.ok((await request(`/v2/reputation/${b.user.id}`)).reputation.accepted>=1);
  assert.ok((await request('/v2/reputation')).leaders.some(x=>x.handle==='bob27'));
  assert.equal((await request(`/v2/projects/${hidden}/suggestions`)).status,404);
});
test('account notification preferences suppress disabled categories',async()=>{
  const r=await request('/v2/notifications/preferences','PUT',{messages:false,follows:false,projects:true,feedback:true},a.token);assert.equal(r.status,200);
  const initial=(await request('/bootstrap','GET',undefined,a.token)).notifications.length;
  await request(`/users/${a.user.id}/follow`,'POST',{},c.token);
  await request('/messages','POST',{recipientId:a.user.id,body:'Invitation hello'},c.token);
  assert.equal((await request('/bootstrap','GET',undefined,a.token)).notifications.length,initial);
  assert.equal((await request('/v2/notifications/preferences','GET',undefined,b.token)).preferences.messages,true);
});
test('launches scheduled by owners, visible only for public projects',async()=>{
  const when=new Date(Date.now()+86400000).toISOString();
  assert.equal((await request(`/v2/projects/${id}/launches`,'POST',{title:'Public launch',scheduledAt:when},b.token)).status,403);
  const created=await request(`/v2/projects/${id}/launches`,'POST',{title:'Public launch',scheduledAt:when},a.token);assert.equal(created.status,201);
  assert.ok((await request('/v2/launches')).launches.some(x=>x.id===created.id));
  assert.equal((await request(`/v2/projects/${hidden}/launches`)).status,404);
  assert.equal((await request(`/v2/projects/${id}/launches/${created.id}`,'DELETE',undefined,a.token)).status,200);
});
test('desktop sync uses owner-only revisions and protects against lost updates',async()=>{
  const empty=await request('/v2/sync','GET',undefined,a.token);assert.equal(empty.revision,0);
  const first=await request('/v2/sync','PUT',{revision:0,data:{drafts:[{title:'offline prototype'}],notes:'demo'}},a.token);assert.equal(first.revision,1);
  assert.equal((await request('/v2/sync','PUT',{revision:0,data:{drafts:[]}},a.token)).status,409);
  assert.equal((await request('/v2/sync','GET',undefined,b.token)).revision,0);
  assert.equal((await request('/v2/sync','PUT',{revision:1,data:{password:'bad'}},a.token)).status,400);
  assert.equal((await request('/v2/sync','GET',undefined,a.token)).data.notes,'demo');
});
test('code explorer is private-safe and rejects path traversal without GitHub calls',async()=>{
  assert.equal((await request(`/v2/projects/${hidden}/code-tree`)).status,404);
  assert.equal((await request(`/v2/projects/${id}/code-tree?path=../../etc/passwd`)).status,400);
});
