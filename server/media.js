import fs from 'node:fs';
import path from 'node:path';
import {one,exec,uuid} from './db.js';
import {clean,need,error,readJson} from './security.js';
import {projectRecord,permitted} from './projects.js';
const mediaRoot=path.join(path.dirname(process.env.DB_PATH||path.resolve('server/data/devshow.sqlite')),'media');
fs.mkdirSync(mediaRoot,{recursive:true});
const MAX_MEDIA=1024*1024;
function sniff(bytes){
  if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return ['image/png','.png'];
  if(bytes.length>=3&&bytes.subarray(0,3).equals(Buffer.from([255,216,255])))return ['image/jpeg','.jpg'];
  if(bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return ['image/webp','.webp'];
  throw error(415,'Upload PNG, JPEG, or WebP only.');
}
export async function uploadMedia(req,user){
  need(user,401,'Sign in required.');
  const d=await readJson(req,1_550_000);
  const kind=clean(d.kind,10);need(['avatar','banner','project'].includes(kind),400,'Invalid media kind.');
  let project=null;
  if(kind==='project'){
    project=permitted(projectRecord(clean(d.projectId,80)),user);
    need(project.creator_id===user.id,403,'Only the creator can upload project media.');
  }
  need(typeof d.base64==='string' && d.base64.length<=1_450_000&&/^[A-Za-z0-9+/]*={0,2}$/.test(d.base64),400,'Invalid image data.');
  const bytes=Buffer.from(d.base64,'base64');need(bytes.length>0 && bytes.length<=MAX_MEDIA,413,'Image must be 1 MB or smaller.');
  const [mime,ext]=sniff(bytes);const id=uuid();const filename=path.join(mediaRoot,id+ext);
  fs.writeFileSync(filename,bytes,{flag:'wx',mode:0o600});
  try{exec('INSERT INTO media_files(id,owner_id,project_id,kind,mime,size) VALUES(?,?,?,?,?,?)',id,user.id,project?.id||null,kind,mime,bytes.length);}
  catch(e){fs.unlinkSync(filename);throw e;}
  return {id,kind,mime,size:bytes.length,url:`/api/media/${id}`};
}
export function readMedia(req,res,id,user){
  const m=one('SELECT * FROM media_files WHERE id=?',id);
  if(!m)throw error(404,'Media not found.');
  if(m.kind==='project')permitted(projectRecord(m.project_id),user);
  const ext=({ 'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp' })[m.mime];
  const file=path.join(mediaRoot,id+ext);
  if(!fs.existsSync(file))throw error(404,'Media not found.');
  res.writeHead(200,{'Content-Type':m.mime,'Content-Length':m.size,'Cache-Control':m.kind==='project'?'private, no-store':'public, max-age=3600','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
}
export function mediaOwned(id,user,kind){
  if(!id)return '';
  need(one('SELECT 1 FROM media_files WHERE id=? AND owner_id=? AND kind=?',id,user.id,kind),400,`Upload your ${kind} image first.`);
  return id;
}
