import {db} from './db.js';
const columns = table => new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name));
const users=columns('users');
for(const [name,definition] of Object.entries({avatar_media_id:"TEXT NOT NULL DEFAULT ''",banner_media_id:"TEXT NOT NULL DEFAULT ''",profile_theme:"TEXT NOT NULL DEFAULT 'dark'",portfolio_layout:"TEXT NOT NULL DEFAULT 'grid'",status:"TEXT NOT NULL DEFAULT 'building'"})){
  if(!users.has(name))db.exec(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
}
db.exec(`
CREATE TABLE IF NOT EXISTS media_files(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,kind TEXT NOT NULL CHECK(kind IN ('avatar','banner','project')),mime TEXT NOT NULL,size INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS posts(id TEXT PRIMARY KEY,author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,body TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_posts_date ON posts(created_at DESC);
CREATE TABLE IF NOT EXISTS groups(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL UNIQUE COLLATE NOCASE,description TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS group_members(group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(group_id,user_id));
CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(sender_id,recipient_id,created_at DESC);
CREATE TABLE IF NOT EXISTS roadmaps(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','completed')),created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS feedback(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','accepted','completed','declined')),created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS views_daily(project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,day TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(project_id,day));
CREATE TABLE IF NOT EXISTS github_links(github_id TEXT PRIMARY KEY,user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,login TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS oauth_states(hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS oauth_tickets(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS github_snapshots(project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,metadata TEXT NOT NULL,synced_at TEXT NOT NULL DEFAULT (datetime('now')));
`);
export const FEATURES_SCHEMA_VERSION='2.6.0';
