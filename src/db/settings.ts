import { db, defaultSettings } from './database';
import type { Settings } from './types';

const clamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;

export async function getSettings(): Promise<Settings> {
  return { ...defaultSettings, ...(await db.settings.get('current')) };
}

export async function saveSettings(input: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next: Settings = {
    ...current,
    ...input,
    id: 'current',
    maxRecords: clamp(input.maxRecords ?? current.maxRecords, 100, 10000, 1000),
    pageSize: clamp(input.pageSize ?? current.pageSize, 5, 100, 10),
    popupWidth: clamp(input.popupWidth ?? current.popupWidth, 280, 800, 400),
  };

  await db.settings.put(next);

  return next;
}
