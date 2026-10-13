export const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const number = x => new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(Number(x)||0);
export const when = x => x ? new Date(String(x).replace(' ','T')+'Z').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : '';
export const href = value => {try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?esc(u.href):'#';}catch{return '#';}};
export const fields=(name,label,value='',extra='')=>`<label class="field"><span>${esc(label)}</span><input name="${name}" value="${esc(value)}" ${extra}></label>`;
export const area=(name,label,value='',extra='')=>`<label class="field"><span>${esc(label)}</span><textarea name="${name}" ${extra}>${esc(value)}</textarea></label>`;
export const badge=(text,css='')=>`<span class="badge ${css}">${esc(text)}</span>`;
export const avatar=(name,color='#a8ffa9',size='')=>`<span class="avatar ${size}" style="--avatar-color:${/^#[0-9a-f]{6}$/i.test(color)?color:'#a8ffa9'}" aria-hidden="true">${esc(String(name||'D').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase())}</span>`;
export const empty=(icon,title,desc,button='')=>`<section class="empty"><div class="empty-icon">${icon}</div><h3>${esc(title)}</h3><p>${esc(desc)}</p>${button}</section>`;
export function projectCard(p,people,liked,saved){
  const author=people.find(x=>x.id===p.creatorId)||{name:'Developer',handle:'unknown',color:'#a8ffa9'};
  const letter=esc(p.title[0]||'D');
  return `<article class="project-card"><button class="project-cover" data-action="detail" data-id="${esc(p.id)}" style="--cover-hue:${(p.title.length*23+p.category.length*31)%360}deg" aria-label="Open ${esc(p.title)}">${p.cover?`<img alt="" loading="lazy" src="${href(p.cover)}">`:`<span class="cover-monogram">${letter}</span>`}<span class="cover-icon">↗</span></button>
  <div class="project-content"><div class="card-kicker">${badge(p.category)} ${p.visibility!=='public'?badge(p.visibility,'visibility'):''}</div><button class="project-title" data-action="detail" data-id="${esc(p.id)}">${esc(p.title)}</button><p class="tagline">${esc(p.tagline)}</p><div class="tag-row">${(p.tags||[]).slice(0,3).map(t=>badge(t,'tag')).join('')}</div>
  <div class="card-footer"><button class="author-btn" data-action="profile" data-id="${esc(author.id)}">${avatar(author.name,author.color)}<span>@${esc(author.handle)}</span></button><div class="card-reactions"><button title="Like project" aria-label="Like ${esc(p.title)}" class="reaction ${liked.includes(p.id)?'selected':''}" data-action="like" data-id="${esc(p.id)}">♥ <span>${number(p.likes)}</span></button><button title="Bookmark" aria-label="Bookmark ${esc(p.title)}" class="reaction ${saved.includes(p.id)?'selected':''}" data-action="bookmark" data-id="${esc(p.id)}">${saved.includes(p.id)?'◆':'◇'}</button></div></div></div></article>`;
}
