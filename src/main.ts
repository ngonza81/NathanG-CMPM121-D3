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

// ---- Map setup ---------------------------------------------------

// Dreamwalker starting point (classroom)
const DREAM_ORIGIN = L.latLng(36.997936938057016, -122.05703507501151);

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

// We'll keep track of visible rects to clear them on move
const visibleCells: L.Rectangle[] = [];

//Convert a long/lat value to an integer cell index.
function latToCellIndex(lat: number): number {
  return Math.floor((lat - DREAM_ORIGIN.lat) / CELL_SIZE_DEG);
}
function lngToCellIndex(lng: number): number {
  return Math.floor((lng - DREAM_ORIGIN.lng) / CELL_SIZE_DEG);
}

// Check if a cell (i, j) is close enough to interact with.
function isCellNearPlayer(i: number, j: number): boolean {
  const dist = Math.sqrt(i * i + j * j);
  return dist <= INTERACTION_RADIUS_CELLS;
}

// Grabs a spirit value: Returns 0 if empty, or a power-of-two-ish
function getCellSpiritValue(i: number, j: number): number {
  // use i,j and a label so different features can hash differently
  const r = luck(`${i},${j},spirit`);
  // e.g. 20% chance to have a token
  if (r < 0.2) {
    // pick 1 or 2 or 4 for now
    if (r < 0.07) return 4;
    if (r < 0.14) return 2;
    return 1;
  }
  return 0;
}

// Draw all cells in the current viewport so it looks like the world is fully covered.
function drawCells() {
  // clear old
  for (const cell of visibleCells) {
    map.removeLayer(cell);
  }
  visibleCells.length = 0;

  const bounds = map.getBounds();

  // figure out cell range to draw
  const startI = latToCellIndex(bounds.getSouth());
  const endI = latToCellIndex(bounds.getNorth());
  const startJ = lngToCellIndex(bounds.getWest());
  const endJ = lngToCellIndex(bounds.getEast());

  for (let i = startI; i <= endI; i++) {
    for (let j = startJ; j <= endJ; j++) {
      // convert cell indices back to lat/lng bounds
      const cellSouth = DREAM_ORIGIN.lat + i * CELL_SIZE_DEG;
      const cellWest = DREAM_ORIGIN.lng + j * CELL_SIZE_DEG;
      const cellNorth = cellSouth + CELL_SIZE_DEG;
      const cellEast = cellWest + CELL_SIZE_DEG;

      const rect = L.rectangle(
        [
          [cellSouth, cellWest],
          [cellNorth, cellEast],
        ],
        {
          weight: 0.5,
          color: isCellNearPlayer(i, j) ? "#ff66ff" : "#888",
          fillOpacity: 0.08,
        },
      );

      // figure out if this cell has a spirit
      const spiritValue = getCellSpiritValue(i, j);

      if (spiritValue > 0) {
        rect.bindTooltip(`✨ ${spiritValue}`, {
          permanent: true,
          direction: "center",
          className: "cell-label",
        });
      }

      // clicking the cell
      rect.on("click", () => {
        if (!isCellNearPlayer(i, j)) {
          statusPanel.textContent =
            `That fragment is too far away. Move closer. (cell ${i},${j})`;
          return;
        }
        // later: pickup / merge logic
        if (spiritValue > 0) {
          statusPanel.textContent =
            `You reach into the dream and feel a spirit of value ${spiritValue} in cell ${i},${j}.`;
        } else {
          statusPanel.textContent = `Empty dream fragment at ${i},${j}.`;
        }
      });

      rect.addTo(map);
      visibleCells.push(rect);
    }
  }
}

map.on("moveend", drawCells);
drawCells();
