<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import RoadMap from './RoadMap.vue'
import {
  applyOptionalSelection,
  buildDaySteps,
  defaultOptionalSelection,
  fmtDuration,
  insertMealInterlines,
  insertSunInterlines,
} from '../lib/chronology'
import {
  ferryScenariosForDay,
  materializeDayWithSelection,
  scenarioChoicesForDay,
} from '../lib/scenarios'
import { buildDayRoutes, waypointsForMap } from '../lib/osrm'
import { downloadText, trackToGpx } from '../lib/gpx'

const props = defineProps({
  day: { type: Object, required: true },
  itinerary: { type: Object, required: true },
  /** Selected program-level scenario ids (shared across days). */
  selectedScenarios: { type: Object, default: () => new Set() },
  showOptional: { type: Boolean, default: true },
  mustOnly: { type: Boolean, default: false },
})

const emit = defineEmits(['toggle-scenario'])

const driveTracks = ref([])
const ferryTracks = ref([])
const loading = ref(true)
const error = ref('')
/** @type {import('vue').Ref<Set<string>>} */
const selectedOpts = ref(new Set())

const scenarioChoices = computed(() =>
  scenarioChoicesForDay(props.itinerary, props.day.number),
)

const ferryScenarios = computed(() =>
  ferryScenariosForDay(props.itinerary, props.day.number),
)

const whatIfCount = computed(
  () => scenarioChoices.value.length + ferryScenarios.value.length,
)

const activeMaterialized = computed(() =>
  materializeDayWithSelection(
    props.itinerary,
    props.day.number,
    props.selectedScenarios,
  ),
)

const activeDay = computed(
  () => activeMaterialized.value.day || props.day.rawDay,
)

const appliedScenarios = computed(() => activeMaterialized.value.applied || [])

const activeSteps = computed(() => buildDaySteps(activeDay.value))

const displayTitle = computed(() => activeDay.value?.title || props.day.title)
const displayDriveKm = computed(
  () => activeDay.value?.drive_km_approx ?? props.day.driveKm,
)
const displayDriveH = computed(
  () => activeDay.value?.drive_h_approx ?? props.day.driveH,
)
const displayOvernight = computed(
  () => activeDay.value?.overnight || props.day.overnight,
)
const displayWaypoints = computed(
  () => activeDay.value?.waypoints || props.day.waypoints || [],
)

function syncDefaultSelection() {
  selectedOpts.value = new Set(defaultOptionalSelection(activeSteps.value))
}

watch(
  () => [
    props.day.number,
    props.itinerary.id,
    [...(props.selectedScenarios || [])].sort().join(','),
  ],
  syncDefaultSelection,
  { immediate: true },
)

const timedSteps = computed(() =>
  applyOptionalSelection(activeSteps.value, selectedOpts.value),
)

const timelineSteps = computed(() =>
  insertSunInterlines(
    insertMealInterlines(timedSteps.value, activeDay.value),
    activeDay.value,
  ),
)

const visibleSteps = computed(() => {
  let steps = timelineSteps.value
  if (props.mustOnly) {
    steps = steps.filter((s) => s.must || s.interline)
  } else if (!props.showOptional) {
    steps = steps.filter(
      (s) =>
        s.interline ||
        s.protected ||
        s.activity?.startsWith('Protected') ||
        !s.activity?.startsWith('Optional'),
    )
  }
  return steps
})

const mapWaypoints = computed(() => waypointsForMap(displayWaypoints.value))

function isScenarioSelected(id) {
  return props.selectedScenarios?.has?.(id) || false
}

function toggleOptional(optId) {
  const next = new Set(selectedOpts.value)
  if (next.has(optId)) next.delete(optId)
  else next.add(optId)
  selectedOpts.value = next
}

async function loadRoutes() {
  loading.value = true
  error.value = ''
  try {
    const { driveTracks: d, ferryTracks: f } = await buildDayRoutes(
      displayWaypoints.value,
    )
    driveTracks.value = d
    ferryTracks.value = f
  } catch (e) {
    error.value = String(e.message || e)
  } finally {
    loading.value = false
  }
}

function downloadGpx() {
  const gpx = trackToGpx(
    `Day ${props.day.number} — ${displayTitle.value}`,
    driveTracks.value,
    ferryTracks.value,
    displayWaypoints.value,
  )
  downloadText(`day-${String(props.day.number).padStart(2, '0')}.gpx`, gpx)
}

onMounted(loadRoutes)
watch(
  () => [
    props.day.number,
    displayTitle.value,
    JSON.stringify(displayWaypoints.value),
  ],
  loadRoutes,
)
</script>

<template>
  <section
    class="day"
    :class="{ 'day--contingency': appliedScenarios.length }"
    :id="`day-${String(day.number).padStart(2, '0')}`"
  >
    <header class="day-header">
      <div class="day-kicker">
        <span class="day-num">Day {{ day.number }}</span>
        <span class="day-date">{{ day.weekday }} {{ day.dateLabel }}</span>
        <span v-if="whatIfCount" class="pill contingency">
          {{ whatIfCount }} what-if{{ whatIfCount > 1 ? 's' : '' }}
        </span>
        <span v-if="appliedScenarios.length" class="pill contingency active">
          Contingency on
        </span>
      </div>
      <h3>{{ displayTitle }}</h3>
      <div class="day-stats">
        <span class="pill">~{{ displayDriveKm }} km · {{ displayDriveH }} h drive</span>
        <span
          v-if="displayOvernight"
          class="pill"
          :class="displayOvernight.type"
        >
          {{ displayOvernight.type }} · {{ displayOvernight.name }}
        </span>
      </div>

      <div v-if="scenarioChoices.length" class="scenario-picker">
        <h4 class="scenario-picker__title">What if…</h4>
        <p class="scenario-picker__hint">
          Tick a contingency to swap this day’s roadbook (and linked later days).
          Several can be on at once.
        </p>
        <ul class="scenario-picker__list">
          <li
            v-for="choice in scenarioChoices"
            :key="choice.id"
            :class="{ on: isScenarioSelected(choice.id) }"
          >
            <label class="scenario-picker__item">
              <input
                type="checkbox"
                :checked="isScenarioSelected(choice.id)"
                :aria-label="choice.when"
                @change="emit('toggle-scenario', choice.id)"
              />
              <span class="scenario-picker__body">
                <span class="scenario-picker__when">{{ choice.when }}</span>
                <span class="scenario-picker__summary">
                  {{
                    choice.roles.includes('ripple') && !choice.roles.includes('anchor')
                      ? choice.banner
                      : choice.summary
                  }}
                </span>
                <span
                  v-if="choice.roles.includes('ripple') && !choice.roles.includes('anchor')"
                  class="scenario-picker__from"
                >
                  From Day {{ choice.anchor_day }}
                </span>
                <span
                  v-else-if="choice.rippleDays?.length"
                  class="scenario-picker__from"
                >
                  Also reshapes
                  <template v-for="(rd, ri) in choice.rippleDays" :key="rd">
                    <a :href="`#day-${String(rd).padStart(2, '0')}`"
                      >Day {{ rd }}</a
                    ><template v-if="ri < choice.rippleDays.length - 1">, </template>
                  </template>
                </span>
              </span>
            </label>
          </li>
        </ul>
      </div>

      <p class="day-hint">
        Tick optional / protected blocks to include them in the clock —
        later starts shift and show
        <span class="shift-mark" aria-hidden="true">*</span>
        (hover for which activities piled on).
      </p>
    </header>

    <div class="map-block">
      <p v-if="loading" class="map-status">Loading route…</p>
      <p v-else-if="error" class="map-status error">{{ error }}</p>
      <RoadMap
        v-show="!loading"
        :drive-tracks="driveTracks"
        :ferry-tracks="ferryTracks"
        :waypoints="mapWaypoints"
        height="380px"
      />
      <div class="day-map-caption">
        <span>
          Day {{ day.number }} route
          <template v-if="appliedScenarios.length"> · contingency</template>
        </span>
        <button type="button" class="linkish" :disabled="loading" @click="downloadGpx">
          Download GPX
        </button>
      </div>
    </div>

    <div class="table-wrap">
      <table class="steps">
        <thead>
          <tr>
            <th class="col-check" title="Include optional in the clock">Incl.</th>
            <th class="col-start">Start</th>
            <th class="col-duration">Duration</th>
            <th class="col-step">Step</th>
            <th class="col-notes">Notes</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(step, i) in visibleSteps" :key="step.optId || step.sun || step.meal || i">
            <tr v-if="step.interline" class="sun-row" :class="step.rowClass">
              <td class="col-check" aria-hidden="true"></td>
              <td class="time col-start">{{ step.start }}</td>
              <td class="time col-duration">{{ step.duration || '—' }}</td>
              <td class="col-step sun-row__rule" colspan="2">
                <span class="sun-interline">
                  <span class="sun-interline__label">{{ step.activity }}</span>
                  <span class="sun-interline__line" aria-hidden="true"></span>
                  <span v-if="step.place" class="sun-interline__place">{{
                    step.place
                  }}</span>
                </span>
              </td>
            </tr>
            <tr
              v-else
              :class="[
                step.rowClass,
                step.optId && step.included ? 'opt-included' : '',
                step.optId && !step.included ? 'opt-skipped' : '',
                step.ferry && ferryScenarios.some((fs) => isScenarioSelected(fs.id))
                  ? 'ferry-miss-on'
                  : '',
              ]"
            >
              <td class="col-check">
                <label v-if="step.optId" class="opt-toggle">
                  <input
                    type="checkbox"
                    :checked="step.included"
                    :aria-label="`Include ${step.optLabel || step.activity}`"
                    @change="toggleOptional(step.optId)"
                  />
                </label>
              </td>
              <td class="time col-start" :class="{ 'time--shifted': step.timeShifted }">
                <span
                  v-if="step.timeShifted"
                  class="time-shift"
                  tabindex="0"
                >
                  <span class="time-shift__value">{{ step.start || '—' }}</span>
                  <span class="shift-mark" aria-hidden="true">*</span>
                  <span class="time-shift__tip" role="tooltip">
                    <strong>+{{ fmtDuration(step.shiftH) }} from optionals / meals</strong>
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
              </td>
              <td class="time col-duration">{{ step.duration || '—' }}</td>
              <td class="col-step">
                <div class="activity">
                  {{ step.activity }}
                  <span
                    v-if="step.protected || step.activity?.startsWith('Protected')"
                    class="badge protected"
                  >protect</span>
                  <span
                    v-else-if="step.activity?.startsWith('Optional')"
                    class="badge opt"
                  >optional</span>
                  <span v-else-if="step.must" class="badge must">must</span>
                  <span v-if="step.place" class="place">{{ step.place }}</span>
                </div>
                <div
                  v-if="step.ferry && ferryScenarios.length"
                  class="ferry-miss"
                >
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
                      <span
                        v-if="fs.ripple?.length"
                        class="ferry-miss__ripple"
                      >
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
              </td>
              <td class="notes col-notes">
                <template v-if="step.notes">
                  <span class="notes-label">Notes</span>
                  {{ step.notes }}
                </template>
              </td>
            </tr>
            <tr v-if="!step.interline && step.fallback" class="fallback-row">
              <td colspan="5">
                <details class="fallback">
                  <summary>
                    If this fails
                    <span class="fallback__when">— {{ step.fallback.when }}</span>
                  </summary>
                  <ul class="fallback__list">
                    <li v-for="(alt, j) in step.fallback.then" :key="j">
                      <strong>{{ alt.activity }}</strong>
                      <span v-if="alt.duration_h"> · ~{{ alt.duration_h }} h</span>
                      <span v-if="alt.place" class="fallback__place"> · {{ alt.place }}</span>
                      <span v-if="alt.notes" class="fallback__notes"> — {{ alt.notes }}</span>
                    </li>
                  </ul>
                </details>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </section>
</template>
