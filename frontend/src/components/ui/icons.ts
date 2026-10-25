import { createLucideIcon } from "lucide-react";

/**
 * Our own signs, drawn on lucide's grid (24 x 24, round 2 px strokes) as in
 * Olymp Fit, so they stand among lucide's icons unnoticed.
 */

/** The office: a monitor with a prompt on a desk — lucide has buildings, not a workplace. */
export const OfficeDesk = createLucideIcon("OfficeDesk", [
  [
    "rect",
    { x: "5", y: "3", width: "14", height: "10", rx: "2", key: "monitor" },
  ],
  ["path", { d: "m9 6.5 2 1.5-2 1.5", key: "prompt" }],
  ["path", { d: "M13 9.5h2", key: "cursor" }],
  ["path", { d: "M12 13v3", key: "stand" }],
  ["path", { d: "M2 16h20", key: "desk" }],
  ["path", { d: "M4 16v5", key: "left-leg" }],
  ["path", { d: "M20 16v5", key: "right-leg" }],
]);
