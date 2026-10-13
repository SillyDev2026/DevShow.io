// DevShow Storage Codec v1. Uses adaptive raw fallback inspired by SillyDev2026/Compression.
import {brotliCompressSync,brotliDecompressSync,deflateRawSync,inflateRawSync,constants} from 'node:zlib';
import {createHash} from 'node:crypto';
export const STORAGE_PREFIX='\u001eDEVSHOW.Z1:';
const MAGIC='DSZ1',HEADER=13,MAX_DEFAULT=1048576;
const MODES={brotli:1,deflate:2};
const checksum=b=>createHash('sha256').update(b).digest().subarray(0,4);
function limitBytes(input,maxBytes){
  if(typeof input!=='string')throw new TypeError('Storage value must be text.');
  const bytes=Buffer.from(input,'utf8');
  if(bytes.length>maxBytes)throw new RangeError('Storage payload exceeds limit.');
  return bytes;
}
export function packText(input,{threshold=160,minSavings=16,maxBytes=MAX_DEFAULT}={}){
  const bytes=limitBytes(input,maxBytes);
  if(bytes.length<threshold)return input;
  let best=input,bestBytes=bytes.length;
  for(const [name,codec] of Object.entries(MODES)){
    let packed;
    try{
      packed=name==='brotli'
        ?brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:4}})
        :deflateRawSync(bytes,{level:6});
    }catch{continue;}
    const frame=Buffer.allocUnsafe(HEADER+packed.length);
    frame.write(MAGIC,0,'ascii');frame[4]=codec;frame.writeUInt32BE(bytes.length,5);
    checksum(bytes).copy(frame,9);packed.copy(frame,HEADER);
    const encoded=STORAGE_PREFIX+frame.toString('base64');
    const physical=Buffer.byteLength(encoded,'utf8');
    if(physical<bestBytes){best=encoded;bestBytes=physical;}
  }
  return bytes.length-bestBytes>=minSavings?best:input;
}
export function unpackText(input,{maxBytes=MAX_DEFAULT}={}){
  if(typeof input!=='string')throw new TypeError('Stored value must be text.');
  if(!input.startsWith(STORAGE_PREFIX))return limitBytes(input,maxBytes).toString('utf8');
  const b64=input.slice(STORAGE_PREFIX.length);
  if(!b64||b64.length%4!==0||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(b64))throw Error('Invalid compressed storage frame.');
  if(b64.length>maxBytes*2+256)throw RangeError('Compressed storage frame exceeds limit.');
  const frame=Buffer.from(b64,'base64');
  if(frame.length<=HEADER||frame.toString('ascii',0,4)!==MAGIC)throw Error('Invalid storage frame header.');
  const codec=frame[4],length=frame.readUInt32BE(5);
  if(!length||length>maxBytes)throw RangeError('Decoded storage size exceeds limit.');
  let result;
  try{
    if(codec===MODES.brotli)result=brotliDecompressSync(frame.subarray(HEADER),{maxOutputLength:length});
    else if(codec===MODES.deflate)result=inflateRawSync(frame.subarray(HEADER),{maxOutputLength:length});
    else throw Error('Unsupported storage codec.');
  }catch(e){throw Error('Corrupt compressed storage payload.',{cause:e});}
  if(result.length!==length||!checksum(result).equals(frame.subarray(9,13)))throw Error('Stored payload failed integrity check.');
  const text=result.toString('utf8');
  if(!Buffer.from(text,'utf8').equals(result))throw Error('Stored payload contains invalid UTF-8.');
  return text;
}
export function storageStats(stored,{maxBytes=MAX_DEFAULT}={}){
  const text=unpackText(stored,{maxBytes});
  const originalBytes=Buffer.byteLength(text),storedBytes=Buffer.byteLength(stored);
  return {codec:stored.startsWith(STORAGE_PREFIX)?'compressed':'raw',originalBytes,storedBytes,savedBytes:originalBytes-storedBytes};
}
export function formatStorageBytes(bytes){return (bytes/1024).toFixed(1)+' KiB';}
