# Architecture

## 1. Overview

LILA Player Journey reconstructs raw gameplay telemetry into a browser-based dashboard that helps Level Designers understand how players move, fight, loot, and die across a match. The project takes per-player Parquet exports, groups them by `match_id`, converts the world-space coordinates into minimap pixels, and renders the resulting match state in an interactive canvas UI.

The implementation shows:

- player movement paths
- human vs bot distinction
- event markers for kills, deaths, loot, and storm deaths
- map/date/match filtering
- timeline playback and scrubbing
- heatmap overlays
- player analytics
- selected-player journey/event timeline
- match insights

## 2. Tech Stack & Why

- Python — used in `data_processor.py` to read raw Parquet files, decode event bytes, reconstruct matches, and generate processed JSON.
- Pandas — used to read and process the parquet data and to sort timestamps before match reconstruction.
- Parquet telemetry — the raw dataset format stored under `player_data/` and organized by date and match.
- HTML + CSS — defines the dashboard shell and dark UI styling in `frontend/index.html` and `frontend/style.css`.
- JavaScript — handles data loading, filtering, timeline state, rendering, interactions, and analytics in `frontend/app.js`.
- Canvas API — used to draw minimaps, player tracers, markers, and heatmap overlays without introducing a larger UI framework.

This stack matches the repository’s real implementation: a data processing step in Python, followed by a lightweight browser-only visualization layer.

## 3. Data Flow

Raw parquet telemetry
→ `data_processor.py`
→ match grouping and event decoding
→ world-to-minimap conversion
→ processed JSON output in `processed_data/`
→ browser fetch in `frontend/app.js`
→ filtering and timeline playback
→ canvas rendering and analytics UI

The actual flow is:

1. `data_processor.py` scans `player_data/` for `*.nakama-0` files.
2. Each file is read with `pandas.read_parquet(file)`.
3. The `event` column is decoded using `decode_event()`.
4. Rows are grouped by `match_id` and stored into a reconstructed match object.
5. Each player is tracked in `match["players"]` and classified with `is_bot(user_id)`.
6. `world_to_pixel(x, z, map_name)` converts world coordinates into `pixel_x` and `pixel_y`.
7. The processor sorts all events by timestamp and adds `elapsed_ms` for each event relative to the first event in the match.
8. The match is saved as one JSON file per match under `processed_data/matches/` and summarized in `processed_data/matches.json`.
9. In the frontend, `initialize()` loads the match index and `loadMatch()` fetches the selected match data.
10. `displayMatch()` updates the current match, timeline, and analytics state.
11. `drawVisualization()` renders the minimap, current paths, player markers, event markers, and heatmap overlay.
12. `computePlayerAnalytics()` and `computeMatchInsights()` generate the player and match summaries.

Timestamps and `elapsed_ms` are processed in `data_processor.py`; the frontend uses `getEventElapsedMs()` and `getMatchDurationMs()` to drive timeline filtering and playback.

## 4. Coordinate Mapping

The coordinate conversion is defined in `data_processor.py`:

```python
def world_to_pixel(x, z, map_name):
    config = MAP_CONFIG[map_name]
    u = (x - config["origin_x"]) / config["scale"]
    v = (z - config["origin_z"]) / config["scale"]
    pixel_x = u * 1024
    pixel_y = (1 - v) * 1024
    return pixel_x, pixel_y
```

Map configuration used by the actual code:

| Map | Scale | Origin X | Origin Z |
| --- | ---: | ---: | ---: |
| AmbroseValley | 900 | -370 | -473 |
| GrandRift | 581 | -290 | -290 |
| Lockdown | 1000 | -500 | -500 |

This means the source coordinate system is world-space `(x, z)`, and the target coordinate system is a normalized 1024 × 1024 minimap plane. The `pixel_y` value is inverted with `(1 - v) * 1024` so the map aligns with the image coordinate system, where the origin is the top-left corner.

The frontend scales these values to the canvas using the same coordinate relationship already stored in each event record, then renders player tracers, event markers, and heatmap points with the same geometry. In other words, the same `pixel_x` and `pixel_y` values drive the minimap, the movement path, the marker placement, and the heatmap overlay.

Coordinate correctness is validated in the repository through scripts like `visual_test.py` and the generated minimap metadata; the project matches the raw world data to a fixed map transform used consistently across the entire app.

## 5. Timeline & Playback

The match timeline is driven by `elapsed_ms`, which is assigned per event relative to the first event in each match. The app uses:

- `getMatchDurationMs(match)` for the total match duration
- `getEventElapsedMs(event, match)` for individual event timing
- `currentElapsed` as the active playback position
- the HTML range input element `timeline` for user scrubbing
- `startPlayback()` and `stopPlayback()` for animation

Playback speed is defined in the frontend as `0.25`, `0.5`, `1`, and `2`. At each tick, the app redraws the visualization using the currently visible events, so tracers, event markers, and heatmap overlays all stay synchronized to the same timeline state.

## 6. Assumptions & Data Edge Cases

The implementation makes the following assumptions based on the current data and code:

- Human vs bot detection is inferred from `user_id`: numeric values are treated as bots, UUID-like values are treated as humans.
- Some players may have very short valid position histories; the analytics code handles this by guarding against invalid or empty movement windows.
- If the player has no valid movement interval, average speed is treated as not available rather than guessed.
- Events without position coordinates are not treated as valid movement points for pathing or distance accumulation.
- Match duration is computed from the difference between the earliest and latest event timestamps in a match, not from any external server clock.

## 7. Major Tradeoffs

| Decision | Alternative | Why we chose it |
| --- | --- | --- |
| Vanilla HTML/CSS/JS | Frontend framework (React/Vue/etc.) | The project is a small, data-driven dashboard; the repo already uses a direct browser app without a framework. |
| Canvas rendering | DOM/SVG paths | Canvas is lightweight and matches the existing visualization workflow for player paths, markers, and heatmaps. |
| Preprocessing to JSON | Loading raw parquet directly in browser | Browser-side code is simpler and faster when the data is already normalized into per-match JSON. |
| Client-side filtering | Server-side query layer | The repository is static and already organized around local match JSON files; filtering is done in the browser with current selection state. |
| Simple heatmap/grid approach | Full GIS or charting library | The app only needs frequency overlays and map-relative density, which the canvas can render efficiently without extra dependencies. |
| Browser-based static frontend with local JSON data | Separate backend service or database | The repository already contains processed match JSON and a lightweight browser app, so the current deployment model is a static frontend that fetches local data rather than an application server with a database layer. |

