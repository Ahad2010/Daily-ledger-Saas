import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
for(const app of ['web','admin'])test(`${app} Vercel configuration rejects demo/local API and preserves the same-origin proxy`,()=>{
 const run=(env:Record<string,string>)=>spawnSync(process.execPath,['--import','tsx','--eval',`import('./apps/${app}/next.config.ts').then(async m=>{const c=m.default.default||m.default;console.log(JSON.stringify(await c.rewrites()))})`],{env:{...process.env,VERCEL:'1',NEXT_PUBLIC_DATA_MODE:'api',NEXT_PUBLIC_API_URL:'/backend',...env},encoding:'utf8',windowsHide:true,timeout:30000});
 assert.notEqual(run({API_INTERNAL_URL:'http://localhost:4000'}).status,0);
 assert.notEqual(run({API_INTERNAL_URL:'https://api.example.com',NEXT_PUBLIC_DATA_MODE:'demo'}).status,0);
 const valid=run({API_INTERNAL_URL:'https://api.example.com'});assert.equal(valid.status,0,valid.stderr);assert.deepEqual(JSON.parse(valid.stdout.trim()),[{source:'/backend/:path*',destination:'https://api.example.com/:path*'}]);
});
