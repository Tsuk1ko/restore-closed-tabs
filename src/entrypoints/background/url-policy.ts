import type { Settings } from '@/db/types';

const allowedProtocols = new Set(['http:', 'https:', 'ftp:', 'ftps:']);

interface TabLike {
  url?: string;
  title?: string;
  incognito?: boolean;
}

// 仅记录协议白名单内的网址，Chrome 内部页面和扩展页面还需设置允许，始终排除新标签页
export function shouldRecordUrl(url: string | undefined, settings: Settings) {
  if (!url) return false;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return false;
  }

  if (allowedProtocols.has(parsedUrl.protocol)) return true;
  if (parsedUrl.protocol === 'chrome:')
    return settings.recordChromeUrls && parsedUrl.hostname !== 'newtab';
  if (parsedUrl.protocol === 'chrome-extension:') return settings.recordExtensionUrls;

  return false;
}

export function shouldRecordTab(tab: TabLike, settings: Settings) {
  return Boolean(
    tab.url &&
    tab.title &&
    shouldRecordUrl(tab.url, settings) &&
    (!tab.incognito || settings.recordIncognito),
  );
}
