/** JADUU brand mark — original: golden spark + orbit node, matching the generated app icon. */
export function JaduuMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-label="JADUU">
      <rect x="1" y="1" width="46" height="46" rx="11" fill="#171330" />
      <rect x="1" y="1" width="46" height="46" rx="11" stroke="rgba(255,255,255,0.10)" />
      {/* spark */}
      <path
        d="M24 9.5c.9 5.9 3.6 8.6 9.5 9.5-5.9.9-8.6 3.6-9.5 9.5-.9-5.9-3.6-8.6-9.5-9.5 5.9-.9 8.6-3.6 9.5-9.5z"
        fill="url(#jaduu-spark)"
      />
      {/* orbit node */}
      <circle cx="34.5" cy="12.5" r="2.6" fill="#b9a8ff" />
      <defs>
        <linearGradient id="jaduu-spark" x1="14" y1="12" x2="34" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffe9a8" />
          <stop offset="1" stopColor="#f6a62e" />
        </linearGradient>
        <radialGradient id="jaduu-glow" cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#3d307a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#3d307a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="18" fill="url(#jaduu-glow)" />
      <path
        d="M24 9.5c.9 5.9 3.6 8.6 9.5 9.5-5.9.9-8.6 3.6-9.5 9.5-.9-5.9-3.6-8.6-9.5-9.5 5.9-.9 8.6-3.6 9.5-9.5z"
        fill="url(#jaduu-spark)"
        opacity="0.9"
      />
    </svg>
  );
}

export function JaduuWordmark({ size = 16, suffix }: { size?: number; suffix?: string }) {
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <JaduuMark size={size + 12} />
      <span
        className="font-semibold tracking-[0.18em]"
        style={{ fontSize: size, letterSpacing: "0.18em" }}
      >
        JADUU
      </span>
      {suffix ? (
        <span className="text-txt-3" style={{ fontSize: size - 4 }}>
          {suffix}
        </span>
      ) : null}
    </span>
  );
}
