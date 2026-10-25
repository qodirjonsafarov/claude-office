"""Rasterize pixelarticons SVGs into the scene's 24 px pixel-icon atlas.

pixelarticons (MIT, https://github.com/halfmage/pixelarticons) are drawn on
a 24 px grid with axis-aligned paths only, so every pixel is either fully
on or off: we fill pixel centres (nonzero rule) and get crisp white icons
that Pixi tints and scales by whole numbers with nearest-neighbour sampling.

Atlas order must match ICON_FRAMES in frontend/src/systems/pixelIcons.ts.

Usage: python scripts/make_pixel_icons.py <pixelarticons/svg> frontend/public/sprites/icons/pixel-icons.png
"""
import re, sys
from pathlib import Path
from PIL import Image

ORDER = ["book-open", "pencil", "terminal", "globe", "users", "close", "check", "square-alert"]

def polys(d):
    toks = re.findall(r"[MmHhVvLlZz]|-?\d*\.?\d+", d)
    out, cur, x, y, i, cmd = [], [], 0.0, 0.0, 0, None
    sx, sy = 0.0, 0.0  # subpath start: the current point after "z"
    while i < len(toks):
        t = toks[i]
        if re.match(r"[A-Za-z]", t):
            cmd = t; i += 1
            if cmd in "Zz":
                if cur: out.append(cur); cur = []
                x, y = sx, sy
                continue
        def num():
            nonlocal i
            v = float(toks[i]); i += 1; return v
        if cmd in "Mm":
            nx, ny = num(), num()
            if cmd == "m": nx += x; ny += y
            if cur: out.append(cur)
            cur = [(nx, ny)]; x, y = nx, ny; sx, sy = nx, ny
            cmd = "L" if cmd == "M" else "l"
        elif cmd in "Ll":
            nx, ny = num(), num()
            if cmd == "l": nx += x; ny += y
            x, y = nx, ny; cur.append((x, y))
        elif cmd in "Hh":
            v = num(); x = v + (x if cmd == "h" else 0); cur.append((x, y))
        elif cmd in "Vv":
            v = num(); y = v + (y if cmd == "v" else 0); cur.append((x, y))
        else:
            raise SystemExit(f"unsupported {cmd}")
    if cur: out.append(cur)
    return out

def inside(px, py, ps):
    w = 0  # nonzero winding
    for poly in ps:
        n = len(poly)
        for k in range(n):
            (x1, y1), (x2, y2) = poly[k], poly[(k + 1) % n]
            if y1 <= py < y2 and (x2 - x1) * (py - y1) - (px - x1) * (y2 - y1) > 0: w += 1
            elif y2 <= py < y1 and (x2 - x1) * (py - y1) - (px - x1) * (y2 - y1) < 0: w -= 1
    return w != 0

src = Path(sys.argv[1]); out = Path(sys.argv[2])
atlas = Image.new("RGBA", (24 * len(ORDER), 24))
for idx, name in enumerate(ORDER):
    svg = (src / f"{name}.svg").read_text()
    ps = [p for d in re.findall(r'd="([^"]+)"', svg) for p in polys(d)]
    for yy in range(24):
        for xx in range(24):
            if inside(xx + 0.5, yy + 0.5, ps):
                atlas.putpixel((idx * 24 + xx, yy), (255, 255, 255, 255))
atlas.save(out)
print("atlas", atlas.size, ORDER)
