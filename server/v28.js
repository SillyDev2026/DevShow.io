import {query,one,exec,uuid,transaction} from './db.js';
import {clean,need,readJson,requiredUser,validUrl} from './security.js';
import {CATEGORIES,projectRow,projectRecord,permitted} from './projects.js';

const ok = (send,data,status=200) => {send(status,data);return true;};
const idRoute = /^[a-f0-9-]{36}$/;
const options = ['newest','popular','liked','discussed'];
const own = (id,user) => {requiredUser(user);const p = projectRecord(id);need(p&&p.creator_id===user.id,404,'Project not found.');return p;};
const visible = (id,user) => permitted(projectRecord(id),user);
const blocked = (user,id) => !!user && !!one('SELECT 1 FROM user_blocks WHERE blocker_id=? AND blocked_id=?',user.id,id);
const workspace = id => {
  const w = one('SELECT * FROM project_workspaces WHERE project_id=?',id);
  return w?{status:w.dev_status,recruiting:!!w.recruiting,stack:JSON.parse(w.tech_stack),docsUrl:w.docs_url,supportUrl:w.support_url}:{status:'building',recruiting:false,stack:[],docsUrl:'',supportUrl:''};
};
const tasks = id => query('SELECT id,title,done,created_at createdAt FROM project_tasks WHERE project_id=? ORDER BY created_at DESC LIMIT 200',id).map(x=>({...x,done:!!x.done}));
const milestones = id => query("SELECT id,title,description,due_date dueDate,status FROM project_milestones WHERE project_id=? ORDER BY CASE WHEN due_date='' THEN 1 ELSE 0 END,due_date ASC,created_at DESC LIMIT 100",id);
const normalizeSearch = d => ({name:clean(d.name,65),query:clean(d.query,80),category:clean(d.category,40),tag:clean(d.tag,30),sort:clean(d.sort||'newest',20)});
const requireSort = sort => need(options.includes(sort),400,'Invalid sorting option.');
const validIsoDay = value => !value||(/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value);
export async function routeV28(req,url,send,rate,user){
  const path = url.pathname,method = req.method;
  if(method==='GET'&&path==='/api/v3/discover'){
    const q = clean(url.searchParams.get('q'),80),category = clean(url.searchParams.get('category'),40),tag = clean(url.searchParams.get('tag'),30),sort = clean(url.searchParams.get('sort')||'newest',20);
    const limit = Math.min(40,Math.max(1,Number(url.searchParams.get('limit'))||18)),offset = Math.min(10000,Math.max(0,Number(url.searchParams.get('offset'))||0));
    need(Number.isInteger(limit)&&Number.isInteger(offset),400,'Invalid paging parameters.');requireSort(sort);
    need(!category||CATEGORIES.includes(category),400,'Invalid category.');
    const where = ["p.visibility='public'"],args = [];
    if(user) {where.push('NOT EXISTS(SELECT 1 FROM user_blocks ub WHERE ub.blocker_id=? AND ub.blocked_id=p.creator_id)');args.push(user.id);}
    if(q){where.push('(p.title LIKE ? OR p.tagline LIKE ? OR p.description LIKE ?)');const text='%'+q.replaceAll('\\','\\\\').replaceAll('%','\\%').replaceAll('_','\\_')+'%';args.push(text,text,text);}
    if(category){where.push('p.category=?');args.push(category);}
    if(tag){where.push('EXISTS(SELECT 1 FROM json_each(p.tags) jt WHERE lower(jt.value)=lower(?))');args.push(tag);}
    const joined = where.join(' AND ');
    const rank = sort==='popular'?'(p.views+likes*5) DESC':sort==='liked'?'likes DESC':sort==='discussed'?'comments DESC':'p.created_at DESC';
    const base = `FROM projects p WHERE ${joined}`;
    const total = one(`SELECT COUNT(*) n ${base}`,...args).n;
    const rows = query(`SELECT p.*, (SELECT COUNT(*) FROM likes l WHERE l.project_id=p.id) likes,(SELECT COUNT(*) FROM comments c WHERE c.project_id=p.id) comments ${base} ORDER BY ${rank},p.created_at DESC,p.id LIMIT ? OFFSET ?`,...args,limit,offset).map(projectRow);
    return ok(send,{projects:rows,total,offset,limit,hasMore:offset+rows.length<total});
  }
  if(method==='GET'&&path==='/api/v3/tags'){
    const tags = query("SELECT jt.value tag,COUNT(*) count FROM projects p,json_each(p.tags) jt WHERE p.visibility='public' GROUP BY lower(jt.value) ORDER BY count DESC,tag ASC LIMIT 40");
    return ok(send,{tags});
  }
  if(method==='GET'&&path==='/api/v3/feed/following'){
    requiredUser(user);
    const rows = query(`SELECT p.*,(SELECT COUNT(*) FROM likes l WHERE l.project_id=p.id) likes,(SELECT COUNT(*) FROM comments c WHERE c.project_id=p.id) comments FROM projects p JOIN follows f ON f.followed_id=p.creator_id WHERE f.follower_id=? AND p.visibility='public' AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE b.blocker_id=? AND b.blocked_id=p.creator_id) ORDER BY p.created_at DESC LIMIT 80`,user.id,user.id).map(projectRow);
    return ok(send,{projects:rows});
  }
  if(path==='/api/v3/saved-searches'){
    requiredUser(user);
    if(method==='GET')return ok(send,{searches:query('SELECT id,name,query_text query,category,tag,sort,created_at createdAt FROM saved_searches WHERE user_id=? ORDER BY created_at DESC LIMIT 40',user.id)});
    if(method==='POST'){
      rate(req,'write');const d = normalizeSearch(await readJson(req));requireSort(d.sort);
      need(d.name.length>=2&&(!d.category||CATEGORIES.includes(d.category)),400,'Invalid search name or category.');
      need(one('SELECT COUNT(*) n FROM saved_searches WHERE user_id=?',user.id).n<40,409,'Search limit reached.');
      const id = uuid();exec('INSERT INTO saved_searches(id,user_id,name,query_text,category,tag,sort) VALUES(?,?,?,?,?,?,?)',id,user.id,d.name,d.query,d.category,d.tag,d.sort);
      return ok(send,{id},201);
    }
  }
  const saved = path.match(/^\/api\/v3\/saved-searches\/([a-f0-9-]{36})$/);
  if(saved&&method==='DELETE'){requiredUser(user);rate(req,'write');need(exec('DELETE FROM saved_searches WHERE id=? AND user_id=?',saved[1],user.id).changes,404,'Saved search not found.');return ok(send,{ok:true});}
  const base = path.match(/^\/api\/v3\/projects\/([a-f0-9-]{36})\/(workspace|tasks|milestones)$/);
  if(base){
    const projectId = base[1],resource = base[2];const p = method==='GET'?visible(projectId,user):own(projectId,user);
    if(resource==='workspace'){
      if(method==='GET')return ok(send,{workspace:workspace(projectId)});
      if(method==='PUT'){
        rate(req,'write');const d = await readJson(req),status = clean(d.status,20),stack = (Array.isArray(d.stack)?d.stack:[]).map(x=>clean(x,30)).filter(Boolean).slice(0,10);
        need(['planning','building','beta','launched','archived'].includes(status)&&typeof d.recruiting==='boolean',400,'Invalid project status.');
        need((!d.docsUrl||validUrl(d.docsUrl))&&(!d.supportUrl||validUrl(d.supportUrl)),400,'Invalid links.');
        exec(`INSERT INTO project_workspaces(project_id,dev_status,recruiting,tech_stack,docs_url,support_url) VALUES(?,?,?,?,?,?) ON CONFLICT(project_id) DO UPDATE SET dev_status=excluded.dev_status,recruiting=excluded.recruiting,tech_stack=excluded.tech_stack,docs_url=excluded.docs_url,support_url=excluded.support_url,updated_at=datetime('now')`,projectId,status,d.recruiting?1:0,JSON.stringify([...new Set(stack)]),validUrl(d.docsUrl),validUrl(d.supportUrl));
        return ok(send,{workspace:workspace(projectId)});
      }
    }
    if(resource==='tasks'){
      if(method==='GET'){need(p.creator_id===user?.id,404,'Project not found.');return ok(send,{tasks:tasks(projectId)});}
      if(method==='POST'){
        rate(req,'write');const d = await readJson(req),title = clean(d.title,120);
        need(title.length>=2&&one('SELECT COUNT(*) n FROM project_tasks WHERE project_id=?',projectId).n<200,400,'Invalid task or task limit reached.');
        const id = uuid();exec('INSERT INTO project_tasks(id,project_id,title) VALUES(?,?,?)',id,projectId,title);return ok(send,{id},201);
      }
    }
    if(resource==='milestones'){
      if(method==='GET')return ok(send,{milestones:milestones(projectId)});
      if(method==='POST'){
        rate(req,'write');const d = await readJson(req),title = clean(d.title,120),dueDate = clean(d.dueDate,10);
        need(title.length>=2&&one('SELECT COUNT(*) n FROM project_milestones WHERE project_id=?',projectId).n<100,400,'Invalid milestone or milestone limit reached.');
        need(validIsoDay(dueDate),400,'Invalid due date.');
        const id = uuid();exec('INSERT INTO project_milestones(id,project_id,title,description,due_date) VALUES(?,?,?,?,?)',id,projectId,title,clean(d.description,500),dueDate);return ok(send,{id},201);
      }
    }
  }
  const item = path.match(/^\/api\/v3\/projects\/([a-f0-9-]{36})\/(tasks|milestones)\/([a-f0-9-]{36})$/);
  if(item){const projectId = item[1],kind = item[2],itemId = item[3];own(projectId,user);rate(req,'write');
    const table = kind==='tasks'?'project_tasks':'project_milestones';const entry = one(`SELECT * FROM ${table} WHERE id=? AND project_id=?`,itemId,projectId);need(entry,404,'Item not found.');
    if(method==='DELETE'){exec(`DELETE FROM ${table} WHERE id=? AND project_id=?`,itemId,projectId);return ok(send,{ok:true});}
    if(method==='PATCH'){
      const d = await readJson(req);
      if(kind==='tasks'){need(typeof d.done==='boolean',400,'Expected done flag.');exec('UPDATE project_tasks SET done=? WHERE id=? AND project_id=?',d.done?1:0,itemId,projectId);return ok(send,{done:d.done});}
      need(['planned','in_progress','completed'].includes(d.status),400,'Invalid milestone status.');exec('UPDATE project_milestones SET status=? WHERE id=? AND project_id=?',d.status,itemId,projectId);return ok(send,{status:d.status});
    }
  }
  if(method==='GET'&&path==='/api/v3/studio/overview'){
    requiredUser(user);
    const summary = one(`SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN visibility='public' THEN 1 ELSE 0 END),0) publicProjects,COALESCE(SUM(views),0) views FROM projects WHERE creator_id=?`,user.id);
    const feedback = one('SELECT COUNT(*) n FROM feedback f JOIN projects p ON p.id=f.project_id WHERE p.creator_id=?',user.id).n;
    const outstanding = one('SELECT COUNT(*) n FROM project_tasks t JOIN projects p ON p.id=t.project_id WHERE p.creator_id=? AND t.done=0',user.id).n;
    const milestonesOpen = one("SELECT COUNT(*) n FROM project_milestones m JOIN projects p ON p.id=m.project_id WHERE p.creator_id=? AND m.status!='completed'",user.id).n;
    const followers = one('SELECT COUNT(*) n FROM follows WHERE followed_id=?',user.id).n;
    return ok(send,{overview:{...summary,feedback,outstanding,milestonesOpen,followers}});
  }
  if(method==='GET'&&path==='/api/v3/studio/export'){
    requiredUser(user);
    const ids = query('SELECT id FROM projects WHERE creator_id=?',user.id).map(x=>x.id);
    const result = ids.map(id=>({project:projectRow(projectRecord(id)),workspace:workspace(id),tasks:tasks(id),milestones:milestones(id)}));
    return ok(send,{format:'devshow-studio-v3',version:3,exportedAt:new Date().toISOString(),projects:result});
  }
  if(path==='/api/v3/me/blocks'){
    requiredUser(user);
    if(method==='GET')return ok(send,{blocks:query('SELECT u.id,u.handle,u.name FROM user_blocks b JOIN users u ON u.id=b.blocked_id WHERE b.blocker_id=? ORDER BY b.created_at DESC LIMIT 200',user.id)});
  }
  const block = path.match(/^\/api\/v3\/users\/([a-f0-9-]{36})\/block$/);
  if(block&&method==='POST'){
    requiredUser(user);rate(req,'write');need(user.id!==block[1],400,'Cannot block yourself.');need(one('SELECT id FROM users WHERE id=?',block[1]),404,'User not found.');
    const entry = one('SELECT 1 FROM user_blocks WHERE blocker_id=? AND blocked_id=?',user.id,block[1]);
    if(entry)exec('DELETE FROM user_blocks WHERE blocker_id=? AND blocked_id=?',user.id,block[1]);else exec('INSERT INTO user_blocks(blocker_id,blocked_id) VALUES(?,?)',user.id,block[1]);
    return ok(send,{blocked:!entry});
  }
  if(path==='/api/v3/reports'&&method==='POST'){
    requiredUser(user);rate(req,'write');const d = await readJson(req),kind = clean(d.kind,20),subjectId = clean(d.subjectId,80),reason = clean(d.reason,30),details = clean(d.details,500);
    need(['project','user'].includes(kind)&&idRoute.test(subjectId)&&['spam','abuse','scam','copyright','other'].includes(reason),400,'Invalid report.');
    if(kind==='project'){const p = visible(subjectId,user);need(p.creator_id!==user.id,400,'Cannot report your own project.');}
    else{need(subjectId!==user.id&&one('SELECT 1 FROM users WHERE id=?',subjectId),404,'Developer not found.');}
    const id = uuid();try{exec('INSERT INTO content_reports(id,reporter_id,kind,subject_id,reason,details) VALUES(?,?,?,?,?,?)',id,user.id,kind,subjectId,reason,details);}catch(e){if(e.message.includes('UNIQUE'))return ok(send,{reported:true,duplicate:true});throw e;}
    return ok(send,{reported:true,id},201);
  }
  const notification = path.match(/^\/api\/v3\/notifications\/([a-f0-9-]{36})\/read$/);
  if(notification&&method==='POST'){requiredUser(user);rate(req,'write');need(exec('UPDATE notifications SET read=1 WHERE id=? AND user_id=?',notification[1],user.id).changes,404,'Notification not found.');return ok(send,{ok:true});}
  if(path==='/api/v3/desktop/status'&&method==='GET')return ok(send,{version:'2.8.0',desktop:process.env.DEVSHOW_DESKTOP==='1',cloudConfigured:!!process.env.PUBLIC_BASE_URL,features:{localSaving:true,manualSync:true,automaticTwoWaySync:false},time:new Date().toISOString()});
  return false;
}
