from pathlib import Path

from PIL import Image

source = Path("/home/ubuntu/upload/ChatGPTImageAug22,2026,05_25_25PM.png")
targets = [
    Path("/home/ubuntu/quizsprint/assets/images/icon.png"),
    Path("/home/ubuntu/quizsprint/assets/images/splash-icon.png"),
    Path("/home/ubuntu/quizsprint/assets/images/favicon.png"),
    Path("/home/ubuntu/quizsprint/assets/images/android-icon-foreground.png"),
]

with Image.open(source) as image:
    prepared = image.convert("RGB")
    prepared.thumbnail((512, 512), Image.Resampling.LANCZOS)
    for target in targets:
        prepared.save(target, format="PNG", optimize=True, compress_level=9)
        print(f"Wrote {target.name}: {target.stat().st_size} bytes")
