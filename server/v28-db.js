import {db} from './db.js';
// Additive schema only: existing user, project, message and desktop sync data are untouched.
db.exec(`
CREATE TABLE IF NOT EXISTS saved_searches(
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL, query_text TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '',
 tag TEXT NOT NULL DEFAULT '', sort TEXT NOT NULL DEFAULT 'newest',created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_saved_searches_owner ON saved_searches(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS project_workspaces(
 project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
 dev_status TEXT NOT NULL DEFAULT 'building' CHECK(dev_status IN ('planning','building','beta','launched','archived')),
 recruiting INTEGER NOT NULL DEFAULT 0 CHECK(recruiting IN (0,1)),
 tech_stack TEXT NOT NULL DEFAULT '[]',docs_url TEXT NOT NULL DEFAULT '',support_url TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS project_tasks(
 id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 title TEXT NOT NULL,done INTEGER NOT NULL DEFAULT 0 CHECK(done IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON project_tasks(project_id,created_at);
CREATE TABLE IF NOT EXISTS project_milestones(
 id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',due_date TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','completed')),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_milestones_project ON project_milestones(project_id,created_at);
CREATE TABLE IF NOT EXISTS user_blocks(
 blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(blocker_id,blocked_id), CHECK(blocker_id<>blocked_id)
);
CREATE TABLE IF NOT EXISTS content_reports(
 id TEXT PRIMARY KEY,reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('project','user')),
 subject_id TEXT NOT NULL,reason TEXT NOT NULL,details TEXT NOT NULL DEFAULT '',
 state TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(reporter_id,kind,subject_id)
);
CREATE INDEX IF NOT EXISTS idx_reports_state ON content_reports(state,created_at DESC);
`);
