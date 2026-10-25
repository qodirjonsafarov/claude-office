import type { MetadataRoute } from "next";

// Colors mirror --qo-bg in styles/tokens.css (the manifest cannot read CSS vars).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Claude Office",
    short_name: "Office",
    start_url: "/",
    display: "standalone",
    background_color: "#080d0c",
    theme_color: "#080d0c",
    icons: [
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
