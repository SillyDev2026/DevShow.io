import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'devshow-sse-security-'));
process.env.DB_PATH=path.join(directory,'test.sqlite');
const {server}=await import('../server/index.js');
const {db}=await import('../server/db.js');
const {notify}=await import('../server/security.js');
const {emit}=await import('../server/v30-live.js');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const root='http://127.0.0.1:'+server.address().port;
after(async()=>{await new Promise(resolve=>server.close(resolve));db.close();fs.rmSync(directory,{force:true,recursive:true});});

async function request(route,method='GET',body,token){
  const res=await fetch(root+'/api'+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
  return {status:res.status,...await res.json()};
}
async function account(name){
  const result=await request('/auth/register','POST',{name,handle:'sse'+name.toLowerCase(),email:name.toLowerCase()+'@test.dev',password:'secure-demo-password-2026'});
  assert.equal(result.status,201);
  return result;
}
async function expectClosed(reader){
  const reading=(async()=>{
    for(let n=0;n<6;n++){
      const chunk=await reader.read();
      if(chunk.done)return true;
      if(new TextDecoder().decode(chunk.value).includes('event: message'))throw Error('Revoked session received a private message.');
      if(new TextDecoder().decode(chunk.value).includes('event: notification'))throw Error('Revoked session received a private notification.');
    }
    return false;
  })();
  const timeout=new Promise((_,reject)=>setTimeout(()=>reject(Error('Revoked SSE connection stayed open')),3500));
  return Promise.race([reading,timeout]);
}
test('logged-out session cannot keep receiving private notification SSE',async()=>{
  const actor=await account('Actor'),recipient=await account('Recipient');
  const controller=new AbortController();
  try{
    const stream=await fetch(root+'/api/events',{headers:{Authorization:'Bearer '+recipient.token},signal:controller.signal});
    assert.equal(stream.status,200);
    const reader=stream.body.getReader();
    const initial=await reader.read();
    assert.equal(initial.done,false);
    assert.match(new TextDecoder().decode(initial.value),/event: ready/);
    assert.equal((await request('/auth/logout','POST',undefined,recipient.token)).status,200);
    notify(actor.user.id,recipient.user.id,'message');
    assert.equal(await expectClosed(reader),true);
    const inbox=await request('/notifications/inbox','GET',undefined,recipient.token);
    assert.equal(inbox.status,401);
  }finally{controller.abort();}
});
test('logged-out shared editor SSE ends before receiving another member event',async()=>{
  const owner=await account('Owner'),friend=await account('Friend');
  const created=await request('/projects','POST',{title:'Revocation Test',tagline:'A team source collaboration project',description:'A safe sample project used to verify editor session lifecycle and revocation.',category:'Developer Tools',visibility:'private',tags:['Luau']},owner.token);
  assert.equal(created.status,201);
  const id=created.project.id;
  assert.equal((await request('/v3/collab/projects/'+id+'/invites','POST',{handle:'ssefriend',role:'viewer'},owner.token)).status,200);
  assert.equal((await request('/v3/collab/invitations/'+id,'POST',{action:'accept'},friend.token)).status,200);
  const controller=new AbortController();
  try{
    const stream=await fetch(root+'/api/v3/collab/projects/'+id+'/events',{headers:{Authorization:'Bearer '+friend.token},signal:controller.signal});
    assert.equal(stream.status,200);
    const reader=stream.body.getReader();
    assert.equal((await reader.read()).done,false);
    assert.equal((await request('/auth/logout','POST',undefined,friend.token)).status,200);
    emit(id,'message',{handle:'sseowner',message:'private message not for a signed-out user'});
    assert.equal(await expectClosed(reader),true);
  }finally{controller.abort();}
});
