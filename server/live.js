import {inbox} from './notifications.js';
import {getUser} from './security.js';
const subscriptions=new Map();
export function publish(type,payload,recipient='') {
  const packet=`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for(const [res,info] of subscriptions){
    if(recipient && info.userId!==recipient)continue;
    if(info.scope==='private' && !recipient && type!=='activity')continue;
    // Logout or session expiry must immediately stop private event delivery.
    const current=getUser(info.req);
    if(!current||current.id!==info.userId){subscriptions.delete(res);res.end();continue;}
    try{if(!res.write(packet)){subscriptions.delete(res);res.end();}}catch{subscriptions.delete(res);res.destroy();}
  }
}
export function liveStream(req,res,user){
  if(!user){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Sign in required.'}));return;}
  if(subscriptions.size>=150){res.writeHead(503);res.end();return;}
  res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
  subscriptions.set(res,{userId:user.id,scope:'private',req});
  // A fresh connection triggers an authenticated inbox sync. The browser uses
  // the durable REST cursor to recover anything missed while offline.
  const snapshot=inbox(user.id,{limit:1});
  res.write(`event: ready\ndata: ${JSON.stringify({unreadCount:snapshot.unreadCount})}\n\n`);
  const interval=setInterval(()=>{try{const current=getUser(req);if(!current||current.id!==user.id){cleanup();res.end();return;}res.write(': keepalive\n\n');}catch{cleanup();res.destroy();}},25000);
  const cleanup=()=>{clearInterval(interval);subscriptions.delete(res);};
  req.on('close',cleanup);res.on('close',cleanup);
}
