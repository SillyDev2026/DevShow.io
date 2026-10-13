import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const file = process.env.DB_PATH || path.resolve('server/data/devshow.sqlite');
fs.mkdirSync(path.dirname(file), { recursive: true });
export const db = new DatabaseSync(file);
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  handle TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL,
  name TEXT NOT NULL, role TEXT NOT NULL DEFAULT '', bio TEXT NOT NULL DEFAULT '',
  github TEXT NOT NULL DEFAULT '', website TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#b4ffa6', location TEXT NOT NULL DEFAULT '', skills TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions(
  hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS projects(
  id TEXT PRIMARY KEY, creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, tagline TEXT NOT NULL, description TEXT NOT NULL,
  category TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '[]',
  repo TEXT NOT NULL DEFAULT '', website TEXT NOT NULL DEFAULT '', cover TEXT NOT NULL DEFAULT '',
  views INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_project_created ON projects(created_at DESC);
CREATE TABLE IF NOT EXISTS likes(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, PRIMARY KEY(user_id,project_id));
CREATE TABLE IF NOT EXISTS bookmarks(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, PRIMARY KEY(user_id,project_id));
CREATE TABLE IF NOT EXISTS follows(follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, followed_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(follower_id,followed_id), CHECK (follower_id <> followed_id));
CREATE TABLE IF NOT EXISTS comments(
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_project ON comments(project_id,created_at);
CREATE TABLE IF NOT EXISTS collections(
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS collection_projects(collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,PRIMARY KEY(collection_id,project_id));
CREATE TABLE IF NOT EXISTS build_logs(
  id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,body TEXT NOT NULL,version TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notifications(
  id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,project_id TEXT,read INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id,created_at DESC);
`);
export const uuid = () => crypto.randomUUID();
export const query = (sql, ...params) => db.prepare(sql).all(...params);
export const one = (sql, ...params) => db.prepare(sql).get(...params);
export const exec = (sql, ...params) => db.prepare(sql).run(...params);
export function transaction(fn) { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } }
const userColumns = new Set(db.prepare('PRAGMA table_info(users)').all().map(column => column.name));
if (!userColumns.has('location')) db.exec("ALTER TABLE users ADD COLUMN location TEXT NOT NULL DEFAULT ''");
if (!userColumns.has('skills')) db.exec("ALTER TABLE users ADD COLUMN skills TEXT NOT NULL DEFAULT '[]'");
