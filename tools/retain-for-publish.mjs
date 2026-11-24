import {readFile,writeFile} from 'node:fs/promises';
import {retainLegacyAssets} from './offline/retain-legacy-assets.mjs';
import {retainPublishedReleases} from './offline/retain-releases.mjs';
const directory='.build/site',release=JSON.parse(await readFile(directory+'/release.json','utf8'));
release.legacyAssets=await retainLegacyAssets(directory,process.env.PUBLISHED_COURSE_URL,release);
release.retainedReleases=await retainPublishedReleases(directory,process.env.PUBLISHED_COURSE_URL,{currentId:release.id});
for(const name of['release.json','releases/'+release.id+'/release.json'])await writeFile(directory+'/'+name,JSON.stringify(release));
