<template>
  <UAvatar
    class="size-6 shrink-0 overflow-hidden rounded-lg"
    :class="{
      'bg-transparent': src,
    }"
    :src="src"
    :alt="alt || ''"
    :ui="{ image: 'object-contain rounded-none' }"
    icon="i-lucide-globe"
  />
</template>

<script setup lang="ts">
defineProps<{ src?: string; alt?: string }>();
</script>
