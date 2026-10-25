import type { MetadataRoute } from "next";

// Static: the app is exported (`output: "export"`), where a dynamic manifest
// route answers 500.
export const dynamic = "force-static";

const ICON_SIZES = ["192", "512"] as const;

// Colors mirror --qo-bg in styles/tokens.css (the manifest cannot read CSS vars).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Claude Office",
    short_name: "Office",
    start_url: "/",
    display: "standalone",
    background_color: "#080d0c",
    theme_color: "#080d0c",
    // The maskable icons keep their art inside the safe zone, so they also
    // work as plain ("any") icons: list both purposes for every size.
    icons: ICON_SIZES.flatMap((size) =>
      (["any", "maskable"] as const).map((purpose) => ({
        src: `/icons/icon-maskable-${size}.png`,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose,
      })),
    ),
  };
}
