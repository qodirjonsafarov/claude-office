"""Typing frames for the LPC people sheets (used by compose_lpc_people.py).

LPC has no "typing at a desk" animation, so we build it from the seated
frame (sit frame 3, hands on the lap): the worker's own hands are moved with
pixel shifts — one hand presses down onto the keys while the other lifts.

compose_lpc_people.py calls `typing_frame` for the typing slot at x=896
(typing-left, typing-right) in every row, before the outline goes on; only
the "down" row (facing the viewer) is used in the office. Don't run this on
finished sheets: they carry the outline, so rebuild them with
compose_lpc_people.py instead.
"""
import sys

from PIL import Image

FRAME = 64
TYPING_X = 896  # after walk (576) | sit (192) | idle (128)
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
    sys.exit("Typing frames are built by scripts/compose_lpc_people.py now.")


if __name__ == "__main__":
    main()
