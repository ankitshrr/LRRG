import type { ReactNode } from "react";
import { Check } from "lucide-react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Logo({ size = 28, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="grid place-items-center rounded-full bg-white"
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6}>
          {[
            [7, 12],
            [10, 8],
            [10, 12],
            [10, 16],
            [14, 6],
            [14, 10],
            [14, 14],
            [14, 18],
            [17, 10],
            [17, 14],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.35" fill="black" />
          ))}
        </svg>
      </div>
      {wordmark && (
        <span className="font-dot text-[19px] font-extrabold uppercase tracking-[0.04em] text-white">
          Lyriq
        </span>
      )}
    </div>
  );
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("border-b border-white/[0.06] px-5 py-5", className)}>
      <div className="mb-3.5 flex items-center justify-between">
        <h3 className="label">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cx("flex rounded-full bg-white/[0.04] p-1 ring-1 ring-white/[0.07]", className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] font-medium transition",
            value === o.value
              ? "bg-white text-black shadow-[0_4px_14px_-4px_rgba(255,255,255,0.25)]"
              : "text-white/45 hover:text-white/80",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-5 w-9 shrink-0 rounded-full transition",
        checked ? "bg-white" : "bg-white/[0.1] ring-1 ring-white/10",
      )}
    >
      <span
        className={cx(
          "absolute top-0.5 h-4 w-4 rounded-full transition-all",
          checked ? "left-[18px] bg-black" : "left-0.5 bg-white/60",
        )}
      />
    </button>
  );
}

export function Swatches({
  colors,
  value,
  onChange,
}: {
  colors: string[];
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {colors.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          aria-label={c}
          className={cx(
            "grid h-7 w-7 place-items-center rounded-full ring-1 ring-white/15 transition hover:scale-110",
            value.toLowerCase() === c.toLowerCase() &&
              "ring-2 ring-white ring-offset-2 ring-offset-ink-900",
          )}
          style={{ background: c }}
        >
          {value.toLowerCase() === c.toLowerCase() && (
            <Check
              size={13}
              strokeWidth={3}
              className={isDark(c) ? "text-white" : "text-black/70"}
            />
          )}
        </button>
      ))}
      <label className="ml-auto flex h-7 items-center gap-1.5 rounded-lg bg-white/[0.04] pl-1 pr-2 ring-1 ring-white/[0.08]">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-5 w-5 cursor-pointer rounded-md border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
        />
        <span className="font-mono text-[11px] uppercase text-white/60">
          {value.replace("#", "")}
        </span>
      </label>
    </div>
  );
}

function isDark(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 < 110;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] px-1.5 font-mono text-[10.5px] text-white/50">
      {children}
    </kbd>
  );
}

export function AlbumArt({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cx("relative shrink-0 overflow-hidden rounded-md ring-1 ring-white/10", className)}
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(rgba(0,0,0,0.22) 1px, transparent 1.2px) 0 0 / 4px 4px, linear-gradient(145deg, #f5f5f5 0%, #9a9a9a 100%)",
      }}
    >
      <div className="absolute inset-0 grid place-items-center">
        <div className="h-[30%] w-[30%] rounded-full bg-black" />
      </div>
    </div>
  );
}
