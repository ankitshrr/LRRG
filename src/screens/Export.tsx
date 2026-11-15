import { useEffect, useRef, useState } from "react";
import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import fixWebmDuration from "fix-webm-duration";
import {
  Check,
  Download,
  Film,
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Music,
  Play,
  RefreshCw,
  Send,
  Share2,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import {
  BACKGROUNDS,
  FONTS,
  TRACK,
  activeIndex,
  fmt,
  getLineWordsWithTimings,
  normalizeLyricalLines,
  splitWordsIntoSubLines,
  splitWordsIntoSentenceGroups,
  splitTextIntoSentenceGroups,
  type Line,
  type ReelStyle,
  type TrackInfo,
} from "../data";
import type { Player } from "../player";
import { Ambient, ReelPreview } from "../components/ReelPreview";
import { Segmented, Toggle, cx } from "../components/ui";
import {
  drawCanvasFrame,
  preloadBgImage,
  roundRect,
  bgImageCache,
} from "../services/videoRenderer";

type Platform = "reels" | "shorts";
type Res = "720" | "1080" | "2160";
type Fps = "24" | "30" | "60";

const RESOLUTIONS: { id: Res; size: string; name: string; tag?: string; mbPerMin: number }[] = [
  { id: "1080", size: "1080 × 1920", name: "Full HD", tag: "Recommended", mbPerMin: 16 },
  { id: "720", size: "720 × 1280", name: "HD", mbPerMin: 8 },
  { id: "2160", size: "2160 × 3840", name: "4K Ultra HD", tag: "Pro", mbPerMin: 48 },
];

function formatSrtTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);

  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function generateSrtContent(lines: Line[], startOffset = 0, duration = Infinity): string {
  const filtered = lines.filter((l) => l.end >= startOffset && l.start <= startOffset + duration);
  return filtered
    .map((l, i) => {
      const relStart = Math.max(0, l.start - startOffset);
      const relEnd = Math.min(duration, Math.max(relStart + 0.5, l.end - startOffset));
      return `${i + 1}\n${formatSrtTime(relStart)} --> ${formatSrtTime(relEnd)}\n${l.text.trim()}\n`;
    })
    .join("\n");
}

function generateLrcContent(lines: Line[], track?: TrackInfo): string {
  const headers = [
    `[ti:${track?.title || "Reel"}]`,
    `[ar:${track?.artist || "Artist"}]`,
    `[by:Song-to-Lyrics Reel Maker]`,
  ];
  const lyrics = lines.map((l) => {
    const min = Math.floor(l.start / 60);
    const sec = (l.start % 60).toFixed(2);
    const timeStr = `[${String(min).padStart(2, "0")}:${sec.padStart(5, "0")}]`;
    return `${timeStr}${l.text.trim()}`;
  });
  return [...headers, "", ...lyrics].join("\n");
}

function triggerDownload(blob: Blob, filename: string) {
  const safeName = filename.endsWith(".mp4") || filename.endsWith(".srt") || filename.endsWith(".lrc")
    ? filename
    : `${filename}.mp4`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // Keep ObjectURL alive for 15 seconds so browser finishes disk write without corruption
  setTimeout(() => {
    try {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
  }, 15000);
}


async function preloadAssetsForExport(
  style: ReelStyle,
  audioUrl?: string,
): Promise<{ audioBlob: Blob | null }> {
  const imageUrl = style.customBgUrl || BACKGROUNDS.find((b) => b.id === style.bg)?.image;
  if (imageUrl) {
    await preloadBgImage(imageUrl);
  }

  let audioBlob: Blob | null = null;
  if (audioUrl) {
    try {
      const res = await fetch(audioUrl);
      if (res.ok) {
        audioBlob = await res.blob();
      }
    } catch (e) {
      console.warn("Could not pre-fetch audio blob:", e);
    }
  }

  return { audioBlob };
}

async function recordCanvasReel({
  lines,
  style,
  track,
  targetDuration,
  startOffset = 0,
  fps = 30,
  resolution = "1080",
  audioUrl,
  platformUI = false,
  platform = "reels",
  watermark = false,
  onProgress,
  signal,
}: {
  lines: Line[];
  style: ReelStyle;
  track: TrackInfo;
  targetDuration: number;
  startOffset?: number;
  fps: number;
  resolution: Res;
  audioUrl?: string;
  platformUI?: boolean;
  platform?: Platform;
  watermark?: boolean;
  onProgress: (p: number, frame: number, total: number, elapsed: number) => void;
  signal?: { cancelled: boolean };
}): Promise<{ blob: Blob; ext: string }> {
  const w = resolution === "720" ? 720 : resolution === "2160" ? 2160 : 1080;
  const h = resolution === "720" ? 1280 : resolution === "2160" ? 3840 : 1920;
  const videoBitrate =
    resolution === "2160" ? 24_000_000 : resolution === "720" ? 8_000_000 : 14_000_000;

  // 1. Preload master assets
  const { audioBlob } = await preloadAssetsForExport(style, audioUrl);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: false })!;

  const totalFrames = Math.max(1, Math.round(targetDuration * fps));
  const frameTimeSec = 1 / fps;
  const frameTimeMicros = Math.round(1_000_000 / fps);
  const startTime = performance.now();

  let videoBlob: Blob | null = null;
  const hasWebCodecs = typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";

  if (hasWebCodecs) {
    try {
      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
          codec: "avc",
          width: w,
          height: h,
        },
        fastStart: "in-memory",
        firstTimestampBehavior: "offset",
      });

      let encoderError: Error | null = null;
      const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => {
          encoderError = e;
          console.error("WebCodecs VideoEncoder error:", e);
        },
      });

      videoEncoder.configure({
        codec: "avc1.640028", // H.264 High Profile Level 4.2
        width: w,
        height: h,
        bitrate: videoBitrate,
        framerate: fps,
      });

      for (let frame = 0; frame < totalFrames; frame++) {
        if (signal?.cancelled) {
          videoEncoder.close();
          throw new Error("Export cancelled");
        }
        if (encoderError) {
          throw encoderError;
        }

        const currentTime = startOffset + frame * frameTimeSec;
        drawCanvasFrame(
          ctx,
          w,
          h,
          currentTime,
          targetDuration + startOffset,
          lines,
          style,
          track,
          {
            platformUI,
            platform,
            watermark,
          },
        );

        const videoFrame = new VideoFrame(canvas, {
          timestamp: frame * frameTimeMicros,
          duration: frameTimeMicros,
        });
        videoEncoder.encode(videoFrame, { keyFrame: frame % (fps * 2) === 0 });
        videoFrame.close();

        if (frame % 4 === 0 || frame === totalFrames - 1) {
          const elapsed = (performance.now() - startTime) / 1000;
          onProgress((frame + 1) / totalFrames, frame + 1, totalFrames, elapsed);
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      await videoEncoder.flush();
      videoEncoder.close();
      muxer.finalize();

      videoBlob = new Blob([muxer.target.buffer], { type: "video/mp4" });
    } catch (e) {
      console.warn("WebCodecs encoding fallback:", e);
      videoBlob = null;
    }
  }

  // Fallback: If WebCodecs was not available or threw an error
  if (!videoBlob) {
    const stream = canvas.captureStream(0);
    const trackObj = stream.getVideoTracks()[0] as any;
    const supported = [
      { type: "video/mp4;codecs=avc1", ext: "mp4" },
      { type: "video/mp4", ext: "mp4" },
      { type: "video/webm;codecs=vp9", ext: "webm" },
      { type: "video/webm", ext: "webm" },
    ];
    const selected = supported.find(
      (s) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(s.type),
    ) || { type: "video/webm", ext: "webm" };

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: selected.type,
      videoBitsPerSecond: videoBitrate,
    });
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.start(100);

    for (let frame = 0; frame < totalFrames; frame++) {
      if (signal?.cancelled) {
        recorder.stop();
        throw new Error("Export cancelled");
      }
      const currentTime = startOffset + frame * frameTimeSec;
      drawCanvasFrame(
        ctx,
        w,
        h,
        currentTime,
        targetDuration + startOffset,
        lines,
        style,
        track,
        {
          platformUI,
          platform,
          watermark,
        },
      );
      if (trackObj && typeof trackObj.requestFrame === "function") {
        trackObj.requestFrame();
      }
      if (frame % 4 === 0 || frame === totalFrames - 1) {
        const elapsed = (performance.now() - startTime) / 1000;
        onProgress((frame + 1) / totalFrames, frame + 1, totalFrames, elapsed);
        await new Promise((r) => setTimeout(r, Math.round(frameTimeSec * 1000)));
      } else {
        await new Promise((r) => setTimeout(r, Math.round(frameTimeSec * 1000)));
      }
    }

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    videoBlob = new Blob(chunks, { type: selected.type });
  }

  // 2. Finalization Stage: High-Fidelity Server FFmpeg Finalizer
  // Remuxes H.264 video with pristine 320k AAC 48kHz stereo music and faststart moov metadata
  try {
    const formData = new FormData();
    formData.append("video", videoBlob, "video.mp4");
    if (audioBlob) {
      formData.append("audio", audioBlob, "music.tmp");
    }
    formData.append("startOffset", String(startOffset));
    formData.append("targetDuration", String(targetDuration));
    formData.append("fps", String(fps));
    formData.append("resolution", resolution);

    const res = await fetch("/api/finalize-video", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const finalMp4 = await res.blob();
      return { blob: finalMp4, ext: "mp4" };
    }
  } catch (err) {
    console.warn("Server FFmpeg finalizer unavailable, using client output:", err);
  }

  // Client-side fallback if server finalize is unreachable
  return { blob: videoBlob, ext: "mp4" };
}

export type ClipOption = "10" | "15" | "30" | "full" | "custom";
export type StartOption = "zero" | "playhead";

export function Export({
  track = TRACK,
  lines,
  style,
  player,
}: {
  track?: TrackInfo;
  lines: Line[];
  style: ReelStyle;
  player: Player;
}) {
  const [platform, setPlatform] = useState<Platform>("reels");
  const [res, setRes] = useState<Res>("1080");
  const [fps, setFps] = useState<Fps>("30");
  const [clipOption, setClipOption] = useState<ClipOption>("10");
  const [startFrom, setStartFrom] = useState<StartOption>("zero");
  const [customSec, setCustomSec] = useState<number>(10);
  const [fade, setFade] = useState(true);
  const [watermark, setWatermark] = useState(false);
  const [srt, setSrt] = useState(true);
  const [safe, setSafe] = useState(false);
  const [platformUI, setPlatformUI] = useState(false);
  const [state, setState] = useState<"idle" | "rendering" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [toast, setToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedExt, setRecordedExt] = useState<string>("mp4");
  const abortRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  const r = RESOLUTIONS.find((x) => x.id === res)!;
  const fpsFactor = fps === "60" ? 1.6 : fps === "24" ? 0.85 : 1;

  const durationVal =
    clipOption === "10"
      ? 10
      : clipOption === "15"
        ? 15
        : clipOption === "30"
          ? 30
          : clipOption === "custom"
            ? customSec
            : Math.max(5, player.duration || 90);

  const startOffset =
    startFrom === "playhead"
      ? Math.max(0, Math.min(player.time, Math.max(0, (player.duration || 90) - 2)))
      : 0;

  const targetDuration =
    clipOption === "full"
      ? Math.max(5, (player.duration || 90) - startOffset)
      : Math.min(durationVal, Math.max(2, (player.duration || 90) - startOffset));

  const sizeMb = (r.mbPerMin * fpsFactor * targetDuration) / 60;
  const frames = Math.round(targetDuration * Number(fps));
  const baseTitle =
    (track.title || "lyriq-reel")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "lyriq-music-video";
  const fileName = `${baseTitle}.mp4`;

  // Changing any output setting invalidates a finished render.
  const change =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v);
      if (state === "done") setState("idle");
    };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    BACKGROUNDS.forEach((b) => {
      if (b.image) preloadBgImage(b.image);
    });
  }, []);

  const handleExportAndDownload = async () => {
    // If already rendered, download immediately
    if (state === "done" && recordedBlob) {
      triggerDownload(recordedBlob, fileName);
      setToastMsg(`Downloaded ${fileName}!`);
      setToast(true);
      return;
    }

    abortRef.current = { cancelled: false };
    setState("rendering");
    setProgress(0);
    setElapsedSec(0);

    try {
      const { blob, ext } = await recordCanvasReel({
        lines,
        style,
        track,
        targetDuration,
        startOffset,
        fps: Number(fps) || 30,
        resolution: res,
        audioUrl: track.audioUrl,
        platformUI,
        platform,
        watermark,
        onProgress: (p, f, tot, el) => {
          setProgress(p);
          setElapsedSec(el);
        },
        signal: abortRef.current,
      });

      setRecordedBlob(blob);
      setRecordedExt(ext || "mp4");
      setState("done");

      // Auto-download MP4 video file immediately when render finishes
      triggerDownload(blob, fileName);
      setToastMsg(`Video exported! Downloaded ${fileName}`);
      setToast(true);
    } catch (err: any) {
      if (!abortRef.current.cancelled) {
        console.error("Video recording error:", err);
        setState("idle");
        setToastMsg("Export failed: " + (err?.message || "Browser error"));
        setToast(true);
      }
    }
  };

  const handleDownloadOnly = () => {
    if (recordedBlob) {
      triggerDownload(recordedBlob, fileName);
      setToastMsg(`Downloaded ${fileName}!`);
      setToast(true);
    } else {
      handleExportAndDownload();
    }
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_400px]">
      {/* stage */}
      <main className="dot-grid relative flex min-h-[760px] flex-col items-center justify-center overflow-hidden px-6 py-16 lg:min-h-0">
        <div className="absolute top-4 flex items-center gap-1 glass rounded-full p-1 ring-1 ring-white/[0.08]">
          <ChipToggle on={safe} onClick={() => setSafe(!safe)} icon={<ShieldCheck size={13} />}>
            Safe zones
          </ChipToggle>
          <ChipToggle
            on={platformUI}
            onClick={() => setPlatformUI(!platformUI)}
            icon={<Film size={13} />}
          >
            {platform === "reels" ? "Reels" : "Shorts"} interface
          </ChipToggle>
        </div>

        <div className="relative">
          <Ambient bgId={style.bg} className="-inset-14" />
          <ReelPreview
            lines={lines}
            time={player.time}
            duration={player.duration}
            style={style}
            playing={player.playing}
            track={track}
            onToggle={player.toggle}
            onPrev={player.prev}
            onNext={player.next}
            onSeek={player.seek}
            controls={!platformUI}
            className="h-[640px] lg:h-[min(calc(100vh-170px),880px)]"
            overlay={
              <>
                {platformUI && (
                  <PlatformOverlay
                    platform={platform}
                    playing={player.playing}
                    onToggle={player.toggle}
                    track={track}
                  />
                )}
                {safe && <SafeZones />}
                {watermark && (
                  <div className="absolute right-[5cqw] top-[12cqw] rounded-md bg-black/30 px-[2cqw] py-[0.8cqw] text-[2.6cqw] font-semibold tracking-wide text-white/70 backdrop-blur">
                    LYRIQ
                  </div>
                )}
              </>
            }
          />
        </div>

        <p className="absolute bottom-4 flex items-center gap-2 text-[11.5px] text-white/35">
          <span className="h-1.5 w-1.5 rounded-full bg-volt-400" />
          Final preview · {r.size} · {fps} fps · {fmt(player.duration)}
        </p>

        {toast && (
          <div className="absolute bottom-12 flex animate-rise items-center gap-3 glass rounded-full py-2.5 pl-3 pr-4 text-[13px] shadow-2xl ring-1 ring-white/10 backdrop-blur">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white/15 text-white">
              <Download size={13} />
            </span>
            <span>{toastMsg || `Downloading ${fileName}`}</span>
          </div>
        )}
      </main>

      {/* settings */}
      <aside className="flex min-h-0 flex-col border-white/[0.06] glass lg:border-l">
        <div className="flex-1 overflow-y-auto">
          <div className="border-b border-white/[0.06] px-6 py-5">
            <h2 className="text-[18px] font-semibold tracking-[-0.02em]">Export your Reel</h2>
            <p className="mt-1 text-[13px] text-white/45">
              Optimized for vertical, full-screen playback.
            </p>
          </div>

          <div className="space-y-6 px-6 py-6">
            <Group title="Format">
              <div className="grid grid-cols-2 gap-2.5">
                <PlatformCard
                  on={platform === "reels"}
                  onClick={() => change(setPlatform)("reels")}
                  icon={<InstagramGlyph />}
                  name="Instagram Reels"
                />
                <PlatformCard
                  on={platform === "shorts"}
                  onClick={() => change(setPlatform)("shorts")}
                  icon={<ShortsGlyph />}
                  name="YouTube Shorts"
                />
              </div>
            </Group>

            <Group title="Resolution">
              <div className="space-y-2">
                {RESOLUTIONS.map((x) => {
                  const on = res === x.id;
                  return (
                    <button
                      key={x.id}
                      onClick={() => change(setRes)(x.id)}
                      className={cx(
                        "flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left ring-1 transition",
                        on
                          ? "bg-volt-500/[0.1] ring-volt-400/60"
                          : "bg-white/[0.02] ring-white/[0.07] hover:bg-white/[0.04]",
                      )}
                    >
                      <span
                        className={cx(
                          "grid h-4 w-4 place-items-center rounded-full ring-1",
                          on ? "bg-white text-black ring-volt-400" : "ring-white/25",
                        )}
                      >
                        {on && <span className="h-1.5 w-1.5 rounded-full bg-black" />}
                      </span>
                      <div className="flex-1">
                        <p className="font-mono text-[13.5px] text-white">{x.size}</p>
                        <p className="text-[11.5px] text-white/40">{x.name}</p>
                      </div>
                      {x.tag && (
                        <span
                          className={cx(
                            "rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                            x.tag === "Pro"
                              ? "bg-neutral-200/10 text-white ring-1 ring-neutral-200/20"
                              : "bg-volt-500/15 text-volt-300",
                          )}
                        >
                          {x.tag}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </Group>

            <Group title="Video duration">
              <Segmented<ClipOption>
                value={clipOption}
                onChange={change(setClipOption)}
                options={[
                  { value: "10", label: "10s (Reel)" },
                  { value: "15", label: "15s" },
                  { value: "30", label: "30s" },
                  { value: "full", label: "Full Song" },
                  { value: "custom", label: "Custom" },
                ]}
              />
              {clipOption === "custom" && (
                <div className="mt-2.5 flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/[0.08]">
                  <span className="text-[12px] text-white/50">Duration:</span>
                  <input
                    type="range"
                    min={3}
                    max={Math.min(180, Math.round(player.duration || 90))}
                    value={customSec}
                    onChange={(e) => change(setCustomSec)(Number(e.target.value))}
                    className="flex-1 accent-volt-400"
                  />
                  <span className="w-12 text-right font-mono text-[12px] text-white">
                    {customSec}s
                  </span>
                </div>
              )}
            </Group>

            <Group title="Start time">
              <Segmented<StartOption>
                value={startFrom}
                onChange={change(setStartFrom)}
                options={[
                  { value: "zero", label: "0:00 (Beginning)" },
                  { value: "playhead", label: `From ${fmt(player.time).slice(0, -1)}` },
                ]}
              />
            </Group>

            <Group title="Frame rate">
              <Segmented<Fps>
                value={fps}
                onChange={change(setFps)}
                options={[
                  { value: "24", label: "24 fps" },
                  { value: "30", label: "30 fps" },
                  { value: "60", label: "60 fps" },
                ]}
              />
            </Group>

            <Group title="Options">
              <div className="divide-y divide-white/[0.05] rounded-xl bg-white/[0.02] ring-1 ring-white/[0.07]">
                <OptionRow
                  title="Fade audio in & out"
                  desc="Smooth 0.5s fades"
                  on={fade}
                  onChange={change(setFade)}
                />
                <OptionRow
                  title="Include .srt captions"
                  desc="For accessibility & SEO"
                  on={srt}
                  onChange={change(setSrt)}
                />
                <OptionRow
                  title="Lyriq watermark"
                  desc="Small corner mark"
                  on={watermark}
                  onChange={change(setWatermark)}
                />
              </div>
            </Group>

            <div className="rounded-xl bg-gradient-to-b from-white/[0.04] to-transparent p-4 ring-1 ring-white/[0.07]">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-volt-500/15 text-volt-300">
                  <Film size={18} />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-mono text-[12.5px] text-white">{fileName}</p>
                  <p className="text-[11.5px] text-white/40">MP4 · H.264 · AAC 320 kbps</p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  [
                    "Range",
                    `${fmt(startOffset).slice(0, -1)} → ${fmt(startOffset + targetDuration).slice(0, -1)}`,
                  ],
                  ["Duration", `${targetDuration.toFixed(1)}s`],
                  ["Est. size", `${sizeMb.toFixed(1)} MB`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-black/20 py-2">
                    <dt className="text-[10px] uppercase tracking-[0.1em] text-white/35">{k}</dt>
                    <dd className="mt-0.5 font-mono text-[12px] text-white">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>

        {/* actions */}
        <div className="border-t border-white/[0.06] bg-black/20 p-5">
          {state === "rendering" ? (
            <div className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-volt-400/25">
              <div className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2 font-medium">
                  <Loader2 size={15} className="animate-spin text-volt-300" /> Rendering your Reel
                </span>
                <button
                  onClick={() => setState("idle")}
                  aria-label="Cancel export"
                  className="text-white/40 hover:text-white"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-volt-600 via-volt-400 to-white shadow-[0_0_12px_rgba(255,255,255,0.10)]"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between font-mono text-[11px] text-white/45">
                <span>
                  {elapsedSec > 0
                    ? `${elapsedSec.toFixed(1)}s / ${targetDuration.toFixed(1)}s`
                    : `Frame ${Math.round(progress * frames).toLocaleString()} / ${frames.toLocaleString()}`}
                </span>
                <span className="text-white/80">{Math.round(progress * 100)}%</span>
              </div>
            </div>
          ) : (
            <>
              {state === "done" && (
                <div className="mb-3 flex animate-fade items-center gap-2.5 rounded-xl bg-volt-500/10 px-3.5 py-2.5 text-[12.5px] ring-1 ring-volt-400/30">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-volt-400 text-black">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span className="font-medium text-white">Video Ready ({targetDuration.toFixed(1)}s · {r.size})</span>
                  <span className="ml-auto font-mono text-[11.5px] text-white/60">
                    {sizeMb.toFixed(1)} MB
                  </span>
                </div>
              )}

              <div className="flex gap-2.5">
                <button
                  onClick={handleExportAndDownload}
                  className="flex h-12 flex-1 items-center justify-center gap-2.5 rounded-xl bg-white text-[14px] font-semibold text-black shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_0_0_1px_rgba(255,255,255,0.10),0_12px_32px_-10px_rgba(255,255,255,0.25)] transition hover:bg-neutral-100 active:scale-[0.98]"
                >
                  <Download size={17} strokeWidth={2.5} />
                  {state === "done" ? "Download Video Again (MP4)" : "Download Video (MP4)"}
                </button>

                {state === "done" && (
                  <button
                    onClick={() => {
                      setState("idle");
                      handleExportAndDownload();
                    }}
                    title="Re-render video"
                    className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] px-4 text-[13px] font-medium text-white ring-1 ring-white/10 hover:bg-white/[0.1] active:scale-[0.98]"
                  >
                    <RefreshCw size={15} />
                    Re-render
                  </button>
                )}
              </div>

              {/* Subtitle & text files (clearly differentiated so never mistaken for video) */}
              <div className="mt-4 border-t border-white/[0.06] pt-3">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-white/35">
                  Optional Subtitles & Lyrics
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const srtBlob = new Blob([generateSrtContent(lines, startOffset, targetDuration)], {
                        type: "text/plain;charset=utf-8",
                      });
                      triggerDownload(srtBlob, `${baseTitle}-captions.srt`);
                      setToastMsg(`Downloaded ${baseTitle}-captions.srt!`);
                      setToast(true);
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] py-1.5 text-[11.5px] font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
                  >
                    <Download size={12} className="text-volt-300" /> Subtitles (.srt)
                  </button>
                  <button
                    onClick={() => {
                      const lrcBlob = new Blob([generateLrcContent(lines, track)], {
                        type: "text/plain;charset=utf-8",
                      });
                      triggerDownload(lrcBlob, `${baseTitle}-lyrics.lrc`);
                      setToastMsg(`Downloaded ${baseTitle}-lyrics.lrc!`);
                      setToast(true);
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] py-1.5 text-[11.5px] font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
                  >
                    <Download size={12} className="text-cyan-300" /> Synced (.lrc)
                  </button>
                </div>
              </div>

              <p className="mt-2 text-center text-[11px] text-white/40">
                {state === "done"
                  ? "Click 'Download Video Again' to re-save your MP4 file"
                  : "One click renders high-definition MP4 video and saves it directly to your device"}
              </p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-white/40">
        {title}
      </h3>
      {children}
    </div>
  );
}

function OptionRow({
  title,
  desc,
  on,
  onChange,
}: {
  title: string;
  desc: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between px-3.5 py-3">
      <div>
        <p className="text-[13px] text-white">{title}</p>
        <p className="text-[11.5px] text-white/40">{desc}</p>
      </div>
      <Toggle checked={on} onChange={onChange} />
    </div>
  );
}

function ChipToggle({
  on,
  onClick,
  icon,
  children,
}: {
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition",
        on ? "bg-white text-black" : "text-white/50 hover:text-white",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function PlatformCard({
  on,
  onClick,
  icon,
  name,
}: {
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  name: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "relative flex flex-col items-start gap-3 rounded-xl p-3.5 text-left ring-1 transition",
        on
          ? "bg-volt-500/[0.1] ring-volt-400/60 shadow-[0_0_24px_-10px_rgba(255,255,255,0.10)]"
          : "bg-white/[0.02] ring-white/[0.07] hover:bg-white/[0.04]",
      )}
    >
      {icon}
      <div>
        <p className="text-[13px] font-medium leading-tight text-white">{name}</p>
        <p className="mt-0.5 text-[11px] text-white/40">9:16 · 1080p</p>
      </div>
      {on && (
        <span className="absolute right-3 top-3 grid h-4 w-4 place-items-center rounded-full bg-white text-black">
          <Check size={10} strokeWidth={3.5} />
        </span>
      )}
    </button>
  );
}

function InstagramGlyph() {
  return (
    <div className="grid h-8 w-8 place-items-center rounded-[9px] bg-white">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.2">
        <rect x="3" y="3" width="18" height="18" rx="5.5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.3" cy="6.7" r="0.9" fill="black" stroke="none" />
      </svg>
    </div>
  );
}

function ShortsGlyph() {
  return (
    <div className="grid h-8 w-8 place-items-center rounded-[9px] bg-white">
      <svg width="14" height="16" viewBox="0 0 14 16" fill="black">
        <path d="M3 2.6v10.8a.8.8 0 0 0 1.2.7l8.6-5.4a.8.8 0 0 0 0-1.4L4.2 1.9A.8.8 0 0 0 3 2.6Z" />
      </svg>
    </div>
  );
}

function SafeZones() {
  const hatch =
    "repeating-linear-gradient(135deg, rgba(255,255,255,0.14) 0 6px, transparent 6px 12px)";
  return (
    <div className="pointer-events-none absolute inset-0 animate-fade">
      <div
        className="absolute inset-x-0 top-0 h-[12%] border-b border-dashed border-white/50"
        style={{ background: hatch }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[22%] border-t border-dashed border-white/50"
        style={{ background: hatch }}
      />
      <div
        className="absolute bottom-[22%] right-0 top-[12%] w-[14%] border-l border-dashed border-white/50"
        style={{ background: hatch }}
      />
      <div className="absolute bottom-[22%] left-[6%] right-[14%] top-[12%] rounded-lg border border-white/60">
        <span className="absolute left-2 top-2 rounded bg-white/90 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-black">
          Safe area
        </span>
      </div>
    </div>
  );
}

function PlatformOverlay({
  platform,
  playing,
  onToggle,
  track = TRACK,
}: {
  platform: Platform;
  playing: boolean;
  onToggle: () => void;
  track?: TrackInfo;
}) {
  const actions =
    platform === "reels"
      ? [
          [Heart, "48.2K"],
          [MessageCircle, "1,204"],
          [Send, "3.1K"],
          [MoreHorizontal, ""],
        ]
      : [
          [ThumbsUp, "92K"],
          [ThumbsDown, "Dislike"],
          [MessageCircle, "2,318"],
          [Share2, "Share"],
        ];
  return (
    <div className="absolute inset-0 animate-fade" onClick={onToggle}>
      {!playing && (
        <div className="absolute left-1/2 top-1/2 grid h-[18cqw] w-[18cqw] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/40 ring-1 ring-white/20 backdrop-blur-md">
          <Play className="ml-[1cqw] h-[7cqw] w-[7cqw]" fill="white" />
        </div>
      )}
      <div className="absolute bottom-[8%] right-[4cqw] flex flex-col items-center gap-[5cqw]">
        {actions.map(([Icon, label], i) => {
          const I = Icon as typeof Heart;
          return (
            <div key={i} className="flex flex-col items-center gap-[1cqw]">
              <I className="h-[7.5cqw] w-[7.5cqw] drop-shadow" strokeWidth={2} />
              {label && <span className="text-[2.8cqw] font-medium">{label as string}</span>}
            </div>
          );
        })}
        <div className="h-[8cqw] w-[8cqw] rounded-lg bg-gradient-to-br from-volt-300 to-neutral-500 ring-2 ring-white/80" />
      </div>
      <div className="absolute bottom-[6%] left-[5cqw] right-[22cqw] text-left">
        <div className="flex items-center gap-[2cqw]">
          <div className="h-[8cqw] w-[8cqw] rounded-full bg-gradient-to-br from-neutral-200 to-neutral-700 ring-1 ring-white/50" />
          <span className="text-[3.6cqw] font-semibold">{track.artist?.toLowerCase().replace(/\s+/g, "") || "artist"}</span>
          <span className="rounded-md border border-white/70 px-[2cqw] py-[0.4cqw] text-[3cqw] font-semibold">
            {platform === "reels" ? "Follow" : "Subscribe"}
          </span>
        </div>
        <p className="mt-[2cqw] text-[3.4cqw] text-white/90">{track.title || "lyric reel"}</p>
        <p className="mt-[1.5cqw] flex items-center gap-[1.5cqw] text-[3cqw] text-white/80">
          <Music className="h-[3.2cqw] w-[3.2cqw]" /> {track.artist} · {track.title}
        </p>
      </div>
      {platform === "shorts" && (
        <div className="absolute inset-x-0 bottom-0 h-[0.8cqw] bg-white/20">
          <div className="h-full w-1/3 bg-white" />
        </div>
      )}
    </div>
  );
}
