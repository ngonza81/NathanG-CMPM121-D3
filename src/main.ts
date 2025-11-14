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
const VICTORY_VALUE = 32;
const TEXT_DECIMALS = 5;
const WIN_MESSAGE_TIME = 2500;
const RESET_DELAY = 5000;
const WORLD_ORIGIN = L.latLng(36.997936938057016, -122.05703507501151);

// ---- State ------------------------------------------------------

let playerPos = centerPlayerOnGrid(WORLD_ORIGIN.lat, WORLD_ORIGIN.lng);
const gridState = {
  visibleCells: [] as L.Rectangle[],
  heldSpirit: null as number | null,
};
const cellMemory = new Map<string, number>();

// ---- UI Setup ---------------------------------------------------

const mapDiv = createDiv("map");
const statusPanel = createDiv("statusPanel");
const feedbackPanel = createDiv("feedbackPanel");
const winOverlay = createWinOverlay();

document.body.append(mapDiv, statusPanel, feedbackPanel, winOverlay);

// ---- Map Setup --------------------------------------------------

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

// ---- Utility Functions ------------------------------------------

function createDiv(id: string): HTMLDivElement {
  const div = document.createElement("div");
  div.id = id;
  return div;
}

function createWinOverlay(): HTMLDivElement {
  const div = document.createElement("div");
  div.id = "winOverlay";
  div.style.display = "none";
  return div;
}

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

function getCellCenter(i: number, j: number) {
  const { south, west } = getCellLatLng(i, j);
  return {
    lat: south + CELL_SIZE_DEG / 2,
    lng: west + CELL_SIZE_DEG / 2,
  };
}

function getSpiritValue(i: number, j: number): number {
  const r = luck(`${i},${j},spirit`);
  if (r < 0.2) return r < 0.07 ? 4 : r < 0.14 ? 2 : 1;
  return 0;
}

function getSpiritAt(i: number, j: number): number {
  const key = cellKey(i, j);
  return cellMemory.has(key) ? cellMemory.get(key)! : getSpiritValue(i, j);
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
  return L.latLng((i + 0.5) * CELL_SIZE_DEG, (j + 0.5) * CELL_SIZE_DEG);
}

// ---- UI / State Helpers -----------------------------------------

function updateStatusPanel() {
  statusPanel.textContent = gridState.heldSpirit
    ? `✨ Holding spirit of value ${gridState.heldSpirit}.`
    : "👐 Empty-handed.";
}

function showFeedback(message: string) {
  feedbackPanel.textContent = message;
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

// ---- Gameplay Actions -------------------------------------------

function performPickup(i: number, j: number, rect: L.Rectangle, value: number) {
  const key = cellKey(i, j);
  gridState.heldSpirit = value;
  cellMemory.set(key, 0);
  updateStatusPanel();
  updateCellAppearance(rect, 0, true);
  showFeedback(`💫 Picked up a spirit of value ${value}.`);
}

function performMerge(i: number, j: number, rect: L.Rectangle, value: number) {
  const key = cellKey(i, j);
  const newValue = value * 2;
  cellMemory.set(key, newValue); // <- store merged value
  gridState.heldSpirit = null;
  updateStatusPanel();
  updateCellAppearance(rect, newValue, true);
  showFeedback(`⚡ Spirits merged! New value: ${newValue}.`);
  if (newValue >= VICTORY_VALUE) triggerVictory();
}

function performDrop(i: number, j: number, rect: L.Rectangle) {
  const key = cellKey(i, j);
  const value = gridState.heldSpirit!;
  cellMemory.set(key, value);
  const { lat, lng } = getCellCenter(i, j);
  showFeedback(
    `🌠 You placed a spirit of value ${value} into (${
      lat.toFixed(TEXT_DECIMALS)
    }, ${lng.toFixed(TEXT_DECIMALS)}).`,
  );
  gridState.heldSpirit = null;
  updateStatusPanel();
  updateCellAppearance(rect, value, true);
}

// ---- Victory Logic ----------------------------------------------

function triggerVictory() {
  winOverlay.innerHTML = "<h1>🌟 You Restored the Dream! 🌟</h1>";
  winOverlay.style.display = "block";

  requestAnimationFrame(() => winOverlay.classList.add("show"));
  map.dragging.disable();

  setTimeout(
    () => (winOverlay.innerHTML = "<h1>🌙 A new dream begins...</h1>"),
    WIN_MESSAGE_TIME,
  );
  setTimeout(() => resetGame(), RESET_DELAY);
}

function resetGame() {
  gridState.heldSpirit = null;
  updateStatusPanel();
  winOverlay.classList.remove("show");
  winOverlay.style.display = "none";
  map.dragging.enable();
  cellMemory.clear();
  drawCells();
}

// ---- Cell Interaction -------------------------------------------

function handleCellClick(i: number, j: number, rect: L.Rectangle) {
  if (!isCellNearPlayer(i, j)) {
    return showFeedback(`That fragment is too far away.`);
  }

  const currentValue = getSpiritAt(i, j);
  const held = gridState.heldSpirit;

  if (currentValue > 0 && held === null) {
    return performPickup(i, j, rect, currentValue);
  }
  if (currentValue > 0 && held === currentValue) {
    return performMerge(i, j, rect, currentValue);
  }
  if (held && currentValue === 0) return performDrop(i, j, rect);

  if (held === null && currentValue === 0) {
    return showFeedback("Empty dream fragment.");
  }
  showFeedback("The spirits resist merging.");
}

// ---- Grid Rendering ---------------------------------------------

function drawCells() {
  gridState.visibleCells.forEach((c) => map.removeLayer(c));
  gridState.visibleCells.length = 0;

  const bounds = map.getBounds();
  const startI = latToCellIndex(bounds.getSouth());
  const endI = latToCellIndex(bounds.getNorth());
  const startJ = lngToCellIndex(bounds.getWest());
  const endJ = lngToCellIndex(bounds.getEast());

  for (let i = startI; i <= endI; i++) {
    for (let j = startJ; j <= endJ; j++) {
      const { south, west, north, east } = getCellLatLng(i, j);
      const spiritValue = getSpiritAt(i, j);
      const rect = L.rectangle([[south, west], [north, east]], { weight: 0.5 });
      updateCellAppearance(rect, spiritValue, isCellNearPlayer(i, j));
      rect.on("click", () => handleCellClick(i, j, rect));
      rect.addTo(map);
      gridState.visibleCells.push(rect);
    }
  }
}

// ---- Player Movement --------------------------------------------

document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (!["w", "a", "s", "d"].includes(key)) return;
  movePlayer(
    key === "d" ? 1 : key === "a" ? -1 : 0,
    key === "w" ? 1 : key === "s" ? -1 : 0,
  );
});

function movePlayer(dx: number, dy: number) {
  const newLat = playerPos.lat + dy * CELL_SIZE_DEG;
  const newLng = playerPos.lng + dx * CELL_SIZE_DEG;
  playerPos = centerPlayerOnGrid(newLat, newLng);
  playerMarker.setLatLng(playerPos);
  showFeedback(
    `Dreamwalker moved to (${newLat.toFixed(TEXT_DECIMALS)}, ${
      newLng.toFixed(TEXT_DECIMALS)
    }).`,
  );
  drawCells();
  map.panTo(playerPos);
}

// ---- Initialize -------------------------------------------------

map.on("moveend", drawCells);
drawCells();
updateStatusPanel();
