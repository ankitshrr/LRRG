import type { Line, Word } from "../../data";

export interface ActiveWordState {
  index: number;
  word: Word | null;
  progress: number;
  sung: boolean;
  active: boolean;
}

/**
 * Finds the index of the currently active line for a given timestamp.
 */
export function findActiveLineIndex(lines: Line[], time: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].start <= time) {
      idx = i;
    } else {
      break;
    }
  }
  return idx;
}

/**
 * Calculates continuous word progress [0.0 to 1.0] for a single word.
 */
export function getWordPlaybackProgress(word: Word, time: number): number {
  if (time <= word.start) return 0;
  if (time >= word.end) return 1;
  const dur = Math.max(0.05, word.end - word.start);
  return Math.min(1, Math.max(0, (time - word.start) / dur));
}

/**
 * Finds the current active word inside a line and its progress.
 */
export function findActiveWordState(words: Word[], time: number): ActiveWordState {
  if (!words || words.length === 0) {
    return { index: -1, word: null, progress: 0, sung: false, active: false };
  }

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (time >= w.start && time < w.end) {
      const progress = getWordPlaybackProgress(w, time);
      return {
        index: i,
        word: w,
        progress,
        sung: false,
        active: true,
      };
    }
  }

  // If time is past all words
  if (time >= words[words.length - 1].end) {
    return {
      index: words.length - 1,
      word: words[words.length - 1],
      progress: 1,
      sung: true,
      active: false,
    };
  }

  // Before first word
  return {
    index: 0,
    word: words[0],
    progress: 0,
    sung: false,
    active: false,
  };
}

/**
 * Nothing OS precise monospaced timestamp formatter:
 * Returns e.g. "01:23.4" or with brackets "[01:23.4]"
 */
export function formatNothingTime(seconds: number, withBrackets = false): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  const res = `${String(m).padStart(2, "0")}:${sec.toFixed(1).padStart(4, "0")}`;
  return withBrackets ? `[${res}]` : res;
}

/**
 * Remaining time in Nothing OS format: e.g. "-02:14.3"
 */
export function formatNothingRemaining(time: number, duration: number): string {
  const rem = Math.max(0, duration - time);
  return `-${formatNothingTime(rem)}`;
}
