<template>
  <UApp>
    <main class="options">
      <h1>{{ t('settings') }}</h1>
      <label
        >{{ t('locale')
        }}<select v-model="form.locale">
          <option value="browser">{{ t('localeBrowser') }}</option>
          <option value="zh-CN">{{ t('localeZh') }}</option>
          <option value="en">{{ t('localeEn') }}</option>
        </select></label
      >
      <label
        >{{ t('maxRecords')
        }}<input v-model.number="form.maxRecords" type="number" min="1" max="10000"
      /></label>
      <label
        >{{ t('pageSize') }}<input v-model.number="form.pageSize" type="number" min="1" max="100"
      /></label>
      <label
        >{{ t('popupWidth')
        }}<input v-model.number="form.popupWidth" type="number" min="280" max="800"
      /></label>
      <label
        v-for="key in [
          'deleteOnRestore',
          'deduplicateUrlOnClose',
          'recordIncognito',
          'recordChromeUrls',
          'recordExtensionUrls',
        ]"
        :key="key"
        class="check"
        ><input v-model="form[key]" type="checkbox" />{{ t(key) }}</label
      >
      <button class="primary" @click="save">{{ t('save') }}</button
      ><span class="notice">{{ notice }}</span>
      <h2>{{ t('data') }}</h2>
      <button @click="download">{{ t('export') }}</button
      ><label class="file"
        >{{ t('import') }}<input type="file" accept="application/json" @change="readFile" /></label
      ><button @click="confirming = true">{{ t('clear') }}</button>
      <div v-if="confirming" class="confirm">
        <p>{{ t('clearConfirm') }}</p>
        <button @click="clear">{{ t('clear') }}</button
        ><button @click="confirming = false">✕</button>
      </div>
    </main>
  </UApp>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { exportRecords, importRecords } from '@/db/import-export';
import { clearRecords } from '@/db/records';
import { getSettings, saveSettings } from '@/db/settings';
import type { Settings } from '@/db/types';

const { t } = useI18n();
const confirming = ref(false);
const form = reactive<Settings>({
  id: 'current',
  locale: 'browser',
  maxRecords: 1000,
  pageSize: 10,
  popupWidth: 400,
  deleteOnRestore: false,
  deduplicateUrlOnClose: false,
  recordIncognito: false,
  recordChromeUrls: false,
  recordExtensionUrls: false,
});
const notice = ref('');
onMounted(async () => Object.assign(form, await getSettings()));
async function save() {
  Object.assign(form, await saveSettings(form));
  notice.value = t('saved');
}
async function download() {
  const data = await exportRecords();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  a.download = `closed-tabs-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
async function readFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const count = await importRecords(JSON.parse(await file.text()));
    notice.value = t('importSuccess', { count });
  } catch {
    notice.value = t('invalidImport');
  }
  (event.target as HTMLInputElement).value = '';
}
async function clear() {
  await clearRecords();
  confirming.value = false;
}
</script>
