export type LocaleSetting = 'browser' | 'zh-CN' | 'zh-TW' | 'en';

export interface TabRecord {
  id: string;
  url: string;
  title: string;
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
  showRecordCountBadge: boolean;
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
