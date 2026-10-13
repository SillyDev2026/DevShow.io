import {query,one,exec,uuid,transaction} from './db.js';
import {clean,need,error,requiredUser,readJson,notify,publicUser} from './security.js';
import {projectRecord,permitted,communityAllowed} from './projects.js';
import {publish} from './live.js';
const ok=(send,data,status=200)=>{send(status,data);return true;};
const postRow=p=>({id:p.id,body:p.body,createdAt:p.created_at,groupId:p.group_id,author:{id:p.author_id,name:p.name,handle:p.handle,color:p.color}});
const listPosts=(groupId=null)=>query(`SELECT p.*,u.name,u.handle,u.color FROM posts p JOIN users u ON u.id=p.author_id WHERE ${groupId?'p.group_id=?':'p.group_id IS NULL'} ORDER BY p.created_at DESC LIMIT 100`,...(groupId?[groupId]:[])).map(postRow);
export async function routeCommunity(req,url,send,rate,user){
  const path=url.pathname,method=req.method;
  if(method==='GET'&&path==='/api/feed')return ok(send,{posts:listPosts()});
  if(method==='POST'&&path==='/api/feed'){
    requiredUser(user);rate(req,'write');const d=await readJson(req),body=clean(d.body,1500);need(body.length>=2,400,'Post must be at least 2 characters.');
    const id=uuid();exec('INSERT INTO posts(id,author_id,body) VALUES(?,?,?)',id,user.id,body);publish('feed',{kind:'post',id});return ok(send,{id},201);
  }
  if(method==='GET'&&path==='/api/groups'){
    return ok(send,{groups:query(`SELECT g.*,(SELECT COUNT(*) FROM group_members m WHERE m.group_id=g.id) members FROM groups g ORDER BY g.created_at DESC LIMIT 100`).map(g=>({id:g.id,name:g.name,description:g.description,ownerId:g.owner_id,members:g.members,joined:user?!!one('SELECT 1 FROM group_members WHERE group_id=? AND user_id=?',g.id,user.id):false}))});
  }
  if(method==='POST'&&path==='/api/groups'){
    requiredUser(user);rate(req,'write');const d=await readJson(req),name=clean(d.name,45),description=clean(d.description,300);
    need(name.length>=3&&/^[\p{L}\p{N} ._-]+$/u.test(name),400,'Group name must contain 3–45 letters, numbers, spaces or punctuation.');
    const id=uuid();try{transaction(()=>{exec('INSERT INTO groups(id,owner_id,name,description) VALUES(?,?,?,?)',id,user.id,name,description);exec('INSERT INTO group_members(group_id,user_id) VALUES(?,?)',id,user.id);});}catch(e){if(String(e.message).includes('UNIQUE'))throw error(409,'Group name already exists.');throw e;}
    return ok(send,{id},201);
  }
  const group=path.match(/^\/api\/groups\/([a-f0-9-]{36})(?:\/(join|posts))?$/);
  if(group){const g=one('SELECT * FROM groups WHERE id=?',group[1]);need(g,404,'Group not found.');
    if(method==='POST'&&group[2]==='join'){
      requiredUser(user);rate(req,'write');const active=one('SELECT 1 FROM group_members WHERE group_id=? AND user_id=?',g.id,user.id);
      if(active){need(g.owner_id!==user.id,403,'Group owner must remain a member.');exec('DELETE FROM group_members WHERE group_id=? AND user_id=?',g.id,user.id);}else exec('INSERT INTO group_members(group_id,user_id) VALUES(?,?)',g.id,user.id);
      return ok(send,{joined:!active});
    }
    if(method==='GET'&&group[2]==='posts')return ok(send,{group:g,posts:listPosts(g.id)});
    if(method==='POST'&&group[2]==='posts'){
      requiredUser(user);rate(req,'write');need(one('SELECT 1 FROM group_members WHERE group_id=? AND user_id=?',g.id,user.id),403,'Join the group before posting.');
      const d=await readJson(req),body=clean(d.body,1500);need(body.length>=2,400,'Post is too short.');const id=uuid();exec('INSERT INTO posts(id,author_id,group_id,body) VALUES(?,?,?,?)',id,user.id,g.id,body);publish('group',{groupId:g.id,id});return ok(send,{id},201);
    }
  }
  if(method==='GET'&&path==='/api/conversations'){
    requiredUser(user);const rows=query(`SELECT m.*,u.name,u.handle FROM messages m JOIN users u ON u.id=CASE WHEN m.sender_id=? THEN m.recipient_id ELSE m.sender_id END WHERE m.sender_id=? OR m.recipient_id=? ORDER BY m.created_at DESC LIMIT 300`,user.id,user.id,user.id);
    const seen=new Set(),conversations=[];for(const m of rows){const other=m.sender_id===user.id?m.recipient_id:m.sender_id;if(!seen.has(other)){seen.add(other);conversations.push({userId:other,name:m.name,handle:m.handle,preview:m.body,createdAt:m.created_at});}}return ok(send,{conversations});
  }
  const convo=path.match(/^\/api\/messages\/([a-f0-9-]{36})$/);
  if(convo&&method==='GET'){
    requiredUser(user);const target=one('SELECT * FROM users WHERE id=?',convo[1]);need(target,404,'User not found.');
    return ok(send,{with:publicUser(target),messages:query('SELECT id,sender_id senderId,recipient_id recipientId,body,created_at createdAt FROM messages WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?) ORDER BY created_at DESC LIMIT 100',user.id,target.id,target.id,user.id).reverse()});
  }
  if(method==='POST'&&path==='/api/messages'){
    requiredUser(user);rate(req,'write');const d=await readJson(req),recipient=one('SELECT id FROM users WHERE id=?',clean(d.recipientId,60)),body=clean(d.body,1200);
    need(recipient,404,'Recipient not found.');need(recipient.id!==user.id,400,'Cannot message yourself.');need(body.length>=1,400,'Message is empty.');
    const id=uuid();exec('INSERT INTO messages(id,sender_id,recipient_id,body) VALUES(?,?,?,?)',id,user.id,recipient.id,body);notify(user.id,recipient.id,'message');publish('message',{from:user.id,id},recipient.id);return ok(send,{id},201);
  }
  const roadmap=path.match(/^\/api\/projects\/([a-f0-9-]{36})\/roadmap(?:\/([a-f0-9-]{36}))?$/);
  if(roadmap){const p=permitted(projectRecord(roadmap[1]),user);
    if(method==='GET'&&!roadmap[2])return ok(send,{items:query('SELECT * FROM roadmaps WHERE project_id=? ORDER BY created_at DESC',p.id)});
    requiredUser(user);need(user.id===p.creator_id,403,'Only the owner can manage the roadmap.');rate(req,'write');
    if(method==='POST'&&!roadmap[2]){const d=await readJson(req),title=clean(d.title,100),description=clean(d.description,1000);need(title.length>=3,400,'Roadmap title is too short.');const id=uuid();exec('INSERT INTO roadmaps(id,project_id,title,description) VALUES(?,?,?,?)',id,p.id,title,description);return ok(send,{id},201);}
    if(method==='PATCH'&&roadmap[2]){const d=await readJson(req);need(['planned','in_progress','completed'].includes(d.status),400,'Invalid status.');const result=exec('UPDATE roadmaps SET status=? WHERE id=? AND project_id=?',d.status,roadmap[2],p.id);need(result.changes,404,'Item not found.');return ok(send,{ok:true});}
  }
  const feedback=path.match(/^\/api\/projects\/([a-f0-9-]{36})\/feedback(?:\/([a-f0-9-]{36}))?$/);
  if(feedback){const p=permitted(projectRecord(feedback[1]),user);
    if(method==='GET'&&!feedback[2])return ok(send,{feedback:query(`SELECT f.id,f.body,f.status,f.created_at createdAt,u.name,u.handle FROM feedback f JOIN users u ON u.id=f.user_id WHERE f.project_id=? ORDER BY f.created_at DESC LIMIT 100`,p.id)});
    requiredUser(user);communityAllowed(p,user);rate(req,'write');
    if(method==='POST'&&!feedback[2]){const d=await readJson(req),body=clean(d.body,1000);need(body.length>=5,400,'Feedback is too short.');const id=uuid();exec('INSERT INTO feedback(id,project_id,user_id,body) VALUES(?,?,?,?)',id,p.id,user.id,body);notify(user.id,p.creator_id,'feedback',p.id);publish('feedback',{projectId:p.id,id},p.creator_id);return ok(send,{id},201);}
    if(method==='PATCH'&&feedback[2]){need(user.id===p.creator_id,403,'Only project owner can moderate feedback.');const d=await readJson(req);need(['open','accepted','completed','declined'].includes(d.status),400,'Invalid status.');const result=exec('UPDATE feedback SET status=? WHERE project_id=? AND id=?',d.status,p.id,feedback[2]);need(result.changes,404,'Feedback not found.');return ok(send,{ok:true});}
  }
  const analytics=path.match(/^\/api\/projects\/([a-f0-9-]{36})\/analytics$/);
  if(analytics&&method==='GET'){
    const p=permitted(projectRecord(analytics[1]),user);requiredUser(user);need(p.creator_id===user.id,403,'Analytics are private to the owner.');
    return ok(send,{views:p.views,likes:one('SELECT COUNT(*) n FROM likes WHERE project_id=?',p.id).n,comments:one('SELECT COUNT(*) n FROM comments WHERE project_id=?',p.id).n,feedback:one('SELECT COUNT(*) n FROM feedback WHERE project_id=?',p.id).n,daily:query('SELECT day,count FROM views_daily WHERE project_id=? ORDER BY day DESC LIMIT 30',p.id).reverse()});
  }
  if(method==='GET'&&path==='/api/v1/projects'){
    return ok(send,{version:'2.6',projects:query("SELECT id,title,tagline,category,repo,website,created_at createdAt FROM projects WHERE visibility='public' ORDER BY created_at DESC LIMIT 100")});
  }
  return false;
}
