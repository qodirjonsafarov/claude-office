/**
 * The scene layer above the desks and keyboards (below the monitors) where
 * seated workers' hands are drawn (systems/handsOnDesk.ts). OfficeGame
 * provides it; PersonSprite attaches the hands of a seated worker to it.
 */

import { createContext } from "react";
import type { RenderLayer } from "pixi.js";

export const HandsLayerContext = createContext<RenderLayer | null>(null);
