<script setup>
import { computed, ref } from 'vue'
import ExtLink from './ExtLink.vue'
import LinkifiedText from './LinkifiedText.vue'
import { fmtDuration } from '../lib/chronology'
import { imageForStep } from '../lib/places'

const props = defineProps({
  step: { type: Object, required: true },
  ferryScenarios: { type: Array, default: () => [] },
  isScenarioSelected: { type: Function, default: () => false },
})

const emit = defineEmits(['toggle-optional', 'toggle-scenario'])

const open = ref(false)
const photo = computed(() => imageForStep(props.step))

const title = computed(() => {
  const a = props.step.activity || ''
  return a
    .replace(/^Optional — /, '')
    .replace(/^Protected — /, '')
    .replace(/^Stop — /, '')
    .replace(/^Stop - /, '')
})

const kindLabel = computed(() => {
  if (props.step.protected || props.step.activity?.startsWith('Protected')) return 'protect'
  if (props.step.activity?.startsWith('Optional')) return 'optional'
  if (props.step.overnight) return 'sleep'
  if (props.step.ferry) return 'ferry'
  if (
    props.step.wpKind === 'viewpoint' ||
    props.step.activity?.startsWith('Stop —') ||
    props.step.activity?.startsWith('Stop -')
  ) {
    return 'stop'
  }
  if (props.step.must) return 'must'
  return ''
})

const badgeClass = computed(() => {
  const k = kindLabel.value
  if (k === 'protect') return 'protected'
  if (k === 'optional') return 'opt'
  if (k === 'sleep') return 'sleep'
  if (k === 'stop') return 'stop'
  if (k === 'ferry') return 'must'
  return 'must'
})

const mapsUrl = computed(() => {
  if (props.step.maps) return props.step.maps
  const { lat, lon } = props.step
  if (lat == null || lon == null) return null
  const q = `${Number(lat)},${Number(lon)}`
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}`
})

const hasDetails = computed(() => {
  const s = props.step
  return Boolean(
    s.notes ||
      s.place ||
      s.url ||
      s.fallback ||
      photo.value ||
      mapsUrl.value ||
      (s.ferry && props.ferryScenarios.length) ||
      s.timeShifted,
  )
})
</script>

<template>
  <div v-if="step.interline" class="sun-row" :class="step.rowClass">
    <span class="time col-start">{{ step.start }}</span>
    <span class="time col-duration">{{ step.duration || '—' }}</span>
    <span class="sun-interline">
      <span class="sun-interline__label">{{ step.activity }}</span>
      <span class="sun-interline__line" aria-hidden="true"></span>
      <span v-if="step.place" class="sun-interline__place">{{ step.place }}</span>
    </span>
  </div>

  <details
    v-else
    class="step-card"
    :class="[
      step.rowClass,
      step.optId && step.included ? 'opt-included' : '',
      step.optId && !step.included ? 'opt-skipped' : '',
      open ? 'is-open' : '',
    ]"
    @toggle="open = $event.target.open"
  >
    <summary class="step-card__summary">
      <label v-if="step.optId" class="opt-toggle" @click.stop>
        <input
          type="checkbox"
          :checked="step.included"
          :aria-label="`Include ${step.optLabel || step.activity}`"
          @change="emit('toggle-optional', step.optId)"
        />
      </label>
      <span v-else class="opt-toggle opt-toggle--spacer" aria-hidden="true"></span>

      <span class="time col-start" :class="{ 'time--shifted': step.timeShifted }">
        <span v-if="step.timeShifted" class="time-shift" tabindex="0" @click.stop>
          <span class="time-shift__value">{{ step.start || '—' }}</span>
          <span class="shift-mark" aria-hidden="true">*</span>
          <span class="time-shift__tip" role="tooltip">
            <strong>+{{ fmtDuration(step.shiftH) }} from optionals</strong>
            <ul>
              <li v-for="(src, si) in step.shiftSources" :key="src.optId || si">
                <span class="time-shift__dur">+{{ src.duration }}</span>
                {{ src.activity }}
              </li>
            </ul>
            <span v-if="step.baseStart" class="time-shift__base">
              Was {{ step.baseStart }}
            </span>
          </span>
        </span>
        <template v-else>{{ step.start || '—' }}</template>
      </span>

      <span class="time col-duration">{{ step.duration || '—' }}</span>

      <span class="step-card__title">
        <span class="step-card__name">{{ title }}</span>
        <span v-if="kindLabel" class="badge" :class="badgeClass">{{
          kindLabel === 'protect' ? 'protect' : kindLabel
        }}</span>
        <span v-if="step.reserve" class="badge reserve">reserve</span>
      </span>

      <span class="step-card__chev" aria-hidden="true"></span>
    </summary>

    <div v-if="hasDetails" class="step-card__body">
      <figure v-if="photo" class="step-card__photo">
        <a
          :href="photo.page || photo.src"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            :src="photo.src"
            :alt="photo.alt"
            loading="lazy"
            referrerpolicy="no-referrer"
          />
        </a>
        <figcaption>
          {{ photo.alt }}
          <template v-if="photo.credit"> · {{ photo.credit }}</template>
          <template v-if="photo.page">
            ·
            <a :href="photo.page" target="_blank" rel="noopener noreferrer"
              >source</a
            >
          </template>
        </figcaption>
      </figure>

      <div class="step-card__meta">
        <p v-if="step.place" class="step-card__place">
          <strong>Where</strong> {{ step.place }}
        </p>
        <p v-if="step.url" class="step-card__link">
          <strong>Link</strong>
          <ExtLink :href="step.url" label="Open website" />
        </p>
        <p v-if="step.notes" class="step-card__notes">
          <strong>Notes</strong>
          <LinkifiedText :text="step.notes" />
        </p>

        <div v-if="step.ferry && ferryScenarios.length" class="ferry-miss">
          <label
            v-for="fs in ferryScenarios"
            :key="fs.id"
            class="ferry-miss__item"
            :class="{ on: isScenarioSelected(fs.id) }"
          >
            <input
              type="checkbox"
              :checked="isScenarioSelected(fs.id)"
              @change="emit('toggle-scenario', fs.id)"
            />
            <span class="ferry-miss__text">
              <span class="ferry-miss__label">If missed</span>
              <span class="ferry-miss__when">{{ fs.when }}</span>
              <span class="ferry-miss__summary">{{ fs.summary }}</span>
              <span v-if="fs.ripple?.length" class="ferry-miss__ripple">
                Also reshapes
                <template v-for="(r, ri) in fs.ripple" :key="r.day">
                  <a :href="`#day-${String(r.day).padStart(2, '0')}`"
                    >Day {{ r.day }}</a
                  ><template v-if="ri < fs.ripple.length - 1">, </template>
                </template>
              </span>
            </span>
          </label>
        </div>

        <details v-if="step.fallback" class="fallback">
          <summary>
            If this fails
            <span class="fallback__when">— {{ step.fallback.when }}</span>
          </summary>
          <ul class="fallback__list">
            <li v-for="(alt, j) in step.fallback.then" :key="j">
              <ExtLink :href="alt.url" :label="alt.activity" />
              <span v-if="alt.duration_h"> · ~{{ alt.duration_h }} h</span>
              <span v-if="alt.place" class="fallback__place"> · {{ alt.place }}</span>
              <span v-if="alt.notes" class="fallback__notes">
                — <LinkifiedText :text="alt.notes" />
              </span>
            </li>
          </ul>
        </details>
      </div>

      <p v-if="mapsUrl" class="step-card__maps">
        <a
          :href="mapsUrl"
          target="_blank"
          rel="noopener noreferrer"
          @click.stop
        >
          Open in Google Maps
        </a>
      </p>
    </div>
  </details>
</template>
