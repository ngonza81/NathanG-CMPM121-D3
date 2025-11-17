// @deno-types="npm:@types/leaflet"
import L from "leaflet";

const FILL_OPACITY_EMPTY = 0.05;
const FILL_OPACITY_FILLED = 0.12;

export function createDiv(id: string): HTMLDivElement {
  const div = document.createElement("div");
  div.id = id;
  return div;
}

export function createWinOverlay(): HTMLDivElement {
  const div = document.createElement("div");
  div.id = "winOverlay";
  div.style.display = "none";
  return div;
}

export function updateCellAppearance(
  rect: L.Rectangle,
  value: number,
  nearby: boolean,
): void {
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
