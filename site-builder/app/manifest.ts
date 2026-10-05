import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ELTARA — by AJG Horizon",
    short_name: "ELTARA",
    description: "Élevez votre présence digitale avec un espace guidé pour créer, publier et faire évoluer votre site professionnel.",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F6F3",
    theme_color: "#4E79D8",
    icons: [
      {
        src: "/eltara-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      }
    ]
  };
}
