import type { Settings } from '@/db/types';

const allowedProtocols = new Set(['http:', 'https:', 'ftp:', 'ftps:']);

interface TabLike {
  url?: string;
  title?: string;
  incognito?: boolean;
}

// 仅记录协议白名单内的网址，Chrome 内部页面和扩展页面还需设置允许
export function shouldRecordUrl(url: string | undefined, settings: Settings) {
  if (!url) return false;

  let scheme: string;
  try {
    scheme = new URL(url).protocol;
  } catch {
    return false;
  }

  if (allowedProtocols.has(scheme)) return true;
  if (scheme === 'chrome:') return settings.recordChromeUrls;
  if (scheme === 'chrome-extension:') return settings.recordExtensionUrls;

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
