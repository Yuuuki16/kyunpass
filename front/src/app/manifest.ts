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
        src: "/header/kyunpass-icon.svg",
        sizes: "40x40",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
