#!/usr/bin/env node
// Dry-run by default; --apply saves a SQLite-consistent backup and vacuums.
import fs from 'node:fs';
import path from 'node:path';
import {backup} from 'node:sqlite';
const flags=process.argv.slice(2),apply=flags.includes('--apply');
const dbFlag=flags.find(x=>x.startsWith('--db='));
if(!dbFlag){console.error('Usage: node tools/compact-storage.mjs --db=/absolute/path/devshow.sqlite [--apply]');process.exit(2);}
const dbPath=path.resolve(dbFlag.slice(5));
if(!fs.existsSync(dbPath)){console.error('SQLite database does not exist:',dbPath);process.exit(2);}
process.env.DB_PATH=dbPath;
const {db,transaction,query,exec,one}=await import('../server/db.js');
const {packText,unpackText,STORAGE_PREFIX}=await import('../server/storage-codec.js');
const targets=[
  {table:'collaborative_documents',column:'content',limit:90000},
  {table:'collaborative_revisions',column:'content',limit:90000},
  {table:'desktop_sync',column:'payload',limit:12000}
];
let totalOld=0,totalNew=0,convert=0,skipped=0;
const candidates=[];
for(const target of targets){
  if(!one("SELECT name FROM sqlite_master WHERE type='table' AND name=?",target.table))continue;
  let cursor=0;
  while(true){
    const rows=query('SELECT rowid AS rid, '+target.column+' AS value FROM '+target.table+' WHERE rowid>? ORDER BY rowid LIMIT 200',cursor);
    if(!rows.length)break;
    for(const row of rows){
      cursor=row.rid;
      if(typeof row.value!=='string'){skipped++;continue;}
      try{
        if(row.value.startsWith(STORAGE_PREFIX)){unpackText(row.value,{maxBytes:target.limit});continue;}
        const packed=packText(row.value,{maxBytes:target.limit});
        const before=Buffer.byteLength(row.value),after=Buffer.byteLength(packed);
        if(after>=before)continue;
        candidates.push({table:target.table,column:target.column,rid:row.rid,value:packed});
        totalOld+=before;totalNew+=after;convert++;
      }catch(e){console.warn(target.table+' rowid='+row.rid+' skipped: '+e.message);skipped++;}
    }
  }
}
console.log((apply?'Applying':'Dry run')+': '+convert+' values compressible, '+skipped+' skipped; '+totalOld+' -> '+totalNew+' bytes.');
if(apply&&convert){
  const snapshot=dbPath+'.backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite';
  await backup(db,snapshot);
  console.log('Created consistent pre-migration backup:',snapshot);
  for(let i=0;i<candidates.length;i+=100)transaction(()=>{
    for(const row of candidates.slice(i,i+100))exec('UPDATE '+row.table+' SET '+row.column+'=? WHERE rowid=?',row.value,row.rid);
  });
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  db.exec('VACUUM');
  console.log('Compacted '+convert+' values. SQLite bytes: '+fs.statSync(dbPath).size);
}
db.close();
