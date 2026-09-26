import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineWebExtConfig } from 'wxt';

const chromiumProfile = resolve('.wxt/chrome-data');
mkdirSync(chromiumProfile, { recursive: true });

// 启动器仅浅合并 Preferences，必须保留会被默认配置覆盖的整个设置对象
const preferencesPath = resolve(chromiumProfile, 'Default/Preferences');
const preferences = existsSync(preferencesPath)
  ? JSON.parse(readFileSync(preferencesPath, 'utf8'))
  : {};

export default defineWebExtConfig({
  chromiumProfile,
  keepProfileChanges: true,
  chromiumPref: {
    extensions: {
      ...preferences.extensions,
      ui: { ...preferences.extensions?.ui, developer_mode: true },
    },
    devtools: preferences.devtools ?? {},
  },
});
