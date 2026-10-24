"""Compose LPC character sheets (walk | sit | idle) with palette recoloring."""
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

def layer(path, kind, color, anim):
    f = S / path / f"{anim}.png"
    if not f.exists():
        return None
    return recolor(Image.open(f), kind, color) if color else Image.open(f).convert("RGBA")

def build(spec):
    parts = []
    for anim, w in (("walk", 576), ("sit", 192), ("idle", 128)):
        canvas = Image.new("RGBA", (w, 256))
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
    sheet = Image.new("RGBA", (896, 256)); x = 0
    for p in parts:
        sheet.alpha_composite(p, (x, 0)); x += p.width
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
