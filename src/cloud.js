// DevShow v2 API bridge. Uses Authorization tokens so cross-site cookies are not required.
const CLOUD_CONFIG_KEY = 'devshow-v2-api-url';
const TOKEN = 'devshow-v2-session';
export function apiBase() {
  const custom = localStorage.getItem(CLOUD_CONFIG_KEY) || window.DEVSHOW_API_URL || '';
  if (custom) return custom.replace(/\/+$/,'');
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(location.origin) ? location.origin : '';
}
export function validApiBase(url) {
  try { const u = new URL(url); return u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost','127.0.0.1'].includes(u.hostname)); }
  catch { return false; }
}
export function setApiBase(url) { if (url && !validApiBase(url)) throw new Error('Use HTTPS for public servers (HTTP is supported for local development).'); localStorage.setItem(CLOUD_CONFIG_KEY,url.replace(/\/+$/,'')); sessionStorage.removeItem(TOKEN); }
export const isCloud = () => Boolean(apiBase());
export const getToken = () => sessionStorage.getItem(TOKEN) || '';
export const setToken = token => token ? sessionStorage.setItem(TOKEN, token) : sessionStorage.removeItem(TOKEN);
export async function api(path, options={}) {
  const base=apiBase(); if(!base) throw new Error('Connect a Node.js API in Settings first.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try {
    const res=await fetch(base+'/api'+path, {method:options.method||'GET',headers:{Accept:'application/json',...(options.data?{'Content-Type':'application/json'}:{}),...(getToken()?{'Authorization':`Bearer ${getToken()}`}:{})},body:options.data?JSON.stringify(options.data):undefined,signal:controller.signal,cache:'no-store'});
    const data=await res.json().catch(()=>({}));
    if(!res.ok){if(res.status===401&&getToken())setToken('');throw new Error(data.error||`Server returned ${res.status}`);}
    return data;
  } catch(e) { if(e.name==='AbortError')throw new Error('API connection timed out.'); throw e; }
  finally { clearTimeout(timer); }
}
