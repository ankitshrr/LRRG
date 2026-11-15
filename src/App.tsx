import { Component, useCallback, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import {
  DEFAULT_STYLE,
  INITIAL_LINES,
  TRACK,
  createTrackFromFile,
  normalizeLyricalLines,
  type Line,
  type ReelStyle,
  type TrackInfo,
} from "./data";
import { usePlayer } from "./player";
import { TopBar, type Screen } from "./components/TopBar";
import { Landing } from "./screens/Landing";
import { Editor } from "./screens/Editor";
import { Sync } from "./screens/Sync";
import { Export } from "./screens/Export";
import { NothingLiveLyrics } from "./components/lyrics/NothingLiveLyrics";
import { identifyAndFetchLyrics } from "./services/lyricsService";

class ScreenErrorBoundary extends Component<
  { children: ReactNode; onReset: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; onReset: () => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Screen crashed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <div className="max-w-md rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-white backdrop-blur">
            <h2 className="text-[17px] font-semibold text-red-300">Something went wrong</h2>
            <p className="mt-2 text-[13px] text-white/70">
              {this.state.error?.message || "An unexpected error occurred in this view."}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                this.props.onReset();
              }}
              className="mt-4 rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-black transition hover:bg-white/90"
            >
              Back to Lyrics & Style
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  // Deep-link support (#editor, #lyrics, #sync, #export) for reviewing individual screens.
  const [screen, setScreenState] = useState<Screen>(() => {
    const h = window.location.hash.slice(1);
    return (["editor", "lyrics", "sync", "export"] as const).find((s) => s === h) ?? "landing";
  });
  const setScreen = useCallback((s: Screen) => {
    setScreenState(s);
    history.replaceState(null, "", s === "landing" ? " " : `#${s}`);
  }, []);

  const [track, setTrack] = useState<TrackInfo>(TRACK);
  const [lines, setLines] = useState<Line[]>(INITIAL_LINES);
  const [style, setStyle] = useState<ReelStyle>(DEFAULT_STYLE);

  const handleDurationChange = useCallback((dur: number) => {
    setTrack((prev) => ({ ...prev, duration: Math.round(dur) }));
  }, []);

  const player = usePlayer(
    track.duration,
    lines,
    0,
    track.audioUrl,
    handleDurationChange,
  );

  const handleAudioSelected = useCallback(
    (newTrack: TrackInfo, newLines?: Line[]) => {
      setTrack(newTrack);
      if (newLines && newLines.length > 0) {
        setLines(normalizeLyricalLines(newLines));
      }
      setScreen("editor");
      player.seek(0);
    },
    [setScreen, player.seek],
  );

  const handleUploadAudioFromAnywhere = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file);
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

    try {
      const res = await identifyAndFetchLyrics(file, dur);
      if (res.success && res.lines && res.lines.length > 0) {
        setTrack({
          title: res.title || file.name.replace(/\.[^/.]+$/, ""),
          artist: res.artist || "Identified Artist",
          file: file.name,
          sizeMb: Number((file.size / (1024 * 1024)).toFixed(1)),
          bpm: 120,
          duration: Math.round(dur),
          audioUrl: url,
        });
        setLines(normalizeLyricalLines(res.lines));
        return;
      }
    } catch {
      // Fallback below
    }

    const newTrack = createTrackFromFile(file, Math.round(dur), url);
    setTrack(newTrack);
  }, []);

  // Global transport shortcuts (ignored while typing).
  useEffect(() => {
    if (screen === "landing") return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]")) return;
      if (e.code === "Space") {
        e.preventDefault();
        player.toggle();
      } else if (e.key === "ArrowLeft") player.prev();
      else if (e.key === "ArrowRight") player.next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, player.toggle, player.prev, player.next]);

  if (screen === "landing") {
    return <Landing onAudioSelected={handleAudioSelected} />;
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950 lg:h-screen lg:overflow-hidden">
      <Backdrop />
      {screen !== "lyrics" && (
        <TopBar
          screen={screen}
          onNavigate={setScreen}
          track={track}
          onUploadAudio={handleUploadAudioFromAnywhere}
        />
      )}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <ScreenErrorBoundary onReset={() => setScreen("editor")}>
          {screen === "editor" && (
            <Editor
              track={track}
              lines={lines}
              setLines={setLines}
              style={style}
              setStyle={setStyle}
              player={player}
            />
          )}
          {screen === "lyrics" && (
            <NothingLiveLyrics
              track={track}
              lines={lines}
              setLines={setLines}
              player={player}
              onClose={() => setScreen("editor")}
            />
          )}
          {screen === "sync" && (
            <Sync track={track} lines={lines} setLines={setLines} style={style} player={player} />
          )}
          {screen === "export" && (
            <Export track={track} lines={lines} style={style} player={player} />
          )}
        </ScreenErrorBoundary>
      </div>
    </div>
  );
}

/** Soft monochrome light field behind the frosted-glass panels. */
function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
      <div className="absolute -left-40 top-20 h-[520px] w-[520px] rounded-full bg-white/[0.07] blur-[120px]" />
      <div className="absolute -right-32 bottom-0 h-[460px] w-[460px] rounded-full bg-white/[0.05] blur-[120px]" />
      <div className="absolute left-1/2 top-1/3 h-[380px] w-[380px] -translate-x-1/2 rounded-full bg-white/[0.04] blur-[100px]" />
    </div>
  );
}
