import {
  heartbeat,
  recoverSnapshots,
  removeTab,
  seedTabs,
  updateTab,
} from '@/background/tab-snapshots';
import { getSettings } from '@/db/settings';

export default defineBackground(() => {
  const start = async () => {
    const settings = await getSettings();
    const tabs = await browser.tabs.query({});
    await recoverSnapshots(tabs);
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
