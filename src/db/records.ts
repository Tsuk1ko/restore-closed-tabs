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

// 写入关闭记录，并在同一事务内应用网址去重和容量限制
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

// Worker 内存丢失后可通过会话 UUID 读取持久化快照
export const getSnapshot = (id: string) => db.snapshots.get(id);

export const listSnapshots = () => db.snapshots.toArray();

// 只刷新当前存活标签的快照，保留待恢复快照的原始时间
export const updateSnapshotTimes = (ids: string[], closedAt = Date.now()) =>
  db.snapshots.where('id').anyOf(ids).modify({ closedAt });

// 原子完成历史写入和快照删除，失败时整笔回滚，重复调用不重建已处理记录
export async function closeSnapshot(snapshot: TabSnapshot, settings: Settings, record = true) {
  await db.transaction('rw', db.records, db.snapshots, async () => {
    if (!(await db.snapshots.get(snapshot.id))) return;
    if (record && !(await db.records.get(snapshot.id))) await addClosedRecord(snapshot, settings);

    await db.snapshots.delete(snapshot.id);
  });
}
