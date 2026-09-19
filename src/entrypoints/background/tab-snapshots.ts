import {
  addClosedRecord,
  deleteSnapshot,
  listSnapshots,
  recoverSnapshot,
  updateSnapshotTimes,
  upsertSnapshot,
} from '@/db/records';
import type { Settings, TabSnapshot } from '@/db/types';
import { shouldRecordTab } from './url-policy';

interface TabLike {
  id?: number;
  url?: string;
  title?: string;
  favIconUrl?: string;
  incognito?: boolean;
}

const key = (tabId: number) => `tab:${tabId}`;

const memory = new Map<number, TabSnapshot>();

async function getUuid(tabId: number) {
  const result = (await browser.storage.session.get(key(tabId))) as Record<string, unknown>;
  const value = result[key(tabId)];

  return typeof value === 'string' ? value : crypto.randomUUID();
}

async function setUuid(tabId: number, id: string) {
  await browser.storage.session.set({ [key(tabId)]: id });
}

async function clearUuid(tabId: number) {
  await browser.storage.session.remove(key(tabId));
}

export async function updateTab(tab: TabLike, settings: Settings) {
  if (tab.id === undefined) return;

  if (!shouldRecordTab(tab, settings)) {
    // 导航到不允许记录的网址时同时清除持久化快照，避免重启后恢复旧记录
    const id = memory.get(tab.id)?.id ?? (await getUuid(tab.id));

    memory.delete(tab.id);
    await deleteSnapshot(id);
    await clearUuid(tab.id);

    return;
  }

  const id = memory.get(tab.id)?.id ?? (await getUuid(tab.id));
  const snapshot: TabSnapshot = {
    id,
    url: tab.url!,
    title: tab.title!,
    faviconUrl: tab.favIconUrl,
    closedAt: Date.now(),
    incognito: Boolean(tab.incognito),
  };

  memory.set(tab.id, snapshot);
  await setUuid(tab.id, id);
  await upsertSnapshot(snapshot);
}

export async function removeTab(tabId: number, settings: Settings) {
  const snapshot = memory.get(tabId);

  memory.delete(tabId);
  await clearUuid(tabId);

  if (snapshot && shouldRecordTab(snapshot, settings))
    await addClosedRecord({ ...snapshot, closedAt: Date.now() }, settings);
}

export async function heartbeat() {
  await updateSnapshotTimes();
}

// 恢复快照时应用当前记录策略，丢弃已不允许记录的快照
export async function recoverSnapshots(activeTabs: TabLike[], settings: Settings) {
  const activeUrls = new Set(
    activeTabs.map(tab => tab.url).filter((url): url is string => Boolean(url)),
  );

  for (const snapshot of await listSnapshots()) {
    // ponytail: URL matching is O(n) and ambiguous for duplicate tabs; snapshot rows intentionally omit tabId.
    if (!shouldRecordTab(snapshot, settings) || activeUrls.has(snapshot.url))
      await deleteSnapshot(snapshot.id);
    else await recoverSnapshot(snapshot);
  }
}

export async function seedTabs(tabs: TabLike[], settings: Settings) {
  for (const tab of tabs) await updateTab(tab, settings);
}
