import {api,serverUrl,configureServer,saveSession,clearSession,token} from './api.js';
import {esc,number,when,href,badge,avatar,empty} from './components.js';
import {layout,allViews,modal,projectForm,profileForm,pages} from './views.js';

const app=document.querySelector('#app');
const savedView=(()=>{try{return localStorage.getItem('devshow-layout')==='list'?'list':'grid';}catch{return 'grid';}})();
const state={view:savedView,page:'discover',query:'',category:'All',sort:'newest',projects:[],myProjects:[],creators:[],user:null,liked:[],saved:[],following:[],boards:[],notifications:[],updates:{},comments:{},stats:{developers:0,projects:0,comments:0},profile:null,boardId:null,connected:false,error:'',server:serverUrl()};
let dialog='',dialogReturn=null,latestDetail=null,busy=false;
const byId=id=>[...state.myProjects,...state.projects].find(p=>p.id===id);
const notify=msg=>{const element=document.querySelector('#toast');if(element){element.textContent=msg;element.classList.add('show');setTimeout(()=>element.classList.remove('show'),3400);}document.querySelector('#live-status').textContent=msg;};
const render=()=>{document.documentElement.dataset.theme='dark';app.innerHTML=layout(state,allViews(state));if(dialog)document.querySelector('#dialog-layer').innerHTML=dialog;};
const content=()=>{const node=document.querySelector('#main-content');if(node)node.innerHTML=(state.error?`<div class="error-notice" role="alert">${esc(state.error)}</div>`:'')+allViews(state);};
const closeDialog=()=>{dialog='';const layer=document.querySelector('#dialog-layer');if(layer)layer.innerHTML='';document.body.classList.remove('dialog-open');dialogReturn?.focus?.();dialogReturn=null;};
const show=(title,body)=>{dialogReturn=document.activeElement;dialog=modal(title,body);document.querySelector('#dialog-layer').innerHTML=dialog;document.body.classList.add('dialog-open');document.querySelector('#scrim .icon-button')?.focus();};
const requireUser=()=>{if(state.user)return true;openAuth();notify('Sign in to use community features.');return false;};
const isMine=p=>p&&state.user?.id===p.creatorId;
const call=async (endpoint,method='POST',data)=>{const result=await api(endpoint,{method,data});await refresh(true);return result;};
async function refresh(silent=false){
  if(!serverUrl()){state.connected=false;state.error='No public Node.js API is connected. Open Settings to connect your server.';render();return;}
  try{
    const data=await api('/bootstrap');
    Object.assign(state,{connected:true,error:'',projects:data.projects||[],myProjects:data.myProjects||[],creators:data.creators||[],user:data.user||null,liked:data.liked||[],saved:data.saved||[],following:data.following||[],boards:data.boards||[],notifications:data.notifications||[],updates:data.updates||{},comments:data.comments||{},server:serverUrl()});
    state.stats=await api('/stats').catch(()=>({developers:state.creators.length,projects:state.projects.length,comments:0}));
    render();
  }catch(e){state.connected=false;state.error=`Could not reach the DevShow API: ${e.message}`;if(!silent)notify(state.error);render();}
}
const openAuth=()=>show('Join DevShow',`<div class="auth-intro"><div class="brand-symbol">{ }</div><h3>Your people are building here.</h3><p>Sign in or create an account to publish, follow and save.</p></div><div class="auth-tabs"><button data-action="auth-tab" data-value="login" class="active" id="tab-login">Sign in</button><button data-action="auth-tab" data-value="register" id="tab-register">Create account</button></div><form id="auth-form" class="form-stack"><input type="hidden" name="mode" value="login"><div id="register-fields" hidden><label class="field"><span>Display name</span><input name="name" autocomplete="name"></label><label class="field"><span>Username</span><input name="handle" autocomplete="username"></label></div><label class="field"><span>Email or username</span><input name="email" required autocomplete="username"></label><label class="field"><span>Password</span><input name="password" type="password" required minlength="10" autocomplete="current-password"></label><button class="button accent-btn full">Continue →</button></form>`);
function openProject(p){if(!requireUser())return;show(p?'Edit project':'Share your project',projectForm(p));}
async function openDetail(id){
  try{
    const data=await api(`/projects/${encodeURIComponent(id)}`);latestDetail=data;
    const p=data.project,c=data.creator;const mine=isMine(p);
    show(p.title,`<div class="detail-header"><div class="detail-splash" style="--cover-hue:${(p.title.length*23+p.category.length*31)%360}deg">${p.cover?`<img src="${href(p.cover)}" alt="">`:`<span>${esc(p.title[0]||'D')}</span>`}</div><div class="detail-summary"><div class="tag-row">${badge(p.category)} ${badge(p.visibility)}</div><h2>${esc(p.title)}</h2><p>${esc(p.tagline)}</p><button class="author-btn" data-action="profile" data-id="${esc(c.id)}">${avatar(c.name,c.color)} @${esc(c.handle)}</button><div class="detail-stats">♥ ${number(p.likes)} likes &nbsp; ◌ ${number(p.views)} views &nbsp; ▤ ${number(p.comments)} comments</div></div></div>
    <div class="detail-buttons">${p.repo?`<a class="button outline-btn" href="${href(p.repo)}" target="_blank" rel="noopener">↗ Source code</a><button class="button outline-btn" data-action="github" data-id="${esc(p.id)}">GitHub stats</button>`:''}${p.website?`<a class="button outline-btn" href="${href(p.website)}" target="_blank" rel="noopener">↗ Live website</a>`:''}<button class="button outline-btn" data-action="share" data-id="${esc(p.id)}">↗ Copy link</button>${mine?`<button class="button outline-btn" data-action="edit" data-id="${esc(p.id)}">Edit</button><button class="button ghost-btn" data-action="delete-project" data-id="${esc(p.id)}">Delete</button>`:`<button class="button outline-btn" data-action="like" data-id="${esc(p.id)}">♥ Like</button><button class="button outline-btn" data-action="bookmark" data-id="${esc(p.id)}">◇ Save</button>`}</div>
    <div class="detail-section"><h3>About the project</h3><p class="preline">${esc(p.description)}</p><div class="tag-row">${p.tags.map(t=>badge(t,'tag')).join('')}</div></div>
    ${mine?`<div class="detail-section"><button class="button accent-btn small" data-action="build-log" data-id="${esc(p.id)}">＋ Add build update</button></div>`:''}
    <div class="detail-section"><h3>Build updates <span class="muted">(${data.updates.length})</span></h3>${data.updates.length?data.updates.map(u=>`<div class="feed-message"><b>${esc(u.title)}</b> ${badge(u.version||'Update','tag')} <small>${when(u.date)}</small><p class="preline">${esc(u.body)}</p></div>`).join(''):'<p class="muted">No updates published yet.</p>'}</div>
    <div class="detail-section"><h3>Discussion <span class="muted">(${data.comments.length})</span></h3>${data.comments.map(x=>`<div class="feed-message"><b>${esc(x.name)}</b><small>${when(x.createdAt)}</small><p class="preline">${esc(x.text)}</p></div>`).join('')}${state.user&&p.visibility!=='private'?`<form id="comment-form" data-id="${esc(p.id)}" class="comment-form"><textarea name="text" rows="2" placeholder="Share constructive feedback..." required minlength="2" maxlength="500"></textarea><button class="button accent-btn small">Post comment →</button></form>`:'<p class="muted">Sign in to join the conversation.</p>'}</div>
    ${state.user?`<div class="detail-section"><button class="button outline-btn small" data-action="board-pick" data-id="${esc(p.id)}">＋ Add to collection</button></div>`:''}`);
  }catch(e){notify(e.message);}
}
async function openProfile(id){
  const u=state.creators.find(x=>x.id===id)||state.user&&state.user.id===id&&state.user;
  if(!u){notify('Developer not found.');return;}
  closeDialog();state.profile=u;state.page='profile';history.replaceState(null,'',`#profile-${encodeURIComponent(u.handle)}`);render();
}
async function route(){
  const hash=decodeURIComponent(location.hash.slice(1)||'discover');
  if(hash.startsWith('project-')){state.page='discover';render();if(state.connected)await openDetail(hash.slice(8));return;}
  if(hash.startsWith('profile-')){const handle=hash.slice(8);try{state.profile=(await api(`/users/${encodeURIComponent(handle)}`)).user;}catch{state.profile=null;}state.page='profile';}
  else{state.page=pages.some(x=>x[0]===hash)?hash:'discover';state.boardId=null;}
  closeDialog();render();window.scrollTo(0,0);
}
const click=async e=>{
  if(e.target.id==='scrim'){closeDialog();return;}
  const element=e.target.closest('[data-action]');if(!element)return;
  const action=element.dataset.action,id=element.dataset.id;
  try{
    if(action==='close')closeDialog();
    else if(action==='focus-search'){const bar=document.querySelector('.topbar');bar?.classList.add('search-active');const field=document.querySelector('#global-search');field?.focus();field?.select();}
    else if(action==='view'){state.view=element.dataset.value==='list'?'list':'grid';try{localStorage.setItem('devshow-layout',state.view);}catch{}content();}
    else if(action==='quick-category'){state.category=element.dataset.value;location.hash='explore';if(state.page==='explore')content();}
    else if(action==='menu')show('Navigation',`<div class="menu-links">${pages.map(([key,icon,label])=>`<a href="#${key}">${icon} ${esc(label)}</a>`).join('')}</div>`);
    else if(action==='auth')openAuth();
    else if(action==='auth-tab'){
      const mode=element.dataset.value;document.querySelector('#auth-form [name="mode"]').value=mode;
      document.querySelector('#register-fields').hidden=mode==='login';
      document.querySelectorAll('.auth-tabs button').forEach(x=>x.classList.toggle('active',x.dataset.value===mode));
      document.querySelector('#auth-form [name="password"]').autocomplete=mode==='register'?'new-password':'current-password';
    }
    else if(action==='new')openProject(null);
    else if(action==='import-github'){if(requireUser())show('Import GitHub repository',`<p class="muted">Import public repository metadata, then review your showcase before publishing.</p><form id="import-form" class="form-stack"><label class="field"><span>GitHub repository URL</span><input name="url" type="url" placeholder="https://github.com/owner/repo" required></label><button class="button accent-btn full">Preview repository →</button></form>`);}
    else if(action==='edit')openProject(byId(id));
    else if(action==='detail'){history.replaceState(null,'',`#project-${encodeURIComponent(id)}`);await openDetail(id);}
    else if(action==='profile')await openProfile(id);
    else if(action==='profile-self')await openProfile(state.user.id);
    else if(action==='category'){state.category=element.dataset.value;content();}
    else if(action==='retry')await refresh();
    else if(action==='edit-profile'){if(requireUser())show('Edit your profile',profileForm(state.user,state.myProjects));}
    else if(action==='logout'){if(state.user)await api('/auth/logout',{method:'POST'}).catch(()=>{});clearSession();await refresh(true);notify('Signed out.');}
    else if(action==='like'||action==='bookmark'){
      if(!requireUser())return;await call(`/projects/${id}/${action}`);if(dialog&&latestDetail?.project.id===id)await openDetail(id);notify(action==='like'?'Reaction updated':'Saved projects updated');
    }
    else if(action==='follow'){if(!requireUser())return;await call(`/users/${id}/follow`);notify('Following updated');}
    else if(action==='new-board'){if(requireUser())show('Create collection',`<form id="board-form" class="form-stack"><label class="field"><span>Collection name</span><input name="name" required maxlength="50"></label><label class="field"><span>Description</span><textarea name="description" maxlength="160"></textarea></label><button class="button accent-btn full">Create</button></form>`);}
    else if(action==='open-board'){state.boardId=id;content();}
    else if(action==='back-board'){state.boardId=null;content();}
    else if(action==='delete-board'){if(confirm('Delete this collection?')){await call(`/collections/${id}`,'DELETE');notify('Collection deleted');}}
    else if(action==='board-pick'){
      show('Add to collection',`<div class="board-picker">${state.boards.map(b=>`<button class="button outline-btn" data-action="board-toggle" data-id="${esc(b.id)}" data-project="${esc(id)}">${esc(b.name)} ${b.projects.includes(id)?'✓':''}</button>`).join('')||'<p>Create a collection first in the Collections section.</p>'}</div>`);
    }
    else if(action==='board-toggle'){await call(`/collections/${id}/projects`,'POST',{projectId:element.dataset.project});notify('Collection updated');closeDialog();}
    else if(action==='delete-project'){if(confirm('Permanently delete your project and its discussion?')){await call(`/projects/${id}`,'DELETE');closeDialog();location.hash='studio';notify('Project deleted');}}
    else if(action==='build-log')show('Publish a build update',`<form id="log-form" class="form-stack" data-id="${esc(id)}"><label class="field"><span>Version</span><input name="version" placeholder="v1.0.0"></label><label class="field"><span>Update title</span><input name="title" required maxlength="90"></label><label class="field"><span>What changed?</span><textarea name="body" minlength="10" required maxlength="1600"></textarea></label><button class="button accent-btn full">Publish update</button></form>`);
    else if(action==='github'){
      show('GitHub repository',`<p class="muted">Loading verified GitHub statistics...</p>`);
      try{const result=await api(`/projects/${id}/github`);const r=result.repository;show('GitHub repository',`<h3>${esc(r.fullName)}</h3><p class="muted">${esc(r.description)}</p><div class="github-grid"><div>★ <b>${number(r.stars)}</b><small>Stars</small></div><div>⑂ <b>${number(r.forks)}</b><small>Forks</small></div><div>◎ <b>${number(r.openIssues)}</b><small>Open issues</small></div><div>⌘ <b>${esc(r.license||'Unspecified')}</b><small>License</small></div></div><div class="detail-buttons"><a class="button outline-btn" href="${href(r.url)}" target="_blank" rel="noopener">Repository ↗</a><a class="button outline-btn" href="${href(r.issuesUrl)}" target="_blank" rel="noopener">Issues ↗</a><a class="button outline-btn" href="${href(r.pullRequestsUrl)}" target="_blank" rel="noopener">Pull requests ↗</a><a class="button outline-btn" href="${href(r.releasesUrl)}" target="_blank" rel="noopener">Releases ↗</a></div>`);}catch(err){show('GitHub repository',`<p>${esc(err.message)}</p>`);}
    }
    else if(action==='share'){
      const link=new URL(location.href);link.hash=`project-${id}`;
      await navigator.clipboard.writeText(link.href);notify('Project link copied.');
    }
    else if(action==='export'){if(!requireUser())return;const data=await api('/me/export');const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`devshow-account-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);notify('Account export downloaded.');}
    else if(action==='change-password'){if(requireUser())show('Change password',`<form id="password-form" class="form-stack"><label class="field"><span>Current password</span><input name="currentPassword" type="password" autocomplete="current-password" required></label><label class="field"><span>New password (10+ characters)</span><input name="newPassword" type="password" autocomplete="new-password" minlength="10" required></label><button class="button accent-btn full">Change password</button></form>`);}
    else if(action==='notifications'){
      if(!requireUser())return;
      show('Notifications',`<div class="notification-list">${state.notifications.length?state.notifications.map(n=>`<div class="feed-message"><b>${esc(n.actor)}</b> ${esc(n.kind)} ${n.projectId?'on a project':''}<small>${when(n.createdAt)}</small></div>`).join(''):'<p>No notifications yet.</p>'}</div><button data-action="read-notifications" class="button accent-btn full">Mark as read</button>`);
    }
    else if(action==='read-notifications'){await call('/notifications');closeDialog();notify('Notifications marked as read');}
  }catch(err){notify(err.message);}
};
async function submitted(e){
  const form=e.target;if(!['auth-form','import-form','project-form','profile-form','board-form','log-form','comment-form','server-form','password-form'].includes(form.id))return;
  e.preventDefault();if(busy)return;busy=true;const submit=form.querySelector('button[type="submit"],button:not([type])');if(submit)submit.disabled=true;
  const data=Object.fromEntries(new FormData(form));
  try{
    if(form.id==='server-form') {configureServer(data.url);await refresh();location.hash='discover';notify('Server configuration updated.');}
    else if(form.id==='auth-form'){
      const mode=data.mode;const result=await api(`/auth/${mode}`,{method:'POST',data});saveSession(result.token);closeDialog();await refresh();notify(mode==='register'?'Welcome to DevShow!':'Welcome back!');
    }
    else if(form.id==='import-form'){const result=await api('/github/repository?url='+encodeURIComponent(data.url));const r=result.repository;const description=r.description||`Open-source repository ${r.fullName}, maintained on GitHub. Explore its code, issues and release history.`;openProject({title:r.name.slice(0,70),tagline:(r.description||`Open-source project by ${r.owner}`).slice(0,140),description:description.length>=20?description:`Repository ${r.fullName} shared by ${r.owner}.`,category:'Open Source',tags:[r.language,...r.topics].filter(Boolean).slice(0,6),repo:r.url,website:''});notify('Review the project before publishing.');}
    else if(form.id==='project-form'){
      if(!requireUser())return;data.tags=data.tags.split(',').map(x=>x.trim()).filter(Boolean);const id=form.dataset.id;await call(id?`/projects/${id}`:'/projects',id?'PATCH':'POST',data);closeDialog();state.page='studio';history.replaceState(null,'','#studio');render();notify(id?'Project updated':'Project published!');
    }
    else if(form.id==='profile-form'){
      data.skills=data.skills.split(',').map(x=>x.trim()).filter(Boolean);const result=await call('/me','PATCH',data);state.user=result.user;state.profile=result.user;closeDialog();render();notify('Profile saved.');
    }
    else if(form.id==='board-form'){await call('/collections','POST',data);closeDialog();notify('Collection created.');}
    else if(form.id==='log-form'){const id=form.dataset.id;await call(`/projects/${id}/logs`,'POST',data);await openDetail(id);notify('Update published.');}
    else if(form.id==='comment-form'){const id=form.dataset.id;await call(`/projects/${id}/comments`,'POST',data);await openDetail(id);notify('Comment published.');}
    else if(form.id==='password-form'){await api('/me/password',{method:'POST',data});clearSession();closeDialog();await refresh();notify('Password changed. Sign in again.');}
  }catch(err){notify(err.message);}finally{busy=false;if(submit?.isConnected)submit.disabled=false;}
}
document.addEventListener('click',click);
document.addEventListener('submit',submitted);
document.addEventListener('focusout',e=>{if(e.target.id==='global-search')setTimeout(()=>{if(document.activeElement?.id!=='global-search')document.querySelector('.topbar')?.classList.remove('search-active');},100);});
document.addEventListener('input',e=>{if(e.target.id==='global-search'){state.query=e.target.value;state.page='explore';content();const link=document.querySelector('.location-crumb strong');if(link)link.textContent='Explore';}});
document.addEventListener('change',e=>{if(e.target.id==='sort'){state.sort=e.target.value;content();}});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(dialog)closeDialog();else document.querySelector('.topbar')?.classList.remove('search-active');}
  if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();document.querySelector('#global-search')?.focus();}
  if(dialog&&e.key==='Tab'){
    const focusables=[...document.querySelectorAll('.dialog button:not(:disabled),.dialog input:not(:disabled),.dialog textarea:not(:disabled),.dialog select:not(:disabled),.dialog a[href]')].filter(x=>x.offsetParent!==null);
    if(focusables.length){const at=focusables.indexOf(document.activeElement);if(e.shiftKey&&at===0){e.preventDefault();focusables.at(-1).focus();}else if(!e.shiftKey&&at===focusables.length-1){e.preventDefault();focusables[0].focus();}}
  }
});
window.addEventListener('hashchange',()=>route().catch(e=>notify(e.message)));
await refresh(true);
await route();
