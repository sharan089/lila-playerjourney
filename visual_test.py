import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path

DATA_DIR = Path("player_data")

# Ambrose Valley coordinate configuration
SCALE = 900
ORIGIN_X = -370
ORIGIN_Z = -473
IMAGE_SIZE = 1024

# Find minimap
minimap = next(
    DATA_DIR.rglob("AmbroseValley_Minimap.png")
)

# Find a gameplay file containing Ambrose Valley
files = list(DATA_DIR.rglob("*.nakama-0"))

sample = None

for file in files:
    df = pd.read_parquet(file)

    # Decode event column
    df["event"] = df["event"].apply(
        lambda x: x.decode("utf-8") if isinstance(x, bytes) else str(x)
    )

    rows = df[
        (df["map_id"] == "AmbroseValley") &
        (df["event"] == "Position")
    ]

    if len(rows) > 0:
        sample = rows.head(1000).copy()
        print(f"Using data from: {file}")
        break

if sample is None:
    raise RuntimeError("No Ambrose Valley Position events found.")

# --------------------------------------------------
# WORLD COORDINATES → MINIMAP PIXELS
# --------------------------------------------------

u = (sample["x"] - ORIGIN_X) / SCALE
v = (sample["z"] - ORIGIN_Z) / SCALE

sample["pixel_x"] = u * IMAGE_SIZE
sample["pixel_y"] = (1 - v) * IMAGE_SIZE

# --------------------------------------------------
# LOAD MINIMAP
# --------------------------------------------------

image = plt.imread(str(minimap))

# --------------------------------------------------
# DRAW
# --------------------------------------------------

plt.figure(figsize=(10, 10))

plt.imshow(
    image,
    extent=[0, IMAGE_SIZE, IMAGE_SIZE, 0]
)

plt.scatter(
    sample["pixel_x"],
    sample["pixel_y"],
    s=8,
    alpha=0.5,
    color = "red"
)

plt.xlim(0, IMAGE_SIZE)
plt.ylim(IMAGE_SIZE, 0)

plt.title("Ambrose Valley - Coordinate Validation")
plt.xlabel("Minimap X")
plt.ylabel("Minimap Y")

# Save result
output = "coordinate_validation.png"

plt.savefig(
    output,
    dpi=150,
    bbox_inches="tight"
)

plt.close()

print(f"\nCreated: {output}")
print(f"Plotted {len(sample)} player positions.")