<template>
  <UApp :locale="uiLocale">
    <main class="mx-auto grid max-w-160 gap-5 px-5 py-8">
      <h1 class="text-2xl font-semibold">{{ t('settings') }}</h1>
      <UForm :state="form" :validate="validate" :disabled="loading" class="grid gap-4">
        <UFormField name="locale" :label="t('locale')">
          <USelect
            v-model="form.locale"
            :items="localeItems"
            class="w-full"
            @update:model-value="save('locale')"
          />
        </UFormField>
        <UFormField
          v-for="field in numberFields"
          :key="field.name"
          :name="field.name"
          :label="`${t(field.name)} (${field.min}~${field.max})`"
        >
          <UInputNumber
            v-model="form[field.name]"
            :aria-valuemin="field.min"
            :aria-valuemax="field.max"
            :step="1"
            :step-snapping="false"
            :format-options="{ useGrouping: false, maximumFractionDigits: 10 }"
            :locale="locale"
            class="w-full"
            @update:model-value="save(field.name)"
          />
        </UFormField>
        <UCheckbox
          v-for="key in booleanFields"
          :key="key"
          v-model="form[key]"
          :name="key"
          :label="t(key)"
          @update:model-value="save(key)"
        />
      </UForm>

      <section class="grid gap-4" aria-labelledby="data-heading">
        <h2 id="data-heading" class="text-xl font-semibold">{{ t('data') }}</h2>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            :label="t('export')"
            icon="i-lucide-upload"
            :ui="{ leadingIcon: 'size-4' }"
            color="neutral"
            variant="outline"
            loading-auto
            @click="download"
          />
          <UFileUpload
            :model-value="null"
            variant="button"
            accept="application/json,.json"
            :aria-label="t('import')"
            :preview="false"
            :dropzone="false"
            :disabled="importing"
            reset
            @update:model-value="readFile"
          >
            <template #default="{ open }">
              <UButton
                :label="t('import')"
                icon="i-lucide-download"
                :ui="{ leadingIcon: 'size-4' }"
                color="neutral"
                variant="outline"
                @click="open()"
              />
            </template>
          </UFileUpload>
          <UButton :label="t('clear')" color="error" variant="soft" @click="confirming = true" />
        </div>
      </section>
      <UModal
        v-model:open="confirming"
        :title="t('clear')"
        :description="t('clearConfirm')"
        :dismissible="!clearing"
        :close="!clearing"
        :ui="{ content: 'divide-y-0' }"
      >
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton
              :label="t('cancel')"
              color="neutral"
              variant="outline"
              :disabled="clearing"
              @click="confirming = false"
            />
            <UButton :label="t('clear')" color="error" :loading="clearing" @click="clear" />
          </div>
        </template>
      </UModal>
    </main>
  </UApp>
</template>

<script setup lang="ts">
import type { FormError } from '@nuxt/ui';
import { useToast } from '@nuxt/ui/composables';
import { en, zh_cn } from '@nuxt/ui/locale';
import dayjs from 'dayjs';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { defaultSettings } from '@/db/database';
import { exportRecords, importRecords } from '@/db/import-export';
import { clearRecords } from '@/db/records';
import { getSettings, saveSettings } from '@/db/settings';
import type { Settings } from '@/db/types';
import { resolveLocale } from '@/i18n';

const { t, locale } = useI18n();
const toast = useToast();
const uiLocale = computed(() => (locale.value === 'zh-CN' ? zh_cn : en));
const localeItems = computed(() => [
  { label: t('localeBrowser'), value: 'browser' },
  { label: t('localeZh'), value: 'zh-CN' },
  { label: t('localeEn'), value: 'en' },
]);
const numberFields = [
  { name: 'maxRecords', min: 100, max: 10000 },
  { name: 'pageSize', min: 5, max: 100 },
  { name: 'popupWidth', min: 280, max: 800 },
] as const;
const booleanFields = [
  'deleteOnRestore',
  'deduplicateUrlOnClose',
  'recordIncognito',
  'recordChromeUrls',
  'recordExtensionUrls',
] as const;

// 数字控件清空时可返回 null 或 undefined，仅草稿允许空值
// 不传 min/max，避免控件在失焦时截断越界值，交由表单明确报错
type NumberField = (typeof numberFields)[number]['name'];
const form = reactive<Omit<Settings, NumberField> & Record<NumberField, number | null | undefined>>(
  {
    ...defaultSettings,
  },
);
const loading = ref(true);
const confirming = ref(false);
const clearing = ref(false);
const importing = ref(false);
let saveQueue = Promise.resolve();

// 复用字段范围检查空值、非整数及越界输入，不引入额外校验依赖
function validate(): FormError[] {
  return numberFields.flatMap(({ name, min, max }) => {
    const value = form[name];
    return value == null || !Number.isInteger(value) || value < min || value > max
      ? [{ name, message: t('integerRange', { min, max }) }]
      : [];
  });
}

// 载入保存的设置，加载完成前禁止提交默认值
async function load() {
  try {
    Object.assign(form, await getSettings());
    loading.value = false;
  } catch {
    toast.add({ title: t('operationFailed'), color: 'error', duration: 2000 });
  }
}

// 仅保存当前有效字段，其他输入框的无效草稿不会阻止此项保存
function save(key: keyof Settings) {
  const value = form[key];
  if (loading.value || value == null || validate().some(error => error.name === key)) return;

  // 串行写入避免快速连续调整时覆盖较新的设置，不将旧保存结果写回表单
  saveQueue = saveQueue.then(async () => {
    try {
      const saved = await saveSettings({ [key]: value });
      if (key === 'locale') locale.value = resolveLocale(saved.locale);
      // 固定 ID 使连续保存合并为同一条 Toast，不挤占页面布局
      toast.add({ id: 'settings-saved', title: t('saved'), color: 'success', duration: 0 });
      await nextTick();
      toast.update('settings-saved', { duration: 2000 });
    } catch {
      toast.add({ title: t('operationFailed'), color: 'error', duration: 2000 });
    }
  });
}

// 导出现有 JSON 格式，通过临时下载链接保存并释放对象 URL
async function download() {
  try {
    const data = await exportRecords();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    );
    a.download = `closed-tabs-history-export-${dayjs().format('YYYYMMDDHHmmss')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    toast.add({ title: t('operationFailed'), color: 'error', duration: 2000 });
  }
}

// 直接接收文件组件的 File，复用导入校验，reset 允许再次选择同一个文件
async function readFile(file: File | null | undefined) {
  if (!file || importing.value) return;
  importing.value = true;
  try {
    const count = await importRecords(JSON.parse(await file.text()));
    toast.add({ title: t('importSuccess', { count }), color: 'success', duration: 2000 });
  } catch {
    toast.add({ title: t('invalidImport'), color: 'error', duration: 2000 });
  } finally {
    importing.value = false;
  }
}

// 仅在用户确认后清空记录，失败时保留弹窗并显示错误
async function clear() {
  clearing.value = true;
  try {
    await clearRecords();
    confirming.value = false;
    toast.add({ title: t('cleared'), color: 'success', duration: 2000 });
  } catch {
    toast.add({ title: t('operationFailed'), color: 'error', duration: 2000 });
  } finally {
    clearing.value = false;
  }
}

onMounted(load);
</script>
