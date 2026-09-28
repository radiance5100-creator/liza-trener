import { openDB } from "idb";
import { emptyStore, migrate, validateStore, type Store } from "./training";

const database = openDB("liza-trener", 1, {
  upgrade(db) {
    db.createObjectStore("app");
  },
});
export async function loadTraining(): Promise<Store> {
  const db = await database;
  const tx = db.transaction("app", "readwrite");
  const current = await tx.store.get("training-v2");
  if (current) {
    await tx.done;
    return validateStore(current);
  }
  const legacy = await tx.store.get("data");
  const next = legacy ? migrate(legacy) : emptyStore();
  if (legacy) await tx.store.put(legacy, "migration-original-v1");
  await tx.store.put(next, "training-v2");
  await tx.done;
  return next;
}
let queue: Promise<void> = Promise.resolve();
export function saveTraining(value: Store): Promise<void> {
  const snapshot = structuredClone(value);
  queue = queue
    .catch(() => {})
    .then(async () => {
      await (await database).put("app", snapshot, "training-v2");
    });
  return queue;
}
export async function importTraining(value: unknown): Promise<Store> {
  const next = migrate(value);
  await queue.catch(() => {});
  const db = await database,
    tx = db.transaction("app", "readwrite");
  const before = await tx.store.get("training-v2");
  if (before) await tx.store.put(before, "before-import-v2");
  await tx.store.put(next, "training-v2");
  await tx.done;
  return next;
}
export async function getRecovery(): Promise<unknown> {
  const db = await database;
  return (
    (await db.get("app", "before-import-v2")) ??
    (await db.get("app", "migration-original-v1")) ??
    (await db.get("app", "data"))
  );
}
