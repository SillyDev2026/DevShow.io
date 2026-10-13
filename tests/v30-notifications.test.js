import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'devshow-notifications-'));
process.env.DB_PATH=path.join(directory,'events.sqlite');
const {server}=await import('../server/index.js');
const {db}=await import('../server/db.js');
const listen=async()=>await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
await listen();
let origin=`http://127.0.0.1:${server.address().port}`;
after(async()=>{if(server.listening)await new Promise(resolve=>server.close(resolve));db.close();fs.rmSync(directory,{recursive:true,force:true});});
const request=async(path,method='GET',body,token)=>{
  const res=await fetch(origin+'/api'+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
  return {status:res.status,...await res.json()};
};
let owner,friend,outsider,projectId;
test('create users and private project',async()=>{
  owner=await request('/auth/register','POST',{name:'Owner',handle:'notifyowner',email:'notifyowner@example.com',password:'an-actual-test-password'});
  friend=await request('/auth/register','POST',{name:'Friend',handle:'notifyfriend',email:'notifyfriend@example.com',password:'an-actual-test-password'});
  outsider=await request('/auth/register','POST',{name:'Other',handle:'notifyother',email:'notifyother@example.com',password:'an-actual-test-password'});
  assert.equal(owner.status,201);assert.equal(friend.status,201);
  projectId=(await request('/projects','POST',{title:'Private Example',tagline:'Collaboration example project',description:'A private project that only accepted collaborators should see.',category:'Developer Tools',tags:['Luau'],visibility:'private'},owner.token)).project.id;
});
test('notifications are saved while recipient is offline, even for private invitations',async()=>{
  assert.equal((await request(`/v3/collab/projects/${projectId}/invites`,'POST',{handle:'notifyfriend',role:'editor'},owner.token)).status,200);
  const feed=await request('/notifications/inbox?after=0&limit=10','GET',undefined,friend.token);
  assert.equal(feed.status,200);
  assert.equal(feed.items.length,1);
  assert.equal(feed.items[0].kind,'collaboration');
  assert.equal(feed.items[0].projectId,projectId);
  assert.equal(feed.unreadCount,1);
  assert.equal((await request('/notifications/inbox', 'GET',undefined,outsider.token)).items.length,0);
  assert.equal((await request('/notifications/inbox')).status,401);
  assert.equal((await request('/notifications/inbox?after=-1','GET',undefined,friend.token)).status,400);
  assert.equal((await request('/notifications/inbox?after=0&limit=101','GET',undefined,friend.token)).status,400);
});
test('new unread alerts paginate by durable cursor, with no timestamp race',async()=>{
  for(let i=0;i<3;i++){
    const changed=await request(`/v3/collab/projects/${projectId}/invites`,'POST',{handle:'notifyfriend',role:i%2?'viewer':'editor'},owner.token);
    assert.equal(changed.status,200);
  }
  const first=await request('/notifications/inbox?limit=2','GET',undefined,friend.token);
  assert.equal(first.items.length,2);assert.equal(first.hasMore,true);
  const second=await request(`/notifications/inbox?after=${first.cursor}&limit=2`,'GET',undefined,friend.token);
  assert.equal(second.items.length,2);assert.equal(second.hasMore,false);
  assert.equal(second.unreadCount,4);
  assert.ok(second.items[0].cursor>first.cursor);
  const ids=[...first.items,...second.items].map(n=>n.id);
  assert.equal(new Set(ids).size,4);
});
test('persisted notifications survive a server listener restart and disappear only after marking read',async()=>{
  const before=await request('/notifications/inbox','GET',undefined,friend.token);
  assert.equal(before.unreadCount,4);
  await new Promise(resolve=>server.close(resolve));
  const separate=new DatabaseSync(process.env.DB_PATH);
  const onDisk=separate.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id=?').get(friend.user.id).n;
  assert.equal(onDisk,4);
  separate.close();
  await listen();origin=`http://127.0.0.1:${server.address().port}`;
  const after=await request('/notifications/inbox','GET',undefined,friend.token);
  assert.equal(after.unreadCount,4);
  assert.equal(after.items.length,4);
  assert.equal((await request('/notifications','POST',undefined,friend.token)).status,200);
  const read=await request('/notifications/inbox','GET',undefined,friend.token);
  assert.equal(read.unreadCount,0);assert.equal(read.items.length,4);
  assert.ok(read.items.every(n=>n.read===1));
});
test('notification SSE sends immediate ready event and subsequent live notification hint',async()=>{
  const ctl=new AbortController();
  const response=await fetch(origin+'/api/events',{headers:{Authorization:'Bearer '+friend.token},signal:ctl.signal});
  assert.equal(response.status,200);
  const reader=response.body.getReader();const decoder=new TextDecoder();
  let buffer='';
  async function until(text){
    for(let i=0;i<8&&!buffer.includes(text);i++){
      const {value,done}=await Promise.race([reader.read(),new Promise((_,reject)=>setTimeout(()=>reject(Error('SSE timeout')),2500))]);
      if(done)break;buffer+=decoder.decode(value);
    }
    assert.ok(buffer.includes(text),`${text} not found in ${buffer}`);
  }
  await until('event: ready');
  const created=await request(`/v3/collab/projects/${projectId}/invites`,'POST',{handle:'notifyfriend',role:'editor'},owner.token);
  assert.equal(created.status,200);
  await until('event: notification');
  assert.match(buffer,/"cursor":\d+/);
  ctl.abort();await reader.cancel().catch(()=>{});
});
