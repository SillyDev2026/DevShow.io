import {query,one,exec,uuid,transaction} from './db.js';
import {clean,need,error,readJson,requiredUser,validUrl} from './security.js';
import {projectRecord,permitted} from './projects.js';
import {publish} from './live.js';

const ok=(send,data,status=200)=>{send(status,data);return true;};
const uid='([a-f0-9-]{36})';
const dateValid=d=>typeof d==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d)?(?:\.\d{1,3})?Z$/.test(d)&&!Number.isNaN(Date.parse(d));
const projectFor=(id,user)=>permitted(projectRecord(id),user);
const own=(p,user)=>{requiredUser(user);need(p.creator_id===user.id,403,'Only the project owner can change this.');};
const safeWidgets=['projects','activity','notifications','teams','launches','reputation'];
const selfTeams=user=>query(`SELECT t.id,t.name,t.description,t.owner_id ownerId,m.role,m.state,(SELECT COUNT(*) FROM dev_team_members x WHERE x.team_id=t.id AND x.state='active') members FROM dev_teams t JOIN dev_team_members m ON m.team_id=t.id WHERE m.user_id=? ORDER BY t.created_at DESC`,user.id);
const teamDetails=id=>query(`SELECT m.user_id userId,m.role,m.state,u.name,u.handle FROM dev_team_members m JOIN users u ON u.id=m.user_id WHERE m.team_id=? ORDER BY m.state,m.role,u.handle`,id);
const reputation=id=>{
  const published=one("SELECT COUNT(*) n FROM projects WHERE creator_id=? AND visibility='public'",id)?.n||0;
  const accepted=one("SELECT COUNT(*) n FROM feedback f JOIN projects p ON p.id=f.project_id WHERE f.user_id=? AND p.visibility='public' AND f.status IN ('accepted','completed')",id)?.n||0;
  const stars=one("SELECT COUNT(*) n FROM likes l JOIN projects p ON p.id=l.project_id WHERE p.creator_id=? AND p.visibility='public'",id)?.n||0;
  const contributions=one("SELECT COUNT(*) n FROM dev_team_members WHERE user_id=? AND state='active'",id)?.n||0;
  const points=published*30+accepted*12+Math.min(stars,500)*2+Math.min(contributions,50)*5;
  return {published,accepted,stars,contributions,points,level:Math.floor(Math.sqrt(points/25))+1};
};
const feedbackList=(projectId,user)=>query(`SELECT f.id,f.body,f.status,f.created_at createdAt,u.handle,u.id userId,(SELECT COUNT(*) FROM feedback_votes v WHERE v.feedback_id=f.id) votes FROM feedback f JOIN users u ON u.id=f.user_id WHERE f.project_id=? ORDER BY votes DESC,f.created_at DESC LIMIT 150`,projectId).map(f=>({...f,voted:!!user&&!!one('SELECT 1 FROM feedback_votes WHERE feedback_id=? AND user_id=?',f.id,user.id)}));
function teamAccess(team,user){requiredUser(user);need(team,404,'Team not found.');const member=one('SELECT * FROM dev_team_members WHERE team_id=? AND user_id=?',team.id,user.id);need(member,404,'Team not found.');return member;}
const activityRows=()=>query(`SELECT 'release' kind,b.id,b.project_id projectId,p.title projectTitle,b.title title,b.created_at createdAt FROM build_logs b JOIN projects p ON p.id=b.project_id WHERE p.visibility='public' UNION ALL SELECT 'project' kind,p.id,p.id projectId,p.title projectTitle,'Project published' title,p.created_at createdAt FROM projects p WHERE p.visibility='public' ORDER BY createdAt DESC LIMIT 75`);
export async function routeV27(req,url,send,rate,user){
  const path=url.pathname,method=req.method;
  if(method==='GET'&&path==='/api/v2/activity')return ok(send,{items:activityRows()});
  if(method==='GET'&&path==='/api/v2/reputation'){
    const count=Math.min(50,Math.max(1,Number(url.searchParams.get('limit')||20)||20));
    const rows=query('SELECT id,handle,name,color FROM users ORDER BY created_at DESC LIMIT 1000').map(u=>({...u,...reputation(u.id)})).sort((a,b)=>b.points-a.points||a.handle.localeCompare(b.handle));
    return ok(send,{leaders:rows.slice(0,count)});
  }
  const userRep=path.match(/^\/api\/v2\/reputation\/([a-f0-9-]{36})$/);
  if(userRep&&method==='GET'){need(one('SELECT 1 FROM users WHERE id=?',userRep[1]),404,'Developer not found.');return ok(send,{reputation:reputation(userRep[1])});}
  if(method==='GET'&&path==='/api/v2/launches'){
    return ok(send,{launches:query(`SELECT l.id,l.project_id projectId,l.title,l.description,replace(l.scheduled_at,' ','T')||'Z' scheduledAt,p.title projectTitle,u.handle FROM project_launches l JOIN projects p ON p.id=l.project_id JOIN users u ON u.id=p.creator_id WHERE p.visibility='public' AND l.scheduled_at>=datetime('now','-1 day') ORDER BY l.scheduled_at ASC LIMIT 75`)});
  }
  if(path==='/api/v2/dashboard'){
    requiredUser(user);
    if(method==='GET'){const row=one('SELECT * FROM dashboard_preferences WHERE user_id=?',user.id);return ok(send,{widgets:row?JSON.parse(row.layout):['projects','activity','notifications']});}
    if(method==='PUT'){
      rate(req,'write');const d=await readJson(req);need(Array.isArray(d.widgets)&&d.widgets.length>=1&&d.widgets.length<=6&&d.widgets.every(x=>safeWidgets.includes(x))&&new Set(d.widgets).size===d.widgets.length,400,'Invalid dashboard widgets.');
      exec("INSERT INTO dashboard_preferences(user_id,layout) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET layout=excluded.layout,updated_at=datetime('now')",user.id,JSON.stringify(d.widgets));return ok(send,{widgets:d.widgets});
    }
  }
  if(path==='/api/v2/notifications/preferences'){
    requiredUser(user);
    if(method==='GET'){const r=one('SELECT settings FROM notification_preferences WHERE user_id=?',user.id);return ok(send,{preferences:r?JSON.parse(r.settings):{messages:true,follows:true,projects:true,feedback:true}});}
    if(method==='PUT'){rate(req,'write');const d=await readJson(req);const settings={};for(const k of ['messages','follows','projects','feedback']){need(typeof d[k]==='boolean',400,`Invalid preference ${k}.`);settings[k]=d[k];}exec("INSERT INTO notification_preferences(user_id,settings) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET settings=excluded.settings,updated_at=datetime('now')",user.id,JSON.stringify(settings));return ok(send,{preferences:settings});}
  }
  if(path==='/api/v2/sync'){
    requiredUser(user);
    if(method==='GET'){const r=one('SELECT revision,payload,updated_at updatedAt FROM desktop_sync WHERE user_id=?',user.id);return ok(send,r?{revision:r.revision,data:JSON.parse(r.payload),updatedAt:r.updatedAt}:{revision:0,data:{},updatedAt:null});}
    if(method==='PUT'){
      rate(req,'write');const d=await readJson(req,16384);
      need(Number.isSafeInteger(d.revision)&&d.revision>=0,400,'Supply current revision.');need(d.data&&typeof d.data==='object'&&!Array.isArray(d.data),400,'Invalid sync data.');
      const allowed=['drafts','notes','preferences'];need(Object.keys(d.data).every(k=>allowed.includes(k)),400,'Only drafts, notes and preferences can be synced.');
      const raw=JSON.stringify(d.data);need(raw.length<=12000,413,'Sync data too large.');
      const existing=one('SELECT revision FROM desktop_sync WHERE user_id=?',user.id);const revision=existing?.revision||0;
      need(revision===d.revision,409,`Sync conflict: server revision is ${revision}. Download the newer copy before uploading.`);
      exec("INSERT INTO desktop_sync(user_id,revision,payload) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,updated_at=datetime('now')",user.id,revision+1,raw);return ok(send,{revision:revision+1});
    }
  }
  if(path==='/api/v2/teams'){
    if(method==='GET'){requiredUser(user);return ok(send,{teams:selfTeams(user)});}
    if(method==='POST'){
      requiredUser(user);rate(req,'write');const d=await readJson(req),name=clean(d.name,65),description=clean(d.description,320);
      need(name.length>=3,400,'Team name too short.');const id=uuid();transaction(()=>{exec('INSERT INTO dev_teams(id,owner_id,name,description) VALUES(?,?,?,?)',id,user.id,name,description);exec("INSERT INTO dev_team_members(team_id,user_id,role,state) VALUES(?,?,'owner','active')",id,user.id);});return ok(send,{id},201);
    }
  }
  const team=path.match(/^\/api\/v2\/teams\/([a-f0-9-]{36})(?:\/(invite|members|projects))?$/);
  if(team){const t=one('SELECT * FROM dev_teams WHERE id=?',team[1]);const m=teamAccess(t,user);
    if(method==='GET'&&!team[2]){return ok(send,{team:{id:t.id,name:t.name,description:t.description,ownerId:t.owner_id},members:teamDetails(t.id),projects:query('SELECT p.id,p.title,p.visibility FROM dev_team_projects x JOIN projects p ON p.id=x.project_id WHERE x.team_id=? AND (p.visibility!=\'private\' OR p.creator_id=?)',t.id,user.id)});}
    if(method==='POST'&&team[2]==='invite'){
      rate(req,'write');need(m.state==='active'&&['owner','maintainer'].includes(m.role),403,'Only team managers can invite.');const d=await readJson(req),target=one('SELECT id FROM users WHERE handle=?',clean(d.handle,24));need(target,404,'User not found.');need(['contributor','maintainer'].includes(d.role),400,'Invalid role.');need(target.id!==t.owner_id,400,'Owner already belongs to the team.');need(!one("SELECT 1 FROM dev_team_members WHERE team_id=? AND user_id=? AND state='active'",t.id,target.id),409,'Developer is already a team member.');
      exec("INSERT INTO dev_team_members(team_id,user_id,role,state) VALUES(?,?,?,'pending') ON CONFLICT(team_id,user_id) DO UPDATE SET role=excluded.role,state='pending'",t.id,target.id,d.role);return ok(send,{invited:true});
    }
    if(method==='POST'&&team[2]==='members'){
      rate(req,'write');const d=await readJson(req);need(d.action==='accept'||d.action==='decline'||d.action==='remove',400,'Invalid membership action.');
      const target=d.action==='remove'?clean(d.userId,80):user.id;const existing=one('SELECT * FROM dev_team_members WHERE team_id=? AND user_id=?',t.id,target);need(existing,404,'Membership missing.');
      if(d.action==='remove'){need(m.role==='owner'||(target===user.id&&m.role!=='owner'),403,'Only owner can remove others.');need(target!==t.owner_id,403,'Team owner cannot leave.');exec('DELETE FROM dev_team_members WHERE team_id=? AND user_id=?',t.id,target);}
      else{need(target===user.id&&existing.state==='pending',403,'No pending invite.');if(d.action==='accept')exec("UPDATE dev_team_members SET state='active' WHERE team_id=? AND user_id=?",t.id,user.id);else exec('DELETE FROM dev_team_members WHERE team_id=? AND user_id=?',t.id,user.id);}
      return ok(send,{ok:true});
    }
    if(method==='POST'&&team[2]==='projects'){
      rate(req,'write');need(m.state==='active'&&m.role==='owner',403,'Only team owner can link a project.');const d=await readJson(req),p=projectFor(clean(d.projectId,80),user);need(p.creator_id===user.id,403,'Only projects you own can be linked.');
      if(d.remove)exec('DELETE FROM dev_team_projects WHERE team_id=? AND project_id=?',t.id,p.id);else exec('INSERT OR IGNORE INTO dev_team_projects(team_id,project_id) VALUES(?,?)',t.id,p.id);return ok(send,{ok:true});
    }
  }
  const demonstration=path.match(/^\/api\/v2\/projects\/([a-f0-9-]{36})\/demo$/);
  if(demonstration){const p=projectFor(demonstration[1],user);
    if(method==='GET')return ok(send,{url:one('SELECT url FROM project_demos WHERE project_id=?',p.id)?.url||''});
    if(method==='PUT'){own(p,user);rate(req,'write');const d=await readJson(req),uri=validUrl(d.url);need(!d.url||(uri.startsWith('https://')&&!new URL(uri).username),400,'Use an HTTPS demo URL.');
      if(!d.url)exec('DELETE FROM project_demos WHERE project_id=?',p.id);else exec("INSERT INTO project_demos(project_id,url) VALUES(?,?) ON CONFLICT(project_id) DO UPDATE SET url=excluded.url,updated_at=datetime('now')",p.id,uri);return ok(send,{url:uri});}
  }
  const feedback=path.match(/^\/api\/v2\/projects\/([a-f0-9-]{36})\/suggestions(?:\/([a-f0-9-]{36})\/vote)?$/);
  if(feedback){const p=projectFor(feedback[1],user);
    if(method==='GET'&&!feedback[2])return ok(send,{items:feedbackList(p.id,user)});
    if(method==='POST'&&feedback[2]){requiredUser(user);rate(req,'write');need(p.visibility==='public',403,'Votes require a public project.');need(one('SELECT 1 FROM feedback WHERE id=? AND project_id=?',feedback[2],p.id),404,'Suggestion missing.');
      const old=one('SELECT 1 FROM feedback_votes WHERE feedback_id=? AND user_id=?',feedback[2],user.id);if(old)exec('DELETE FROM feedback_votes WHERE feedback_id=? AND user_id=?',feedback[2],user.id);else exec('INSERT INTO feedback_votes(feedback_id,user_id) VALUES(?,?)',feedback[2],user.id);return ok(send,{voted:!old});}
  }
  const launches=path.match(/^\/api\/v2\/projects\/([a-f0-9-]{36})\/launches(?:\/([a-f0-9-]{36}))?$/);
  if(launches){const p=projectFor(launches[1],user);
    if(method==='GET'&&!launches[2])return ok(send,{launches:query(`SELECT id,title,description,replace(scheduled_at,' ','T')||'Z' scheduledAt FROM project_launches WHERE project_id=? ORDER BY scheduled_at ASC`,p.id)});
    if(method==='POST'&&!launches[2]){
      own(p,user);rate(req,'write');const d=await readJson(req),title=clean(d.title,90),description=clean(d.description,500),scheduled=String(d.scheduledAt||'');need(title.length>=3&&dateValid(scheduled),400,'Supply a title and UTC ISO date.');need(Date.parse(scheduled)>Date.now()&&Date.parse(scheduled)<Date.now()+366*86400000,400,'Choose a future date within 12 months.');
      const id=uuid();exec('INSERT INTO project_launches(id,project_id,title,description,scheduled_at) VALUES(?,?,?,?,?)',id,p.id,title,description,new Date(scheduled).toISOString().replace('T',' ').replace(/\.\d{3}Z$/,'').replace('Z',''));return ok(send,{id},201);
    }
    if(method==='DELETE'&&launches[2]){own(p,user);exec('DELETE FROM project_launches WHERE id=? AND project_id=?',launches[2],p.id);return ok(send,{ok:true});}
  }
  return false;
}
