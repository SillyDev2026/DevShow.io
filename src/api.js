// Shared remote state only. No private browser database or fabricated local accounts.
const STORAGE='devshow-api-v25';
const SESSION='devshow-session-v25';
export const serverUrl=()=>{
  const custom=localStorage.getItem(STORAGE);
  if(custom)return custom;
  const configured=window.DEVSHOW_API_URL||'';
  if(configured)return configured.replace(/\/+$/,'');
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(location.origin)?location.origin:'';
};
export const validServerUrl=input=>{
  try {const url=new URL(input);return !url.username&&!url.password&&!url.search&&!url.hash&&!url.pathname.replace(/\//g,'')&&(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)));}catch{return false;}
};
export function configureServer(url){
  const text=String(url||'').trim().replace(/\/+$/,'');
  if(text&&!validServerUrl(text))throw Error('Use a server HTTPS origin (or HTTP localhost).');
  if(text)localStorage.setItem(STORAGE,text);else localStorage.removeItem(STORAGE);
  clearSession();
}
export async function probeServer(origin,fetcher=fetch,timeout=6000){
  const url=String(origin||'').trim().replace(/\/+$/,'');
  if(!validServerUrl(url))throw Error('Enter a valid HTTPS server origin (or HTTP localhost).');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await fetcher(`${url}/api/health`,{headers:{Accept:'application/json'},signal:controller.signal,cache:'no-store'});
    if(!response.ok)throw Error(`Health check failed (${response.status})`);
    const payload=await response.json();
    if(payload?.ok!==true||payload?.service!=='DevShow API'||typeof payload.version!=='string')throw Error('This server is not a compatible DevShow API.');
    return {version:payload.version,origin:url};
  }catch(e){if(e.name==='AbortError')throw Error('Connection timed out. Verify the API address and server status.');throw e;}
  finally{clearTimeout(timer);}
}
export const token=()=>sessionStorage.getItem(SESSION)||'';
export const saveSession=value=>value?sessionStorage.setItem(SESSION,value):sessionStorage.removeItem(SESSION);
export const clearSession=()=>sessionStorage.removeItem(SESSION);
export async function api(endpoint,{method='GET',data,timeout=12000}={}){
  const base=serverUrl();if(!base)throw Error('Connect a Node.js server to enable DevShow community features.');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await fetch(`${base}/api${endpoint}`,{method,headers:{Accept:'application/json',...(data!==undefined?{'Content-Type':'application/json'}:{}),...(token()?{Authorization:`Bearer ${token()}`}:{})},body:data!==undefined?JSON.stringify(data):undefined,signal:controller.signal,cache:'no-store'});
    const result=await response.json().catch(()=>({}));
    if(!response.ok){if(response.status===401)clearSession();throw Error(result.error||`Request failed (${response.status})`);}
    return result;
  }catch(e){if(e.name==='AbortError')throw Error('Server request timed out.');throw e;}finally{clearTimeout(timer);}
}
