import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
test('container-owned checkout still builds a verified course with its source identity',async()=>{
 const commit=execFileSync('git',['-c','safe.directory='+process.cwd(),'rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const env={...process.env,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1',GIT_TEST_ASSUME_DIFFERENT_OWNER:'1',COURSE_COMMIT:commit};
 const ordinary=spawnSync('git',['status','--porcelain'],{env,encoding:'utf8'});
 assert.notEqual(ordinary.status,0);assert.match(ordinary.stderr,/dubious ownership/);
 execFileSync(process.execPath,['tools/build-site.mjs'],{env,stdio:'pipe'});
 const release=JSON.parse(await readFile('.build/site/release.json','utf8'));
 assert.equal(release.commit,commit);assert.match(release.date,/^\d{4}-\d{2}-\d{2}$/);assert.ok(release.files.some(f=>f.path==='lessons/running-a-program/index.html'));
});
