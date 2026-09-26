import { getSettings } from '@/db/settings';
import { heartbeat, recoverSnapshots, removeTab, seedTabs, updateTab } from './tab-snapshots';

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

  const start = async () => {
    const settings = await getSettings();
    const tabs = await browser.tabs.query({});

    await recoverSnapshots(tabs, settings);
    await seedTabs(tabs, settings);

    await browser.alarms.create('snapshot-heartbeat', { periodInMinutes: 1 });
  };

  browser.tabs.onCreated.addListener(async tab => updateTab(tab, await getSettings()));

  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (
      changeInfo.url ||
      changeInfo.title ||
      changeInfo.favIconUrl ||
      changeInfo.status === 'complete'
    )
      await updateTab(tab, await getSettings());
  });

  browser.tabs.onRemoved.addListener(async tabId => removeTab(tabId, await getSettings()));

  browser.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'snapshot-heartbeat') void heartbeat();
  });

  void start();
});
