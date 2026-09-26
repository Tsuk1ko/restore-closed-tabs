import { getSettings } from '@/db/settings';
import {
  heartbeat,
  recoverSnapshots,
  removeTab,
  replaceTab,
  seedTabs,
  updateTab,
} from './tab-snapshots';

export default defineBackground(() => {
  if (import.meta.env.DEV) {
    browser.runtime.onInstalled.addListener(async () => {
      try {
        const url = browser.runtime.getURL('/popup.html');
        const tabs = await browser.tabs.query({});
        const existingPopup = tabs.find(tab => tab.url === url || tab.pendingUrl === url);

        if (existingPopup?.id !== undefined) {
          // 扩展重载会使已有页面上下文失效，刷新原标签页以加载新的 popup
          await browser.tabs.reload(existingPopup.id);
        } else {
          const popup = await browser.tabs.create({ url });

          // popup 创建成功后仅关闭同窗口原先激活的空白页，保留其他标签页
          for (const tab of tabs) {
            if (
              tab.id !== undefined &&
              tab.windowId === popup.windowId &&
              tab.active &&
              (tab.pendingUrl ?? tab.url) === 'about:blank'
            ) {
              await browser.tabs.remove(tab.id);
            }
          }
        }
      } catch (error) {
        console.error('Failed to open development popup:', error);
      }
    });
  }

  // ponytail: 全局串行处理标签事件，若实测吞吐不足再拆成每个 tab 的队列
  let queue = Promise.resolve();
  const pendingTabs = new Set<number>();

  // 接收事件时立即入队，设置读取也在队列内，失败不会中断后续事件
  const enqueue = (task: () => Promise<void>, tabId?: number) => {
    // 初始化查询可能已看不到刚关闭的 tab，保留其 UUID 交给排队事件处理
    if (tabId !== undefined) pendingTabs.add(tabId);
    queue = queue
      .then(async () => {
        if (tabId !== undefined) pendingTabs.delete(tabId);
        await task();
      })
      .catch(error => console.error('Failed to process tab snapshots:', error));
  };

  // 初始化排在所有事件之前，避免恢复、创建和关闭同时修改快照
  const start = async () => {
    const settings = await getSettings();
    const tabs = await browser.tabs.query({});

    await recoverSnapshots(tabs, settings, pendingTabs);
    await seedTabs(tabs, settings);

    await browser.alarms.create('snapshot-heartbeat', { periodInMinutes: 1 });
  };

  enqueue(start);

  browser.tabs.onCreated.addListener(tab => {
    enqueue(async () => updateTab(tab, await getSettings()), tab.id);
  });

  browser.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (
      changeInfo.url !== undefined ||
      changeInfo.title !== undefined ||
      changeInfo.favIconUrl !== undefined ||
      changeInfo.status === 'complete'
    )
      enqueue(async () => updateTab(tab, await getSettings()), tab.id);
  });

  browser.tabs.onRemoved.addListener(tabId => {
    enqueue(async () => removeTab(tabId, await getSettings()), tabId);
  });

  browser.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
    enqueue(async () => replaceTab(addedTabId, removedTabId, await getSettings()), removedTabId);
  });

  browser.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'snapshot-heartbeat') enqueue(heartbeat);
  });
});
