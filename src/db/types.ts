export type LocaleSetting = 'browser' | 'zh-CN' | 'en';

export interface TabRecord {
  id: string;
  url: string;
  title: string;
  faviconUrl?: string;
  closedAt: number;
  incognito: boolean;
}

export type TabSnapshot = TabRecord;

export interface Settings {
  id: 'current';
  locale: LocaleSetting;
  maxRecords: number;
  pageSize: number;
  popupWidth: number;
  deleteOnRestore: boolean;
  deduplicateUrlOnClose: boolean;
  recordIncognito: boolean;
  recordChromeUrls: boolean;
  recordExtensionUrls: boolean;
}

export interface ExportPayload {
  version: 1;
  exportedAt: string;
  records: TabRecord[];
}
