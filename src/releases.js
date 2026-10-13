// Use GitHub Releases as the download authority. Never advertise an EXE that is absent.
export const RELEASE_API='https://api.github.com/repos/SillyDev2026/DevShow.io/releases/tags/desktop-latest';
const EXPECTED='DevShow-Desktop.exe';
export function selectExe(release){
  if(!release||release.tag_name!=='desktop-latest'||!Array.isArray(release.assets))return null;
  const asset=release.assets.find(a=>a.name===EXPECTED&&a.state==='uploaded'&&Number(a.size)>1000000&&typeof a.browser_download_url==='string');
  if(!asset)return null;
  const allowed=`https://github.com/SillyDev2026/DevShow.io/releases/download/desktop-latest/${EXPECTED}`;
  if(asset.browser_download_url!==allowed)return null;
  const checksum=release.assets.find(a=>a.name===`${EXPECTED}.sha256`&&a.state==='uploaded');
  return {url:allowed,bytes:asset.size,updated:asset.updated_at||'',checksum:checksum?.browser_download_url===`${allowed}.sha256`?`${allowed}.sha256`:''};
}
export async function getDesktopRelease(fetcher=fetch,timeout=7000){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
  try{const response=await fetcher(RELEASE_API,{headers:{Accept:'application/vnd.github+json'},signal:controller.signal,cache:'no-store'});
    if(response.status===404)return null;
    if(!response.ok)throw Error(`GitHub release check returned ${response.status}`);
    return selectExe(await response.json());
  }finally{clearTimeout(timer);}
}
let cache=null,requestedAt=0;
export async function hydrateRelease(force=false){
  const slot=document.querySelector('#windows-release');if(!slot)return;
  slot.textContent='Checking GitHub for a verified Windows EXE…';
  if(force||!cache||Date.now()-requestedAt>60000){requestedAt=Date.now();cache=getDesktopRelease().catch(e=>{cache=null;throw e;});}
  try{const info=await cache;if(!slot.isConnected)return;
    if(!info){slot.innerHTML='<p class="muted">A new Windows executable has not been published yet. Check the build status or retry.</p><button class="button outline-btn small" data-action="check-release">Check again</button>';return;}
    const link=document.createElement('a');link.className='button accent-btn';link.href=info.url;link.textContent='↓ Download DevShow-Desktop.exe';link.rel='noopener';
    const detail=document.createElement('p');detail.className='muted';detail.textContent=`Direct Windows EXE · ${(info.bytes/1048576).toFixed(1)} MB · Updated ${info.updated?new Date(info.updated).toLocaleDateString():'recently'}`;
    slot.replaceChildren(link,detail);
    if(info.checksum){const check=document.createElement('a');check.className='link';check.href=info.checksum;check.textContent='SHA-256 checksum';slot.append(check);}
  }catch(e){if(!slot.isConnected)return;slot.innerHTML='<p class="muted">Could not check releases. GitHub may be unavailable or rate-limited.</p><button class="button outline-btn small" data-action="check-release">Retry download check</button>';}
}
