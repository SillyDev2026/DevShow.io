import {parseGitHubRepo,githubMetadata} from './github.js';
import {projectRecord,permitted} from './projects.js';
import {query,one,exec} from './db.js';
import {need,error,requiredUser,clean} from './security.js';
const headers=()=>({Accept:'application/vnd.github+json','User-Agent':'DevShow-Community/2.6',...(process.env.GITHUB_TOKEN?{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`}:{})});
async function gh(path){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{const response=await fetch('https://api.github.com'+path,{headers:headers(),signal:controller.signal,redirect:'error'});
    if(!response.ok)throw error(response.status===404?404:502,response.status===404?'GitHub resource not found.':'GitHub API temporarily unavailable.');
    return response.json();
  }catch(e){if(e.name==='AbortError')throw error(504,'GitHub request timed out.');throw e;}finally{clearTimeout(timer);}
}
export async function routeGitHub({req,url,send,rate,user}){
  const route=url.pathname.match(/^\/api\/projects\/([a-f0-9-]{36})\/github\/(releases|code|sync|snapshot)$/);
  if(!route)return false;
  const p=permitted(projectRecord(route[1]),user);need(p.repo,404,'No GitHub repository linked.');
  const repo=parseGitHubRepo(p.repo);need(repo,400,'The GitHub link is not a valid public repository URL.');
  const key=`/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`;
  rate(req,'github');
  if(route[2]==='releases'&&req.method==='GET'){
    const releases=await gh(key+'/releases?per_page=10');
    send(200,{releases:releases.map(r=>({id:r.id,tag:String(r.tag_name||'').slice(0,100),name:String(r.name||'').slice(0,200),publishedAt:r.published_at,url:r.html_url,prerelease:!!r.prerelease,assets:(r.assets||[]).slice(0,15).map(a=>({name:String(a.name).slice(0,130),url:a.browser_download_url,size:a.size}))}))});return true;
  }
  if(route[2]==='code'&&req.method==='GET'){
    const file=clean(url.searchParams.get('path'),220);need(file&&!file.startsWith('/')&&!file.includes('..')&&/^[\w.\-/]+$/.test(file),400,'Choose a safe repository file path.');
    const data=await gh(key+'/contents/'+file.split('/').map(encodeURIComponent).join('/'));
    need(data.type==='file'&&Number(data.size)<=65536&&data.encoding==='base64',413,'Only text files up to 64 KB can be previewed.');
    const buffer=Buffer.from(String(data.content||'').replace(/\s/g,''),'base64');
    need(!buffer.includes(0),415,'Binary files are not supported.');
    send(200,{path:file,content:buffer.toString('utf8'),size:buffer.length,url:data.html_url});return true;
  }
  if(route[2]==='sync'&&req.method==='POST'){
    requiredUser(user);need(p.creator_id===user.id,403,'Only the project owner can sync it.');
    const data=await githubMetadata(p.repo);exec(`INSERT INTO github_snapshots(project_id,metadata,synced_at) VALUES(?,?,datetime('now')) ON CONFLICT(project_id) DO UPDATE SET metadata=excluded.metadata,synced_at=datetime('now')`,p.id,JSON.stringify(data));
    send(200,{repository:data,synced:true});return true;
  }
  if(route[2]==='snapshot'&&req.method==='GET'){
    const snap=one('SELECT * FROM github_snapshots WHERE project_id=?',p.id);send(200,{snapshot:snap?{...JSON.parse(snap.metadata),syncedAt:snap.synced_at}:null});return true;
  }
  return false;
}
