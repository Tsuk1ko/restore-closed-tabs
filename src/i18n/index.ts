import { createI18n } from 'vue-i18n';
import type { LocaleSetting, Settings } from '@/db/types';
import en from './locales/en';
import zhCN from './locales/zh-CN';

export function resolveLocale(
  setting: LocaleSetting,
  language = navigator.language,
): 'zh-CN' | 'en' {
  return setting === 'zh-CN' || (setting === 'browser' && language.toLowerCase().startsWith('zh'))
    ? 'zh-CN'
    : 'en';
}

export function createI18nForSettings(settings: Settings) {
  return createI18n({
    legacy: false,
    locale: resolveLocale(settings.locale),
    messages: { 'zh-CN': zhCN, en },
  });
}
