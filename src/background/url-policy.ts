import type { Settings } from '@/db/types';

interface TabLike {
  id?: number;
  url?: string;
  title?: string;
  favIconUrl?: string;
  incognito?: boolean;
}
export function shouldRecordUrl(url: string | undefined, settings: Settings) {
  if (!url) return false;
  let scheme: string;
  try {
    scheme = new URL(url).protocol;
  } catch {
    return false;
  }
  if (scheme === 'http:' || scheme === 'https:' || (scheme === 'about:' && url === 'about:blank'))
    return true;
  if (scheme === 'file:') return true;
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
