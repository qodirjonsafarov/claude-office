"""Compose LPC character sheets with palette recoloring.

Sheet layout (x offsets, every animation has 4 rows: up, left, down, right):
    0     walk       (9 frames)
    576   sit        (3)
    768   idle       (2)
    896   typing     (2, left empty here; see make_typing_frames.py)
    1024  emote      (3)
    1216  spellcast  (7)  - talking / gesturing / waving
    1664  thrust     (8)  - handing something over
    2176  blink      (2: idle frame 0 and the chair sit frame, eyes closed)

After running this, run scripts/make_typing_frames.py to fill in the
typing frames.

Usage: python scripts/compose_lpc_people.py <lpc-generator-checkout> <out-dir>
"""
import json, sys
from pathlib import Path
from PIL import Image

LPC = Path(sys.argv[1]); OUT = Path(sys.argv[2])
S = LPC / "dl/spritesheets"
pal = {k: json.load(open(LPC / f"pal/{k}/{k}_ulpc.json")) for k in ["body", "cloth", "hair", "eye"]}
BASE = {"body": "light", "cloth": "white", "hair": "orange", "eye": "blue"}

def hexrgb(h): h = h.lstrip("#"); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def recolor(img, kind, target):
    src = [hexrgb(c) for c in pal[kind][BASE[kind]]]
    dst = [hexrgb(c) for c in pal[kind][target]]
    mapping = dict(zip(src, dst))
    img = img.convert("RGBA"); px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a and (r, g, b) in mapping:
                px[x, y] = (*mapping[(r, g, b)], a)
    return img

# (animation, width); None = typing slot, filled by make_typing_frames.py
ANIMS = (
    ("walk", 576), ("sit", 192), ("idle", 128), (None, 128),
    ("emote", 192), ("spellcast", 448), ("thrust", 512),
)
FRAME = 64
# Blink frames: (animation, frame index) drawn again with closed eyes
BLINKS = (("idle", 0), ("sit", 2))
SHEET_WIDTH = sum(w for _, w in ANIMS) + len(BLINKS) * FRAME
EYES = "eyes/human/adult/default"
LASH = (39, 25, 32, 255)  # the head outline color

def close_eyes(frame, eyes):
    """Paint the eyes shut: skin over each eye, a dark lash line at the bottom.

    `eyes` is the eye layer of the same frame; its pixels mark where the eyes
    are. Only the sprite's own colors are used (skin and outline).
    """
    out = frame.copy()
    cols = sorted({x for x in range(FRAME) for y in range(FRAME) if eyes.getpixel((x, y))[3]})
    # Split into one blob per eye (columns next to each other)
    blobs, run = [], []
    for x in cols:
        if run and x != run[-1] + 1:
            blobs.append(run); run = []
        run.append(x)
    if run:
        blobs.append(run)
    for blob in blobs:
        ys = [y for y in range(FRAME) for x in blob if eyes.getpixel((x, y))[3]]
        y0, y1 = min(ys), max(ys)
        skin = frame.getpixel((blob[len(blob) // 2], y1 + 2))
        for x in blob:
            for y in range(y0, y1):
                out.putpixel((x, y), skin)
            out.putpixel((x, y1), LASH)
    return out

def layer(path, kind, color, anim):
    f = S / path / f"{anim}.png"
    if not f.exists():
        return None
    return recolor(Image.open(f), kind, color) if color else Image.open(f).convert("RGBA")

def build(spec):
    parts = []
    for anim, w in ANIMS:
        canvas = Image.new("RGBA", (w, 256))
        if anim is None:
            parts.append(canvas)
            continue
        for path, kind, color in [
            ("body/bodies/male", "body", spec["skin"]),
            ("head/heads/human/male", "body", spec["skin"]),
            ("eyes/human/adult/default", "eye", spec["eyes"]),
            ("feet/shoes/basic/male", "cloth", spec["shoes"]),
            ("legs/pants/male", "cloth", spec["pants"]),
            ("torso/clothes/longsleeve/longsleeve2_polo/male", "cloth", spec["shirt"]),
            (f"hair/{spec['hair']}/adult", "hair", spec["hair_color"]),
        ]:
            im = layer(path, kind, color, anim)
            if im is not None:
                canvas.alpha_composite(im)
        parts.append(canvas)
    sheet = Image.new("RGBA", (SHEET_WIDTH, 256)); x = 0
    offsets = {}
    for (anim, _), p in zip(ANIMS, parts):
        offsets[anim] = x
        sheet.alpha_composite(p, (x, 0)); x += p.width
    for anim, index in BLINKS:
        eyes = layer(EYES, "eye", spec["eyes"], anim)
        for row in range(4):
            fx, fy = offsets[anim] + index * FRAME, row * FRAME
            frame = sheet.crop((fx, fy, fx + FRAME, fy + FRAME))
            mask = eyes.crop((index * FRAME, fy, (index + 1) * FRAME, fy + FRAME))
            sheet.alpha_composite(close_eyes(frame, mask), (x, fy))
        x += FRAME
    return sheet

SPECS = {
    "blue":   dict(shirt="blue",   pants="charcoal", shoes="black", skin="light",  hair="parted",       hair_color="dark_brown", eyes="brown"),
    "green":  dict(shirt="green",  pants="navy",     shoes="brown", skin="olive",  hair="buzzcut",      hair_color="black",      eyes="brown"),
    "purple": dict(shirt="purple", pants="charcoal", shoes="black", skin="amber",  hair="curly_short",  hair_color="raven",      eyes="green"),
    "orange": dict(shirt="orange", pants="slate",    shoes="black", skin="amber",  hair="curly_short",  hair_color="dark_brown", eyes="brown"),
    "pink":   dict(shirt="pink",   pants="gray",     shoes="brown", skin="taupe",  hair="swoop",        hair_color="chestnut",   eyes="brown"),
    "teal":   dict(shirt="teal",   pants="charcoal", shoes="black", skin="bronze", hair="messy1",       hair_color="black",      eyes="brown"),
    "yellow": dict(shirt="yellow", pants="navy",     shoes="brown", skin="light",  hair="bedhead",      hair_color="blonde",     eyes="blue"),
    "red":    dict(shirt="red",    pants="charcoal", shoes="black", skin="olive",  hair="plain",        hair_color="dark_brown", eyes="gray"),
    # Claude (the boss): the ginger guy in orange
    "boss":   dict(shirt="orange", pants="slate",    shoes="black", skin="light",  hair="spiked",       hair_color="ginger",     eyes="blue"),
}
OUT.mkdir(parents=True, exist_ok=True)
for name, spec in SPECS.items():
    build(spec).save(OUT / f"{name}.png", optimize=True)
    print("built", name)
