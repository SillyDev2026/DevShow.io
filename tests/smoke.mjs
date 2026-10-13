import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const files=['src/main.js','src/api.js','src/components.js','src/views.js','src/v26.js','src/live.js','src/releases.js','src/v27.js','server/index.js','server/api.js','server/security.js','server/projects.js','server/db.js','server/github.js','server/oauth.js','server/community.js','server/features-db.js','server/github-v26.js','server/media.js','server/live.js','server/v27.js','server/v27-db.js','server/v27-code.js','tools/desktop-entry.mjs','tools/build-desktop.mjs'];
for(const file of files){assert.ok(fs.existsSync(file),`Missing ${file}`);execFileSync(process.execPath,['--check',file]);}
const html=fs.readFileSync('index.html','utf8');
assert.match(html,/src\/main\.js/);assert.match(html,/viewport-fit=cover/);
const client=fs.readFileSync('src/main.js','utf8');
for(const name of ['project-form','profile-form','auth-form','comment-form','board-form','log-form','notifications','import-github'])assert.ok(client.includes(name),`Missing client action ${name}`);
const api=fs.readFileSync('server/api.js','utf8');
for(const route of ['api/bootstrap','api/auth/register','api/projects','api/collections','api/me/export','api/github/repository'])assert.ok(api.includes(route),`Missing route ${route}`);
assert.ok(!client.includes('devshow-v2-local-first'),'Old browser-demo persistence should not return');
console.log('DevShow v3.0.0 static smoke checks passed.');
