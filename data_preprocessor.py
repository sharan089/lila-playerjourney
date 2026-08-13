import pandas as pd
from pathlib import Path
from collections import Counter

DATA_DIR = Path("player_data")

files = list(DATA_DIR.rglob("*.nakama-0"))

print("=" * 60)
print("LILA BLACK - DATASET AUDIT")
print("=" * 60)

print(f"\nTotal gameplay files: {len(files)}")

all_events = Counter()
all_maps = Counter()
all_matches = set()
all_players = set()
human_players = set()
bot_players = set()

total_rows = 0

for i, file in enumerate(files, 1):

    try:
        df = pd.read_parquet(file)

        total_rows += len(df)

        # Decode event bytes
        events = df["event"].apply(
            lambda x: x.decode("utf-8") if isinstance(x, bytes) else str(x)
        )

        all_events.update(events)

        all_maps.update(df["map_id"].dropna())

        all_matches.update(df["match_id"].dropna())

        all_players.update(df["user_id"].dropna())

        # Human vs bot based on user_id
        for user_id in df["user_id"].dropna().unique():

            user_id = str(user_id)

            if "-" in user_id:
                human_players.add(user_id)
            else:
                bot_players.add(user_id)

    except Exception as e:
        print(f"\nERROR reading {file}: {e}")

    if i % 100 == 0:
        print(f"Processed {i}/{len(files)} files...")

print("\n" + "=" * 60)
print("RESULTS")
print("=" * 60)

print(f"\nTotal files:          {len(files):,}")
print(f"Total event rows:     {total_rows:,}")

print(f"\nUnique players/bots:   {len(all_players):,}")
print(f"Human players:         {len(human_players):,}")
print(f"Bot IDs:               {len(bot_players):,}")

print(f"\nUnique matches:        {len(all_matches):,}")

print("\nMAP DISTRIBUTION")
print("-" * 30)

for map_name, count in all_maps.most_common():
    print(f"{map_name:<20} {count:,}")

print("\nEVENT DISTRIBUTION")
print("-" * 30)

for event, count in all_events.most_common():
    print(f"{event:<20} {count:,}")

print("\n" + "=" * 60)
print("AUDIT COMPLETE")
print("=" * 60)