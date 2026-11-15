import { useRef, useState } from "react";
import { Check, Cloud, Key, Upload, X } from "lucide-react";
import { AlbumArt, Logo, cx } from "./ui";
import { TRACK, type TrackInfo } from "../data";
import {
  getStoredAudDToken,
  getStoredGroqToken,
  setStoredAudDToken,
  setStoredGroqToken,
} from "../services/lyricsService";

export type Screen = "landing" | "editor" | "lyrics" | "sync" | "export";

const STEPS: { id: Screen; label: string }[] = [
  { id: "editor", label: "Lyrics & Style" },
  { id: "sync", label: "Sync" },
  { id: "export", label: "Export" },
];

export function TopBar({
  screen,
  onNavigate,
  track = TRACK,
  onUploadAudio,
}: {
  screen: Screen;
  onNavigate: (s: Screen) => void;
  track?: TrackInfo;
  onUploadAudio?: (file: File) => void;
}) {
  const idx = STEPS.findIndex((s) => s.id === screen);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [groqValue, setGroqValue] = useState(() => getStoredGroqToken());
  const [tokenValue, setTokenValue] = useState(() => getStoredAudDToken());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && onUploadAudio) {
      onUploadAudio(f);
    }
    e.target.value = "";
  };

  const saveToken = () => {
    setStoredGroqToken(groqValue);
    setStoredAudDToken(tokenValue);
    setShowKeyModal(false);
  };

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-4 border-b border-white/[0.06] bg-black/40 px-4 backdrop-blur-2xl">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={() => onNavigate("landing")}
        className="rounded-lg transition hover:opacity-80"
      >
        <Logo />
      </button>
      <div className="h-5 w-px bg-white/10" />
      <button
        onClick={() => fileInputRef.current?.click()}
        title="Click to change or upload audio file"
        className="group flex items-center gap-2.5 rounded-lg px-2 py-1 transition hover:bg-white/[0.06]"
      >
        <AlbumArt size={26} />
        <div className="text-left leading-tight">
          <div className="flex items-center gap-1 text-[13px] font-medium text-white group-hover:text-volt-300">
            {track.title}
            <Upload size={12} className="opacity-0 transition group-hover:opacity-100" />
          </div>
          <div className="text-[11px] text-white/40">{track.artist}</div>
        </div>
      </button>
      <div className="hidden items-center gap-1.5 text-[11.5px] text-white/35 xl:flex">
        <Cloud size={13} /> Saved just now
      </div>

      <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full bg-white/[0.04] p-1 ring-1 ring-white/[0.06] md:flex">
        {STEPS.map((s, i) => {
          const active = s.id === screen;
          const done = i < idx;
          return (
            <button
              key={s.id}
              onClick={() => onNavigate(s.id)}
              className={cx(
                "flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-[12.5px] font-medium transition",
                active ? "bg-white/[0.08] text-white" : "text-white/45 hover:text-white/80",
              )}
            >
              <span
                className={cx(
                  "grid h-5 w-5 place-items-center rounded-full font-mono text-[10px] font-semibold",
                  active
                    ? "bg-white text-black  shadow-[0_0_12px_rgba(255,255,255,0.10)]"
                    : done
                      ? "bg-volt-500/20 text-volt-300"
                      : "bg-white/[0.06] text-white/50",
                )}
              >
                {done ? <Check size={11} strokeWidth={3} /> : i + 1}
              </span>
              {s.label}
            </button>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2.5">
        <button
          onClick={() => onNavigate("lyrics")}
          title="Open Nothing OS Live Lyrics Experience"
          className={cx(
            "flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11.5px] font-mono transition",
            screen === "lyrics"
              ? "border-white bg-white text-black font-semibold shadow-[0_0_14px_rgba(255,255,255,0.25)]"
              : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/20 hover:text-white",
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#D71920] shadow-[0_0_6px_#D71920]" />
          <span className="hidden sm:inline">LIVE LYRICS</span>
        </button>

        <button
          onClick={() => setShowKeyModal(true)}
          title="AI Sync & Recognition Settings"
          className="flex h-8 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 text-[12px] font-medium text-white/65 transition hover:bg-white/[0.08] hover:text-white"
        >
          <Key
            size={12}
            className={groqValue ? "text-volt-300" : tokenValue ? "text-cyan-300" : "text-white/40"}
          />
          <span className="hidden sm:inline">
            {groqValue ? "Groq Whisper: Ready" : tokenValue ? "AudD Connected" : "API Keys"}
          </span>
        </button>
      </div>

      {/* API Settings Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-white">
                AI Sync & Recognition Settings
              </h3>
              <button
                onClick={() => setShowKeyModal(false)}
                className="text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Groq Whisper AI Key */}
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label className="text-[12.5px] font-medium text-white">
                  Groq API Key <span className="text-volt-300 font-normal">(100% Word Sync)</span>
                </label>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-volt-300 hover:underline"
                >
                  Get free key ↗
                </a>
              </div>
              <input
                type="password"
                value={groqValue}
                onChange={(e) => setGroqValue(e.target.value)}
                placeholder="Paste your Groq key (e.g. gsk_...)"
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 font-mono text-[13px] text-white placeholder-white/30 focus:border-volt-400 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-white/40">
                Whisper-large-v3 AI listens to your audio vocals and extracts millisecond word
                timestamps.
              </p>
            </div>

            {/* AudD Token */}
            <div className="mt-4 border-t border-white/[0.08] pt-4">
              <label className="text-[12px] font-medium text-white/70">
                AudD API Token (Optional sound ID)
              </label>
              <input
                type="text"
                value={tokenValue}
                onChange={(e) => setTokenValue(e.target.value)}
                placeholder="Paste AudD token (optional)"
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white placeholder-white/30 focus:border-volt-400 focus:outline-none"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="rounded-xl px-4 py-2 text-[13px] text-white/60 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveToken}
                className="rounded-xl bg-white px-5 py-2 text-[13px] font-semibold text-black transition hover:bg-white/90"
              >
                Save Keys
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
