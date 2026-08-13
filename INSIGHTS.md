# Insight 1 — AmbroseValley is the dominant play space

## What caught our attention

The telemetry is heavily concentrated on one map: AmbroseValley. It is not just the most common map in the dataset; it also contains the bulk of the movement and event traffic.

## Evidence

Across the current processed dataset:

- 566 of 796 matches are on AmbroseValley (71.1%)
- 61,013 of 89,104 total events are on AmbroseValley (68.5%)
- 48,754 of 73,059 movement events (`Position` + `BotPosition`) are on AmbroseValley (66.7%)

It also contains the most loot and combat data:

- 9,955 loot events on AmbroseValley
- 1,799 bot-kill and kill events combined on AmbroseValley
- 505 death and storm-death events combined on AmbroseValley

## Actionable implication

A Level Designer tuning map flow, POI density, fight pacing, or loot placement should prioritize AmbroseValley before making broad changes elsewhere. If the goal is to rebalance player behavior, the biggest measurable effect will likely come from the AmbroseValley loop rather than the smaller maps.

## Why a Level Designer should care

The game’s long-tail design is dominated by one environment. If one map absorbs most of the play and most of the activity, then map-specific loops, routes, and loot pacing are likely more important than cross-map balancing.

---

# Insight 2 — Loot activity is far larger than combat activity

## What caught our attention

Loot is the most common discrete event by a wide margin. It occurs much more often than kills, deaths, and storm deaths combined.

## Evidence

Current processed totals:

- `Loot`: 12,885
- `Kill` + `BotKill`: 2,418
- `Killed` + `BotKilled` + `KilledByStorm`: 742
- Combined combat/death/storm total: 3,160

This means:

- loot events are 12,885 total
- loot is approximately 4.1x the combined kill/death/storm event volume
- the loot total is also much larger than the recorded combat output on every map

By map:

- AmbroseValley: 9,955 loot events
- Lockdown: 2,050 loot events
- GrandRift: 880 loot events

## Actionable implication

The data strongly suggests that item pickup rhythm and route density are more central to the gameplay loop than fight outcomes alone. A Level Designer can use loot density as a pacing lever: if the intent is to encourage more movement or more contested routes, adjusting drops or high-value loot locations will have more measurable effect than combat-only tuning.

## Why a Level Designer should care

A large amount of player time is spent moving through the space and collecting items. If loot conflicts or loot placement are not aligned with routes, players may be over- or under-encountering the intended objectives. The telemetry makes it clear that loot is a primary behavior driver.

---

# Insight 3 — Movement concentrates around recurring route hotspots

## What caught our attention

Movement is not evenly distributed across the map. A small number of 32×32 grid cells repeatedly accumulate a notable share of recorded position samples, which is consistent with recurring routes or route intersections rather than broad random exploration.

## Evidence

Across all movement events (`Position` + `BotPosition`):

- total movement events: 73,059
- top 5 grid cells: 4,025
- densest overall cell: `(13, 15)` with 888 movement events

Map-specific examples:

- AmbroseValley top cell: `(13, 15)` with 834 movement events
- Lockdown top cell: `(6, 19)` with 419 movement events
- GrandRift top cell: `(16, 17)` with 116 movement events

This pattern indicates repeated use of a limited set of locations across the match data, without claiming any broader statistical dominance beyond the observed telemetry.

## Actionable implication

A Level Designer can use the heatmap to prioritize layout tuning around the highest-density cells. If a location is repeatedly traversed, it is a strong candidate for route control, cover placement, or event pacing improvement. The metric to watch after a change is the number of movement traces entering that cell and any resulting change in kill or death concentration there.

## Why a Level Designer should care

Recurring route hotspots reveal where players are most likely to pass through, contest space, or stage encounters. These are practical targets for route design, cover placement, and engagement timing because they capture repeated player behavior in the current telemetry.

---

## Methodology

These insights were derived from the current processed match data in `processed_data/matches.json` and the per-match JSON files under `processed_data/matches/`.

The analysis used:

- match counts by map and date
- event totals by type and map
- movement-event aggregation using the existing `pixel_x`/`pixel_y` coordinates
- 32×32 grid binning to approximate route density and heat concentration

Limitations:

- The dataset is event-based rather than continuous simulation data.
- The movement density is based on recorded telemetry points, not every frame of player motion.
- These are aggregate patterns across the current processed dataset and should be treated as design signals, not perfect live player modeling.
