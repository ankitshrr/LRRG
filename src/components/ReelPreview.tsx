import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Airplay,
  ChevronDown,
  Heart,
  Laptop2,
  ListMusic,
  Maximize2,
  MessageSquareQuote,
  Pause,
  Play,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  Star,
  Timer,
  Volume2,
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
import { AlbumArt, cx } from "./ui";

type Props = {
  lines: Line[];
  time: number;
  duration: number;
  style: ReelStyle;
  playing: boolean;
  track?: TrackInfo;
  onToggle?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onSeek?: (t: number) => void;
  controls?: boolean;
  className?: string;
  overlay?: ReactNode;
};

export function ReelBackground({
  bgId,
  customBgUrl,
  customBgType,
  className,
}: {
  bgId: string;
  customBgUrl?: string;
  customBgType?: "image" | "video";
  className?: string;
}) {
  if (customBgUrl) {
    return (
      <div className={cx("absolute inset-0 overflow-hidden bg-black", className)}>
        {customBgType === "video" ? (
          <video
            src={customBgUrl}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <img
            src={customBgUrl}
            alt="Custom background"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </div>
    );
  }

  if (bgId === "applemusic") {
    return (
      <div className={cx("absolute inset-0 overflow-hidden bg-[#0a0410]", className)}>
        {/* Apple Music Fluid Liquid Glow Mesh with organic morphing keyframes */}
        <div className="absolute -top-[14%] -left-[18%] h-[85%] w-[92%] rounded-full bg-gradient-to-br from-[#FA2D48]/45 via-[#E94057]/35 to-[#8A2387]/30 blur-[70px] animate-[appleMesh1_12s_ease-in-out_infinite_alternate]" />
        <div className="absolute top-[28%] -right-[20%] h-[80%] w-[90%] rounded-full bg-gradient-to-tr from-[#9B51E0]/40 via-[#D81B60]/30 to-[#FA2D48]/35 blur-[75px] animate-[appleMesh2_16s_ease-in-out_infinite_alternate]" />
        <div className="absolute -bottom-[15%] left-[10%] h-[75%] w-[84%] rounded-full bg-gradient-to-t from-[#E94057]/35 via-[#8A2387]/30 to-[#4A00E0]/25 blur-[80px] animate-[appleMesh3_14s_ease-in-out_infinite_alternate]" />
        <div className="absolute top-[18%] left-[22%] h-[60%] w-[65%] rounded-full bg-gradient-to-r from-[#FA2D48]/25 to-[#9B51E0]/25 blur-[65px] animate-[appleMesh4_18s_ease-in-out_infinite_alternate]" />
        <div className="absolute inset-0 bg-black/25 backdrop-blur-[24px]" />
      </div>
    );
  }

  const bg = BACKGROUNDS.find((b) => b.id === bgId) ?? BACKGROUNDS[0];
  return (
    <div className={cx("absolute inset-0", className)} style={{ background: bg.css }}>
      {bg.image && (
        <img
          src={bg.image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover brightness-[0.7] contrast-125 grayscale"
          draggable={false}
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
    </div>
  );
}

/** Soft blurred glow of the reel background, placed behind the preview frame. */
export function Ambient({
  bgId,
  customBgUrl,
  className,
}: {
  bgId: string;
  customBgUrl?: string;
  className?: string;
}) {
  return (
    <div
      className={cx("pointer-events-none absolute opacity-40 blur-[90px] saturate-150", className)}
    >
      <ReelBackground bgId={bgId} customBgUrl={customBgUrl} className="rounded-[40px]" />
    </div>
  );
}

export function ReelPreview({
  lines,
  time,
  duration,
  style,
  playing,
  track = TRACK,
  onToggle,
  onPrev,
  onNext,
  onSeek,
  controls = true,
  className,
  overlay,
}: Props) {
  // Universally normalize lyrics lines to preserve complete sentences and accurate timestamps
  const normalizedLines = useMemo(() => normalizeLyricalLines(lines), [lines]);
  const font = FONTS.find((f) => f.id === style.font) ?? FONTS[0];
  const idx = activeIndex(normalizedLines, time);
  const current = idx >= 0 ? normalizedLines[idx] : null;
  const prev = idx > 0 ? normalizedLines[idx - 1] : null;
  const upcoming = normalizedLines.slice(idx + 1, idx + 4);
  const currentLen = current ? current.text.length : 0;

  // Fixed font size: completely constant across all lyrics lines without jumping or resizing
  const effectiveSize = style.size;

  const textStyle: CSSProperties = {
    fontFamily: font.family,
    fontWeight: font.weight,
    letterSpacing: font.tracking,
    textTransform: font.upper ? "uppercase" : "none",
    fontSize: style.animation === "spotify" ? `${(effectiveSize / 360) * 94}cqw` : `${(effectiveSize / 360) * 100}cqw`,
    lineHeight: style.animation === "apple" ? 1.18 : style.animation === "nothing" ? 1.25 : 1.18,
  };

  const safeTrack = track || TRACK;
  const isAiText = (str?: string) => !str || /groq|whisper|identified artist|upload audio/i.test(str);
  const cleanArtist = isAiText(safeTrack.artist) ? "" : safeTrack.artist;
  const cleanTitle = isAiText(safeTrack.title) ? "Audio Track" : safeTrack.title;

  const isApple = style.animation === "apple";
  const isSpotify = style.animation === "spotify";
  const isNothing = style.animation === "nothing";
  const isRetro = style.animation === "retro";
  const showPrev = !!prev;
  const visibleUpcoming = isSpotify
    ? upcoming.slice(0, currentLen > 60 ? 2 : 4)
    : upcoming.slice(0, currentLen > 50 ? 1 : 2);

  const textAlign = style.align || (isSpotify ? "left" : "center");
  const hAlign =
    textAlign === "left"
      ? "text-left items-start"
      : textAlign === "right"
        ? "text-right items-end"
        : "text-center items-center";

  // Vertical position container: strictly within Safe Zone boundaries [13% to 77%]
  const vPosContainer =
    style.position === "top"
      ? "top-[13%] bottom-[35%] justify-start"
      : style.position === "bottom"
        ? controls
          ? "top-[20%] bottom-[34%] justify-end"
          : "top-[20%] bottom-[23%] justify-end"
        : controls
          ? "top-[13%] bottom-[35%] justify-center"
          : "top-[13%] bottom-[23%] justify-center";

  const vPosInner =
    style.position === "top"
      ? "mt-0 mb-auto justify-start"
      : style.position === "bottom"
        ? "mt-auto mb-0 justify-end"
        : "my-auto justify-center";

  return (
    <div
      className={cx(
        "relative aspect-[9/16] select-none overflow-hidden rounded-[28px] bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.09),0_40px_120px_-30px_rgba(0,0,0,0.9),0_30px_80px_-40px_rgba(255,255,255,0.10)] [container-type:inline-size]",
        className,
      )}
    >
      <ReelBackground
        bgId={style.bg}
        customBgUrl={style.customBgUrl}
        customBgType={style.customBgType}
        className={cx(
          "transition-transform duration-[6000ms] ease-linear",
          playing && "scale-[1.06]",
        )}
      />

      {/* Only dim custom media backgrounds; preserve pure theme backgrounds */}
      {style.customBgUrl && (
        <div className="absolute inset-0 bg-black/45" />
      )}

      {/* top chrome */}
      {isSpotify ? (
        <div className="absolute inset-x-0 top-0 pt-[5cqw] px-[6cqw] flex flex-col items-center justify-center text-center pointer-events-none z-20">
          <h2 className="truncate max-w-[85%] font-sans text-[3.8cqw] font-black tracking-tight text-white leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
            {cleanTitle || "Spotify Track"}
          </h2>
          <p className="truncate max-w-[85%] font-sans text-[2.6cqw] font-semibold text-white/70 mt-[0.3cqw] drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
            {cleanArtist || "Spotify Artist"}
          </p>
        </div>
      ) : (
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-[5cqw]">
          {isApple ? (
            <div className="flex items-center gap-[1.5cqw] rounded-full bg-white/[0.12] px-[3.5cqw] py-[1.2cqw] shadow-[0_4px_20px_rgba(0,0,0,0.3)] ring-1 ring-white/20 backdrop-blur-xl">
              <span className="text-[2.8cqw] font-bold text-white/90"></span>
              <span className="font-sans text-[2.4cqw] font-bold tracking-[-0.01em] text-white/90">
                {cleanArtist ? cleanArtist.toUpperCase() : "LIVE LYRICS"}
              </span>
            </div>
          ) : isRetro ? (
            <div className="flex items-center gap-[1.5cqw] rounded-full border border-[#FBBF24]/30 bg-[#17120D]/90 px-[3.2cqw] py-[1.2cqw] shadow-md backdrop-blur-md">
              <span className="text-[2.4cqw] text-[#FBBF24]">📻</span>
              <span className="font-serif text-[2.3cqw] italic font-semibold text-[#FDE68A]">
                {cleanArtist || "Vintage Vinyl"}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-[1.8cqw] rounded-full border border-white/20 bg-black/80 px-[3.2cqw] py-[1.2cqw] font-mono shadow-2xl backdrop-blur-md">
              <span className="h-[1.5cqw] w-[1.5cqw] rounded-full bg-[#D71920] shadow-[0_0_8px_#D71920] animate-pulse" />
              <span className="text-[2.3cqw] font-bold tracking-[0.16em] text-white/90">
                {cleanArtist ? cleanArtist.toUpperCase() : "(N) NOW PLAYING"}
              </span>
            </div>
          )}

          <div className="flex h-[4cqw] items-end gap-[0.7cqw]">
            {[0.4, 0.9, 0.6, 1].map((h, i) => (
              <span
                key={i}
                className={cx(
                  "w-[0.8cqw] origin-bottom rounded-full",
                  playing && "animate-eq",
                  isRetro
                    ? "bg-[#FBBF24] shadow-[0_0_6px_#FBBF24]"
                    : style.animation === "nothing"
                      ? i === 1
                        ? "bg-[#D71920] shadow-[0_0_6px_#D71920]"
                        : "bg-white"
                      : "bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.4)]",
                )}
                style={{
                  height: `${h * 100}%`,
                  animationDelay: `${i * 0.16}s`,
                  transform: playing ? undefined : "scaleY(0.35)",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* safe lyrics compartment: strictly confined to the Safe Area (left 7%, right 15%, top 13%, bottom 23-35%) */}
      {isSpotify ? (
        <div
          className={cx(
            "absolute left-[7%] right-[15%] top-[15%] bottom-[23%] flex flex-col pointer-events-none transition-all duration-300",
            hAlign,
          )}
          style={textStyle}
        >
          {normalizedLines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-[2em] text-center w-full my-auto">
              <span
                className="text-[0.44em] tracking-[0.12em] opacity-45 uppercase font-mono"
                style={{ color: style.textColor }}
              >
                No audio track loaded
              </span>
              <span className="mt-[0.2em] text-[0.32em] opacity-30 text-white">
                Upload a song to see Spotify Reel
              </span>
            </div>
          ) : (
            <SpotifyFullLyricsStream
              lines={normalizedLines}
              activeIdx={idx}
              time={time}
              style={style}
              position={style.position}
              align={textAlign}
              font={font}
              effectiveSize={effectiveSize}
              onSeek={onSeek}
            />
          )}
        </div>
      ) : isApple ? (
        <div
          className={cx(
            "absolute left-[7%] right-[15%] top-[12%] flex flex-col pointer-events-none transition-all duration-300",
            controls ? "bottom-[34%]" : "bottom-[23%]",
            hAlign,
          )}
          style={textStyle}
        >
          {normalizedLines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-[2em] text-center w-full my-auto">
              <span className="text-[0.44em] tracking-[0.12em] opacity-45 uppercase font-sans font-bold text-white">
                 No audio track loaded
              </span>
              <span className="mt-[0.2em] text-[0.32em] opacity-30 text-white font-sans">
                Upload a song to see Apple Music Lyrics
              </span>
            </div>
          ) : (
            <AppleLyricsStream
              lines={normalizedLines}
              activeIdx={idx}
              time={time}
              style={style}
              position={style.position}
              align={textAlign}
              font={font}
              effectiveSize={effectiveSize}
              onSeek={onSeek}
            />
          )}
        </div>
      ) : (
        <div
          className={cx(
            "absolute flex flex-col overflow-hidden pointer-events-none transition-all duration-300",
            "left-[7%] right-[15%]",
            vPosContainer,
            hAlign,
          )}
          style={textStyle}
        >
          <div className={cx("flex flex-col gap-[0.45em] max-h-full w-full px-1", vPosInner, hAlign)}>
            {showPrev && prev && (
              <div
                className={cx(
                  "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] max-w-full",
                  hAlign,
                  isApple
                    ? "text-white/40 font-bold"
                    : "text-white/30 font-mono tracking-wider",
                )}
                style={{
                  color: isApple ? undefined : style.textColor,
                  fontSize: "0.58em",
                  transform: isApple ? "scale(0.92)" : undefined,
                  transformOrigin: textAlign === "left" ? "left center" : textAlign === "right" ? "right center" : "center",
                  filter: isApple ? "blur(3.2px)" : undefined,
                }}
              >
                {(() => {
                  const groups = splitTextIntoSentenceGroups(prev.text);
                  return (
                    <div className="flex flex-col gap-[0.55em] max-w-full">
                      {groups.map((g, gIdx) => (
                        <div key={gIdx} className="flex flex-col gap-[0.05em] leading-[1.14] max-w-full">
                          {g.rows.map((rowText, rIdx) => (
                            <span key={rIdx}>{rowText}</span>
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
            {normalizedLines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-[1em] text-center w-full">
                <span
                  className="text-[0.44em] tracking-[0.12em] opacity-45 uppercase font-mono"
                  style={{ color: style.textColor }}
                >
                  No audio track loaded
                </span>
                <span className="mt-[0.2em] text-[0.32em] opacity-30 text-white">
                  Upload a song to see lyrics
                </span>
              </div>
            ) : current ? (
              <ActiveLine key={current.id} line={current} time={time} style={style} />
            ) : (
              <div className="flex justify-center gap-[0.18em] py-[0.2em] w-full">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-[0.22em] w-[0.22em] rounded-full"
                    style={{
                      background: style.highlight,
                      opacity: time > (i + 1) * 0.35 ? 1 : 0.25,
                      boxShadow: `0 0 0.4em ${style.highlight}`,
                    }}
                  />
                ))}
              </div>
            )}
            {visibleUpcoming.map((l: Line, i: number) => {
              const groups = splitTextIntoSentenceGroups(l.text);
              return (
                <div
                  key={l.id}
                  className={cx(
                    "transition-all duration-300 ease-out max-w-full",
                    hAlign,
                    isApple
                      ? i === 0
                        ? "text-white/48 font-bold"
                        : "text-white/20 font-bold"
                      : i === 0
                        ? "text-white/35 font-mono tracking-wider"
                        : "text-white/15 font-mono",
                  )}
                  style={{
                    color: isApple ? undefined : style.textColor,
                    fontSize: i === 0 ? "0.60em" : "0.52em",
                    transform:
                      isApple
                        ? i === 0
                          ? "scale(0.96)"
                          : "scale(0.90)"
                        : undefined,
                    transformOrigin: textAlign === "left" ? "left center" : textAlign === "right" ? "right center" : "center",
                    filter:
                      isApple
                        ? i === 0
                          ? "blur(2.2px)"
                          : "blur(4.5px)"
                        : undefined,
                  }}
                >
                  <div className="flex flex-col gap-[0.55em] max-w-full">
                    {groups.map((g, gIdx) => (
                      <div key={gIdx} className="flex flex-col gap-[0.05em] leading-[1.14] max-w-full">
                        {g.rows.map((rowText, rIdx) => (
                          <span key={rIdx}>{rowText}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {overlay}

      {controls && (
        isSpotify ? (
          <div className="absolute inset-x-0 bottom-0 px-[6cqw] pb-[6cqw] pt-[3cqw] flex flex-col pointer-events-auto">
            {/* Seekbar */}
            <div
              className="group relative flex h-[3.5cqw] cursor-pointer items-center"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                const r = e.currentTarget.getBoundingClientRect();
                onSeek?.(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * duration);
              }}
              onPointerMove={(e) => {
                if (e.buttons === 1) {
                  const r = e.currentTarget.getBoundingClientRect();
                  onSeek?.(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * duration);
                }
              }}
            >
              <div className="h-[0.85cqw] w-full overflow-hidden rounded-full bg-white/20 transition-all group-hover:h-[1.3cqw]">
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-75"
                  style={{ width: `${Math.min(100, Math.max(0, (time / Math.max(0.1, duration)) * 100))}%` }}
                />
              </div>
              <div
                className="absolute h-[2.6cqw] w-[2.6cqw] -translate-x-1/2 rounded-full bg-white shadow-md transition-transform group-hover:scale-125"
                style={{ left: `${Math.min(100, Math.max(0, (time / Math.max(0.1, duration)) * 100))}%` }}
              />
            </div>

            {/* Time labels: current on left, negative remaining on right */}
            <div className="flex items-center justify-between text-[2.5cqw] font-semibold text-white/55 mt-[0.6cqw]">
              <span>{fmt(time)}</span>
              <span>-{fmt(Math.max(0, duration - time))}</span>
            </div>

            {/* Control buttons: Shuffle, Prev, Big White Pause Button, Next, Like Heart */}
            <div className="mt-[2.5cqw] flex items-center justify-between px-[2cqw]">
              <button
                onClick={() => onSeek?.(0)}
                title="Shuffle"
                className="flex flex-col items-center justify-center p-[1cqw] text-[#1ED760] transition hover:scale-110 active:scale-95"
              >
                <Shuffle className="h-[5cqw] w-[5cqw]" />
                <span className="mt-[0.5cqw] h-[0.7cqw] w-[0.7cqw] rounded-full bg-[#1ED760]" />
              </button>

              <button
                onClick={onPrev}
                title="Previous"
                className="p-[1cqw] text-white/85 transition hover:scale-110 hover:text-white active:scale-95"
              >
                <SkipBack className="h-[6cqw] w-[6cqw] fill-current" />
              </button>

              {/* Big White Circular Pause/Play button */}
              <button
                onClick={onToggle}
                title={playing ? "Pause" : "Play"}
                className="h-[14cqw] w-[14cqw] rounded-full bg-white text-black shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex items-center justify-center transition hover:scale-108 active:scale-95"
              >
                {playing ? (
                  <Pause className="h-[6.5cqw] w-[6.5cqw] fill-black stroke-black" />
                ) : (
                  <Play className="h-[6.5cqw] w-[6.5cqw] fill-black stroke-black ml-[0.8cqw]" />
                )}
              </button>

              <button
                onClick={onNext}
                title="Next"
                className="p-[1cqw] text-white/85 transition hover:scale-110 hover:text-white active:scale-95"
              >
                <SkipForward className="h-[6cqw] w-[6cqw] fill-current" />
              </button>

              <button
                title="Like"
                className="p-[1cqw] text-[#1ED760] transition hover:scale-110 active:scale-95"
              >
                <Heart className="h-[5.4cqw] w-[5.4cqw] fill-[#1ED760]" />
              </button>
            </div>
          </div>
        ) : isApple ? (
          <div className="absolute inset-x-[4cqw] bottom-[3cqw] px-[4.5cqw] pb-[3.5cqw] pt-[2cqw] rounded-[28px] border border-white/20 bg-white/[0.14] shadow-[0_20px_50px_rgba(0,0,0,0.65)] backdrop-blur-2xl backdrop-saturate-150 flex flex-col pointer-events-auto transition-all duration-300">
            {/* Sheet Grabber Handle */}
            <div className="mx-auto mb-[2.5cqw] h-[0.9cqw] w-[9cqw] rounded-full bg-white/35" />

            {/* Album Cover, Title, Artist, Favorite Star & Options */}
            <div className="flex items-center gap-[3cqw] mb-[2.5cqw]">
              <AlbumArt
                size={38}
                className="rounded-[10px] ring-1 ring-white/25 shadow-md shrink-0"
              />
              <div className="min-w-0 flex-1 leading-snug">
                <div className="truncate font-sans text-[3.8cqw] font-bold tracking-tight text-white">
                  {cleanTitle}
                </div>
                <div className="truncate font-sans text-[2.7cqw] font-medium text-white/65 mt-[0.2cqw]">
                  {cleanArtist || "Apple Music"}
                </div>
              </div>
              <div className="flex items-center gap-[2.5cqw] shrink-0">
                <button
                  className="p-[1cqw] text-white/80 transition hover:scale-110 active:scale-95"
                  title="Favorite"
                >
                  <Star className="h-[5.2cqw] w-[5.2cqw] fill-white/85 text-white/85" />
                </button>
                <div className="rounded-full bg-white/15 px-[2.4cqw] py-[0.8cqw] text-[2.4cqw] font-bold text-white/90 ring-1 ring-white/20">
                  {idx >= 0 ? String(idx + 1).padStart(2, "0") : "00"}/{String(lines.length).padStart(2, "0")}
                </div>
              </div>
            </div>

            {/* Apple Music Sleek Seekbar */}
            <div
              className="group relative flex h-[3cqw] cursor-pointer items-center"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                const r = e.currentTarget.getBoundingClientRect();
                onSeek?.(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * duration);
              }}
              onPointerMove={(e) => {
                if (e.buttons === 1) {
                  const r = e.currentTarget.getBoundingClientRect();
                  onSeek?.(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * duration);
                }
              }}
            >
              <div className="h-[0.75cqw] w-full overflow-hidden rounded-full bg-white/20 transition-all group-hover:h-[1.1cqw]">
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-75"
                  style={{ width: `${Math.min(100, Math.max(0, (time / Math.max(0.1, duration)) * 100))}%` }}
                />
              </div>
              <div
                className="absolute h-[2.5cqw] w-[2.5cqw] -translate-x-1/2 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-transform group-hover:scale-125"
                style={{ left: `${Math.min(100, Math.max(0, (time / Math.max(0.1, duration)) * 100))}%` }}
              />
            </div>

            {/* Timestamps: Elapsed on left, Negative Remaining on right */}
            <div className="flex items-center justify-between font-sans text-[2.5cqw] font-medium text-white/60 mt-[0.4cqw]">
              <span>{fmt(time)}</span>
              <span>-{fmt(Math.max(0, duration - time))}</span>
            </div>

            {/* Apple Music 3-Button Controls: SkipBack, Big White Play/Pause Button, SkipForward */}
            <div className="mt-[2.2cqw] flex items-center justify-center gap-[9cqw]">
              <button
                onClick={onPrev}
                title="Previous"
                className="p-[1.5cqw] text-white transition hover:scale-115 active:scale-95"
              >
                <SkipBack className="h-[6.5cqw] w-[6.5cqw] fill-white text-white" />
              </button>

              <button
                onClick={onToggle}
                title={playing ? "Pause" : "Play"}
                className="h-[14cqw] w-[14cqw] rounded-full bg-white text-black shadow-[0_6px_25px_rgba(255,255,255,0.4)] flex items-center justify-center transition hover:scale-108 active:scale-95"
              >
                {playing ? (
                  <Pause className="h-[6.5cqw] w-[6.5cqw] fill-black stroke-black" />
                ) : (
                  <Play className="h-[6.5cqw] w-[6.5cqw] fill-black stroke-black ml-[0.8cqw]" />
                )}
              </button>

              <button
                onClick={onNext}
                title="Next"
                className="p-[1.5cqw] text-white transition hover:scale-115 active:scale-95"
              >
                <SkipForward className="h-[6.5cqw] w-[6.5cqw] fill-white text-white" />
              </button>
            </div>

            {/* Apple Music Bottom Utility Row: Volume Slider, AirPlay, Active Lyrics Bubble */}
            <div className="mt-[2.4cqw] flex items-center justify-between px-[1cqw]">
              {/* Speaker volume indicator */}
              <div className="flex items-center gap-[1.5cqw] w-[32%]">
                <Volume2 className="h-[3.6cqw] w-[3.6cqw] text-white/65 shrink-0" />
                <div className="h-[0.6cqw] w-full rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full w-[70%] rounded-full bg-white/70" />
                </div>
              </div>

              {/* AirPlay Icon */}
              <button
                title="AirPlay Audio"
                className="p-[1cqw] text-white/80 transition hover:scale-110 hover:text-white"
              >
                <Airplay className="h-[4.4cqw] w-[4.4cqw]" />
              </button>

              {/* Active Lyrics Speech Bubble */}
              <div
                className="flex items-center gap-[1cqw] rounded-full bg-white/25 px-[2.6cqw] py-[1cqw] ring-1 ring-white/30 shadow-[0_0_12px_rgba(255,255,255,0.2)]"
                title="Lyrics Active"
              >
                <MessageSquareQuote className="h-[4cqw] w-[4cqw] fill-white text-white" />
              </div>
            </div>
          </div>
        ) : (
          <div
            className={cx(
              "absolute inset-x-[4cqw] bottom-[4cqw] px-[5cqw] pb-[4cqw] pt-[4.2cqw] transition-all duration-300",
              "rounded-[20px] border border-white/25 bg-black/90 shadow-[0_0_35px_rgba(0,0,0,0.95)] backdrop-blur-lg",
            )}
          >
            <div className="mb-[4cqw] flex items-center gap-[3cqw]">
              <AlbumArt
                size={34}
                className="rounded-sm border border-white/20"
              />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[13.5px] text-white font-mono font-bold uppercase tracking-wider">
                  {cleanTitle}
                </div>
                <div className="truncate text-[11.5px] text-white/50 font-mono uppercase tracking-widest">
                  {cleanArtist || "Original Track"}
                </div>
              </div>
              <div className="px-2.5 py-1 text-[10px] transition-all rounded-sm border border-[#D71920]/60 bg-[#D71920]/20 font-mono font-bold text-[#D71920]">
                {idx >= 0 ? String(idx + 1).padStart(2, "0") : "00"} /{" "}
                {String(lines.length).padStart(2, "0")}
              </div>
            </div>

            <Progress time={time} duration={duration} theme={style.animation} highlightColor={style.highlight} onSeek={onSeek} />

            <div
              className={cx(
                "mt-2 flex justify-between text-[10.5px]",
                style.animation === "nothing" ? "font-mono text-white/50" : "text-white/55 font-medium",
              )}
            >
              <span className="text-white/85">
                {fmt(time)}
              </span>
              <span>{fmt(duration)}</span>
            </div>

            <div className="mt-[2.5cqw] flex items-center justify-center gap-[7cqw]">
              <button
                onClick={onPrev}
                aria-label="Previous lyric"
                className={cx(
                  "grid h-10 w-10 place-items-center transition active:scale-90",
                  style.animation === "nothing"
                    ? "font-mono text-white/70 hover:text-white rounded-sm"
                    : "rounded-full text-white/80 hover:bg-white/10 hover:text-white",
                )}
              >
                <SkipBack size={19} fill="currentColor" />
              </button>
              <button
                onClick={onToggle}
                aria-label={playing ? "Pause" : "Play"}
                className={cx(
                  "grid h-[56px] w-[56px] place-items-center transition hover:scale-105 active:scale-95",
                  "rounded-full border-2 border-[#D71920] bg-black text-white shadow-[0_0_20px_rgba(215,25,32,0.4)] hover:bg-[#D71920] hover:text-white",
                )}
              >
                {playing ? (
                  <Pause size={24} fill="currentColor" />
                ) : (
                  <Play size={24} fill="currentColor" className="ml-0.5" />
                )}
              </button>
              <button
                onClick={onNext}
                aria-label="Next lyric"
                className={cx(
                  "grid h-10 w-10 place-items-center transition active:scale-90",
                  style.animation === "nothing"
                    ? "font-mono text-white/70 hover:text-white rounded-sm"
                    : "rounded-full text-white/80 hover:bg-white/10 hover:text-white",
                )}
              >
                <SkipForward size={19} fill="currentColor" />
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

function Progress({
  time,
  duration,
  theme = "nothing",
  highlightColor,
  onSeek,
}: {
  time: number;
  duration: number;
  theme?: string;
  highlightColor?: string;
  onSeek?: (t: number) => void;
}) {
  const pct = Math.min(100, Math.max(0, (time / Math.max(0.1, duration)) * 100));
  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onSeek?.(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * duration);
  };

  const fillColor =
    highlightColor ||
    (theme === "spotify"
      ? "#1ED760"
      : theme === "nothing"
        ? "#D71920"
        : theme === "retro"
          ? "#FBBF24"
          : "#FFFFFF");
  const glowColor =
    highlightColor
      ? `${highlightColor}88`
      : theme === "spotify"
        ? "rgba(30, 215, 96, 0.6)"
        : theme === "nothing"
          ? "rgba(215, 25, 32, 0.6)"
          : "rgba(255, 255, 255, 0.6)";

  return (
    <div
      className="group relative flex h-3 cursor-pointer items-center"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        seek(e);
      }}
      onPointerMove={(e) => e.buttons === 1 && seek(e)}
    >
      <div className="h-[3.5px] w-full overflow-hidden rounded-full bg-white/15 transition-all group-hover:h-[5px]">
        <div
          className="h-full rounded-full transition-[width] duration-75"
          style={{ width: `${pct}%`, backgroundColor: fillColor }}
        />
      </div>
      <div
        className="absolute h-3 w-3 -translate-x-1/2 rounded-full transition-transform group-hover:scale-125"
        style={{
          left: `${pct}%`,
          backgroundColor: fillColor,
          boxShadow: `0 0 10px ${glowColor}`,
        }}
      />
    </div>
  );
}

function SpotifyFullLyricsStream({
  lines,
  activeIdx,
  time,
  style,
  position,
  align,
  font,
  effectiveSize,
  onSeek,
}: {
  lines: Line[];
  activeIdx: number;
  time: number;
  style: ReelStyle;
  position: "top" | "center" | "bottom";
  align: "left" | "center" | "right";
  font: (typeof FONTS)[0];
  effectiveSize: number;
  onSeek?: (t: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [translateY, setTranslateY] = useState(0);

  useEffect(() => {
    if (activeIdx < 0 || !lineRefs.current[activeIdx] || !containerRef.current) {
      if (activeIdx <= 0) setTranslateY(0);
      return;
    }

    const activeEl = lineRefs.current[activeIdx];
    const container = containerRef.current;
    if (!activeEl || !container) return;

    const elTop = activeEl.offsetTop;
    const elHeight = activeEl.offsetHeight;
    const containerHeight = container.offsetHeight;

    // Anchor the active white line based on style.position:
    // Center alignment places active line right at viewport center so it highlights and moves up:
    let targetY = (containerHeight - elHeight) / 2;
    if (position === "top") {
      targetY = containerHeight * 0.18;
    } else if (position === "bottom") {
      targetY = containerHeight * 0.68;
    }

    const offset = Math.max(0, elTop - targetY);
    setTranslateY(offset);
  }, [activeIdx, position]);

  const hAlign =
    align === "left"
      ? "text-left items-start"
      : align === "right"
        ? "text-right items-end"
        : "text-center items-center";

  // Dynamic stream padding so line 0 can anchor right at center
  const streamPadding =
    position === "top"
      ? "pt-[15%] pb-[60%]"
      : position === "bottom"
        ? "pt-[65%] pb-[20%]"
        : "pt-[45%] pb-[55%]";

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden [mask-image:linear-gradient(to_bottom,transparent_0%,black_8%,black_92%,transparent_100%)] pointer-events-auto select-none"
    >
      <div
        className={cx(
          "flex flex-col gap-[1.20em] w-full transition-transform duration-600 ease-[cubic-bezier(0.2,0,0,1)]",
          streamPadding,
          hAlign,
        )}
        style={{
          transform: `translateY(-${translateY}px)`,
        }}
      >
        {lines.map((line, idx) => {
          const isCurrent = idx === activeIdx;
          const isPast = activeIdx >= 0 && idx < activeIdx;
          const isUpcoming = activeIdx < 0 || idx > activeIdx;

          return (
            <div
              key={line.id || idx}
              ref={(el) => {
                lineRefs.current[idx] = el;
              }}
              onClick={() => onSeek?.(line.start)}
              className={cx(
                "group relative max-w-full cursor-pointer transition-all duration-300",
                hAlign,
                isCurrent
                  ? "scale-[1.015] z-10"
                  : isPast
                    ? "z-0"
                    : "z-0 hover:opacity-100",
              )}
            >
              <p
                className={cx(
                  "font-black tracking-[-0.035em] break-words whitespace-pre-wrap leading-[1.24] transition-colors duration-300 m-0 p-0",
                  align === "left"
                    ? "text-left"
                    : align === "right"
                      ? "text-right"
                      : "text-center",
                )}
                style={{
                  fontFamily: font.family,
                  fontSize: isCurrent ? "1.04em" : isPast ? "1em" : "0.98em",
                  color: isCurrent
                    ? (style.highlight || "#FFFFFF")
                    : isPast
                      ? (style.highlight || "#FFFFFF")
                      : (style.textColor || "rgba(0, 0, 0, 0.72)"),
                  opacity: isCurrent ? 1 : isPast ? 0.85 : 0.75,
                  textShadow: isCurrent
                    ? `0 2px 16px rgba(0, 0, 0, 0.45), 0 0 24px ${style.highlight || "#FFFFFF"}44`
                    : isPast
                      ? "0 2px 12px rgba(0, 0, 0, 0.35)"
                      : "0 1px 2px rgba(0, 0, 0, 0.20)",
                }}
              >
                {line.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AppleLyricsStream({
  lines,
  activeIdx,
  time,
  style,
  position,
  align,
  font,
  effectiveSize,
  onSeek,
}: {
  lines: Line[];
  activeIdx: number;
  time: number;
  style: ReelStyle;
  position: "top" | "center" | "bottom";
  align: "left" | "center" | "right";
  font: (typeof FONTS)[0];
  effectiveSize: number;
  onSeek?: (t: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [translateY, setTranslateY] = useState(0);

  useEffect(() => {
    if (activeIdx < 0 || !lineRefs.current[activeIdx] || !containerRef.current) {
      if (activeIdx <= 0) setTranslateY(0);
      return;
    }

    const activeEl = lineRefs.current[activeIdx];
    const container = containerRef.current;
    if (!activeEl || !container) return;

    const elTop = activeEl.offsetTop;
    const elHeight = activeEl.offsetHeight;
    const containerHeight = container.offsetHeight;

    // Anchor active line in the upper-mid focal area (authentic Apple Music iOS)
    let targetY = (containerHeight - elHeight) * 0.36;
    if (position === "top") {
      targetY = containerHeight * 0.16;
    } else if (position === "bottom") {
      targetY = containerHeight * 0.60;
    }

    const offset = Math.max(0, elTop - targetY);
    setTranslateY(offset);
  }, [activeIdx, position]);

  const hAlign =
    align === "left"
      ? "text-left items-start"
      : align === "right"
        ? "text-right items-end"
        : "text-center items-center";

  const streamPadding =
    position === "top"
      ? "pt-[12%] pb-[60%]"
      : position === "bottom"
        ? "pt-[60%] pb-[20%]"
        : "pt-[38%] pb-[50%]";

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden [mask-image:linear-gradient(to_bottom,transparent_0%,black_10%,black_88%,transparent_100%)] pointer-events-auto select-none"
    >
      <div
        className={cx(
          "flex flex-col gap-[1.35em] w-full transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
          streamPadding,
          hAlign,
        )}
        style={{
          transform: `translateY(-${translateY}px)`,
        }}
      >
        {lines.map((line, idx) => {
          const isCurrent = idx === activeIdx;
          const delta = activeIdx >= 0 ? Math.abs(idx - activeIdx) : 99;

          if (isCurrent) {
            return (
              <div
                key={line.id || idx}
                ref={(el) => {
                  lineRefs.current[idx] = el;
                }}
                className={cx(
                  "relative max-w-full z-20 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  hAlign,
                )}
                style={{
                  transform: "scale(1.03)",
                  transformOrigin:
                    align === "left" ? "left center" : align === "right" ? "right center" : "center",
                }}
              >
                <ActiveLine line={line} time={time} style={style} />
              </div>
            );
          }

          const blurAmount =
            delta === 1 ? "blur(1.8px)" : delta === 2 ? "blur(3.6px)" : "blur(5.5px)";
          const opacity =
            delta === 1 ? 0.46 : delta === 2 ? 0.25 : 0.12;
          const scale =
            delta === 1 ? "scale(0.97)" : delta === 2 ? "scale(0.94)" : "scale(0.91)";

          const groups = splitTextIntoSentenceGroups(line.text);

          return (
            <div
              key={line.id || idx}
              ref={(el) => {
                lineRefs.current[idx] = el;
              }}
              onClick={() => onSeek?.(line.start)}
              className={cx(
                "group relative max-w-full cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:opacity-80",
                hAlign,
              )}
              style={{
                opacity,
                filter: blurAmount,
                transform: scale,
                transformOrigin:
                  align === "left" ? "left center" : align === "right" ? "right center" : "center",
              }}
            >
              <div className="flex flex-col gap-[0.55em] max-w-full">
                {groups.map((g, gIdx) => (
                  <div
                    key={gIdx}
                    className={cx("flex flex-col gap-[0.05em] leading-[1.14] max-w-full", hAlign)}
                  >
                    {g.rows.map((rowText, rIdx) => (
                      <p
                        key={rIdx}
                        className={cx(
                          "font-extrabold tracking-[-0.03em] break-normal whitespace-normal max-w-full m-0 p-0",
                          align === "left"
                            ? "text-left"
                            : align === "right"
                              ? "text-right"
                              : "text-center",
                        )}
                        style={{
                          fontFamily: font.family,
                          fontSize: "0.95em",
                          color: style.textColor || "rgba(255, 255, 255, 0.70)",
                        }}
                      >
                        {rowText}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActiveLine({ line, time, style }: { line: Line; time: number; style: ReelStyle }) {
  const lineWords = getLineWordsWithTimings(line);
  const anim = style.animation;
  const textAlign = style.align || "center";
  const flexJustify =
    textAlign === "left"
      ? "justify-start"
      : textAlign === "right"
        ? "justify-end"
        : "justify-center";
  const itemsAlign =
    textAlign === "left"
      ? "items-start text-left"
      : textAlign === "right"
        ? "items-end text-right"
        : "items-center text-center";

  const font = FONTS.find((f) => f.id === style.font) ?? FONTS[0];

  // Group lyrics into sentences based on Capitalized words / line breaks,
  // then wrap into balanced rows with distinct intra vs inter-sentence padding
  const sentenceGroups = splitWordsIntoSentenceGroups(lineWords);

  // Spotify highlights the WHOLE line/sentence in solid bright white (#FFFFFF)
  if (anim === "spotify") {
    return (
      <div
        className={cx(
          "flex flex-col gap-[0.75em] max-w-full drop-shadow-[0_2px_16px_rgba(0,0,0,0.30)]",
          itemsAlign,
        )}
      >
        {sentenceGroups.map((group, sIdx) => (
          <div
            key={sIdx}
            className={cx("flex flex-col gap-[0.06em] leading-[1.12] max-w-full", itemsAlign)}
          >
            {group.rows.map((rowWords, rowIdx) => (
              <p
                key={rowIdx}
                className={cx(
                  "font-extrabold tracking-[-0.035em] text-white break-normal whitespace-normal max-w-full m-0 p-0",
                  textAlign === "left"
                    ? "text-left"
                    : textAlign === "right"
                      ? "text-right"
                      : "text-center",
                )}
                style={{
                  fontFamily: font.family,
                  fontSize: "1em",
                  color: "#FFFFFF",
                  textShadow: "0 2px 14px rgba(0, 0, 0, 0.30)",
                }}
              >
                {rowWords.map((w) => w.text).join(" ")}
              </p>
            ))}
          </div>
        ))}
      </div>
    );
  }

  const renderWord = (wordObj: (typeof lineWords)[0], keyId: string | number) => {
    const w = wordObj.text;
    let local = 0;

    if (time >= wordObj.end) {
      local = 1;
    } else if (time <= wordObj.start) {
      local = 0;
    } else {
      local = Math.min(
        1,
        Math.max(0, (time - wordObj.start) / Math.max(0.06, wordObj.end - wordObj.start)),
      );
    }

    const sung = local >= 1;
    const active = local > 0 && local < 1;

    if (anim === "nothing") {
      const isNothingRed = style.highlight === "#FFFFFF" ? "#D71920" : style.highlight;
      return (
        <span
          key={keyId}
          className="relative inline-flex flex-col items-center px-[0.06em] transition-all duration-150"
        >
          <span
            style={{
              color: active ? isNothingRed : sung ? "#FFFFFF" : style.textColor,
              fontFamily: font.family,
              fontWeight: font.weight,
              letterSpacing: font.tracking || "0.02em",
              filter: active ? `drop-shadow(0 0 0.28em ${isNothingRed}cc)` : undefined,
              transform: active ? "scale(1.08)" : "scale(1)",
              transition: "all 0.15s ease",
            }}
          >
            {w}
          </span>
          {active && (
            <span
              className="mt-[0.08em] h-[0.14em] w-[0.14em] rounded-full animate-pulse"
              style={{
                backgroundColor: isNothingRed,
                boxShadow: `0 0 0.3em ${isNothingRed}`,
              }}
            />
          )}
        </span>
      );
    }

    if (anim === "apple") {
      const stop = `${local * 100}%`;
      const hl = style.highlight || "#FFFFFF";
      const tc = style.textColor || "rgba(255, 255, 255, 0.40)";
      return (
        <span
          key={keyId}
          className="inline-block transition-transform duration-200"
          style={{
            backgroundImage: `linear-gradient(90deg, ${hl} ${stop}, ${tc} ${stop})`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            fontFamily: font.family,
            fontWeight: font.weight,
            letterSpacing: font.tracking || "-0.025em",
            filter: active
              ? `drop-shadow(0 0 0.35em ${hl}cc) drop-shadow(0 0 0.9em ${hl}66)`
              : sung
                ? `drop-shadow(0 0 0.16em ${hl}55)`
                : undefined,
            transform: active ? "scale(1.08)" : "scale(1)",
          }}
        >
          {w}
        </span>
      );
    }

    if (anim === "retro") {
      const stop = `${local * 100}%`;
      const hl = style.highlight || "#FDE68A";
      const tc = style.textColor || "rgba(253, 230, 138, 0.40)";
      return (
        <span
          key={keyId}
          className="inline-block transition-all duration-200 italic"
          style={{
            backgroundImage: `linear-gradient(90deg, ${hl} ${stop}, ${tc} ${stop})`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            fontFamily: font.family,
            fontWeight: font.weight,
            letterSpacing: "0.01em",
            filter: active ? `drop-shadow(0 0 0.3em ${hl}cc)` : undefined,
            transform: active ? "scale(1.05)" : "scale(1)",
          }}
        >
          {w}
        </span>
      );
    }

    // Material You / Default Karaoke (dynamic gradient using style.highlight and style.textColor)
    const stop = `${local * 100}%`;
    const hlColor = style.highlight || "#8AB4F8";
    const txtColor = style.textColor || "rgba(255, 255, 255, 0.60)";

    return (
      <span
        key={keyId}
        className="inline-block transition-all duration-150"
        style={{
          backgroundImage: `linear-gradient(90deg, ${hlColor} ${stop}, ${txtColor} ${stop})`,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          fontFamily: font.family,
          fontWeight: font.weight,
          letterSpacing: font.tracking || "-0.02em",
          filter: active
            ? `drop-shadow(0 0 0.35em ${hlColor}cc) drop-shadow(0 0 0.8em ${hlColor}66)`
            : sung
              ? `drop-shadow(0 0 0.16em ${hlColor}55)`
              : undefined,
          transform: active ? "scale(1.08)" : "scale(1)",
        }}
      >
        {w}
      </span>
    );
  };

  return (
    <div
      className={cx(
        "flex flex-col gap-[0.75em] max-w-full drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)]",
        itemsAlign,
      )}
    >
      {sentenceGroups.map((group, sIdx) => (
        <div
          key={sIdx}
          className={cx("flex flex-col gap-[0.06em] leading-[1.12] max-w-full", itemsAlign)}
        >
          {group.rows.map((rowWords, rowIdx) => (
            <p
              key={rowIdx}
              className={cx(
                "flex flex-wrap gap-x-[0.24em] gap-y-[0.04em] max-w-full break-normal whitespace-normal m-0 p-0",
                flexJustify,
              )}
            >
              {rowWords.map((wordObj, i) => renderWord(wordObj, `${sIdx}-${rowIdx}-${i}`))}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}
