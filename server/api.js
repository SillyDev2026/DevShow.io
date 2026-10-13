import { one,query,exec,uuid,transaction } from './db.js';
import {clean,validUrl,error,need,hashPassword,verifyPassword,getUser,requiredUser,startSession,endSession,readJson,publicUser,toggle,notify} from './security.js';
import {projectRow,projectRecord,projects,permitted,communityAllowed,parseProject} from './projects.js';
import {githubMetadata} from './github.js';
import {routeCommunity} from './community.js';
import {routeGitHub} from './github-v26.js';
import {uploadMedia,mediaOwned} from './media.js';
import {oauthStart,oauthExchange,githubLinked} from './oauth.js';

const profile = id => publicUser(one('SELECT * FROM users WHERE id=?',id));
const mine = user => projects({scope:'mine',owner:user.id,limit:300});
function bootstrap(user) {
  const creators=query('SELECT * FROM users ORDER BY created_at DESC LIMIT 200').map(publicUser);
  const data={version:'2.6.0',projects:projects({limit:150}),myProjects:user?mine(user):[],creators,user:user?publicUser(user):null,liked:[],saved:[],following:[],boards:[],comments:{},updates:{},notifications:[]};
  if(user){
    data.liked=query("SELECT l.project_id FROM likes l JOIN projects p ON p.id=l.project_id WHERE l.user_id=? AND (p.visibility!='private' OR p.creator_id=?)",user.id,user.id).map(x=>x.project_id);
    data.saved=query("SELECT b.project_id FROM bookmarks b JOIN projects p ON p.id=b.project_id WHERE b.user_id=? AND (p.visibility!='private' OR p.creator_id=?)",user.id,user.id).map(x=>x.project_id);
    data.following=query('SELECT followed_id FROM follows WHERE follower_id=?',user.id).map(x=>x.followed_id);
    data.boards=query('SELECT * FROM collections WHERE owner_id=? ORDER BY created_at DESC',user.id).map(b=>({id:b.id,name:b.name,description:b.description,projects:query("SELECT cp.project_id FROM collection_projects cp JOIN projects p ON p.id=cp.project_id WHERE cp.collection_id=? AND (p.visibility!='private' OR p.creator_id=?)",b.id,user.id).map(x=>x.project_id)}));
    data.notifications=query(`SELECT n.id,n.kind,n.project_id projectId,n.read,n.created_at createdAt,u.name actor FROM notifications n JOIN users u ON u.id=n.actor_id WHERE n.user_id=? AND (n.project_id IS NULL OR n.project_id='' OR EXISTS(SELECT 1 FROM projects p WHERE p.id=n.project_id AND (p.visibility!='private' OR p.creator_id=?))) ORDER BY n.created_at DESC LIMIT 60`,user.id,user.id);
  }
  const viewer=user?.id||'';
  for(const x of query("SELECT b.project_id,b.title,b.body,b.version,b.created_at FROM build_logs b JOIN projects p ON p.id=b.project_id WHERE p.visibility='public' OR p.creator_id=? ORDER BY b.created_at DESC LIMIT 400",viewer)) (data.updates[x.project_id]??=[]).push({title:x.title,body:x.body,version:x.version,date:x.created_at.slice(0,10)});
  for(const x of query("SELECT c.project_id,c.body,u.name FROM comments c JOIN users u ON u.id=c.user_id JOIN projects p ON p.id=c.project_id WHERE p.visibility='public' OR p.creator_id=? ORDER BY c.created_at DESC LIMIT 500",viewer)) (data.comments[x.project_id]??=[]).push({name:x.name,text:x.body});
  return data;
}
const ok=(send,data,status=200)=>send(status,data);
const matchRoute=(path,re)=>re.exec(path);
export async function routeApi(req,url,send,rate){
  const method=req.method,path=url.pathname,user=getUser(req);
  if(method==='GET'&&path==='/api/health')return ok(send,{ok:true,service:'DevShow API',version:'2.6.0'});
  if(method==='GET'&&path==='/api/auth/github/start'){rate(req,'auth');return ok(send,oauthStart(user));}
  if(method==='POST'&&path==='/api/auth/github/exchange'){rate(req,'auth');const d=await readJson(req);return ok(send,oauthExchange(d.ticket));}
  if(method==='POST'&&path==='/api/media'){rate(req,'write');return ok(send,{media:await uploadMedia(req,requiredUser(user))},201);}
  if(method==='GET'&&path==='/api/me/github-status'){requiredUser(user);return ok(send,{linked:githubLinked(user.id)});}
  if(method==='GET'&&path==='/api/bootstrap')return ok(send,bootstrap(user));
  if(method==='GET'&&path==='/api/stats')return ok(send,{version:'2.6.0',developers:one('SELECT COUNT(*) n FROM users').n,projects:one("SELECT COUNT(*) n FROM projects WHERE visibility='public'").n,comments:one("SELECT COUNT(*) n FROM comments c JOIN projects p ON p.id=c.project_id WHERE p.visibility='public'").n,updates:one("SELECT COUNT(*) n FROM build_logs b JOIN projects p ON p.id=b.project_id WHERE p.visibility='public'").n});
  if(method==='GET'&&path==='/api/github/repository'){rate(req,'github');return ok(send,{repository:await githubMetadata(url.searchParams.get('url'))});}
  if(method==='POST'&&path==='/api/auth/register'){
    rate(req,'auth');const d=await readJson(req),handle=clean(d.handle,24),name=clean(d.name,40),email=clean(d.email,254).toLowerCase(),password=String(d.password||'');
    need(/^[a-zA-Z0-9_-]{3,24}$/.test(handle)&&name&&/^\S+@\S+\.\S+$/.test(email)&&password.length>=10&&password.length<=128,400,'Provide a name, username (3–24), email, and password (10–128 characters).');
    const id=uuid();try{exec('INSERT INTO users(id,email,handle,password_hash,name) VALUES(?,?,?,?,?)',id,email,handle,hashPassword(password),name);}catch(e){if(e.message.includes('UNIQUE'))throw error(409,'Username or email already in use.');throw e;}
    return ok(send,{...startSession({id}),user:profile(id)},201);
  }
  if(method==='POST'&&path==='/api/auth/login'){
    rate(req,'auth');const d=await readJson(req),identity=clean(d.email,254),candidate=one('SELECT * FROM users WHERE email=? OR handle=?',identity,identity);
    need(candidate&&verifyPassword(String(d.password||''),candidate.password_hash),401,'Invalid credentials.');
    return ok(send,{...startSession(candidate),user:publicUser(candidate)});
  }
  if(method==='POST'&&path==='/api/auth/logout'){requiredUser(user);endSession(req);return ok(send,{ok:true});}
  if(method==='GET'&&path==='/api/me')return ok(send,{user:publicUser(requiredUser(user))});
  if(method==='POST'&&path==='/api/me/password'){
    requiredUser(user);rate(req,'auth');const d=await readJson(req);need(typeof d.newPassword==='string'&&d.newPassword.length>=10&&d.newPassword.length<=128,400,'New password must contain 10–128 characters.');
    need(verifyPassword(String(d.currentPassword||''),user.password_hash),403,'Current password does not match.');
    transaction(()=>{exec('UPDATE users SET password_hash=? WHERE id=?',hashPassword(d.newPassword),user.id);exec('DELETE FROM sessions WHERE user_id=?',user.id);});
    return ok(send,{ok:true,reauthRequired:true});
  }
  if(method==='GET'&&path==='/api/me/export'){
    requiredUser(user);const owner=user.id;
    return ok(send,{format:'devshow-account-export',version:2,exportedAt:new Date().toISOString(),account:publicUser(user),projects:mine(user),buildLogs:query('SELECT b.* FROM build_logs b JOIN projects p ON p.id=b.project_id WHERE p.creator_id=?',owner),collections:query('SELECT * FROM collections WHERE owner_id=?',owner).map(c=>({id:c.id,name:c.name,description:c.description,projectIds:query('SELECT project_id FROM collection_projects WHERE collection_id=?',c.id).map(x=>x.project_id)})),bookmarks:query('SELECT project_id FROM bookmarks WHERE user_id=?',owner).map(x=>x.project_id),following:query('SELECT followed_id FROM follows WHERE follower_id=?',owner).map(x=>x.followed_id),comments:query('SELECT project_id,body,created_at FROM comments WHERE user_id=?',owner),liked:query('SELECT project_id FROM likes WHERE user_id=?',owner).map(x=>x.project_id)});
  }
  if(method==='PATCH'&&path==='/api/me'){
    requiredUser(user);const d=await readJson(req),name=clean(d.name,40),handle=clean(d.handle,24),role=clean(d.role,70),bio=clean(d.bio,300),location=clean(d.location,80),color=clean(d.color||'#b4ffa6',7),github=validUrl(d.github),website=validUrl(d.website),pin=clean(d.pinnedProjectId,100);
    const skills=JSON.stringify([...new Set((Array.isArray(d.skills)?d.skills:String(d.skills||'').split(',')).map(s=>clean(s,24)).filter(Boolean))].slice(0,10));
    const avatarId=mediaOwned(clean(d.avatarId,80),user,'avatar'),bannerId=mediaOwned(clean(d.bannerId,80),user,'banner');
    const theme=clean(d.theme||'dark',20),portfolioLayout=clean(d.portfolioLayout||'grid',20),status=clean(d.status||'building',30);
    need(['dark','light','mint','violet'].includes(theme)&&['grid','list','featured'].includes(portfolioLayout)&&['building','collaborating','available'].includes(status),400,'Invalid profile layout or status.');
    need(name&&/^[a-zA-Z0-9_-]{3,24}$/.test(handle),400,'Invalid profile name or handle.');
    need(/^#[0-9a-f]{6}$/i.test(color)&&(!d.github||github)&&(!d.website||website)&&(!github||new URL(github).hostname==='github.com'),400,'Invalid profile links or color.');
    if(pin)need(one("SELECT 1 FROM projects WHERE id=? AND creator_id=? AND visibility='public'",pin,user.id),400,'Pin one of your public projects.');
    try{exec('UPDATE users SET name=?,handle=?,role=?,bio=?,github=?,website=?,color=?,location=?,skills=?,pinned_project_id=?,avatar_media_id=?,banner_media_id=?,profile_theme=?,portfolio_layout=?,status=? WHERE id=?',name,handle,role,bio,github,website,color,location,skills,pin,avatarId,bannerId,theme,portfolioLayout,status,user.id);}catch(e){if(e.message.includes('UNIQUE'))throw error(409,'Username already taken.');throw e;}
    return ok(send,{user:profile(user.id)});
  }
  if(method==='GET'&&path==='/api/users')return ok(send,{users:query(`SELECT * FROM users ORDER BY created_at DESC LIMIT 200`).map(publicUser)});
  const followed=matchRoute(path,/^\/api\/users\/([\w-]+)\/follow$/);
  if(followed&&method==='POST'){
    requiredUser(user);const target=one('SELECT * FROM users WHERE id=?',followed[1]);need(target,404,'Developer not found.');need(target.id!==user.id,400,'Cannot follow yourself.');
    const enabled=toggle('follows','follower_id',user.id,'followed_id',target.id);if(enabled)notify(user.id,target.id,'follow');return ok(send,{enabled});
  }
  const userRoute=matchRoute(path,/^\/api\/users\/([a-zA-Z0-9_-]{3,24})$/);
  if(userRoute&&method==='GET'){
    const target=one('SELECT * FROM users WHERE handle=?',userRoute[1]);need(target,404,'Developer not found.');return ok(send,{user:publicUser(target),projects:projects({scope:'profile',owner:target.id})});
  }
  if(method==='GET'&&path==='/api/projects')return ok(send,{projects:projects({q:url.searchParams.get('q'),category:url.searchParams.get('category'),sort:url.searchParams.get('sort')})});
  if(method==='POST'&&path==='/api/projects'){
    requiredUser(user);const d=parseProject(await readJson(req)),id=uuid();exec('INSERT INTO projects(id,creator_id,title,tagline,description,category,tags,repo,website,cover,visibility) VALUES(?,?,?,?,?,?,?,?,?,?,?)',id,user.id,d.title,d.tagline,d.description,d.category,d.tags,d.repo,d.website,d.cover,d.visibility);return ok(send,{project:projectRow(projectRecord(id))},201);
  }
  const projectRoute=matchRoute(path,/^\/api\/projects\/([\w-]+)$/);
  if(projectRoute){
    const project=permitted(projectRecord(projectRoute[1]),user);
    if(method==='GET'){
      if(project.visibility!=='private'){exec('UPDATE projects SET views=views+1 WHERE id=?',project.id);exec("INSERT INTO views_daily(project_id,day,count) VALUES(?,date('now'),1) ON CONFLICT(project_id,day) DO UPDATE SET count=count+1",project.id);}
      const {details}=await import('./projects.js');return ok(send,{project:projectRow(projectRecord(project.id)),creator:profile(project.creator_id),...details(project)});
    }
    if(method==='PATCH'){
      requiredUser(user);need(project.creator_id===user.id,403,'Not your project.');const d=parseProject(await readJson(req));
      transaction(()=>{
        exec("UPDATE projects SET title=?,tagline=?,description=?,category=?,tags=?,repo=?,website=?,cover=?,visibility=?,updated_at=datetime('now') WHERE id=?",d.title,d.tagline,d.description,d.category,d.tags,d.repo,d.website,d.cover,d.visibility,project.id);
        if(d.visibility!=='public')exec('UPDATE users SET pinned_project_id=\'\' WHERE pinned_project_id=?',project.id);
      });return ok(send,{project:projectRow(projectRecord(project.id))});
    }
    if(method==='DELETE'){requiredUser(user);need(project.creator_id===user.id,403,'Not your project.');exec('DELETE FROM projects WHERE id=?',project.id);return ok(send,{ok:true});}
  }
  const gh=matchRoute(path,/^\/api\/projects\/([\w-]+)\/github$/);
  if(gh&&method==='GET'){const project=permitted(projectRecord(gh[1]),user);need(project.repo,404,'No repository linked.');rate(req,'github');return ok(send,{repository:await githubMetadata(project.repo)});}
  const action=matchRoute(path,/^\/api\/projects\/([\w-]+)\/(like|bookmark|comments|logs)$/);
  if(action&&method==='POST'){
    const project=permitted(projectRecord(action[1]),user);requiredUser(user);
    if(action[2]==='like'){communityAllowed(project,user);const enabled=toggle('likes','user_id',user.id,'project_id',project.id);if(enabled)notify(user.id,project.creator_id,'like',project.id);return ok(send,{enabled});}
    if(action[2]==='bookmark'){communityAllowed(project,user);return ok(send,{enabled:toggle('bookmarks','user_id',user.id,'project_id',project.id)});}
    const d=await readJson(req);
    if(action[2]==='comments'){
      communityAllowed(project,user);const msg=clean(d.text,500);need(msg.length>=2,400,'Comments must contain at least 2 characters.');const id=uuid();exec('INSERT INTO comments(id,user_id,project_id,body) VALUES(?,?,?,?)',id,user.id,project.id,msg);notify(user.id,project.creator_id,'comment',project.id);return ok(send,{id},201);
    }
    if(action[2]==='logs'){
      need(project.creator_id===user.id,403,'Only the creator can add updates.');const title=clean(d.title,90),body=clean(d.body,1600),version=clean(d.version,35);need(title&&body.length>=10,400,'Add an update title and description.');const id=uuid();exec('INSERT INTO build_logs(id,project_id,title,body,version) VALUES(?,?,?,?,?)',id,project.id,title,body,version);return ok(send,{id},201);
    }
  }
  if(path==='/api/collections'&&method==='POST'){
    requiredUser(user);const d=await readJson(req),name=clean(d.name,50),description=clean(d.description,160);need(name,400,'Collection name required.');const id=uuid();exec('INSERT INTO collections(id,owner_id,name,description) VALUES(?,?,?,?)',id,user.id,name,description);return ok(send,{collection:{id,name,description,projects:[]}},201);
  }
  const collection=matchRoute(path,/^\/api\/collections\/([\w-]+)(?:\/(projects))?$/);
  if(collection){
    requiredUser(user);const c=one('SELECT * FROM collections WHERE id=?',collection[1]);need(c,404,'Collection not found.');need(c.owner_id===user.id,403,'Not your collection.');
    if(method==='DELETE'&&!collection[2]){exec('DELETE FROM collections WHERE id=?',c.id);return ok(send,{ok:true});}
    if(method==='POST'&&collection[2]){const d=await readJson(req),p=permitted(projectRecord(d.projectId),user);return ok(send,{enabled:toggle('collection_projects','collection_id',c.id,'project_id',p.id)});}
  }
  if(method==='POST'&&path==='/api/notifications'){requiredUser(user);exec('UPDATE notifications SET read=1 WHERE user_id=?',user.id);return ok(send,{ok:true});}
  if(await routeGitHub({req,url,send,rate,user}))return;
  if(await routeCommunity(req,url,send,rate,user))return;
  throw error(404,'API route not found.');
}
