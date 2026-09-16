import ui from '@nuxt/ui/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'Closed Tabs History',
    description: 'Remember and restore closed tabs.',
    permissions: ['tabs', 'favicon', 'storage', 'alarms'],
    incognito: 'spanning',
  },
  vite: () => ({
    plugins: [
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
