import fs from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';

const assets=['index.html','config.js','styles.css','styles-fluid.css','assets/favicon.svg','src/main.js','src/api.js','src/components.js','src/views.js','src/v26.js','src/live.js','src/notification-inbox.js','src/releases.js','src/v27.js','src/v28.js','src/v30.js','src/editor/playground-luau.js','styles-v30.css'];
for(const asset of assets){if(!fs.existsSync(asset))throw Error(`Missing desktop asset: ${asset}`);}
fs.mkdirSync('dist',{recursive:true});
await build({entryPoints:['tools/desktop-entry.mjs'],outfile:'dist/desktop-entry.cjs',bundle:true,platform:'node',target:'node26',format:'cjs',logLevel:'warning'});
const output=fs.readFileSync('dist/desktop-entry.cjs','utf8');
if(!output.includes('DevShow Desktop')||!output.includes('api/bootstrap')||!output.includes('DEVSHOW_DESKTOP_PORT'))throw Error('The bundled server or launcher is incomplete.');
const config={main:'dist/desktop-entry.cjs',mainFormat:'commonjs',output:'dist/DevShow-Desktop.exe',assets:Object.fromEntries(assets.map(file=>[file,file])),disableExperimentalSEAWarning:true};
fs.writeFileSync('dist/sea-config.json',JSON.stringify(config,null,2)+'\n');
console.log(`DevShow Windows SEA prepared: ${assets.length} embedded website assets.`);
