import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'devshow-v26-'));
process.env.DB_PATH=path.join(dir,'store.sqlite');
process.env.CORS_ORIGINS='https://sillydev2026.github.io';
const {server}=await import('../server/index.js');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
after(async()=>{await new Promise(resolve=>server.close(resolve));(await import('../server/db.js')).db.close();fs.rmSync(dir,{recursive:true,force:true});});
const request=async(endpoint,method='GET',data,token)=>{
  const response=await fetch(base+'/api'+endpoint,{method,headers:{Origin:'https://sillydev2026.github.io',...(data!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},body:data!==undefined?JSON.stringify(data):undefined});
  return {status:response.status,...await response.json()};
};
const project={title:'Studio tools',tagline:'Build friendly utilities',description:'A sample open-source project with safe permissions and visibility checking.',category:'Developer Tools',tags:['Lua'],visibility:'public',repo:'',website:'',cover:''};
let owner,reader,outsider,pubId,privateId,groupId;
test('v2.6 register accounts and schema migrations',async()=>{
  owner=await request('/auth/register','POST',{name:'Ada',handle:'adadev',email:'ada@example.org',password:'test-good-password-123'});
  reader=await request('/auth/register','POST',{name:'Grace',handle:'gracedev',email:'grace@example.org',password:'test-good-password-123'});
  outsider=await request('/auth/register','POST',{name:'Lin',handle:'lindev',email:'lin@example.org',password:'test-good-password-123'});
  assert.equal(owner.status,201);assert.equal(reader.status,201);assert.equal(outsider.status,201);
  assert.equal((await request('/health')).version,'3.0.1');
  assert.equal((await request('/auth/github/start')).status,503);
  const schema=await import('../server/db.js');
  assert.ok(schema.query('PRAGMA table_info(users)').some(c=>c.name==='banner_media_id'));
  assert.ok(schema.query("SELECT name FROM sqlite_master WHERE type='table' AND name='roadmaps'").length);
});
test('public feed and authenticated posting',async()=>{
  assert.equal((await request('/feed','POST',{body:'Hi'})).status,401);
  assert.equal((await request('/feed','POST',{body:'Working on my new dev tools!'},owner.token)).status,201);
  assert.equal((await request('/feed')).posts[0].author.handle,'adadev');
});
test('groups require membership to post and enforce group ownership',async()=>{
  const g=await request('/groups','POST',{name:'Luau Builders',description:'Share scripts'},owner.token);assert.equal(g.status,201);groupId=g.id;
  assert.equal((await request(`/groups/${groupId}/posts`,'POST',{body:'Not yet a member'},reader.token)).status,403);
  assert.equal((await request(`/groups/${groupId}/join`,'POST',{},reader.token)).status,200);
  assert.equal((await request(`/groups/${groupId}/posts`,'POST',{body:'Luau code quality matters'},reader.token)).status,201);
  assert.equal((await request(`/groups/${groupId}/posts`)).posts.length,1);
  assert.equal((await request(`/groups/${groupId}/join`,'POST',{},owner.token)).status,403);
});
test('private messages cannot be read by outsiders',async()=>{
  assert.equal((await request('/messages','POST',{recipientId:reader.user.id,body:'Can we collaborate?'},owner.token)).status,201);
  const outgoing=await request('/messages/'+reader.user.id,'GET',undefined,owner.token);
  assert.equal(outgoing.messages[0].body,'Can we collaborate?');
  assert.equal((await request('/messages/'+reader.user.id,'GET',undefined,outsider.token)).messages.length,0);
  assert.equal((await request('/conversations','GET',undefined,reader.token)).conversations[0].userId,owner.user.id);
  assert.equal((await request('/conversations')).status,401);
});
test('roadmap ownership, feedback, analytics and privacy',async()=>{
  pubId=(await request('/projects','POST',project,owner.token)).project.id;
  privateId=(await request('/projects','POST',{...project,title:'Private plans',visibility:'private'},owner.token)).project.id;
  assert.equal((await request(`/projects/${privateId}/roadmap`)).status,404);
  assert.equal((await request(`/projects/${privateId}/feedback`)).status,404);
  const milestone=await request(`/projects/${pubId}/roadmap`,'POST',{title:'Publish v1.0',description:'Ship stable code'},owner.token);assert.equal(milestone.status,201);
  assert.equal((await request(`/projects/${pubId}/roadmap`,'POST',{title:'Unauthorized milestone'},reader.token)).status,403);
  assert.equal((await request(`/projects/${pubId}/roadmap/${milestone.id}`,'PATCH',{status:'completed'},owner.token)).status,200);
  const f=await request(`/projects/${pubId}/feedback`,'POST',{body:'Support faster code search please.'},reader.token);assert.equal(f.status,201);
  assert.equal((await request(`/projects/${pubId}/feedback/${f.id}`,'PATCH',{status:'accepted'},reader.token)).status,403);
  assert.equal((await request(`/projects/${pubId}/feedback/${f.id}`,'PATCH',{status:'accepted'},owner.token)).status,200);
  assert.equal((await request(`/projects/${pubId}/analytics`,'GET',undefined,reader.token)).status,403);
  await request(`/projects/${pubId}`);
  const analytics=await request(`/projects/${pubId}/analytics`,'GET',undefined,owner.token);assert.equal(analytics.status,200);assert.ok(analytics.daily[0].count>=1);
  assert.equal((await request('/v1/projects')).projects.find(p=>p.id===privateId),undefined);
});
test('media upload is type-limited, owned and private project media is protected',async()=>{
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+SWsdfQAAAABJRU5ErkJggg==';
  const bad=await request('/media','POST',{kind:'avatar',base64:Buffer.from('<svg/onload=alert(1)>').toString('base64')},owner.token);assert.equal(bad.status,415);
  const media=await request('/media','POST',{kind:'avatar',base64:png},owner.token);assert.equal(media.status,201);
  const update={name:'Ada',handle:'adadev',role:'Luau developer',bio:'I work on scripts',github:'',website:'',skills:['Luau'],color:'#b4ffa6',theme:'violet',portfolioLayout:'featured',status:'collaborating',avatarId:media.media.id};
  assert.equal((await request('/me','PATCH',update,reader.token)).status,400);
  const changed=await request('/me','PATCH',update,owner.token);assert.equal(changed.status,200);assert.equal(changed.user.avatarId,media.media.id);assert.ok(changed.user.badges.includes('Publisher'));
  const image=await fetch(base+media.media.url);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');
  const pm=await request('/media','POST',{kind:'project',projectId:privateId,base64:png},owner.token);assert.equal(pm.status,201);
  const forbidden=await fetch(base+pm.media.url);assert.equal(forbidden.status,404);
  const own=await fetch(base+pm.media.url,{headers:{Authorization:`Bearer ${owner.token}`}});assert.equal(own.status,200);
});
test('public events stream authenticates bearer header',async()=>{
  const res=await fetch(base+'/api/events');assert.equal(res.status,401);
  const controller=new AbortController();const online=await fetch(base+'/api/events',{headers:{Authorization:`Bearer ${owner.token}`},signal:controller.signal});assert.equal(online.status,200);assert.match(online.headers.get('content-type'),/text\/event-stream/);controller.abort();
});
test('unsafe Github code URLs and unknown project are rejected',async()=>{
  assert.equal((await request(`/projects/${privateId}/github/code?path=../../etc/passwd`)).status,404);
  assert.equal((await request(`/projects/${pubId}/github/releases`)).status,404);
});
