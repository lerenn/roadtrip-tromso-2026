<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import RoadMap from './RoadMap.vue'
import { buildDayRoutes, waypointsForMap } from '../lib/osrm'
import { downloadText, trackToGpx } from '../lib/gpx'

const props = defineProps({
  day: { type: Object, required: true },
  showOptional: { type: Boolean, default: true },
  mustOnly: { type: Boolean, default: false },
})

const driveTracks = ref([])
const ferryTracks = ref([])
const loading = ref(true)
const error = ref('')

const visibleSteps = computed(() => {
  let steps = props.day.steps || []
  if (props.mustOnly) steps = steps.filter((s) => s.must)
  else if (!props.showOptional) {
    steps = steps.filter((s) => !s.activity?.startsWith('Optional'))
  }
  return steps
})

const mapWaypoints = computed(() => waypointsForMap(props.day.waypoints))

async function loadRoutes() {
  loading.value = true
  error.value = ''
  try {
    const { driveTracks: d, ferryTracks: f } = await buildDayRoutes(props.day.waypoints || [])
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
    `Day ${props.day.number} — ${props.day.title}`,
    driveTracks.value,
    ferryTracks.value,
    props.day.waypoints,
  )
  downloadText(`day-${String(props.day.number).padStart(2, '0')}.gpx`, gpx)
}

onMounted(loadRoutes)
watch(() => props.day.number, loadRoutes)
</script>

<template>
  <section class="day" :id="`day-${String(day.number).padStart(2, '0')}`">
    <header class="day-header">
      <div class="day-kicker">
        <span class="day-num">Day {{ day.number }}</span>
        <span class="day-date">{{ day.weekday }} {{ day.dateLabel }}</span>
      </div>
      <h3>{{ day.title }}</h3>
      <div class="day-stats">
        <span class="pill">~{{ day.driveKm }} km · {{ day.driveH }} h drive</span>
        <span
          v-if="day.overnight"
          class="pill"
          :class="day.overnight.type"
        >
          {{ day.overnight.type }} · {{ day.overnight.name }}
        </span>
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
        <span>Day {{ day.number }} route · live MapLibre</span>
        <button type="button" class="linkish" :disabled="loading" @click="downloadGpx">
          Download GPX
        </button>
      </div>
    </div>

    <div class="table-wrap">
      <table class="steps">
        <thead>
          <tr>
            <th>Start</th>
            <th>Duration</th>
            <th>Step</th>
            <th class="col-notes">Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(step, i) in visibleSteps" :key="i" :class="step.rowClass">
            <td class="time">{{ step.start || '—' }}</td>
            <td class="time">{{ step.duration || '—' }}</td>
            <td>
              <div class="activity">
                {{ step.activity }}
                <span v-if="step.activity?.startsWith('Optional')" class="badge opt">optional</span>
                <span v-else-if="step.must" class="badge must">must</span>
                <span v-if="step.place" class="place">{{ step.place }}</span>
              </div>
            </td>
            <td class="notes col-notes">{{ step.notes }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
