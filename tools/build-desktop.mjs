import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const imports = /^import\s+.*?\s+from\s+['"][^'"]+['"];?\s*$/gm;
const dbRaw = read('server/db.js');
const apiRaw = read('server/index.js');
const githubRaw = read('server/github.js');
if (!dbRaw.includes("import { DatabaseSync } from 'node:sqlite'") || !apiRaw.includes("export const server=http.createServer(handler);")) throw new Error('Server source changed; review desktop adapter before building.');
const db = dbRaw.replace(imports, '').replaceAll('export const ', 'const ').replaceAll('export function ', 'function ');
const github = githubRaw.replace(imports, '').replaceAll('export async function ', 'async function ').replaceAll('export function ', 'function ');
const api = apiRaw.replace(imports, '').replace("const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');", "const ROOT = path.resolve(__dirname, '..');")
  .replace('export const server=http.createServer(handler);', 'const server=http.createServer(handler);')
  .replace(/if\(process\.argv\[1\]&&path\.resolve\(process\.argv\[1\]\)===fileURLToPath\(import\.meta\.url\)\)server\.listen\(.*?\);\s*$/s, '');
if (api.includes('import.meta') || api.includes('export const server') || api.includes('fileURLToPath')) throw new Error('Unconverted module syntax remains in the desktop server');
const header = `// Generated from the real DevShow API and database sources. Do not edit by hand.\n'use strict';\nconst http = require('node:http');\nconst fs = require('node:fs');\nconst path = require('node:path');\nconst crypto = require('node:crypto');\nconst {DatabaseSync} = require('node:sqlite');\nconst os = require('node:os');\nconst sea = require('node:sea');\nconst {execFile} = require('node:child_process');\nconst bundled = sea.isSea();\nif (!process.env.DB_PATH) process.env.DB_PATH = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'DevShow', 'data', 'devshow.sqlite');\nif (!process.env.PORT) process.env.PORT = '3217';\n`;
const patched = api.replace('const data=fs.readFileSync(local);', "const data=bundled?Buffer.from(sea.getAsset(requested.slice(1))):fs.readFileSync(local);");
if (patched === api) throw new Error('Unable to patch static assets for SEA');
const footer = `\nconst listenPort=Number(process.env.PORT);\nif (process.argv.includes('--self-test')) {\n  const result=one('SELECT COUNT(*) AS count FROM users');\n  if (bundled && !sea.getAsset('index.html','utf8').includes('DevShow')) throw new Error('Embedded website missing');\n  process.stdout.write('DevShow Desktop self-test passed; users=' + result.count + '\\n');\n  db.close();\n} else {\n  server.on('error', error => { console.error('Cannot start DevShow Desktop:',error.message); process.exitCode=1; });\n  server.listen(listenPort,'127.0.0.1',()=>{\n    const address='http://127.0.0.1:'+listenPort;\n    console.log('DevShow Desktop v2.2 | '+address);\n    console.log('Saving to '+process.env.DB_PATH);\n    console.log('Close this window to stop the desktop server.');\n    if (process.platform==='win32') {\n      execFile('rundll32.exe',['url.dll,FileProtocolHandler',address],{windowsHide:true},error=>{ if (error) console.error('Open '+address+' manually:',error.message); });\n    }\n  });\n}\n`;
fs.writeFileSync(path.join(out,'desktop-entry.cjs'),header+'\n'+db+'\n'+github+'\n'+patched+'\n'+footer);
const files = ['index.html','config.js','styles.css','assets/favicon.svg','src/app.js','src/cloud.js','src/data.js'];
const assets = Object.fromEntries(files.map(file=>[file,file]));
fs.writeFileSync(path.join(out,'sea-config.json'),JSON.stringify({main:'dist/desktop-entry.cjs',output:'dist/DevShow-Desktop.exe',assets,disableExperimentalSEAWarning:true},null,2)+'\n');
console.log('Prepared standalone desktop entry and '+files.length+' embedded UI assets.');
