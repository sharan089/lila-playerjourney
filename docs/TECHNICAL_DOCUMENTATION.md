# LILA Player Journey — Technical Documentation

## 1. Overview

This project reconstructs gameplay telemetry from raw per-player Parquet files and turns it into a local browser dashboard for match inspection and player analysis. The implementation is centered around:

- `data_processor.py` for raw data ingestion and match reconstruction
- `processed_data/matches.json` and `processed_data/matches/*.json` for processed match records
- `frontend/index.html` and `frontend/style.css` for dashboard layout and styling
- `frontend/app.js` for data loading, rendering, playback, selection, analytics, and insights

The system is intentionally event-driven and works with the processed match dataset rather than a database or backend API.

## 2. Architecture

```text
Raw Parquet telemetry (player_data/**/*.nakama-0)
        ↓
Python ingestion (data_processor.py)
        ↓
Event decoding + match grouping + player classification
        ↓
World-to-minimap conversion (x,z → pixel_x,pixel_y)
        ↓
Processed JSON output
        ↓
Frontend fetch + match loading (frontend/app.js)
        ↓
Filtering (map/date/match)
        ↓
Timeline state (currentElapsed + playback)
        ↓
Canvas rendering (drawVisualization, drawHeatmapOverlay)
        ↓
Player analytics, Player Journey, Match Insights
```

## 3. Data Flow

### 3.1 Raw Data Sources

The raw dataset is located under `player_data/` and contains `.nakama-0` files organized by date folder, such as:

- `player_data/February_10/`
- `player_data/February_11/`
- `player_data/February_12/`
- `player_data/February_13/`
- `player_data/February_14/`

The project documentation in `player_data/README.md` describes these files as one-player-per-match Parquet exports and gives the expected schema.

### 3.2 Ingestion

`data_processor.py` iterates over all files with `Path.rglob("*.nakama-0")` and reads each file with `pandas.read_parquet(file)`.

The processor then:

- decodes the `event` column using `decode_event()`
- groups rows by `match_id`
- creates a match entry if it does not already exist
- stores player identities in `match["players"]`
- classifies player role with `is_bot(user_id)`
- computes world coordinates and minimap coordinates
- stores the event timestamp and computes `elapsed_ms`
- writes per-match JSON and a summary index

### 3.3 Match Reconstruction

Each match is assembled into a structure similar to:

```python
match[match_id] = {
    "match_id": match_id,
    "map": map_name,
    "date": file.parent.name,
    "players": {},
    "events": []
}
```

The event payload is appended as a dictionary containing:

- `user_id`
- `type`
- `event`
- `timestamp`
- `x`
- `z`
- `pixel_x`
- `pixel_y`

### 3.4 Timeline Metadata

After sorting events by timestamp, `data_processor.py` computes:

```python
start_timestamp = pd.Timestamp(match['events'][0]['timestamp'])
end_timestamp = pd.Timestamp(match['events'][-1]['timestamp'])
duration_ms = int((end_timestamp - start_timestamp).total_seconds() * 1000)
```

It then loops over the sorted events and computes `elapsed_ms` for each event:

```python
elapsed_ms = int((event_timestamp - start_timestamp).total_seconds() * 1000)
```

## 4. Data Schema

### 4.1 Raw Record Shape

From the dataset documentation and processor logic, each raw row includes:

- `user_id`
- `match_id`
- `map_id`
- `x`
- `y`
- `z`
- `ts`
- `event`

The raw `event` values are bytes and must be decoded to text.

### 4.2 Processed Match Shape

Key fields found in the current processed JSON are:

- `match_id`
- `map`
- `date`
- `players`: array of player records
- `player_count`
- `human_count`
- `bot_count`
- `event_count`
- `start_timestamp`
- `end_timestamp`
- `duration_ms`
- `events`: array of event records

Each event record includes:

- `user_id`
- `type`
- `event`
- `timestamp`
- `x`
- `z`
- `pixel_x`
- `pixel_y`
- `elapsed_ms`

The summary index file `processed_data/matches.json` contains a lighter match object that includes:

- `match_id`
- `map`
- `date`
- `players`
- `humans`
- `bots`
- `events`
- `start_timestamp`
- `end_timestamp`
- `duration_ms`

## 5. Coordinate Mathematics

### 5.1 Map Configuration

The actual map configuration from `data_processor.py` is:

| Map | Scale | Origin X | Origin Z |
| --- | ---: | ---: | ---: |
| AmbroseValley | 900 | -370 | -473 |
| GrandRift | 581 | -290 | -290 |
| Lockdown | 1000 | -500 | -500 |

### 5.2 Conversion Formula

```python
def world_to_pixel(x, z, map_name):
    config = MAP_CONFIG[map_name]
    u = (x - config["origin_x"]) / config["scale"]
    v = (z - config["origin_z"]) / config["scale"]
    pixel_x = u * 1024
    pixel_y = (1 - v) * 1024
    return pixel_x, pixel_y
```

This produces normalized minimap coordinates in a 1024×1024 map space. The frontend then rescales those values to the `canvas` dimensions with:

```javascript
function pixelX(value) {
    return (value / 1024) * mapCanvas.width;
}

function pixelY(value) {
    return (value / 1024) * mapCanvas.height;
}
```

The `pixel_y` inversion is deliberate: the minimap image is treated as an image with origin at the top-left, while the world space is converted to a flipped vertical coordinate system.

## 6. Human/Bot Classification

The implementation defines a player as a bot if the `user_id` is numeric:

```python
return user_id.isdigit()
```

This is consistent with the raw telemetry documentation in `player_data/README.md`, which says:

- UUID-like identifiers are human players
- numeric identifiers are bot players

The processed data stores `type` as `"human"` or `"bot"` for each player and event.

## 7. Event Model

The current processed dataset contains these event names:

- `Position`
- `BotPosition`
- `Kill`
- `BotKill`
- `Killed`
- `BotKilled`
- `KilledByStorm`
- `Loot`

The actual current distribution in the processed dataset is:

| Event | Count |
| --- | ---: |
| Position | 51,347 |
| BotPosition | 21,712 |
| Loot | 12,885 |
| BotKill | 2,415 |
| BotKilled | 700 |
| KilledByStorm | 39 |
| Kill | 3 |
| Killed | 3 |

The code distinguishes movement events from discrete events:

```javascript
if (event.event === "Position" || event.event === "BotPosition") {
    // player path / movement
}
```

The renderer treats all other events as markers and uses `drawEventMarker()` to color them according to category.

## 8. Rendering Pipeline

`frontend/app.js` applies the following rendering flow:

1. `initialize()` loads `processed_data/matches.json` and fills `mapSelect`, `dateSelect`, and `matchSelect`.
2. `loadMatch(matchId)` fetches the selected match file.
3. `displayMatch()` resets state and updates the match title and summary counts.
4. `drawVisualization()` runs on each playback or selection update.
5. `visibleEvents` are filtered with `getEventElapsedMs(event, currentMatch) <= currentElapsed`.
6. `drawHeatmapOverlay()` renders the selected heatmap mode.
7. `playerPaths` are grouped by `user_id` from `Position` and `BotPosition` events.
8. Each path is drawn with a stroke color and width according to player type and selection state.
9. The latest player marker is drawn with `drawPlayerMarker()`.
10. All non-position events are rendered as event markers via `drawEventMarker()`.

## 9. Timeline / Playback Model

The timeline behaves as a numeric time slider driven by `currentElapsed` in milliseconds.

### 9.1 Duration Calculation

`getMatchDurationMs(match)` returns the first available match duration in this order:

1. `match.duration_ms` if valid and positive
2. maximum `elapsed_ms` from the event list
3. timestamp-derived fallback using `Date.parse()`

### 9.2 Event Timing

`getEventElapsedMs(event, match = currentMatch)` looks for:

- `event.elapsed_ms` if it exists
- else calculates `(Date.parse(event.timestamp) - Date.parse(match.start_timestamp))`

This is the core time reference for playback and analytics.

### 9.3 Playback

Playback is driven by `startPlayback()`:

```javascript
const playbackElapsed = startingElapsed + realElapsed * playbackSpeed;
currentElapsed = Math.min(playbackElapsed, duration);
```

The current implementation exposes playback speed values of `0.25`, `0.5`, `1`, and `2`.

## 10. Heatmap Implementation

The actual heatmap implementation is in `drawHeatmapOverlay(ctx, visibleEvents)`.

Modes:

- `traffic`: `Position` + `BotPosition`
- `kills`: `Kill` + `BotKill`
- `deaths`: `Killed` + `BotKilled` + `KilledByStorm`

For each point, the code creates a radial gradient and fills a circle with a translucent color. The result is a soft overlay instead of a strict histogram.

The overlay is time-aware because it receives the current `visibleEvents` array, which is filtered by `currentElapsed` before drawing.

## 11. Analytics Calculations

### 11.1 Match Analytics

`computeMatchAnalytics(match)` adds the following values:

- `duration`: `getMatchDurationMs(match)`
- `totalPlayers`: number of players in the match
- `humans`: count of `type === "human"`
- `bots`: count of `type === "bot"`
- `totalEvents`: `match.events.length`
- `kills`: count of `Kill` and `BotKill`
- `deaths`: count of `Killed`, `BotKilled`, and `KilledByStorm`
- `loot`: count of `Loot`
- `botKills`: count of `BotKill`
- `stormDeaths`: count of `KilledByStorm`

### 11.2 Player Analytics

`computePlayerAnalytics(match)` builds a `Map` keyed by `user_id` and gathers per-player counters. It then computes:

- `distance` by summing Euclidean distances between consecutive movement events
- `speed` by dividing distance by elapsed movement time
- `kills`, `deaths`, and `loot` counts by event name
- `eventCount` by total events for the player

Distance calculation:

```javascript
movementDistance += Math.hypot(
    current.x - previous.x,
    current.z - previous.z
);
```

Movement timing:

```javascript
const firstElapsedMs = first ? getEventElapsedMs(first, match) : 0;
const lastElapsedMs = last ? getEventElapsedMs(last, match) : 0;
const activeMs = first && last ? Math.max(0, lastElapsedMs - firstElapsedMs) : 0;
const activeTimeSeconds = activeMs > 0 ? activeMs / 1000 : 0;
const speed = activeTimeSeconds > 0 ? movementDistance / activeTimeSeconds : 0;
```

This matches the data model's `elapsed_ms` base and uses the actual movement window instead of the overall formatted match time.

## 12. Player Selection and Highlighting

The selection model uses a single global variable:

```javascript
let selectedPlayerId = null;
```

When a row is clicked in the analytics table, `updateAnalytics()` toggles `selectedPlayerId` and re-renders the current visualization. In the drawing phase, the code checks:

```javascript
selectedPlayerId === playerId
```

and uses it to decide:

- opacity for non-selected players
- line width for selected paths
- marker radius for the selected player

The selected player remains highlighted while playback continues because the state is not tied to the current animation frame, but rather to the global `selectedPlayerId` variable used during each redraw.

## 13. Player Journey and Match Insights

### 13.1 Player Journey

`renderPlayerJourney()` filters match events by `selectedPlayerId`:

```javascript
.filter(event => String(event.user_id) === String(selectedPlayerId))
```

It orders them by `elapsed_ms` and then renders each event into a vertical list. For `Position` and `BotPosition`, the row includes X/Z values. For other event types, it renders only the event name and time.

### 13.2 Match Insights

`computeMatchInsights(match)` derives summary values from the current match data:

- total players
- human count
- bot count
- total events
- total kills
- total deaths
- total loot
- total storm deaths
- most active player
- highest distance travelled
- most kills
- most loot collected
- most active map area

The most active area logic currently uses a 32×32 grid over `pixel_x` and `pixel_y` values from movement events, then identifies the cell with the highest count.

## 14. Frontend UI Structure

The main dashboard structure in `frontend/index.html` includes:

- filter controls for map, date, and match
- map section with image and canvas
- summary cards for players/humans/bots/events
- timeline controls
- analytics panel
- selected-player highlight styling in the table
- journey and insights data sections

The CSS file contains the complete theme and layout rules. It uses a dark dashboard scheme with a bordered card layout and compact analytic views.

## 15. Current Dataset Summary

The project was checked against the current `processed_data/matches.json` data. Verified totals:

- 796 matches
- 1,242 players in the match index summary
- 781 human entries
- 461 bot entries
- 89,104 total events

The event distribution from the processed datasets is also verified as:

- `Position`: 51,347
- `BotPosition`: 21,712
- `Loot`: 12,885
- `BotKill`: 2,415
- `BotKilled`: 700
- `KilledByStorm`: 39
- `Kill`: 3
- `Killed`: 3

## 16. Error and Edge-Case Handling

The code includes several practical safeguards:

- `data_processor.py` ignores unreadable Parquet files with a try/except block.
- `world_to_pixel()` raises a `ValueError` for unknown map names.
- `getMatchDurationMs()` falls back to event timing and timestamp ranges if `match.duration_ms` is missing or invalid.
- `getEventElapsedMs()` checks the `elapsed_ms` field before falling back to timestamp subtraction.
- `drawEventMarker()` exits early if `pixel_x` or `pixel_y` are missing.
- `drawVisualization()` returns early if `currentMatch` or map rendering are not ready.

## 17. Performance and Scalability Considerations

The application is best suited to interactive review of a selected match rather than a real-time high-volume analytics service. Performance constraints come from:

- browser canvas redraws over each animation frame
- per-event filtering across potentially large numbers of events
- rendering dozens of player paths in a single canvas view

The current architecture prioritizes clarity and determinism over large-scale server-side aggregation.

## 18. Project Intent

The project intentionally focuses on a compact data pipeline and a static front-end data browser. It reconstructs real match events, transforms world coordinates to minimap coordinates, and presents gameplay telemetry in a way that is easy to analyze by a user in a browser.

This is a visualization and analytics project built around existing processed match data, not a rewrite of the underlying event generation or telemetry ingestion pipeline.
