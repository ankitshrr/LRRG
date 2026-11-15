import {
  normalizeLyricalLines,
  splitWordsIntoSentenceGroups,
  type Line,
  type Word,
} from "../../data";

export interface CustomLyricJson {
  lines: Array<{
    id?: string;
    text?: string;
    start: number;
    end?: number;
    words?: Array<{
      text: string;
      start: number;
      end: number;
    }>;
  }>;
}

/**
 * Parses time format [mm:ss.xx] or mm:ss.xxx into seconds.
 */
export function parseTimestamp(str: string): number | null {
  const clean = str.trim().replace(/^\[|\]$/g, "").replace(/s$/i, "").replace(",", ".");
  const parts = clean.split(":");
  if (parts.length === 2) {
    const min = parseFloat(parts[0]);
    const sec = parseFloat(parts[1]);
    if (!isNaN(min) && !isNaN(sec)) {
      return +(min * 60 + sec).toFixed(2);
    }
  } else if (parts.length === 3) {
    const hr = parseFloat(parts[0]);
    const min = parseFloat(parts[1]);
    const sec = parseFloat(parts[2]);
    if (!isNaN(hr) && !isNaN(min) && !isNaN(sec)) {
      return +(hr * 3600 + min * 60 + sec).toFixed(2);
    }
  }
  const directSec = parseFloat(clean);
  return !isNaN(directSec) ? +directSec.toFixed(2) : null;
}

/**
 * Enhanced & Flexible LRC parser:
 * Handles standard LRC `[00:12.34] lyric`
 * Flexible/bare timestamps `(00:12.34) lyric` or `00:12.34 lyric` or `1:23 lyric`
 * AND enhanced word-by-word timestamps:
 * e.g. `[00:12.34] <00:12.34> You <00:12.60> are <00:12.90> my <00:13.20> sunshine`
 */
export function parseLrcOrEnhanced(content: string, defaultDuration = 90): Line[] {
  const rawLines = content.split(/\r?\n/);
  const parsed: Array<{ start: number; text: string; words?: Word[] }> = [];

  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // Matches [01:23.45], (01:23.45), 01:23.45, [1:23], 1:23, 00:01:23.45
    const lineMatch = trimmed.match(
      /^(?:\[|\()?(\d{1,2}:[0-5]\d(?:\.\d{1,3})?|\d{1,2}:[0-5]\d:[0-5]\d(?:\.\d{1,3})?|\d+(?:\.\d+)?s?)(?:\]|\))?\s*[:-]?\s*(.*)$/,
    );
    if (!lineMatch) continue;

    const lineStart = parseTimestamp(lineMatch[1]);
    if (lineStart === null) continue;

    const rest = lineMatch[2].trim();
    if (!rest) continue;

    // Check if rest contains enhanced word timestamps: <01:23.45> word <01:23.80> next
    const wordPattern = /<(\d{1,2}:\d{2}(?:\.\d{1,3})?)>([^<]+)/g;
    const wordMatches = [...rest.matchAll(wordPattern)];

    if (wordMatches.length > 0) {
      const words: Word[] = [];
      const cleanLineWords: string[] = [];

      for (let i = 0; i < wordMatches.length; i++) {
        const wStart = parseTimestamp(wordMatches[i][1]) ?? lineStart;
        const wText = wordMatches[i][2].trim();
        if (!wText) continue;

        let wEnd = wStart + 0.5;
        if (i < wordMatches.length - 1) {
          const nextStart = parseTimestamp(wordMatches[i + 1][1]);
          if (nextStart !== null && nextStart > wStart) {
            wEnd = nextStart;
          }
        }

        words.push({
          text: wText,
          start: wStart,
          end: +wEnd.toFixed(2),
        });
        cleanLineWords.push(wText);
      }

      parsed.push({
        start: lineStart,
        text: cleanLineWords.join(" "),
        words,
      });
    } else {
      // Standard line without inline tags
      parsed.push({
        start: lineStart,
        text: rest,
      });
    }
  }

  if (parsed.length === 0) return [];
  parsed.sort((a, b) => a.start - b.start);

  const rawLinesList: Line[] = parsed.map((item, idx) => {
    const nextItem = parsed[idx + 1];
    const lineEnd = nextItem
      ? Math.max(item.start + 0.8, nextItem.start - 0.2)
      : Math.max(item.start + 3.5, defaultDuration);

    let words = item.words;
    if (!words || words.length === 0) {
      const textWords = item.text.split(/\s+/).filter(Boolean);
      const wordDur = textWords.length > 0 ? (lineEnd - item.start) / textWords.length : 0;
      words = textWords.map((txt, wIdx) => ({
        text: txt,
        start: +(item.start + wIdx * wordDur).toFixed(2),
        end: +(item.start + (wIdx + 1) * wordDur).toFixed(2),
      }));
    }

    return {
      id: `l${idx}`,
      text: item.text,
      start: item.start,
      end: +lineEnd.toFixed(2),
      words,
    };
  });

  return normalizeLyricalLines(rawLinesList);
}

/**
 * Timed Text Markup Language (TTML) XML Parser:
 * Supports Apple Music / karaoke style <p begin="..." end="..."> tags with inline <span> words.
 */
export function parseTtml(ttmlString: string, defaultDuration = 90): Line[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(ttmlString, "text/xml");
    const pElements = Array.from(doc.querySelectorAll("p"));
    if (pElements.length === 0) return [];

    const lines: Line[] = [];

    const parseTtmlTime = (attr: string | null): number | null => {
      if (!attr) return null;
      if (attr.endsWith("s")) return parseFloat(attr.slice(0, -1));
      return parseTimestamp(attr);
    };

    pElements.forEach((p, idx) => {
      const start = parseTtmlTime(p.getAttribute("begin")) ?? idx * 3;
      const spans = Array.from(p.querySelectorAll("span"));
      const pText = p.textContent?.trim() || "";

      let words: Word[] = [];

      if (spans.length > 0) {
        words = spans
          .map((span) => {
            const wStart = parseTtmlTime(span.getAttribute("begin")) ?? start;
            const wEnd = parseTtmlTime(span.getAttribute("end")) ?? wStart + 0.4;
            const text = span.textContent?.trim() || "";
            return {
              text,
              start: +wStart.toFixed(2),
              end: +wEnd.toFixed(2),
            };
          })
          .filter((w) => Boolean(w.text));
      }

      const calculatedEnd =
        parseTtmlTime(p.getAttribute("end")) ??
        (words.length > 0 ? words[words.length - 1].end : start + 3);

      if (!words || words.length === 0) {
        const textWords = pText.split(/\s+/).filter(Boolean);
        const wDur = textWords.length > 0 ? (calculatedEnd - start) / textWords.length : 0.4;
        words = textWords.map((txt, wIdx) => ({
          text: txt,
          start: +(start + wIdx * wDur).toFixed(2),
          end: +(start + (wIdx + 1) * wDur).toFixed(2),
        }));
      }

      lines.push({
        id: `ttml-${idx}`,
        text: pText || words.map((w) => w.text).join(" "),
        start: +start.toFixed(2),
        end: +calculatedEnd.toFixed(2),
        words,
      });
    });

    lines.sort((a, b) => a.start - b.start);
    return lines;
  } catch (err) {
    console.warn("TTML parsing error:", err);
    return [];
  }
}

/**
 * Custom JSON Lyric Parser:
 * Supports format:
 * {
 *   "lines": [
 *     { "start": 10.0, "end": 13.5, "text": "...", "words": [ { "text": "You", "start": 10.0, "end": 10.3 } ] }
 *   ]
 * }
 */
export function parseJsonLyrics(jsonData: unknown, defaultDuration = 90): Line[] {
  try {
    let data: any = jsonData;
    if (typeof jsonData === "string") {
      data = JSON.parse(jsonData);
    }
    const rawLines = Array.isArray(data) ? data : data?.lines || data?.lyrics || [];
    if (!Array.isArray(rawLines)) return [];

    return rawLines.map((item: any, idx: number) => {
      const start =
        typeof item.start === "number" ? item.start : parseTimestamp(item.time || "") || idx * 3;
      const text =
        item.text ||
        (Array.isArray(item.words) ? item.words.map((w: any) => w.text).join(" ") : "");
      const end = typeof item.end === "number" ? item.end : start + 3.2;

      let words: Word[] = [];
      if (Array.isArray(item.words) && item.words.length > 0) {
        words = item.words.map((w: any) => ({
          text: String(w.text || ""),
          start: typeof w.start === "number" ? +w.start.toFixed(2) : start,
          end: typeof w.end === "number" ? +w.end.toFixed(2) : start + 0.3,
        }));
      } else {
        const textWords = text.split(/\s+/).filter(Boolean);
        const wDur = textWords.length > 0 ? (end - start) / textWords.length : 0.4;
        words = textWords.map((txt: string, wIdx: number) => ({
          text: txt,
          start: +(start + wIdx * wDur).toFixed(2),
          end: +(start + (wIdx + 1) * wDur).toFixed(2),
        }));
      }

      return {
        id: item.id || `json-${idx}`,
        text,
        start: +start.toFixed(2),
        end: +end.toFixed(2),
        words,
      };
    });
  } catch (err) {
    console.warn("JSON lyric parse error:", err);
    return [];
  }
}

/**
 * SubRip (.srt) and WebVTT (.vtt) Subtitle Parser:
 * Supports timestamps:
 * 00:01:23,450 --> 00:01:26,500
 * or 01:23.450 --> 01:26.500
 */
export function parseSrtOrVtt(content: string, defaultDuration = 90): Line[] {
  const blocks = content.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  const parsed: Array<{ start: number; end: number; text: string; words?: Word[] }> = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || trimmed === "WEBVTT") continue;

    const timeMatch = trimmed.match(
      /(?:(\d{1,2}:)?(\d{1,2}):(\d{2})[,.](\d{2,3}))\s*-->\s*(?:(\d{1,2}:)?(\d{1,2}):(\d{2})[,.](\d{2,3}))/,
    );
    if (!timeMatch) continue;

    const blockLines = trimmed.split("\n");
    const timeLineIdx = blockLines.findIndex((l) => l.includes("-->"));
    if (timeLineIdx === -1) continue;

    const textLines = blockLines
      .slice(timeLineIdx + 1)
      .map((l) => l.replace(/<[^>]+>/g, "").trim())
      .filter(Boolean);
    const text = textLines.join(" ");
    if (!text) continue;

    const parts = timeMatch[0].split("-->");
    const start = parseTimestamp(parts[0].trim().replace(",", "."));
    const end = parseTimestamp(parts[1].trim().replace(",", "."));

    if (start !== null) {
      const validEnd = end !== null && end > start ? end : start + 3.2;
      const textWords = text.split(/\s+/).filter(Boolean);
      const wDur = textWords.length > 0 ? (validEnd - start) / textWords.length : 0.4;
      const words: Word[] = textWords.map((txt, wIdx) => ({
        text: txt,
        start: +(start + wIdx * wDur).toFixed(2),
        end: +(start + (wIdx + 1) * wDur).toFixed(2),
      }));

      parsed.push({
        start: +start.toFixed(2),
        end: +validEnd.toFixed(2),
        text,
        words,
      });
    }
  }

  if (parsed.length === 0) return [];
  parsed.sort((a, b) => a.start - b.start);

  const rawLines: Line[] = parsed.map((item, idx) => ({
    id: `srt-${idx}`,
    text: item.text,
    start: item.start,
    end: item.end,
    words: item.words,
  }));

  return normalizeLyricalLines(rawLines);
}

/**
 * Intelligent Plain Text Lyric Parser & Auto-Timestamp Generator:
 * Takes plain un-timestamped lyrics, runs NLP sentence & phrase boundary segmentation,
 * and automatically distributes musical timestamps and word-level timings across the audio duration.
 */
export function parsePlainTextLyrics(text: string, duration = 90): Line[] {
  const clean = text.trim();
  if (!clean) return [];

  const rawLines = clean
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (rawLines.length === 0) return [];

  // Group into lyrical sentences using our NLP sentence & phrase boundary detector
  const sentenceTexts: string[] = [];

  for (const rl of rawLines) {
    const rawWords = rl.split(/\s+/).filter(Boolean);
    if (rawWords.length === 0) continue;

    const pseudoWords: Word[] = rawWords.map((w, i) => ({
      text: w,
      start: i,
      end: i + 1,
    }));

    const groups = splitWordsIntoSentenceGroups(pseudoWords);
    if (groups.length > 1) {
      groups.forEach((g) => {
        const t = g.words.map((w) => w.text).join(" ").trim();
        if (t) sentenceTexts.push(t);
      });
    } else {
      sentenceTexts.push(rl);
    }
  }

  if (sentenceTexts.length === 0) return [];

  // Automatically calculate musically paced timestamps across duration
  const safeDur = Math.max(15, duration);
  const introDelay = Math.min(2.5, safeDur * 0.03);
  const availableDur = Math.max(10, safeDur - introDelay - 3);

  // Compute total character weight to pace lines naturally according to lyric length
  const totalChars = sentenceTexts.reduce((acc, t) => acc + Math.max(8, t.length), 0);

  let currentStart = introDelay;
  const rawLinesWithTimes: Line[] = [];

  for (let idx = 0; idx < sentenceTexts.length; idx++) {
    const lineText = sentenceTexts[idx];
    const weight = Math.max(8, lineText.length) / totalChars;
    const lineDur = Math.max(1.8, +(weight * availableDur).toFixed(2));
    const lineEnd = +(currentStart + lineDur).toFixed(2);

    const wordsRaw = lineText.split(/\s+/).filter(Boolean);
    const wordDur = wordsRaw.length > 0 ? (lineEnd - currentStart) / wordsRaw.length : 0.3;

    const words: Word[] = wordsRaw.map((w, wIdx) => ({
      text: w,
      start: +(currentStart + wIdx * wordDur).toFixed(2),
      end: +(currentStart + (wIdx + 1) * wordDur).toFixed(2),
    }));

    rawLinesWithTimes.push({
      id: `manual-l${idx}`,
      text: lineText,
      start: +currentStart.toFixed(2),
      end: lineEnd,
      words,
    });

    currentStart = lineEnd + 0.25; // 250ms vocal breathing pause between lines
  }

  return normalizeLyricalLines(rawLinesWithTimes);
}

export type LyricFormatType =
  | "enhanced_lrc"
  | "standard_lrc"
  | "flexible_lrc"
  | "srt_vtt"
  | "ttml"
  | "json"
  | "plain_text"
  | "empty";

export type DetectedLyricInfo = {
  format: LyricFormatType;
  label: string;
  hasTimestamps: boolean;
  linesCount: number;
  lines: Line[];
};

/**
 * Automatically inspects the raw text/content and detects the timestamp and lyric format.
 */
export function detectLyricFormat(content: string | object): {
  format: LyricFormatType;
  label: string;
  hasTimestamps: boolean;
} {
  if (typeof content === "object" && content !== null) {
    return { format: "json", label: "JSON Timed Lyrics", hasTimestamps: true };
  }

  const str = String(content || "").trim();
  if (!str) {
    return { format: "empty", label: "No content", hasTimestamps: false };
  }

  if (str.startsWith("{") || str.startsWith("[")) {
    try {
      JSON.parse(str);
      return { format: "json", label: "JSON Timed Lyrics", hasTimestamps: true };
    } catch {}
  }

  if (
    str.includes("<tt") ||
    str.includes("<p ") ||
    str.includes('xmlns="http://www.w3.org/ns/ttml"')
  ) {
    return { format: "ttml", label: "TTML Karaoke XML", hasTimestamps: true };
  }

  if (str.includes("-->")) {
    return { format: "srt_vtt", label: "SRT / WebVTT Subtitles", hasTimestamps: true };
  }

  if (/<(\d{1,2}:\d{2}(?:\.\d{1,3})?)>/.test(str)) {
    return {
      format: "enhanced_lrc",
      label: "Enhanced LRC (Word-level timestamps)",
      hasTimestamps: true,
    };
  }

  if (/\[\d{1,2}:[0-5]\d(?:\.\d{1,3})?\]/.test(str)) {
    return { format: "standard_lrc", label: "Standard LRC Timestamps", hasTimestamps: true };
  }

  if (/(?:^|\n)(?:\[|\()?\d{1,2}:[0-5]\d(?:\.\d{1,3})?(?:\]|\))?/.test(str)) {
    return { format: "flexible_lrc", label: "Custom Time-coded Lyrics", hasTimestamps: true };
  }

  return {
    format: "plain_text",
    label: "Plain Lyrics (Auto-generates timestamps via NLP)",
    hasTimestamps: false,
  };
}

/**
 * Automatically detects format and parses into Line[] with synchronized timestamps.
 */
export function detectAndParseLyrics(
  content: string | object,
  defaultDuration = 90,
): DetectedLyricInfo {
  try {
    const meta = detectLyricFormat(content);
    let lines: Line[] = [];

    switch (meta.format) {
      case "json":
        lines = parseJsonLyrics(content, defaultDuration);
        break;
      case "ttml":
        lines = parseTtml(String(content), defaultDuration);
        break;
      case "srt_vtt":
        lines = parseSrtOrVtt(String(content), defaultDuration);
        break;
      case "enhanced_lrc":
      case "standard_lrc":
      case "flexible_lrc":
        lines = parseLrcOrEnhanced(String(content), defaultDuration);
        break;
      case "plain_text":
        lines = parsePlainTextLyrics(String(content), defaultDuration);
        break;
      default:
        lines = [];
        break;
    }

    // Fallback 1: If any parser returned empty array on non-empty string, parse as plain text
    if (lines.length === 0 && typeof content === "string" && content.trim().length > 0) {
      lines = parsePlainTextLyrics(content, defaultDuration);
    }

    // Fallback 2: If still empty on non-empty text, create simple line per newline
    if (lines.length === 0 && typeof content === "string" && content.trim().length > 0) {
      const rawLines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const durPerLine = rawLines.length > 0 ? defaultDuration / rawLines.length : 3;
      lines = rawLines.map((txt, idx) => ({
        id: `raw-${idx}`,
        text: txt,
        start: +(idx * durPerLine).toFixed(2),
        end: +((idx + 1) * durPerLine).toFixed(2),
      }));
    }

    const normalized = normalizeLyricalLines(lines);
    const finalLines = normalized.length > 0 ? normalized : lines;

    return {
      format: meta.format,
      label: meta.label,
      hasTimestamps: meta.hasTimestamps,
      linesCount: finalLines.length,
      lines: finalLines,
    };
  } catch (err) {
    console.error("detectAndParseLyrics error, applying safe fallback:", err);
    const str = String(content || "").trim();
    const rawLines = str.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const durPerLine = rawLines.length > 0 ? defaultDuration / rawLines.length : 3;
    const safeLines = rawLines.map((txt, idx) => ({
      id: `safe-${idx}`,
      text: txt,
      start: +(idx * durPerLine).toFixed(2),
      end: +((idx + 1) * durPerLine).toFixed(2),
    }));
    return {
      format: "plain_text",
      label: "Plain Lyrics",
      hasTimestamps: false,
      linesCount: safeLines.length,
      lines: safeLines,
    };
  }
}

/**
 * Universal Lyrics Parser:
 * Intelligently detects format (JSON, TTML, Enhanced LRC, Standard LRC, SRT/VTT, Plain text) and parses into Line[].
 */
export function parseLyrics(content: string | object, defaultDuration = 90): Line[] {
  return detectAndParseLyrics(content, defaultDuration).lines;
}
