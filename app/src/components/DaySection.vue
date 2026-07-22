<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import RoadMap from './RoadMap.vue'
import ExtLink from './ExtLink.vue'
import StepCard from './StepCard.vue'
import {
  applyOptionalSelection,
  buildDaySteps,
  defaultOptionalSelection,
  insertMealInterlines,
  insertSunInterlines,
  routingWaypoints,
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
/** JSON keeps overnight.type `scenic`; UI label is `wild`. */
const overnightTypeLabel = computed(() => {
  const t = displayOvernight.value?.type
  return t === 'scenic' ? 'wild' : t
})
const routeWaypoints = computed(() =>
  routingWaypoints(activeDay.value || props.day.rawDay, selectedOpts.value),
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

const mapWaypoints = computed(() => waypointsForMap(routeWaypoints.value))

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
      routeWaypoints.value,
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
    routeWaypoints.value,
  )
  downloadText(`day-${String(props.day.number).padStart(2, '0')}.gpx`, gpx)
}

onMounted(loadRoutes)
watch(
  () => [
    props.day.number,
    displayTitle.value,
    JSON.stringify(routeWaypoints.value),
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
          {{ overnightTypeLabel }} ·
          <ExtLink
            :href="displayOvernight.url"
            :label="displayOvernight.name"
          />
        </span>
      </div>

      <div v-if="scenarioChoices.length" class="scenario-picker">
        <h4 class="scenario-picker__title">What if…</h4>
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

    <div class="steps-list">
      <StepCard
        v-for="(step, i) in visibleSteps"
        :key="step.optId || step.sun || step.meal || i"
        :step="step"
        :ferry-scenarios="ferryScenarios"
        :is-scenario-selected="isScenarioSelected"
        @toggle-optional="toggleOptional"
        @toggle-scenario="(id) => emit('toggle-scenario', id)"
      />
    </div>
  </section>
</template>
