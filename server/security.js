import crypto from 'node:crypto';
import { one, exec, uuid } from './db.js';

export const MAX_BODY = 32_768;
export const clean = (value, max = 200) => String(value ?? '').trim().slice(0,max);
export const validUrl = (value) => {
  const s = clean(value,500);
  if (!s) return '';
  try { const u = new URL(s); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; }
};
export const error = (status,message) => Object.assign(new Error(message),{status});
export const need = (value,status,message) => { if(!value)throw error(status,message); return value; };
const digest = token => crypto.createHash('sha256').update(token).digest('hex');
export const hashPassword = password => { const salt=crypto.randomBytes(16);return `scrypt:${salt.toString('hex')}:${crypto.scryptSync(password,salt,64).toString('hex')}`; };
export const verifyPassword = (password,stored) => {
  const [algo,saltHex,hashHex] = String(stored||'').split(':');
  if(algo!=='scrypt'||!saltHex||!hashHex||!/^[a-f0-9]{32}$/i.test(saltHex)||!/^[a-f0-9]{128}$/i.test(hashHex))return false;
  const actual=crypto.scryptSync(password,Buffer.from(saltHex,'hex'),64);
  return crypto.timingSafeEqual(actual,Buffer.from(hashHex,'hex'));
};
export function getUser(req) {
  const match=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization||'');
  if(!match)return null;
  const s=one('SELECT user_id FROM sessions WHERE hash=? AND expires_at>?',digest(match[1]),Date.now());
  return s ? one('SELECT * FROM users WHERE id=?',s.user_id) : null;
}
export const requiredUser = u => need(u,401,'Sign in to continue.');
export function startSession(user) {
  const token=crypto.randomBytes(32).toString('hex');
  exec('INSERT INTO sessions(hash,user_id,expires_at) VALUES(?,?,?)',digest(token),user.id,Date.now()+30*86400000);
  return {token};
}
export function endSession(req){const token=(req.headers.authorization||'').slice(7);if(token)exec('DELETE FROM sessions WHERE hash=?',digest(token));}
export async function readJson(req) {
  need(/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''),415,'Expected application/json.');
  const chunks=[];let bytes=0;
  for await(const part of req){bytes+=part.length;if(bytes>MAX_BODY)throw error(413,'Request too large.');chunks.push(part);}
  let obj;try{obj=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{throw error(400,'Invalid JSON.');}
  need(obj&&typeof obj==='object'&&!Array.isArray(obj),400,'Expected a JSON object.');
  return obj;
}
export function publicUser(u) {
  let skills=[];try{skills=JSON.parse(u.skills||'[]');}catch{}
  const pin=u.pinned_project_id && one("SELECT id FROM projects WHERE id=? AND creator_id=? AND visibility='public'",u.pinned_project_id,u.id);
  return {id:u.id,name:u.name,handle:u.handle,role:u.role||'',bio:u.bio||'',github:u.github||'',website:u.website||'',color:u.color||'#b4ffa6',location:u.location||'',skills:Array.isArray(skills)?skills:[],pinnedProjectId:pin?.id||'',createdAt:u.created_at};
}
export const toggle = (table,a,owner,b,id) => {
  const old=one(`SELECT 1 FROM ${table} WHERE ${a}=? AND ${b}=?`,owner,id);
  if(old)exec(`DELETE FROM ${table} WHERE ${a}=? AND ${b}=?`,owner,id);
  else exec(`INSERT INTO ${table}(${a},${b}) VALUES(?,?)`,owner,id);
  return !old;
};
export const notify = (actor,recipient,kind,projectId='') => {if(actor!==recipient)exec('INSERT INTO notifications(id,user_id,actor_id,kind,project_id) VALUES(?,?,?,?,?)',uuid(),recipient,actor,kind,projectId);};
export function makeRateLimiter(){
  const slots=new Map();
  return (req,mode='api')=>{
    const ip=req.socket.remoteAddress||'unknown',key=`${ip}:${mode}`,now=Date.now(),limit=mode==='auth'?15:mode==='github'?35:240;
    const s=slots.get(key);const next=s&&s.until>now?s:{until:now+60000,count:0};next.count++;slots.set(key,next);
    if(next.count>limit)throw error(429,'Rate limit exceeded. Try again shortly.');
    if(slots.size>5000)for(const [k,v] of slots)if(v.until<=now)slots.delete(k);
  };
}
