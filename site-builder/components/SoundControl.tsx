"use client";

import { useRef, useState } from "react";
import { type MediaChoice } from "../lib/site-design";

export default function SoundControl({ audio, english }: { audio: MediaChoice; english: boolean }) {
  const player = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);

  const toggle = async () => {
    if (!player.current) return;
    if (playing) {
      player.current.pause();
      setPlaying(false);
    } else {
      try {
        await player.current.play();
        setPlaying(true);
        setError(false);
      } catch {
        setError(true);
      }
    }
  };

  return <div className="public-sound">
    <audio ref={player} src={audio.url} preload="none" onEnded={() => setPlaying(false)} onError={() => { setPlaying(false); setError(true); }} />
    <button type="button" onClick={toggle} aria-label={playing ? (english ? "Pause sound" : "Mettre le son en pause") : (english ? "Play sound" : "Écouter le son")}>
      {playing ? "Ⅱ" : "♫"} {playing ? (english ? "Pause" : "Pause") : (english ? "Listen" : "Écouter")}
    </button>
    <span>{audio.title}</span>
    {error ? <small>{english ? "Sound unavailable" : "Son indisponible"}</small> : null}
  </div>;
}
