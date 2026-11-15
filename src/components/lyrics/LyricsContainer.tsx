import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent, type WheelEvent } from "react";
import { normalizeLyricalLines, type Line } from "../../data";
import { LyricsLine } from "./LyricsLine";
import type { LyricsMode } from "./KaraokeWord";
import { findActiveLineIndex } from "./LyricsSynchronizer";
import { RotateCw } from "lucide-react";

interface LyricsContainerProps {
  lines: Line[];
  time: number;
  playing: boolean;
  mode: LyricsMode;
  onSeek: (time: number) => void;
  reducedMotion?: boolean;
  autoScroll?: boolean;
  onAutoScrollChange?: (val: boolean) => void;
  className?: string;
}

export function LyricsContainer({
  lines,
  time,
  playing,
  mode,
  onSeek,
  reducedMotion = false,
  autoScroll = true,
  onAutoScrollChange,
  className = "",
}: LyricsContainerProps) {
  const normalizedLines = useMemo(() => normalizeLyricalLines(lines), [lines]);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const activeIdx = findActiveLineIndex(normalizedLines, time);

  const [userInteracting, setUserInteracting] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Smoothly centers active line in viewport
  const scrollToActiveLine = useCallback(
    (force = false) => {
      if ((!autoScroll || userInteracting) && !force) return;
      if (activeIdx < 0 || !lineRefs.current[activeIdx] || !containerRef.current) return;

      const container = containerRef.current;
      const targetEl = lineRefs.current[activeIdx];
      if (!targetEl) return;

      const containerHeight = container.clientHeight;
      const targetTop = targetEl.offsetTop;
      const targetHeight = targetEl.clientHeight;

      const scrollDestination = targetTop - containerHeight / 2 + targetHeight / 2;

      container.scrollTo({
        top: Math.max(0, scrollDestination),
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
    [activeIdx, autoScroll, userInteracting, reducedMotion],
  );

  // Sync scroll when active line changes or play status changes
  useEffect(() => {
    if (activeIdx >= 0) {
      scrollToActiveLine();
    }
  }, [activeIdx, scrollToActiveLine]);

  // Handle manual user scrolling
  const handleScrollInteraction = () => {
    setUserInteracting(true);
    if (onAutoScrollChange && autoScroll) {
      // Don't turn off permanently, pause temporarily
    }

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Auto-resume after 3.5s of no scroll interaction
    scrollTimeoutRef.current = setTimeout(() => {
      setUserInteracting(false);
      scrollToActiveLine(true);
    }, 3500);
  };

  const handleResumeAutoScroll = () => {
    setUserInteracting(false);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    onAutoScrollChange?.(true);
    scrollToActiveLine(true);
  };

  return (
    <div className={`relative flex flex-col h-full overflow-hidden ${className}`}>
      {/* Resume Auto-Scroll floating pill */}
      {userInteracting && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 animate-fade">
          <button
            onClick={handleResumeAutoScroll}
            className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/85 px-3 py-1 font-mono text-[11px] font-medium text-white shadow-2xl backdrop-blur-md transition hover:bg-white hover:text-black"
          >
            <RotateCw size={11} className="animate-spin" />
            <span>SCROLL PAUSED · TAP TO RESUME</span>
          </button>
        </div>
      )}

      {/* Top & Bottom gradient mask for soft fade */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black via-black/40 to-transparent z-10" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black via-black/40 to-transparent z-10" />

      {/* Main vertical scroll area */}
      <div
        ref={containerRef}
        onWheel={handleScrollInteraction}
        onTouchMove={handleScrollInteraction}
        className="flex-1 overflow-y-auto px-4 py-32 space-y-4 no-scrollbar scroll-smooth"
        style={{
          scrollBehavior: reducedMotion ? "auto" : "smooth",
        }}
      >
        {normalizedLines.length === 0 ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center py-20">
            <div className="h-2 w-2 rounded-full bg-[#D71920] shadow-[0_0_12px_#D71920] mb-3" />
            <p className="font-mono text-[14px] font-bold text-white/80 tracking-widest uppercase">
              NO LYRICS LOADED
            </p>
            <p className="mt-1 text-[12px] font-mono text-white/40 max-w-sm">
              Upload an audio track on the home screen or click "IMPORT LYRICS" above to load LRC / TTML timestamps.
            </p>
          </div>
        ) : (
          normalizedLines.map((line, idx) => {
            const isActive = idx === activeIdx;
            const isPast = idx < activeIdx;
            const distanceFromActive = idx - activeIdx;

            return (
              <div
                key={line.id}
                ref={(el) => {
                  lineRefs.current[idx] = el;
                }}
              >
                <LyricsLine
                  line={line}
                  index={idx}
                  time={time}
                  isActive={isActive}
                  isPast={isPast}
                  distanceFromActive={distanceFromActive}
                  mode={mode}
                  onSeek={onSeek}
                  reducedMotion={reducedMotion}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
