import { db } from './database';
import { pruneRecords } from './records';
import type { ExportPayload, TabRecord } from './types';

const isRecord = (value: unknown): value is TabRecord => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<TabRecord>;
  return (
    typeof item.id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(item.id) &&
    typeof item.url === 'string' &&
    item.url.length > 0 &&
    typeof item.title === 'string' &&
    typeof item.closedAt === 'number' &&
    Number.isFinite(item.closedAt) &&
    typeof item.incognito === 'boolean' &&
    (item.faviconUrl === undefined || typeof item.faviconUrl === 'string')
  );
};

export async function exportRecords(): Promise<ExportPayload> {
  return { version: 1, exportedAt: new Date().toISOString(), records: await db.records.toArray() };
}

export async function importRecords(payload: unknown) {
  if (!payload || typeof payload !== 'object') throw new Error('invalid-payload');
  const value = payload as Partial<ExportPayload>;
  if (value.version !== 1 || !Array.isArray(value.records) || !value.records.every(isRecord))
    throw new Error('invalid-payload');
  await db.transaction('rw', db.records, async () =>
    db.records.bulkPut(value.records as TabRecord[]),
  );
  await pruneRecords();
  return value.records.length;
}
