import { refreshRecordCountBadge } from '@/utils/record-count-badge';
import { isTabRecord, pickTabRecord } from '@/utils/tab-record';
import { db } from './database';
import { pruneRecords } from './records';
import { getSettings } from './settings';
import type { ExportPayload } from './types';

// 保持备份格式版本不变，数据库升级和写入白名单保证不再导出旧图标字段
export async function exportRecords(): Promise<ExportPayload> {
  return { version: 1, exportedAt: new Date().toISOString(), records: await db.records.toArray() };
}

// 文件结构错误仍拒绝导入，单条记录损坏则跳过并返回数量供通知展示
export async function importRecords(payload: unknown) {
  if (!payload || typeof payload !== 'object') throw new Error('invalid-payload');

  const value = payload as Partial<ExportPayload>;

  if (value.version !== 1 || !Array.isArray(value.records)) throw new Error('invalid-payload');

  const records = value.records.filter(isTabRecord).map(pickTabRecord);
  const result = { count: records.length, skipCount: value.records.length - records.length };
  // 没有有效记录时不改动数据库，也不触发已有记录的容量裁剪
  if (!records.length) return result;

  const settings = await getSettings();
  // 导入与容量裁剪一起提交，避免中途失败或显示尚未裁剪的数量
  await db.transaction('rw', db.records, async () => {
    await db.records.bulkPut(records);
    await pruneRecords(settings);
  });
  await refreshRecordCountBadge();

  return result;
}
