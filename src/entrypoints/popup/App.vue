<template>
  <div class="popup">
    <header>
      <input v-model="query" :placeholder="t('search')" autofocus /><button
        :title="t('settings')"
        @click="browser.runtime.openOptionsPage()"
      >
        ⚙
      </button>
    </header>
    <main v-if="visible.length">
      <ClosedTabItem
        v-for="record in visible"
        :key="record.id"
        :record="record"
        :relative-time="dayjs(record.closedAt).fromNow()"
        @open="open"
      />
    </main>
    <p v-else class="empty">{{ t('empty') }}</p>
    <footer v-if="pageCount > 1">
      <button :disabled="page === 1" @click="page--">‹</button
      ><button v-for="n in pageCount" :key="n" :class="{ active: n === page }" @click="page = n">
        {{ n }}</button
      ><button :disabled="page === pageCount" @click="page++">›</button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import ClosedTabItem from '@/components/ClosedTabItem.vue';
import { deleteRecord, listRecords } from '@/db/records';
import { getSettings } from '@/db/settings';
import type { Settings, TabRecord } from '@/db/types';

dayjs.extend(relativeTime);
const { t } = useI18n();
const records = ref<TabRecord[]>([]);
const query = ref('');
const page = ref(1);
const settings = ref<Settings>();
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return q
    ? records.value.filter(r => `${r.title}\n${r.url}`.toLowerCase().includes(q))
    : records.value;
});
const pageCount = computed(() =>
  Math.max(1, Math.ceil(filtered.value.length / (settings.value?.pageSize || 10))),
);
const visible = computed(() =>
  filtered.value.slice(
    (page.value - 1) * (settings.value?.pageSize || 10),
    page.value * (settings.value?.pageSize || 10),
  ),
);
watch([query, () => settings.value?.pageSize], () => {
  page.value = 1;
});
watch(pageCount, value => {
  if (page.value > value) page.value = value;
});
async function load() {
  settings.value = await getSettings();
  document.body.style.setProperty('--popup-width', `${settings.value.popupWidth}px`);
  records.value = await listRecords();
}
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
