import { pick } from 'es-toolkit';
import { z } from 'zod';
import type { TabRecord } from '@/db/types';

const tabRecordSchema = z.looseObject({
  id: z.uuid(),
  url: z.url(),
  title: z.string(),
  // 毫秒时间戳必须为非负整数，且不能超出 JavaScript Date 的有效范围
  closedAt: z.number().int().min(0).max(8_640_000_000_000_000),
  incognito: z.boolean(),
});

// 导入记录和持久化快照共用校验，允许额外字段但不转换字段类型
export function isTabRecord(value: unknown): value is TabRecord {
  return tabRecordSchema.safeParse(value).success;
}

// 写入前只保留当前模型字段，避免旧备份或快照带回废弃属性
export function pickTabRecord(record: TabRecord): TabRecord {
  return pick(record, ['id', 'url', 'title', 'closedAt', 'incognito']);
}
