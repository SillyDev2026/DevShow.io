import {serverUrl,token} from './api.js';
let controller=null,connectionKey='';
export function stopLive(){controller?.abort();controller=null;connectionKey='';}
export function startLive(onMessage){
  const key=`${serverUrl()}|${token()}`;
  if(!token()||!serverUrl()){stopLive();return;}
  if(key===connectionKey&&controller)return;
  stopLive();connectionKey=key;controller=new AbortController();const signal=controller.signal;
  async function connect(){
    try{
      const response=await fetch(serverUrl()+'/api/events',{headers:{Authorization:`Bearer ${token()}`},signal,cache:'no-store'});
      if(!response.ok||!response.body)return;
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
      while(!signal.aborted){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});
        const parts=buffer.split('\n\n');buffer=parts.pop()||'';
        for(const part of parts){
          const eventLine=part.split('\n').find(line=>line.startsWith('event:'));
          if(!eventLine)continue;
          const type=eventLine.slice(6).trim();
          const line=part.split('\n').find(value=>value.startsWith('data:'));
          let payload={};try{if(line)payload=JSON.parse(line.slice(5));}catch{}
          await onMessage({type,payload});
        }
      }
    }catch(e){if(e.name!=='AbortError')console.warn('Live stream unavailable:',e.message);}
    if(!signal.aborted)setTimeout(()=>{if(!signal.aborted)connect();},5000);
  }
  connect();
}
