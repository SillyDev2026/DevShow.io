import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db, one, query, exec, uuid, transaction } from './db.js';
import { githubMetadata } from './github.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 3000);
const ALLOWED = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,https://sillydev2026.github.io').split(',').map(x => x.trim()).filter(Boolean);
const LIMIT = 32_000;
const MIME = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.png':'image/png' };
const CATEGORIES = new Set(['Web','AI & ML','Roblox','Open Source','Mobile','Games','Developer Tools']);
const VISIBILITIES = new Set(['public','unlisted','private']);
const sessions = new Map();
const uid = () => uuid();
const clean = (value, max = 200) => String(value ?? '').trim().slice(0, max);
const urlValue = v => { const x = clean(v, 500); if (!x) return ''; try { const u = new URL(x); if (!['https:','http:'].includes(u.protocol)) return ''; return u.href; } catch { return ''; } };
const tokenHash = token => crypto.createHash('sha256').update(token).digest('hex');
const passwordHash = password => { const salt = crypto.randomBytes(16); const hash = crypto.scryptSync(password, salt, 64); return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`; };
const passwordMatch = (password, stored) => { const [,salt,hash] = String(stored).split(':'); if (!salt || !hash) return false; const current = crypto.scryptSync(password, Buffer.from(salt,'hex'), 64); const existing = Buffer.from(hash,'hex'); return existing.length === current.length && crypto.timingSafeEqual(current, existing); };
const apiUser = u => ({ id:u.id, handle:u.handle, name:u.name, role:u.role, bio:u.bio, github:u.github, website:u.website, color:u.color,location:u.location||'',skills:JSON.parse(u.skills||'[]'), avatar:u.name.split(/\s+/).map(x=>x[0]||'').join('').slice(0,2).toUpperCase(), createdAt:u.created_at, followers:Number(u.followers||0), pinnedProjectId:publicPin(u) });
const publicPin = user => user.pinned_project_id && one("SELECT 1 FROM projects WHERE id=? AND creator_id=? AND visibility='public'",user.pinned_project_id,user.id) ? user.pinned_project_id : '';
const userRow = id => one('SELECT * FROM users WHERE id=?', id);
function bearer(req) { const match = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || ''); if (!match) return null; const row = one('SELECT user_id FROM sessions WHERE hash=? AND expires_at>?',tokenHash(match[1]),Date.now()); return row ? userRow(row.user_id) : null; }
function newSession(user) { const token = crypto.randomBytes(32).toString('hex'); exec('INSERT INTO sessions(hash,user_id,expires_at) VALUES(?,?,?)',tokenHash(token),user.id,Date.now()+30*86400000); return { token, user:apiUser(user) }; }
function fail(status,message) { const e = new Error(message); e.status = status; throw e; }
function auth(user) { if (!user) fail(401,'Sign in to continue.'); return user; }
function json(res,status,body) { const payload = JSON.stringify(body); res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff' }); res.end(payload); }
function validProject(data) {
  const title = clean(data.title,70), tagline = clean(data.tagline,140), description = clean(data.description,3000), category = clean(data.category,50);
  if (!title || !tagline || description.length < 20 || !CATEGORIES.has(category)) fail(400,'Complete the project title, tagline, description and category.');
  const tags = Array.isArray(data.tags) ? data.tags : String(data.tags || '').split(',');
  const repo = urlValue(data.repo), website = urlValue(data.website), cover = urlValue(data.cover);
  const visibility = clean(data.visibility || 'public',20);
  if (!VISIBILITIES.has(visibility)) fail(400,'Invalid project visibility.');
  if ((data.repo && !repo) || (data.website && !website) || (data.cover && !cover)) fail(400,'Use valid http(s) URLs.');
  return { title, tagline, description, category, tags:JSON.stringify([...new Set(tags.map(t=>clean(t,30)).filter(Boolean))].slice(0,6)),repo, website, cover, visibility };
}
function projectRow(row) {return {id:row.id,creatorId:row.creator_id,title:row.title,tagline:row.tagline,description:row.description,category:row.category,tags:JSON.parse(row.tags||'[]'),repo:row.repo,website:row.website,cover:row.cover,visibility:row.visibility||'public',likes:Number(row.likes||0),views:row.views,comments:Number(row.comments||0),daysAgo:Math.max(0,Math.floor((Date.now()-Date.parse(row.created_at+'Z'))/86400000)),theme:'custom',featured:false,createdAt:row.created_at};}
const PROJECT_SELECT = `SELECT p.*, (SELECT COUNT(*) FROM likes l WHERE l.project_id=p.id) likes, (SELECT COUNT(*) FROM comments c WHERE c.project_id=p.id) comments FROM projects p`;
function projectList(scope='public', owner='', options={}) {
  const where=[],values=[];
  if(scope==='mine'){where.push('p.creator_id=?');values.push(owner);}
  else {where.push("p.visibility='public'");if(scope==='profile'){where.push('p.creator_id=?');values.push(owner);}}
  if(options.category && CATEGORIES.has(options.category)){where.push('p.category=?');values.push(options.category);}
  if(options.q){where.push('(p.title LIKE ? OR p.tagline LIKE ? OR p.description LIKE ? OR p.tags LIKE ?)');const q=`%${clean(options.q,80)}%`;values.push(q,q,q,q);}
  const order=options.sort==='liked'?'likes DESC, p.created_at DESC':options.sort==='oldest'?'p.created_at ASC':'p.created_at DESC';
  return query(`${PROJECT_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 500`,...values).map(projectRow);
}
function projectById(id) { const record=one(`${PROJECT_SELECT} WHERE p.id=?`,id);return record?projectRow(record):null; }
function checkVisible(project,user) {if (!project || (project.visibility==='private' && project.creator_id!==user?.id)) fail(404,'Project not found.');return project;}
function canInteract(project,user) {checkVisible(project,user);if(project.visibility==='private')fail(403,'Private projects cannot receive community interactions.');}
function bootstrap(user) {
  const people = query(`SELECT u.id,u.handle,u.name,u.role,u.bio,u.github,u.website,u.color,u.location,u.skills,u.pinned_project_id,u.pinned_project_id,u.created_at,(SELECT COUNT(*) FROM follows f WHERE f.followed_id=u.id) followers FROM users u ORDER BY u.created_at DESC LIMIT 500`).map(apiUser);
  const data = { projects:projectList(), myProjects:user?projectList('mine',user.id):[], creators:people, user:user?apiUser(user):null,liked:[],saved:[],following:[],boards:[],comments:{},updates:{},notifications:[] };
  if (user) {
    data.liked = query('SELECT project_id FROM likes WHERE user_id=?',user.id).map(r=>r.project_id);
    data.saved = query('SELECT project_id FROM bookmarks WHERE user_id=?',user.id).map(r=>r.project_id);
    data.following = query('SELECT followed_id FROM follows WHERE follower_id=?',user.id).map(r=>r.followed_id);
    data.boards = query('SELECT * FROM collections WHERE owner_id=? ORDER BY created_at DESC',user.id).map(b=>({ id:b.id,name:b.name,description:b.description,projects:query("SELECT cp.project_id FROM collection_projects cp JOIN projects p ON p.id=cp.project_id WHERE cp.collection_id=? AND (p.visibility!='private' OR p.creator_id=?)",b.id,user.id).map(p=>p.project_id) }));
    data.notifications = query(`SELECT n.*,u.name actor FROM notifications n JOIN users u ON u.id=n.actor_id WHERE n.user_id=? ORDER BY n.created_at DESC LIMIT 30`,user.id);
  }
  const visible = `JOIN projects p ON p.id = b.project_id WHERE (p.visibility='public' OR p.creator_id=?)`;
  for (const l of query(`SELECT b.project_id,b.title,b.body,b.version,b.created_at FROM build_logs b ${visible} ORDER BY b.created_at DESC LIMIT 1000`,user?.id||'')) (data.updates[l.project_id] ||= []).push({ title:l.title,body:l.body,version:l.version,date:l.created_at.slice(0,10) });
  for (const c of query(`SELECT c.project_id,c.body,u.name FROM comments c JOIN users u ON u.id=c.user_id JOIN projects p ON p.id=c.project_id WHERE (p.visibility='public' OR p.creator_id=?) ORDER BY c.created_at DESC LIMIT 1500`,user?.id||'')) (data.comments[c.project_id] ||= []).push({ name:c.name,text:c.body });
  return data;
}
function notify(actor,owner,kind,projectId='') { if (actor===owner) return; exec('INSERT INTO notifications(id,user_id,actor_id,kind,project_id) VALUES(?,?,?,?,?)',uid(),owner,actor,kind,projectId); }
function toggle(table, ownerKey, owner, itemKey, item) {
  const old=one(`SELECT 1 FROM ${table} WHERE ${ownerKey}=? AND ${itemKey}=?`,owner,item);
  if (old) exec(`DELETE FROM ${table} WHERE ${ownerKey}=? AND ${itemKey}=?`,owner,item);
  else exec(`INSERT INTO ${table}(${ownerKey},${itemKey}) VALUES(?,?)`,owner,item);
  return !old;
}
const rate = new Map();
function rateLimit(req,hard=false) {
  const ip = req.socket.remoteAddress || 'unknown'; const key = ip + ':' + (hard?'auth':'api'); const now=Date.now();
  const last=rate.get(key); const slot=last && last.reset > now ? last : { count:0,reset:now+60000 };
  slot.count++;rate.set(key,slot);if(slot.count>(hard?12:180))fail(429,'Too many requests. Try again shortly.');
  if(rate.size>20000)for(const [k,v] of rate)if(v.reset<now)rate.delete(k);
}
async function body(req) {
  if(!['POST','PATCH','PUT'].includes(req.method)) return {};
  if(!String(req.headers['content-type']||'').startsWith('application/json')) fail(415,'Expected application/json.');
  let contents=''; for await (const part of req) {contents+=part.toString('utf8');if(Buffer.byteLength(contents)>LIMIT)fail(413,'Request too large.');}
  try {const obj=JSON.parse(contents||'{}');if(!obj||typeof obj!=='object'||Array.isArray(obj))fail(400,'Expected JSON object.');return obj;}catch(e){if(e.status)throw e;fail(400,'Invalid JSON.');}
}
async function handleApi(req,res,url) {
  const method=req.method, route=url.pathname, user=bearer(req);
  if(method==='GET'&&route==='/api/health')return json(res,200,{ok:true,service:'DevShow API',version:'2.2.0'});
  if(method==='GET'&&route==='/api/bootstrap')return json(res,200,bootstrap(user));
  if(method==='GET'&&route==='/api/github/repository')return json(res,200,{repository:await githubMetadata(url.searchParams.get('url'))});
  if(method==='POST'&&route==='/api/auth/register') {rateLimit(req,true);const d=await body(req); const handle=clean(d.handle,24),name=clean(d.name,40),email=clean(d.email,254).toLowerCase(),password=String(d.password||'');if(!/^[A-Za-z0-9_-]{3,24}$/.test(handle)||!name||!/^\S+@\S+\.\S+$/.test(email)||password.length<10||password.length>128)fail(400,'Provide a name, username (3–24), valid email and password (10–128 characters).');if(one('SELECT id FROM users WHERE handle=? OR email=?',handle,email))fail(409,'Username or email is already in use.');const id=uid();try{exec('INSERT INTO users(id,email,handle,password_hash,name) VALUES(?,?,?,?,?)',id,email,handle,passwordHash(password),name);}catch(e){if(String(e.message).includes('UNIQUE'))fail(409,'Username or email is already in use.');throw e;}return json(res,201,newSession(userRow(id)));}
  if(method==='POST'&&route==='/api/auth/login'){rateLimit(req,true);const d=await body(req);const email=clean(d.email,254);const password=String(d.password||'');const candidate=one('SELECT * FROM users WHERE email=? OR handle=?',email,email);if(!candidate||!passwordMatch(password,candidate.password_hash))fail(401,'Invalid credentials.');return json(res,200,newSession(candidate));}
  if(method==='POST'&&route==='/api/auth/logout'){auth(user);const token=(req.headers.authorization||'').slice(7);exec('DELETE FROM sessions WHERE hash=?',tokenHash(token));return json(res,200,{ok:true});}
  if(method==='GET'&&route==='/api/me')return json(res,200,{user:apiUser(auth(user))});
  if(method==='GET'&&route==='/api/me/export'){
    const owner=auth(user);
    const projects=query('SELECT * FROM projects WHERE creator_id=? ORDER BY created_at DESC',owner.id);
    const projectIds=projects.map(p=>p.id);
    const data={format:'devshow-account-export',version:1,exportedAt:new Date().toISOString(),account:apiUser(owner),
      projects:projects.map(projectRow),
      buildLogs:query('SELECT b.* FROM build_logs b JOIN projects p ON p.id=b.project_id WHERE p.creator_id=?',owner.id),
      collections:query('SELECT * FROM collections WHERE owner_id=?',owner.id).map(c=>({id:c.id,name:c.name,description:c.description,projectIds:query('SELECT project_id FROM collection_projects WHERE collection_id=?',c.id).map(x=>x.project_id)})),
      bookmarks:query('SELECT project_id FROM bookmarks WHERE user_id=?',owner.id).map(x=>x.project_id),
      following:query('SELECT followed_id FROM follows WHERE follower_id=?',owner.id).map(x=>x.followed_id),
      comments:query('SELECT project_id,body,created_at FROM comments WHERE user_id=?',owner.id),
      liked:query('SELECT project_id FROM likes WHERE user_id=?',owner.id).map(x=>x.project_id)};
    return json(res,200,data);
  }
  if(method==='POST'&&route==='/api/me/password'){
    const owner=auth(user),d=await body(req);rateLimit(req,true);
    if(typeof d.currentPassword!=='string'||typeof d.newPassword!=='string'||d.newPassword.length<10||d.newPassword.length>128)fail(400,'Provide current and new passwords (new password: 10–128 characters).');
    if(!passwordMatch(d.currentPassword,owner.password_hash))fail(403,'Current password does not match.');
    exec('UPDATE users SET password_hash=? WHERE id=?',passwordHash(d.newPassword),owner.id);
    exec('DELETE FROM sessions WHERE user_id=?',owner.id);
    return json(res,200,{ok:true,reauthRequired:true});
  }
  if(method==='GET'&&route==='/api/stats')return json(res,200,{version:'2.2.0',developers:one('SELECT COUNT(*) count FROM users').count,projects:one("SELECT COUNT(*) count FROM projects WHERE visibility='public'").count,comments:one("SELECT COUNT(*) count FROM comments c JOIN projects p ON p.id=c.project_id WHERE p.visibility='public'").count,updates:one("SELECT COUNT(*) count FROM build_logs b JOIN projects p ON p.id=b.project_id WHERE p.visibility='public'").count});
  if(method==='PATCH'&&route==='/api/me'){auth(user);const d=await body(req);const name=clean(d.name,40),handle=clean(d.handle,24),role=clean(d.role,70),bio=clean(d.bio,300),github=urlValue(d.github),website=urlValue(d.website),color=clean(d.color,7),location=clean(d.location,80),pin=clean(d.pinnedProjectId,100),skills=JSON.stringify([...new Set((Array.isArray(d.skills)?d.skills:String(d.skills||'').split(',')).map(x=>clean(x,24)).filter(Boolean))].slice(0,10));if(!name||!/^[A-Za-z0-9_-]{3,24}$/.test(handle))fail(400,'Invalid name or username.');if((d.github&&!github)||(d.website&&!website)||(github&&!/^https:\/\/github\.com\//.test(github))|| !/^#[a-f\d]{6}$/i.test(color))fail(400,'Invalid profile links or color.');if(pin&&!one("SELECT 1 FROM projects WHERE id=? AND creator_id=? AND visibility='public'",pin,user.id))fail(400,'Only your own public projects can be pinned.');try{exec('UPDATE users SET name=?,handle=?,role=?,bio=?,github=?,website=?,color=?,location=?,skills=?,pinned_project_id=? WHERE id=?',name,handle,role,bio,github,website,color,location,skills,pin,user.id);}catch(e){if(String(e.message).includes('UNIQUE'))fail(409,'Username already taken.');throw e;}return json(res,200,{user:apiUser(userRow(user.id))});}
  if(method==='GET'&&route==='/api/users')return json(res,200,{users:query(`SELECT u.id,u.name,u.handle,u.role,u.bio,u.github,u.website,u.color,u.location,u.skills,u.created_at,(SELECT COUNT(*) FROM follows f WHERE f.followed_id=u.id) followers FROM users u ORDER BY followers DESC LIMIT 100`).map(apiUser)});
  if(method==='GET'&&route.startsWith('/api/users/')){const handle=decodeURIComponent(route.split('/')[3]||'');const target=one('SELECT * FROM users WHERE handle=?',handle);if(!target)fail(404,'Developer not found.');return json(res,200,{user:apiUser(target),projects:projectList('profile',target.id)});}
  if(method==='GET'&&route==='/api/projects')return json(res,200,{projects:projectList('public','',{q:url.searchParams.get('q')||'',category:url.searchParams.get('category')||'',sort:url.searchParams.get('sort')||''})});
  if(method==='POST'&&route==='/api/projects'){auth(user);const d=validProject(await body(req)),id=uid();exec('INSERT INTO projects(id,creator_id,title,tagline,description,category,tags,repo,website,cover,visibility) VALUES(?,?,?,?,?,?,?,?,?,?,?)',id,user.id,d.title,d.tagline,d.description,d.category,d.tags,d.repo,d.website,d.cover,d.visibility);return json(res,201,{project:projectById(id)});}
  const pMatch=route.match(/^\/api\/projects\/([\w-]+)$/);
  if(pMatch){
    const p=one('SELECT * FROM projects WHERE id=?',pMatch[1]);checkVisible(p,user);
    if(method==='GET'){
      if (p.visibility!=='private') exec('UPDATE projects SET views=views+1 WHERE id=?',p.id);
      return json(res,200,{project:projectById(p.id),creator:apiUser(userRow(p.creator_id)),comments:query('SELECT c.body text,u.name FROM comments c JOIN users u ON u.id=c.user_id WHERE c.project_id=? ORDER BY c.created_at DESC LIMIT 100',p.id),updates:query('SELECT title,body,version,created_at date FROM build_logs WHERE project_id=? ORDER BY created_at DESC LIMIT 100',p.id)});
    }
    if(method==='PATCH'){
      auth(user);if(p.creator_id!==user.id)fail(403,'You cannot edit this project.');
      const d=validProject(await body(req));
      exec("UPDATE projects SET title=?,tagline=?,description=?,category=?,tags=?,repo=?,website=?,cover=?,visibility=?,updated_at=datetime('now') WHERE id=?",d.title,d.tagline,d.description,d.category,d.tags,d.repo,d.website,d.cover,d.visibility,p.id);
      return json(res,200,{project:projectById(p.id)});
    }
    if(method==='DELETE'){auth(user);if(p.creator_id!==user.id)fail(403,'You cannot delete this project.');exec('DELETE FROM projects WHERE id=?',p.id);return json(res,200,{ok:true});}
  }
  const ghMatch=route.match(/^\/api\/projects\/([\w-]+)\/github$/);
  if(ghMatch&&method==='GET'){const p=one('SELECT * FROM projects WHERE id=?',ghMatch[1]);checkVisible(p,user);if(!p.repo)fail(404,'No repository linked.');return json(res,200,{repository:await githubMetadata(p.repo)});}
  const act=route.match(/^\/api\/projects\/([\w-]+)\/(like|bookmark|comments|logs)$/);
  if(act){
    const p=one('SELECT * FROM projects WHERE id=?',act[1]);checkVisible(p,user);
    if(method==='POST'&&act[2]==='like'){auth(user);canInteract(p,user);const enabled=toggle('likes','user_id',user.id,'project_id',p.id);if(enabled)notify(user.id,p.creator_id,'like',p.id);return json(res,200,{enabled});}
    if(method==='POST'&&act[2]==='bookmark'){auth(user);canInteract(p,user);return json(res,200,{enabled:toggle('bookmarks','user_id',user.id,'project_id',p.id)});}
    if(method==='POST'&&act[2]==='comments'){auth(user);canInteract(p,user);const d=await body(req);const text=clean(d.text,500);if(text.length<2)fail(400,'Comment must contain at least 2 characters.');exec('INSERT INTO comments(id,user_id,project_id,body) VALUES(?,?,?,?)',uid(),user.id,p.id,text);notify(user.id,p.creator_id,'comment',p.id);return json(res,201,{ok:true});}
    if(method==='POST'&&act[2]==='logs'){auth(user);if(p.creator_id!==user.id)fail(403,'Only the creator can add updates.');const d=await body(req),title=clean(d.title,90),text=clean(d.body,1600),version=clean(d.version,35);if(!title||text.length<10)fail(400,'A title and detailed update are required.');exec('INSERT INTO build_logs(id,project_id,title,body,version) VALUES(?,?,?,?,?)',uid(),p.id,title,text,version);return json(res,201,{ok:true});}
  }
  const follow=route.match(/^\/api\/users\/([\w-]+)\/follow$/);
  if(follow&&method==='POST'){auth(user);const target=userRow(follow[1]);if(!target)fail(404,'User not found.');if(target.id===user.id)fail(400,'Cannot follow yourself.');const enabled=toggle('follows','follower_id',user.id,'followed_id',target.id);if(enabled)notify(user.id,target.id,'follow');return json(res,200,{enabled});}
  if(route==='/api/collections'&&method==='POST'){auth(user);const d=await body(req),name=clean(d.name,50),description=clean(d.description,160);if(!name)fail(400,'Collection name required.');const id=uid();exec('INSERT INTO collections(id,owner_id,name,description) VALUES(?,?,?,?)',id,user.id,name,description);return json(res,201,{collection:{id,name,description,projects:[]}});}
  const coll=route.match(/^\/api\/collections\/([\w-]+)(?:\/(projects))?$/);
  if(coll){auth(user);const c=one('SELECT * FROM collections WHERE id=?',coll[1]);if(!c)fail(404,'Collection not found.');if(c.owner_id!==user.id)fail(403,'Not your collection.');if(method==='DELETE'&&!coll[2]){exec('DELETE FROM collections WHERE id=?',c.id);return json(res,200,{ok:true});}if(method==='POST'&&coll[2]==='projects'){const d=await body(req);const target=one('SELECT * FROM projects WHERE id=?',d.projectId);checkVisible(target,user);return json(res,200,{enabled:toggle('collection_projects','collection_id',c.id,'project_id',d.projectId)});}}
  if(route==='/api/notifications'&&method==='POST'){auth(user);exec('UPDATE notifications SET read=1 WHERE user_id=?',user.id);return json(res,200,{ok:true});}
  fail(404,'API route not found.');
}
const handler = async (req,res) => {
  const origin=req.headers.origin;
  if(origin&&ALLOWED.includes(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS');}
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  try {
    if(origin&&!ALLOWED.includes(origin))fail(403,'This website origin is not allowed by the API.');
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    rateLimit(req);
    const url=new URL(req.url, 'http://localhost');
    if(url.pathname==='/api'||url.pathname.startsWith('/api/'))return await handleApi(req,res,url);
    if(!['GET','HEAD'].includes(req.method))fail(405,'Method not allowed.');
    const requested=url.pathname==='/'?'/index.html':url.pathname;
    const local=path.resolve(ROOT,'.'+requested);
    if(!local.startsWith(ROOT+path.sep)||local.includes(`${path.sep}server${path.sep}`)||local.includes(`${path.sep}tests${path.sep}`)||local.includes(`${path.sep}docs${path.sep}`)||local.includes(`${path.sep}node_modules${path.sep}`)||local.includes(`${path.sep}.git`)||!MIME[path.extname(local)])fail(404,'File not found.');
    const data=fs.readFileSync(local);
    res.writeHead(200,{'Content-Type':MIME[path.extname(local)],'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
  } catch(error){ if(!res.headersSent)json(res,error.status||500,{error:error.status?error.message:'Internal server error.'}); else res.end(); if(!error.status)console.error(error); }
};
export const server=http.createServer(handler);
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))server.listen(PORT,'0.0.0.0',()=>console.log(`DevShow v2.2 server listening on http://localhost:${PORT} (database: ${process.env.DB_PATH||'server/data/devshow.sqlite'})`));
