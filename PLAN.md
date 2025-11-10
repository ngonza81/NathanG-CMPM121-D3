# D3: Dreamlink — The Spirit Collectors

## Game Design Vision

In _Dreamlink_, the player travels through a dreamlike world represented by a real-world map.\
Each grid cell is a fragment of the dream, which may contain a spirit fragment — a small piece of a forgotten memory.\
By collecting and merging equal fragments, the player crafts stronger spirits and restores clarity to the dream.\
The goal: merge until a powerful spirit (e.g., value 16 or 32) awakens, symbolizing a _memory restored_.

---

## Technologies

- TypeScript for most game code, little to no explicit HTML, and all CSS collected in common `style.css` file
- Leaflet for rendering the dream map
- Deno and Vite for building
- GitHub Actions + GitHub Pages for deployment automation

## D3.a: Core Mechanics (Dream Fragments and Crafting)

**Key technical challenge:** Can you assemble a map-based user interface using the Leaflet mapping framework?**
**Key gameplay challenge:** Can players collect and craft tokens from nearby locations to finally make one of sufficiently high value?

### Steps

#### Map

- [x] Start from `reference.ts` (old Leaflet demo) for ideas only.
- [x] Create fresh `src/main.ts` with a clean Leaflet setup.
- [x] Render a Leaflet map centered on the classroom dream location.
- [x] Draw a grid of cells that covers the entire current viewport
- [x] Give each cell a stable ID based on its lat/lng index
- [] For each cell, use the deterministic `luck(...)` function to decide if it starts with a spirit fragment → initial state of cells is consistent across page loads.
- [] Visually show the cell’s content (empty vs spirit value) without clicking.

### Interaction rules

- [x] Define the player’s dream location as the origin (classroom lat/lng).
- [ ] When clicking a **nearby** cell → allow pickup/merge logic.
- [ ] When clicking a **far** cell → show “too far away” in status panel.
