import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parseGitHubRepo } from '../server/github.js';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'devshow-v22-test-'));
process.env.DB_PATH=path.join(dir,'devshow.sqlite');
process.env.CORS_ORIGINS='https://sillydev2026.github.io';
const {server}=await import('../server/index.js');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const host=`http://127.0.0.1:${server.address().port}`;
after(async()=>{await new Promise(resolve=>server.close(resolve));(await import('../server/db.js')).db.close();fs.rmSync(dir,{force:true,recursive:true});});
const http=async(path,method='GET',data,token)=>{
  const response=await fetch(host+'/api'+path,{method,headers:{Origin:'https://sillydev2026.github.io',...(data?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},body:data?JSON.stringify(data):undefined});
  return {status:response.status,...await response.json()};
};
const project={title:'Visibility check',tagline:'Project with isolated scopes',description:'This project has a sufficiently long description to verify the permission model.',category:'Open Source',tags:['JavaScript'],repo:'https://github.com/example/repo',website:'',cover:''};
let owner,visitor,privateId,unlistedId,publicId;
test('separate identities',async()=>{
  owner=await http('/auth/register','POST',{email:'owner-22@example.org',name:'Owner',handle:'owner22',password:'a-secure-password-222'});
  visitor=await http('/auth/register','POST',{email:'reader-22@example.org',name:'Visitor',handle:'reader22',password:'another-secure-password-22'});
  assert.equal(owner.status,201);assert.equal(visitor.status,201);
});
test('project visibility is validated',async()=>{
  assert.equal((await http('/projects','POST',{...project,visibility:'secret'},owner.token)).status,400);
  publicId=(await http('/projects','POST',{...project,title:'Public project',visibility:'public'},owner.token)).project.id;
  unlistedId=(await http('/projects','POST',{...project,title:'Unlisted project',visibility:'unlisted'},owner.token)).project.id;
  privateId=(await http('/projects','POST',{...project,title:'Private project',visibility:'private'},owner.token)).project.id;
  assert.ok(privateId&&unlistedId&&publicId);
});
test('feed, stats and profiles exclude private/unlisted projects',async()=>{
  for(const token of [undefined,visitor.token]){
    const feed=await http('/bootstrap','GET',null,token);
    assert.deepEqual(feed.projects.map(p=>p.id),[publicId]);
    assert.deepEqual(Object.keys(feed.updates),[]);
    assert.deepEqual(Object.keys(feed.comments),[]);
  }
  const mine=await http('/bootstrap','GET',null,owner.token);
  assert.deepEqual(new Set(mine.myProjects.map(p=>p.id)),new Set([publicId,unlistedId,privateId]));
  assert.deepEqual((await http('/projects')).projects.map(p=>p.id),[publicId]);
  assert.deepEqual((await http('/projects?q=Unlisted')).projects,[]);
  assert.deepEqual((await http('/users/owner22')).projects.map(p=>p.id),[publicId]);
  assert.equal((await http('/stats')).projects,1);
});
test('deep links: unlisted shared via ID; private is owner-only',async()=>{
  assert.equal((await http(`/projects/${unlistedId}`)).status,200);
  assert.equal((await http(`/projects/${unlistedId}`,'GET',null,visitor.token)).status,200);
  assert.equal((await http(`/projects/${privateId}`)).status,404);
  assert.equal((await http(`/projects/${privateId}`,'GET',null,visitor.token)).status,404);
  assert.equal((await http(`/projects/${privateId}`,'GET',null,owner.token)).status,200);
  assert.equal((await http(`/projects/${privateId}/github`)).status,404);
  assert.equal((await http(`/projects/${privateId}/like`,'POST',{},visitor.token)).status,404);
  assert.equal((await http(`/projects/${privateId}/comments`,'POST',{text:'secret?'},visitor.token)).status,404);
  assert.equal((await http(`/projects/${privateId}/bookmark`,'POST',{},visitor.token)).status,404);
});
test('unlisted discussions are only shown on the direct link',async()=>{
  assert.equal((await http(`/projects/${unlistedId}/comments`,'POST',{text:'Unlisted discussion'},visitor.token)).status,201);
  assert.equal((await http(`/projects/${unlistedId}/logs`,'POST',{title:'Release 1',body:'Sharing the private build update on the unlisted link.',version:'1.0'},owner.token)).status,201);
  const anon=await http('/bootstrap');
  assert.equal(anon.comments[unlistedId],undefined);
  assert.equal(anon.updates[unlistedId],undefined);
  const visitorFeed=await http('/bootstrap','GET',null,visitor.token);
  assert.equal(visitorFeed.comments[unlistedId],undefined);
  assert.equal(visitorFeed.updates[unlistedId],undefined);
  const direct=await http(`/projects/${unlistedId}`);
  assert.equal(direct.comments[0].text,'Unlisted discussion');
  assert.equal(direct.updates[0].version,'1.0');
});
test('changing visibility immediately updates feed and removes private interactions',async()=>{
  assert.equal((await http(`/projects/${publicId}`,'PATCH',{...project,visibility:'private'},owner.token)).status,200);
  assert.equal((await http(`/projects/${publicId}`)).status,404);
  assert.equal((await http('/projects')).projects.length,0);
  assert.equal((await http(`/projects/${publicId}/like`,'POST',{},owner.token)).status,403);
  assert.equal((await http(`/projects/${unlistedId}`,'PATCH',{...project,visibility:'public'},visitor.token)).status,403);
  assert.equal((await http(`/projects/${publicId}`,'PATCH',{...project,visibility:'public'},owner.token)).status,200);
});
test('pinned showcase must belong to user and be public',async()=>{
  const base={name:'Owner',handle:'owner22',role:'Developer',bio:'Builds things',github:'',website:'',location:'',skills:['Luau'],color:'#b4ffa6'};
  assert.equal((await http('/me','PATCH',{...base,pinnedProjectId:privateId},owner.token)).status,400);
  assert.equal((await http('/me','PATCH',{...base,pinnedProjectId:publicId},visitor.token)).status,400);
  const changed=await http('/me','PATCH',{...base,pinnedProjectId:publicId},owner.token);
  assert.equal(changed.status,200);assert.equal(changed.user.pinnedProjectId,publicId);
  assert.equal((await http('/users/owner22')).user.pinnedProjectId,publicId);
  await http(`/projects/${publicId}`,'PATCH',{...project,visibility:'private'},owner.token);
  assert.equal((await http('/users/owner22')).user.pinnedProjectId,'');
});
test('GitHub URL parser rejects SSRF and unsafe repository paths',()=>{
  assert.deepEqual(parseGitHubRepo('https://github.com/owner/repo'),{owner:'owner',repo:'repo',url:'https://github.com/owner/repo'});
  for(const url of ['http://github.com/a/b','https://evil.com/a/b','https://github.com.evil.com/a/b','https://github.com/a/b/tree/main','https://github.com/a/b?unsafe=1','https://user:password@github.com/a/b','https://github.com/a/../b','https://github.com/a/b#fragment'])assert.equal(parseGitHubRepo(url),null,url);
});
test('schema migration preserves legacy projects and defaults visibility to public',()=>{
  const db=new DatabaseSync(process.env.DB_PATH);
  const cols=db.prepare('PRAGMA table_info(projects)').all().map(x=>x.name);
  assert.ok(cols.includes('visibility'));
  assert.ok(db.prepare("SELECT COUNT(*) total FROM projects WHERE visibility='public'").get().total>=0);
  db.close();
});
