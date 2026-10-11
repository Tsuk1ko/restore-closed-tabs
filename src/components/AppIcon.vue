<template>
  <UAvatar
    class="size-6 shrink-0 overflow-hidden rounded-lg"
    :class="{
      'bg-transparent': src,
    }"
    :src="src"
    alt="Site icon"
    :ui="{ image: 'object-contain rounded-none' }"
    icon="i-lucide-globe"
  />
</template>

<script setup lang="ts">
const { pageUrl } = defineProps<{ pageUrl: string }>();

// 按页面地址读取 Chrome 保存的图标，查询参数由 URL API 编码
const src = computed(() => {
  const url = new URL(browser.runtime.getURL('/_favicon/?'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', '64');
  return url.href;
});
</script>
