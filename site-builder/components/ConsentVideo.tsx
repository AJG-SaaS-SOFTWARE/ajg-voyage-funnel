"use client";

import { useState } from "react";

export default function ConsentVideo({
  videoId,
  title,
  english = false
}: {
  videoId: string;
  title: string;
  english?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  if (loaded) {
    return (
      <div className="module-video">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="module-video-consent">
      <div>
        <span aria-hidden="true">▶</span>
        <h3>{title}</h3>
        <p>
          {english
            ? "The YouTube player is loaded only after your action. Loading it may send technical data to Google/YouTube."
            : "Le lecteur YouTube n’est chargé qu’après votre action. Son chargement peut transmettre des données techniques à Google/YouTube."}
        </p>
        <button type="button" className="button primary" onClick={() => setLoaded(true)}>
          {english ? "Display the YouTube video" : "Afficher la vidéo YouTube"}
        </button>
      </div>
    </div>
  );
}
