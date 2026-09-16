<template>
  <div
    class="tab-item"
    @click="$emit('open', record, false)"
    @auxclick="event => event.button === 1 && ($emit('open', record, true), event.preventDefault())"
  >
    <AppIcon :src="record.faviconUrl" :alt="record.title" />
    <div class="tab-copy">
      <strong :title="record.title">{{ record.title }}</strong
      ><span :title="new Date(record.closedAt).toLocaleString()">{{ record.url }}</span>
    </div>
    <UTooltip :text="new Date(record.closedAt).toLocaleString()"
      ><time>{{ $attrs.relativeTime }}</time></UTooltip
    >
  </div>
</template>

<script setup lang="ts">
import type { TabRecord } from '@/db/types';
import AppIcon from './AppIcon.vue';

defineProps<{ record: TabRecord }>();
defineEmits<{ open: [record: TabRecord, middle: boolean] }>();
</script>
