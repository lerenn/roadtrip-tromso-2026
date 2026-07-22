<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const props = defineProps({
  driveTracks: { type: Array, default: () => [] },
  ferryTracks: { type: Array, default: () => [] },
  waypoints: { type: Array, default: () => [] },
  height: { type: String, default: '420px' },
})

const el = ref(null)
let map = null

const KIND_COLOR = {
  depot: '#c0392b',
  sleep: '#2980b9',
  sleep_scenic: '#e67e22',
  sleep_campsite: '#2980b9',
  ferry: '#8e44ad',
  viewpoint: '#27ae60',
  shop: '#f39c12',
  start: '#34495e',
  via: '#7f8c8d',
}

function markerColor(wp) {
  if (wp.kind === 'sleep') return KIND_COLOR.sleep_scenic
  return KIND_COLOR[wp.kind] || '#34495e'
}

function lineFeatureCollection(tracks) {
  return {
    type: 'FeatureCollection',
    features: (tracks || [])
      .filter((t) => t?.length >= 2)
      .map((coordinates) => ({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates },
      })),
  }
}

function pointFeatureCollection(waypoints) {
  return {
    type: 'FeatureCollection',
    features: (waypoints || [])
      .filter((w) => w.lat != null && w.lon != null)
      .map((w) => ({
        type: 'Feature',
        properties: { name: w.name, kind: w.kind, color: markerColor(w) },
        geometry: { type: 'Point', coordinates: [w.lon, w.lat] },
      })),
  }
}

function fitBounds() {
  if (!map) return
  const b = new maplibregl.LngLatBounds()
  let any = false
  for (const t of [...props.driveTracks, ...props.ferryTracks]) {
    for (const c of t || []) {
      b.extend(c)
      any = true
    }
  }
  for (const w of props.waypoints || []) {
    if (w.lon != null && w.lat != null) {
      b.extend([w.lon, w.lat])
      any = true
    }
  }
  if (any) map.fitBounds(b, { padding: 48, maxZoom: 11, duration: 0 })
}

function syncLayers() {
  if (!map || !map.getSource('drives')) return
  map.getSource('drives').setData(lineFeatureCollection(props.driveTracks))
  map.getSource('ferries').setData(lineFeatureCollection(props.ferryTracks))
  map.getSource('waypoints').setData(pointFeatureCollection(props.waypoints))
  fitBounds()
}

function ensureLayers() {
  if (map.getSource('drives')) {
    syncLayers()
    return
  }

  map.addSource('drives', { type: 'geojson', data: lineFeatureCollection(props.driveTracks) })
  map.addSource('ferries', { type: 'geojson', data: lineFeatureCollection(props.ferryTracks) })
  map.addSource('waypoints', { type: 'geojson', data: pointFeatureCollection(props.waypoints) })

  map.addLayer({
    id: 'drives-casing',
    type: 'line',
    source: 'drives',
    paint: {
      'line-color': '#ffffff',
      'line-width': 7,
      'line-opacity': 0.9,
    },
    layout: { 'line-cap': 'round', 'line-join': 'round' },
  })
  map.addLayer({
    id: 'drives-line',
    type: 'line',
    source: 'drives',
    paint: { 'line-color': '#c0392b', 'line-width': 3.2 },
    layout: { 'line-cap': 'round', 'line-join': 'round' },
  })
  map.addLayer({
    id: 'ferries-line',
    type: 'line',
    source: 'ferries',
    paint: {
      'line-color': '#8e44ad',
      'line-width': 3,
      'line-dasharray': [1.5, 1.5],
    },
    layout: { 'line-cap': 'round', 'line-join': 'round' },
  })
  map.addLayer({
    id: 'waypoints-circle',
    type: 'circle',
    source: 'waypoints',
    paint: {
      'circle-radius': 6,
      'circle-color': ['get', 'color'],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  })
  map.addLayer({
    id: 'waypoints-label',
    type: 'symbol',
    source: 'waypoints',
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 11,
      'text-offset': [0, 1.1],
      'text-anchor': 'top',
      'text-max-width': 10,
    },
    paint: {
      'text-color': '#142033',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.4,
    },
  })

  fitBounds()
}

onMounted(() => {
  map = new maplibregl.Map({
    container: el.value,
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [18.5, 69.5],
    zoom: 6.5,
    attributionControl: true,
  })
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
  map.on('load', ensureLayers)
})

onUnmounted(() => {
  map?.remove()
  map = null
})

watch(
  () => [props.driveTracks, props.ferryTracks, props.waypoints],
  () => {
    if (map?.isStyleLoaded()) syncLayers()
  },
  { deep: true },
)
</script>

<template>
  <div class="road-map" :style="{ height }">
    <div ref="el" class="road-map__canvas" />
  </div>
</template>

<style scoped>
.road-map {
  width: 100%;
  border: 1px solid var(--line);
  background: #0f1a24;
  overflow: hidden;
}
.road-map__canvas {
  width: 100%;
  height: 100%;
}

@media (max-width: 720px) {
  :deep(.maplibregl-ctrl-top-right) {
    top: 4px;
    right: 4px;
  }
  :deep(.maplibregl-ctrl button) {
    width: 32px;
    height: 32px;
  }
}
</style>
