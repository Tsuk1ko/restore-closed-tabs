<template>
  <UAvatar
    class="size-8 shrink-0 rounded-none"
    :class="{
      'bg-transparent': src,
      'rounded-lg': !src,
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
