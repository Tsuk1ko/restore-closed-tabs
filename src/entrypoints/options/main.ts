import '@/styles.css';
import './style.css';
import { createApp } from 'vue';
import { getSettings } from '@/db/settings';
import { createI18nForSettings } from '@/i18n';
import App from './App.vue';

getSettings().then(settings => createApp(App).use(createI18nForSettings(settings)).mount('#app'));
