"""Append typing frames to the LPC people sheets.

LPC has no "typing at a desk" animation, so we build it from the seated
frame (sit frame 3, hands on the lap): the worker's own hands are moved with
pixel shifts — one hand presses down onto the keys while the other lifts.

Output: two 64x64 frames written into the typing slot at x=896 (typing-left,
typing-right) in every row; only the "down" row (facing the viewer) is used
in the office. The rest of the sheet (see compose_lpc_people.py) is kept.
Idempotent: the slot is cleared before the frames are drawn.

Usage: python scripts/make_typing_frames.py [frontend/public/sprites/people]
"""
import sys
from pathlib import Path

from PIL import Image

FRAME = 64
TYPING_X = 896  # after walk (576) | sit (192) | idle (128)
SIT_CHAIR_X = 576 + 2 * FRAME
# Hand blocks inside the seated frame (frame-local px): rows of the hands
# plus the outline under them, split down the middle between the two hands.
HANDS_TOP, HANDS_BOTTOM = 44, 49  # inclusive
LEFT_HAND = (23, 31)  # x range [start, end)
RIGHT_HAND = (32, 41)
PRESS = 2  # px a pressing hand moves down
LIFT = 1  # px the other hand lifts


def shift_block(frame: Image.Image, src: Image.Image, xs: tuple[int, int], dy: int) -> None:
    """Move the hand block in columns xs by dy px (positive = down)."""
    x0, x1 = xs
    for x in range(x0, x1):
        column = [src.getpixel((x, y)) for y in range(HANDS_TOP, HANDS_BOTTOM + 1)]
        # Clear the old hand rows: the sleeve/torso pixel above the hands
        # where the hand moved away from the body, the lap below otherwise
        above = src.getpixel((x, HANDS_TOP - 1))
        below = src.getpixel((x, HANDS_BOTTOM + 1))
        for y in range(HANDS_TOP, HANDS_BOTTOM + 1):
            frame.putpixel((x, y), below if dy < 0 and y > HANDS_BOTTOM + dy else above)
        for i, px in enumerate(column):
            y = HANDS_TOP + i + dy
            if px[3] and 0 <= y < FRAME:
                frame.putpixel((x, y), px)


def typing_frame(sit: Image.Image, pressing: str) -> Image.Image:
    frame = sit.copy()
    left_dy, right_dy = (PRESS, -LIFT) if pressing == "left" else (-LIFT, PRESS)
    shift_block(frame, sit, LEFT_HAND, left_dy)
    shift_block(frame, sit, RIGHT_HAND, right_dy)
    return frame


def main() -> None:
    folder = Path(sys.argv[1] if len(sys.argv) > 1 else "frontend/public/sprites/people")
    for path in sorted(folder.glob("*.png")):
        sheet = Image.open(path).convert("RGBA")
        out = Image.new("RGBA", (max(sheet.width, TYPING_X + 2 * FRAME), 4 * FRAME))
        out.alpha_composite(sheet)
        # Clear the typing slot, then draw the frames
        out.paste((0, 0, 0, 0), (TYPING_X, 0, TYPING_X + 2 * FRAME, 4 * FRAME))
        for row in range(4):
            y = row * FRAME
            sit = sheet.crop((SIT_CHAIR_X, y, SIT_CHAIR_X + FRAME, y + FRAME))
            for i, hand in enumerate(("left", "right")):
                out.alpha_composite(typing_frame(sit, hand), (TYPING_X + i * FRAME, y))
        out.save(path, optimize=True)
        print("typing frames:", path.name)


if __name__ == "__main__":
    main()
