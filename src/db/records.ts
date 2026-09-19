import { db } from './database';
import { getSettings } from './settings';
import type { Settings, TabRecord, TabSnapshot } from './types';

export async function pruneRecords(settings?: Settings) {
  settings ??= await getSettings();

  const count = await db.records.count();
  if (count <= settings.maxRecords) return;

  const excess = await db.records
    .orderBy('closedAt')
    .limit(count - settings.maxRecords)
    .primaryKeys();
  await db.records.bulkDelete(excess as string[]);
}

export async function addClosedRecord(record: TabRecord, settings?: Settings) {
  settings ??= await getSettings();

  await db.transaction('rw', db.records, async () => {
    if (settings.deduplicateUrlOnClose) await db.records.where('url').equals(record.url).delete();

    await db.records.put(record);
    await pruneRecords(settings);
  });
}

export const listRecords = () => db.records.orderBy('closedAt').reverse().toArray();

export const deleteRecord = (id: string) => db.records.delete(id);

export const clearRecords = () => db.records.clear();

export async function upsertSnapshot(snapshot: TabSnapshot) {
  await db.snapshots.put(snapshot);
}

export const deleteSnapshot = (id: string) => db.snapshots.delete(id);

export const listSnapshots = () => db.snapshots.toArray();

export const deleteSnapshots = (ids: string[]) => db.snapshots.bulkDelete(ids);

export const updateSnapshotTimes = (closedAt = Date.now()) =>
  db.snapshots.toCollection().modify({ closedAt });

export async function recoverSnapshot(snapshot: TabSnapshot) {
  await db.transaction('rw', db.records, db.snapshots, async () => {
    if (!(await db.records.get(snapshot.id))) await db.records.put(snapshot);

    await db.snapshots.delete(snapshot.id);
  });

  await pruneRecords();
}
