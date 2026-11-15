import { memo } from "react";
import type { Word } from "../../data";

export type LyricsMode = "spotify" | "apple" | "nothing";

interface KaraokeWordProps {
  word: Word;
  time: number;
  mode: LyricsMode;
  isLineActive: boolean;
  reducedMotion?: boolean;
}

export const KaraokeWord = memo(function KaraokeWord({
  word,
  time,
  mode,
  isLineActive,
  reducedMotion = false,
}: KaraokeWordProps) {
  const { text, start, end } = word;

  let progress = 0;
  if (time >= end) {
    progress = 1;
  } else if (time <= start) {
    progress = 0;
  } else {
    const dur = Math.max(0.06, end - start);
    progress = Math.min(1, Math.max(0, (time - start) / dur));
  }

  const isSung = progress >= 1;
  const isActive = isLineActive && progress > 0 && progress < 1;
  const isUpcoming = progress === 0;

  // Nothing OS Mode
  if (mode === "nothing") {
    const nothingRed = "#D71920";

    return (
      <span className="relative inline-flex flex-col items-center px-[0.1em] align-baseline">
        <span
          className="inline-block transition-colors duration-150"
          style={{
            fontFamily: "'Doto', monospace",
            fontWeight: 800,
            letterSpacing: "0.03em",
            color: isActive ? nothingRed : isSung ? "#FFFFFF" : "rgba(255, 255, 255, 0.35)",
            filter: isActive
              ? `drop-shadow(0 0 10px ${nothingRed}ee) drop-shadow(0 0 20px ${nothingRed}66)`
              : undefined,
            transform: !reducedMotion && isActive ? "scale(1.08)" : "scale(1)",
            transition: reducedMotion ? "none" : "transform 0.15s ease, color 0.15s ease",
          }}
        >
          {text}
        </span>
        {isActive && (
          <span
            className="absolute -bottom-1 h-1 w-1 rounded-full animate-pulse"
            style={{
              backgroundColor: nothingRed,
              boxShadow: `0 0 6px ${nothingRed}`,
            }}
          />
        )}
      </span>
    );
  }

  // Apple Music Mode (Fluid word-by-word karaoke with glow)
  if (mode === "apple") {
    const stopPct = `${(progress * 100).toFixed(1)}%`;
    return (
      <span
        className="inline-block px-[0.06em] align-baseline transition-transform duration-200"
        style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
          fontWeight: 800,
          letterSpacing: "-0.025em",
          backgroundImage: `linear-gradient(90deg, #FFFFFF ${stopPct}, rgba(255, 255, 255, 0.42) ${stopPct})`,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          filter: isActive
            ? "drop-shadow(0 0 14px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 28px rgba(255, 255, 255, 0.4))"
            : isSung
              ? "drop-shadow(0 0 6px rgba(255, 255, 255, 0.35))"
              : undefined,
          transform: !reducedMotion && isActive ? "scale(1.06)" : "scale(1)",
        }}
      >
        {text}
      </span>
    );
  }

  // Spotify Mode (High contrast, rhythmic line-oriented sweep)
  const stopPct = `${(progress * 100).toFixed(1)}%`;
  return (
    <span
      className="inline-block px-[0.05em] align-baseline transition-opacity duration-150"
      style={{
        fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
        fontWeight: 800,
        letterSpacing: "-0.025em",
        backgroundImage: `linear-gradient(90deg, #FFFFFF ${stopPct}, rgba(255, 255, 255, 0.45) ${stopPct})`,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        opacity: isSung || isActive ? 1 : 0.45,
        filter: isActive ? "drop-shadow(0 0 8px rgba(255, 255, 255, 0.5))" : undefined,
        transform: !reducedMotion && isActive ? "scale(1.03)" : "scale(1)",
      }}
    >
      {text}
    </span>
  );
});
