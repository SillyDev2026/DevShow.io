import {one,query,exec,uuid,transaction} from './db.js';
import {clean,need,readJson,requiredUser,notify} from './security.js';
import {emit} from './v30-live.js';

const ok=(send,data,status=200)=>{send(status,data);return true;};
const validId='[a-f0-9-]{36}';
const projectRoute=new RegExp(`^/api/v3/collab/projects/(${validId})(?:/(.*))?$`);
const languages=new Set(['luau','lua','javascript','typescript','python','rust','json','text']);
const pathPattern=/^[A-Za-z0-9_./-]{1,120}$/;
function project(id){return one('SELECT * FROM projects WHERE id=?',id);}
export function access(id,user){if(!user)return null;const p=project(id);if(!p)return null;if(p.creator_id===user.id)return 'owner';const m=one("SELECT role FROM collaborative_members WHERE project_id=? AND user_id=? AND state='active'",id,user.id);return m?.role||null;}
const requireMember=(id,user)=>{requiredUser(user);return need(access(id,user),404,'Workspace not found.');};
const requireEditor=(id,user)=>{const role=requireMember(id,user);need(role==='editor'||role==='owner',403,'Read-only collaborators cannot edit.');return role;};
const isUuid=value=>/^[a-f0-9-]{36}$/.test(value||'');
const summary=(d)=>({id:d.id,path:d.path,language:d.language,revision:d.revision,updatedAt:d.updated_at,updatedBy:d.updated_by});
const readDoc=(id,pid)=>need(one('SELECT * FROM collaborative_documents WHERE id=? AND project_id=?',id,pid),404,'Document not found.');
const sourceText=d=>{need(typeof d.content==='string'&&Buffer.byteLength(d.content,'utf8')<=90000,413,'Document must be at most 90 KB.');return d.content;};
const listMembers=id=>query('SELECT m.user_id userId,u.handle,u.name,m.role,m.state FROM collaborative_members m JOIN users u ON u.id=m.user_id WHERE m.project_id=? ORDER BY m.created_at',id);
export async function routeV30(req,url,send,rate,user){
  const path=url.pathname,method=req.method;
  const match=path.match(projectRoute);
  if(match){
    const pid=match[1],part=match[2]||'',role=requireMember(pid,user);
    if(!part&&method==='GET'){
      const p=project(pid);
      return ok(send,{project:{id:pid,title:p.title,visibility:p.visibility},role,documents:query('SELECT * FROM collaborative_documents WHERE project_id=? ORDER BY path',pid).map(summary),members:listMembers(pid),owner:one('SELECT handle,name,id FROM users WHERE id=?',p.creator_id)});
    }
    if(part==='documents'&&method==='POST'){
      rate(req,'write');requireEditor(pid,user);
      const d=await readJson(req);const name=clean(d.path,120),language=clean(d.language||'luau',20);
      need(pathPattern.test(name)&&!name.includes('..')&&!name.startsWith('/')&&!name.endsWith('/')&&!name.includes('//'),400,'Invalid document path.');
      need(languages.has(language),400,'Unsupported document language.');
      need(one('SELECT COUNT(*) n FROM collaborative_documents WHERE project_id=?',pid).n<80,409,'Workspace file limit reached.');
      const content=d.content===undefined?'':sourceText(d),id=uuid();
      try{exec('INSERT INTO collaborative_documents(id,project_id,path,language,content,updated_by) VALUES(?,?,?,?,?,?)',id,pid,name,language,content,user.id);}catch(e){if(e.message.includes('UNIQUE'))need(false,409,'File already exists.');throw e;}
      emit(pid,'document',{action:'create',id,path:name,by:user.handle});return ok(send,{document:{id,path:name,language,revision:0,content}},201);
    }
    if(part==='documents'&&method==='GET')return ok(send,{documents:query('SELECT * FROM collaborative_documents WHERE project_id=? ORDER BY path',pid).map(summary)});
    const doc=part.match(new RegExp(`^documents/(${validId})(?:/(history))?$`));
    if(doc){const d=readDoc(doc[1],pid);
      if(method==='GET'&&!doc[2])return ok(send,{document:{...summary(d),content:d.content}});
      if(method==='GET'&&doc[2])return ok(send,{history:query('SELECT revision,author_id authorId,created_at createdAt FROM collaborative_revisions WHERE document_id=? ORDER BY revision DESC LIMIT 30',d.id)});
      if(method==='PUT'&&!doc[2]){
        rate(req,'write');requireEditor(pid,user);const update=await readJson(req,110000);const text=sourceText(update);
        need(Number.isInteger(update.baseRevision)&&update.baseRevision>=0,400,'Missing base revision.');
        let current;
        const success=transaction(()=>{
          current=readDoc(d.id,pid);
          if(current.revision!==update.baseRevision)return false;
          if(current.content===text)return true;
          exec('INSERT OR IGNORE INTO collaborative_revisions(document_id,revision,content,author_id) VALUES(?,?,?,?)',d.id,current.revision,current.content,current.updated_by);
          exec("UPDATE collaborative_documents SET content=?,revision=revision+1,updated_by=?,updated_at=datetime('now') WHERE id=? AND revision=?",text,user.id,d.id,current.revision);
          exec("DELETE FROM collaborative_revisions WHERE document_id=? AND revision NOT IN (SELECT revision FROM collaborative_revisions WHERE document_id=? ORDER BY revision DESC LIMIT 30)",d.id,d.id);
          return true;
        });
        if(!success)return ok(send,{error:'Conflicting changes. Reload, compare or merge the document before saving.',current:{content:current.content,revision:current.revision}},409);
        const latest=readDoc(d.id,pid);if(latest.revision!==current.revision)emit(pid,'document',{action:'update',id:d.id,revision:latest.revision,by:user.handle});
        return ok(send,{document:{...summary(latest),content:latest.content}});
      }
      if(method==='DELETE'&&!doc[2]){rate(req,'write');requireEditor(pid,user);exec('DELETE FROM collaborative_documents WHERE id=?',d.id);emit(pid,'document',{action:'delete',id:d.id,by:user.handle});return ok(send,{ok:true});}
    }
    if(part==='members'&&method==='GET')return ok(send,{members:listMembers(pid),role});
    if(part==='invites'&&method==='POST'){
      rate(req,'write');need(role==='owner',403,'Only the owner can invite.');const d=await readJson(req),handle=clean(d.handle,24),inviteRole=clean(d.role,16);
      need(['editor','viewer'].includes(inviteRole),400,'Invalid role.');const target=one('SELECT id FROM users WHERE handle=?',handle);need(target,404,'Developer not found.');need(target.id!==user.id,400,'Owner already has access.');
      need(one('SELECT COUNT(*) n FROM collaborative_members WHERE project_id=?',pid).n<60,409,'Collaborator limit reached.');
      exec("INSERT INTO collaborative_members(project_id,user_id,role,state,invited_by) VALUES(?,?,?,'pending',?) ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role,state='pending',invited_by=excluded.invited_by",pid,target.id,inviteRole,user.id);
      notify(user.id,target.id,'collaboration',pid);return ok(send,{invited:true});
    }
    const member=part.match(new RegExp(`^members/(${validId})$`));
    if(member&&method==='DELETE'){
      rate(req,'write');need(role==='owner'||user.id===member[1],403,'Insufficient permissions.');
      exec('DELETE FROM collaborative_members WHERE project_id=? AND user_id=?',pid,member[1]);
      emit(pid,'member',{action:'removed',userId:member[1]});return ok(send,{ok:true});
    }
    if(part==='chat'){
      if(method==='GET')return ok(send,{messages:query('SELECT c.id,c.content,c.created_at createdAt,u.handle,u.name FROM collaborative_messages c JOIN users u ON u.id=c.user_id WHERE c.project_id=? ORDER BY c.created_at DESC,c.rowid DESC LIMIT 80',pid).reverse()});
      if(method==='POST'){
        rate(req,'write');const d=await readJson(req),message=clean(d.message,700);need(message.length>=1,400,'Message cannot be empty.');const id=uuid();exec('INSERT INTO collaborative_messages(id,project_id,user_id,content) VALUES(?,?,?,?)',id,pid,user.id,message);
        emit(pid,'message',{id,handle:user.handle,message});return ok(send,{id},201);
      }
    }
    return false;
  }
  const invitation=path.match(new RegExp(`^/api/v3/collab/invitations/(${validId})$`));
  if(invitation&&method==='POST'){
    requiredUser(user);rate(req,'write');const d=await readJson(req);need(['accept','decline'].includes(d.action),400,'Invalid decision.');
    const row=one("SELECT role,state FROM collaborative_members WHERE project_id=? AND user_id=?",invitation[1],user.id);
    need(row&&row.state==='pending',404,'Invitation not found.');
    if(d.action==='accept')exec("UPDATE collaborative_members SET state='active' WHERE project_id=? AND user_id=?",invitation[1],user.id);
    else exec('DELETE FROM collaborative_members WHERE project_id=? AND user_id=?',invitation[1],user.id);
    return ok(send,{ok:true});
  }
  if(path==='/api/v3/collab/invitations'&&method==='GET'){
    requiredUser(user);return ok(send,{invitations:query("SELECT p.id projectId,p.title,m.role,u.handle invitedBy FROM collaborative_members m JOIN projects p ON p.id=m.project_id LEFT JOIN users u ON u.id=m.invited_by WHERE m.user_id=? AND m.state='pending'",user.id)});
  }
  if(path==='/api/v3/collab/projects'&&method==='GET'){
    requiredUser(user);return ok(send,{projects:query("SELECT p.id,p.title,p.visibility,m.role FROM projects p JOIN collaborative_members m ON m.project_id=p.id WHERE m.user_id=? AND m.state='active' UNION SELECT p.id,p.title,p.visibility,'owner' role FROM projects p WHERE p.creator_id=? ORDER BY title",user.id,user.id)});
  }
  return false;
}
