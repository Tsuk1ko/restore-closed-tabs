import { refreshRecordCountBadge } from '@/utils/record-count-badge';
import { db, defaultSettings } from './database';
import type { Settings } from './types';

const clamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;

export async function getSettings(): Promise<Settings> {
  return { ...defaultSettings, ...(await db.settings.get('current')) };
}

// 原子合并设置，避免多个设置页并发保存时覆盖旧开关并漏掉角标刷新
export async function saveSettings(input: Partial<Settings>): Promise<Settings> {
  const { next, badgeChanged } = await db.transaction('rw', db.settings, async () => {
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
    return { next, badgeChanged: next.showRecordCountBadge !== current.showRecordCountBadge };
  });

  // 只在角标开关变化且设置已提交后刷新，其他设置无需更新角标
  if (badgeChanged) await refreshRecordCountBadge();

  return next;
}
