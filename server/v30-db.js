import {db} from './db.js';
// Additive schema: v2 users, projects and session keys are never rebuilt.
db.exec(`
CREATE TABLE IF NOT EXISTS collaborative_documents(
  id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,language TEXT NOT NULL DEFAULT 'luau',content TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 0,updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id,path)
);
CREATE INDEX IF NOT EXISTS idx_collab_project ON collaborative_documents(project_id,path);
CREATE TABLE IF NOT EXISTS collaborative_members(
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('editor','viewer')),
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','active')),
  invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(project_id,user_id)
);
CREATE TABLE IF NOT EXISTS collaborative_messages(
  id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_collab_messages ON collaborative_messages(project_id,created_at);
CREATE TABLE IF NOT EXISTS collaborative_revisions(
  document_id TEXT NOT NULL REFERENCES collaborative_documents(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,content TEXT NOT NULL,author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(document_id,revision)
);
CREATE TABLE IF NOT EXISTS developer_saved_snippets(
  id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,language TEXT NOT NULL,content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_snippets_user ON developer_saved_snippets(user_id,created_at DESC);
`);
