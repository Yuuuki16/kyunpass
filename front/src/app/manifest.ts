import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "kyunpass",
    short_name: "kyunpass",
    description: "会話からキュン度を測定する",
    start_url: "/",
    display: "standalone",
    background_color: "#F5F5F5",
    theme_color: "#D4537E",
    lang: "ja",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
