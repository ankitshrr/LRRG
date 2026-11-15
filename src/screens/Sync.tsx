import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  AudioLines,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Crosshair,
  Lock,
  Magnet,
  Minus,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat,
  SkipBack,
  SkipForward,
  Type,
  Unlink,
  Volume2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  TRACK,
  activeIndex,
  fmt,
  parseTime,
  waveform,
  type Line,
  type ReelStyle,
  type TrackInfo,
} from "../data";
import type { Player } from "../player";
import { Ambient, ReelPreview } from "../components/ReelPreview";
import { Toggle, cx } from "../components/ui";

type Props = {
  track?: TrackInfo;
  lines: Line[];
  setLines: Dispatch<SetStateAction<Line[]>>;
  style: ReelStyle;
  player: Player;
};

const MIN_LEN = 0.3;

export function Sync({ track = TRACK, lines, setLines, style, player }: Props) {
  const BEAT = 60 / (track.bpm || 120);
  const playingIdx = activeIndex(lines, player.time);
  const [selectedId, setSelectedId] = useState(lines[Math.max(0, playingIdx)]?.id ?? lines[0]?.id);
  const [snap, setSnap] = useState(true);
  const [loop, setLoop] = useState(false);
  const [shift, setShift] = useState(0);
  const selIdx = Math.max(
    0,
    lines.findIndex((l) => l.id === selectedId),
  );
  const sel = lines[selIdx];

  // Loop the selected segment while playing.
  useEffect(() => {
    if (loop && player.playing && sel && (player.time > sel.end || player.time < sel.start - 0.05))
      player.seek(sel.start);
  }, [loop, player, sel]);

  const setTiming = (id: string, start: number, end: number) =>
    setLines((ls) => {
      const i = ls.findIndex((l) => l.id === id);
      const lo = i > 0 ? ls[i - 1].end : 0;
      const hi = i < ls.length - 1 ? ls[i + 1].start : player.duration;
      const s = Math.min(Math.max(lo, start), hi - MIN_LEN);
      const e = Math.max(Math.min(hi, end), s + MIN_LEN);
      return ls.map((l, j) => {
        if (j !== i) return l;
        const dur = Math.max(0.1, e - s);
        const oldDur = Math.max(0.1, l.end - l.start);
        const words = l.words?.map((w) => {
          const ratioStart = Math.max(0, Math.min(1, (w.start - l.start) / oldDur));
          const ratioEnd = Math.max(0, Math.min(1, (w.end - l.start) / oldDur));
          return {
            ...w,
            start: round(s + ratioStart * dur),
            end: round(s + ratioEnd * dur),
          };
        });
        return { ...l, start: round(s), end: round(e), words };
      });
    });

  const shiftAll = (d: number) => {
    setShift((s) => round(s + d));
    setLines((ls) => {
      const minStart = ls[0]?.start ?? 0;
      const maxEnd = ls[ls.length - 1]?.end ?? 0;
      const dd = Math.min(Math.max(d, -minStart), player.duration - maxEnd);
      return ls.map((l) => ({
        ...l,
        start: round(l.start + dd),
        end: round(l.end + dd),
        words: l.words?.map((w) => ({
          ...w,
          start: round(w.start + dd),
          end: round(w.end + dd),
        })),
      }));
    });
  };

  const select = (i: number) => {
    const l = lines[i];
    if (!l) return;
    setSelectedId(l.id);
    player.seek(l.start);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(260px,320px)_1fr_340px]">
        {/* preview */}
        <div className="dot-grid relative flex items-center justify-center overflow-hidden border-white/[0.06] p-6 lg:border-r">
          <div className="relative">
            <Ambient bgId={style.bg} className="-inset-6" />
            <ReelPreview
              lines={lines}
              time={player.time}
              duration={player.duration}
              style={style}
              playing={player.playing}
              track={track}
              controls={false}
              className="h-[max(380px,calc(100vh-440px))] max-h-[560px] rounded-[22px]"
            />
          </div>
        </div>

        {/* segment table */}
        <div className="flex min-h-0 flex-col bg-black/20">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Timeline segments</h2>
              <p className="mt-0.5 text-[11.5px] text-white/40">
                Click a time to edit · ↑ ↓ nudges by 0.1s
              </p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-white/20">
              <CircleCheck size={12} /> {lines.length}/{lines.length} synced
            </span>
          </div>
          <div className="grid grid-cols-[36px_1fr_92px_92px_56px] gap-3 border-y border-white/[0.06] px-5 py-2 text-[10.5px] font-medium uppercase tracking-[0.1em] text-white/30">
            <span>#</span>
            <span>Lyric</span>
            <span>Start</span>
            <span>End</span>
            <span className="text-right">Length</span>
          </div>
          <div className="max-h-[360px] flex-1 overflow-y-auto px-2 py-1.5 lg:max-h-none">
            {lines.map((l, i) => {
              const isSel = l.id === selectedId;
              const isPlaying = i === playingIdx;

              return (
                <div
                  key={l.id}
                  onClick={() => select(i)}
                  className={cx(
                    "group/row grid cursor-pointer grid-cols-[36px_1fr_92px_92px_56px] items-center gap-3 rounded-lg px-3 py-1.5 transition",
                    isSel ? "bg-volt-500/[0.1] ring-1 ring-volt-400/30" : "hover:bg-white/[0.03]",
                  )}
                >
                  <span className="flex items-center justify-center font-mono text-[11px] text-white/30 h-7">
                    {isPlaying ? (
                      <span className="flex h-3 items-end gap-[2px]">
                        {[0.6, 1, 0.75].map((h, k) => (
                          <span
                            key={k}
                            className={cx(
                              "w-[2px] origin-bottom rounded-full bg-volt-300",
                              player.playing && "animate-eq",
                            )}
                            style={{ height: `${h * 100}%`, animationDelay: `${k * 0.15}s` }}
                          />
                        ))}
                      </span>
                    ) : (
                      String(i + 1).padStart(2, "0")
                    )}
                  </span>

                  <div className="flex items-center min-w-0">
                    <span
                      className={cx(
                        "truncate text-[13px]",
                        isSel || isPlaying ? "text-white font-medium" : "text-white/60",
                      )}
                    >
                      {l.text}
                    </span>
                  </div>

                  <TimeInput value={l.start} onCommit={(v) => setTiming(l.id, v, l.end)} />
                  <TimeInput value={l.end} onCommit={(v) => setTiming(l.id, l.start, v)} />
                  <span className="text-right font-mono text-[11px] text-white/40">
                    {(l.end - l.start).toFixed(1)}s
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* inspector */}
        {sel && (
          <aside className="overflow-y-auto border-white/[0.06] glass lg:border-l">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div>
                <p className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-volt-300">
                  Segment {String(selIdx + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-0.5 text-[14px] font-semibold">Timing</h2>
              </div>
              <div className="flex gap-1">
                <IconBtn
                  label="Previous segment"
                  onClick={() => select(selIdx - 1)}
                  disabled={selIdx === 0}
                >
                  <ChevronLeft size={15} />
                </IconBtn>
                <IconBtn
                  label="Next segment"
                  onClick={() => select(selIdx + 1)}
                  disabled={selIdx === lines.length - 1}
                >
                  <ChevronRight size={15} />
                </IconBtn>
              </div>
            </div>

            <div className="px-5 pt-5">
              <p className="text-[20px] font-medium leading-[1.25] tracking-[-0.02em] text-white">
                {sel.text}
              </p>
              <SegmentScope line={sel} time={player.time} duration={player.duration} />

              {sel.words && sel.words.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-[11px] text-white/40">
                    <span>Word-level acoustic sync</span>
                    <span>Click word to jump</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {sel.words.map((w, wIdx) => {
                      const isWordActive = player.time >= w.start && player.time <= w.end;
                      const isWordSung = player.time > w.end;
                      return (
                        <button
                          key={wIdx}
                          onClick={() => player.seek(w.start)}
                          title={`Jump to ${w.text} (${fmt(w.start, true)})`}
                          className={cx(
                            "flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11.5px] transition ring-1",
                            isWordActive
                              ? "bg-volt-400 font-bold text-black ring-volt-300 scale-105 shadow-[0_0_12px_rgba(255,255,255,0.2)]"
                              : isWordSung
                                ? "bg-white/10 text-white/90 ring-white/20 hover:bg-white/15"
                                : "bg-white/[0.03] text-white/45 ring-white/[0.07] hover:bg-white/[0.08] hover:text-white/80",
                          )}
                        >
                          <span>{w.text}</span>
                          <span className="text-[9.5px] opacity-60">
                            {fmt(w.start, true).slice(0, -1)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 px-5 py-5">
              <TimeControl
                label="Start"
                color="bg-white"
                value={sel.start}
                onChange={(v) => setTiming(sel.id, v, sel.end)}
                onPlayhead={() => setTiming(sel.id, player.time, sel.end)}
              />
              <TimeControl
                label="End"
                color="bg-neutral-500"
                value={sel.end}
                onChange={(v) => setTiming(sel.id, sel.start, v)}
                onPlayhead={() => setTiming(sel.id, sel.start, player.time)}
              />
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Stat label="Length" value={`${(sel.end - sel.start).toFixed(2)}s`} />
                <Stat
                  label="Pace"
                  value={`${(sel.text.split(/\s+/).length / (sel.end - sel.start)).toFixed(1)} w/s`}
                />
              </div>
            </div>

            <div className="space-y-4 border-t border-white/[0.06] px-5 py-5">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/40">
                Global
              </h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-white">Shift all lyrics</p>
                  <p className="font-mono text-[11px] text-white/40">
                    {shift >= 0 ? "+" : ""}
                    {(shift * 1000).toFixed(0)} ms
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-1 ring-1 ring-white/[0.06]">
                  <button
                    onClick={() => shiftAll(-0.1)}
                    className="rounded-md px-2 py-1 font-mono text-[11px] text-white/60 hover:bg-white/10 hover:text-white"
                  >
                    −100
                  </button>
                  <button
                    onClick={() => shiftAll(0.1)}
                    className="rounded-md px-2 py-1 font-mono text-[11px] text-white/60 hover:bg-white/10 hover:text-white"
                  >
                    +100
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="flex items-center gap-1.5 text-[13px] text-white">
                    <Magnet size={13} className="text-volt-300" /> Snap to beat
                  </p>
                  <p className="text-[11px] text-white/40">{track.bpm} BPM grid when dragging</p>
                </div>
                <Toggle checked={snap} onChange={setSnap} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="flex items-center gap-1.5 text-[13px] text-white">
                    <Repeat size={13} className="text-volt-300" /> Loop segment
                  </p>
                  <p className="text-[11px] text-white/40">Repeat while fine-tuning</p>
                </div>
                <Toggle checked={loop} onChange={setLoop} />
              </div>
            </div>
          </aside>
        )}
      </div>

      <Timeline
        track={track}
        lines={lines}
        player={player}
        selectedId={selectedId}
        onSelect={select}
        setTiming={setTiming}
        snap={snap}
        loop={loop}
        setLoop={setLoop}
      />
    </div>
  );
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-7 w-7 place-items-center rounded-lg text-white/60 ring-1 ring-white/[0.08] transition hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/[0.06]">
      <p className="text-[10.5px] uppercase tracking-[0.1em] text-white/35">{label}</p>
      <p className="mt-0.5 font-mono text-[14px] text-white">{value}</p>
    </div>
  );
}

function TimeInput({
  value,
  onCommit,
  large,
}: {
  value: number;
  onCommit: (v: number) => void;
  large?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && parseTime(draft) === null;
  const commit = () => {
    if (draft !== null) {
      const v = parseTime(draft);
      if (v !== null) onCommit(v);
    }
    setDraft(null);
  };
  return (
    <input
      value={draft ?? fmt(value, true)}
      onClick={(e) => e.stopPropagation()}
      onFocus={(e) => {
        setDraft(fmt(value, true));
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(null);
          e.currentTarget.blur();
        }
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const step = (e.shiftKey ? 1 : 0.1) * (e.key === "ArrowUp" ? 1 : -1);
          const v = Math.max(0, (parseTime(draft ?? "") ?? value) + step);
          onCommit(v);
          setDraft(fmt(v, true));
        }
      }}
      className={cx(
        "w-full rounded-md bg-transparent font-mono tabular-nums outline-none ring-1 transition",
        large
          ? "px-0 py-0 text-[22px] tracking-tight text-white ring-transparent"
          : "px-2 py-1 text-[12px] text-white/75 ring-transparent hover:ring-white/10",
        "focus:bg-white/[0.04] focus:text-white focus:ring-volt-400/60",
        invalid && "ring-neutral-500/70 focus:ring-neutral-500/70",
      )}
    />
  );
}

function TimeControl({
  label,
  color,
  value,
  onChange,
  onPlayhead,
}: {
  label: string;
  color: string;
  value: number;
  onChange: (v: number) => void;
  onPlayhead: () => void;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.03] p-3.5 ring-1 ring-white/[0.07]">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[11.5px] font-medium text-white/50">
          <span className={cx("h-1.5 w-1.5 rounded-full", color)} /> {label}
        </span>
        <button
          onClick={onPlayhead}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-volt-300 transition hover:bg-volt-500/10"
        >
          <Crosshair size={12} /> Set to playhead
        </button>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <TimeInput value={value} onCommit={onChange} large />
        </div>
        <div className="flex items-center rounded-lg bg-black/30 p-0.5 ring-1 ring-white/[0.06]">
          <button
            onClick={() => onChange(value - 0.1)}
            aria-label={`${label} −0.1s`}
            className="grid h-7 w-7 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
          >
            <Minus size={13} />
          </button>
          <span className="px-1 font-mono text-[10px] text-white/30">0.1s</span>
          <button
            onClick={() => onChange(value + 0.1)}
            aria-label={`${label} +0.1s`}
            className="grid h-7 w-7 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Zoomed waveform of the selected segment with ±1s of context. */
function SegmentScope({ line, time, duration }: { line: Line; time: number; duration: number }) {
  const from = Math.max(0, line.start - 1);
  const to = Math.min(duration, line.end + 1);
  const bars = useMemo(() => {
    const all = waveform(Math.round(duration * 12), duration);
    return all.slice(Math.floor(from * 12), Math.ceil(to * 12));
  }, [from, to, duration]);
  const pct = (t: number) => ((t - from) / (to - from)) * 100;
  return (
    <div className="relative mt-4 h-16 overflow-hidden rounded-xl bg-black/30 ring-1 ring-white/[0.06]">
      <div
        className="absolute inset-y-0 bg-volt-500/[0.14]"
        style={{ left: `${pct(line.start)}%`, width: `${pct(line.end) - pct(line.start)}%` }}
      />
      <div className="absolute inset-0 flex items-center gap-[2px] px-1">
        {bars.map((h, i) => {
          const t = from + (i / bars.length) * (to - from);
          const inside = t >= line.start && t <= line.end;
          return (
            <span
              key={i}
              className={cx("flex-1 rounded-full", inside ? "bg-volt-300" : "bg-white/15")}
              style={{ height: `${h * 85}%` }}
            />
          );
        })}
      </div>
      <div className="absolute inset-y-0 w-px bg-white" style={{ left: `${pct(line.start)}%` }} />
      <div
        className="absolute inset-y-0 w-px bg-neutral-500"
        style={{ left: `${pct(line.end)}%` }}
      />
      {time >= from && time <= to && (
        <div className="absolute inset-y-0 w-px bg-white" style={{ left: `${pct(time)}%` }} />
      )}
    </div>
  );
}

function Timeline({
  track,
  lines,
  player,
  selectedId,
  onSelect,
  setTiming,
  snap,
  loop,
  setLoop,
}: {
  track: TrackInfo;
  lines: Line[];
  player: Player;
  selectedId: string;
  onSelect: (i: number) => void;
  setTiming: (id: string, s: number, e: number) => void;
  snap: boolean;
  loop: boolean;
  setLoop: (v: boolean) => void;
}) {
  const BEAT = 60 / (track?.bpm || 120);
  const [pps, setPps] = useState(36);
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: string;
    edge: "start" | "end";
    x0: number;
    s0: number;
    e0: number;
  } | null>(null);
  const safeDuration = Math.max(1, player.duration || track?.duration || 90);
  const width = safeDuration * pps;
  const WAVE_H = 88;
  const bars = useMemo(() => waveform(Math.floor(width / 3), safeDuration), [width, safeDuration]);
  const x = (player.time || 0) * pps;
  const beatCount = Math.max(0, Math.min(2000, Math.floor(safeDuration / BEAT)));

  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc || !player.playing) return;
    if (x < sc.scrollLeft || x > sc.scrollLeft + sc.clientWidth - 80) sc.scrollLeft = x - 120;
  }, [x, player.playing]);

  const seekFromEvent = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    player.seek((e.clientX - r.left) / pps);
  };

  const majorEvery = pps < 24 ? 10 : 5;
  const sel = lines.find((l) => l.id === selectedId);

  const wave = (
    <svg width={width} height={WAVE_H} className="block">
      {bars.map((h, i) => {
        const bh = Math.max(2, h * (WAVE_H - 12));
        return <rect key={i} x={i * 3} y={(WAVE_H - bh) / 2} width={2} height={bh} rx={1} />;
      })}
    </svg>
  );

  return (
    <section className="flex h-[318px] shrink-0 flex-col border-t border-white/[0.08] glass">
      {/* transport */}
      <div className="flex h-14 shrink-0 items-center gap-4 border-b border-white/[0.06] px-4">
        <div className="flex items-center gap-1">
          <button
            onClick={player.prev}
            aria-label="Previous lyric"
            className="grid h-8 w-8 place-items-center rounded-lg text-white/60 hover:bg-white/[0.06] hover:text-white"
          >
            <SkipBack size={15} fill="currentColor" />
          </button>
          <button
            onClick={player.toggle}
            aria-label={player.playing ? "Pause" : "Play"}
            className="grid h-9 w-9 place-items-center rounded-full bg-white text-black shadow-[0_6px_20px_-6px_rgba(255,255,255,0.10)] transition hover:scale-105"
          >
            {player.playing ? (
              <Pause size={15} fill="currentColor" />
            ) : (
              <Play size={15} fill="currentColor" className="ml-0.5" />
            )}
          </button>
          <button
            onClick={player.next}
            aria-label="Next lyric"
            className="grid h-8 w-8 place-items-center rounded-lg text-white/60 hover:bg-white/[0.06] hover:text-white"
          >
            <SkipForward size={15} fill="currentColor" />
          </button>
          <button
            onClick={() => setLoop(!loop)}
            aria-label="Loop segment"
            className={cx(
              "ml-1 grid h-8 w-8 place-items-center rounded-lg transition",
              loop
                ? "bg-volt-500/15 text-volt-300"
                : "text-white/45 hover:bg-white/[0.06] hover:text-white",
            )}
          >
            <Repeat size={15} />
          </button>
        </div>
        <div className="flex items-baseline gap-1.5 font-mono tabular-nums">
          <span className="text-[17px] text-white">{fmt(player.time, true)}</span>
          <span className="text-[12px] text-white/35">/ {fmt(player.duration, true)}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-1.5 text-[11.5px] text-white/35 md:flex">
            <span className="h-2 w-2 rounded-sm bg-volt-400" /> Drag edges to retime
          </span>
          <div className="h-5 w-px bg-white/10" />
          <button
            onClick={() => setPps((p) => Math.max(12, p - 8))}
            aria-label="Zoom out"
            className="text-white/45 hover:text-white"
          >
            <ZoomOut size={15} />
          </button>
          <input
            type="range"
            min={12}
            max={96}
            value={pps}
            onChange={(e) => setPps(Number(e.target.value))}
            className="range w-28"
            style={{ ["--fill" as string]: `${((pps - 12) / 84) * 100}%` }}
          />
          <button
            onClick={() => setPps((p) => Math.min(96, p + 8))}
            aria-label="Zoom in"
            className="text-white/45 hover:text-white"
          >
            <ZoomIn size={15} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* track headers */}
        <div className="w-[184px] shrink-0 border-r border-white/[0.06] bg-black/20">
          <div className="h-8 border-b border-white/[0.06]" />
          <TrackHeader
            icon={<Music2 size={14} />}
            name="Audio"
            meta={track.file}
            h={WAVE_H + 16}
            tools
          />
          <TrackHeader
            icon={<Type size={14} />}
            name="Lyrics"
            meta={`${lines.length} segments`}
            h={72}
          />
          <TrackHeader
            icon={<AudioLines size={14} />}
            name="Beat grid"
            meta={`${track.bpm} BPM`}
            h={36}
          />
        </div>

        {/* scrollable tracks */}
        <div ref={scrollRef} className="relative min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div className="relative" style={{ width: width + 48 }}>
            {/* ruler */}
            <div
              className="relative h-8 cursor-col-resize border-b border-white/[0.06] bg-black/10"
              style={{ width }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                seekFromEvent(e);
              }}
              onPointerMove={(e) => e.buttons === 1 && seekFromEvent(e)}
            >
              {Array.from({ length: Math.floor(player.duration) + 1 }, (_, s) => (
                <div key={s} className="absolute bottom-0" style={{ left: s * pps }}>
                  <div
                    className={cx(
                      "w-px",
                      s % majorEvery === 0 ? "h-3 bg-white/30" : "h-1.5 bg-white/12",
                    )}
                  />
                  {s % majorEvery === 0 && (
                    <span className="absolute bottom-3.5 left-1 font-mono text-[10px] text-white/40">
                      {fmt(s)}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* waveform */}
            <div
              className="relative cursor-text border-b border-white/[0.06] py-2"
              style={{ width }}
              onPointerDown={seekFromEvent}
            >
              {sel && (
                <div
                  className="absolute inset-y-0 bg-volt-500/[0.08]"
                  style={{ left: sel.start * pps, width: (sel.end - sel.start) * pps }}
                />
              )}
              <div className="fill-white/[0.16]">{wave}</div>
              <div className="absolute left-0 top-2 overflow-hidden" style={{ width: x }}>
                <svg width="0" height="0" className="absolute">
                  <defs>
                    <linearGradient id="wv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c4b5fd" />
                      <stop offset="50%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#c4b5fd" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="fill-[url(#wv)]">{wave}</div>
              </div>
            </div>

            {/* lyric segments */}
            <div className="relative h-[72px] border-b border-white/[0.06]" style={{ width }}>
              {lines.map((l, i) => {
                const isSel = l.id === selectedId;
                const live = player.time >= l.start && player.time < l.end;
                const w = (l.end - l.start) * pps;
                const startDrag = (edge: "start" | "end") => (e: React.PointerEvent) => {
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  drag.current = { id: l.id, edge, x0: e.clientX, s0: l.start, e0: l.end };
                  if (!isSel) onSelect(i);
                };
                const moveDrag = (e: React.PointerEvent) => {
                  const d = drag.current;
                  if (!d || d.id !== l.id) return;
                  let v = (d.edge === "start" ? d.s0 : d.e0) + (e.clientX - d.x0) / pps;
                  if (snap) v = Math.round(v / BEAT) * BEAT;
                  if (d.edge === "start") setTiming(l.id, v, d.e0);
                  else setTiming(l.id, d.s0, v);
                };
                return (
                  <div
                    key={l.id}
                    onPointerDown={() => onSelect(i)}
                    className={cx(
                      "group absolute top-2.5 bottom-2.5 cursor-pointer overflow-hidden rounded-lg px-2.5 py-1.5 ring-1 transition-[background,box-shadow]",
                      isSel
                        ? "z-10 bg-gradient-to-b from-volt-500/50 to-volt-700/40 ring-volt-300/80 shadow-[0_0_24px_-6px_rgba(255,255,255,0.10)]"
                        : live
                          ? "bg-white/[0.09] ring-volt-400/40"
                          : "bg-white/[0.045] ring-white/[0.08] hover:bg-white/[0.08]",
                    )}
                    style={{ left: l.start * pps + 1, width: Math.max(4, w - 2) }}
                  >
                    <p className="truncate font-mono text-[9.5px] text-white/45">
                      {String(i + 1).padStart(2, "0")} · {fmt(l.start, true)}
                    </p>
                    <p
                      className={cx(
                        "truncate text-[12px] font-medium",
                        isSel ? "text-white" : "text-white/75",
                      )}
                    >
                      {l.text}
                    </p>
                    {(["start", "end"] as const).map((edge) => (
                      <span
                        key={edge}
                        onPointerDown={startDrag(edge)}
                        onPointerMove={moveDrag}
                        onPointerUp={() => (drag.current = null)}
                        className={cx(
                          "absolute inset-y-0 flex w-2.5 cursor-ew-resize items-center justify-center",
                          edge === "start" ? "left-0" : "right-0",
                        )}
                      >
                        <span
                          className={cx(
                            "h-6 w-[3px] rounded-full transition",
                            isSel ? "bg-white" : "bg-white/0 group-hover:bg-white/40",
                          )}
                        />
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* beat grid */}
            <div className="relative h-9" style={{ width }}>
              {Array.from({ length: beatCount }, (_, b) => (
                <span
                  key={b}
                  className={cx(
                    "absolute top-1/2 w-px -translate-y-1/2",
                    b % 4 === 0 ? "h-4 bg-volt-400/50" : "h-2 bg-white/15",
                  )}
                  style={{ left: b * BEAT * pps }}
                />
              ))}
            </div>

            {/* playhead */}
            <div className="pointer-events-none absolute inset-y-0 z-20" style={{ left: x }}>
              <div className="absolute -left-[6px] top-0 h-3 w-[13px] rounded-b-[4px] rounded-t-sm bg-white shadow-[0_0_10px_rgba(255,255,255,0.10)]" />
              <div className="absolute bottom-0 left-0 top-0 w-px bg-white shadow-[0_0_8px_rgba(255,255,255,0.10)]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrackHeader({
  icon,
  name,
  meta,
  h,
  tools,
}: {
  icon: React.ReactNode;
  name: string;
  meta: string;
  h: number;
  tools?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2.5 border-b border-white/[0.06] px-3"
      style={{ height: h }}
    >
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-white/60 ring-1 ring-white/[0.06]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium text-white">{name}</p>
        <p className="truncate text-[10.5px] text-white/35">{meta}</p>
      </div>
      {tools && (
        <div className="flex flex-col gap-1 text-white/30">
          <Volume2 size={12} />
          <Lock size={12} />
        </div>
      )}
    </div>
  );
}
