import { memo, useState } from "react";
import {
  Gauge,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";

interface LyricsControlsProps {
  playing: boolean;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
  reducedMotion: boolean;
  onToggleReducedMotion: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  className?: string;
}

const RATES = [0.75, 1, 1.25, 1.5];

export const LyricsControls = memo(function LyricsControls({
  playing,
  onToggle,
  onPrev,
  onNext,
  volume,
  onVolumeChange,
  playbackRate,
  onPlaybackRateChange,
  autoScroll,
  onToggleAutoScroll,
  reducedMotion,
  onToggleReducedMotion,
  isFullscreen,
  onToggleFullscreen,
  className = "",
}: LyricsControlsProps) {
  const [prevVolume, setPrevVolume] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const toggleMute = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      onVolumeChange(0);
    } else {
      onVolumeChange(prevVolume > 0 ? prevVolume : 1);
    }
  };

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-4 py-2 text-white ${className}`}
    >
      {/* Left Group: Secondary Controls (Speed, Motion, Auto-scroll) */}
      <div className="flex items-center gap-2">
        {/* Playback Speed Menu */}
        <div className="relative">
          <button
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
            title="Playback Speed"
            className="flex h-8 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 font-mono text-[11px] text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <Gauge size={13} className="text-[#D71920]" />
            <span>{playbackRate}x</span>
          </button>

          {showSpeedMenu && (
            <div className="absolute bottom-10 left-0 z-30 flex flex-col rounded-xl border border-white/15 bg-black/90 p-1 shadow-2xl backdrop-blur-md">
              {RATES.map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    onPlaybackRateChange(r);
                    setShowSpeedMenu(false);
                  }}
                  className={`rounded-lg px-3 py-1 text-left font-mono text-[11px] transition ${
                    playbackRate === r
                      ? "bg-white text-black font-semibold"
                      : "text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {r}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Auto-scroll toggle badge */}
        <button
          onClick={onToggleAutoScroll}
          title={autoScroll ? "Auto-scroll is ON" : "Auto-scroll is PAUSED"}
          className={`flex h-8 items-center gap-1.5 rounded-full border px-2.5 font-mono text-[10.5px] transition ${
            autoScroll
              ? "border-white/15 bg-white/[0.06] text-white/90"
              : "border-[#D71920]/40 bg-[#D71920]/10 text-[#D71920]"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              autoScroll ? "bg-[#D71920] shadow-[0_0_6px_#D71920]" : "bg-white/30"
            }`}
          />
          <span className="hidden sm:inline">{autoScroll ? "AUTO-SCROLL" : "MANUAL"}</span>
        </button>

        {/* Reduced motion toggle */}
        <button
          onClick={onToggleReducedMotion}
          title={reducedMotion ? "Reduced Motion enabled" : "Smooth Animations enabled"}
          className={`flex h-8 items-center gap-1 rounded-full border px-2 font-mono text-[10px] transition ${
            reducedMotion
              ? "border-[#D71920]/40 bg-[#D71920]/10 text-[#D71920]"
              : "border-white/10 bg-white/[0.03] text-white/45 hover:text-white"
          }`}
        >
          <RotateCcw size={11} />
          <span className="hidden md:inline">MOTION: {reducedMotion ? "OFF" : "ON"}</span>
        </button>
      </div>

      {/* Center Group: Primary Transport Controls (Prev, Play/Pause, Next) */}
      <div className="flex items-center gap-3">
        <button
          onClick={onPrev}
          title="Previous lyric (Arrow Left)"
          aria-label="Previous Lyric"
          className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 transition hover:scale-105 hover:bg-white/10 hover:text-white active:scale-95"
        >
          <SkipBack size={15} fill="currentColor" />
        </button>

        <button
          onClick={onToggle}
          title={playing ? "Pause (Space)" : "Play (Space)"}
          aria-label={playing ? "Pause" : "Play"}
          className="group relative grid h-12 w-12 place-items-center rounded-full bg-white text-black shadow-[0_0_24px_rgba(255,255,255,0.2)] transition hover:scale-105 active:scale-95"
        >
          {playing ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" className="ml-0.5" />
          )}
          <span className="absolute -bottom-1 h-1 w-1 rounded-full bg-[#D71920]" />
        </button>

        <button
          onClick={onNext}
          title="Next lyric (Arrow Right)"
          aria-label="Next Lyric"
          className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 transition hover:scale-105 hover:bg-white/10 hover:text-white active:scale-95"
        >
          <SkipForward size={15} fill="currentColor" />
        </button>
      </div>

      {/* Right Group: Volume & Fullscreen */}
      <div className="flex items-center gap-3">
        {/* Volume Scrub */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            aria-label={volume === 0 ? "Unmute" : "Mute"}
            className="text-white/60 transition hover:text-white"
          >
            {volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-16 accent-[#D71920] sm:w-20 cursor-pointer"
          />
        </div>

        {/* Fullscreen Button */}
        <button
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Lyrics"}
          aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/65 transition hover:bg-white/10 hover:text-white"
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
    </div>
  );
});
