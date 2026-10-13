import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'devshow-storage-'));
process.env.DB_PATH=path.join(dir,'storage.sqlite');
process.env.CORS_ORIGINS='https://sillydev2026.github.io';
const {server}=await import('../server/index.js');
const {one,exec,db}=await import('../server/db.js');
const {STORAGE_PREFIX,unpackText}=await import('../server/storage-codec.js');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
after(async()=>{await new Promise(resolve=>server.close(resolve));db.close();fs.rmSync(dir,{recursive:true,force:true});});
async function request(uri,method='GET',data,token){
 const result=await fetch(origin+'/api'+uri,{method,headers:{Origin:'https://sillydev2026.github.io',...(data?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined});
 return {status:result.status,...await result.json().catch(()=>({}))};
}
let token,pid,fid,collab;
test('compressed project source and permission-gated storage statistics',async()=>{
 const user=await request('/auth/register','POST',{name:'Storage Tester',handle:'storageuser',email:'storage@example.com',password:'securetestpasswordX'});assert.equal(user.status,201);token=user.token;
 const p=await request('/projects','POST',{title:'Storage suite',tagline:'Compressed code',description:'An authentic test of stored source fidelity.',category:'Developer Tools',tags:['luau'],visibility:'private'},token);assert.equal(p.status,201);pid=p.project.id;collab='/v3/collab/projects/'+pid;
 const code='--!strict\nlocal value = 1\nprint(value)\n'.repeat(190);
 const created=await request(collab+'/documents','POST',{path:'lib/main.luau',language:'luau',content:code},token);assert.equal(created.status,201);fid=created.document.id;
 assert.equal(one('SELECT content FROM collaborative_documents WHERE id=?',fid).content.startsWith(STORAGE_PREFIX),true);
 assert.equal((await request(collab+'/documents/'+fid,'GET',undefined,token)).document.content,code);
 const metrics=await request(collab+'/storage','GET',undefined,token);
 assert.equal(metrics.documents,1);assert.ok(metrics.savedBytes>4000);
 assert.equal((await request(collab+'/storage')).status,401);
});
test('history, optimistic conflicts and compressed source stay compatible',async()=>{
 const text='-- v2\nlocal message = "Saving source"\n'.repeat(270);
 const result=await request(collab+'/documents/'+fid,'PUT',{baseRevision:0,content:text},token);assert.equal(result.status,200);
 assert.equal(result.document.content,text);
 assert.ok(result.document.storage.savedBytes>0);
 const prev=one('SELECT content FROM collaborative_revisions WHERE document_id=? AND revision=0',fid).content;
 assert.equal(prev.startsWith(STORAGE_PREFIX),true);
 assert.match(unpackText(prev),/print\(value\)/);
 const conflict=await request(collab+'/documents/'+fid,'PUT',{baseRevision:0,content:'changed'},token);
 assert.equal(conflict.status,409);assert.equal(conflict.current.content,text);
});
test('legacy records still read and are replaced on write',async()=>{
 exec('UPDATE collaborative_documents SET content=? WHERE id=?','legacy direct SQL text',fid);
 assert.equal((await request(collab+'/documents/'+fid,'GET',undefined,token)).document.content,'legacy direct SQL text');
 const changed=await request(collab+'/documents/'+fid,'PUT',{baseRevision:1,content:'--!strict\nlocal x = 1\n'.repeat(1000)},token);
 assert.equal(changed.status,200);
 assert.ok(one('SELECT content FROM collaborative_documents WHERE id=?',fid).content.startsWith(STORAGE_PREFIX));
});
test('desktop sync returns standard JSON and rejects stale revisions',async()=>{
 const drafts='local state = true\n'.repeat(350);
 const first=await request('/v2/sync','PUT',{revision:0,data:{drafts:{'main.luau':drafts},notes:'test',preferences:{theme:'dark'}}},token);
 assert.equal(first.status,200);assert.equal(first.revision,1);
 const row=one('SELECT payload FROM desktop_sync WHERE user_id=(SELECT id FROM users WHERE handle=?)','storageuser');
 assert.ok(row.payload.startsWith(STORAGE_PREFIX));
 assert.equal((await request('/v2/sync','GET',undefined,token)).data.drafts['main.luau'],drafts);
 assert.equal((await request('/v2/sync','PUT',{revision:0,data:{notes:'stale'}},token)).status,409);
 exec("UPDATE desktop_sync SET payload='{\"drafts\":{},\"notes\":\"legacy\"}' WHERE user_id=(SELECT id FROM users WHERE handle=?)",'storageuser');
 assert.equal((await request('/v2/sync','GET',undefined,token)).data.notes,'legacy');
});
