import pandas as pd
from pathlib import Path

DATA_DIR = Path("player_data")

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

IMAGE_SIZE = 1024

# Track coordinate statistics
stats = {
    map_name: {
        "rows": 0,
        "outside": 0,
        "min_px": float("inf"),
        "max_px": float("-inf"),
        "min_py": float("inf"),
        "max_py": float("-inf"),
    }
    for map_name in MAP_CONFIG
}

files = list(DATA_DIR.rglob("*.nakama-0"))

print("=" * 60)
print("COORDINATE VALIDATION")
print("=" * 60)

for i, file in enumerate(files, 1):

    df = pd.read_parquet(file)

    for map_name, config in MAP_CONFIG.items():

        mask = df["map_id"] == map_name

        if not mask.any():
            continue

        rows = df.loc[mask]

        x = rows["x"]
        z = rows["z"]

        # World → UV
        u = (x - config["origin_x"]) / config["scale"]
        v = (z - config["origin_z"]) / config["scale"]

        # UV → pixel
        pixel_x = u * IMAGE_SIZE
        pixel_y = (1 - v) * IMAGE_SIZE

        s = stats[map_name]

        s["rows"] += len(rows)

        s["min_px"] = min(s["min_px"], pixel_x.min())
        s["max_px"] = max(s["max_px"], pixel_x.max())
        s["min_py"] = min(s["min_py"], pixel_y.min())
        s["max_py"] = max(s["max_py"], pixel_y.max())

        outside = (
            (pixel_x < 0)
            | (pixel_x > IMAGE_SIZE)
            | (pixel_y < 0)
            | (pixel_y > IMAGE_SIZE)
        )

        s["outside"] += outside.sum()

    if i % 200 == 0:
        print(f"Processed {i}/{len(files)} files...")

print("\nRESULTS")
print("-" * 60)

for map_name, s in stats.items():

    if s["rows"] == 0:
        continue

    outside_pct = (s["outside"] / s["rows"]) * 100

    print(f"\n{map_name}")
    print(f"Rows:              {s['rows']:,}")
    print(f"Pixel X range:     {s['min_px']:.2f} → {s['max_px']:.2f}")
    print(f"Pixel Y range:     {s['min_py']:.2f} → {s['max_py']:.2f}")
    print(f"Outside map:       {s['outside']:,}")
    print(f"Outside percentage:{outside_pct:.4f}%")

print("\n" + "=" * 60)
print("COORDINATE VALIDATION COMPLETE")
print("=" * 60)