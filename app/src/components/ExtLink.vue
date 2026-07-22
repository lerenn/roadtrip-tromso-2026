<script setup>
defineProps({
  href: { type: String, default: '' },
  label: { type: String, required: true },
})

function isHttp(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim())
}
</script>

<template>
  <a
    v-if="isHttp(href)"
    class="ext-link"
    :href="href.trim()"
    target="_blank"
    rel="noopener noreferrer"
    >{{ label }}</a
  >
  <template v-else>{{ label }}</template>
</template>
