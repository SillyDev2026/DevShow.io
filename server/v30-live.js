import {getUser,error} from './security.js';
import {access} from './v30.js';

const subscribers=new Map();
const MAX_CLIENTS_PER_PROJECT=30;
const MAX_CLIENTS_PER_USER=3;
const eventId=()=>Date.now().toString(36);
function send(res,type,data){if(res.writableEnded)return;res.write(`event: ${type}\nid: ${eventId()}\ndata: ${JSON.stringify(data)}\n\n`);}
export function emit(projectId,type,payload){for(const client of subscribers.get(projectId)||[]){
  try{if(!access(projectId,{id:client.userId})){client.res.end();continue;}send(client.res,type,payload);}
  catch{client.res.destroy();}
}}
export function stream(req,res,projectId,user){
  const role=access(projectId,user);
  if(!role)throw error(404,'Workspace not found.');
  const clients=subscribers.get(projectId)||new Set();
  if(clients.size>=MAX_CLIENTS_PER_PROJECT||[...clients].filter(x=>x.userId===user.id).length>=MAX_CLIENTS_PER_USER)throw error(429,'Too many editor sessions.');
  res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
  const entry={res,userId:user.id,role};clients.add(entry);subscribers.set(projectId,clients);
  send(res,'ready',{projectId,role,online:new Set([...clients].map(x=>x.userId)).size});
  emit(projectId,'presence',{online:new Set([...clients].map(x=>x.userId)).size});
  const pulse=setInterval(()=>{
    try{
      const current=getUser(req);
      if(!current||!access(projectId,current)){cleanup();res.end();return;}
      res.write(': ping\n\n');
    }catch{cleanup();res.destroy();}
  },15000);
  pulse.unref?.();
  let closed=false;
  function cleanup(){if(closed)return;closed=true;clearInterval(pulse);clients.delete(entry);if(!clients.size)subscribers.delete(projectId);else emit(projectId,'presence',{online:new Set([...clients].map(x=>x.userId)).size});}
  req.on('close',cleanup);res.on('close',cleanup);
}
