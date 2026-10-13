import {db} from './db.js';

// Additive v2.7 migration: never drop user data or rewrite v2.0-v2.6 tables.
db.exec(`
CREATE TABLE IF NOT EXISTS project_demos(project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,url TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS dev_teams(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS dev_team_members(team_id TEXT NOT NULL REFERENCES dev_teams(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,role TEXT NOT NULL CHECK(role IN ('owner','maintainer','contributor')),state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','active')),PRIMARY KEY(team_id,user_id));
CREATE INDEX IF NOT EXISTS idx_team_invites ON dev_team_members(user_id,state);
CREATE TABLE IF NOT EXISTS dev_team_projects(team_id TEXT NOT NULL REFERENCES dev_teams(id) ON DELETE CASCADE,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,PRIMARY KEY(team_id,project_id));
CREATE TABLE IF NOT EXISTS feedback_votes(feedback_id TEXT NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(feedback_id,user_id));
CREATE TABLE IF NOT EXISTS dashboard_preferences(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,layout TEXT NOT NULL DEFAULT '["projects","activity","notifications"]',updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS notification_preferences(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,settings TEXT NOT NULL DEFAULT '{"messages":true,"follows":true,"projects":true,"feedback":true}',updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS project_launches(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',scheduled_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_launches_time ON project_launches(scheduled_at);
CREATE TABLE IF NOT EXISTS desktop_sync(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,revision INTEGER NOT NULL DEFAULT 0,payload TEXT NOT NULL DEFAULT '{}',updated_at TEXT NOT NULL DEFAULT (datetime('now')));
`);
export const V27_SCHEMA_VERSION = '2.7.0';
