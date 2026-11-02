import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from './project-temp.mjs';
import { join, resolve, dirname, basename } from 'node:path';
import { startDemo } from '../tools/demo.mjs';
import { acquireDataLock } from '../server/data-lock.mjs';

test('demo rejects data parents outside the project before creating data',async()=>{
  await assert.rejects(startDemo({temporaryParent:resolve(tmpdir(),'..','..','..','outside-demo')}),/Projektordner data/);
});

test('default demo keeps its isolated database inside the project',async()=>{
  const demo=await startDemo();try{assert.equal(dirname(demo.dataDir),resolve(tmpdir(),'..','demo-runs'));assert.equal(demo.address.address,'127.0.0.1');}finally{await demo.close();}
});

test('local demo uses real isolated data, ignores deployment environment and closes its data lock', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'knips-demo-test-'));
  const realData = join(parent, 'existing-data');
  await mkdir(realData); await writeFile(join(realData, 'KEEP.txt'), 'existing operator data');
  const environment = ['DATA_DIR', 'HOST', 'PORT', 'PUBLIC_ORIGIN', 'KNIPS_REGISTRATION', 'KNIPS_MODERATORS', 'KNIPS_TRUST_PROXY'];
  const previous = Object.fromEntries(environment.map(name => [name, process.env[name]]));
  Object.assign(process.env, { DATA_DIR: realData, HOST: '0.0.0.0', PORT: '1', PUBLIC_ORIGIN: 'https://example.invalid',
    KNIPS_REGISTRATION: 'closed', KNIPS_MODERATORS: 'nonexistent_operator', KNIPS_TRUST_PROXY: '1' });
  const demos = [];
  try {
    const a = await startDemo({ temporaryParent: parent }); demos.push(a);
    const b = await startDemo({ temporaryParent: parent }); demos.push(b);
    assert.equal(a.address.address, '127.0.0.1');
    assert.equal(b.address.address, '127.0.0.1');
    assert.notEqual(a.address.port, b.address.port);
    assert.notEqual(a.dataDir, b.dataDir);
    assert.notEqual(a.dataDir, realData);
    assert.deepEqual(await readdir(realData), ['KEEP.txt']);
    assert.equal(await readFile(join(realData, 'KEEP.txt'), 'utf8'), 'existing operator data');
    const health = await fetch(a.url + '/health'); assert.equal(health.status, 200);
    const page = await fetch(a.url); assert.match(await page.text(), /Knips/);
    const config = await fetch(a.url + '/api/config');
    assert.equal(config.status, 200); assert.equal((await config.json()).registration, 'open');
    await a.close(); await a.close();
    const release = await acquireDataLock(a.dataDir); await release();
    await assert.rejects(fetch(a.url + '/health'));
    assert.equal((await fetch(b.url + '/health')).status, 200);
  } finally {
    await Promise.allSettled(demos.map(demo => demo.close()));
    for (const [name, value] of Object.entries(previous)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
    // Remove only the unique directory created by this test, after closing both DBs.
    if (dirname(resolve(parent)) !== resolve(tmpdir()) || !basename(parent).startsWith('knips-demo-test-')) throw Error('Unexpected cleanup target');
    await rm(parent, { recursive: true, force: true });
  }
});
