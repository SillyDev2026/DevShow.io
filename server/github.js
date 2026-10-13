// GitHub API proxy. Never accepts arbitrary destinations or redirects.
const cache = new Map();
const MAX_CACHE = 250;
const TTL = 5 * 60_000;
export function parseGitHubRepo(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com' || url.username || url.password || url.port || url.search || url.hash) return null;
    const parts = url.pathname.replace(/\/$/, '').replace(/\.git$/i, '').split('/').filter(Boolean);
    if (parts.length !== 2 || !parts.every(x => /^(?!\.)(?!.*\.\.)[a-z\d_.-]{1,100}$/i.test(x))) return null;
    return { owner:parts[0], repo:parts[1], url:`https://github.com/${parts[0]}/${parts[1]}` };
  } catch { return null; }
}
export async function githubMetadata(repoUrl) {
  const parsed = parseGitHubRepo(repoUrl);
  if (!parsed) { const e = new Error('Enter a public GitHub repository URL in the form https://github.com/owner/repo.'); e.status = 400; throw e; }
  const key = `${parsed.owner}/${parsed.repo}`.toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`, {
      headers: { Accept:'application/vnd.github+json', 'User-Agent':'DevShow-Community/2.2', ...(process.env.GITHUB_TOKEN ? { Authorization:`Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
      signal:controller.signal, redirect:'error'
    });
    if (!response.ok) { const e = new Error(response.status===404 ? 'Public repository not found.' : response.status===403 || response.status===429 ? 'GitHub API rate limit reached.' : 'GitHub metadata is unavailable.'); e.status=response.status===404?404:502; throw e; }
    const repo = await response.json();
    if (repo.private || repo.visibility === 'private' || repo.disabled) { const e=new Error('This repository is not publicly accessible.'); e.status=404; throw e; }
    const data = {
      fullName:String(repo.full_name || key).slice(0,220), name:String(repo.name || parsed.repo).slice(0,100),
      description:String(repo.description || '').slice(0,500), url:parsed.url,
      owner:String(repo.owner?.login || parsed.owner).slice(0,100), language:String(repo.language || '').slice(0,80),
      stars:Number(repo.stargazers_count || 0), forks:Number(repo.forks_count || 0),
      openIssues:Number(repo.open_issues_count || 0), license:String(repo.license?.spdx_id || '').slice(0,80),
      topics:Array.isArray(repo.topics) ? repo.topics.slice(0,10).map(x=>String(x).slice(0,40)) : [],
      defaultBranch:String(repo.default_branch || '').slice(0,100), updatedAt:repo.pushed_at || null,
      issuesUrl:repo.has_issues ? `${parsed.url}/issues` : '', pullRequestsUrl:`${parsed.url}/pulls`,
      releasesUrl:`${parsed.url}/releases`, contributingUrl:`${parsed.url}/blob/${encodeURIComponent(repo.default_branch || 'main')}/CONTRIBUTING.md`
    };
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
    cache.set(key, {expires:Date.now()+TTL,data});
    return data;
  } catch (e) { if(e.name==='AbortError'){const err=new Error('GitHub API timed out.');err.status=504;throw err;} throw e; }
  finally { clearTimeout(timeout); }
}
