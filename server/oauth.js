import crypto from 'node:crypto';
import {one,exec,uuid} from './db.js';
import {hashPassword,startSession,error,need,clean,publicUser} from './security.js';
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const config=()=>{
  const client=process.env.GITHUB_CLIENT_ID,secret=process.env.GITHUB_CLIENT_SECRET,callback=process.env.GITHUB_CALLBACK_URL,site=process.env.PUBLIC_SITE_URL;
  if(!client||!secret||!callback||!site)return null;
  try{const c=new URL(callback),s=new URL(site);if(c.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(c.hostname))return null;if(s.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(s.hostname))return null;return {client,secret,callback:c.href,site:s.href};}catch{return null;}
};
export function oauthStart(user){
  const c=config();need(c,503,'GitHub OAuth is not configured on the server.');
  const state=crypto.randomBytes(32).toString('hex');exec('DELETE FROM oauth_states WHERE expires_at<?',Date.now());
  exec('INSERT INTO oauth_states(hash,user_id,expires_at) VALUES(?,?,?)',sha(state),user?.id||null,Date.now()+10*60000);
  const url=new URL('https://github.com/login/oauth/authorize');url.searchParams.set('client_id',c.client);url.searchParams.set('redirect_uri',c.callback);url.searchParams.set('state',state);url.searchParams.set('scope','read:user user:email');
  return {url:url.toString(),mode:user?'link':'login'};
}
async function githubGet(path,token){const response=await fetch('https://api.github.com'+path,{headers:{Accept:'application/vnd.github+json','User-Agent':'DevShow-OAuth/2.6',Authorization:`Bearer ${token}`},redirect:'error'});need(response.ok,502,'GitHub identity request failed.');return response.json();}
export async function oauthCallback(req,res,url){
  const c=config();need(c,503,'GitHub OAuth is not configured.');
  const state=clean(url.searchParams.get('state'),128),code=clean(url.searchParams.get('code'),512);
  need(/^[a-f0-9]{64}$/.test(state)&&code,400,'Invalid OAuth callback.');
  const record=one('SELECT * FROM oauth_states WHERE hash=? AND expires_at>?',sha(state),Date.now());need(record,400,'OAuth state expired or already used.');
  exec('DELETE FROM oauth_states WHERE hash=?',sha(state));
  const tokenResponse=await fetch('https://github.com/login/oauth/access_token',{method:'POST',redirect:'error',headers:{Accept:'application/json','Content-Type':'application/json','User-Agent':'DevShow-OAuth/2.6'},body:JSON.stringify({client_id:c.client,client_secret:c.secret,code,redirect_uri:c.callback})});
  need(tokenResponse.ok,502,'GitHub sign-in failed.');const tk=await tokenResponse.json();need(tk.access_token&&!tk.error,401,'GitHub did not authorize sign-in.');
  const user=await githubGet('/user',tk.access_token);need(Number.isSafeInteger(user.id),502,'Invalid GitHub account.');
  const githubId=String(user.id);const linked=one('SELECT user_id FROM github_links WHERE github_id=?',githubId);
  let id=record.user_id;
  if(id){need(!linked||linked.user_id===id,409,'GitHub account is linked to another developer.');
    exec('INSERT INTO github_links(github_id,user_id,login) VALUES(?,?,?) ON CONFLICT(github_id) DO UPDATE SET login=excluded.login',githubId,id,clean(user.login,80));
  }else if(linked){id=linked.user_id;
  }else{
    const emails=await githubGet('/user/emails',tk.access_token);const email=emails.find(x=>x.verified&&x.primary)||emails.find(x=>x.verified);
    need(email?.email,403,'Verify an email address on GitHub before creating an account.');
    need(!one('SELECT 1 FROM users WHERE email=?',email.email),409,'Email belongs to an existing DevShow account. Sign in and link GitHub from Settings.');
    const base=clean(user.login,20).replace(/[^a-zA-Z0-9_-]/g,'')||'developer';let handle=base,index=0;
    while(one('SELECT 1 FROM users WHERE handle=?',handle)){index++;handle=(base.slice(0,20)+index).slice(0,24);}
    id=uuid();exec('INSERT INTO users(id,email,handle,password_hash,name,github) VALUES(?,?,?,?,?,?)',id,email.email,handle,hashPassword(crypto.randomBytes(32).toString('hex')),clean(user.name||user.login,40),`https://github.com/${user.login}`);
    exec('INSERT INTO github_links(github_id,user_id,login) VALUES(?,?,?)',githubId,id,clean(user.login,80));
  }
  const ticket=crypto.randomBytes(32).toString('hex');exec('INSERT INTO oauth_tickets(hash,user_id,expires_at) VALUES(?,?,?)',sha(ticket),id,Date.now()+90_000);
  const destination=new URL(c.site);destination.hash='github-ticket='+ticket;res.writeHead(302,{Location:destination.toString(),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end();
}
export function oauthExchange(ticket){
  need(/^[a-f0-9]{64}$/.test(String(ticket||'')),400,'Invalid sign-in ticket.');
  const hash=sha(ticket),stored=one('SELECT user_id FROM oauth_tickets WHERE hash=? AND expires_at>?',hash,Date.now());need(stored,401,'Sign-in ticket expired or used.');
  exec('DELETE FROM oauth_tickets WHERE hash=?',hash);
  return {...startSession({id:stored.user_id}),user:publicUser(one('SELECT * FROM users WHERE id=?',stored.user_id))};
}
export const githubLinked=id=>!!one('SELECT 1 FROM github_links WHERE user_id=?',id);
