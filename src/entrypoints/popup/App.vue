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
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import ClosedTabItem from '@/components/ClosedTabItem.vue';
import { deleteRecord, listRecords } from '@/db/records';
import { getSettings } from '@/db/settings';
import type { Settings, TabRecord } from '@/db/types';

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

// 读取设置和记录，并将用户设置的宽度应用到 popup
async function load() {
  settings.value = await getSettings();
  document.body.style.setProperty('--popup-width', `${settings.value.popupWidth}px`);

  records.value = await listRecords();
}

// 左键前台恢复并关闭 popup，中键后台恢复，按设置决定是否删除记录
async function open(record: TabRecord, middle: boolean) {
  try {
    await browser.tabs.create({ url: record.url, active: !middle });

    if (settings.value?.deleteOnRestore) {
      await deleteRecord(record.id);
      await load();
    }

    if (!middle) window.close();
  } catch {
    /* keep record when Chrome rejects navigation */
  }
}

onMounted(load);
</script>
