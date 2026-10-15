// Durable notifications are delivered to the UI before committing a cursor.
// Never acknowledge events solely because they were received over HTTP.
import {api,serverUrl} from './api.js';
const keyFor=userId=>`devshow-inbox-v3:${userId}@${serverUrl()}`;
const getCursor=userId=>{try{const value=Number(sessionStorage.getItem(keyFor(userId)));return Number.isSafeInteger(value)&&value>=0?value:0;}catch{return 0;}};
const remember=(userId,cursor)=>{try{sessionStorage.setItem(keyFor(userId),String(cursor));}catch{}};
const inflight=new Map();
export function syncNotifications(userId,onSync){
  if(!userId)return Promise.resolve();
  const key=keyFor(userId);
  if(inflight.has(key))return inflight.get(key);
  const task=(async()=>{
    const startingCursor=getCursor(userId);
    let cursor=startingCursor,unreadCount=0,hasMore=false;
    const received=[];
    // Keep an individual burst bounded; undelivered events remain on the server.
    for(let page=0;page<20;page++){
      const data=await api(`/notifications/inbox?after=${cursor}&limit=100`);
      if(!Array.isArray(data.items)||!Number.isSafeInteger(data.cursor)||data.cursor<cursor||typeof data.hasMore!=='boolean'||!Number.isSafeInteger(data.unreadCount)||data.unreadCount<0)throw Error('Invalid notification response.');
      if(data.hasMore&&data.cursor===cursor)throw Error('Notification cursor did not advance.');
      received.push(...data.items);
      unreadCount=data.unreadCount;
      cursor=data.cursor;
      hasMore=data.hasMore;
      if(!hasMore)break;
    }
    // A failed renderer should not permanently skip an unread notification.
    await onSync({items:received,unreadCount,hasMore});
    remember(userId,cursor);
    return {cursor,hasMore,count:received.length};
  })().finally(()=>inflight.delete(key));
  inflight.set(key,task);
  return task;
}
