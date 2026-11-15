import { useEffect } from "react";
import type { LyricsMode } from "./KaraokeWord";

interface LyricsModeSwitcherProps {
  mode: LyricsMode;
  onChange: (mode: LyricsMode) => void;
  className?: string;
}

const MODES: Array<{
  id: LyricsMode;
  label: string;
  badge: string;
  desc: string;
}> = [
  {
    id: "nothing",
    label: "NOTHING",
    badge: "(N)",
    desc: "Dot-matrix · Red Accent · Glyph UI",
  },
  {
    id: "apple",
    label: "APPLE",
    badge: "",
    desc: "Karaoke Word Glow · Frosted Blur",
  },
  {
    id: "spotify",
    label: "SPOTIFY",
    badge: "SP",
    desc: "High-Contrast · Smooth Line Wipe",
  },
];

export function LyricsModeSwitcher({ mode, onChange, className = "" }: LyricsModeSwitcherProps) {
  // Hotkeys: 1 (Nothing), 2 (Apple), 3 (Spotify)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "1") onChange("nothing");
      if (e.key === "2") onChange("apple");
      if (e.key === "3") onChange("spotify");
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onChange]);

  return (
    <div
      className={`inline-flex items-center rounded-full border border-white/10 bg-black/60 p-1 backdrop-blur-md shadow-lg ${className}`}
    >
      {MODES.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            title={m.desc}
            className={`group relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-all duration-200 ${
              active
                ? m.id === "nothing"
                  ? "bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                  : m.id === "apple"
                    ? "bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                    : "bg-[#1ED760] text-black shadow-[0_0_15px_rgba(30,215,96,0.3)]"
                : "text-white/50 hover:bg-white/[0.05] hover:text-white"
            }`}
          >
            <span
              className={`font-mono text-[11px] font-bold ${
                active
                  ? m.id === "nothing"
                    ? "text-[#D71920]"
                    : "text-black"
                  : "text-white/40 group-hover:text-white/70"
              }`}
            >
              {m.badge}
            </span>
            <span className="font-mono text-[11px] font-semibold tracking-wider">{m.label}</span>
            {active && m.id === "nothing" && (
              <span className="h-1.5 w-1.5 rounded-full bg-[#D71920] shadow-[0_0_6px_#D71920]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
