// Entry point for the standalone Windows executable; the web app and API are bundled together.
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import {execFile} from 'node:child_process';

const VERSION='2.8.0';
if(process.argv.includes('--version')){
  console.log(`DevShow Desktop ${VERSION}`);
}else{
  const testing=process.argv.includes('--self-test');
  const dataDir=process.env.DEVSHOW_DATA_DIR||path.join(process.env.APPDATA||path.join(os.homedir(),'AppData','Roaming'),'DevShow','data');
  const temporary=testing&&!process.env.DB_PATH;
  process.env.DEVSHOW_DESKTOP='1';
  process.env.DEVSHOW_ROOT=path.resolve(process.cwd());
  process.env.DB_PATH ||= temporary?path.join(os.tmpdir(),`devshow-selftest-${process.pid}.sqlite`):path.join(dataDir,'devshow.sqlite');

  // The import must happen after setting the DB path so the SQLite module never
  // accidentally creates a database in the executable's working directory.
  import('../server/index.js').then(async ({server})=>{
    if(testing){
      const {one,db}=await import('../server/db.js');
      const users=one('SELECT COUNT(*) n FROM users').n;
      const root=await fetchLocalAsset(server);
      db.close();
      if(temporary){for(const suffix of ['', '-wal', '-shm'])try{fs.rmSync(process.env.DB_PATH+suffix,{force:true});}catch{}}
      if(!root)throw Error('Bundled HTML did not load.');
      console.log(`DevShow Desktop ${VERSION}: self-test OK, users=${users}`);
      return;
    }

    const initialPort=Number(process.env.DEVSHOW_DESKTOP_PORT||3217);
    if(!Number.isInteger(initialPort)||initialPort<0||initialPort>65535)throw Error('Invalid DEVSHOW_DESKTOP_PORT.');
    server.on('error',e=>{
      if(e.code==='EADDRINUSE'&&initialPort!==0){
        console.warn(`Port ${initialPort} is busy; choosing an available local port.`);
        server.listen(0,'127.0.0.1');
      }else{
        console.error(`DevShow could not start: ${e.message}`);
        process.exitCode=1;
      }
    });
    server.on('listening',()=>{
      const url=`http://127.0.0.1:${server.address().port}`;
      console.log(`DevShow Desktop ${VERSION}\nOpen: ${url}\nPrivate database: ${process.env.DB_PATH}\nClose this window to stop the server.`);
      if(process.platform==='win32'&&!process.argv.includes('--no-browser')){
        execFile('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true},e=>{
          if(e)console.warn('Could not open the browser automatically. Open:',url);
        });
      }
    });
    server.listen(initialPort,'127.0.0.1');
  }).catch(e=>{console.error('DevShow Desktop startup failed:',e);process.exitCode=1;});
}

async function fetchLocalAsset(server){
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  try{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/index.html`);
    const body=await response.text();
    return response.ok&&body.includes('src/main.js')&&body.includes('styles-fluid.css');
  }finally{await new Promise(resolve=>server.close(resolve));}
}
