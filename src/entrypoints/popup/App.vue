<template>
  <UApp :locale="uiLocale">
    <div class="w-full bg-default text-default" :aria-busy="loading" @contextmenu.prevent>
      <header class="flex gap-2 border-default p-2">
        <UInput
          v-model="query"
          class="min-w-0 flex-1"
          :placeholder="t('search')"
          :aria-label="t('search')"
          spellcheck="false"
          autofocus
          @contextmenu.stop
        />
        <UButton
          icon="i-lucide-settings"
          color="neutral"
          variant="outline"
          :title="t('settings')"
          :aria-label="t('settings')"
          @click="browser.runtime.openOptionsPage()"
        />
      </header>
      <main v-if="records.length">
        <ClosedTabItem
          v-for="record in records"
          :key="record.id"
          :record="record"
          :class="{ 'bg-elevated': contextRecord?.id === record.id }"
          @open="open"
          @contextmenu.stop="showContextMenu($event, record)"
        />
        <!-- 多页时按每项 45px 补齐末页空位，保持翻页高度稳定 -->
        <div
          v-if="pageCount > 1"
          aria-hidden="true"
          :style="{ height: `${Math.max(0, pageSize - records.length) * 45}px` }"
        ></div>
      </main>
      <UEmpty
        v-else-if="!loading"
        :title="t(failed ? 'operationFailed' : 'empty')"
        icon="i-lucide-history"
        size="sm"
        class="rounded-none border-0 pt-9! pb-10!"
        style="box-shadow: none"
      />
      <!-- 菜单关闭时清空目标记录，解除对应项的固定 hover 背景 -->
      <UContextMenu
        :items="contextMenuItems"
        @update:open="contextRecord = $event ? contextRecord : undefined"
      >
        <span ref="contextMenuTrigger" class="hidden" @contextmenu.stop></span>
      </UContextMenu>
      <footer v-if="pageCount > 1" class="flex justify-center p-2 border-t border-default">
        <UPagination v-model:page="page" :total="total" :items-per-page="pageSize" size="xs" />
      </footer>
    </div>
  </UApp>
</template>

<script setup lang="ts">
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/zh-tw';
import type { ContextMenuItem } from '@nuxt/ui';
import { useToast } from '@nuxt/ui/composables';
import { en, zh_cn, zh_tw } from '@nuxt/ui/locale';
import { useTimeoutFn } from '@vueuse/core';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { liveQuery } from 'dexie';
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import ClosedTabItem from '@/components/ClosedTabItem.vue';
import { deleteRecord, listRecords } from '@/db/records';
import { getSettings } from '@/db/settings';
import type { Settings, TabRecord } from '@/db/types';
import { resolveLocale } from '@/i18n';

dayjs.extend(relativeTime);

const { t, locale } = useI18n();
const toast = useToast();
const uiLocale = computed(() =>
  locale.value === 'zh-TW' ? zh_tw : locale.value === 'zh-CN' ? zh_cn : en,
);

watch(
  locale,
  value => {
    dayjs.locale(value === 'zh-TW' ? 'zh-tw' : value === 'zh-CN' ? 'zh-cn' : 'en');
  },
  { immediate: true },
);

const records = ref<TabRecord[]>([]);
const total = ref(0);
const loading = ref(true);
const failed = ref(false);
const query = ref('');
// null 表示正在等待输入稳定，此时不接收旧查询结果
const searchQuery = ref<string | null>('');
const page = ref(1);
const settings = ref<Settings>();
const contextMenuTrigger = ref<HTMLElement>();
const contextRecord = ref<TabRecord>();

const contextMenuItems = computed<ContextMenuItem[]>(() => [
  { label: t('copyTitle'), onSelect: () => runContextAction('title') },
  { label: t('copyUrl'), onSelect: () => runContextAction('url') },
  { label: t('copyLink'), onSelect: () => runContextAction('link') },
  { type: 'separator' },
  { label: t('delete'), color: 'error', onSelect: () => runContextAction('delete') },
]);

// 记录右击目标，将鼠标坐标转交给唯一的 ContextMenu 触发器
function showContextMenu(event: MouseEvent, record: TabRecord) {
  event.preventDefault();
  contextRecord.value = record;
  contextMenuTrigger.value?.dispatchEvent(
    new MouseEvent('contextmenu', {
      clientX: event.clientX,
      clientY: event.clientY,
      bubbles: true,
      cancelable: true,
    }),
  );
}

// 操作右击选中的记录，删除后的列表与分页由现有订阅更新
async function runContextAction(action: 'title' | 'url' | 'link' | 'delete') {
  const record = contextRecord.value;
  if (!record) return;

  try {
    if (action === 'delete') {
      await deleteRecord(record.id);
    } else if (action === 'link') {
      // 使用 DOM 序列化转义标题和属性，纯文本粘贴场景保留网址
      const link = document.createElement('a');
      link.setAttribute('href', record.url);
      link.textContent = record.title;
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([link.outerHTML], { type: 'text/html' }),
          'text/plain': new Blob([record.url], { type: 'text/plain' }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(record[action]);
    }
  } catch {
    toast.add({ title: t('operationFailed'), color: 'error', duration: 2000 });
  }
}

const pageSize = computed(() => settings.value?.pageSize || 10);
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));

// 应用稳定后的搜索词并返回首页，定时器随组件作用域自动清理
function applySearch(q: string) {
  searchQuery.value = q;
  page.value = 1;
}

const { start: scheduleSearch, stop: cancelSearch } = useTimeoutFn(applySearch, 300, {
  immediate: false,
});

// 连续输入停止 300ms 后应用搜索，清空时立即恢复首页并取消待执行的搜索
watch(
  query,
  value => {
    const q = value.trim().toLowerCase();

    if (!q) {
      cancelSearch();
      applySearch(q);
      return;
    }

    // 输入时立即使旧查询失效，防抖期间保留已显示的列表且不发起查询
    searchQuery.value = null;
    scheduleSearch(q);
  },
  { flush: 'sync' },
);

// 每页条数变化立即回到首页，不等待搜索防抖
watch(pageSize, () => (page.value = 1));

// 首次订阅读取设置，后续跨页面变更同步语言、宽度和恢复行为
const settingsSubscription = liveQuery(getSettings).subscribe({
  next(value) {
    settings.value = value;
    locale.value = resolveLocale(value.locale);
    document.body.style.setProperty('--popup-width', `${value.popupWidth}px`);
  },
  error: error => console.error('Failed to observe settings:', error),
});

// 参数变化时重建订阅，记录增删和导入仍由 liveQuery 自动刷新当前页
watch(
  [page, pageSize, searchQuery],
  ([currentPage, size, q], _previous, onCleanup) => {
    loading.value = true;
    if (q === null) return;

    let active = true;
    // 同时校验最新参数，覆盖参数已变但旧订阅尚未清理的微任务间隙
    const isCurrent = () =>
      active && page.value === currentPage && pageSize.value === size && searchQuery.value === q;
    const subscription = liveQuery(() => {
      if (isCurrent()) loading.value = true;
      return listRecords(currentPage, size, q);
    }).subscribe({
      next(value) {
        if (!isCurrent()) return;
        records.value = value.records;
        total.value = value.total;
        page.value = value.page;
        loading.value = false;
        failed.value = false;
      },
      error(error) {
        if (!isCurrent()) return;
        loading.value = false;
        failed.value = true;
        console.error('Failed to observe records:', error);
        toast.add({ title: t('operationFailed'), color: 'error', duration: 2000 });
      },
    });

    // 切换参数或卸载时释放订阅，忽略旧查询迟到的结果
    onCleanup(() => {
      active = false;
      subscription.unsubscribe();
    });
  },
  { immediate: true },
);

// 查询订阅与防抖计时器随组件作用域自动清理，此处释放独立的设置订阅
onUnmounted(() => {
  settingsSubscription.unsubscribe();
});

// 左键前台恢复并关闭 popup，中键后台恢复，按设置决定是否删除记录
async function open(record: TabRecord, middle: boolean) {
  try {
    await browser.tabs.create({ url: record.url, active: !middle });

    if (settings.value?.deleteOnRestore) {
      await deleteRecord(record.id);
    }

    if (!middle) window.close();
  } catch {
    /* keep record when Chrome rejects navigation */
  }
}
</script>
