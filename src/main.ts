// @deno-types="npm:@types/leaflet"
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./_leafletWorkaround.ts";
import victorySoundFile from "../assets/victory.mp3";

import {
  cellKey,
  type CellMemento,
  centerPlayerOnGrid,
  getCellCenter,
  getCellLatLng,
  getSpiritAt,
  isCellNearPlayer,
  latToCellIndex,
  lngToCellIndex,
  TEXT_DECIMALS,
  WORLD_ORIGIN,
} from "./world.ts";

import { createDiv, createWinOverlay, updateCellAppearance } from "./ui.ts";

import {
  ButtonMovementController,
  GeoMovementController,
  type MovementController,
} from "./movement.ts";

// ---- Constants --------------------------------------------------

const MAP_ZOOM = 19;
const VICTORY_VALUE = 32;
const WIN_MESSAGE_TIME = 2500;
const RESET_DELAY = 5000;
const SAVE_KEY = "dreamlink-save-v1";
const victorySound = new Audio(victorySoundFile);

// ---- Game state -------------------------------------------------

let playerPos = WORLD_ORIGIN.clone();

const gridState = {
  visibleCells: [] as L.Rectangle[],
  heldSpirit: null as number | null,
};

// FLYWEIGHT PATTERN
const cellMemory = new Map<string, CellMemento>();

let movementController: MovementController = new ButtonMovementController(
  () => playerPos,
);

// ---- UI setup ---------------------------------------------------

const mapDiv = createDiv("map");
const statusPanel = createDiv("statusPanel");
const feedbackPanel = createDiv("feedbackPanel");
const winOverlay = createWinOverlay();

// movement toggle button (right of feedback)
const movementToggle = document.createElement("button");
movementToggle.id = "movementToggle";
movementToggle.textContent = "Switch to Geo Movement";

// new game button (above movement, same column – styled via CSS)
const newGameButton = document.createElement("button");
newGameButton.id = "newGameButton";
newGameButton.textContent = "New Game";

// container for status + feedback + movement toggle
const uiContainer = document.createElement("div");
uiContainer.id = "uiContainer";
uiContainer.append(statusPanel, feedbackPanel, movementToggle);

document.body.append(mapDiv, uiContainer, winOverlay, newGameButton);

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

// ---- Small helpers ----------------------------------------------

function showFeedback(message: string): void {
  feedbackPanel.textContent = message;
}

function updateStatus(): void {
  statusPanel.textContent = gridState.heldSpirit
    ? `✨ Holding spirit of value ${gridState.heldSpirit}.`
    : "👐 Empty-handed.";
}

function getRealWorldStartingPosition(): Promise<L.LatLng> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(centerPlayerOnGrid(WORLD_ORIGIN.lat, WORLD_ORIGIN.lng));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve(
          centerPlayerOnGrid(pos.coords.latitude, pos.coords.longitude),
        );
      },
      () => {
        resolve(centerPlayerOnGrid(WORLD_ORIGIN.lat, WORLD_ORIGIN.lng));
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
      },
    );
  });
}

function setMovementController(newController: MovementController): void {
  movementController.stop();
  movementController = newController;
  movementController.onMove(handleMoveEvent);
  movementController.start();
}

// ---- Movement handling ------------------------------------------

function handleMoveEvent(lat: number, lng: number): void {
  // snap raw input to grid center
  playerPos = centerPlayerOnGrid(lat, lng);
  playerMarker.setLatLng(playerPos);

  showFeedback(
    `Moved to (${lat.toFixed(TEXT_DECIMALS)}, ${lng.toFixed(TEXT_DECIMALS)}).`,
  );

  drawCells();
  map.panTo(playerPos);
  saveGame();
}

// movement toggle button logic
movementToggle.addEventListener("click", () => {
  if (movementController instanceof ButtonMovementController) {
    movementToggle.textContent = "Switch to Button Movement";
    setMovementController(new GeoMovementController());
    showFeedback("🛰️ Switched to GEO movement");
  } else {
    movementToggle.textContent = "Switch to Geo Movement";
    setMovementController(new ButtonMovementController(() => playerPos));
    showFeedback("⌨️ Switched to BUTTON movement");
  }
});

// "New Game" button: show overlay, then clear save + reload
newGameButton.addEventListener("click", () => {
  winOverlay.innerHTML = "<h1>🌙 A new dream begins...</h1>";
  winOverlay.style.display = "block";

  requestAnimationFrame(() => winOverlay.classList.add("show"));

  setTimeout(() => {
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }, 2000);
});

// ---- Persistence -----------------------------------------------

// MEMENTO PATTERN
function saveGame(): void {
  const data = {
    player: { lat: playerPos.lat, lng: playerPos.lng },
    heldSpirit: gridState.heldSpirit,
    cellMemory: Array.from(cellMemory.entries()),
    movementMode: movementController instanceof GeoMovementController
      ? "geo"
      : "button",
  };

  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

// MEMENTO PATTERN
function loadGame(): boolean {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;

  try {
    const data = JSON.parse(raw);

    playerPos = L.latLng(data.player.lat, data.player.lng);
    playerMarker.setLatLng(playerPos);
    map.panTo(playerPos);

    gridState.heldSpirit = data.heldSpirit ?? null;
    updateStatus();

    cellMemory.clear();
    for (const [key, memento] of data.cellMemory as [string, CellMemento][]) {
      cellMemory.set(key, memento);
    }

    const useGeo = data.movementMode === "geo";
    movementController = useGeo
      ? new GeoMovementController()
      : new ButtonMovementController(() => playerPos);

    movementToggle.textContent = useGeo
      ? "Switch to Button Movement"
      : "Switch to Geo Movement";

    return true;
  } catch (err) {
    console.error("Failed to load save:", err);
    return false;
  }
}

// ---- Gameplay actions -------------------------------------------

function performPickup(
  i: number,
  j: number,
  rect: L.Rectangle,
  value: number,
): void {
  const key = cellKey(i, j);
  gridState.heldSpirit = value;
  cellMemory.set(key, { value: 0 });
  updateStatus();
  updateCellAppearance(rect, 0, true);
  showFeedback(`💫 Picked up a spirit of value ${value}.`);
  saveGame();
}

function performMerge(
  i: number,
  j: number,
  rect: L.Rectangle,
  value: number,
): void {
  const key = cellKey(i, j);
  const newValue = value * 2;
  cellMemory.set(key, { value: newValue });
  gridState.heldSpirit = null;
  updateStatus();
  updateCellAppearance(rect, newValue, true);
  showFeedback(`⚡ Spirits merged! New value: ${newValue}.`);

  if (newValue >= VICTORY_VALUE) {
    triggerVictory();
  }

  saveGame();
}

function performDrop(i: number, j: number, rect: L.Rectangle): void {
  const key = cellKey(i, j);
  const value = gridState.heldSpirit!;
  cellMemory.set(key, { value });
  const { lat, lng } = getCellCenter(i, j);

  showFeedback(
    `🌠 You placed a spirit of value ${value} into (${
      lat.toFixed(TEXT_DECIMALS)
    }, ${lng.toFixed(TEXT_DECIMALS)}).`,
  );

  gridState.heldSpirit = null;
  updateStatus();
  updateCellAppearance(rect, value, true);
  saveGame();
}

// ---- Victory + reset -------------------------------------------

function triggerVictory(): void {
  victorySound.currentTime = 0;
  victorySound.play();

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

async function resetGame(): Promise<void> {
  cellMemory.clear();
  gridState.heldSpirit = null;
  updateStatus();
  localStorage.removeItem(SAVE_KEY);

  const startPos = await getRealWorldStartingPosition();
  playerPos = startPos;
  playerMarker.setLatLng(startPos);
  map.panTo(startPos);
  map.dragging.enable();

  winOverlay.classList.remove("show");
  winOverlay.style.display = "none";

  drawCells();
}

// ---- Cell interaction -------------------------------------------

function handleCellClick(
  i: number,
  j: number,
  rect: L.Rectangle,
): void {
  if (!isCellNearPlayer(playerPos, i, j)) {
    showFeedback("That fragment is too far away.");
    return;
  }

  const currentValue = getSpiritAt(cellMemory, i, j);
  const held = gridState.heldSpirit;

  if (currentValue > 0 && held === null) {
    performPickup(i, j, rect, currentValue);
    return;
  }

  if (currentValue > 0 && held === currentValue) {
    performMerge(i, j, rect, currentValue);
    return;
  }

  if (held && currentValue === 0) {
    performDrop(i, j, rect);
    return;
  }

  if (held === null && currentValue === 0) {
    showFeedback("Empty dream fragment.");
    return;
  }

  showFeedback("The spirits resist merging.");
}

// ---- Grid rendering ---------------------------------------------

function drawCells(): void {
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
      const spiritValue = getSpiritAt(cellMemory, i, j);

      const rect = L.rectangle([[south, west], [north, east]], {
        weight: 0.5,
      });

      const nearby = isCellNearPlayer(playerPos, i, j);
      updateCellAppearance(rect, spiritValue, nearby);

      rect.on("click", () => handleCellClick(i, j, rect));
      rect.addTo(map);
      gridState.visibleCells.push(rect);
    }
  }
}

// ---- Bootstrap --------------------------------------------------

map.on("moveend", drawCells);

(async function bootstrap() {
  const loaded = loadGame();

  if (!loaded) {
    const startPos = await getRealWorldStartingPosition();
    playerPos = startPos;
    playerMarker.setLatLng(startPos);
    map.panTo(startPos);
  }

  drawCells();
  updateStatus();

  // wire and start movement after we know which controller to use
  setMovementController(movementController);
})();
