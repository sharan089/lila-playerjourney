# LILA Player Journey

Deployment URL: [ADD DEPLOYED URL]

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [INSIGHTS.md](INSIGHTS.md)

## 1. Project Overview

LILA Player Journey is a browser-based telemetry dashboard for analyzing gameplay behavior in the LILA BLACK dataset. The project reconstructs individual match sessions from raw per-player Parquet telemetry, visualizes movement and events on a minimap, and provides interaction for player analytics, player journey review, and match-level insights.

The implementation is designed around the actual processed match data stored under `processed_data/matches/` and the frontend logic in `frontend/app.js`. It processes telemetry from raw `.nakama-0` files, converts world coordinates into minimap coordinates, draws player paths and event markers on a canvas, and exposes filtering, playback, and analytics tooling in the browser.

The dashboard allows users to:

- inspect a match on a map
- filter by map, date, and match
- replay movement over time using a timeline and playback controls
- toggle heatmap overlays
- inspect player-level distance, speed, kills, deaths, and loot stats
- select a player and review their event chronology
- view aggregated match insights derived from current match data

## 2. Key Features

The following features are present in the current implementation:

- Match reconstruction from per-player event files
- Human vs. bot identification using the `user_id` value
- Player movement visualization on the minimap canvas
- Human tracer styling and bot tracer styling
- Event markers for combat, loot, and storm death events
- Timeline playback with `currentElapsed`-based visibility
- Playback speed controls (`0.25x`, `0.5x`, `1x`, `2x`)
- Heatmap visualization modes: `traffic`, `kills`, and `deaths`
- Kill visualization
- Death visualization
- Traffic visualization
- Player selection from the analytics table
- Selected-player tracer highlighting and dimming for non-selected players
- Player Journey panel for the selected player
- Match Analytics cards for the current match
- Match Insights summary for the current match
- Map/date/match filtering using the index and dropdown logic
- Coordinate transformation from world coordinates to minimap pixels
- Event timeline by `elapsed_ms`

The implementation does not add a second simulation engine or alternate visualization system; the application uses the existing canvas renderer and match data flow already present in `frontend/app.js`.

## 3. System Architecture

```text
Raw Nakama Telemetry
        ↓
player_data/**/*.nakama-0 (Parquet files)
        ↓
data_processor.py
        ↓
Decode event bytes, group by match_id, classify human/bot, convert x/z to pixel_x/pixel_y
        ↓
Processed match JSON
        ↓
processed_data/matches.json + processed_data/matches/*.json
        ↓
Frontend data loader (fetch + loadMatch + displayMatch)
        ↓
Filtering / timeline state (mapSelect, dateSelect, matchSelect, timeline, currentElapsed)
        ↓
Canvas renderer (drawVisualization + drawHeatmapOverlay + drawPlayerMarker + drawEventMarker)
        ↓
Analytics, Player Journey, Match Insights
```

Each stage contributes to the final live dashboard. The raw telemetry is transformed into match-level JSON, which the frontend consumes to redraw paths, markers, and analytical summaries as the selected match or playback time changes.

## 4. Repository Structure

```text
LILA/
├── data_processor.py
├── data_preprocessor.py
├── match_inspector.py
├── visual_test.py
├── coordinate_validation.png
├── frontend/
│   ├── app.js
│   ├── index.html
│   └── style.css
├── player_data/
│   ├── February_10/
│   ├── February_11/
│   ├── February_12/
│   ├── February_13/
│   ├── February_14/
│   └── README.md
├── processed_data/
│   ├── matches.json
│   └── matches/
├── README.md
└── docs/
    ├── QUICKSTART.md
    ├── TECHNICAL_DOCUMENTATION.md
    └── PROJECT_REPORT.md
```

Important files:

- `data_processor.py` — reconstructs match JSON from raw Parquet files and writes the processed dataset.
- `data_preprocessor.py` — dataset audit script that summarizes files, event counts, and player classification across the raw telemetry.
- `match_inspector.py` — helper script for large-match analysis and structure inspection.
- `visual_test.py` — validation script for coordinate plotting and minimap alignment.
- `frontend/index.html` — dashboard shell with filters, timeline, analytics, and cards.
- `frontend/app.js` — main application logic for loading data, rendering the canvas, playback, analytics, selection, and journey summaries.
- `frontend/style.css` — dashboard styling and dark-theme layout.
- `player_data/README.md` — raw telemetry documentation for the dataset.
- `processed_data/matches.json` — summary index of all processed matches.
- `processed_data/matches/` — one JSON file per processed match.

## 5. Data Pipeline

The implementation pipeline is as follows:

1. Raw telemetry is present under `player_data/` as Parquet files named like `*.nakama-0`.
2. `data_processor.py` scans all Parquet files under `player_data` using `Path.rglob("*.nakama-0")`.
3. Each file is read using `pandas.read_parquet(file)`.
4. The `event` field is decoded using `decode_event()` so bytes are converted to UTF-8 strings.
5. Rows are grouped by `match_id` and merged into a single reconstructed match object.
6. Each player is registered in a per-match `players` dictionary and classified as human or bot.
7. Coordinates are read from `x` and `z`, and then transformed using the map-specific world-to-minimap conversion.
8. Each event gets a UTC-style ISO `timestamp` string and a `elapsed_ms` value relative to the first event in that match.
9. Match-level metadata such as `start_timestamp`, `end_timestamp`, `duration_ms`, `player_count`, `human_count`, `bot_count`, and `event_count` is added.
10. The match is written to `processed_data/matches/<match_id>.json` and also added to `processed_data/matches.json`.
11. The frontend loads the match index using `fetch(MATCH_INDEX_URL)` and loads the selected match JSON using `fetch(MATCH_FOLDER + matchId + '.json')`.
12. The canvas rendering system filters events based on `currentElapsed`, draws movement paths, markers, and heatmap overlays, and refreshes analytics and journey summaries.

## 6. Data Model

A processed match JSON contains a top-level match object with metadata and an array of `events`. The actual structure currently used by the app is:

- `match_id`: match identifier string
- `map`: map name such as `AmbroseValley`, `GrandRift`, or `Lockdown`
- `date`: dataset date folder, for example `February_10`
- `players`: array of player objects
- `player_count`: total number of `players`
- `human_count`: number of human players
- `bot_count`: number of bot players
- `event_count`: total number of events in the match
- `start_timestamp`: first event timestamp for the match
- `end_timestamp`: last event timestamp for the match
- `duration_ms`: match length in milliseconds
- `events`: list of event records

Player object example:

```json
{
  "user_id": "8f1a...",
  "type": "human",
  "events": 187
}
```

Event object example:

```json
{
  "user_id": "8f1a...",
  "type": "human",
  "event": "Position",
  "timestamp": "1970-01-21T11:52:40.465000",
  "x": -233.5765380859375,
  "z": 190.6904754638672,
  "pixel_x": 272.82,
  "pixel_y": 316.73,
  "elapsed_ms": 0
}
```

Important fields in each event:

- `user_id`: player or bot identifier
- `type`: `human` or `bot`
- `event`: event name such as `Position`, `BotPosition`, `Kill`, `Loot`, etc.
- `timestamp`: ISO timestamp string for the event
- `x`: world X coordinate
- `z`: world Z coordinate
- `pixel_x`: converted x coordinate on the 1024x1024 minimap
- `pixel_y`: converted y coordinate on the 1024x1024 minimap
- `elapsed_ms`: milliseconds since the first event in the match

The match summary JSON at `processed_data/matches.json` contains lighter metadata for each match, including `map`, `date`, counts, and `duration_ms`.

## 7. Coordinate Transformation

The coordinate conversion is implemented in `data_processor.py` in `world_to_pixel(x, z, map_name)`.

For each map, the processor uses a map-specific configuration:

| Map | Scale | Origin X | Origin Z |
| --- | ---: | ---: | ---: |
| AmbroseValley | 900 | -370 | -473 |
| GrandRift | 581 | -290 | -290 |
| Lockdown | 1000 | -500 | -500 |

The transformation formula is:

```python
u = (x - origin_x) / scale
v = (z - origin_z) / scale
pixel_x = u * 1024
pixel_y = (1 - v) * 1024
```

This converts world-space coordinates to a 1024×1024 minimap coordinate system. The `pixel_y` value is inverted because the minimap image uses a top-left origin, while the world coordinate system is treated like a conventional Cartesian plane. The implementation therefore applies the vertical flip with `(1 - v) * 1024`.

The frontend uses the same coordinate system in `pixelX(value)` and `pixelY(value)`, where values are scaled to the actual canvas width and height:

```javascript
return (value / 1024) * mapCanvas.width;
return (value / 1024) * mapCanvas.height;
```

## 8. Human and Bot Detection

The raw data processor defines human vs. bot classification in `is_bot(user_id)`:

```python
def is_bot(user_id):
    user_id = str(user_id)
    return user_id.isdigit()
```

This means:

- UUID-like values are treated as human players
- numeric `user_id` values are treated as bots

The processed match records preserve this in each event and player object as `type: "human"` or `type: "bot"`.

The frontend also has fallback logic in `getPlayerTypeLabel()` using a numeric-string check (`String(id).match(/^\d+$/)`) to infer a bot type when a match entry does not explicitly include one.

## 9. Event Processing

The actual dataset currently contains these event names in the processed data:

- `Position`
- `BotPosition`
- `Kill`
- `BotKill`
- `Killed`
- `BotKilled`
- `KilledByStorm`
- `Loot`

The actual current processed dataset counts are:

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

Position events are the path-building events. Non-position events are mostly discrete events such as kills, deaths, loot, and storm deaths. The frontend draws movement paths from `Position` and `BotPosition` entries, while `drawEventMarker()` colors and sizes markers by event type.

The event marker logic in `drawEventMarker()` applies colors:

- `Loot` — yellow
- `Kill` / `BotKill` — orange/red
- `Killed` / `BotKilled` — purple
- `KilledByStorm` — blue
- `Position` / `BotPosition` are not drawn as event markers

## 10. Player Movement Visualization

Movement visualization is driven by `Position` and `BotPosition` events. In `drawVisualization()`, the app:

1. Filters events visible at the current playback time (`currentElapsed`).
2. Groups all visible position events by `user_id`.
3. Sorts them chronologically by `elapsed_ms`.
4. Creates a path for each player.
5. Draws the path line between successive points.
6. Draws the latest player marker.

The actual path grouping logic is:

```javascript
const playerPaths = {};

sortedVisibleEvents.forEach(event => {
    if (event.event !== "Position" && event.event !== "BotPosition") {
        return;
    }

    if (!playerPaths[event.user_id]) {
        playerPaths[event.user_id] = [];
    }

    playerPaths[event.user_id].push(event);
});
```

Selected-player highlighting is controlled by `selectedPlayerId` in the frontend. When the user clicks a row in the player analytics table, the app stores the selected `user_id` and then calls `drawVisualization()`. In the drawing flow, non-selected players are dimmed using `globalAlpha`, while the selected player keeps full opacity and a thicker line width. The player marker itself is also enlarged when selected.

Bot and human player styles differ as implemented in the renderer:

- human tracer: red-ish stroke (`rgba(255, 59, 48, 0.65)`)
- bot tracer: white/near-white stroke (`rgb(244, 239, 239)`)
- human marker: red outer circle
- bot marker: gray outer circle

## 11. Timeline and Playback

Timeline control is implemented in the frontend with:

- `timeline` input range element
- `currentElapsed` numeric state
- `getMatchDurationMs(match)` for total match time
- `getEventElapsedMs(event, match)` for event timing
- `startPlayback()` and `stopPlayback()` for animation

Playback speed options in the current code are:

- `0.25`
- `0.5`
- `1`
- `2`

The timeline slider updates `currentElapsed` and re-renders the canvas. `drawVisualization()` only shows events where `getEventElapsedMs(event, currentMatch) <= currentElapsed`. This means the visible path and marker state are based on the current playback position rather than an arbitrary static view.

The reset button clears playback to zero and redraws the initial state.

## 12. Heatmap

The heatmap overlay is drawn by `drawHeatmapOverlay(ctx, visibleEvents)`.

The implementation uses visible events from the current playback window and aggregates points based on the selected heatmap mode:

- `traffic` — includes `Position` and `BotPosition` points with weight 1
- `kills` — includes `Kill` and `BotKill` points with higher weight
- `deaths` — includes `Killed`, `BotKilled`, and `KilledByStorm` with higher weight

The overlay creates a radial gradient at each point and applies `globalCompositeOperation = "screen"` for a soft overlay effect. The heatmap uses the same processed `pixel_x` and `pixel_y` values already stored on each event, and those values are scaled to the canvas with the same coordinate conversion used for tracers and event markers. This keeps the heatmap aligned with the minimap geometry rather than introducing a separate coordinate system.

## 13. Player Analytics

The dashboard computes player-level statistics in `computePlayerAnalytics()` and match-level summaries in `computeMatchAnalytics()`.

Match Analytics values are calculated directly from `currentMatch` using event names in `currentMatch.events`:

- Duration: `getMatchDurationMs(match)`
- Players: `currentMatch.player_count`
- Humans: `currentMatch.human_count`
- Bots: `currentMatch.bot_count`
- Events: `currentMatch.event_count`
- Kills: count of `Kill` and `BotKill`
- Deaths: count of `Killed`, `BotKilled`, and `KilledByStorm`
- Loot: count of `Loot`
- Bot Kills: count of `BotKill`
- Storm Deaths: count of `KilledByStorm`

Per-player distance and speed are also computed. Distance is measured by summing Euclidean distances between consecutive `Position`/`BotPosition` events for the same user_id:

```javascript
movementDistance += Math.hypot(
    current.x - previous.x,
    current.z - previous.z
);
```

Average speed uses the first and last position event for the player:

```javascript
const firstElapsedMs = first ? getEventElapsedMs(first, match) : 0;
const lastElapsedMs = last ? getEventElapsedMs(last, match) : 0;
const activeMs = first && last ? Math.max(0, lastElapsedMs - firstElapsedMs) : 0;
const activeTimeSeconds = activeMs > 0 ? activeMs / 1000 : 0;
const speed = activeTimeSeconds > 0 ? movementDistance / activeTimeSeconds : 0;
```

This is a complete-match calculation, not a timeline-filtered one. The frontend uses the numeric `elapsed_ms` values rather than the formatted match duration string.

## 14. Player Journey

When a row in the player analytics table is clicked, `selectedPlayerId` is updated. The app then rerenders the journey panel through `renderPlayerJourney()`.

The selected player journey shows:

- the player display name
- the player type
- summary stats (distance, average speed, kills, deaths, loot, events)
- a chronological event list ordered by `elapsed_ms`

The journey list filters events by:

```javascript
String(event.user_id) === String(selectedPlayerId)
```

For each event, the list displays:

- formatted event time (HH:MM.mmm or equivalent)
- event name
- X/Z values for `Position` and `BotPosition`
- non-position events as simple event rows

The row colors correspond to event category in the dashboard CSS: movement is blue, loot is yellow, kills are orange/red, deaths are purple, storm deaths are blue.

If no player is selected, the journey panel displays a “Select a player from the analytics table to view their journey.” message. If the selected player has no events, it displays a “No events available for this player.” message.

## 15. Match Insights

The dashboard computes a match-level summary in `computeMatchInsights(match)`. The current implementation derives:

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

The summary uses existing analytics and current match event data, not a separate external analytics service.

Most active map area is approximated using the `pixel_x` / `pixel_y` coordinates of `Position` and `BotPosition` events. The code divides the minimap into a 32×32 grid, counts entries in each cell, and reports the highest-density cell as `X <value>, Y <value>`.

If there are ties, the code keeps all matching winners rather than hiding a tie.

## 16. Frontend Architecture

### index.html

`frontend/index.html` defines the main structure of the dashboard:

- map filter controls
- date filter controls
- match selector
- map canvas and map image container
- stat cards for players, humans, bots, and events
- timeline panel and playback controls
- analytics panel
- event legend
- player journey section
- match insights section

Important IDs include:

- `mapSelect`
- `dateSelect`
- `matchSelect`
- `playButton`
- `resetButton`
- `timeline`
- `currentTime`
- `totalTime`
- `matchAnalyticsSummary`
- `topPlayerSummary`
- `playerAnalyticsBody`
- `playerJourneyMeta`
- `playerJourneyList`
- `matchInsightsList`

### style.css

The stylesheet defines the dark dashboard theme and the responsive layout. It includes styling for:

- top bar and layout
- map panel
- analytics cards and tables
- selected-row styling
- legend colors
- journey list styling
- insights grid styling

### app.js

`frontend/app.js` contains the main application logic. It includes important functions such as:

- `initialize()`
- `populateDates()`
- `populateMatches()`
- `loadMatch()`
- `displayMatch()`
- `computePlayerAnalytics()`
- `computeMatchAnalytics()`
- `updateAnalytics()`
- `renderPlayerJourney()`
- `computeMatchInsights()`
- `renderMatchInsights()`
- `drawVisualization()`
- `drawHeatmapOverlay()`
- `drawPlayerMarker()`
- `drawEventMarker()`
- `startPlayback()`
- `stopPlayback()`
- `getMatchDurationMs()`
- `getEventElapsedMs()`

## 17. Technologies Used

The implementation uses the following confirmed technologies:

- Python
- Pandas
- Parquet input data (`*.nakama-0` files)
- HTML
- CSS
- JavaScript
- Canvas API for map rendering

The repository does not include a `package.json`, `requirements.txt`, or `pyproject.toml` file in the current implementation. The Python tooling relies on the local environment and the script usage included in the underlying project files.

## 18. Installation / Setup

A local Python environment is required to run the data processing script if the raw dataset needs to be rebuilt.

1. Open a terminal in the project root.
2. Confirm that the raw Parquet files are available under `player_data/`.
3. Run the data processor:

```bash
python data_processor.py
```

This reconstructs the processed match data in `processed_data/matches/` and writes `processed_data/matches.json`.

To serve the frontend locally, use a static web server from the project root or the `frontend` directory. For example:

```bash
cd LILA
python -m http.server 8000
```

Then open the dashboard through the local server, typically via:

```text
http://localhost:8000/frontend/
```

The project is designed around browser-side `fetch()` calls to JSON files, so a local web server is the safest practical way to run the dashboard.

## 19. Usage

1. Start a local static server from the project root.
2. Open the dashboard in a browser.
3. Select a map in the `Map` dropdown.
4. Select a date in the `Date` dropdown.
5. Select a match from the `Match` dropdown.
6. Review the minimap rendering and the live current match statistics.
7. Use the play button to start playback.
8. Use the reset button to return the timeline to zero.
9. Adjust playback speed using the existing speed controls.
10. Toggle heatmap modes (`Off`, `Traffic`, `Kills`, `Deaths`).
11. Click a player row in the analytics table to highlight the selected player.
12. Review the selected player's Player Journey.
13. Review the Match Insights summary for the match.

## 20. Results

The current processed dataset in `processed_data/matches.json` and `processed_data/matches/` contains the following verified totals:

- 796 matches
- 1,242 player entries in the match index summary
- 781 human entries
- 461 bot entries
- 89,104 total events

Map distribution in the indexed matches:

| Map | Matches |
| --- | ---: |
| AmbroseValley | 566 |
| GrandRift | 59 |
| Lockdown | 171 |

Date distribution in the indexed matches:

| Date | Matches |
| --- | ---: |
| February_10 | 285 |
| February_11 | 200 |
| February_12 | 162 |
| February_13 | 112 |
| February_14 | 37 |

These values were verified against the current repository state and should be treated as the current processed dataset summary.

## 21. Limitations

The implementation has several realistic constraints:

- It depends on the availability of raw `.nakama-0` Parquet files in `player_data/`.
- The final dashboard is based on processed match JSON, not a live game server or database.
- The minimap coordinates depend on the fixed map transformation configuration and the validity of the underlying `x`/`z` values.
- The visualization is event-driven rather than continuous interpolation. It renders recorded points and markers at discrete times.
- Very large numbers of events can be visually dense in a browser canvas, especially when playback is enabled at full speed.
- The project does not include a separate backend API, persistence layer, or server-side analytics engine.

These are limitations that follow directly from the implementation rather than speculative features.

## 22. Future Improvements

The following ideas are sensible future work, but they are not currently implemented in this repository:

- richer match comparison views
- saved/exportable analytics reports
- advanced player behavior modeling
- automated anomaly detection for suspicious movement or event patterns
- database-backed storage and query layer
- additional event categories and richer combat analysis
- more detailed map-zone analytics
- improved replay controls and scrubbing behavior

These are future directions, not current features.

## 23. Conclusion

LILA Player Journey demonstrates a complete event-driven telemetry pipeline from raw Parquet gameplay logs to a browser-based visualization and analytics dashboard. The project combines Python-based match reconstruction, coordinate transformation, event normalization, and a JavaScript canvas renderer to expose movement, combat, loot, and timeline behavior across the selected match. The result is a practical telemetry inspection tool for understanding match flow, player movement, and event activity without replacing the underlying data model or visualization architecture.

## Notes

- The implementation in this repository uses the realistic event names and data structures found in the generated match JSON and frontend source.
- Where a detail is not explicitly present in the implementation, it is marked as "Not specified in the current implementation" rather than assumed.
