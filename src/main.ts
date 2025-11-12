// @deno-types="npm:@types/leaflet"
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";

// ---- Constants & Config ----------------------------------------
const MAP_ZOOM = 19;
const CELL_SIZE_DEG = 0.0001;
const INTERACTION_RADIUS_CELLS = 3;
const FILL_OPACITY_EMPTY = 0.05;
const FILL_OPACITY_FILLED = 0.12;

const WORLD_ORIGIN = L.latLng(36.997936938057016, -122.05703507501151);
let playerPos = centerPlayerOnGrid(WORLD_ORIGIN.lat, WORLD_ORIGIN.lng);

// ---- State -----------------------------------------------------
const gridState = {
  visibleCells: [] as L.Rectangle[],
  overrides: {} as Record<string, number>,
  heldSpirit: null as number | null,
};

// ---- UI setup --------------------------------------------------
const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanel = document.createElement("div");
statusPanel.id = "statusPanel";
document.body.append(statusPanel);

const feedbackPanel = document.createElement("div");
feedbackPanel.id = "feedbackPanel";
document.body.append(feedbackPanel);

// ---- Map setup --------------------------------------------------
const map = L.map(mapDiv, {
  center: WORLD_ORIGIN,
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

const playerMarker = L.circleMarker(playerPos, {
  radius: 7,
  color: "purple",
  fillOpacity: 0.8,
}).addTo(map).bindTooltip("Dreamwalker");

// ---- Utility Functions -----------------------------------------

function latToCellIndex(lat: number) {
  return Math.floor(lat / CELL_SIZE_DEG);
}
function lngToCellIndex(lng: number) {
  return Math.floor(lng / CELL_SIZE_DEG);
}
function cellKey(i: number, j: number) {
  return `${i},${j}`;
}

function getCellLatLng(i: number, j: number) {
  const south = i * CELL_SIZE_DEG;
  const west = j * CELL_SIZE_DEG;
  return {
    south,
    west,
    north: south + CELL_SIZE_DEG,
    east: west + CELL_SIZE_DEG,
  };
}

function getSpiritValue(i: number, j: number): number {
  const r = luck(`${i},${j},spirit`);
  if (r < 0.2) return r < 0.07 ? 4 : r < 0.14 ? 2 : 1;
  return 0;
}

function isCellNearPlayer(i: number, j: number): boolean {
  const cellLat = i * CELL_SIZE_DEG;
  const cellLng = j * CELL_SIZE_DEG;
  const distLat = Math.abs(cellLat - playerPos.lat);
  const distLng = Math.abs(cellLng - playerPos.lng);
  return (
    distLat <= INTERACTION_RADIUS_CELLS * CELL_SIZE_DEG &&
    distLng <= INTERACTION_RADIUS_CELLS * CELL_SIZE_DEG
  );
}

function centerPlayerOnGrid(lat: number, lng: number): L.LatLng {
  const i = Math.floor(lat / CELL_SIZE_DEG);
  const j = Math.floor(lng / CELL_SIZE_DEG);
  const centeredLat = (i + 0.5) * CELL_SIZE_DEG;
  const centeredLng = (j + 0.5) * CELL_SIZE_DEG;
  return L.latLng(centeredLat, centeredLng);
}

function updateStatusPanel() {
  statusPanel.textContent = gridState.heldSpirit
    ? `✨ Holding spirit of value ${gridState.heldSpirit}.`
    : "👐 Empty-handed.";
}

function updateCellAppearance(
  rect: L.Rectangle,
  value: number,
  nearby: boolean,
) {
  rect.setStyle({
    color: nearby ? "#d607d6ff" : "#888",
    fillOpacity: value > 0 ? FILL_OPACITY_FILLED : FILL_OPACITY_EMPTY,
  });
  rect.unbindTooltip();
  if (value > 0) {
    rect.bindTooltip(`✨ ${value}`, {
      permanent: true,
      direction: "center",
      className: "cell-label",
    });
  }
}

function handleCellClick(i: number, j: number, rect: L.Rectangle) {
  if (!isCellNearPlayer(i, j)) {
    feedbackPanel.textContent = `That fragment is too far away. Move closer.`;
    return;
  }

  const key = cellKey(i, j);
  const currentValue = key in gridState.overrides
    ? gridState.overrides[key]
    : getSpiritValue(i, j);

  // --- PICKUP ---
  if (currentValue > 0 && gridState.heldSpirit === null) {
    gridState.heldSpirit = currentValue;
    gridState.overrides[key] = 0;
    updateStatusPanel();
    updateCellAppearance(rect, 0, true);
    feedbackPanel.textContent =
      `💫 Picked up a spirit of value ${currentValue}.`;
    return;
  }

  // --- MERGE ---
  if (currentValue > 0 && gridState.heldSpirit === currentValue) {
    const newValue = currentValue * 2;
    gridState.overrides[key] = newValue;
    gridState.heldSpirit = null;
    updateStatusPanel();
    updateCellAppearance(rect, newValue, true);
    feedbackPanel.textContent = `⚡ Spirits merged! New value: ${newValue}.`;
    return;
  }

  // --- INVALIDS ---
  if (gridState.heldSpirit && currentValue === 0) {
    feedbackPanel.textContent = "This fragment is empty.";
  } else if (gridState.heldSpirit === null && currentValue === 0) {
    feedbackPanel.textContent = "Empty dream fragment.";
  } else {
    feedbackPanel.textContent = "The spirits resist merging.";
  }
}

// ---- Grid Rendering --------------------------------------------

function drawCells() {
  // Clear old cells
  for (const cell of gridState.visibleCells) map.removeLayer(cell);
  gridState.visibleCells.length = 0;

  const bounds = map.getBounds();
  const startI = latToCellIndex(bounds.getSouth());
  const endI = latToCellIndex(bounds.getNorth());
  const startJ = lngToCellIndex(bounds.getWest());
  const endJ = lngToCellIndex(bounds.getEast());

  for (let i = startI; i <= endI; i++) {
    for (let j = startJ; j <= endJ; j++) {
      const { south, west, north, east } = getCellLatLng(i, j);
      const key = cellKey(i, j);
      const spiritValue = key in gridState.overrides
        ? gridState.overrides[key]
        : getSpiritValue(i, j);

      const rect = L.rectangle([[south, west], [north, east]], { weight: 0.5 });
      const nearby = isCellNearPlayer(i, j);
      updateCellAppearance(rect, spiritValue, nearby);

      rect.on("click", () => handleCellClick(i, j, rect));
      rect.addTo(map);
      gridState.visibleCells.push(rect);
    }
  }
}

// ---- Player Movement --------------------------------------------

document.addEventListener("keydown", (e) => {
  switch (e.key.toLowerCase()) {
    case "w": // move north
      movePlayer(0, 1);
      break;
    case "s": // move south
      movePlayer(0, -1);
      break;
    case "a": // move west
      movePlayer(-1, 0);
      break;
    case "d": // move east
      movePlayer(1, 0);
      break;
  }
});

function movePlayer(dx: number, dy: number) {
  const newLat = playerPos.lat + dy * CELL_SIZE_DEG;
  const newLng = playerPos.lng + dx * CELL_SIZE_DEG;

  playerPos = centerPlayerOnGrid(newLat, newLng);
  playerMarker.setLatLng(playerPos);

  feedbackPanel.textContent = `Dreamwalker moved to (${newLat.toFixed(5)}, ${
    newLng.toFixed(5)
  }).`;

  drawCells();
  map.panTo(playerPos);
}

map.on("moveend", drawCells);
drawCells();
updateStatusPanel();
