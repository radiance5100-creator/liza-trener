const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Exercise the actual backup validator without opening a browser database.
const compiled = ts.transpileModule(fs.readFileSync('src/storage.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exported = {};
new Function('require', 'exports', compiled)((name) => {
  if (name === 'idb') return { openDB: () => Promise.resolve({}) };
  if (name === './seed') return { initialExercises: [] };
  throw new Error(`Unexpected dependency: ${name}`);
}, exported);
const { validateData } = exported;
const result = { exerciseId: 'exercise-1', name: 'Тяга', weight: '12', reps: '10' };
const oldBackup = () => ({ version: 1, exercises: [{ id: 'exercise-1', name: 'Тяга', group: 'Спина', weight: '20', reps: '8', note: 'Заметка', images: [null, null], history: [] }], plans: [], sessions: [] });
const clientBackup = () => ({ ...oldBackup(), clients: [{ id: 'client-1', name: 'Клиент', contact: '', note: '', results: [result], techniques: { 'exercise-1': { flagged: true, comment: 'Проверить технику' } } }], techniques: {}, plans: [{ id: 'plan-1', name: 'Программа', exerciseIds: ['exercise-1'], clientId: 'client-1' }], draft: { planName: 'Программа', results: [result], clientId: 'client-1' } });

test('legacy backups retain exercise data and gain empty client/technique collections', () => {
  const old = oldBackup();
  const migrated = validateData(old);
  assert.deepEqual(migrated.exercises, old.exercises);
  assert.deepEqual(migrated.clients, []);
  assert.deepEqual(migrated.techniques, {});
});
test('client results, ownership, draft and technique flags survive JSON round trip', () => {
  const backup = clientBackup();
  assert.deepEqual(validateData(JSON.parse(JSON.stringify(backup))), backup);
  assert.equal(backup.exercises[0].weight, '20');
  assert.equal(backup.clients[0].results[0].weight, '12');
});
test('rejects programs and drafts whose client is missing', () => {
  const backup = clientBackup();
  backup.clients = [];
  assert.throws(() => validateData(backup), /Не найден клиент/);
});
test('rejects malformed technique flags', () => {
  const backup = clientBackup();
  backup.clients[0].techniques['exercise-1'].flagged = 'yes';
  assert.throws(() => validateData(backup), /карточки клиентов/);
  assert.throws(() => validateData({ ...oldBackup(), techniques: { x: { flagged: true } } }), /пометки/);
});
test('rejects duplicate client IDs', () => {
  const backup = clientBackup();
  backup.clients.push({ ...backup.clients[0] });
  assert.throws(() => validateData(backup), /карточки клиентов/);
});
test('rejects malformed client results before replacing current data', () => {
  const backup = clientBackup();
  backup.clients[0].results = [{ ...result, weight: null }];
  assert.throws(() => validateData(backup), /карточки клиентов/);
});
