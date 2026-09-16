<template>
  <img
    v-if="src"
    :src="src"
    :alt="alt || ''"
    @error="($event.target as HTMLImageElement).style.display = 'none'"
  /><span v-else class="fallback-icon">🌐</span>
</template>

<script setup lang="ts">
defineProps<{ src?: string; alt?: string }>();
</script>
