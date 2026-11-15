import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  GripVertical,
  Image as ImageIcon,
  RotateCcw,
  Sparkles,
  Trash2,
  Type,
  Unlink,
  Upload,
  Video as VideoIcon,
} from "lucide-react";
import {
  ANIMATIONS,
  BACKGROUNDS,
  DEFAULT_STYLE,
  HIGHLIGHT_COLORS,
  MATERIAL_PALETTES,
  TEXT_COLORS,
  activeIndex,
  colorToHex,
  detectColorsFromBg,
  detectColorsFromBgAsync,
  fmt,
  type Line,
  type Position,
  type ReelStyle,
  type TextAlign,
  type TrackInfo,
} from "../data";
import type { Player } from "../player";
import { Ambient, ReelBackground, ReelPreview } from "../components/ReelPreview";
import { Kbd, Section, Segmented, Toggle, cx } from "../components/ui";

type Props = {
  track?: TrackInfo;
  lines: Line[];
  setLines: Dispatch<SetStateAction<Line[]>>;
  style: ReelStyle;
  setStyle: Dispatch<SetStateAction<ReelStyle>>;
  player: Player;
};

export function Editor({ track, lines, setLines, style, setStyle, player }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <LyricsPanel lines={lines} setLines={setLines} player={player} />

      <main className="dot-grid relative flex min-h-[720px] flex-1 flex-col items-center justify-center overflow-hidden px-6 py-8 lg:min-h-0">
        <div className="absolute left-5 right-5 top-4 flex items-center justify-between text-[12px] text-white/40">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={cx(
                  "h-1.5 w-1.5 rounded-full",
                  player.playing ? "bg-white shadow-[0_0_8px_#fff]" : "bg-white/30",
                )}
              />
              Live preview
            </div>
            <a
              href="#lyrics"
              title="Open Nothing OS Live Lyrics View"
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] text-white/70 hover:border-white/30 hover:text-white transition"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#D71920] shadow-[0_0_6px_#D71920]" />
              <span>(N) Nothing Lyrics ↗</span>
            </a>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-md bg-white/[0.04] px-2 py-1 ring-1 ring-white/[0.06]">
              9:16
            </span>
            <span className="rounded-md bg-white/[0.04] px-2 py-1 font-mono ring-1 ring-white/[0.06]">
              1080 × 1920
            </span>
          </div>
        </div>

        <div className="relative">
          <Ambient bgId={style.bg} customBgUrl={style.customBgUrl} className="-inset-10" />
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
            className="h-[620px] lg:h-[min(calc(100vh-150px),860px)]"
          />
        </div>

        <div className="absolute bottom-4 hidden items-center gap-4 text-[11.5px] text-white/35 md:flex">
          <span className="flex items-center gap-1.5">
            <Kbd>Space</Kbd> Play / Pause
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>←</Kbd>
            <Kbd>→</Kbd> Previous / next lyric
          </span>
        </div>
      </main>

      <StylePanel style={style} setStyle={setStyle} />
    </div>
  );
}

function LyricsPanel({
  lines,
  setLines,
  player,
}: {
  lines: Line[];
  setLines: Dispatch<SetStateAction<Line[]>>;
  player: Player;
}) {
  const idx = activeIndex(lines, player.time);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (player.playing && idx >= 0)
      refs.current[idx]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [idx, player.playing]);

  const words = lines.reduce((n, l) => n + l.text.split(/\s+/).filter(Boolean).length, 0);

  return (
    <aside className="flex w-full shrink-0 flex-col border-white/[0.06] glass lg:w-[340px] lg:border-r">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3.5">
        <div>
          <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Lyrics</h2>
          <p className="mt-0.5 text-[11.5px] text-white/40">
            {lines.length} lines · {words} words
          </p>
        </div>
      </div>

      <div className="max-h-[420px] flex-1 space-y-1.5 overflow-y-auto p-3 lg:max-h-none">
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <p className="text-[13px] font-medium text-white/60">No lyrics loaded</p>
            <p className="mt-1 text-[11.5px] text-white/35 max-w-[220px]">
              Lyrics sync automatically with your audio track.
            </p>
          </div>
        ) : (
          lines.map((l, i) => {
            const active = i === idx;
            const p = active ? Math.min(1, (player.time - l.start) / (l.end - l.start)) : 0;

            return (
              <div key={l.id} className="relative">
                {/* Lyric Card Item */}
                <div
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  onClick={() => player.seek(l.start)}
                  className={cx(
                    "group relative flex cursor-pointer gap-2.5 overflow-hidden rounded-xl px-3 py-2.5 transition",
                    active ? "bg-volt-500/[0.09] ring-1 ring-volt-400/25" : "hover:bg-white/[0.03]",
                  )}
                >
                  {/* Left Time Column */}
                  <div className="relative flex w-[58px] shrink-0 items-start gap-2 pt-[3px]">
                    <div className="relative flex h-4 w-4 shrink-0 items-center justify-center pt-0.5">
                      <span
                        className={cx(
                          "rounded-full transition-all",
                          active
                            ? "h-2 w-2 bg-volt-300 ring-2 ring-volt-300/40"
                            : "h-1.5 w-1.5 bg-white/20 group-hover:bg-white/40",
                        )}
                      />
                    </div>

                    <span
                      className={cx(
                        "font-mono text-[11px]",
                        active ? "text-volt-300" : "text-white/30",
                      )}
                    >
                      {fmt(l.start, true).slice(0, -1)}
                    </span>
                  </div>

                  {/* Lyric Textarea */}
                  <textarea
                    value={l.text}
                    rows={l.text.includes("\n") ? l.text.split("\n").length : 1}
                    spellCheck={false}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={() => player.seek(l.start)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        const target = e.currentTarget;
                        const startPos = target.selectionStart || 0;
                        const textBefore = l.text.slice(0, startPos).trim();
                        const textAfter = l.text.slice(startPos).trim();
                        if (textBefore && textAfter) {
                          const totalDur = Math.max(0.6, l.end - l.start);
                          const ratio = textBefore.length / (textBefore.length + textAfter.length);
                          const midTime = +(l.start + totalDur * ratio).toFixed(2);
                          const line1: Line = {
                            ...l,
                            text: textBefore,
                            end: midTime,
                          };
                          const line2: Line = {
                            id: `l${Date.now()}`,
                            text: textAfter,
                            start: midTime,
                            end: l.end,
                          };
                          setLines((ls) => {
                            const newLines = [...ls];
                            newLines.splice(i, 1, line1, line2);
                            return newLines;
                          });
                        } else if (textBefore && !textAfter) {
                          const newLine: Line = {
                            id: `l${Date.now()}`,
                            text: "New lyric line",
                            start: l.end,
                            end: +(l.end + 3.5).toFixed(2),
                          };
                          setLines((ls) => {
                            const newLines = [...ls];
                            newLines.splice(i + 1, 0, newLine);
                            return newLines;
                          });
                        }
                      }
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLines((ls) =>
                        ls.map((x) => {
                          if (x.id !== l.id) return x;
                          const wordsRaw = val.split(/\s+/).filter(Boolean);
                          let words = x.words;
                          if (words && words.length === wordsRaw.length) {
                            words = words.map((w, wIdx) => ({ ...w, text: wordsRaw[wIdx] }));
                          } else if (wordsRaw.length > 0) {
                            const dur = Math.max(0.2, x.end - x.start);
                            const wDur = dur / wordsRaw.length;
                            words = wordsRaw.map((txt, wIdx) => ({
                              text: txt,
                              start: +(x.start + wIdx * wDur).toFixed(2),
                              end: +(x.start + (wIdx + 1) * wDur).toFixed(2),
                            }));
                          }
                          return { ...x, text: val, words };
                        }),
                      );
                    }}
                    className={cx(
                      "min-w-0 flex-1 resize-none bg-transparent text-[13.5px] leading-[1.45] outline-none [field-sizing:content] placeholder:text-white/25",
                      active ? "font-medium text-white" : "text-white/65 focus:text-white",
                    )}
                  />

                  {/* Actions (drag handle) */}
                  <div className="flex shrink-0 items-center gap-1 pt-[2px]">
                    <GripVertical
                      size={14}
                      className="text-white/0 transition group-hover:text-white/25"
                    />
                  </div>

                  {active && (
                    <div
                      className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-volt-500 to-volt-300"
                      style={{ width: `${p * 100}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

function PositionIcon({ pos }: { pos: Position }) {
  const y = pos === "top" ? 3 : pos === "center" ? 7 : 11;
  return (
    <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
      <rect
        x="0.75"
        y="0.75"
        width="10.5"
        height="14.5"
        rx="2"
        stroke="currentColor"
        strokeOpacity=".5"
        strokeWidth="1.5"
      />
      <rect x="3" y={y} width="6" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

function StylePanel({
  style,
  setStyle,
}: {
  style: ReelStyle;
  setStyle: Dispatch<SetStateAction<ReelStyle>>;
}) {
  const set = <K extends keyof ReelStyle>(k: K, v: ReelStyle[K]) =>
    setStyle((s) => ({ ...s, [k]: v }));
  const sizePct = ((style.size - 18) / (48 - 18)) * 100;
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  const applyPreset = (presetId: typeof ANIMATIONS[number]["id"]) => {
    const target = ANIMATIONS.find((a) => a.id === presetId);
    if (!target) return;
    setStyle((s) => {
      const detected = s.materialAutoColor ? detectColorsFromBg(target.bg, s.customBgUrl) : null;
      return {
        ...s,
        animation: target.id,
        font: target.font,
        bg: target.bg,
        textColor: detected ? detected.textColor : target.textColor,
        highlight: detected ? detected.highlight : target.highlight,
        size: target.size,
        align: s.align || target.align || "left",
      };
    });
  };

  const handleSelectBg = (bgId: string) => {
    setStyle((s) => {
      const detected = s.materialAutoColor ? detectColorsFromBg(bgId, s.customBgUrl) : null;
      return {
        ...s,
        bg: bgId,
        customBgUrl: undefined,
        customBgType: undefined,
        customBgName: undefined,
        ...(detected ? { textColor: detected.textColor, highlight: detected.highlight } : {}),
      };
    });
  };

  const handleCustomBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.name);
    setStyle((s) => {
      const detected = s.materialAutoColor ? detectColorsFromBg(s.bg, url) : null;
      return {
        ...s,
        customBgUrl: url,
        customBgType: isVideo ? "video" : "image",
        customBgName: file.name,
        ...(detected ? { textColor: detected.textColor, highlight: detected.highlight } : {}),
      };
    });

    if (!isVideo) {
      detectColorsFromBgAsync(style.bg, url).then((detected) => {
        setStyle((s) => {
          if (!s.materialAutoColor) return s;
          return {
            ...s,
            textColor: detected.textColor,
            highlight: detected.highlight,
          };
        });
      });
    }
    e.target.value = "";
  };

  return (
    <aside className="w-full shrink-0 overflow-y-auto border-white/[0.06] glass lg:w-[340px] lg:border-l">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div>
          <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Animation & Theme</h2>
          <p className="mt-0.5 text-[11.5px] text-white/40">Select preset for auto font & background</p>
        </div>
        <button
          onClick={() => setStyle(DEFAULT_STYLE)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] text-white/45 transition hover:bg-white/[0.05] hover:text-white"
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      <Section title="Lyrics Animation">
        <div className="space-y-2.5">
          {ANIMATIONS.map((a) => {
            const on = style.animation === a.id;
            return (
              <button
                key={a.id}
                onClick={() => applyPreset(a.id)}
                className={cx(
                  "group relative flex w-full flex-col gap-2 rounded-xl p-3 text-left ring-1 transition",
                  on
                    ? "bg-white/[0.07] ring-white/30 shadow-[0_0_24px_-8px_rgba(255,255,255,0.15)]"
                    : "bg-white/[0.02] ring-white/[0.06] hover:bg-white/[0.04] hover:ring-white/15",
                )}
              >
                <div className="flex items-center gap-3">
                  <AnimationThumb id={a.id} highlight={a.highlight} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13.5px] font-semibold text-white">{a.name}</span>
                      {on && (
                        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-white/80">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-white/45 leading-tight mt-0.5">{a.desc}</div>
                  </div>
                  <span
                    className={cx(
                      "h-4 w-4 shrink-0 rounded-full ring-1 transition",
                      on ? "bg-white ring-4 ring-white/20" : "ring-white/20",
                    )}
                  />
                </div>

                {on && (
                  <div className="mt-1 flex items-center justify-between rounded-lg bg-black/40 px-2.5 py-1.5 text-[10.5px] font-mono text-white/60">
                    <span className="truncate">Font: <strong className="text-white/90 font-medium">{a.fontName}</strong></span>
                    <span className="truncate ml-2">Size: <strong className="text-white/90 font-medium">{a.size}px</strong></span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Background Wallpaper & Media">
        <div className="grid grid-cols-4 gap-2 mb-3">
          {BACKGROUNDS.slice(0, 8).map((bg) => {
            const isSelected = style.bg === bg.id && !style.customBgUrl;
            return (
              <button
                key={bg.id}
                type="button"
                onClick={() => handleSelectBg(bg.id)}
                className={cx(
                  "relative h-14 rounded-xl overflow-hidden ring-1 transition flex flex-col justify-end p-1.5 text-left",
                  isSelected
                    ? "ring-2 ring-white shadow-lg"
                    : "ring-white/10 hover:ring-white/30 opacity-75 hover:opacity-100",
                )}
                style={{ background: bg.css }}
              >
                {bg.image && (
                  <img
                    src={bg.image}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover brightness-50"
                  />
                )}
                <span className="relative z-10 text-[9.5px] font-medium text-white/90 truncate drop-shadow">
                  {bg.name.split(" ")[0]}
                </span>
                {isSelected && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-white shadow-sm" />
                )}
              </button>
            );
          })}
        </div>

        <input
          ref={bgFileInputRef}
          type="file"
          accept="image/*,video/*,.mp4,.webm,.mov"
          onChange={handleCustomBgUpload}
          className="hidden"
        />
        {style.customBgUrl ? (
          <div className="flex items-center justify-between rounded-xl border border-white/15 bg-white/[0.05] p-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-black/60 border border-white/10 text-volt-300">
                {style.customBgType === "video" ? <VideoIcon size={16} /> : <ImageIcon size={16} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-white">
                  {style.customBgName || "Custom Media"}
                </p>
                <p className="text-[10.5px] font-mono text-white/45 uppercase">
                  {style.customBgType} · active
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => bgFileInputRef.current?.click()}
                className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition"
                title="Change background media"
              >
                <Upload size={14} />
              </button>
              <button
                type="button"
                onClick={() =>
                  setStyle((s) => ({
                    ...s,
                    customBgUrl: undefined,
                    customBgType: undefined,
                    customBgName: undefined,
                  }))
                }
                className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10 transition"
                title="Remove custom background (reset to theme)"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => bgFileInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-2.5 text-[12px] font-medium text-white/70 transition hover:border-white/35 hover:bg-white/[0.04] hover:text-white"
          >
            <Upload size={14} /> Upload Custom Photo or Video
          </button>
        )}
      </Section>

      <Section
        title="Text & Highlight Colors"
        action={
          <button
            type="button"
            onClick={async () => {
              const detected = await detectColorsFromBgAsync(style.bg, style.customBgUrl);
              setStyle((s) => ({
                ...s,
                materialAutoColor: true,
                highlight: detected.highlight,
                textColor: detected.textColor,
              }));
            }}
            className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-[10.5px] font-medium text-white transition hover:bg-white/20 active:scale-95"
            title="Auto-detect text & highlight colors from background"
          >
            <Sparkles size={11} className="text-volt-300" /> Auto-Detect
          </button>
        }
      >
        <div className="flex items-center justify-between rounded-xl bg-white/[0.03] p-2.5 ring-1 ring-white/[0.06] mb-3">
          <div className="flex flex-col">
            <span className="text-[12.5px] font-semibold text-white">Auto-adjust to background</span>
            <span className="text-[11px] text-white/40">
              Adapts text & highlight colors when wallpaper changes
            </span>
          </div>
          <Toggle
            checked={!!style.materialAutoColor}
            onChange={(checked) => {
              if (checked) {
                detectColorsFromBgAsync(style.bg, style.customBgUrl).then((detected) => {
                  setStyle((s) => ({
                    ...s,
                    materialAutoColor: true,
                    highlight: detected.highlight,
                    textColor: detected.textColor,
                  }));
                });
              } else {
                setStyle((s) => ({ ...s, materialAutoColor: false }));
              }
            }}
          />
        </div>

        {/* Current Active Color Pickers */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <label className="flex items-center gap-2 rounded-xl bg-black/40 p-2 ring-1 ring-white/10 cursor-pointer hover:bg-black/60 transition">
            <input
              type="color"
              value={colorToHex(style.highlight)}
              onChange={(e) => {
                const val = e.target.value;
                setStyle((s) => ({
                  ...s,
                  materialAutoColor: false,
                  highlight: val,
                }));
              }}
              className="h-6 w-6 rounded-lg cursor-pointer bg-transparent border-0 p-0"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-[9.5px] font-mono uppercase tracking-wider text-white/40">Highlight</span>
              <span className="text-[11.5px] font-medium text-white truncate">{style.highlight}</span>
            </div>
          </label>
          <label className="flex items-center gap-2 rounded-xl bg-black/40 p-2 ring-1 ring-white/10 cursor-pointer hover:bg-black/60 transition">
            <input
              type="color"
              value={colorToHex(style.textColor)}
              onChange={(e) => {
                const val = e.target.value;
                setStyle((s) => ({
                  ...s,
                  materialAutoColor: false,
                  textColor: val,
                }));
              }}
              className="h-6 w-6 rounded-lg cursor-pointer bg-transparent border-0 p-0"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-[9.5px] font-mono uppercase tracking-wider text-white/40">Verse Text</span>
              <span className="text-[11.5px] font-medium text-white/80 truncate">{style.textColor}</span>
            </div>
          </label>
        </div>

        {/* Quick Highlight Swatches */}
        <div className="mb-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-1.5">Quick Highlight Swatches</p>
          <div className="flex flex-wrap gap-1.5">
            {HIGHLIGHT_COLORS.map((c) => {
              const isSelected = style.highlight.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setStyle((s) => ({
                      ...s,
                      materialAutoColor: false,
                      highlight: c,
                    }));
                  }}
                  className={cx(
                    "h-6 w-6 rounded-full ring-1 transition hover:scale-115 active:scale-95",
                    isSelected ? "ring-white ring-2 scale-110 shadow-lg" : "ring-white/20",
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              );
            })}
          </div>
        </div>

        {/* Quick Verse Text Swatches */}
        <div className="mb-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-1.5">Quick Verse Text Swatches</p>
          <div className="flex flex-wrap gap-1.5">
            {TEXT_COLORS.map((c) => {
              const isSelected = style.textColor.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setStyle((s) => ({
                      ...s,
                      materialAutoColor: false,
                      textColor: c,
                    }));
                  }}
                  className={cx(
                    "h-6 w-6 rounded-full ring-1 transition hover:scale-115 active:scale-95",
                    isSelected ? "ring-white ring-2 scale-110 shadow-lg" : "ring-white/20",
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              );
            })}
          </div>
        </div>

        <p className="text-[11px] font-medium text-white/40 mb-2">Curated Color Palettes</p>
        <div className="grid grid-cols-3 gap-2">
          {MATERIAL_PALETTES.map((pal) => {
            const on = style.highlight === pal.highlight && style.textColor === pal.textColor;
            return (
              <button
                key={pal.id}
                type="button"
                onClick={() => {
                  setStyle((s) => ({
                    ...s,
                    materialAutoColor: false,
                    highlight: pal.highlight,
                    textColor: pal.textColor,
                  }));
                }}
                className={cx(
                  "flex flex-col items-center gap-1.5 rounded-xl p-2 text-center ring-1 transition",
                  on
                    ? "bg-white/[0.08] ring-white/30"
                    : "bg-white/[0.02] ring-white/[0.06] hover:bg-white/[0.04]",
                )}
              >
                <div className="flex items-center -space-x-1">
                  <div
                    className="h-4 w-4 rounded-full ring-1 ring-black/40 shadow-sm"
                    style={{ backgroundColor: pal.primary }}
                  />
                  <div
                    className="h-4 w-4 rounded-full ring-1 ring-black/40 shadow-sm"
                    style={{ backgroundColor: pal.highlight }}
                  />
                </div>
                <span className="text-[10.5px] font-medium text-white/80 truncate max-w-full">
                  {pal.name.split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        title="Font size"
        action={<span className="font-mono text-[11.5px] text-white/60">{style.size}px</span>}
      >
        <div className="flex items-center gap-3">
          <Type size={12} className="text-white/35" />
          <input
            type="range"
            min={18}
            max={48}
            value={style.size}
            onChange={(e) => set("size", Number(e.target.value))}
            className="range flex-1"
            style={{ ["--fill" as string]: `${sizePct}%` }}
          />
          <Type size={17} className="text-white/35" />
        </div>
      </Section>

      <Section title="Text alignment">
        <Segmented<TextAlign>
          value={style.align || "center"}
          onChange={(v) => set("align", v)}
          options={[
            { value: "left", label: "Left", icon: <AlignLeft size={13} /> },
            { value: "center", label: "Center", icon: <AlignCenter size={13} /> },
            { value: "right", label: "Right", icon: <AlignRight size={13} /> },
          ]}
        />
      </Section>

      <Section title="Text position" className="border-b-0">
        <Segmented<Position>
          value={style.position}
          onChange={(v) => set("position", v)}
          options={(["top", "center", "bottom"] as Position[]).map((p) => ({
            value: p,
            label: p[0].toUpperCase() + p.slice(1),
            icon: <PositionIcon pos={p} />,
          }))}
        />
      </Section>
    </aside>
  );
}

function AnimationThumb({ id }: { id: string; highlight: string }) {
  const base = "text-[13px] font-bold leading-none tracking-tight";
  return (
    <div
      className="grid h-10 w-12 shrink-0 place-items-center rounded-lg bg-black/50 ring-1 ring-white/[0.08]"
      style={{ fontFamily: "'Syne', sans-serif" }}
    >
      {id === "spotify" && (
        <span
          className={base}
          style={{
            color: "#1ED760",
            textShadow: "0 0 10px rgba(30, 215, 96, 0.55)",
          }}
        >
          Sp
        </span>
      )}
      {id === "apple" && (
        <span
          className={cx(base, "text-[15px]")}
          style={{
            backgroundImage: "linear-gradient(135deg, #FA2D48 0%, #FF5E3A 100%)",
            WebkitBackgroundClip: "text",
            color: "transparent",
            filter: "drop-shadow(0 0 6px rgba(250, 45, 72, 0.45))",
          }}
        >
          
        </span>
      )}
      {id === "nothing" && (
        <span
          className={cx(base, "flex items-center gap-0.5 font-mono text-[14px]")}
          style={{ fontFamily: "'Doto', monospace", color: "#FFFFFF" }}
        >
          (N)
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#D71920]" />
        </span>
      )}
      {id === "retro" && (
        <span
          className={base}
          style={{
            color: "#FBBF24",
            textShadow: "0 0 10px rgba(251, 191, 36, 0.6)",
          }}
        >
          📻
        </span>
      )}
    </div>
  );
}
