import { createI18n } from 'vue-i18n';
import type { LocaleSetting, Settings } from '@/db/types';
import en from './locales/en';
import zhCN from './locales/zh-CN';
import zhTW from './locales/zh-TW';

// 优先使用用户选定的语言，跟随浏览器时按中文地区区分简繁，其余语言回退英文
export function resolveLocale(
  setting: LocaleSetting,
  language = navigator.language,
): 'zh-CN' | 'zh-TW' | 'en' {
  if (setting !== 'browser') return setting;

  const browserLocale = language.toLowerCase().replaceAll('_', '-');
  if (/^zh-(?:hant|tw|hk|mo)(?:-|$)/.test(browserLocale)) return 'zh-TW';
  return browserLocale === 'zh' || browserLocale.startsWith('zh-') ? 'zh-CN' : 'en';
}

// 使用当前设置创建页面翻译实例，缺失的译文回退英文
export function createI18nForSettings(settings: Settings) {
  return createI18n({
    legacy: false,
    locale: resolveLocale(settings.locale),
    fallbackLocale: 'en',
    messages: { 'zh-CN': zhCN, 'zh-TW': zhTW, en },
  });
}
