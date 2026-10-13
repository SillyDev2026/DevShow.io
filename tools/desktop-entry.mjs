// The one-file Windows application uses the same server and UI as the public website.
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
process.env.DEVSHOW_DESKTOP='1';
process.env.DEVSHOW_ROOT=path.resolve(process.cwd());
process.env.PORT='3217';
process.env.DB_PATH ||= path.join(process.env.APPDATA||path.join(os.homedir(),'AppData','Roaming'),'DevShow','data','devshow.sqlite');
import('../server/index.js').then(async ({server})=>{
  const {one,db}=await import('../server/db.js');
  if(process.argv.includes('--self-test')){
    const result=one('SELECT COUNT(*) n FROM users');
    console.log(`DevShow v2.5 Desktop self-test passed, users=${result.n}`);
    db.close();
    return;
  }
  server.listen(Number(process.env.PORT),'127.0.0.1',()=>{
    const url=`http://127.0.0.1:${process.env.PORT}`;
    console.log('DevShow v2.5 Desktop',url,'database:',process.env.DB_PATH);
    if(process.platform==='win32')execFile('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true},e=>{if(e)console.error('Open the URL manually:',url);});
  });
}).catch(e=>{console.error(e);process.exitCode=1;});
