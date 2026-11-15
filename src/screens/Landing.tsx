import { useRef, useState } from "react";
import { AlertCircle, Key, Loader2, Lock, Upload, X } from "lucide-react";
import { Logo, cx } from "../components/ui";
import { ReelBackground } from "../components/ReelPreview";
import { createTrackFromFile, type Line, type TrackInfo } from "../data";
import {
  getStoredAudDToken,
  getStoredGroqToken,
  identifyAndFetchLyrics,
  setStoredAudDToken,
  setStoredGroqToken,
} from "../services/lyricsService";

type LandingProps = {
  onAudioSelected: (track: TrackInfo, lines: Line[]) => void;
};

export function Landing({ onAudioSelected }: LandingProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingFileName, setLoadingFileName] = useState("");
  const [loadingStatus, setLoadingStatus] = useState("Analyzing audio...");
  const [error, setError] = useState<string | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [groqValue, setGroqValue] = useState(() => getStoredGroqToken());
  const [tokenValue, setTokenValue] = useState(() => getStoredAudDToken());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f?: File) => {
    if (!f) return;
    const isAudio = f.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(f.name);
    if (!isAudio) {
      setError("Please select a valid audio file (.mp3, .wav, .m4a, .aac, .ogg, .flac).");
      return;
    }
    setError(null);
    setLoading(true);
    setLoadingFileName(f.name);
    setLoadingStatus("Decoding audio duration...");

    const url = URL.createObjectURL(f);
    const tempAudio = new Audio(url);
    tempAudio.preload = "metadata";

    const getDuration = (): Promise<number> =>
      new Promise((resolve) => {
        tempAudio.onloadedmetadata = () =>
          resolve(tempAudio.duration > 0 && isFinite(tempAudio.duration) ? tempAudio.duration : 90);
        tempAudio.onerror = () => resolve(90);
        setTimeout(() => resolve(tempAudio.duration || 90), 1200);
      });

    const dur = await getDuration();

    const hasGroq = Boolean(getStoredGroqToken());
    setLoadingStatus(
      hasGroq
        ? "Groq Whisper AI: Transcribing vocal audio with exact word-level sync..."
        : "Identifying song & fetching synchronized lyrics...",
    );

    try {
      const result = await identifyAndFetchLyrics(f, dur);

      const cleanArtistName =
        result.artist && !/groq|whisper|identified artist/i.test(result.artist)
          ? result.artist
          : "";
      const finalTrack: TrackInfo = {
        title: result.title || f.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim(),
        artist: cleanArtistName,
        file: f.name,
        sizeMb: Number((f.size / (1024 * 1024)).toFixed(1)),
        bpm: 120,
        duration: Math.round(dur),
        audioUrl: url,
      };

      setLoading(false);
      // If AI found lyrics, load them. If not, open Editor with the audio track.
      onAudioSelected(finalTrack, result.lines || []);
    } catch (err: any) {
      // Even if AI recognition encounters an error, proceed to editor with the audio file
      const finalTrack: TrackInfo = {
        title: f.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim(),
        artist: "",
        file: f.name,
        sizeMb: Number((f.size / (1024 * 1024)).toFixed(1)),
        bpm: 120,
        duration: Math.round(dur),
        audioUrl: url,
      };
      setLoading(false);
      onAudioSelected(finalTrack, []);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      handleFile(f);
    }
    e.target.value = "";
  };

  const saveToken = () => {
    setStoredGroqToken(groqValue);
    setStoredAudDToken(tokenValue);
    setShowKeyModal(false);
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-ink-950">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
        onChange={handleInputChange}
        className="hidden"
      />

      {/* atmosphere */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-30%] h-[900px] w-[1300px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.09),rgba(255,255,255,0.02)_55%,transparent)]" />
        <div className="dot-grid absolute inset-0 [mask-image:radial-gradient(60%_50%_at_50%_40%,black,transparent)]" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-ink-950 to-transparent" />
      </div>

      <FloatingReel
        className="left-[4%] top-[22%] -rotate-[8deg]"
        bg="aurora"
        line="Hold on to the afterglow"
      />
      <FloatingReel
        className="right-[4%] top-[30%] rotate-[7deg] [animation-delay:-3s]"
        bg="neon"
        line="Where the neon and the stars collide"
      />

      <header className="relative z-10 flex h-16 items-center justify-between px-6 md:px-10">
        <Logo />
        <button
          onClick={() => setShowKeyModal(true)}
          className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-[12px] font-medium text-white/60 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
        >
          <Key
            size={13}
            className={groqValue ? "text-volt-300" : tokenValue ? "text-cyan-300" : "text-white/40"}
          />
          {groqValue
            ? "Groq Whisper: Ready (100% Sync)"
            : tokenValue
              ? "AudD: Connected"
              : "API Keys"}
        </button>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center px-6 pb-16 pt-[6vh] md:pt-[9vh]">
        <div className="mb-7 flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] py-1 pl-1 pr-3.5 text-[12.5px] text-white/60 backdrop-blur">
          <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-black">
            New
          </span>
          Word-level lyric sync & AudD sound detection
        </div>

        <h1 className="max-w-5xl text-center text-[clamp(40px,5.8vw,80px)] font-medium leading-[1] tracking-[-0.05em] text-white">
          Turn Your Music Into
          <br />
          <span className="mt-3 inline-block font-dot text-[1.02em] font-black uppercase tracking-[0.02em] text-white">
            Lyrics Reels.
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-center text-[17px] leading-relaxed text-white/55 md:text-lg">
          Upload any song. AudD recognizes it and syncs word-level lyrics automatically.
        </p>

        {/* dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!loading) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!loading && e.dataTransfer.files?.[0]) {
              handleFile(e.dataTransfer.files[0]);
            }
          }}
          onClick={() => {
            if (!loading) fileInputRef.current?.click();
          }}
          className={cx(
            "group relative mt-12 w-full max-w-[720px] cursor-pointer rounded-[30px] p-px transition duration-300",
            dragging
              ? "scale-[1.015] bg-gradient-to-b from-volt-400 to-volt-600 shadow-[0_0_80px_-10px_rgba(255,255,255,0.10)]"
              : "bg-gradient-to-b from-white/[0.14] via-white/[0.05] to-white/[0.02] shadow-[0_40px_120px_-40px_rgba(255,255,255,0.10)] hover:scale-[1.005]",
          )}
        >
          <div className="relative overflow-hidden rounded-[29px] glass">
            <div
              className={cx(
                "pointer-events-none absolute inset-3 rounded-[22px] border-[1.5px] border-dashed transition",
                dragging
                  ? "border-volt-400/70"
                  : "border-white/[0.09] group-hover:border-white/[0.16]",
              )}
            />
            <div className="pointer-events-none absolute left-1/2 top-0 h-px w-1/2 -translate-x-1/2 bg-gradient-to-r from-transparent via-volt-400/60 to-transparent" />

            {!loading ? (
              <div className="relative flex flex-col items-center px-8 py-14 text-center md:py-16">
                <div className="relative mb-6 grid h-[72px] w-[72px] place-items-center rounded-[22px] bg-gradient-to-b from-white/[0.1] to-white/[0.03] ring-1 ring-white/10 transition group-hover:scale-105">
                  <div className="absolute inset-0 rounded-[22px] bg-volt-500/20 blur-xl" />
                  <div className="relative flex h-7 items-center gap-[3px]">
                    {[0.45, 0.8, 1, 0.65, 0.35].map((h, i) => (
                      <span
                        key={i}
                        className="w-[4px] origin-center animate-eq rounded-full bg-gradient-to-t from-volt-500 to-volt-300"
                        style={{ height: `${h * 100}%`, animationDelay: `${i * 0.14}s` }}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-[19px] font-medium tracking-[-0.01em] text-white">
                  {dragging ? "Release to upload your audio track" : "Drag & drop your audio file"}
                </p>
                <p className="mt-1.5 text-[14px] text-white/40">
                  or click anywhere to browse from your computer
                </p>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="group/btn relative mt-8 flex h-[52px] items-center gap-2.5 overflow-hidden rounded-2xl bg-white px-7 text-[15.5px] font-semibold text-black shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_0_0_1px_rgba(255,255,255,0.10),0_14px_40px_-10px_rgba(255,255,255,0.10)] transition hover:brightness-110 active:scale-[0.98]"
                >
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition duration-700 group-hover/btn:translate-x-full" />
                  <Upload size={18} strokeWidth={2.4} />
                  Choose Audio File
                </button>

                {error && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-3.5 py-2 text-[13px] text-red-400 ring-1 ring-red-500/20">
                    <AlertCircle size={15} />
                    {error}
                  </div>
                )}

                <div className="mt-8 flex items-center gap-2">
                  {["MP3", "WAV", "M4A", "OGG", "AAC", "FLAC"].map((f) => (
                    <span
                      key={f}
                      className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 font-mono text-[11px] font-medium tracking-wide text-white/55"
                    >
                      {f}
                    </span>
                  ))}
                  <span className="ml-1.5 text-[12px] text-white/30">Up to 50 MB</span>
                </div>
              </div>
            ) : (
              <div className="relative flex flex-col items-center px-8 py-14 text-center md:py-18">
                <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.06] ring-1 ring-white/10">
                  <Loader2 size={26} className="animate-spin text-volt-300" />
                </div>
                <p className="text-[17px] font-medium text-white">{loadingStatus}</p>
                <p className="mt-1 max-w-sm truncate font-mono text-[13.5px] text-white/50">
                  {loadingFileName}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Safe backend processing note */}
        <div className="mt-6 flex flex-col items-center gap-3">
          <p className="flex items-center gap-1.5 text-[12.5px] text-white/30">
            <Lock size={12} /> Safe backend processing. Your API keys and music stay protected.
          </p>
        </div>
      </main>

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
    </div>
  );
}

function FloatingReel({ className, bg, line }: { className: string; bg: string; line: string }) {
  return (
    <div
      className={cx(
        "pointer-events-none absolute z-0 hidden w-[190px] animate-float xl:block 2xl:w-[220px]",
        className,
      )}
    >
      <div className="relative aspect-[9/16] overflow-hidden rounded-[22px] opacity-55 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_30px_80px_-20px_rgba(0,0,0,0.9)] [container-type:inline-size]">
        <ReelBackground bgId={bg} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/70" />
        <div
          className="absolute inset-x-[10%] top-1/2 -translate-y-1/2 text-center"
          style={{ fontFamily: "'Doto', monospace", fontWeight: 800, textTransform: "uppercase" }}
        >
          <p className="text-[7cqw] text-white/40">I keep driving</p>
          <p className="mt-[2cqw] text-[11cqw] leading-[1.05] tracking-[-0.02em]">
            <span className="text-white">{line.split(" ").slice(0, 2).join(" ")}</span>{" "}
            <span className="text-white/35">{line.split(" ").slice(2).join(" ")}</span>
          </p>
        </div>
        <div className="absolute inset-x-[8%] bottom-[8%] h-[1.4cqw] overflow-hidden rounded-full bg-white/20">
          <div className="h-full w-2/5 bg-volt-400" />
        </div>
      </div>
    </div>
  );
}
