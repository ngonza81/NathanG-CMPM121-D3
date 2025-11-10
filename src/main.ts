// @deno-types="npm:@types/leaflet"
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./_leafletWorkaround.ts";
//import luck from "./_luck.ts";

// ---- UI skeleton -------------------------------------------------
const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanel = document.createElement("div");
statusPanel.id = "statusPanel";
statusPanel.textContent = "No spirit held.";
document.body.append(statusPanel);

// ---- Map setup ---------------------------------------------------

// Dreamwalker starting point (classroom)
const DREAM_ORIGIN = L.latLng(36.997936938057016, -122.05703507501151);

const MAP_ZOOM = 19;

const map = L.map(mapDiv, {
  center: DREAM_ORIGIN,
  zoom: MAP_ZOOM,
  minZoom: MAP_ZOOM,
  maxZoom: MAP_ZOOM,
  zoomControl: false,
  scrollWheelZoom: false,
});

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// Player marker
const playerMarker = L.circleMarker(DREAM_ORIGIN, {
  radius: 7,
  color: "purple",
  fillOpacity: 0.8,
}).addTo(map);
playerMarker.bindTooltip("Dreamwalker");

const CELL_SIZE_DEG = 0.0001;
const visibleCells: L.Rectangle[] = [];

// Convert latitude/longitude to integer cell indices
function latToCellIndex(lat: number): number {
  return Math.floor((lat - DREAM_ORIGIN.lat) / CELL_SIZE_DEG);
}

function lngToCellIndex(lng: number): number {
  return Math.floor((lng - DREAM_ORIGIN.lng) / CELL_SIZE_DEG);
}

// Draw cells covering current viewport
function drawCells() {
  for (const c of visibleCells) map.removeLayer(c);
  visibleCells.length = 0;

  const bounds = map.getBounds();
  const startI = latToCellIndex(bounds.getSouth());
  const endI = latToCellIndex(bounds.getNorth());
  const startJ = lngToCellIndex(bounds.getWest());
  const endJ = lngToCellIndex(bounds.getEast());

  for (let i = startI; i <= endI; i++) {
    for (let j = startJ; j <= endJ; j++) {
      const rect = L.rectangle(
        [
          [
            DREAM_ORIGIN.lat + i * CELL_SIZE_DEG,
            DREAM_ORIGIN.lng + j * CELL_SIZE_DEG,
          ],
          [
            DREAM_ORIGIN.lat + (i + 1) * CELL_SIZE_DEG,
            DREAM_ORIGIN.lng + (j + 1) * CELL_SIZE_DEG,
          ],
        ],
        { color: "#999", weight: 0.5, fillOpacity: 0.1 },
      );
      rect.addTo(map);
      visibleCells.push(rect);
    }
  }
}

map.on("moveend", drawCells);
drawCells();
