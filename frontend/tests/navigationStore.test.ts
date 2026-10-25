/**
 * The app always opens on the office: a building config with floors must
 * not switch the view away from it.
 */
import { describe, expect, it } from "vitest";
import { useNavigationStore } from "../src/stores/navigationStore";

describe("navigationStore", () => {
  it("stays on the office when the config has floors", () => {
    useNavigationStore.getState().setBuildingConfig({
      buildingName: "HQ",
      floors: [
        {
          id: "f1",
          name: "One",
          floorNumber: 1,
          accent: "x",
          icon: "x",
          rooms: [],
        },
      ],
    });
    const state = useNavigationStore.getState();
    expect(state.view).toBe("single");
    expect(state.buildingConfig?.floors).toHaveLength(1);
    expect(state.isLoading).toBe(false);
  });
});
