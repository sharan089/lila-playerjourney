import json
from pathlib import Path

import pandas as pd


# ============================================================
# CONFIGURATION
# ============================================================

DATA_DIR = Path("player_data")
OUTPUT_DIR = Path("processed_data")
MATCH_DIR = OUTPUT_DIR / "matches"

MAP_CONFIG = {
    "AmbroseValley": {
        "scale": 900,
        "origin_x": -370,
        "origin_z": -473,
    },
    "GrandRift": {
        "scale": 581,
        "origin_x": -290,
        "origin_z": -290,
    },
    "Lockdown": {
        "scale": 1000,
        "origin_x": -500,
        "origin_z": -500,
    },
}


# ============================================================
# CREATE OUTPUT DIRECTORIES
# ============================================================

OUTPUT_DIR.mkdir(exist_ok=True)
MATCH_DIR.mkdir(exist_ok=True)


# ============================================================
# WORLD → MINIMAP CONVERSION
# ============================================================

def world_to_pixel(x, z, map_name):
    """
    Convert game world coordinates (x, z)
    into 1024x1024 minimap pixel coordinates.
    """

    if map_name not in MAP_CONFIG:
        raise ValueError(f"Unknown map: {map_name}")

    config = MAP_CONFIG[map_name]

    u = (x - config["origin_x"]) / config["scale"]
    v = (z - config["origin_z"]) / config["scale"]

    pixel_x = u * 1024
    pixel_y = (1 - v) * 1024

    return pixel_x, pixel_y


# ============================================================
# EVENT DECODER
# ============================================================

def decode_event(event):
    """
    Convert byte events into normal strings.
    """

    if isinstance(event, bytes):
        return event.decode("utf-8", errors="replace")

    return str(event)


# ============================================================
# HUMAN / BOT DETECTION
# ============================================================

def is_bot(user_id):
    """
    Dataset specification:
    - UUID user_id = human
    - numeric user_id = bot
    """

    user_id = str(user_id)

    return user_id.isdigit()


# ============================================================
# FIND INPUT FILES
# ============================================================

files = list(DATA_DIR.rglob("*.nakama-0"))

print("=" * 70)
print("LILA DATA PROCESSOR")
print("=" * 70)

print(f"\nFound {len(files):,} Parquet files.")


# ============================================================
# STORAGE
# ============================================================

matches = {}


# ============================================================
# PROCESS FILES
# ============================================================

for index, file in enumerate(files, start=1):

    try:
        df = pd.read_parquet(file)

    except Exception as error:
        print(f"\nWARNING: Could not read {file}")
        print(error)
        continue

    if df.empty:
        continue

    # --------------------------------------------------------
    # Decode event bytes
    # --------------------------------------------------------

    df["event"] = df["event"].apply(decode_event)

    # --------------------------------------------------------
    # Process every row
    # --------------------------------------------------------

    for _, row in df.iterrows():

        match_id = str(row["match_id"])
        user_id = str(row["user_id"])
        map_name = str(row["map_id"])
        event = row["event"]

        # ----------------------------------------------------
        # Create match if we haven't seen it
        # ----------------------------------------------------

        if match_id not in matches:

            matches[match_id] = {
                "match_id": match_id,
                "map": map_name,
                "date": file.parent.name,
                "players": {},
                "events": [],
            }

        match = matches[match_id]

        # ----------------------------------------------------
        # Player information
        # ----------------------------------------------------

        if user_id not in match["players"]:

            match["players"][user_id] = {
                "user_id": user_id,
                "type": "bot" if is_bot(user_id) else "human",
                "events": 0,
            }

        match["players"][user_id]["events"] += 1

        # ----------------------------------------------------
        # Coordinates
        # ----------------------------------------------------

        x = float(row["x"])
        z = float(row["z"])

        pixel_x, pixel_y = world_to_pixel(
            x,
            z,
            map_name
        )

        # ----------------------------------------------------
        # Timestamp
        # ----------------------------------------------------

        timestamp = pd.Timestamp(row["ts"])

        # ----------------------------------------------------
        # Store event
        # ----------------------------------------------------

        match["events"].append({
            "user_id": user_id,
            "type": "bot" if is_bot(user_id) else "human",

            "event": event,

            "timestamp": timestamp.isoformat(),

            "x": x,
            "z": z,

            "pixel_x": round(pixel_x, 2),
            "pixel_y": round(pixel_y, 2),
        })

    # --------------------------------------------------------
    # Progress
    # --------------------------------------------------------

    if index % 100 == 0 or index == len(files):

        print(
            f"Processed {index:,}/{len(files):,} files..."
        )


# ============================================================
# SORT AND SAVE MATCHES
# ============================================================

print("\n" + "=" * 70)
print("WRITING PROCESSED MATCHES")
print("=" * 70)


match_index = []


for match_id, match in matches.items():

    # --------------------------------------------------------
    # Sort events chronologically
    # --------------------------------------------------------

    match["events"].sort(
        key=lambda event: event["timestamp"]
    )

    # --------------------------------------------------------
    # Timeline information
    # --------------------------------------------------------

    if match["events"]:

        start_timestamp = pd.Timestamp(
            match["events"][0]["timestamp"]
        )

        end_timestamp = pd.Timestamp(
            match["events"][-1]["timestamp"]
        )

        duration_ms = int(
            (end_timestamp - start_timestamp).total_seconds() * 1000
        )

        match["start_timestamp"] = start_timestamp.isoformat()
        match["end_timestamp"] = end_timestamp.isoformat()
        match["duration_ms"] = duration_ms

        # ----------------------------------------------------
        # Add elapsed time to every event
        # ----------------------------------------------------

        for event in match["events"]:

            event_timestamp = pd.Timestamp(
                event["timestamp"]
            )

            elapsed_ms = int(
                (
                    event_timestamp - start_timestamp
                ).total_seconds() * 1000
            )

            event["elapsed_ms"] = elapsed_ms

    else:

        match["start_timestamp"] = None
        match["end_timestamp"] = None
        match["duration_ms"] = 0

    # --------------------------------------------------------
    # Player list
    # --------------------------------------------------------

    player_list = list(
        match["players"].values()
    )

    humans = sum(
        1
        for player in player_list
        if player["type"] == "human"
    )

    bots = sum(
        1
        for player in player_list
        if player["type"] == "bot"
    )

    # Replace dictionary with cleaner list
    match["players"] = player_list

    match["player_count"] = len(player_list)
    match["human_count"] = humans
    match["bot_count"] = bots
    match["event_count"] = len(match["events"])

    # --------------------------------------------------------
    # Save individual match
    # --------------------------------------------------------

    safe_name = match_id.replace("/", "_")

    output_file = MATCH_DIR / f"{safe_name}.json"

    with open(
        output_file,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            match,
            f,
            indent=2
        )

    # --------------------------------------------------------
    # Add to index
    # --------------------------------------------------------

    match_index.append({
        "match_id": match_id,
        "map": match["map"],
        "date": match["date"],

        "players": match["player_count"],
        "humans": match["human_count"],
        "bots": match["bot_count"],

        "events": match["event_count"],

        "start_timestamp": match["start_timestamp"],
        "end_timestamp": match["end_timestamp"],
        "duration_ms": match["duration_ms"],
    })


# ============================================================
# SAVE MATCH INDEX
# ============================================================

match_index.sort(
    key=lambda match: (
        match["date"],
        match["match_id"]
    )
)


with open(
    OUTPUT_DIR / "matches.json",
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        match_index,
        f,
        indent=2
    )


# ============================================================
# FINAL SUMMARY
# ============================================================

total_events = sum(
    match["events"]
    for match in match_index
)

total_humans = sum(
    match["humans"]
    for match in match_index
)

total_bots = sum(
    match["bots"]
    for match in match_index
)


print("\n" + "=" * 70)
print("PROCESSING COMPLETE")
print("=" * 70)

print(f"\nMatches created:     {len(match_index):,}")
print(f"Total events:        {total_events:,}")
print(f"Human entries:       {total_humans:,}")
print(f"Bot entries:         {total_bots:,}")

print("\nOutput:")

print(
    f"  {OUTPUT_DIR / 'matches.json'}"
)

print(
    f"  {MATCH_DIR}"
)

print("\n" + "=" * 70)
print("READY FOR FRONTEND")
print("=" * 70)