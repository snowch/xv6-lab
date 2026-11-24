import {cp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {buildOffline} from './offline/build.mjs';
// GitHub's container checkout can be owned by the runner UID. Trust only this repository for each read.
const git=args=>execFileSync('git',['-c','safe.directory='+process.cwd(),...args],{encoding:'utf8'}).trim();
await rm('.build/site',{recursive:true,force:true});
await cp('site','.build/site',{recursive:true});
const dirty=git(['status','--porcelain']);
const commit=process.env.COURSE_COMMIT||(dirty?null:git(['rev-parse','HEAD']));
const release=await buildOffline('.build/site',{commit,date:commit?git(['show','-s','--format=%cs',commit]):null});
console.log(`Built ${release.files.length} verified course files (${(release.bytes/1e6).toFixed(1)} MB).`);
