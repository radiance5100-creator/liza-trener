const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const cache = {};
function load(name) {
  if(cache[name]) return cache[name];
  const exports = {}; cache[name]=exports;
  const code = ts.transpileModule(fs.readFileSync('src/'+name+'.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','exports',code)(path => path==='idb'?{openDB:()=>Promise.resolve({})}:load(path.slice(2)),exports);
  return exports;
}
const t=load('training');
const legacy=()=>({version:1,exercises:[{id:'e1',name:'Тяга',group:'Спина',kind:'База',weight:'20',reps:'8',note:'Старая заметка',filmed:false,images:['data:image/png;base64,aGVsbG8=',null],history:[{weight:'18',reps:'10',date:'2026-09-01'}]},{id:'e2',name:'Присед',group:'Ноги',kind:'База',weight:'0',reps:'12',note:'',filmed:false,images:[null,null],history:[]}],techniques:{e1:{flagged:true,comment:''}},clients:[{id:'c1',name:'Клиент',contact:'контакт',note:'заметка',results:[{exerciseId:'e1',name:'Тяга',weight:'5',reps:'12'}],techniques:{}}],plans:[{id:'d1',name:'А',exerciseIds:['e1','e2']},{id:'d2',name:'Б',exerciseIds:['e2']},{id:'cd',name:'Клиентский день',exerciseIds:['e1'],clientId:'c1'}],sessions:[{id:'s1',planName:'А',date:'2026-09-15T10:00:00.000Z',results:[{exerciseId:'e1',name:'Тяга',weight:'22',reps:'8'}]}],draft:{planName:'Б',results:[{exerciseId:'e2',name:'Присед',weight:'0',reps:'14'}]}});
function fixture(){const s=t.migrate(legacy());s.appointments=[];return s;}
test('migration preserves ownership, photos, ordered days, flags and unconfirmed draft without invented time',()=>{
  const original=legacy(), before=JSON.stringify(original), s=t.migrate(original);
  assert.equal(JSON.stringify(original),before);
  assert.deepEqual(s.people[0].programs[0].days.map(d=>d.name),['А','Б']);
  assert.equal(s.people[1].programs[0].days[0].name,'Клиентский день');
  assert.deepEqual(s.exercises,original.exercises);
  assert.deepEqual(s.people[0].flags,['e1']);
  assert.equal(s.people[1].contact,'контакт');
  assert.equal(s.sessions[0].personId,'self');assert.equal(s.sessions[0].results[0].done,true);
  assert.equal(s.appointments[0].time,'');assert.equal(s.appointments[0].duration,null);
  assert.equal(s.appointments[0].participants[0].entries[0].done,false);
  assert.equal(s.appointments[0].participants[0].entries[0].reps,'14');
});
test('prefill is personal and unconfirmed, skipped values never become history',()=>{
  const s=fixture(); const a=t.appointment(s,['self'],'10:00');s.appointments.push(a);t.startAppointment(s,a.id);
  assert.equal(a.participants[0].entries[0].weight,'22');assert.equal(a.participants[0].entries[0].done,false);
  assert.equal(t.entry(s,'c1','e1').weight,'5');
  a.participants[0].entries[0].done=true;t.finish(s,a.id,'self');
  const session=s.sessions.at(-1);assert.equal(session.results[1].done,false);assert.equal(session.results[1].weight,'');
  assert.equal(t.resultHistory(s,'self','e2').length,1);
});
test('completion advances exactly once; cancellation and absence never advance',()=>{
  const s=fixture(), a=t.appointment(s,['self'],'10:00');s.appointments.push(a);t.startAppointment(s,a.id);t.finish(s,a.id,'self');t.finish(s,a.id,'self');
  assert.equal(s.sessions.length,2);assert.equal(s.people[0].programs[0].next,1);
  const b=t.appointment(s,['self'],'12:00');s.appointments.push(b);t.finish(s,b.id,'self',true);assert.equal(s.people[0].programs[0].next,1);
  const c=t.appointment(s,['self'],'13:00');c.status='cancelled';s.appointments.push(c);assert.throws(()=>t.startAppointment(s,c.id));t.finish(s,c.id,'self');assert.equal(s.sessions.length,2);
});
test('shared pair keeps independent results and does not advance guest cycle',()=>{
  const s=fixture(), a=t.appointment(s,['self','c1'],'10:00');a.mode='shared';a.participants[1]={...a.participants[1],programId:undefined,dayId:undefined,entries:a.participants[0].entries.map(e=>t.entry(s,'c1',e.id))};s.appointments.push(a);t.startAppointment(s,a.id);
  a.participants[0].entries[0].weight='50';a.participants[0].entries[0].done=true;
  assert.equal(a.participants[1].entries[0].weight,'5');assert.equal(a.participants[1].entries[0].done,false);
  t.finish(s,a.id,'self');assert.equal(a.status,'active');assert.equal(s.people[0].programs[0].next,1);
  a.participants[1].entries[0].weight='7';a.participants[1].entries[0].done=true;t.finish(s,a.id,'c1');
  assert.equal(s.people[1].programs[0].next,0);assert.equal(a.status,'done');assert.equal(t.entry(s,'self','e1').weight,'50');assert.equal(t.entry(s,'c1','e1').weight,'7');
});
test('one active workout per person; independent concurrent people allowed',()=>{
 const s=fixture(), a=t.appointment(s,['self'],'10:00'),b=t.appointment(s,['self','c1'],'11:00'),c=t.appointment(s,['c1'],'12:00');s.appointments.push(a,b,c);assert.equal(t.startAppointment(s,a.id),a.id);assert.equal(t.startAppointment(s,b.id),a.id);assert.equal(b.status,'planned');assert.equal(t.startAppointment(s,c.id),c.id);
});
test('program edits cannot alter workout snapshot; version 2 roundtrip keeps fields, open row and flags',()=>{
 const s=fixture(),a=t.appointment(s,['self'],'10:00');s.appointments.push(a);t.startAppointment(s,a.id);a.participants[0].opened=1;a.participants[0].scroll=300;a.participants[0].entries[0].weight='резинка';s.people[0].programs[0].days[0].exercises.reverse();assert.deepEqual(a.participants[0].entries.map(e=>e.id),['e1','e2']);assert.deepEqual(t.migrate(JSON.parse(JSON.stringify(s))),s);
});
test('invalid imports rejected before modifying live object',()=>{
 const s=fixture();const original=JSON.stringify(s);const bad=structuredClone(s);bad.people[0].programs[0].days[0].exercises=['missing'];assert.throws(()=>t.validateStore(bad));assert.equal(JSON.stringify(s),original);
 const a=t.appointment(s,['self'],'10:00');s.appointments.push(a);t.startAppointment(s,a.id);s.appointments.push({...structuredClone(a),id:'duplicate-active'});assert.throws(()=>t.validateStore(s));
});
test('overlap uses interval intersections, not absolute start-time difference',()=>{
 const s=fixture(),a=t.appointment(s,['self'],'10:00'),b=t.appointment(s,['c1'],'10:45');a.duration=30;b.duration=120;assert.equal(t.overlaps(a,b),false);b.time='10:15';assert.equal(t.overlaps(a,b),true);b.status='cancelled';assert.equal(t.overlaps(b,a),false);
});
test('same-day repeated results stay distinct and resume selects unfinished participant',()=>{
 const s=fixture(),a=t.appointment(s,['self','c1'],'10:00');s.appointments.push(a);t.startAppointment(s,a.id);a.participants[1].entries[0].weight='5';a.participants[1].entries[0].reps='12';a.participants[1].entries[0].done=true;t.finish(s,a.id,'c1');a.selected=1;t.startAppointment(s,a.id);assert.equal(a.selected,0);
 const b=t.appointment(s,['c1'],'12:00');s.appointments.push(b);t.startAppointment(s,b.id);b.participants[0].entries[0].done=true;t.finish(s,b.id,'c1');assert.equal(t.resultHistory(s,'c1','e1').filter(r=>r.date===t.iso()).length,2);
});

test('schedule and one-off start without a program, additions persist and do not advance program cycle',()=>{
  const s=fixture(), a=t.appointment(s,['c1'],'09:00');
  a.participants=[t.oneOffParticipant('c1')];s.appointments.push(a);
  assert.equal(a.duration,null);assert.equal(t.startAppointment(s,a.id),a.id);
  assert.equal(a.participants[0].entries.length,0);
  t.addWorkoutExercises(s,a.id,['e1','e1','missing']);
  const r=a.participants[0].entries[0];r.weight='резинка';r.reps='10';r.done=true;
  t.addWorkoutExercises(s,a.id,['e1','e2']);
  assert.deepEqual(a.participants[0].entries.map(e=>e.id),['e1','e2']);
  assert.equal(r.done,true);assert.equal(a.participants[0].opened,1);
  assert.deepEqual(t.migrate(JSON.parse(JSON.stringify(s))),s);
  t.finish(s,a.id,'c1');
  assert.equal(s.people[1].programs[0].next,0);
  assert.equal(s.sessions.at(-1).dayName,'Разовая тренировка');
  assert.equal(t.entry(s,'c1','e1').weight,'резинка');
  assert.equal(s.sessions.at(-1).results[1].done,false);
});
test('shared additions keep independent past results and cannot modify a completed participant',()=>{
  const s=fixture(),a=t.appointment(s,['self','c1'],'10:00');
  a.mode='shared';a.participants=['self','c1'].map(t.oneOffParticipant);s.appointments.push(a);t.startAppointment(s,a.id);
  t.addWorkoutExercises(s,a.id,['e1']);
  assert.equal(a.participants[0].entries[0].weight,'22');assert.equal(a.participants[1].entries[0].weight,'5');
  a.participants[0].entries[0].done=true;
  assert.equal(a.participants[1].entries[0].done,false);
  t.finish(s,a.id,'self');t.addWorkoutExercises(s,a.id,['e2']);
  assert.equal(a.participants[0].entries.length,1);assert.equal(a.participants[1].entries.length,1);
});
test('deleting a client preserves the paired participant, personal history and independent drafts',()=>{
  const s=fixture(),a=t.appointment(s,['self','c1'],'10:00'),b=t.appointment(s,['c1'],'12:00');
  a.mode='shared';a.participants[1].entries=a.participants[0].entries.map(e=>t.entry(s,'c1',e.id));
  s.appointments.push(a,b);t.startAppointment(s,a.id);a.sharedOpened=1;a.selected=1;
  a.participants[0].entries[0].weight='42';a.participants[0].entries[0].done=true;
  t.removePerson(s,'c1');
  assert.equal(s.people.length,1);assert.equal(s.appointments.length,1);assert.equal(a.selected,0);assert.equal(a.mode,'separate');assert.equal(a.participants[0].opened,1);
  assert.equal(a.participants[0].entries[0].weight,'42');assert.equal(s.sessions[0].personId,'self');
  assert.deepEqual(t.migrate(JSON.parse(JSON.stringify(s))),s);assert.throws(()=>t.removePerson(s,'self'));
});
test('removing a mistaken active appointment neither writes history nor advances the program',()=>{
  const s=fixture(),a=t.appointment(s,['self'],'10:00');s.appointments.push(a);t.startAppointment(s,a.id);
  a.participants[0].entries[0].done=true;
  s.appointments=s.appointments.filter(x=>x.id!==a.id);
  assert.equal(s.sessions.length,1);assert.equal(s.people[0].programs[0].next,0);
  const b=t.appointment(s,['self'],'11:00');s.appointments.push(b);assert.equal(t.startAppointment(s,b.id),b.id);
});
