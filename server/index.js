import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as sea from 'node:sea';
import './db.js';
import './features-db.js';
import './v27-db.js';
import './v28-db.js';
import './v30-db.js';
import {routeApi} from './api.js';
import {makeRateLimiter,error,getUser} from './security.js';
import {readMedia} from './media.js';
import {liveStream} from './live.js';
import {oauthCallback} from './oauth.js';
import {stream as collabStream} from './v30-live.js';

const ROOT=process.env.DEVSHOW_ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const PORT=Number(process.env.PORT||3000);
const ALLOWED=(process.env.CORS_ORIGINS||'https://sillydev2026.github.io,http://localhost:3000,http://127.0.0.1:3000,http://localhost:3217,http://127.0.0.1:3217').split(',').map(x=>x.trim()).filter(Boolean);
const ASSETS={'/':'index.html','/index.html':'index.html','/styles.css':'styles.css','/styles-fluid.css':'styles-fluid.css','/config.js':'config.js','/assets/favicon.svg':'assets/favicon.svg','/src/main.js':'src/main.js','/src/api.js':'src/api.js','/src/components.js':'src/components.js','/src/views.js':'src/views.js','/src/v26.js':'src/v26.js','/src/live.js':'src/live.js','/src/releases.js':'src/releases.js','/src/v27.js':'src/v27.js','/src/v28.js':'src/v28.js'};
ASSETS['/src/notification-inbox.js']='src/notification-inbox.js';ASSETS['/src/v30.js']='src/v30.js';ASSETS['/src/editor/playground-luau.js']='src/editor/playground-luau.js';ASSETS['/styles-v30.css']='styles-v30.css';
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const rate=makeRateLimiter();
const send=(res,status,data)=>{const payload=JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(payload);};
async function handler(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  const origin=req.headers.origin;
  // A desktop fallback port remains same-origin on loopback, even when 3217 is occupied.
  const localOrigin=origin&&/^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin)&&origin===`http://${req.headers.host}`&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.localAddress);
  const permittedOrigin=!origin||ALLOWED.includes(origin)||localOrigin;
  if(origin&&permittedOrigin){
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
    res.setHeader('Access-Control-Allow-Methods','GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
  }
  try{
    if(!permittedOrigin)throw error(403,'Origin is not allowed.');
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    rate(req);
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/api/auth/github/callback'&&req.method==='GET')return await oauthCallback(req,res,url);
    if(req.method==='GET'&&/^\/api\/v3\/collab\/projects\/[a-f0-9-]{36}\/events$/.test(url.pathname))return collabStream(req,res,url.pathname.split('/')[5],getUser(req));
    if(url.pathname==='/api/events'&&req.method==='GET')return liveStream(req,res,getUser(req));
    if(/^\/api\/media\/[a-f0-9-]{36}$/.test(url.pathname)&&['GET','HEAD'].includes(req.method))return readMedia(req,res,url.pathname.split('/')[3],getUser(req));
    if(url.pathname==='/api'||url.pathname.startsWith('/api/'))return await routeApi(req,url,(status,data)=>send(res,status,data),rate);
    if(!['GET','HEAD'].includes(req.method))throw error(405,'Method not allowed.');
    const asset=ASSETS[url.pathname];if(!asset)throw error(404,'File not found.');
    const data=sea.isSea()?Buffer.from(sea.getAsset(asset)):fs.readFileSync(path.join(ROOT,asset));
    res.writeHead(200,{'Content-Type':TYPES[path.extname(asset)],'Cache-Control':'no-cache'});
    res.end(req.method==='HEAD'?undefined:data);
  }catch(e){if(!e.status)console.error('DevShow:',e);if(!res.headersSent)send(res,e.status||500,{error:e.status?e.message:'Internal server error.'});else res.end();}
}
export const server=http.createServer(handler);
if(!process.env.DEVSHOW_DESKTOP&&process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))server.listen(PORT,'0.0.0.0',()=>console.log(`DevShow v3.0.0 at http://localhost:${PORT}`));
