<template>
  <UApp :locale="uiLocale">
    <div class="w-full bg-default text-default">
      <header class="flex gap-2 border-b border-default p-2">
        <UInput
          v-model="query"
          class="min-w-0 flex-1"
          :placeholder="t('search')"
          :aria-label="t('search')"
          spellcheck="false"
          autofocus
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
      <main v-if="visible.length">
        <ClosedTabItem
          v-for="record in visible"
          :key="record.id"
          :record="record"
          :relative-time="
            dayjs(record.closedAt)
              .locale(locale === 'zh-CN' ? 'zh-cn' : 'en')
              .fromNow()
          "
          @open="open"
        />
        <!-- 多页时按每项 45px 补齐末页空位，保持翻页高度稳定 -->
        <div
          v-if="pageCount > 1"
          aria-hidden="true"
          :style="{ height: `${(pageSize - visible.length) * 45}px` }"
        ></div>
      </main>
      <UEmpty
        v-else
        :title="t('empty')"
        icon="i-lucide-history"
        size="sm"
        class="rounded-none border-0 pt-9! pb-10!"
        style="box-shadow: none"
      />
      <footer v-if="pageCount > 1" class="flex justify-center p-2">
        <UPagination
          v-model:page="page"
          :total="filtered.length"
          :items-per-page="pageSize"
          size="xs"
        />
      </footer>
    </div>
  </UApp>
</template>

<script setup lang="ts">
import 'dayjs/locale/zh-cn';
import { en, zh_cn } from '@nuxt/ui/locale';
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
const uiLocale = computed(() => (locale.value === 'zh-CN' ? zh_cn : en));

const records = ref<TabRecord[]>([]);
const query = ref('');
const page = ref(1);
const settings = ref<Settings>();

// 按标题和网址筛选记录，保留原有时间顺序
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();

  return q
    ? records.value.filter(r => `${r.title}\n${r.url}`.toLowerCase().includes(q))
    : records.value;
});

const pageSize = computed(() => settings.value?.pageSize || 10);
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize.value)));

const visible = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
);

// 搜索或每页条数变化时返回首页，删除末页记录后收敛到最后一页
watch([query, pageSize], () => {
  page.value = 1;
});

watch(pageCount, value => {
  if (page.value > value) page.value = value;
});

// 首次订阅读取设置，后续跨页面变更同步语言、宽度和恢复行为
const settingsSubscription = liveQuery(getSettings).subscribe({
  next(value) {
    settings.value = value;
    locale.value = resolveLocale(value.locale);
    document.body.style.setProperty('--popup-width', `${value.popupWidth}px`);
  },
  error: error => console.error('Failed to observe settings:', error),
});

// 记录增删和导入统一由查询订阅刷新，设置或快照写入不会触发列表查询
const recordsSubscription = liveQuery(listRecords).subscribe({
  next: value => (records.value = value),
  error: error => console.error('Failed to observe records:', error),
});

// 组件卸载时释放订阅，避免继续接收数据库更新
onUnmounted(() => {
  settingsSubscription.unsubscribe();
  recordsSubscription.unsubscribe();
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
