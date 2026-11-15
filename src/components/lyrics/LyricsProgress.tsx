import { memo, useRef, useState } from "react";
import type { Line } from "../../data";
import { formatNothingRemaining, formatNothingTime } from "./LyricsSynchronizer";

interface LyricsProgressProps {
  time: number;
  duration: number;
  lines?: Line[];
  onSeek: (time: number) => void;
  className?: string;
}

export const LyricsProgress = memo(function LyricsProgress({
  time,
  duration,
  lines = [],
  onSeek,
  className = "",
}: LyricsProgressProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);

  const pct = duration > 0 ? Math.min(100, Math.max(0, (time / duration) * 100)) : 0;

  const calculateTimeFromEvent = (e: React.PointerEvent<HTMLDivElement> | MouseEvent) => {
    if (!containerRef.current || duration <= 0) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return +(ratio * duration).toFixed(2);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    const newTime = calculateTimeFromEvent(e);
    onSeek(newTime);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPos(ratio * 100);
    setHoverTime(ratio * duration);

    if (isDragging) {
      onSeek(ratio * duration);
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  return (
    <div className={`flex flex-col gap-1.5 select-none ${className}`}>
      {/* Scrubber Bar */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          if (!isDragging) setHoverTime(null);
        }}
        className="group relative flex h-6 cursor-pointer items-center py-2"
      >
        {/* Track Background */}
        <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-white/15 transition-all group-hover:h-[6px]">
          {/* Filled Progress */}
          <div
            className="h-full bg-gradient-to-r from-white/90 via-white to-white transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Lyric Line Markers */}
        {duration > 0 &&
          lines.map((l) => {
            const markPct = (l.start / duration) * 100;
            if (markPct < 0 || markPct > 100) return null;
            return (
              <span
                key={l.id}
                title={`${formatNothingTime(l.start)}: ${l.text}`}
                className="absolute top-1/2 h-1.5 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-white/30 transition group-hover:h-3 group-hover:bg-white/60"
                style={{ left: `${markPct}%` }}
              />
            );
          })}

        {/* Nothing Red Thumb Indicator */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-transform group-hover:scale-125"
          style={{ left: `${pct}%` }}
        >
          <div className="h-3 w-3 rounded-full border-2 border-white bg-[#D71920] shadow-[0_0_10px_#D71920]" />
        </div>

        {/* Hover Time Tooltip */}
        {hoverTime !== null && (
          <div
            className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded border border-white/20 bg-black/90 px-2 py-0.5 font-mono text-[10px] text-white shadow-xl backdrop-blur"
            style={{ left: `${hoverPos}%` }}
          >
            {formatNothingTime(hoverTime)}
          </div>
        )}
      </div>

      {/* Timestamp labels */}
      <div className="flex items-center justify-between font-mono text-[11.5px] text-white/45">
        <div className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-[#D71920]" />
          <span className="text-white/90 font-medium">{formatNothingTime(time)}</span>
        </div>
        <div>
          <span>{formatNothingRemaining(time, duration)}</span>
        </div>
      </div>
    </div>
  );
});
