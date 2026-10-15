import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncNotifications} from '../src/notification-inbox.js';

function memory(){
  const map=new Map();
  return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key),map};
}
test('notifications are acknowledged only after the UI processes them',async()=>{
  const previous={localStorage:globalThis.localStorage,sessionStorage:globalThis.sessionStorage,window:globalThis.window,location:globalThis.location,fetch:globalThis.fetch};
  const local=memory(),session=memory();
  globalThis.localStorage=local;
  globalThis.sessionStorage=session;
  globalThis.window={DEVSHOW_API_URL:'https://api.example.org'};
  globalThis.location={origin:'https://sillydev2026.github.io'};
  const calls=[];
  globalThis.fetch=async url=>{
    calls.push(String(url));
    const after=Number(new URL(url).searchParams.get('after'));
    return {ok:true,status:200,json:async()=>({items:after?[{id:'notification2',read:false}]:[{id:'notification1',read:false}],cursor:after?2:1,hasMore:false,unreadCount:2})};
  };
  try{
    await assert.rejects(syncNotifications('member',()=>{throw Error('render interrupted');}),/render interrupted/);
    assert.match(calls.at(-1),/after=0/);
    let received=null;
    await syncNotifications('member',payload=>{received=payload;});
    assert.deepEqual(received.items.map(x=>x.id),['notification1']);
    assert.match(calls.at(-1),/after=0/);
    await syncNotifications('member',()=>{});
    assert.match(calls.at(-1),/after=1/);
    session.setItem('devshow-inbox-v3:member@https://api.example.org','Infinity');
    await syncNotifications('member',()=>{});
    assert.match(calls.at(-1),/after=0/);
  }finally{
    Object.assign(globalThis,previous);
  }
});
test('an invalid or stalled notification cursor is rejected',async()=>{
  const previous={localStorage:globalThis.localStorage,sessionStorage:globalThis.sessionStorage,window:globalThis.window,location:globalThis.location,fetch:globalThis.fetch};
  globalThis.localStorage=memory();
  globalThis.sessionStorage=memory();
  globalThis.window={DEVSHOW_API_URL:'https://api.example.org'};
  globalThis.location={origin:'https://sillydev2026.github.io'};
  globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({items:[],cursor:0,hasMore:true,unreadCount:0})});
  try{await assert.rejects(syncNotifications('member',()=>{}),/did not advance/);}
  finally{Object.assign(globalThis,previous);}
});
