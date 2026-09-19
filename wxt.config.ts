import ui from '@nuxt/ui/vite';
import vueDevTools from 'vite-plugin-vue-devtools';
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-vue'],
  manifest: () => ({
    key: process.env.MANIFEST_KEY,
    name: 'Closed Tabs History',
    description: 'Remember and restore closed tabs.',
    permissions: ['tabs', 'favicon', 'storage', 'alarms'],
    incognito: 'spanning',
  }),
  vite: () => ({
    plugins: [
      vueDevTools({
        // 从入口注入，避免扩展页面把 DevTools 脚本解析成 chrome-extension:// 路径
        appendTo: '/main.ts',
        componentInspector: {
          toggleComboKey: process.platform === 'darwin' ? 'meta-shift-s' : 'alt-s',
        },
      }),
      ui({
        router: false,
        colorMode: false,
        autoImport: {
          dts: './src/auto-import.d.ts',
        },
        components: {
          dirs: [],
          dts: './src/components.d.ts',
        },
      }),
    ],
  }),
});
