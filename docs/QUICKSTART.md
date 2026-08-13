# LILA Player Journey — Quick Start

## Prerequisites

- Python 3 installed
- Access to the raw telemetry files in `player_data/`
- A local web server for the frontend

## 1) Process the raw data

From the project root:

```bash
python data_processor.py
```

This reads the Parquet files under `player_data/` and writes processed matches to:

- `processed_data/matches/`
- `processed_data/matches.json`

## 2) Start the frontend

From the project root:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/frontend/
```

The dashboard uses browser-side `fetch()` calls, so a local web server is the appropriate way to run it.

## 3) Use the dashboard

1. Select a map.
2. Select a date.
3. Select a match.
4. Review the minimap and active player traces.
5. Use the play button to start playback.
6. Reset the timeline when needed.
7. Toggle heatmap modes (`Off`, `Traffic`, `Kills`, `Deaths`).
8. Click a player row in the analytics table to highlight them.
9. Review the selected player's journey and the match insights summary.

## Common startup issues

- Raw data not found: confirm the files are present under `player_data/`.
- Blank dashboard: ensure the web server is running and the browser is loading `http://localhost:8000/frontend/`.
- Missing match list: run `python data_processor.py` first to generate the processed JSON files.
- Browser fetch errors: do not open the page only via local file access; use a local web server.

## Notes

- The application reads processed match JSON and not the raw Parquet files directly in the browser.
- The dataset is already included in the repository in processed form, but the Python processor can rebuild it if the raw telemetry is present.
