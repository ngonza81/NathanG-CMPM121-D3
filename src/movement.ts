import { CELL_SIZE_DEG } from "./world.ts";

// FACADE PATTERN
export interface MovementController {
  start(): void;
  stop(): void;
  onMove(callback: (lat: number, lng: number) => void): void;
}

// -- WASD movement -------------------------------------------------------
export class ButtonMovementController implements MovementController {
  private callback: ((lat: number, lng: number) => void) | null = null;

  constructor(
    private getPlayerPos: () => { lat: number; lng: number },
  ) {}

  onMove(cb: (lat: number, lng: number) => void): void {
    this.callback = cb;
  }

  start(): void {
    document.addEventListener("keydown", this.handleKey);
  }

  stop(): void {
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

    if (dx === 0 && dy === 0) return;

    const pos = this.getPlayerPos();
    const newLat = pos.lat + dy;
    const newLng = pos.lng + dx;
    this.callback(newLat, newLng);
  };
}

// -- Geo Location movement  ----------------------------------------------
export class GeoMovementController implements MovementController {
  private watchId: number | null = null;
  private callback: ((lat: number, lng: number) => void) | null = null;

  onMove(cb: (lat: number, lng: number) => void): void {
    this.callback = cb;
  }

  start(): void {
    if (!navigator.geolocation) {
      console.error("Geolocation not supported on this device.");
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!this.callback) return;
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        this.callback(lat, lng);
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

  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
}
