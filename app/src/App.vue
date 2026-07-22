<script setup>
import { computed, ref, watch } from 'vue'
import DaySection from './components/DaySection.vue'
import RoadMap from './components/RoadMap.vue'
import { buildOptionChronology } from './lib/chronology'
import { buildOverviewRoutes, waypointsForMap } from './lib/osrm'
import { downloadText, trackToGpx } from './lib/gpx'

import depot from '@trip/shared/depot.json'
import itineraryA from '@trip/option-a-senja-vesteralen/itinerary.json'
import itineraryB from '@trip/option-b-senja-lyngen/itinerary.json'

const options = {
  A: itineraryA,
  B: itineraryB,
}

const optionId = ref('A')
const showOptional = ref(true)
const mustOnly = ref(false)

const itinerary = computed(() => options[optionId.value])
const days = computed(() => buildOptionChronology(itinerary.value))

const optionStats = computed(() => {
  const daysRaw = itinerary.value.days || []
  let km = 0
  let driveH = 0
  let ferryCrossings = 0
  let overnightNights = 0
  let scenic = 0
  let campsite = 0

  for (const day of daysRaw) {
    km += Number(day.drive_km_approx || 0)
    driveH += Number(day.drive_h_approx || 0)
    if (day.overnight) {
      overnightNights += 1
      if (day.overnight.type === 'campsite') campsite += 1
      else scenic += 1
    }
    const wps = day.waypoints || []
    for (let i = 0; i < wps.length - 1; i++) {
      if (wps[i].kind === 'ferry' && wps[i + 1].kind === 'ferry') ferryCrossings += 1
    }
  }

  const ns = itinerary.value.nights_summary || {}
  if (ns.scenic != null) scenic = ns.scenic
  if (ns.campsite != null) campsite = ns.campsite

  return {
    km: Math.round(km),
    driveH: Math.round(driveH * 10) / 10,
    days: daysRaw.length,
    nights: overnightNights || scenic + campsite,
    scenic,
    campsite,
    ferryCrossings,
    avgKmPerDay: daysRaw.length ? Math.round(km / daysRaw.length) : 0,
  }
})

const overviewDrive = ref([])
const overviewFerry = ref([])
const overviewLoading = ref(true)

const overviewWaypoints = computed(() => {
  const wps = []
  for (const day of days.value) {
    for (const wp of day.waypoints || []) wps.push(wp)
  }
  return waypointsForMap(wps)
})

const pickupLabel = computed(() =>
  new Date(depot.pickup).toLocaleString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }),
)
const returnLabel = computed(() =>
  new Date(depot.return).toLocaleString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }),
)

async function loadOverview() {
  overviewLoading.value = true
  try {
    const { driveTracks, ferryTracks } = await buildOverviewRoutes(
      itinerary.value.days.map((d) => ({ waypoints: d.waypoints })),
    )
    overviewDrive.value = driveTracks
    overviewFerry.value = ferryTracks
  } finally {
    overviewLoading.value = false
  }
}

function downloadOverviewGpx() {
  const gpx = trackToGpx(
    `Option ${itinerary.value.id} overview`,
    overviewDrive.value,
    overviewFerry.value,
    overviewWaypoints.value,
  )
  downloadText(`option-${itinerary.value.id.toLowerCase()}-overview.gpx`, gpx)
}

watch(optionId, loadOverview, { immediate: true })
</script>

<template>
  <div class="app">
    <header class="cover">
      <div class="wrap">
        <p class="eyebrow">Tromsø campervan · 29 Aug – 5 Sep 2026</p>
        <h1>Option {{ itinerary.id }}: {{ itinerary.title }}</h1>
        <p class="tagline">{{ itinerary.tagline }}</p>

        <dl class="stats" aria-label="Option summary">
          <div class="stat">
            <dt>Distance</dt>
            <dd>~{{ optionStats.km }} km</dd>
          </div>
          <div class="stat">
            <dt>In the van</dt>
            <dd>~{{ optionStats.driveH }} h</dd>
          </div>
          <div class="stat">
            <dt>Days</dt>
            <dd>{{ optionStats.days }} · {{ optionStats.nights }} nights</dd>
          </div>
          <div class="stat">
            <dt>Overnights</dt>
            <dd>{{ optionStats.scenic }} scenic · {{ optionStats.campsite }} campsite</dd>
          </div>
          <div class="stat">
            <dt>Ferries</dt>
            <dd>{{ optionStats.ferryCrossings }} crossings</dd>
          </div>
          <div class="stat">
            <dt>Avg / day</dt>
            <dd>~{{ optionStats.avgKmPerDay }} km</dd>
          </div>
        </dl>

        <ul class="meta">
          <li><strong>Vehicle</strong> {{ depot.vehicle }}</li>
          <li><strong>Pickup</strong> {{ pickupLabel }}</li>
          <li><strong>Return</strong> {{ returnLabel }}</li>
          <li><strong>Booking</strong> {{ depot.booking_code }}</li>
        </ul>

        <div class="toolbar">
          <div class="seg" role="group" aria-label="Option">
            <button
              type="button"
              :class="{ active: optionId === 'A' }"
              @click="optionId = 'A'"
            >
              A · Senja + Vesterålen
            </button>
            <button
              type="button"
              :class="{ active: optionId === 'B' }"
              @click="optionId = 'B'"
            >
              B · Senja + Lyngen
            </button>
          </div>
          <label class="check">
            <input v-model="showOptional" type="checkbox" :disabled="mustOnly" />
            Show optionals
          </label>
          <label class="check">
            <input v-model="mustOnly" type="checkbox" />
            Must-only
          </label>
        </div>

        <div class="cover-actions">
          <a class="btn" href="#overview">Overview map</a>
          <a class="btn secondary" href="#day-01">Start Day 1</a>
        </div>
      </div>
    </header>

    <nav class="day-nav" aria-label="Days">
      <div class="wrap day-nav-inner">
        <a
          v-for="day in days"
          :key="day.number"
          :href="`#day-${String(day.number).padStart(2, '0')}`"
        >
          D{{ day.number }}
        </a>
      </div>
    </nav>

    <section class="section" id="overview">
      <div class="wrap">
        <div class="section-head">
          <h2>The loop</h2>
          <p>
            JSON is the trip. This app only presents it — times are derived live;
            maps are routed live (OSRM). Optional rows don’t shift must-do hours.
          </p>
        </div>
        <ul class="anchors">
          <li v-for="(a, i) in itinerary.anchors" :key="i">{{ a }}</li>
        </ul>

        <div class="map-block overview-map">
          <p v-if="overviewLoading" class="map-status">Loading overview routes…</p>
          <RoadMap
            v-show="!overviewLoading"
            :drive-tracks="overviewDrive"
            :ferry-tracks="overviewFerry"
            :waypoints="overviewWaypoints"
            height="520px"
          />
          <div class="day-map-caption">
            <span>Overview · Option {{ itinerary.id }}</span>
            <button
              type="button"
              class="linkish"
              :disabled="overviewLoading"
              @click="downloadOverviewGpx"
            >
              Download GPX
            </button>
          </div>
        </div>

        <ul class="legend">
          <li class="must">Must-do</li>
          <li class="opt">Optional</li>
          <li class="sleep">Overnight</li>
        </ul>
      </div>
    </section>

    <div class="wrap days">
      <DaySection
        v-for="day in days"
        :key="`${optionId}-${day.number}`"
        :day="day"
        :show-optional="showOptional"
        :must-only="mustOnly"
      />
    </div>

    <footer class="footer wrap">
      <p>
        <strong>Camper logistics</strong> — campsite nights for water/dump/showers;
        scenic nights only where legal (allemannsretten). Fuel when you see a station.
      </p>
      <p>
        Depot: {{ depot.name }} · {{ depot.address }} · {{ depot.vehicle }} ·
        {{ depot.booking_code }}
      </p>
      <p>Source: <code>itinerary.json</code> · presentation only (Vue + MapLibre)</p>
    </footer>
  </div>
</template>
