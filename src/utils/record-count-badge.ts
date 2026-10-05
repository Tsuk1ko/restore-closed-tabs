import { db, defaultSettings } from '@/db/database';

const UPDATE_BADGE_MESSAGE = 'update-record-count-badge';
let updateInBackground: (() => Promise<void>) | undefined;

// 写入方在事务提交后调用，后台直接刷新，页面发送消息并等待刷新完成
export async function refreshRecordCountBadge() {
  try {
    if (updateInBackground) await updateInBackground();
    else await browser.runtime.sendMessage(UPDATE_BADGE_MESSAGE);
  } catch (error) {
    // 角标更新失败不改变已经提交的数据操作结果
    console.error('Failed to update record count badge:', error);
  }
}

// 后台统一写入全局角标，每次启动重新读取数据库，避免重启后沿用旧数量
export function initializeRecordCountBadge() {
  let queue = Promise.resolve();

  // 串行读取最新状态并写入，避免并发操作让旧数量或旧开关状态覆盖新值
  const update = () => {
    queue = queue
      .then(async () => {
        const text = await db.transaction('r', db.settings, db.records, async () => {
          const settings = (await db.settings.get('current')) ?? defaultSettings;
          if (!settings.showRecordCountBadge) return '';

          // 超过三位数时缩写角标，零条记录仍显示 0
          const count = await db.records.count();
          return count > 999 ? '999+' : String(count);
        });

        await browser.action.setBadgeBackgroundColor({ color: '#0672F0' });
        await browser.action.setBadgeTextColor({ color: '#FFFFFF' });
        await browser.action.setBadgeText({ text });
      })
      .catch(error => console.error('Failed to update record count badge:', error));
    return queue;
  };

  // 同步注册消息监听，保留响应通道直到角标刷新完成
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message !== UPDATE_BADGE_MESSAGE || sender.id !== browser.runtime.id) return;
    void update().then(() => sendResponse());
    return true;
  });

  updateInBackground = update;
  void update();
}
