<template>
  <UAvatar
    class="size-8 shrink-0 rounded-lg overflow-hidden"
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
