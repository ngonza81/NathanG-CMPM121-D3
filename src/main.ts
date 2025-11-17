// @deno-types="npm:@types/leaflet"
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";

// ---- Types ------------------------------------------------------
interface CellMemento {
  value: number;
}

interface MovementController {
  start(): void;
  stop(): void;
  onMove(callback: (lat: number, lng: number) => void): void;
}

// ---- Constants & Config -----------------------------------------

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

// ---- Movement Controllers ----------------------------------------

class ButtonMovementController implements MovementController {
  private callback: ((lat: number, lng: number) => void) | null = null;

  onMove(cb: (lat: number, lng: number) => void) {
    this.callback = cb;
  }

  start() {
    document.addEventListener("keydown", this.handleKey);
  }

  stop() {
    document.removeEventListener("keydown", this.handleKey);
  }

  private handleKey = (e: KeyboardEvent) => {
    if (!this.callback) return;

    let dx = 0;
    let dy = 0;

    switch (e.key.toLowerCase()) {
      case "w":
        dy = CELL_SIZE_DEG;
        break;
      case "s":
        dy = -CELL_SIZE_DEG;
        break;
      case "a":
        dx = -CELL_SIZE_DEG;
        break;
      case "d":
        dx = CELL_SIZE_DEG;
        break;
    }

    if (dx !== 0 || dy !== 0) {
      const newLat = playerPos.lat + dy;
      const newLng = playerPos.lng + dx;
      this.callback(newLat, newLng);
    }
  };
}

class GeoMovementController implements MovementController {
  private watchId: number | null = null;
  private callback: ((lat: number, lng: number) => void) | null = null;

  onMove(cb: (lat: number, lng: number) => void) {
    this.callback = cb;
  }

  start() {
    if (!navigator.geolocation) {
      console.error("Geolocation not supported on this device.");
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!this.callback) return;

        const rawLat = pos.coords.latitude;
        const rawLng = pos.coords.longitude;

        const gridPos = centerPlayerOnGrid(rawLat, rawLng);

        if (
          gridPos.lat !== playerPos.lat ||
          gridPos.lng !== playerPos.lng
        ) {
          this.callback(gridPos.lat, gridPos.lng);
        }
      },
      (err) => {
        console.error("GPS error:", err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000,
      },
    );
  }

  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
    }
  }
}

// ---- State ------------------------------------------------------
let playerPos = WORLD_ORIGIN;

navigator.geolocation.getCurrentPosition(
  (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    playerPos = centerPlayerOnGrid(lat, lng);
    playerMarker.setLatLng(playerPos);
    map.panTo(playerPos);
    drawCells();

    console.log("Game started at real location:", lat, lng);
  },
  (err) => {
    console.warn("Could not get GPS for initial position:", err);
    console.log("Using WORLD_ORIGIN instead.");
  },
  { enableHighAccuracy: true, timeout: 7000 },
);

const gridState = {
  visibleCells: [] as L.Rectangle[],
  heldSpirit: null as number | null,
};
const cellMemory = new Map<string, CellMemento>();
let movementController: MovementController = new ButtonMovementController();

// ---- Movement Toggle Button -------------------------------------

const movementToggle = document.createElement("button");
movementToggle.id = "movementToggle";
movementToggle.textContent = "Switch to Geo Movement";

movementToggle.addEventListener("click", () => {
  if (movementController instanceof ButtonMovementController) {
    movementToggle.textContent = "Switch to Button Movement";
    setMovementController(new GeoMovementController());
    showFeedback("🛰️ Switched to GEO movement");
  } else {
    movementToggle.textContent = "Switch to Geo Movement";
    setMovementController(new ButtonMovementController());
    showFeedback("⌨️ Switched to BUTTON movement");
  }
});

// ---- New Game Button --------------------------------------------

const newGameButton = document.createElement("button");
newGameButton.id = "newGameButton";
newGameButton.textContent = "New Game";
document.body.append(newGameButton);

newGameButton.addEventListener("click", () => {
  localStorage.removeItem(SAVE_KEY);
  location.reload();
});

// ---- UI Setup ---------------------------------------------------

const mapDiv = createDiv("map");
const statusPanel = createDiv("statusPanel");
const feedbackPanel = createDiv("feedbackPanel");
const winOverlay = createWinOverlay();
const uiContainer = document.createElement("div");
uiContainer.id = "uiContainer";
uiContainer.append(statusPanel, feedbackPanel, movementToggle);

document.body.append(uiContainer);
document.body.append(mapDiv, uiContainer, winOverlay);

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
  return cellMemory.has(key)
    ? cellMemory.get(key)!.value
    : getSpiritValue(i, j);
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

function setMovementController(newController: MovementController) {
  movementController.stop(); // stop current controller
  movementController = newController;
  movementController.onMove(handleMoveEvent);
  movementController.start();
}

function handleMoveEvent(lat: number, lng: number) {
  playerPos = centerPlayerOnGrid(lat, lng);
  playerMarker.setLatLng(playerPos);

  showFeedback(
    `Moved to (${lat.toFixed(TEXT_DECIMALS)}, ${lng.toFixed(TEXT_DECIMALS)}).`,
  );

  drawCells();
  map.panTo(playerPos);
  saveGame();
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

// ---- Game Persistence -------------------------------------------

const SAVE_KEY = "dreamlink-save-v1";

// Save full game state into localStorage
function saveGame() {
  const data = {
    player: {
      lat: playerPos.lat,
      lng: playerPos.lng,
    },
    heldSpirit: gridState.heldSpirit,
    cellMemory: Array.from(cellMemory.entries()), // convert Map → array
    movementMode: movementController instanceof GeoMovementController
      ? "geo"
      : "button",
  };

  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

// Load game state from localStorage
function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;

  try {
    const data = JSON.parse(raw);

    // Restore player
    playerPos = L.latLng(data.player.lat, data.player.lng);
    playerMarker.setLatLng(playerPos);
    map.panTo(playerPos);

    // Restore held spirit
    gridState.heldSpirit = data.heldSpirit;
    updateStatusPanel();

    // Restore cell memory
    cellMemory.clear();
    for (const [key, memento] of data.cellMemory) {
      cellMemory.set(key, memento);
    }

    // Restore movement mode
    if (data.movementMode === "geo") {
      setMovementController(new GeoMovementController());
      movementToggle.textContent = "Switch to Button Movement";
    } else {
      setMovementController(new ButtonMovementController());
      movementToggle.textContent = "Switch to Geo Movement";
    }

    return true;
  } catch (err) {
    console.error("Failed to load save:", err);
    return false;
  }
}

// ---- Gameplay Actions -------------------------------------------

function performPickup(i: number, j: number, rect: L.Rectangle, value: number) {
  const key = cellKey(i, j);
  gridState.heldSpirit = value;
  cellMemory.set(key, { value: 0 });
  updateStatusPanel();
  updateCellAppearance(rect, 0, true);
  showFeedback(`💫 Picked up a spirit of value ${value}.`);
  saveGame();
}

function performMerge(i: number, j: number, rect: L.Rectangle, value: number) {
  const key = cellKey(i, j);
  const newValue = value * 2;
  cellMemory.set(key, { value: newValue });
  gridState.heldSpirit = null;
  updateStatusPanel();
  updateCellAppearance(rect, newValue, true);
  showFeedback(`⚡ Spirits merged! New value: ${newValue}.`);
  if (newValue >= VICTORY_VALUE) triggerVictory();
  saveGame();
}

function performDrop(i: number, j: number, rect: L.Rectangle) {
  const key = cellKey(i, j);
  const value = gridState.heldSpirit!;
  cellMemory.set(key, { value: value });
  const { lat, lng } = getCellCenter(i, j);
  showFeedback(
    `🌠 You placed a spirit of value ${value} into (${
      lat.toFixed(TEXT_DECIMALS)
    }, ${lng.toFixed(TEXT_DECIMALS)}).`,
  );
  gridState.heldSpirit = null;
  updateStatusPanel();
  updateCellAppearance(rect, value, true);
  saveGame();
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

movementController.onMove(handleMoveEvent);
movementController.start();

// ---- Initialize -------------------------------------------------

map.on("moveend", drawCells);

const loaded = loadGame();
if (!loaded) {
  playerPos = centerPlayerOnGrid(WORLD_ORIGIN.lat, WORLD_ORIGIN.lng);
  playerMarker.setLatLng(playerPos);
  map.panTo(playerPos);
}

drawCells();
updateStatusPanel();
