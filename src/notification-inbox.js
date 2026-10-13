// Sync the durable SQLite notification inbox when connecting, reconnecting, or logging in.
// Events are hints, not the storage system: missed SSE messages are recovered over REST.
import {api,serverUrl} from './api.js';
const keyFor=userId=>`devshow-inbox-v3:${userId}@${serverUrl()}`;
const getCursor=userId=>{try{return Math.max(0,Number(sessionStorage.getItem(keyFor(userId)))||0);}catch{return 0;}};
const remember=(userId,cursor)=>{try{sessionStorage.setItem(keyFor(userId),String(cursor));}catch{}};
const inflight=new Map();
export function syncNotifications(userId,onSync){
  if(!userId)return Promise.resolve();
  const key=keyFor(userId);
  if(inflight.has(key))return inflight.get(key);
  const task=(async()=>{
    let cursor=getCursor(userId),unreadCount=0;
    const received=[];
    // Cap an individual burst, resuming from the stored cursor on the next sync.
    for(let page=0;page<20;page++){
      const data=await api(`/notifications/inbox?after=${cursor}&limit=100`);
      if(!Array.isArray(data.items)||!Number.isSafeInteger(data.cursor))throw Error('Invalid notification response.');
      received.push(...data.items);
      unreadCount=data.unreadCount;
      cursor=data.cursor;
      remember(userId,cursor);
      if(!data.hasMore)break;
    }
    onSync({items:received,unreadCount});
  })().finally(()=>inflight.delete(key));
  inflight.set(key,task);
  return task;
}
