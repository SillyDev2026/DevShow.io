import {query,one} from './db.js';
import {clean,validUrl,error,need} from './security.js';
export const CATEGORIES=['Web','AI & ML','Roblox','Open Source','Mobile','Games','Developer Tools'];
export const VISIBILITY=['public','unlisted','private'];
const BASE=`SELECT p.*,(SELECT COUNT(*) FROM likes l WHERE l.project_id=p.id) likes,(SELECT COUNT(*) FROM comments c WHERE c.project_id=p.id) comments FROM projects p`;
export const projectRow = p => ({id:p.id,creatorId:p.creator_id,title:p.title,tagline:p.tagline,description:p.description,category:p.category,tags:JSON.parse(p.tags||'[]'),repo:p.repo,website:p.website,cover:p.cover,visibility:p.visibility||'public',views:p.views||0,likes:p.likes||0,comments:p.comments||0,createdAt:p.created_at,updatedAt:p.updated_at});
export const projectRecord = id => one(`${BASE} WHERE p.id=?`,id);
export const permitted = (p,user) => {need(p&&(p.visibility!=='private'||p.creator_id===user?.id),404,'Project not found.');return p;};
export const communityAllowed = (p,user) => {permitted(p,user);need(p.visibility!=='private',403,'Private projects cannot receive community interactions.');};
export function projects({scope='public',owner='',q='',category='',sort='newest',limit=100}={}) {
  const where=[],args=[];
  if(scope==='mine'){where.push('p.creator_id=?');args.push(owner);}
  else{where.push("p.visibility='public'");if(scope==='profile'){where.push('p.creator_id=?');args.push(owner);}}
  if(category&&CATEGORIES.includes(category)){where.push('p.category=?');args.push(category);}
  if(q){where.push("(p.title LIKE ? ESCAPE '\\' OR p.tagline LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\' OR p.tags LIKE ? ESCAPE '\\')");const x=`%${clean(q,80).replaceAll('\\','\\\\').replaceAll('%','\\%').replaceAll('_','\\_')}%`;args.push(x,x,x,x);}
  const order=sort==='liked'?'likes DESC, p.created_at DESC':sort==='oldest'?'p.created_at ASC':sort==='popular'?'(p.views+likes*6) DESC,p.created_at DESC':'p.created_at DESC';
  return query(`${BASE} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ?`,...args,Math.max(1,Math.min(300,Number(limit)||100))).map(projectRow);
}
export function parseProject(d){
  const title=clean(d.title,70),tagline=clean(d.tagline,140),description=clean(d.description,3000),category=clean(d.category,50);
  need(title&&tagline&&description.length>=20&&CATEGORIES.includes(category),400,'Complete the title, tagline, description and category.');
  const visibility=clean(d.visibility||'public',20);need(VISIBILITY.includes(visibility),400,'Invalid visibility.');
  const tags=(Array.isArray(d.tags)?d.tags:String(d.tags||'').split(',')).map(x=>clean(x,30)).filter(Boolean);
  const repo=validUrl(d.repo),website=validUrl(d.website),cover=validUrl(d.cover);
  need((!d.repo||repo)&&(!d.website||website)&&(!d.cover||cover),400,'Use valid http(s) URLs.');
  return {title,tagline,description,category,visibility,tags:JSON.stringify([...new Set(tags)].slice(0,6)),repo,website,cover};
}
export function details(p){
  return {comments:query('SELECT c.id,c.body text,c.created_at createdAt,u.id userId,u.name,u.handle FROM comments c JOIN users u ON u.id=c.user_id WHERE c.project_id=? ORDER BY c.created_at DESC LIMIT 100',p.id),updates:query('SELECT id,title,body,version,created_at date FROM build_logs WHERE project_id=? ORDER BY created_at DESC LIMIT 100',p.id)};
}
