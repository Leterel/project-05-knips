import {mkdirSync,lstatSync} from 'node:fs';import {join} from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
// Tests may clean up only their newly created children, never operator data.
export function tmpdir(){let path=root;for(const part of ['data','test-runs']){path=join(path,part);try{lstatSync(path);}catch(error){if(error.code!=='ENOENT')throw error;try{mkdirSync(path);}catch(created){if(created.code!=='EEXIST')throw created;}}const info=lstatSync(path);if(info.isSymbolicLink()||!info.isDirectory())throw Error('Testdatenpfad muss ein echtes Projektverzeichnis sein.');}return path;}
