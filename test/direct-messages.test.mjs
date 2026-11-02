import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {tmpdir} from './project-temp.mjs';
import {createKnips} from '../server/main.mjs';
const password='synthetic-demo-password-123';
async function fixture(t){
 const dataDir=await mkdtemp(join(tmpdir(),'dm-'));let app,origin,stamp=Date.now();
 const start=async options=>{app=await createKnips({dataDir,now:()=>stamp,...options});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${app.server.address().port}`;};await start();
 t.after(async()=>{await app.close();await rm(dataDir,{recursive:true,force:true});});
 async function request(path,{method='GET',cookie,body,headers={}}={}){const r=await fetch(origin+path,{method,headers:{'X-Knips-Request':'1',...(cookie?{Cookie:cookie}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 async function register(username){const r=await request('/api/register',{method:'POST',body:{username,displayName:username,password}});assert.equal(r.status,201);return r.cookie;}
 async function invite(cookie,username='demo_bob'){const r=await request('/api/dm/requests',{method:'POST',cookie,body:{username,introduction:'Synthetic hello'}});assert.equal(r.status,201);return r.body.thread.id;}
 const message=(id,cookie,body='Synthetic message',clientKey=randomUUID())=>request(`/api/dm/threads/${id}/messages`,{method:'POST',cookie,body:{body,clientKey}});
 async function streaming(path,cookie,body){const payload=JSON.stringify(body),split=Math.floor(payload.length/2);let req;const started=new Promise(r=>app.server.once('request',r));const response=new Promise((resolve,reject)=>{req=httpRequest(origin+path,{method:'POST',headers:{Cookie:cookie,'X-Knips-Request':'1','Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks))}));});req.on('error',reject);req.write(payload.slice(0,split));});await started;t.after(()=>req.destroy());return {finish:()=>{req.end(payload.slice(split));return response;}};}
 return {request,register,invite,message,streaming,advance(){stamp+=16*60*1000;},async restart(options){await app.close();await start(options);}};
}
test('actual sessions require recipient consent; unrelated users including moderator cannot inspect conversations',async t=>{
 const f=await fixture(t),alice=await f.register('demo_alice'),bob=await f.register('demo_bob'),other=await f.register('demo_other');const id=await f.invite(alice);
 assert.equal((await f.request('/api/dm/threads')).status,401);assert.equal((await f.message(id,alice)).status,403);assert.equal((await f.request(`/api/dm/threads/${id}/messages`,{cookie:bob})).status,403);
 assert.equal((await f.request(`/api/dm/threads/${id}/answer`,{method:'POST',cookie:alice,body:{answer:'accept'}})).status,403);
 assert.equal((await f.request(`/api/dm/threads/${id}/answer`,{method:'POST',cookie:other,body:{answer:'accept'}})).status,404);
 assert.equal((await f.request('/api/dm/threads',{cookie:other})).body.threads.length,0);
 assert.equal((await f.request(`/api/dm/threads/${id}/answer`,{method:'POST',cookie:bob,body:{answer:'accept'}})).status,200);
 assert.equal((await f.message(id,alice,'<script>literal text</script>')).status,201);assert.equal((await f.message(id,bob,'Reply fixture')).status,201);
 const rows=(await f.request(`/api/dm/threads/${id}/messages`,{cookie:bob})).body.messages;assert.equal(rows.length,2);assert.equal(rows[0].mine,false);assert.equal(rows[1].mine,true);assert.equal(rows[0].body,'<script>literal text</script>');
 await f.restart({moderatorUsernames:['demo_other']});assert.equal((await f.request(`/api/dm/threads/${id}/messages`,{cookie:other})).status,404);assert.equal((await f.request(`/api/dm/threads/${id}/messages`,{cookie:bob})).body.messages.length,2);
});
test('idempotency, chronological pagination, input checks and per-thread budget are enforced by real HTTP',async t=>{
 const f=await fixture(t),alice=await f.register('demo_alice'),bob=await f.register('demo_bob');const id=await f.invite(alice);await f.request(`/api/dm/threads/${id}/answer`,{method:'POST',cookie:bob,body:{answer:'accept'}});
 const key=randomUUID(),first=await f.message(id,alice,'Same key fixture',key);assert.equal(first.status,201);const repeat=await f.message(id,alice,'Same key fixture',key);assert.equal(repeat.status,200);assert.equal(repeat.body.id,first.body.id);assert.equal((await f.message(id,alice,'Different body',key)).status,409);
 for(const body of ['', ' '.repeat(5),'x'.repeat(2001),'\x00control'])assert.equal((await f.message(id,alice,body)).status,400);
 assert.equal((await f.message(id,alice,'Valid body','invalid')).status,400);
 for(let i=1;i<200;i++){if(i%50===0)f.advance();assert.equal((await f.message(id,alice,'Synthetic #'+i)).status,201);}
 assert.equal((await f.message(id,bob,'Limit')).status,429);const latest=(await f.request(`/api/dm/threads/${id}/messages`,{cookie:bob})).body;assert.equal(latest.messages.length,50);assert.ok(latest.next);assert.equal(latest.messages.at(-1).body,'Synthetic #199');
 const older=(await f.request(`/api/dm/threads/${id}/messages?before=${latest.next}`,{cookie:alice})).body;assert.equal(older.messages.length,50);assert.ok(older.messages.at(-1).id<latest.messages[0].id);
 assert.equal((await f.request(`/api/dm/threads/${id}/messages?before=-1`,{cookie:alice})).status,400);
 assert.equal((await f.request('/api/dm/requests',{method:'POST',cookie:alice,body:{username:'demo_alice',introduction:'Self'}})).status,400);
 assert.equal((await f.request('/api/dm/requests',{method:'POST',cookie:alice,body:{username:'demo_bob',introduction:'Existing'}})).status,409);
 assert.equal((await f.request(`/api/dm/threads/${id}/close`,{method:'POST',cookie:alice,body:{},headers:{Origin:'https://foreign.invalid'}})).status,403);
});
test('block hides both sides and closes consent; unblocking needs a fresh accepted request; deleting account cascades only its conversations',async t=>{
 const f=await fixture(t),alice=await f.register('demo_alice'),bob=await f.register('demo_bob');let id=await f.invite(alice);await f.request(`/api/dm/threads/${id}/answer`,{method:'POST',cookie:bob,body:{answer:'accept'}});await f.message(id,alice);
 assert.equal((await f.request('/api/blocks/demo_bob',{method:'PUT',cookie:alice,body:{}})).status,200);
 for(const cookie of [alice,bob]){assert.equal((await f.request('/api/dm/threads',{cookie})).body.threads.length,0);assert.equal((await f.message(id,cookie)).status,404);assert.equal((await f.request(`/api/dm/threads/${id}/messages`,{cookie})).status,404);}
 await f.request('/api/blocks/demo_bob',{method:'DELETE',cookie:alice,body:{}});assert.equal((await f.message(id,bob)).status,403);
 id=await f.invite(bob,'demo_alice');assert.equal((await f.request(`/api/dm/threads/${id}/messages`,{cookie:alice})).status,403);await f.request(`/api/dm/threads/${id}/answer`,{method:'POST',cookie:alice,body:{answer:'accept'}});assert.equal((await f.request(`/api/dm/threads/${id}/messages`,{cookie:bob})).body.messages.length,1);
 assert.equal((await f.request('/api/account',{method:'DELETE',cookie:alice,body:{password}})).status,200);assert.equal((await f.request('/api/dm/threads',{cookie:bob})).body.threads.length,0);
 const recreated=await f.register('demo_alice');assert.equal((await f.request('/api/dm/threads',{cookie:recreated})).body.threads.length,0);assert.equal((await f.request(`/api/dm/threads/${id}/messages`,{cookie:bob})).status,404);
});
test('slow writers cannot commit after logout or a newly applied block',async t=>{
 const f=await fixture(t),alice=await f.register('demo_alice'),bob=await f.register('demo_bob');const id=await f.invite(alice);await f.request(`/api/dm/threads/${id}/answer`,{method:'POST',cookie:bob,body:{answer:'accept'}});
 const late=await f.streaming(`/api/dm/threads/${id}/messages`,alice,{body:'Should never persist',clientKey:randomUUID()});await f.request('/api/blocks/demo_alice',{method:'PUT',cookie:bob,body:{}});assert.equal((await late.finish()).status,404);
 await f.request('/api/blocks/demo_alice',{method:'DELETE',cookie:bob,body:{}});await f.invite(alice);await f.request(`/api/dm/threads/${id}/answer`,{method:'POST',cookie:bob,body:{answer:'accept'}});
 const logout=await f.streaming(`/api/dm/threads/${id}/messages`,alice,{body:'Not after logout',clientKey:randomUUID()});await f.request('/api/logout',{method:'POST',cookie:alice,body:{}});assert.equal((await logout.finish()).status,401);assert.equal((await f.request(`/api/dm/threads/${id}/messages`,{cookie:bob})).body.messages.length,0);
});
