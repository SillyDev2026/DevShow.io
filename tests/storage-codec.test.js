import {test} from 'node:test';
import assert from 'node:assert/strict';
import {packText,unpackText,storageStats,STORAGE_PREFIX} from '../server/storage-codec.js';
test('codec: adaptive compression shrinks repeated Luau source',()=>{
 const source=('--!strict\nlocal x = math.sqrt(123456) -- devshow\n').repeat(850);
 const packed=packText(source,{maxBytes:100000});
 assert.ok(packed.startsWith(STORAGE_PREFIX));
 assert.equal(unpackText(packed,{maxBytes:100000}),source);
 assert.ok(storageStats(packed,{maxBytes:100000}).savedBytes>source.length*0.65);
});
test('codec: raw passthrough for tiny and poorly compressible strings',()=>{
 for(const x of ['', 'x', 'local a = b', '{ "a": 1 }'])assert.equal(packText(x),x);
 const noise=Array.from({length:60},(_,i)=>String(i)+'-'+Math.random().toString(36)).join('|');
 const packed=packText(noise);
 assert.equal(unpackText(packed),noise);
 assert.ok(Buffer.byteLength(packed)<=Buffer.byteLength(noise));
});
test('codec: Unicode and legacy storage roundtrip',()=>{
 const text='-- 👋 привет 世界\nlocal 🐱 = "💾"\n'.repeat(800);
 assert.equal(unpackText(packText(text)),text);
 assert.equal(unpackText('legacy untouched source'),'legacy untouched source');
 assert.equal(storageStats('legacy untouched source').codec,'raw');
});
test('codec: corrupt packets and decompression limits rejected',()=>{
 const sample=('local greeting = "Hello!"\n').repeat(450),packet=packText(sample);
 assert.throws(()=>unpackText(packet,{maxBytes:64}),/limit/);
 const frame=Buffer.from(packet.slice(STORAGE_PREFIX.length),'base64');
 frame[9]^=1;
 assert.throws(()=>unpackText(STORAGE_PREFIX+frame.toString('base64')),/integrity/);
 frame[9]^=1;frame[4]=0xff;
 assert.throws(()=>unpackText(STORAGE_PREFIX+frame.toString('base64')),/Corrupt/);
 frame[4]=1;frame.writeUInt32BE(0xfffffffe,5);
 assert.throws(()=>unpackText(STORAGE_PREFIX+frame.toString('base64')),/limit/);
 assert.throws(()=>unpackText(STORAGE_PREFIX+'!!!'),/Invalid/);
 assert.throws(()=>packText('x'.repeat(121),{maxBytes:100}),/limit/);
});
