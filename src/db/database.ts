import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { Settings, TabRecord, TabSnapshot } from './types';

export const defaultSettings: Settings = {
  id: 'current',
  locale: 'browser',
  maxRecords: 1000,
  pageSize: 10,
  popupWidth: 400,
  showRecordCountBadge: false,
  deleteOnRestore: false,
  deduplicateUrlOnClose: false,
  recordIncognito: false,
  recordChromeUrls: false,
  recordExtensionUrls: false,
};

export class TabsDatabase extends Dexie {
  records!: Table<TabRecord, string>;
  snapshots!: Table<TabSnapshot, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('closed-tabs');

    this.version(1).stores({
      records: 'id, closedAt, url',
      snapshots: 'id, closedAt',
      settings: 'id',
    });

    // 在升级事务中清理两张表的旧图标属性，索引不变，失败时整笔回滚
    this.version(2)
      .stores({})
      .upgrade(async transaction => {
        for (const name of ['records', 'snapshots']) {
          await transaction
            .table(name)
            .toCollection()
            .modify(record => {
              delete record.faviconUrl;
            });
        }
      });
  }
}

export const db = new TabsDatabase();
