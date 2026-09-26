<template>
  <UButton
    color="neutral"
    variant="ghost"
    class="w-full gap-2 rounded-none border-b border-default px-2 py-1.5 text-left font-normal"
    @click="$emit('open', record, false)"
    @auxclick.middle.prevent="$emit('open', record, true)"
  >
    <AppIcon :src="record.faviconUrl" :alt="record.title" />
    <span class="flex min-w-0 flex-1 flex-col">
      <strong class="truncate text-[13px] leading-4.5" :title="record.title">{{
        record.title
      }}</strong>
      <span class="truncate text-[11px] leading-3.5 text-muted" :title="record.url">{{
        record.url
      }}</span>
    </span>
    <UTooltip
      v-if="closedDate"
      :text="closedDate.toLocaleString()"
      :content="{ side: 'left' }"
      :delay-duration="300"
      disable-hoverable-content
    >
      <time
        :datetime="closedDate.toISOString()"
        class="shrink-0 whitespace-nowrap text-[11px] text-muted"
        >{{ relativeTime }}</time
      >
    </UTooltip>
  </UButton>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { TabRecord } from '@/db/types';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ record: TabRecord; relativeTime: string }>();
defineEmits<{ open: [record: TabRecord, middle: boolean] }>();

// 无效时间不生成 datetime，避免历史或导入数据导致 toISOString 抛出异常
const closedDate = computed(() => {
  const date = new Date(props.record.closedAt);
  return Number.isNaN(date.getTime()) ? undefined : date;
});
</script>
