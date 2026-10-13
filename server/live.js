const subscriptions=new Map();
export function publish(type,payload,recipient='') {
  const packet=`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for(const [res,info] of subscriptions){
    if(recipient && info.userId!==recipient)continue;
    if(info.scope==='private' && !recipient)continue;
    try{res.write(packet);}catch{subscriptions.delete(res);}
  }
}
export function liveStream(req,res,user){
  if(!user){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Sign in required.'}));return;}
  if(subscriptions.size>=150){res.writeHead(503);res.end();return;}
  res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
  res.write(': connected\n\n');subscriptions.set(res,{userId:user.id,scope:'private'});
  const interval=setInterval(()=>{try{res.write(': keepalive\n\n');}catch{cleanup();}},25000);
  const cleanup=()=>{clearInterval(interval);subscriptions.delete(res);};
  req.on('close',cleanup);res.on('close',cleanup);
}
