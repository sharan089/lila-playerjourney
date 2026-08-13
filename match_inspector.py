import pandas as pd
from pathlib import Path

DATA_DIR = Path("player_data")

files = list(DATA_DIR.rglob("*.nakama-0"))

print("=" * 70)
print("MATCH STRUCTURE ANALYSIS")
print("=" * 70)

match_stats = {}

for i, file in enumerate(files, 1):

    df = pd.read_parquet(file)

    # Decode events
    df["event"] = df["event"].apply(
        lambda x: x.decode("utf-8")
        if isinstance(x, bytes)
        else str(x)
    )

    for match_id, group in df.groupby("match_id"):

        if match_id not in match_stats:
            match_stats[match_id] = {
                "events": 0,
                "players": set(),
                "files": set(),
                "map": set(),
                "start": None,
                "end": None,
            }

        stats = match_stats[match_id]

        stats["events"] += len(group)

        stats["players"].update(
            group["user_id"].dropna().astype(str)
        )

        stats["files"].add(str(file))

        stats["map"].update(
            group["map_id"].dropna().astype(str)
        )

        start = group["ts"].min()
        end = group["ts"].max()

        if stats["start"] is None or start < stats["start"]:
            stats["start"] = start

        if stats["end"] is None or end > stats["end"]:
            stats["end"] = end

    if i % 200 == 0:
        print(f"Processed {i}/{len(files)} files...")


# --------------------------------------------------
# FIND LARGEST MATCHES
# --------------------------------------------------

sorted_matches = sorted(
    match_stats.items(),
    key=lambda item: item[1]["events"],
    reverse=True
)

print("\n" + "=" * 70)
print("TOP 10 MATCHES BY EVENT COUNT")
print("=" * 70)

for rank, (match_id, stats) in enumerate(
    sorted_matches[:10],
    start=1
):

    duration = stats["end"] - stats["start"]

    print(f"\n#{rank}")
    print(f"Match ID:      {match_id}")
    print(f"Map:            {', '.join(stats['map'])}")
    print(f"Events:         {stats['events']:,}")
    print(f"Players/Bots:   {len(stats['players']):,}")
    print(f"Files:          {len(stats['files']):,}")
    print(f"Start:          {stats['start']}")
    print(f"End:            {stats['end']}")
    print(f"Duration:       {duration}")


# --------------------------------------------------
# SUMMARY
# --------------------------------------------------

print("\n" + "=" * 70)
print("MATCH STRUCTURE SUMMARY")
print("=" * 70)

event_counts = [
    stats["events"]
    for stats in match_stats.values()
]

player_counts = [
    len(stats["players"])
    for stats in match_stats.values()
]

file_counts = [
    len(stats["files"])
    for stats in match_stats.values()
]

print(f"\nUnique match IDs:       {len(match_stats):,}")
print(f"Largest match events:   {max(event_counts):,}")
print(f"Smallest match events:  {min(event_counts):,}")
print(
    f"Average events/match:   "
    f"{sum(event_counts) / len(event_counts):,.1f}"
)

print(
    f"\nLargest players/match:  "
    f"{max(player_counts):,}"
)

print(
    f"Average players/match:  "
    f"{sum(player_counts) / len(player_counts):,.1f}"
)

print(
    f"\nLargest files/match:    "
    f"{max(file_counts):,}"
)

print(
    f"Average files/match:    "
    f"{sum(file_counts) / len(file_counts):,.2f}"
)

print("\n" + "=" * 70)
print("ANALYSIS COMPLETE")
print("=" * 70)