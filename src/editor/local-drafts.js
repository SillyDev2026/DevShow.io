// Recoverable local edits for an authenticated collaborator.
// This storage is device-local and is not encrypted: avoid using shared computers.
const PREFIX='devshow-local-draft-v3';
const LIMIT=90000;
const MAX_AGE=30*86400000;
const textBytes=text=>new TextEncoder().encode(text).byteLength;
export const localDraftKey=(origin,userId,projectId,documentId)=>
  [PREFIX,origin,userId,projectId,documentId].map(encodeURIComponent).join(':');
export function writeLocalDraft(scope,content,baseRevision,storage=globalThis.localStorage){
  if(typeof content!=='string'||textBytes(content)>LIMIT||!Number.isSafeInteger(baseRevision)||baseRevision<0)return false;
  try{storage.setItem(localDraftKey(...scope),JSON.stringify({content,baseRevision,savedAt:Date.now()}));return true;}catch{return false;}
}
export function readLocalDraft(scope,storage=globalThis.localStorage){
  try{
    const data=JSON.parse(storage.getItem(localDraftKey(...scope))||'null');
    if(!data||typeof data.content!=='string'||textBytes(data.content)>LIMIT||!Number.isSafeInteger(data.baseRevision)||data.baseRevision<0||!Number.isSafeInteger(data.savedAt)||data.savedAt>Date.now()+60000||Date.now()-data.savedAt>MAX_AGE)return null;
    return data;
  }catch{return null;}
}
export function removeLocalDraft(scope,storage=globalThis.localStorage){
  try{storage.removeItem(localDraftKey(...scope));return true;}catch{return false;}
}
