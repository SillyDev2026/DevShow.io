import {hydrateV28,handleV28Click,handleV28Submit,v28ProjectTools} from './v28.js';
import {dashboardEditor,notificationEditor,teamEditor,syncEditor,suggestionsDialog,treeEditor} from './v27.js';
import {hydrateRelease} from './releases.js';
import {api,serverUrl,configureServer,saveSession,clearSession,token,probeServer} from './api.js';
import {esc,number,when,href,badge,avatar,empty} from './components.js';
import {layout,allViews,modal,projectForm,profileForm,pages} from './views.js';
import {projectExtras} from './v26.js';
import {startLive,stopLive} from './live.js';

const app=document.querySelector('#app');
const savedView=(()=>{try{return localStorage.getItem('devshow-layout')==='list'?'list':'grid';}catch{return 'grid';}})();
const state={view:savedView,page:'discover',query:'',category:'All',sort:'newest',projects:[],myProjects:[],creators:[],user:null,liked:[],saved:[],following:[],boards:[],notifications:[],updates:{},comments:{},stats:{developers:0,projects:0,comments:0},profile:null,boardId:null,connected:false,error:'',server:serverUrl(),posts:[],groups:[],groupId:null,groupPosts:[],conversations:[],peer:null,peerName:'',messages:[],dashboardWidgets:['projects','activity','notifications'],recentActivity:[],teams:[],launches:[],reputationLeaders:[],myReputation:null,notificationPrefs:null,syncState:null};
let dialog='',dialogReturn=null,latestDetail=null,busy=false;
const byId=id=>[...state.myProjects,...state.projects].find(p=>p.id===id);
const notify=msg=>{const element=document.querySelector('#toast');if(element){element.textContent=msg;element.classList.add('show');setTimeout(()=>element.classList.remove('show'),3400);}document.querySelector('#live-status').textContent=msg;};
const render=()=>{document.documentElement.dataset.theme='dark';app.innerHTML=layout(state,allViews(state));if(dialog)document.querySelector('#dialog-layer').innerHTML=dialog;if(state.page==='downloads')queueMicrotask(()=>hydrateRelease());if(state.page==='workspace'&&state.connected)queueMicrotask(()=>hydrateV28(state.user,notify));};
const content=()=>{const node=document.querySelector('#main-content');if(node)node.innerHTML=(state.error?`<div class="error-notice" role="alert">${esc(state.error)}</div>`:'')+allViews(state);if(state.page==='downloads')queueMicrotask(()=>hydrateRelease());if(state.page==='workspace'&&state.connected)queueMicrotask(()=>hydrateV28(state.user,notify));};
const closeDialog=()=>{dialog='';const layer=document.querySelector('#dialog-layer');if(layer)layer.innerHTML='';document.body.classList.remove('dialog-open');dialogReturn?.focus?.();dialogReturn=null;};
const show=(title,body)=>{dialogReturn=document.activeElement;dialog=modal(title,body);document.querySelector('#dialog-layer').innerHTML=dialog;document.body.classList.add('dialog-open');document.querySelector('#scrim .icon-button')?.focus();};
const requireUser=()=>{if(state.user)return true;openAuth();notify('Sign in to use community features.');return false;};
const isMine=p=>p&&state.user?.id===p.creatorId;
const call=async (endpoint,method='POST',data)=>{const result=await api(endpoint,{method,data});await refresh(true);return result;};
async function loadFeature(){
  try{if(state.page==='feed')state.posts=(await api('/feed')).posts;
    if(state.page==='groups'){state.groups=(await api('/groups')).groups;if(state.groupId)state.groupPosts=(await api(`/groups/${state.groupId}/posts`)).posts;}
    if(state.page==='messages'&&state.user){state.conversations=(await api('/conversations')).conversations;if(state.peer){const data=await api(`/messages/${state.peer}`);state.messages=data.messages;state.peerName=data.with.name;}}
    if(state.page==='dashboard'&&state.user){const [d,t,r]=await Promise.all([api('/v2/dashboard'),api('/v2/teams'),api(`/v2/reputation/${state.user.id}`)]);state.dashboardWidgets=d.widgets;state.teams=t.teams;state.myReputation=r.reputation;}
    if(state.page==='activity'||state.page==='dashboard')state.recentActivity=(await api('/v2/activity')).items;
    if(state.page==='teams'&&state.user)state.teams=(await api('/v2/teams')).teams;
    if(state.page==='launches'||state.page==='dashboard')state.launches=(await api('/v2/launches')).launches;
    if(state.page==='reputation')state.reputationLeaders=(await api('/v2/reputation')).leaders;
  }catch(e){notify(e.message);}
}
async function refresh(silent=false){
  if(!serverUrl()){state.connected=false;state.error='No public Node.js API is connected. Open Settings to connect your server.';render();return;}
  try{
    const data=await api('/bootstrap');
    Object.assign(state,{connected:true,error:'',projects:data.projects||[],myProjects:data.myProjects||[],creators:data.creators||[],user:data.user||null,liked:data.liked||[],saved:data.saved||[],following:data.following||[],boards:data.boards||[],notifications:data.notifications||[],updates:data.updates||{},comments:data.comments||{},server:serverUrl()});
    state.stats=await api('/stats').catch(()=>({developers:state.creators.length,projects:state.projects.length,comments:0}));
    render();startLive(async()=>{if(!busy){await refresh(true);await loadFeature();content();}});
  }catch(e){state.connected=false;state.error=`Could not reach the DevShow API: ${e.message}`;if(!silent)notify(state.error);render();}
}
const openAuth=()=>show('Join DevShow',`<div class="auth-intro"><div class="brand-symbol">{ }</div><h3>Your people are building here.</h3><p>Sign in or create an account to publish, follow and save.</p></div><div class="auth-tabs"><button data-action="auth-tab" data-value="login" class="active" id="tab-login">Sign in</button><button data-action="auth-tab" data-value="register" id="tab-register">Create account</button></div><form id="auth-form" class="form-stack"><input type="hidden" name="mode" value="login"><div id="register-fields" hidden><label class="field"><span>Display name</span><input name="name" autocomplete="name"></label><label class="field"><span>Username</span><input name="handle" autocomplete="username"></label></div><label class="field"><span>Email or username</span><input name="email" required autocomplete="username"></label><label class="field"><span>Password</span><input name="password" type="password" required minlength="10" autocomplete="current-password"></label><button class="button accent-btn full">Continue →</button><button type="button" class="button outline-btn full" data-action="github-auth">Sign in with GitHub ↗</button></form>`);
function openProject(p){if(!requireUser())return;show(p?'Edit project':'Share your project',projectForm(p));}
async function openDetail(id){
  try{
    const data=await api(`/projects/${encodeURIComponent(id)}`);latestDetail=data;
    const p=data.project,c=data.creator;const mine=isMine(p);
    const [roadmap,feedback]=await Promise.all([api(`/projects/${id}/roadmap`).catch(()=>({items:[]})),api(`/projects/${id}/feedback`).catch(()=>({feedback:[]}))]);
    show(p.title,`<div class="detail-header"><div class="detail-splash" style="--cover-hue:${(p.title.length*23+p.category.length*31)%360}deg">${p.cover?`<img src="${href(p.cover)}" alt="">`:`<span>${esc(p.title[0]||'D')}</span>`}</div><div class="detail-summary"><div class="tag-row">${badge(p.category)} ${badge(p.visibility)}</div><h2>${esc(p.title)}</h2><p>${esc(p.tagline)}</p><button class="author-btn" data-action="profile" data-id="${esc(c.id)}">${avatar(c.name,c.color)} @${esc(c.handle)}</button><div class="detail-stats">♥ ${number(p.likes)} likes &nbsp; ◌ ${number(p.views)} views &nbsp; ▤ ${number(p.comments)} comments</div></div></div>
    <div class="detail-buttons">${p.repo?`<a class="button outline-btn" href="${href(p.repo)}" target="_blank" rel="noopener">↗ Source code</a><button class="button outline-btn" data-action="github" data-id="${esc(p.id)}">GitHub stats</button>`:''}${p.website?`<a class="button outline-btn" href="${href(p.website)}" target="_blank" rel="noopener">↗ Live website</a>`:''}<button class="button outline-btn" data-action="share" data-id="${esc(p.id)}">↗ Copy link</button>${mine?`<button class="button outline-btn" data-action="edit" data-id="${esc(p.id)}">Edit</button><button class="button ghost-btn" data-action="delete-project" data-id="${esc(p.id)}">Delete</button>`:`<button class="button outline-btn" data-action="like" data-id="${esc(p.id)}">♥ Like</button><button class="button outline-btn" data-action="bookmark" data-id="${esc(p.id)}">◇ Save</button>`}</div>
    <div class="detail-section"><h3>About the project</h3><p class="preline">${esc(p.description)}</p><div class="tag-row">${p.tags.map(t=>badge(t,'tag')).join('')}</div></div>
    ${mine?`<div class="detail-section"><button class="button accent-btn small" data-action="build-log" data-id="${esc(p.id)}">＋ Add build update</button></div>`:''}
    <div class="detail-section"><h3>Build updates <span class="muted">(${data.updates.length})</span></h3>${data.updates.length?data.updates.map(u=>`<div class="feed-message"><b>${esc(u.title)}</b> ${badge(u.version||'Update','tag')} <small>${when(u.date)}</small><p class="preline">${esc(u.body)}</p></div>`).join(''):'<p class="muted">No updates published yet.</p>'}</div>
    <div class="detail-section"><h3>Discussion <span class="muted">(${data.comments.length})</span></h3>${data.comments.map(x=>`<div class="feed-message"><b>${esc(x.name)}</b><small>${when(x.createdAt)}</small><p class="preline">${esc(x.text)}</p></div>`).join('')}${state.user&&p.visibility!=='private'?`<form id="comment-form" data-id="${esc(p.id)}" class="comment-form"><textarea name="text" rows="2" placeholder="Share constructive feedback..." required minlength="2" maxlength="500"></textarea><button class="button accent-btn small">Post comment →</button></form>`:'<p class="muted">Sign in to join the conversation.</p>'}</div>
    ${projectExtras({roadmap,feedback},mine)}${v28ProjectTools(p,mine)}<div class="detail-section"><h3>DevShow v2.7 tools</h3><div class="detail-buttons"><button class="button outline-btn small" data-action="demo-show" data-id="${esc(p.id)}">▶ Interactive demo</button><button class="button outline-btn small" data-action="code-tree" data-id="${esc(p.id)}">▤ Code explorer</button><button class="button outline-btn small" data-action="suggestions-show" data-id="${esc(p.id)}">▲ Suggestions</button><button class="button outline-btn small" data-action="project-launches" data-id="${esc(p.id)}">✦ Launch events</button>${mine?`<button class="button outline-btn small" data-action="demo-edit" data-id="${esc(p.id)}">⚙ Demo settings</button><button class="button outline-btn small" data-action="launch-create" data-id="${esc(p.id)}">＋ Schedule launch</button>`:''}</div></div><div class="detail-buttons"><button class="button outline-btn small" data-action="github-releases" data-id="${esc(p.id)}">Releases</button><button class="button outline-btn small" data-action="github-code" data-id="${esc(p.id)}">View code</button>${mine?`<button class="button outline-btn small" data-action="github-sync" data-id="${esc(p.id)}">Sync GitHub</button><button class="button outline-btn small" data-action="analytics" data-id="${esc(p.id)}">Analytics</button><button class="button outline-btn small" data-action="upload-project" data-id="${esc(p.id)}">Upload cover</button>`:''}</div>
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
  if(hash.startsWith('github-ticket=')){const ticket=hash.slice(14);history.replaceState(null,'','#studio');try{const login=await api('/auth/github/exchange',{method:'POST',data:{ticket}});saveSession(login.token);await refresh(true);notify('GitHub connected successfully.');}catch(e){notify(e.message);}state.page='studio';render();return;}
  if(hash.startsWith('project-')){state.page='discover';render();if(state.connected)await openDetail(hash.slice(8));return;}
  if(hash.startsWith('profile-')){const handle=hash.slice(8);try{state.profile=(await api(`/users/${encodeURIComponent(handle)}`)).user;}catch{state.profile=null;}state.page='profile';}
  else{state.page=pages.some(x=>x[0]===hash)?hash:'discover';state.boardId=null;}
  closeDialog();await loadFeature();render();window.scrollTo(0,0);
}
const click=async e=>{
  if(e.target.id==='scrim'){closeDialog();return;}
  const element=e.target.closest('[data-action]');if(!element)return;
  const action=element.dataset.action,id=element.dataset.id;
  try{
    if(await handleV28Click(element,{show,notify,state,openProject:openDetail,projectCreatorId:pid=>byId(pid)?.creatorId,closeDialog}))return;
    if(action==='close')closeDialog();
    else if(action==='focus-search'){const bar=document.querySelector('.topbar');bar?.classList.add('search-active');const field=document.querySelector('#global-search');field?.focus();field?.select();}
    else if(action==='dashboard-edit'){if(!requireUser())return;const d=await api('/v2/dashboard');show('Dashboard widgets',dashboardEditor(d.widgets));}
    else if(action==='notice-settings'){if(!requireUser())return;const d=await api('/v2/notifications/preferences');show('Notification preferences',notificationEditor(d.preferences));}
    else if(action==='sync-open'){if(!requireUser())return;state.syncState=await api('/v2/sync');show('Desktop and cloud draft sync',syncEditor(state.syncState));}
    else if(action==='sync-download'){if(!state.syncState)return;const blob=new Blob([JSON.stringify(state.syncState,null,2)],{type:'application/json'}),ref=URL.createObjectURL(blob);const a=document.createElement('a');a.href=ref;a.download='devshow-sync.json';a.click();URL.revokeObjectURL(ref);notify('Sync JSON downloaded.');}
    else if(action==='team-create'){if(requireUser())show('Create developer team',`<form id="v27-team-form" class="form-stack"><label class="field"><span>Team name</span><input name="name" minlength="3" required maxlength="65"></label><label class="field"><span>Description</span><textarea name="description" maxlength="320"></textarea></label><button class="button accent-btn">Create team</button></form>`);}
    else if(action==='team-open'){const d=await api(`/v2/teams/${id}`);show('Manage team',teamEditor(d,{...state.user,projects:state.myProjects}));}
    else if(action==='team-accept'||action==='team-decline'||action==='team-remove'){await call(`/v2/teams/${action==='team-remove'?element.dataset.team:id}/members`,'POST',{action:action.slice(5)==='remove'?'remove':action==='team-accept'?'accept':'decline',userId:id});state.teams=(await api('/v2/teams')).teams;closeDialog();render();notify('Membership updated.');}
    else if(action==='demo-show'){const d=await api(`/v2/projects/${id}/demo`);const url=d.url;if(!url){show('Interactive demo','<p>There is no interactive demo configured for this project.</p>');}else{show('External project demo',`<p class="muted">This preview loads third-party content in a restricted sandbox. Never enter passwords into an untrusted demo.</p><iframe class="v27-demo-frame" title="External project demo" referrerpolicy="no-referrer" loading="lazy" sandbox="allow-scripts" src="${href(url)}"></iframe><a class="button outline-btn" href="${href(url)}" target="_blank" rel="noopener noreferrer">Open original website ↗</a>`);}}
    else if(action==='demo-edit'){if(!requireUser())return;const d=await api(`/v2/projects/${id}/demo`);show('Edit project demo',`<form id="v27-demo-form" data-id="${esc(id)}" class="form-stack"><label class="field"><span>Public HTTPS demo URL</span><input type="url" name="url" value="${esc(d.url)}" placeholder="https://demo.example.com"></label><p class="muted">Only sites that permit framing will appear inline. Clear the field to remove.</p><button class="button accent-btn">Save demo</button></form>`);}
    else if(action==='code-tree'||action==='tree-open'||action==='tree-back'){const pid=action==='code-tree'?id:element.dataset.project;let path=action==='code-tree'?'':element.dataset.path||'';if(action==='tree-back')path=path.split('/').slice(0,-1).join('/');const d=await api(`/v2/projects/${pid}/code-tree?path=${encodeURIComponent(path)}`);show('GitHub file browser',treeEditor(d,pid));}
    else if(action==='tree-file'){const pid=element.dataset.project,path=element.dataset.path;const d=await api(`/projects/${pid}/github/code?path=${encodeURIComponent(path)}`);show(`Source · ${path}`,`<div class="detail-buttons"><button class="button outline-btn" data-action="tree-open" data-project="${esc(pid)}" data-path="${esc(path.split('/').slice(0,-1).join('/'))}">← Directory</button></div><pre class="source-preview"><code>${esc(d.content)}</code></pre>`);}
    else if(action==='suggestions-show'){const d=await api(`/v2/projects/${id}/suggestions`);show('Community suggestions',suggestionsDialog(d.items,byId(id)||{id,title:'Project'}));}
    else if(action==='suggestion-vote'){if(!requireUser())return;const pid=element.dataset.project;await api(`/v2/projects/${pid}/suggestions/${id}/vote`,{method:'POST'});const d=await api(`/v2/projects/${pid}/suggestions`);show('Community suggestions',suggestionsDialog(d.items,byId(pid)||{id:pid,title:'Project'}));}
    else if(action==='project-launches'){const d=await api(`/v2/projects/${id}/launches`);show('Launch calendar',d.launches.map(l=>`<div class="feed-message"><h3>${esc(l.title)}</h3><p>${esc(l.description)}</p><small>${when(l.scheduledAt)}</small>${isMine(byId(id))?`<button class="button small outline-btn" data-action="launch-remove" data-project="${esc(id)}" data-id="${esc(l.id)}">Cancel launch</button>`:''}</div>`).join('')||'<p>No launches scheduled yet.</p>');}
    else if(action==='launch-create'){show('Schedule a launch',`<form class="form-stack" id="v27-launch-form" data-id="${esc(id)}"><label class="field"><span>Launch title</span><input name="title" maxlength="90" required minlength="3"></label><label class="field"><span>Description</span><textarea name="description" maxlength="500"></textarea></label><label class="field"><span>Local launch date and time</span><input name="scheduledAt" type="datetime-local" required></label><button class="button accent-btn">Schedule launch</button></form>`);}
    else if(action==='launch-remove'){if(!confirm('Cancel this launch event?'))return;await api(`/v2/projects/${element.dataset.project}/launches/${id}`,{method:'DELETE'});notify('Launch cancelled');closeDialog();}
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
    else if(action==='check-release')await hydrateRelease(true);
    else if(action==='test-server'){const input=document.querySelector('#server-form [name="url"]');const status=document.querySelector('#server-health');if(status)status.textContent='Checking connection…';try{const result=await probeServer(input?.value?.trim()||serverUrl());if(status)status.textContent=`✓ API reachable · version ${result.version}`;}catch(e){if(status)status.textContent=`Connection failed: ${e.message}`;}}
    else if(action==='edit-profile'){if(requireUser())show('Edit your profile',profileForm(state.user,state.myProjects));}
    else if(action==='github-auth'){const result=await api('/auth/github/start');window.location.assign(result.url);}
    else if(action==='logout'){stopLive();if(state.user)await api('/auth/logout',{method:'POST'}).catch(()=>{});clearSession();await refresh(true);notify('Signed out.');}
    else if(action==='like'||action==='bookmark'){
      if(!requireUser())return;await call(`/projects/${id}/${action}`);if(dialog&&latestDetail?.project.id===id)await openDetail(id);notify(action==='like'?'Reaction updated':'Saved projects updated');
    }
    else if(action==='follow'){if(!requireUser())return;await call(`/users/${id}/follow`);notify('Following updated');}
    else if(action==='message-open'){if(!requireUser())return;state.peer=id;state.page='messages';history.replaceState(null,'','#messages');await loadFeature();render();}
    else if(action==='create-group'){if(requireUser())show('Create developer group',`<form id="group-form" class="form-stack"><label class="field"><span>Group name</span><input name="name" required minlength="3" maxlength="45"></label><label class="field"><span>Description</span><textarea name="description" maxlength="300"></textarea></label><button class="button accent-btn">Create group</button></form>`);}
    else if(action==='group-open'){state.groupId=id;await loadFeature();content();}
    else if(action==='group-join'){await call(`/groups/${id}/join`);await loadFeature();content();}
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
    else if(action==='upload-profile'){if(requireUser())show('Upload profile image',`<form id="media-form" class="form-stack"><label class="field"><span>Image purpose</span><select name="kind"><option value="avatar">Avatar</option><option value="banner">Banner</option></select></label><label class="field"><span>PNG / JPG / WebP (up to 1 MB)</span><input type="file" name="image" accept="image/png,image/jpeg,image/webp" required></label><button class="button accent-btn">Upload</button></form>`);}
    else if(action==='upload-project'){show('Upload project cover',`<form id="media-form" data-id="${esc(id)}" class="form-stack"><input type="hidden" name="kind" value="project"><label class="field"><span>Project cover (PNG/JPG/WebP, 1 MB)</span><input type="file" name="image" accept="image/png,image/jpeg,image/webp" required></label><button class="button accent-btn">Upload cover</button></form>`);}
    else if(action==='roadmap-add'){show('New roadmap milestone',`<form id="roadmap-form" class="form-stack" data-id="${esc(latestDetail.project.id)}"><label class="field"><span>Title</span><input name="title" required minlength="3" maxlength="100"></label><label class="field"><span>Description</span><textarea name="description" maxlength="1000"></textarea></label><button class="button accent-btn">Add milestone</button></form>`);}
    else if(action==='feedback-add'){if(requireUser())show('Suggest an improvement',`<form id="feedback-form" data-id="${esc(latestDetail.project.id)}" class="form-stack"><textarea name="body" required minlength="5" maxlength="1000" placeholder="What would make this project better?"></textarea><button class="button accent-btn">Submit feedback</button></form>`);}
    else if(action==='roadmap-status'||action==='feedback-status'){if(!latestDetail)return;const roadmap=action==='roadmap-status';show('Update status',`<form id="status-form" data-type="${roadmap?'roadmap':'feedback'}" data-item="${esc(id)}" data-id="${esc(latestDetail.project.id)}" class="form-stack"><select name="status">${(roadmap?['planned','in_progress','completed']:['open','accepted','completed','declined']).map(x=>`<option value="${x}">${x.replace('_',' ')}</option>`).join('')}</select><button class="button accent-btn">Save status</button></form>`);}
    else if(action==='analytics'){const d=await api(`/projects/${id}/analytics`);show('Project analytics',`<div class="dashboard-stats"><div><small>Views</small><strong>${number(d.views)}</strong></div><div><small>Likes</small><strong>${number(d.likes)}</strong></div><div><small>Comments</small><strong>${number(d.comments)}</strong></div><div><small>Suggestions</small><strong>${number(d.feedback)}</strong></div></div><h3>Recent daily views</h3><div class="analytics-bars">${d.daily.map(x=>`<div><small>${esc(x.day)}</small><meter min="0" max="${Math.max(1,...d.daily.map(y=>y.count))}" value="${x.count}"></meter><span>${x.count}</span></div>`).join('')||'No views yet.'}</div>`);}
    else if(action==='github-sync'){await call(`/projects/${id}/github/sync`);notify('GitHub metadata synced.');}
    else if(action==='github-releases'){const d=await api(`/projects/${id}/github/releases`);show('GitHub releases',d.releases.map(r=>`<div class="feed-message"><b>${esc(r.name||r.tag)}</b> ${badge(r.prerelease?'Prerelease':'Release','tag')}<p>${when(r.publishedAt)}</p><a class="button outline-btn small" href="${href(r.url)}" target="_blank" rel="noopener">View release ↗</a>${r.assets.map(a=>`<a class="button outline-btn small" href="${href(a.url)}" target="_blank" rel="noopener">${esc(a.name)}</a>`).join('')}</div>`).join('')||'<p>No public releases yet.</p>');}
    else if(action==='github-code'){show('Browse source code',`<form id="code-form" data-id="${esc(id)}" class="form-stack"><label class="field"><span>File path within repository</span><input name="path" placeholder="README.md or src/main.js" required></label><button class="button accent-btn">View file</button></form><div id="code-preview"></div>`);}
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
      show('Notifications',`<div class="notification-list">${state.notifications.length?state.notifications.map(n=>`<div class="feed-message"><b>${esc(n.actor)}</b> ${esc(n.kind)} ${n.projectId?'on a project':''}<small>${when(n.createdAt)}</small>${!n.read?`<button data-action="v28-notification-read" data-id="${esc(n.id)}" class="button small outline-btn">Mark read</button>`:''}</div>`).join(''):'<p>No notifications yet.</p>'}</div><div class="detail-buttons"><button data-action="read-notifications" class="button accent-btn">Mark as read</button><button data-action="notice-settings" class="button outline-btn">Notification settings</button></div>`);
    }
    else if(action==='read-notifications'){await call('/notifications');closeDialog();notify('Notifications marked as read');}
  }catch(err){notify(err.message);}
};
async function submitted(e){
  const form=e.target;if(form.id.startsWith('v28-')){e.preventDefault();await handleV28Submit(form,{notify,show,closeDialog});return;}if(!['auth-form','import-form','project-form','profile-form','board-form','log-form','comment-form','server-form','password-form','feed-form','group-form','group-post-form','message-form','roadmap-form','feedback-form','status-form','code-form','media-form','v27-dashboard-form','v27-notice-form','v27-team-form','v27-invite-form','v27-link-project-form','v27-demo-form','v27-launch-form','v27-sync-form'].includes(form.id))return;
  e.preventDefault();if(busy)return;busy=true;const submit=form.querySelector('button[type="submit"],button:not([type])');if(submit)submit.disabled=true;
  const data=Object.fromEntries(new FormData(form));
  try{
    if(form.id==='v27-dashboard-form'){const widgets=['projects','activity','notifications','teams','launches','reputation'].filter(w=>form.querySelector(`[name="show-${w}"]`)?.checked).sort((a,b)=>Number(data['order-'+a])-Number(data['order-'+b]));const d=await api('/v2/dashboard',{method:'PUT',data:{widgets}});state.dashboardWidgets=d.widgets;closeDialog();render();notify('Dashboard saved.');}
    else if(form.id==='v27-notice-form'){const prefs={};for(const k of ['messages','follows','projects','feedback'])prefs[k]=!!form.querySelector(`[name="${k}"]`)?.checked;await api('/v2/notifications/preferences',{method:'PUT',data:prefs});closeDialog();notify('Notification preferences saved.');}
    else if(form.id==='v27-team-form'){await api('/v2/teams',{method:'POST',data});state.teams=(await api('/v2/teams')).teams;closeDialog();render();notify('Team created.');}
    else if(form.id==='v27-invite-form'){await api(`/v2/teams/${form.dataset.id}/invite`,{method:'POST',data});const d=await api(`/v2/teams/${form.dataset.id}`);show('Manage team',teamEditor(d,{...state.user,projects:state.myProjects}));notify('Invitation sent.');}
    else if(form.id==='v27-link-project-form'){await api(`/v2/teams/${form.dataset.id}/projects`,{method:'POST',data});const d=await api(`/v2/teams/${form.dataset.id}`);show('Manage team',teamEditor(d,{...state.user,projects:state.myProjects}));notify('Project linked.');}
    else if(form.id==='v27-demo-form'){await api(`/v2/projects/${form.dataset.id}/demo`,{method:'PUT',data});closeDialog();notify('Demo settings saved.');}
    else if(form.id==='v27-launch-form'){const scheduledAt=new Date(data.scheduledAt);if(Number.isNaN(scheduledAt.getTime()))throw Error('Choose a valid date.');await api(`/v2/projects/${form.dataset.id}/launches`,{method:'POST',data:{title:data.title,description:data.description,scheduledAt:scheduledAt.toISOString()}});closeDialog();notify('Launch event scheduled.');}
    else if(form.id==='v27-sync-form'){let payload;try{payload=JSON.parse(data.payload);}catch{throw Error('Invalid sync JSON.');}const result=await api('/v2/sync',{method:'PUT',data:{revision:Number(form.dataset.revision),data:payload}});state.syncState=await api('/v2/sync');show('Desktop and cloud draft sync',syncEditor(state.syncState));notify(`Sync saved · revision ${result.revision}`);}
    else if(form.id==='feed-form'||form.id==='group-post-form'||form.id==='message-form'){const destination=form.id==='feed-form'?'/feed':form.id==='group-post-form'?`/groups/${form.dataset.id}/posts`:'/messages';const payload=form.id==='message-form'?{recipientId:form.dataset.id,body:data.body}:{body:data.body};await call(destination,'POST',payload);await loadFeature();content();notify('Published.');}
    else if(form.id==='group-form'){await call('/groups','POST',data);closeDialog();state.page='groups';await loadFeature();render();notify('Group created.');}
    else if(form.id==='roadmap-form'||form.id==='feedback-form'){const id=form.dataset.id;await call(`/projects/${id}/${form.id==='roadmap-form'?'roadmap':'feedback'}`,'POST',data);await openDetail(id);notify('Saved.');}
    else if(form.id==='status-form'){const id=form.dataset.id;await call(`/projects/${id}/${form.dataset.type}/${form.dataset.item}`,'PATCH',{status:data.status});await openDetail(id);notify('Status updated.');}
    else if(form.id==='code-form'){const d=await api(`/projects/${form.dataset.id}/github/code?path=${encodeURIComponent(data.path)}`);const preview=document.querySelector('#code-preview');if(preview)preview.innerHTML=`<h3>${esc(d.path)}</h3><pre class="source-preview"><code>${esc(d.content)}</code></pre>`;notify('File loaded.');}
    else if(form.id==='media-form'){const file=form.querySelector('input[type="file"]')?.files?.[0];if(!file||file.size>1048576)throw Error('Choose an image no larger than 1 MB.');const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let offset=0;offset<bytes.length;offset+=16384)binary+=String.fromCharCode(...bytes.subarray(offset,offset+16384));const res=await api('/media',{method:'POST',data:{kind:data.kind,projectId:form.dataset.id||undefined,base64:btoa(binary)}});if(data.kind==='project'){const p=byId(form.dataset.id);await call(`/projects/${p.id}`,'PATCH',{...p,cover:serverUrl()+res.media.url});await openDetail(p.id);}else{const profileData={...state.user,[data.kind==='avatar'?'avatarId':'bannerId']:res.media.id};const result=await call('/me','PATCH',profileData);state.user=result.user;state.profile=result.user;closeDialog();render();}notify('Image uploaded.');}
    else if(form.id==='server-form'){const url=String(data.url||'').trim();if(url)await probeServer(url);stopLive();configureServer(url);await refresh();location.hash='discover';notify(url?'API verified and connected.':'Server override cleared.');}
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
