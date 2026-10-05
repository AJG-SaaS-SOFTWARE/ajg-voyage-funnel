import type { ReactNode } from "react";

export function EltaraMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`eltara-mark ${className}`.trim()}
      viewBox="0 0 64 64"
      role="img"
      aria-label="ELTARA"
    >
      <defs>
        <linearGradient id="eltara-gradient" x1="10" y1="54" x2="54" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4B2BA8" />
          <stop offset="0.52" stopColor="#4E79D8" />
          <stop offset="1" stopColor="#62D8EF" />
        </linearGradient>
      </defs>
      <path
        d="M32 8 38.2 20.7 52.2 22.7 42.1 32.5 44.5 46.4 32 39.8 19.5 46.4 21.9 32.5 11.8 22.7 25.8 20.7 32 8Z"
        fill="none"
        stroke="url(#eltara-gradient)"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M14 48c11-1 20-7 27-17l4.2-6.2-5.2-2.3L55 16l-1.4 15.7-4.2-3.3-4.8 6.8C36.6 46.5 26.3 52 14 53Z"
        fill="url(#eltara-gradient)"
        stroke="url(#eltara-gradient)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="8" r="3.7" fill="#fff" stroke="url(#eltara-gradient)" strokeWidth="3" />
      <circle cx="52" cy="22.7" r="3.7" fill="#fff" stroke="url(#eltara-gradient)" strokeWidth="3" />
    </svg>
  );
}

export function EltaraBrand({
  context,
  compact = false,
  className = ""
}: {
  context?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={`eltara-lockup ${compact ? "is-compact" : ""} ${className}`.trim()}>
      <EltaraMark />
      <span className="eltara-lockup-copy">
        <strong>ELTARA</strong>
        {context ? <small>{context}</small> : <small>by AJG Horizon</small>}
      </span>
    </span>
  );
}
