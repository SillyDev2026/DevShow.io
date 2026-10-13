import {parseGitHubRepo} from './github.js';
import {projectRecord,permitted} from './projects.js';
import {need,error,clean} from './security.js';

// Read-only GitHub directory explorer. Restricts upstream host, response size and paths.
export async function routeCodeTree(req,url,send,rate,user){
  const match=/^\/api\/v2\/projects\/([a-f0-9-]{36})\/code-tree$/.exec(url.pathname);
  if(!match||req.method!=='GET')return false;
  const p=permitted(projectRecord(match[1]),user),repo=parseGitHubRepo(p.repo);
  need(repo,400,'Project requires a public GitHub repository.');rate(req,'github');
  const subpath=clean(url.searchParams.get('path'),180);
  need(!subpath.startsWith('/')&&!subpath.includes('..')&&(!subpath||/^[a-zA-Z0-9_.\-/]+$/.test(subpath)),400,'Invalid directory path.');
  const uri=`https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/contents${subpath?'/'+subpath.split('/').map(encodeURIComponent).join('/'):''}`;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
  try{
    const res=await fetch(uri,{redirect:'error',signal:controller.signal,headers:{Accept:'application/vnd.github+json','User-Agent':'DevShow-v2.7'}});
    need(res.ok,res.status===404?404:502,res.status===404?'Directory not found.':'GitHub unavailable.');
    const declared=Number(res.headers.get('content-length')||0);need(declared<=300000,413,'Directory too large.');
    const raw=await res.text();need(raw.length<=300000,413,'Directory too large.');const data=JSON.parse(raw);
    need(Array.isArray(data),400,'Enter a directory, not a file.');
    send(200,{path:subpath,files:data.filter(f=>['file','dir'].includes(f.type)).slice(0,120).map(f=>({name:String(f.name).slice(0,160),path:f.path,type:f.type,size:f.size||0}))});return true;
  }catch(e){if(e.name==='AbortError')throw error(504,'GitHub timed out.');throw e;}
  finally{clearTimeout(timer);}
}
