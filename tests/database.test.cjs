require('fake-indexeddb/auto');
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');const {openDB}=require('idb');
const cache={};function load(name){if(cache[name])return cache[name];const exports={};cache[name]=exports;const code=ts.transpileModule(fs.readFileSync('src/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports',code)(p=>p==='idb'?require('idb'):load(p.slice(2)),exports);return exports;}
test('atomic database migration, serialized draft saves and recoverable import',async()=>{
 const db=await openDB('liza-trener',1,{upgrade(db){db.createObjectStore('app')}});
 const source={version:1,exercises:[],plans:[],sessions:[]};await db.put('app',source,'data');
 const api=load('training-db');const s=await api.loadTraining();assert.equal(s.version,2);assert.deepEqual(await db.get('app','migration-original-v1'),source);assert.deepEqual(await db.get('app','data'),source);
 s.people[0].note='first';const one=api.saveTraining(s);s.people[0].note='latest';const two=api.saveTraining(s);await Promise.all([one,two]);assert.equal((await api.loadTraining()).people[0].note,'latest');
 await assert.rejects(api.importTraining({version:2}));assert.equal((await api.loadTraining()).people[0].note,'latest');
 const imported=structuredClone(s);imported.people[0].note='imported';await api.importTraining(imported);assert.equal((await api.getRecovery()).people[0].note,'latest');assert.equal((await api.loadTraining()).people[0].note,'imported');
 // An invalid legacy migration leaves both source and target untouched.
 await db.delete('app','training-v2');await db.delete('app','migration-original-v1');const corrupt={...source,plans:[{id:5}]};await db.put('app',corrupt,'data');await assert.rejects(api.loadTraining());assert.equal(await db.get('app','training-v2'),undefined);assert.equal(await db.get('app','migration-original-v1'),undefined);assert.deepEqual(await db.get('app','data'),corrupt);
 db.close();
});
