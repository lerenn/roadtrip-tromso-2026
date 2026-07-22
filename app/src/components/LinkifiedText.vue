<script setup>
/**
 * Render plain text with http(s) URLs as new-tab links.
 */
defineProps({
  text: { type: String, default: '' },
})

function parts(text) {
  const raw = String(text || '')
  if (!raw) return []
  const re = /(https?:\/\/[^\s]+)/gi
  const out = []
  let last = 0
  let m
  while ((m = re.exec(raw))) {
    if (m.index > last) out.push({ t: 'text', v: raw.slice(last, m.index) })
    let url = m[1]
    // Trim trailing punctuation commonly stuck to URLs in notes
    url = url.replace(/[),.;:]+$/g, '')
    out.push({ t: 'link', v: url })
    last = m.index + m[0].length
    if (url.length < m[0].length) {
      out.push({ t: 'text', v: m[0].slice(url.length) })
    }
  }
  if (last < raw.length) out.push({ t: 'text', v: raw.slice(last) })
  return out
}
</script>

<template>
  <template v-for="(p, i) in parts(text)" :key="i">
    <a
      v-if="p.t === 'link'"
      class="ext-link"
      :href="p.v"
      target="_blank"
      rel="noopener noreferrer"
      >{{ p.v }}</a
    >
    <template v-else>{{ p.v }}</template>
  </template>
</template>
