"""Compose the LPC office people sheets (one look per role) with palette recoloring.

Every person is built from layers of the Universal LPC Spritesheet Character
Generator (body, head, eyes, clothes, hair, beard, glasses, tie), recolored
with the LPC palettes. Only the sprites' own pixels are used: no hand-drawn
overlays. Each look also gets an "-alt" sheet (other skin and hair, same
outfit) for a second agent with the same role.

Sheet layout (x offsets, every animation has 4 rows: up, left, down, right):
    0     walk       (9 frames)
    576   sit        (3)
    768   idle       (2)
    896   typing     (2, seated with the left / right hand on a key)
    1024  emote      (3)
    1216  spellcast  (7)  - talking / gesturing / waving
    1664  thrust     (8)  - handing something over
    2176  blink      (2: idle frame 0 and the chair sit frame, eyes closed)
    2304  sleep      (1: seated, head bowed 2px, eyes closed - resting / dozing)
    2368  read       (1: seated, head bowed 1px - reading at the desk)

Order matters:
  1. layers are composed in LPC z order, split into "under" (up to the eyes)
     and "over" (beard, glasses, hair), so blinking closes the eyes before
     glasses and hair go on top;
  2. typing frames come from the finished seated frame;
  3. the soft 1px outline goes on last (lime for the boss).

Usage:
    python scripts/compose_lpc_people.py <lpc-checkout> <out-dir> [--credits]

<lpc-checkout> needs spritesheets/, palette_definitions/ and
sheet_definitions/ of the LPC generator repository (and CREDITS.csv for
--credits, which rewrites <out-dir>/CREDITS.txt for exactly the files used).
"""
import colorsys
import csv
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from make_typing_frames import typing_frame  # noqa: E402

FRAME = 64
# (animation, width); None = typing slot, filled from the sit frame
ANIMS = (
    ("walk", 576), ("sit", 192), ("idle", 128), (None, 128),
    ("emote", 192), ("spellcast", 448), ("thrust", 512),
)
SIT_CHAIR_FRAME = 2
# Blink frames: (animation, frame index) drawn again with closed eyes
BLINKS = (("idle", 0), ("sit", SIT_CHAIR_FRAME))
# Seated poses with the head group (head, eyes, hair, beard, glasses) moved
# down: (dy px, eyes closed)
BOWED = ((2, True), (1, False))
HEAD_PATHS = ("head/", "eyes/", "hair/", "beards/", "facial/")
SHEET_WIDTH = sum(w for _, w in ANIMS) + (len(BLINKS) + len(BOWED)) * FRAME
TYPING_X = 896
LASH = (39, 25, 32, 255)  # the head outline color
EYES_Z = 105  # layers above this (beard, glasses, hair) go on after blinking

RIM_LIGHT = (232, 255, 214, 70)  # soft light rim for the dark Olymp office
RIM_BOSS = (167, 243, 106, 150)  # Olymp lime (#a7f36a) for the boss

# Palette each LPC layer is drawn in, before recoloring
BASE = {"body": "light", "cloth": "white", "hair": "orange", "eye": "blue"}
# Eye pixels in the sheets are a few levels off the eye palette: match nearest
TOLERANCE = {"eye": 10}

# The eye overlay has no sheet definition of its own (it comes with the heads)
EYES_LAYER = {"name": "eyes", "layer_1": {"zPos": EYES_Z, "male": "eyes/human/adult/default/",
                                          "female": "eyes/human/adult/default/"},
              "recolors": {"material": "eye"}}
EYES_CREDIT = (
    "eyes/human/adult/default/{anim}.png",
    "eye overlay split out of the LPC human heads by JaidynReiman (generator PR #140)",
    "JaidynReiman,bluecarrot16,Benjamin K. Smith (BenCreating),Stephen Challener (Redshrike)",
    "OGA-BY 3.0,CC-BY-SA 3.0,GPL 3.0",
    "https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/pull/140,"
    "https://opengameart.org/content/lpc-character-bases",
)
CREDITS_HEADER = (
    "Office worker sprites are composed from the Universal LPC Spritesheet Character Generator\n"
    "https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator\n"
    "Licenses: see the \"licenses\" column (CC0, CC-BY 3.0/4.0, CC-BY-SA 3.0, GPL 2.0/3.0, OGA-BY 3.0). "
    "Derived sheets keep the same licenses.\n\n"
)


def person(body, skin, eyes, hair, hair_color, torso, shirt, legs, pants, shoes,
           shoe_color, extra=(), rim=RIM_LIGHT):
    head = "heads_human_female" if body == "female" else "heads_human_male"
    return {
        "body": body,
        "rim": rim,
        "layers": [
            ("body", skin), (head, (skin, eyes)), ("eyes", eyes),
            (shoes, shoe_color), (legs, pants), (torso, shirt),
            *extra, (f"hair_{hair}", hair_color),
        ],
    }


# One look per role; the file names are the sheet keys the frontend uses
# (frontend/src/systems/agentLooks.ts maps agent types to them).
LOOKS = {
    # Claude: ginger, orange cardigan, lime tie, beard
    "boss": person("male", "light", "blue", "spiked", "ginger",
                   "torso_clothes_longsleeve2_cardigan", "orange",
                   "legs_pants", "charcoal", "feet_shoes_basic", "black",
                   extra=[("neck_necktie", "lime"), ("beards_trimmed", "ginger")],
                   rim=RIM_BOSS),
    # developer
    "blue": person("male", "taupe", "brown", "messy2", "dark_brown",
                   "torso_clothes_longsleeve2", "blue",
                   "legs_pants2", "navy", "feet_shoes_revised", "lime",
                   extra=[("facial_glasses_round", None)]),
    # Explore
    "green": person("female", "olive", "brown", "high_ponytail", "black",
                    "torso_clothes_longsleeve2_cardigan", "green",
                    "legs_pants", "charcoal", "feet_shoes_revised", "white"),
    # qa
    "purple": person("female", "amber", "green", "bob_side_part", "raven",
                     "torso_clothes_tshirt_vneck", "purple",
                     "legs_cuffed", "slate", "feet_shoes_basic", "black",
                     extra=[("facial_glasses_secretary", None)]),
    # general-purpose
    "orange": person("male", "brown", "brown", "afro", "black",
                     "torso_clothes_tshirt", "orange",
                     "legs_pants2", "navy", "feet_shoes_revised", "lime",
                     extra=[("beards_trimmed", "black")]),
    # Plan
    "pink": person("female", "light", "blue", "wavy", "chestnut",
                   "torso_clothes_longsleeve2_scoop", "pink",
                   "legs_pants", "gray", "feet_shoes_basic", "brown"),
    # devops
    "teal": person("male", "bronze", "brown", "flat_top_fade", "black",
                   "torso_clothes_shortsleeve_polo", "teal",
                   "legs_cuffed", "charcoal", "feet_shoes_revised", "white"),
    # reviewer
    "yellow": person("male", "light", "gray", "curtains", "blonde",
                     "torso_clothes_longsleeve2_buttoned", "yellow",
                     "legs_pants", "navy", "feet_shoes_basic", "brown",
                     extra=[("neck_bowtie", "navy"), ("facial_glasses_nerd", None)]),
    # claude / others
    "red": person("male", "black", "brown", "twists_fade", "black",
                  "torso_clothes_longsleeve2_vneck", "red",
                  "legs_pants2", "charcoal", "feet_shoes_revised", "lime"),
}

# Second agent with the same role: same outfit, a different person
ALT = {
    "blue": {"skin": "light", "hair": "sandy"},
    "green": {"skin": "light", "hair": "redhead"},
    "purple": {"skin": "bronze", "hair": "platinum"},
    "orange": {"skin": "olive", "hair": "dark_brown"},
    "pink": {"skin": "brown", "hair": "black"},
    "teal": {"skin": "light", "hair": "light_brown"},
    "yellow": {"skin": "amber", "hair": "dark_brown"},
    "red": {"skin": "taupe", "hair": "chestnut"},
}


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


class Lpc:
    """Layers, palettes and credits of a local LPC generator checkout."""

    def __init__(self, root: Path):
        self.root = root
        self.sheets = root / "spritesheets"
        self.pal = {
            k: json.load(open(root / "palette_definitions" / k / f"{k}_ulpc.json"))
            for k in BASE
        }
        self.pal["cloth"]["lime"] = self._lime_ramp()
        self.defs = {p.stem: p for p in (root / "sheet_definitions").rglob("*.json")}
        self.used: set[str] = set()

    def _lime_ramp(self):
        """Cloth ramp in the Olymp lime with the lightness steps of "white"."""
        hue = colorsys.rgb_to_hls(*[v / 255 for v in hexrgb("#a7f36a")])[0]
        ramp = []
        for r, g, b in (hexrgb(c) for c in self.pal["cloth"]["white"]):
            light = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)[1]
            rr, gg, bb = colorsys.hls_to_rgb(hue, max(0.12, min(0.82, light * 0.78)), 0.82)
            ramp.append("#%02x%02x%02x" % (int(rr * 255), int(gg * 255), int(bb * 255)))
        return ramp

    def definition(self, name):
        if name == "eyes":
            return EYES_LAYER
        return json.load(open(self.defs[name]))

    def layers(self, name, body, color):
        d = self.definition(name)
        rec = d.get("recolors", {})
        kind = rec.get("material") or rec.get("color_1", {}).get("material")
        return [(v["zPos"], v[body], kind, color)
                for k, v in d.items()
                if k.startswith("layer_") and isinstance(v, dict) and body in v]

    def base_palette(self, img, kind):
        cols = {p[:3] for p in img.getdata() if p[3]}

        def score(name):
            return (len(cols & {hexrgb(c) for c in self.pal[kind][name]}), name == BASE[kind])

        best = max(self.pal[kind], key=score)
        if cols and score(best)[0] < len(cols) * 0.6:
            print(f"WARN {kind}: only {score(best)[0]}/{len(cols)} colors in palette {best}")
        return best

    def recolor(self, img, kind, target):
        base = BASE[kind] if kind == "eye" else self.base_palette(img, kind)
        src = [hexrgb(c) for c in self.pal[kind][base]]
        mapping = dict(zip(src, [hexrgb(c) for c in self.pal[kind][target]]))
        tol = TOLERANCE.get(kind, 0)
        px = img.load()
        cache = {}
        for y in range(img.height):
            for x in range(img.width):
                r, g, b, a = px[x, y]
                if not a:
                    continue
                key = (r, g, b)
                if key not in cache:
                    hit = mapping.get(key)
                    if hit is None and tol:
                        near = min(src, key=lambda c: sum(abs(c[i] - key[i]) for i in range(3)))
                        if all(abs(near[i] - key[i]) <= tol for i in range(3)):
                            hit = mapping[near]
                    cache[key] = hit
                if cache[key]:
                    px[x, y] = (*cache[key], a)
        return img

    def load(self, path, anim, kind, color):
        rel = f"{path}{anim}.png"
        f = self.sheets / rel
        if not f.exists():
            raise SystemExit(f"missing LPC file: {rel}")
        self.used.add(rel)
        img = Image.open(f).convert("RGBA")
        if isinstance(color, tuple):  # head: (skin, eyes)
            return self.recolor(self.recolor(img, "body", color[0]), "eye", color[1])
        if kind and color:
            return self.recolor(img, kind, color)
        return img


def compose(lpc, spec, anim, width, head_dy=0):
    """(under, over, eyes) images of one animation, split at the eyes layer.

    `head_dy` moves the head group (head, eyes, hair, beard, glasses) down,
    for a bowed head; the body stays where it is.
    """
    under = Image.new("RGBA", (width, 4 * FRAME))
    over = Image.new("RGBA", (width, 4 * FRAME))
    eyes = None
    layers = [layer for name, color in spec["layers"]
              for layer in lpc.layers(name, spec["body"], color)]
    for z, path, kind, color in sorted(layers, key=lambda t: t[0]):
        img = lpc.load(path, anim, kind, color)
        if img.size != under.size:
            raise SystemExit(f"{path}{anim}: size {img.size}, expected {under.size}")
        dy = head_dy if path.startswith(HEAD_PATHS) else 0
        (under if z <= EYES_Z else over).alpha_composite(img, (0, dy))
        if path.startswith("eyes/"):
            eyes = Image.new("RGBA", img.size)
            eyes.alpha_composite(img, (0, dy))
    return under, over, eyes


def close_eyes(frame, eyes):
    """Paint the eyes shut: skin over each eye, a dark lash line at the bottom.

    `eyes` is the eye layer of the same frame; its pixels mark where the eyes
    are. Only the sprite's own colors are used (skin and outline).
    """
    out = frame.copy()
    cols = sorted({x for x in range(FRAME) for y in range(FRAME) if eyes.getpixel((x, y))[3]})
    blobs, run = [], []
    for x in cols:
        if run and x != run[-1] + 1:
            blobs.append(run)
            run = []
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


def outline(sheet, rim):
    """Soft 1px rim outside the silhouette (never on the sprite's pixels)."""
    src = sheet.load()
    out = sheet.copy()
    dst = out.load()
    w, h = sheet.size
    for y in range(h):
        for x in range(w):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                # Stay inside the 64x64 cell
                if nx // FRAME != x // FRAME or ny // FRAME != y // FRAME:
                    continue
                if 0 <= nx < w and 0 <= ny < h and src[nx, ny][3] > 128:
                    dst[x, y] = rim
                    break
    return out


def build(lpc, spec):
    sheet = Image.new("RGBA", (SHEET_WIDTH, 4 * FRAME))
    parts, x = {}, 0
    for anim, width in ANIMS:
        if anim is not None:
            parts[anim] = (x, *compose(lpc, spec, anim, width))
            sheet.alpha_composite(parts[anim][1], (x, 0))
            sheet.alpha_composite(parts[anim][2], (x, 0))
        x += width
    # Typing: from the finished seated frame (scripts/make_typing_frames.py)
    sit_x = parts["sit"][0] + SIT_CHAIR_FRAME * FRAME
    for row in range(4):
        y = row * FRAME
        sit = sheet.crop((sit_x, y, sit_x + FRAME, y + FRAME))
        for i, hand in enumerate(("left", "right")):
            sheet.alpha_composite(typing_frame(sit, hand), (TYPING_X + i * FRAME, y))
    # Blink: close the eyes on the "under" layers, then glasses and hair
    for anim, index in BLINKS:
        _, under, over, eyes = parts[anim]
        for row in range(4):
            box = (index * FRAME, row * FRAME, (index + 1) * FRAME, (row + 1) * FRAME)
            frame = close_eyes(under.crop(box), eyes.crop(box))
            frame.alpha_composite(over.crop(box))
            sheet.alpha_composite(frame, (x, row * FRAME))
        x += FRAME
    # Bowed seated poses: sleeping (eyes closed) and reading
    for dy, closed in BOWED:
        _, under, over, eyes = (None, *compose(lpc, spec, "sit", 192, head_dy=dy))
        for row in range(4):
            box = (SIT_CHAIR_FRAME * FRAME, row * FRAME,
                   (SIT_CHAIR_FRAME + 1) * FRAME, (row + 1) * FRAME)
            frame = under.crop(box)
            if closed:
                frame = close_eyes(frame, eyes.crop(box))
            frame.alpha_composite(over.crop(box))
            sheet.alpha_composite(frame, (x, row * FRAME))
        x += FRAME
    return outline(sheet, spec["rim"])


def with_alt(spec, alt):
    """Same outfit, different skin and hair color."""
    layers = []
    for name, color in spec["layers"]:
        if name == "body":
            color = alt["skin"]
        elif name.startswith("heads_"):
            color = (alt["skin"], color[1])
        elif name.startswith(("hair_", "beards_")):
            color = alt["hair"]
        layers.append((name, color))
    return {**spec, "layers": layers}


def write_credits(lpc, out):
    rows = {r[0]: r for r in csv.reader(open(lpc.root / "CREDITS.csv"))}
    lines = []
    for rel in sorted(lpc.used):
        if rel.startswith("eyes/human/adult/default/"):
            anim = rel.rsplit("/", 1)[1][:-4]
            row = list(EYES_CREDIT)
            row[0] = row[0].format(anim=anim)
            lines.append(row)
        elif rel in rows:
            lines.append(rows[rel])
        else:
            raise SystemExit(f"no credits for {rel}")
    with open(out / "CREDITS.txt", "w", newline="") as f:
        f.write(CREDITS_HEADER)
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(["filename", "notes", "authors", "licenses", "urls"])
        writer.writerows(lines)
    print("credits:", len(lines), "files")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    lpc, out = Lpc(Path(args[0])), Path(args[1])
    out.mkdir(parents=True, exist_ok=True)
    for name, spec in LOOKS.items():
        build(lpc, spec).save(out / f"{name}.png", optimize=True)
        print("built", name)
        if name in ALT:
            build(lpc, with_alt(spec, ALT[name])).save(out / f"{name}-alt.png", optimize=True)
            print("built", f"{name}-alt")
    if "--credits" in sys.argv:
        write_credits(lpc, out)


if __name__ == "__main__":
    main()
