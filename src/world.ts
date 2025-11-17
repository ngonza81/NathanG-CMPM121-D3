// @deno-types="npm:@types/leaflet"
import L from "leaflet";
import luck from "./_luck.ts";

// --- Grid / world constants --------------------------------------

export const CELL_SIZE_DEG = 0.0001;
export const INTERACTION_RADIUS_CELLS = 3;
export const TEXT_DECIMALS = 5;

// Starting anchor (your classroom)
export const WORLD_ORIGIN = L.latLng(
  36.997936938057016,
  -122.05703507501151,
);

// --- Types -------------------------------------------------------

// MEMENTO PATTERN
export interface CellMemento {
  value: number;
}

// --- Coordinate helpers ------------------------------------------

export function latToCellIndex(lat: number): number {
  return Math.floor(lat / CELL_SIZE_DEG);
}

export function lngToCellIndex(lng: number): number {
  return Math.floor(lng / CELL_SIZE_DEG);
}

export function cellKey(i: number, j: number): string {
  return `${i},${j}`;
}

export function getCellLatLng(i: number, j: number) {
  const south = i * CELL_SIZE_DEG;
  const west = j * CELL_SIZE_DEG;
  return {
    south,
    west,
    north: south + CELL_SIZE_DEG,
    east: west + CELL_SIZE_DEG,
  };
}

export function getCellCenter(i: number, j: number) {
  const { south, west } = getCellLatLng(i, j);
  return {
    lat: south + CELL_SIZE_DEG / 2,
    lng: west + CELL_SIZE_DEG / 2,
  };
}

export function centerPlayerOnGrid(lat: number, lng: number): L.LatLng {
  const i = Math.floor(lat / CELL_SIZE_DEG);
  const j = Math.floor(lng / CELL_SIZE_DEG);
  return L.latLng((i + 0.5) * CELL_SIZE_DEG, (j + 0.5) * CELL_SIZE_DEG);
}

// --- Spirit generation / lookup ---------------------------------

export function getSpiritValue(i: number, j: number): number {
  const r = luck(`${i},${j},spirit`);
  if (r < 0.2) return r < 0.07 ? 4 : r < 0.14 ? 2 : 1;
  return 0;
}

export function getSpiritAt(
  cellMemory: Map<string, CellMemento>,
  i: number,
  j: number,
): number {
  const key = cellKey(i, j);
  return cellMemory.has(key)
    ? cellMemory.get(key)!.value
    : getSpiritValue(i, j);
}

// --- Player / interaction helpers --------------------------------

export function isCellNearPlayer(
  playerPos: L.LatLng,
  i: number,
  j: number,
): boolean {
  const cellLat = i * CELL_SIZE_DEG;
  const cellLng = j * CELL_SIZE_DEG;
  const distLat = Math.abs(cellLat - playerPos.lat);
  const distLng = Math.abs(cellLng - playerPos.lng);

  return (
    distLat <= INTERACTION_RADIUS_CELLS * CELL_SIZE_DEG &&
    distLng <= INTERACTION_RADIUS_CELLS * CELL_SIZE_DEG
  );
}
