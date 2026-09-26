import {
  closeSnapshot,
  deleteSnapshot,
  getSnapshot,
  listSnapshots,
  updateSnapshotTimes,
  upsertSnapshot,
} from '@/db/records';
import type { Settings, TabSnapshot } from '@/db/types';
import { shouldRecordTab, shouldRecordUrl } from './url-policy';

interface TabLike {
  id?: number;
  url?: string;
  title?: string;
  favIconUrl?: string;
  incognito?: boolean;
}

// 会话映射跨 Worker 重启保留，浏览器新会话不会复用旧 tab ID 的 UUID
const key = (tabId: number) => `tab:${tabId}`;
const memory = new Map<number, TabSnapshot>();

// 只查询已有 UUID，读取和清理路径不得创建新身份
async function getUuid(tabId: number) {
  const result = (await browser.storage.session.get(key(tabId))) as Record<string, unknown>;
  const value = result[key(tabId)];
  return typeof value === 'string' ? value : undefined;
}

// 将标签与快照 UUID 的关联保存到当前浏览器会话
async function setUuid(tabId: number, id: string) {
  await browser.storage.session.set({ [key(tabId)]: id });
}

// 数据库操作成功后才清理会话和内存，失败时保留重试所需的关联
async function clearUuid(tabId: number) {
  await browser.storage.session.remove(key(tabId));
  memory.delete(tabId);
}

// 调用方通过后台事件队列串行执行，同一个有效 tab 始终覆盖同一条快照
export async function updateTab(tab: TabLike, settings: Settings) {
  if (tab.id === undefined || !tab.url) return;
  const existingId = memory.get(tab.id)?.id ?? (await getUuid(tab.id));

  if (!shouldRecordUrl(tab.url, settings) || (tab.incognito && !settings.recordIncognito)) {
    // 导航到禁止记录的页面时丢弃快照，不把旧页面误记为关闭历史
    if (existingId) await deleteSnapshot(existingId);
    await clearUuid(tab.id);
    return;
  }

  // 页面加载中的缺失标题不是策略拒绝，不清除已有快照和稳定 UUID
  if (!tab.title) return;
  const id = existingId ?? crypto.randomUUID();
  const snapshot: TabSnapshot = {
    id,
    url: tab.url,
    title: tab.title,
    faviconUrl: tab.favIconUrl,
    closedAt: Date.now(),
    incognito: Boolean(tab.incognito),
  };

  await setUuid(tab.id, id);
  await upsertSnapshot(snapshot);
  memory.set(tab.id, snapshot);
}

// 正常关闭或恢复时均先提交数据库事务，再释放 tab 与 UUID 的关联
export async function removeTab(tabId: number, settings: Settings) {
  const id = memory.get(tabId)?.id ?? (await getUuid(tabId));
  const snapshot = memory.get(tabId) ?? (id ? await getSnapshot(id) : undefined);
  if (snapshot) {
    await closeSnapshot(
      { ...snapshot, closedAt: Date.now() },
      settings,
      shouldRecordTab(snapshot, settings),
    );
  }
  await clearUuid(tabId);
}

// 浏览器替换 tab ID 时沿用原 UUID，关联转移后再刷新页面信息
export async function replaceTab(addedTabId: number, removedTabId: number, settings: Settings) {
  const id = memory.get(removedTabId)?.id ?? (await getUuid(removedTabId));
  const snapshot = memory.get(removedTabId) ?? (id ? await getSnapshot(id) : undefined);
  if (id) {
    // 初始化查询可能已为替换后的 tab 建立快照，迁移原 UUID 时删除这份临时副本
    const addedId = memory.get(addedTabId)?.id ?? (await getUuid(addedTabId));
    if (addedId && addedId !== id) await deleteSnapshot(addedId);
    await setUuid(addedTabId, id);
    if (snapshot) memory.set(addedTabId, snapshot);
    await clearUuid(removedTabId);
  }
  await updateTab(await browser.tabs.get(addedTabId), settings);
}

// 只更新已关联且仍打开的标签，关闭写入失败的快照不得被心跳改写时间
export async function heartbeat() {
  const tabs = await browser.tabs.query({});
  const ids = tabs.flatMap(tab => {
    const snapshot = tab.id === undefined ? undefined : memory.get(tab.id);
    return snapshot ? [snapshot.id] : [];
  });
  await updateSnapshotTimes(ids);
}

// 按会话 UUID 恢复存活标签，不能用 URL 区分多个打开同一网址的标签
export async function recoverSnapshots(
  activeTabs: TabLike[],
  settings: Settings,
  pendingTabs: ReadonlySet<number>,
) {
  const session = (await browser.storage.session.get(null)) as Record<string, unknown>;
  const activeByUuid = new Map<string, number>();
  const tabByUuid = new Map<string, number>();
  for (const [sessionKey, id] of Object.entries(session)) {
    if (sessionKey.startsWith('tab:') && typeof id === 'string') {
      tabByUuid.set(id, Number(sessionKey.slice(4)));
    }
  }
  for (const tab of activeTabs) {
    if (tab.id === undefined) continue;
    const id = session[key(tab.id)];
    if (typeof id === 'string') activeByUuid.set(id, tab.id);
  }

  for (const snapshot of await listSnapshots()) {
    // 待处理的更新/关闭/替换事件需要沿用原 UUID，不能先恢复成历史再分配新身份
    const queuedTabId = tabByUuid.get(snapshot.id);
    const tabId =
      queuedTabId !== undefined && pendingTabs.has(queuedTabId)
        ? queuedTabId
        : activeByUuid.get(snapshot.id);
    if (tabId !== undefined) {
      memory.set(tabId, snapshot);
      continue;
    }
    await closeSnapshot(snapshot, settings, shouldRecordTab(snapshot, settings));
    // 只清理已成功处理的 UUID 映射，不影响初始化期间排队的新事件
    if (queuedTabId !== undefined) await clearUuid(queuedTabId);
  }
}

// 初始化当前打开的标签，后续事件由同一队列等待此阶段完成
export async function seedTabs(tabs: TabLike[], settings: Settings) {
  for (const tab of tabs) await updateTab(tab, settings);
}
