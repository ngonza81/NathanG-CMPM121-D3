// @deno-types="npm:@types/leaflet"
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";

// ---- UI setup -------------------------------------------------
const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanel = document.createElement("div");
statusPanel.id = "statusPanel";
statusPanel.textContent = "No spirit held.";
document.body.append(statusPanel);

const feedbackPanel = document.createElement("div");
feedbackPanel.id = "feedbackPanel";
document.body.append(feedbackPanel);

// ---- Map setup ---------------------------------------------------

// Dreamwalker starting point (classroom)
const DREAM_ORIGIN = L.latLng(36.997936938057016, -122.05703507501151);
let playerPos = DREAM_ORIGIN.clone();

const MAP_ZOOM = 19;
const CELL_SIZE_DEG = 0.0001; // ~house sized
const INTERACTION_RADIUS_CELLS = 3;

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

// Added movement of position to test
map.on("contextmenu", (e: L.LeafletMouseEvent) => {
  e.originalEvent.preventDefault();

  const newPos = e.latlng;
  playerPos = newPos; // update player's position only
  playerMarker.setLatLng(newPos);

  feedbackPanel.textContent = `🧭 Moved Dreamwalker to (${
    newPos.lat.toFixed(5)
  }, ${newPos.lng.toFixed(5)}).`;

  // redraw grid based on new player position
  drawCells();
});

// ---- Player Inventory ----------------------------------------
let heldSpirit: number | null = null;

function updateStatusPanel() {
  if (heldSpirit === null) {
    statusPanel.textContent = "👐 Empty-handed.";
  } else {
    statusPanel.textContent = `✨ Holding spirit of value ${heldSpirit}.`;
  }
}

updateStatusPanel();

// ---- Helper Functions ----------------------------------------

// Convert a long/lat value to an integer cell index.
function latToCellIndex(lat: number): number {
  return Math.floor((lat - DREAM_ORIGIN.lat) / CELL_SIZE_DEG);
}
function lngToCellIndex(lng: number): number {
  return Math.floor((lng - DREAM_ORIGIN.lng) / CELL_SIZE_DEG);
}

// Check if a cell (i, j) is close enough to interact with.
function isCellNearPlayer(i: number, j: number): boolean {
  const cellLat = DREAM_ORIGIN.lat + i * CELL_SIZE_DEG;
  const cellLng = DREAM_ORIGIN.lng + j * CELL_SIZE_DEG;
  const distLat = Math.abs(cellLat - playerPos.lat);
  const distLng = Math.abs(cellLng - playerPos.lng);
  return (
    distLat <= INTERACTION_RADIUS_CELLS * CELL_SIZE_DEG &&
    distLng <= INTERACTION_RADIUS_CELLS * CELL_SIZE_DEG
  );
}

// Grabs a spirit value: Returns 0 if empty, or a power-of-two-ish
function getCellSpiritValue(i: number, j: number): number {
  const r = luck(`${i},${j},spirit`);
  if (r < 0.2) {
    if (r < 0.07) return 4;
    if (r < 0.14) return 2;
    return 1;
  }
  return 0;
}
// ---- Cell Drawing --------------------------------------------

const visibleCells: L.Rectangle[] = [];
const cellOverrides: Record<string, number> = {};

function drawCells() {
  // clear old
  for (const cell of visibleCells) {
    map.removeLayer(cell);
  }
  visibleCells.length = 0;

  const bounds = map.getBounds();
  const startI = latToCellIndex(bounds.getSouth());
  const endI = latToCellIndex(bounds.getNorth());
  const startJ = lngToCellIndex(bounds.getWest());
  const endJ = lngToCellIndex(bounds.getEast());

  for (let i = startI; i <= endI; i++) {
    for (let j = startJ; j <= endJ; j++) {
      const cellSouth = DREAM_ORIGIN.lat + i * CELL_SIZE_DEG;
      const cellWest = DREAM_ORIGIN.lng + j * CELL_SIZE_DEG;
      const cellNorth = cellSouth + CELL_SIZE_DEG;
      const cellEast = cellWest + CELL_SIZE_DEG;

      const key = `${i},${j}`;
      const spiritValue = (key in cellOverrides)
        ? cellOverrides[key]
        : getCellSpiritValue(i, j);

      // Create rectangle
      const rect = L.rectangle(
        [
          [cellSouth, cellWest],
          [cellNorth, cellEast],
        ],
        {
          weight: 0.5,
          color: isCellNearPlayer(i, j) ? "#ff66ff" : "#888",
          fillOpacity: spiritValue > 0 ? 0.12 : 0.05, // ✅ higher opacity for filled cells
        },
      );

      // Display visible spirit tooltips
      if (spiritValue > 0) {
        rect.bindTooltip(`✨ ${spiritValue}`, {
          permanent: true,
          direction: "center",
          className: "cell-label",
        });
      }

      // Clicking the cell
      rect.on("click", () => {
        if (!isCellNearPlayer(i, j)) {
          feedbackPanel.textContent =
            `That fragment is too far away. Move closer. (cell ${i},${j})`;
          return;
        }

        const currentValue = (key in cellOverrides)
          ? cellOverrides[key]
          : getCellSpiritValue(i, j);

        // --- PICKUP LOGIC ---
        if (currentValue > 0 && heldSpirit === null) {
          heldSpirit = currentValue;
          cellOverrides[key] = 0; // mark as empty
          updateStatusPanel();

          rect.unbindTooltip();
          rect.setStyle({ fillOpacity: 0.03 });
          feedbackPanel.textContent =
            `💫 You picked up a spirit of value ${currentValue} from (${i}, ${j}).`;
          return;
        }

        // --- MERGE LOGIC ---
        if (currentValue > 0 && heldSpirit === currentValue) {
          const newValue = currentValue * 2;
          heldSpirit = null;
          cellOverrides[key] = newValue;
          updateStatusPanel();

          rect.bindTooltip(`✨ ${newValue}`, {
            permanent: true,
            direction: "center",
            className: "cell-label",
          });
          rect.setStyle({ fillOpacity: 0.12 });
          feedbackPanel.textContent =
            `⚡ Spirits merge into one of value ${newValue}!`;
          return;
        }

        // --- INVALID ACTIONS ---
        if (heldSpirit !== null && currentValue === 0) {
          feedbackPanel.textContent =
            `This fragment is empty. You can only merge with another spirit.`;
          return;
        }

        if (currentValue === 0 && heldSpirit === null) {
          feedbackPanel.textContent = `Empty dream fragment at (${i}, ${j}).`;
          return;
        }

        if (
          heldSpirit !== null && currentValue !== heldSpirit && currentValue > 0
        ) {
          feedbackPanel.textContent =
            `The spirits resist merging — their energies are unequal.`;
          return;
        }
      });

      rect.addTo(map);
      visibleCells.push(rect);
    }
  }
}

map.on("moveend", drawCells);
drawCells();
