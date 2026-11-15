import { memo, useMemo } from "react";
import { getLineWordsWithTimings, type Line } from "../../data";
import { KaraokeWord, type LyricsMode } from "./KaraokeWord";
import { formatNothingTime } from "./LyricsSynchronizer";

interface LyricsLineProps {
  line: Line;
  index: number;
  time: number;
  isActive: boolean;
  isPast: boolean;
  distanceFromActive: number;
  mode: LyricsMode;
  onSeek: (time: number) => void;
  reducedMotion?: boolean;
}

export const LyricsLine = memo(function LyricsLine({
  line,
  index,
  time,
  isActive,
  isPast,
  distanceFromActive,
  mode,
  onSeek,
  reducedMotion = false,
}: LyricsLineProps) {
  const words = useMemo(() => getLineWordsWithTimings(line), [line]);

  const handleClick = () => {
    onSeek(line.start);
  };

  // Apple Music Frosted Blur & scaling
  const getAppleStyle = () => {
    if (isActive) {
      return {
        opacity: 1,
        filter: "none",
        transform: !reducedMotion ? "scale(1.04)" : "none",
      };
    }
    const blurPx = Math.min(4.5, Math.max(1.8, Math.abs(distanceFromActive) * 1.5));
    const opacity = isPast
      ? Math.max(0.18, 0.42 - Math.abs(distanceFromActive) * 0.08)
      : Math.max(0.15, 0.45 - Math.abs(distanceFromActive) * 0.1);

    return {
      opacity,
      filter: `blur(${blurPx}px)`,
      transform: !reducedMotion ? "scale(0.96)" : "none",
    };
  };

  // Spotify Style (High contrast, smooth line fades)
  const getSpotifyStyle = () => {
    if (isActive) {
      return {
        opacity: 1,
        transform: !reducedMotion ? "scale(1.02)" : "none",
      };
    }
    return {
      opacity: isPast ? 0.32 : Math.max(0.2, 0.48 - Math.abs(distanceFromActive) * 0.1),
      transform: "scale(1)",
    };
  };

  // Nothing OS Style (Industrial, dot-matrix, monochromatic, red active marker)
  const getNothingStyle = () => {
    if (isActive) {
      return {
        opacity: 1,
        transform: !reducedMotion ? "scale(1.03)" : "none",
      };
    }
    return {
      opacity: isPast ? 0.28 : Math.max(0.18, 0.42 - Math.abs(distanceFromActive) * 0.08),
      transform: "scale(1)",
    };
  };

  const lineStyle =
    mode === "apple" ? getAppleStyle() : mode === "nothing" ? getNothingStyle() : getSpotifyStyle();

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      className={`group relative flex cursor-pointer select-none items-center justify-between rounded-2xl px-4 py-3.5 transition-all duration-300 ${
        isActive
          ? mode === "nothing"
            ? "border border-white/20 bg-white/[0.04] shadow-[0_0_30px_rgba(255,255,255,0.04)]"
            : mode === "apple"
              ? "bg-white/[0.05] shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
              : "bg-white/[0.04]"
          : "hover:bg-white/[0.03]"
      }`}
      style={{
        ...lineStyle,
        transition: reducedMotion
          ? "opacity 0.2s ease"
          : "all 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {/* Left indicator / line number for Nothing OS & Spotify */}
      <div className="mr-3 flex shrink-0 items-center gap-2">
        {mode === "nothing" ? (
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            {isActive ? (
              <span className="flex items-center gap-1 font-bold text-[#D71920]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#D71920] shadow-[0_0_8px_#D71920] animate-pulse" />
                <span className="tracking-wider">REC</span>
              </span>
            ) : (
              <span className="text-white/25 group-hover:text-white/50">
                {String(index + 1).padStart(2, "0")}
              </span>
            )}
          </div>
        ) : (
          <span className="font-mono text-[11px] text-white/25 transition group-hover:text-white/60">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
      </div>

      {/* Main words line */}
      <div
        className={`flex-1 flex flex-wrap items-center gap-y-1 ${
          mode === "nothing"
            ? "text-[24px] sm:text-[32px] md:text-[36px] tracking-tight"
            : mode === "apple"
              ? "text-[26px] sm:text-[34px] md:text-[40px] tracking-tight"
              : "text-[24px] sm:text-[30px] md:text-[34px] tracking-tight"
        }`}
      >
        {words.map((word, wIdx) => (
          <KaraokeWord
            key={`${line.id}-w${wIdx}`}
            word={word}
            time={time}
            mode={mode}
            isLineActive={isActive}
            reducedMotion={reducedMotion}
          />
        ))}
      </div>

      {/* Right timestamp / seek trigger on hover or active */}
      <div className="ml-4 shrink-0 font-mono text-[11px] text-white/30 transition group-hover:text-white/80">
        <span
          className={`rounded px-1.5 py-0.5 ${
            isActive
              ? mode === "nothing"
                ? "bg-[#D71920]/20 text-[#D71920] ring-1 ring-[#D71920]/40"
                : "bg-white/10 text-white"
              : "bg-white/[0.04] text-white/40 opacity-0 group-hover:opacity-100"
          }`}
        >
          {formatNothingTime(line.start)}
        </span>
      </div>
    </div>
  );
});
