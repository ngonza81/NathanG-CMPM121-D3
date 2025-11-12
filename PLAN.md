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
- [x] For each cell, use the deterministic `luck(...)` function to decide if it starts with a spirit fragment → initial state of cells is consistent across page loads.
- [x] Visually show the cell’s content (empty vs spirit value) without clicking.

#### Interaction rules

- [x] Define the player’s dream location as the origin (classroom lat/lng).
- [x] When clicking a nearby cell → allow pickup/merge logic.
- [x] When clicking a far cell → show “too far away” in status panel.

#### Inventory System

- [x] Create a fixed UI element that shows the held spirit’s value or “empty-handed”.
  - [x] Update the UI text each time the player picks up a spirit.
- [x] Allow picking up a spirit fragment from a nearby cell:
  - [x] Only if the player’s hand is empty.
  - [x] Picking up removes that spirit from the cell (updates the map visually).
- [x] Ensure player can hold at most one spirit at a time.

#### Crafting System

- [x] If the player is holding a spirit and clicks on a nearby cell containing a spirit of **equal value**, combine them into a single spirit of **double the value**.
  - [x] Remove the player’s held spirit (set to empty-handed).
  - [x] Update that cell’s value to the new doubled spirit.
  - [x] Visually update the map (tooltip and fill).
- [x] Detect when the player’s held spirit (after pickup or merge) reaches a target value (e.g. 8 or 16).

## D3.b: Globe-spanning Gameplay

**Key technical challenge:** Can you assemble a map-based user interface using the Leaflet mapping framework?**
**Key gameplay challenge:** Can players craft an even higher value token by moving to other locations to get access to additional crafting materials?

### Steps(3b)

#### Global Spanning

- [x] Replace classroom anchor with **Null Island (0, 0)** as `WORLD_ORIGIN`.
- [x] Adjust `latToCellIndex` and `lngToCellIndex` to compute from global coordinates (no more local offset drift).
- [x] Refactor `isCellNearPlayer()` to handle global coordinates correctly.

#### Player Movement Simulation

- [x] Add four directional buttons (WASD) to move the Dreamwalker by exactly one cell step.
- [x] Update feedbackPanel each time the player moves.
- [x] Center Dreamwalker marker in the middle of the current grid cell

#### Crafting & Victory

- [x] Add win threshold
- [x] Test crafting flow across different coordinates (e.g. move north, craft again).
- [x] Add dropping dream fragement mechanic
