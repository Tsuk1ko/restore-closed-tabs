import ui from '@nuxt/ui/vite';
import vueDevTools from 'vite-plugin-vue-devtools';
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-vue', '@wxt-dev/auto-icons'],
  autoIcons: {
    developmentIndicator: false,
  },
  hooks: {
    // 每次启动开发服务器后只重载一次，刷新持久化 profile 中的旧后台脚本
    'server:started': (_wxt, server) => {
      let reloaded = false;
      server.ws.on('wxt:background-initialized', () => {
        if (reloaded) return;
        reloaded = true;
        server.reloadExtension();
      });
    },
  },
  // 生成扩展清单，名称和描述由浏览器按语言从 _locales 解析
  manifest: () => ({
    key: process.env.MANIFEST_KEY,
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
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
        // 扫描源码中的图标名称，将使用的图标打包到本地
        icon: {
          clientBundle: {
            scan: true,
          },
        },
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
