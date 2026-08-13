# LILA Player Journey Project Report

## 1. Title

LILA Player Journey

## 2. Abstract

This project investigates gameplay telemetry from LILA BLACK match data and reconstructs a browser-based dashboard for interactive visualization, match analysis, and player behavior review. The implementation combines a Python processing pipeline with a browser-rendered canvas frontend. Raw Parquet telemetry is converted into processed match JSON, from which motion paths, event markers, player statistics, and match-level insights are derived.

The application emphasizes the practical use of existing match data. It reconstructs a single match timeline, converts world coordinates to minimap space, and renders movement paths and event markers with a local JavaScript canvas application. The project includes match filtering, a timeline playback system, player analytics, player journey derivation, and match insights.

## 3. Introduction

LILA Player Journey addresses the need to interpret large numbers of telemetry events from competitive gameplay sessions. The project takes raw match telemetry generated as one-player-per-match Parquet files and reconstructs the full match timeline for visualization and analysis.

The system is designed to work with real telemetry generated in the project dataset rather than synthetic benchmark data. It provides a browser-based interface where users can inspect map activity, playback events over time, identify players, review event chronology, and aggregate match-level insights.

## 4. Problem Statement

Telemetry from gameplay sessions is high-volume and event-rich. In its raw form, the data is fragmented across many files and is not directly suitable for interactive visual analysis. The challenge is to:

- reconstruct match-level sequences from per-player records
- classify players into humans and bots
- convert world coordinates into map coordinates
- render movement and events in time order
- surface player and match-level analytics in a usable dashboard

## 5. Objectives

The project objectives are:

- process raw telemetry logs into consistent match JSON objects
- preserve event chronology via `elapsed_ms` and timestamps
- visualize player movement and combat events on a minimap
- support playback and heatmap overlays
- provide tables for per-player analytics
- enable a selection-driven Player Journey view
- summarize match-level insights from the current match data

## 6. Proposed Solution

The project uses a two-part architecture:

1. A Python data pipeline reconstructs match files from raw Parquet data and writes processed JSON to `processed_data/`.
2. A browser frontend reads the processed match JSON and renders the current match with the canvas, timeline, analytics, and insights panels.

This structure allows the project to maintain a clear separation between data processing and visualization while keeping the implementation grounded in the actual processed data.

## 7. System Architecture

```text
Player telemetry Parquet files
        ↓
Python processing (data_processor.py)
        ↓
Human/bot classification and event decoding
        ↓
World-to-minimap conversion
        ↓
Processed match JSON files
        ↓
Browser app (frontend/app.js)
        ↓
Map filters, match selection, timeline playback
        ↓
Canvas rendering and analytics panels
```

## 8. Dataset / Input Data

The project operates on datasets stored in `player_data/`, where each file represents a single player's telemetry for a single match. The documentation in `player_data/README.md` confirms that the data is stored in Parquet format, uses `.nakama-0` file naming, and contains gameplay rows with fields such as `user_id`, `match_id`, `map_id`, `x`, `y`, `z`, `ts`, and `event`.

The current processed dataset statistics confirmed from `processed_data/matches.json` are:

- 796 matches
- 89,104 total events
- 1,242 player entries in the processed summary
- 781 human entries
- 461 bot entries

## 9. Data Preprocessing

The Python preprocessing logic in `data_processor.py` does the following:

- scans all raw `.nakama-0` files
- reads each file with `pandas.read_parquet()`
- decodes event bytes to strings
- groups rows by `match_id`
- creates match dictionaries per session
- records player metadata and counts
- calculates per-event timestamps and `elapsed_ms`
- writes one JSON file per match and a combined index

The solution also includes auditing scripts such as `data_preprocessor.py` and `match_inspector.py`, which summarize total events, match structure, and high-level player counts.

## 10. Match Reconstruction

The project rebuilds full matches by grouping all telemetry rows for a shared `match_id`. The resulting object includes a `players` dictionary and `events` list.

The reconstruction step preserves chronology by sorting the events by timestamp and then computing `elapsed_ms` as the offset from the first event in the match.

The current processed data uses the match-level metadata fields:

- `start_timestamp`
- `end_timestamp`
- `duration_ms`
- `player_count`
- `human_count`
- `bot_count`
- `event_count`

## 11. Coordinate Transformation

The transformation from world coordinates to minimap coordinates is implemented in `data_processor.py` via `world_to_pixel(x, z, map_name)`.

The map configuration uses the actual values:

| Map | Scale | Origin X | Origin Z |
| --- | ---: | ---: | ---: |
| AmbroseValley | 900 | -370 | -473 |
| GrandRift | 581 | -290 | -290 |
| Lockdown | 1000 | -500 | -500 |

The mathematical formula is:

```python
u = (x - origin_x) / scale
v = (z - origin_z) / scale
pixel_x = u * 1024
pixel_y = (1 - v) * 1024
```

This mapping is later scaled to the browser canvas with `pixelX()` and `pixelY()` in `frontend/app.js`.

## 12. Visualization System

The frontend visualizes the match using a `canvas` element layered over the minimap image. The rendering pipeline is driven by:

- `drawVisualization()`
- `drawHeatmapOverlay()`
- `drawPlayerMarker()`
- `drawEventMarker()`

The canvas draws:

- player path lines for `Position` and `BotPosition`
- current position markers for each player
- event markers for kill, death, loot, and storm events
- heatmap overlays for traffic, kills, and deaths

The map view stays tied to the selected match and the current playback time.

## 13. Player Tracking

Player tracking is implemented by grouping visible `Position` and `BotPosition` events by `user_id`. The system then creates a path for each player and renders the latest point as the current marker for that user.

Selection is handled by storing a `selectedPlayerId` value in the frontend and using that when drawing the relevant path and marker. Non-selected players are dimmed to keep the selected player emphasized.

## 14. Event Visualization

The front-end renders event markers based on the event name. The actual event types currently present are:

- `Position`
- `BotPosition`
- `Kill`
- `BotKill`
- `Killed`
- `BotKilled`
- `KilledByStorm`
- `Loot`

Marker color logic in `drawEventMarker()` applies:

- yellow for loot
- orange/red for kill events
- purple for death events
- blue for storm deaths

Movement events are not drawn as a generic marker; they are used to build player paths instead.

## 15. Heatmap Analysis

The heatmap overlay is built from the `visibleEvents` set filtered by the current playback time. The code supports:

- `traffic` mode: `Position` + `BotPosition`
- `kills` mode: `Kill` + `BotKill`
- `deaths` mode: `Killed` + `BotKilled` + `KilledByStorm`

The implementation creates radial gradients at each coordinate and overlays them onto the canvas using `globalCompositeOperation = "screen"`.

## 16. Timeline Playback

The frontend uses a timeline range element and a playback loop to update `currentElapsed` over time. The key functions are:

- `startPlayback()`
- `stopPlayback()`
- `getMatchDurationMs()`
- `getEventElapsedMs()`

The timeline is directly tied to match event timing through `elapsed_ms`. Playback speed options are defined in the current code as `0.25x`, `0.5x`, `1x`, and `2x`.

## 17. Player Analytics

Player analytics are computed in `computePlayerAnalytics(match)`. The implementation currently calculates:

- player type
- total event count
- kills
- deaths
- loot
- distance
- average speed over the player's movement window

Distance is calculated from consecutive movement events using Euclidean distance, and speed is based on the time difference between the first and last movement event for that player.

## 18. Player Journey

The selected player journey is generated in `renderPlayerJourney()`. The event list is filtered to `selectedPlayerId` and sorted by `elapsed_ms`. Each event row shows the event time and the event name; `Position` and `BotPosition` rows additionally show X/Z values.

This gives a readable timeline of that player's behavior within the currently selected match.

## 19. Match Insights

The match insights summary is created in `computeMatchInsights(match)` and `renderMatchInsights()`. The current implementation derives:

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

The most active area is approximated by aggregating movement coordinates into a 32×32 grid over `pixel_x` and `pixel_y` values.

## 20. Results

The processed dataset in the repository currently contains a large but realistic set of match telemetry with the following verified totals:

- 796 processed matches
- 89,104 total events
- 1,242 player entries in the index summary
- 781 human players
- 461 bot players

The distribution of event types is also confirmed to be dominated by movement and loot events, with combat events appearing at lower frequencies.

## 21. Limitations

The implementation has several inherent limitations:

- It depends on the raw telemetry available in `player_data/`.
- It is not a live telemetry stream or server-backed system.
- The minimap transformation is tied to the map configuration in `data_processor.py`.
- The visualization is event-based and does not interpolate continuous movement between recorded points.
- Large datasets can become dense on a browser canvas.

## 22. Future Scope

The following are reasonable future extensions, but they are not part of the current implementation:

- automated anomaly detection
- more advanced player behavior clustering
- additional match comparison views
- exportable analytics summaries
- database-backed storage for larger datasets
- richer map-zone analysis

## 23. Conclusion

The project demonstrates a complete pipeline from raw gameplay telemetry to interactive analysis. It reconstructs match sessions, normalizes event data, converts world coordinates to minimap coordinates, and provides a browser-based dashboard for movement inspection, timeline playback, analytics, and player selection.

The result is a practical and technically grounded telemetry visualization application that is tightly aligned with the actual code and processed data present in the repository.
