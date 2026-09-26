<template>
  <UApp :locale="uiLocale">
    <main class="mx-auto grid max-w-160 gap-5 px-5 py-8">
      <h1 class="text-2xl font-semibold">{{ t('settings') }}</h1>
      <UForm
        :state="form"
        :validate="validate"
        :disabled="loading"
        class="grid gap-4"
        @submit="save"
      >
        <UFormField name="locale" :label="t('locale')">
          <USelect v-model="form.locale" :items="localeItems" class="w-full" />
        </UFormField>
        <UFormField
          v-for="field in numberFields"
          :key="field.name"
          :name="field.name"
          :label="t(field.name)"
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
          />
        </UFormField>
        <UCheckbox
          v-for="key in booleanFields"
          :key="key"
          v-model="form[key]"
          :name="key"
          :label="t(key)"
        />
        <UButton type="submit" :label="t('save')" loading-auto class="justify-self-start" />
      </UForm>

      <UAlert v-if="notice" :title="notice" :color="noticeColor" variant="soft" role="status" />

      <section class="grid gap-4" aria-labelledby="data-heading">
        <h2 id="data-heading" class="text-xl font-semibold">{{ t('data') }}</h2>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            :label="t('export')"
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
                icon="i-lucide-upload"
                color="neutral"
                variant="outline"
                :loading="importing"
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
import { en, zh_cn } from '@nuxt/ui/locale';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { defaultSettings } from '@/db/database';
import { exportRecords, importRecords } from '@/db/import-export';
import { clearRecords } from '@/db/records';
import { getSettings, saveSettings } from '@/db/settings';
import type { Settings } from '@/db/types';
import { resolveLocale } from '@/i18n';

const { t, locale } = useI18n();
const uiLocale = computed(() => (locale.value === 'zh-CN' ? zh_cn : en));
const localeItems = computed(() => [
  { label: t('localeBrowser'), value: 'browser' },
  { label: t('localeZh'), value: 'zh-CN' },
  { label: t('localeEn'), value: 'en' },
]);
const numberFields = [
  { name: 'maxRecords', min: 1, max: 10000 },
  { name: 'pageSize', min: 1, max: 100 },
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
const notice = ref('');
const noticeColor = ref<'success' | 'error'>('success');

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
    noticeColor.value = 'error';
    notice.value = t('operationFailed');
  }
}

// 保存已校验的设置，并同步页面及 Nuxt UI 的语言
async function save() {
  if (
    validate().length ||
    form.maxRecords == null ||
    form.pageSize == null ||
    form.popupWidth == null
  )
    return;
  try {
    const saved = await saveSettings({
      ...form,
      maxRecords: form.maxRecords,
      pageSize: form.pageSize,
      popupWidth: form.popupWidth,
    });
    Object.assign(form, saved);
    locale.value = resolveLocale(saved.locale);
    noticeColor.value = 'success';
    notice.value = t('saved');
  } catch {
    noticeColor.value = 'error';
    notice.value = t('operationFailed');
  }
}

// 导出现有 JSON 格式，通过临时下载链接保存并释放对象 URL
async function download() {
  try {
    const data = await exportRecords();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    );
    a.download = `closed-tabs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    noticeColor.value = 'error';
    notice.value = t('operationFailed');
  }
}

// 直接接收文件组件的 File，复用导入校验，reset 允许再次选择同一个文件
async function readFile(file: File | null | undefined) {
  if (!file || importing.value) return;
  importing.value = true;
  try {
    const count = await importRecords(JSON.parse(await file.text()));
    noticeColor.value = 'success';
    notice.value = t('importSuccess', { count });
  } catch {
    noticeColor.value = 'error';
    notice.value = t('invalidImport');
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
    noticeColor.value = 'success';
    notice.value = t('cleared');
  } catch {
    noticeColor.value = 'error';
    notice.value = t('operationFailed');
  } finally {
    clearing.value = false;
  }
}

onMounted(load);
</script>
