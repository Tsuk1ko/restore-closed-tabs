import '@/styles.css';
import './style.css';
import ui from '@nuxt/ui/vue-plugin';
import { createApp } from 'vue';
import { getSettings } from '@/db/settings';
import { createI18nForSettings } from '@/i18n';
import App from './App.vue';

// 注册 Nuxt UI 运行时插件，初始化主题变量及本地图标
getSettings().then(settings =>
  createApp(App).use(ui).use(createI18nForSettings(settings)).mount('#app'),
);
