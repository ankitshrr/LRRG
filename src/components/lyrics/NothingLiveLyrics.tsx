import { useCallback, useEffect, useState } from "react";
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import type { Line, TrackInfo } from "../../data";
import type { Player } from "../../player";
import { AlbumArt } from "../ui";
import { LyricsContainer } from "./LyricsContainer";
import { LyricsModeSwitcher } from "./LyricsModeSwitcher";
import type { LyricsMode } from "./KaraokeWord";

interface NothingLiveLyricsProps {
  track: TrackInfo;
  lines: Line[];
  setLines: (lines: Line[]) => void;
  player: Player;
  onClose?: () => void;
  standalone?: boolean;
}

export function NothingLiveLyrics({
  track,
  lines,
  setLines,
  player,
  onClose,
  standalone = false,
}: NothingLiveLyricsProps) {
  // Session persisted mode
  const [mode, setMode] = useState<LyricsMode>(() => {
    const saved = localStorage.getItem("lyriq_lyrics_mode");
    return (saved as LyricsMode) || "nothing";
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  const handleModeChange = useCallback((newMode: LyricsMode) => {
    setMode(newMode);
    localStorage.setItem("lyriq_lyrics_mode", newMode);
  }, []);

  // Keyboard controls for fullscreen & transport
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]")) return;

      if (e.key === "f" || e.key === "F") {
        setIsFullscreen((prev) => !prev);
      } else if (e.key === "Escape") {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else if (onClose) {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const wordCount = lines.reduce((acc, l) => acc + l.text.split(/\s+/).filter(Boolean).length, 0);

  return (
    <div
      className={`relative flex flex-col bg-black text-white select-none ${
        isFullscreen
          ? "fixed inset-0 z-50 h-screen w-screen overflow-hidden"
          : "h-full min-h-[700px] flex-1 overflow-hidden"
      }`}
    >
      {/* Nothing OS Dotted Grid Background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.16) 1.2px, transparent 1.4px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Floating Action Bar (Top Right) - Sleek minimal floating pill */}
      <div className="absolute top-4 right-5 z-30 flex items-center gap-2 rounded-full border border-white/10 bg-black/75 p-1.5 backdrop-blur-xl shadow-2xl">
        <LyricsModeSwitcher mode={mode} onChange={handleModeChange} />

        <div className="h-4 w-px bg-white/10" />

        <button
          onClick={player.toggle}
          title={player.playing ? "Pause (Space)" : "Play (Space)"}
          className="grid h-7 w-7 place-items-center rounded-full bg-white text-black transition hover:bg-white/90"
        >
          {player.playing ? (
            <Pause size={12} fill="currentColor" />
          ) : (
            <Play size={12} fill="currentColor" className="ml-0.5" />
          )}
        </button>

        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen (F)"}
          className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </button>

        {onClose && (
          <button
            onClick={onClose}
            title="Close Live Lyrics"
            className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Main Content Area - Full Height Edge-to-Edge */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Track Details & Industrial Vinyl / Glyph LED Widget */}
        <div className="hidden lg:flex w-[340px] shrink-0 flex-col justify-between border-r border-white/10 p-6 bg-black/40 backdrop-blur-sm">
          {/* Track Header Card */}
          <div className="space-y-4">
            <div className="relative group mx-auto flex items-center justify-center py-4">
              {/* Spinning Disc / Glyph LED glow */}
              <div
                className={`relative flex items-center justify-center rounded-full p-2 border border-white/15 bg-black transition-transform duration-700 shadow-2xl ${
                  player.playing ? "animate-[spin_8s_linear_infinite]" : ""
                }`}
                style={{
                  boxShadow:
                    mode === "nothing"
                      ? "0 0 40px rgba(215, 25, 32, 0.2)"
                      : "0 0 40px rgba(255, 255, 255, 0.1)",
                }}
              >
                <AlbumArt size={160} className="rounded-full" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="h-10 w-10 rounded-full border-2 border-white/20 bg-black/80 flex items-center justify-center">
                    <div className="h-3 w-3 rounded-full bg-[#D71920]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#D71920]">
                PLAYING NOW
              </span>
              <h1 className="mt-1 truncate text-[18px] font-bold text-white tracking-tight">
                {track.title}
              </h1>
              <p className="truncate font-mono text-[13px] text-white/50">{track.artist}</p>
            </div>

            {/* Minimal scrub line & transport inside sidebar */}
            <div className="space-y-2 border-t border-white/10 pt-3">
              <div
                className="group relative h-1.5 w-full cursor-pointer rounded-full bg-white/10 overflow-hidden"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  player.seek(pct * (player.duration || 90));
                }}
              >
                <div
                  className="h-full bg-[#D71920] rounded-full transition-all duration-75"
                  style={{
                    width: `${Math.min(100, (player.time / (player.duration || 90)) * 100)}%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between font-mono text-[10.5px] text-white/40">
                <span>
                  {Math.floor(player.time / 60)}:
                  {String(Math.floor(player.time % 60)).padStart(2, "0")}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={player.prev}
                    title="Previous line"
                    className="text-white/40 hover:text-white transition"
                  >
                    <SkipBack size={12} />
                  </button>
                  <button
                    onClick={player.toggle}
                    title="Play / Pause"
                    className="text-white/80 hover:text-white transition"
                  >
                    {player.playing ? <Pause size={12} /> : <Play size={12} />}
                  </button>
                  <button
                    onClick={player.next}
                    title="Next line"
                    className="text-white/40 hover:text-white transition"
                  >
                    <SkipForward size={12} />
                  </button>
                </div>
                <span>
                  {Math.floor((player.duration || 90) / 60)}:
                  {String(Math.floor((player.duration || 90) % 60)).padStart(2, "0")}
                </span>
              </div>
            </div>

            {/* Industrial Metadata Grid */}
            <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-[11px] font-mono">
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
                <span className="text-white/35">TEMPO</span>
                <p className="text-white/90 font-semibold">{track.bpm || 120} BPM</p>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
                <span className="text-white/35">WORDS</span>
                <p className="text-white/90 font-semibold">{wordCount}</p>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
                <span className="text-white/35">DURATION</span>
                <p className="text-white/90 font-semibold">
                  {Math.floor((player.duration || 90) / 60)}:
                  {String(Math.floor((player.duration || 90) % 60)).padStart(2, "0")}
                </p>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
                <span className="text-white/35">MODE</span>
                <p className="text-[#D71920] font-semibold uppercase">{mode}</p>
              </div>
            </div>
          </div>

          {/* Glyph EQ LED Bar Widget */}
          <div className="space-y-2 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between font-mono text-[10px] text-white/40">
              <span>GLYPH FREQ</span>
              <span className="text-[#D71920]">LIVE</span>
            </div>
            <div className="flex h-10 items-end justify-between gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-2">
              {[0.3, 0.7, 1.0, 0.5, 0.85, 0.6, 0.9, 0.4, 0.75, 0.95, 0.55, 0.8, 0.35, 0.65].map(
                (h, i) => (
                  <span
                    key={i}
                    className={`w-1 rounded-full transition-all duration-150 ${
                      player.playing
                        ? i % 4 === 0
                          ? "bg-[#D71920]"
                          : "bg-white/80"
                        : "bg-white/20"
                    }`}
                    style={{
                      height: player.playing ? `${Math.max(15, h * 100)}%` : "20%",
                    }}
                  />
                ),
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Main Synchronized Lyrics Container */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <LyricsContainer
            lines={lines}
            time={player.time}
            playing={player.playing}
            mode={mode}
            onSeek={player.seek}
            reducedMotion={reducedMotion}
            autoScroll={autoScroll}
            onAutoScrollChange={setAutoScroll}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
}
