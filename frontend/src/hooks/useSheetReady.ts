/**
 * Whether a people sheet image has loaded in the browser, so a portrait can
 * show the letter circle until then instead of an empty tile.
 */

import { useEffect, useState } from "react";
import { sheetUrl } from "@/systems/portrait";

const loaded = new Set<string>();
const pending = new Map<string, Promise<void>>();

export function markSheetLoaded(sheet: string): void {
  loaded.add(sheet);
}

function loadSheetImage(sheet: string): Promise<void> {
  let promise = pending.get(sheet);
  if (!promise) {
    promise = new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        loaded.add(sheet);
        resolve();
      };
      image.onerror = () => {
        pending.delete(sheet); // try again next time
        reject(new Error(`sheet ${sheet} failed to load`));
      };
      image.src = sheetUrl(sheet);
    });
    pending.set(sheet, promise);
  }
  return promise;
}

export function useSheetReady(sheet: string | null): boolean {
  const [, setTick] = useState(0);
  const ready = sheet !== null && loaded.has(sheet);
  useEffect(() => {
    if (sheet === null || loaded.has(sheet)) return;
    let alive = true;
    loadSheetImage(sheet).then(
      () => alive && setTick((n) => n + 1),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [sheet]);
  return ready;
}
