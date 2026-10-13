import {test} from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
test('offline compactor backs up and preserves SQLite content',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'devshow-migrate-'));
 try{
  const file=path.join(dir,'site.sqlite'),env={...process.env,DB_PATH:file};
  const seed=[
    "import './server/v27-db.js';",
    "import './server/v30-db.js';",
    "import {exec,db} from './server/db.js';",
    "const user='00000000-0000-0000-0000-000000000111',project='00000000-0000-0000-0000-000000000222',doc='00000000-0000-0000-0000-000000000333';",
    "exec('INSERT INTO users(id,email,handle,password_hash,name) VALUES(?,?,?,?,?)',user,'migration@test.local','migration','sample','Migration');",
    "exec('INSERT INTO projects(id,creator_id,title,tagline,description,category) VALUES(?,?,?,?,?,?)',project,user,'Project','tagline','description','Developer Tools');",
    "exec('INSERT INTO collaborative_documents(id,project_id,path,content) VALUES(?,?,?,?)',doc,project,'test.luau','local value = 100\\n'.repeat(600));",
    "exec('INSERT INTO desktop_sync(user_id,revision,payload) VALUES(?,?,?)',user,1,JSON.stringify({drafts:{script:'local x=1\\n'.repeat(400)}}));",
    "db.close();"
  ].join('\n');
  const create=spawnSync(process.execPath,['--input-type=module','-e',seed],{cwd:root,env,encoding:'utf8'});
  assert.equal(create.status,0,create.stderr);
  const dry=spawnSync(process.execPath,['tools/compact-storage.mjs','--db='+file],{cwd:root,env,encoding:'utf8'});
  assert.equal(dry.status,0,dry.stderr);
  assert.match(dry.stdout,/Dry run: 2 values compressible/);
  let db=new DatabaseSync(file);
  const before=db.prepare('SELECT content FROM collaborative_documents').get().content;
  assert.ok(before.startsWith('local value'));
  db.close();
  const run=spawnSync(process.execPath,['tools/compact-storage.mjs','--db='+file,'--apply'],{cwd:root,env,encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  assert.match(run.stdout,/Created consistent pre-migration backup/);
  assert.ok(fs.readdirSync(dir).some(name=>name.includes('.backup-')&&name.endsWith('.sqlite')));
  db=new DatabaseSync(file);
  assert.ok(db.prepare('SELECT content FROM collaborative_documents').get().content.length<before.length);
  assert.ok(db.prepare('SELECT payload FROM desktop_sync').get().payload.length<300);
  db.close();
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
