import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "B2Car",
    short_name: "B2Car",
    description: "B2Car System",

    start_url: "/",
    scope: "/",

    display: "standalone",

    background_color: "#f5f7f9",
    theme_color: "#ffffff",

    icons: [
      {
        src: "/favicon.ico",
        sizes: "880x880",
        type: "image/x-icon",
      },
    ],

    screenshots: [
      {
        src: "/screen1.png",
        sizes: "349x629",
        type: "image/png",
        form_factor: "narrow",
      },
    ],
  };
}
