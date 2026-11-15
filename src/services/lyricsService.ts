import {
  isLyricalSentenceBreak,
  normalizeLyricalLines,
  parseLrcToLines,
  type Line,
  type Word,
} from "../data";

export type RecognizeResult = {
  success: boolean;
  title?: string;
  artist?: string;
  album?: string;
  lines?: Line[];
  rawLyrics?: string;
  source?: "groq_whisper" | "audd" | "lrclib" | "filename" | "fallback";
  error?: string;
};

export function getStoredGroqToken(): string {
  try {
    return localStorage.getItem("groq_api_key") || "";
  } catch {
    return "";
  }
}

export function setStoredGroqToken(token: string) {
  try {
    if (token) {
      localStorage.setItem("groq_api_key", token.trim());
    } else {
      localStorage.removeItem("groq_api_key");
    }
  } catch {
    // Ignore storage errors
  }
}

export function getStoredAudDToken(): string {
  try {
    return localStorage.getItem("audd_api_token") || "";
  } catch {
    return "";
  }
}

export function setStoredAudDToken(token: string) {
  try {
    if (token) {
      localStorage.setItem("audd_api_token", token.trim());
    } else {
      localStorage.removeItem("audd_api_token");
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Cleans audio file names to extract artist and title for search.
 * e.g. "01 - The Weeknd - Blinding Lights (Official Video).mp3" -> "The Weeknd Blinding Lights"
 */
export function extractSongInfoFromFilename(filename: string): {
  artist?: string;
  title: string;
  query: string;
} {
  let raw = filename.replace(/\.[^/.]+$/, "");

  raw = raw.replace(/^\s*\d+[\s.-]+/, "");
  raw = raw.replace(
    /\((?:official\s*(?:video|audio|music\s*video)|lyrics?|audio|visualizer|hq|hd|4k|remastered)[^)]*\)/gi,
    "",
  );
  raw = raw.replace(
    /\[(?:official\s*(?:video|audio|music\s*video)|lyrics?|audio|visualizer|hq|hd|4k|remastered)[^\]]*\]/gi,
    "",
  );

  const parts = raw.split(/\s+-\s+/);
  if (parts.length >= 2) {
    const artist = parts[0].trim();
    const title = parts.slice(1).join(" - ").trim();
    return {
      artist,
      title,
      query: `${artist} ${title}`.trim(),
    };
  }

  const cleanTitle = raw.replace(/[-_]+/g, " ").trim();
  return {
    title: cleanTitle,
    query: cleanTitle,
  };
}

/**
 * Calls Groq Whisper-large-v3 AI API directly from browser for 100% word-level acoustic sync.
 */
export async function callGroqDirect(
  file: File,
  token: string,
  duration = 90,
): Promise<RecognizeResult | null> {
  try {
    const groqBody = new FormData();
    groqBody.append("file", file, file.name);
    groqBody.append("model", "whisper-large-v3");
    groqBody.append("response_format", "verbose_json");
    groqBody.append("timestamp_granularities[]", "word");
    groqBody.append("timestamp_granularities[]", "segment");

    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: groqBody,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("Groq direct call failed:", errText);
      let errMsg = errText;
      try {
        const parsed = JSON.parse(errText);
        errMsg = parsed.error?.message || errText;
      } catch {}
      return {
        success: false,
        source: "groq_whisper",
        error: `Groq Whisper API (${res.status}): ${errMsg}`,
      };
    }

    const data = await res.json();
    const lines = parseGroqDataToLines(data, duration);

    if (lines && lines.length > 0) {
      const { title, artist } = extractSongInfoFromFilename(file.name);
      return {
        success: true,
        source: "groq_whisper",
        title,
        artist: artist || "",
        lines,
      };
    }
    return null;
  } catch (err: any) {
    console.warn("Groq direct error:", err);
    return {
      success: false,
      source: "groq_whisper",
      error: `Groq Whisper network error: ${err.message}`,
    };
  }
}

function groupWordsIntoLyricalLines(allWords: Word[]): Line[] {
  if (allWords.length === 0) return [];

  const lines: Line[] = [];
  let currentWords: Word[] = [];
  let lineIdx = 0;

  for (let i = 0; i < allWords.length; i++) {
    const w = allWords[i];
    currentWords.push(w);

    const nextW = allWords[i + 1];
    const wordsCount = currentWords.length;
    const currentChars = currentWords.reduce((sum, cw) => sum + cw.text.length, 0) + wordsCount - 1;
    const lineDuration = w.end - currentWords[0].start;

    let shouldBreak = false;

    if (!nextW) {
      shouldBreak = true;
    } else {
      const acousticGap = nextW.start - w.end;
      const endsWithSentencePunct = /[.!?]$/.test(w.text);
      const isLyricalBreak = isLyricalSentenceBreak(
        nextW,
        w,
        allWords[i + 2],
        currentWords,
        allWords[i + 3],
      );

      // Acoustic pause / breath between vocal phrases
      if (acousticGap >= 0.22 && wordsCount >= 3) {
        shouldBreak = true;
      }
      // Sentence punctuation
      else if (endsWithSentencePunct && wordsCount >= 2) {
        shouldBreak = true;
      }
      // Intelligent NLP sentence boundary detection & prosody analysis
      else if (isLyricalBreak && wordsCount >= 2) {
        shouldBreak = true;
      }
    }

    if (shouldBreak && currentWords.length > 0) {
      const lineText = currentWords.map((cw) => cw.text).join(" ").trim();
      if (lineText.length > 0) {
        lines.push({
          id: `l${lineIdx++}`,
          text: lineText,
          start: currentWords[0].start,
          end: currentWords[currentWords.length - 1].end,
          words: [...currentWords],
        });
      }
      currentWords = [];
    }
  }

  if (currentWords.length > 0) {
    const last = lines[lines.length - 1];
    // Only merge leftovers if the previous line was very short (<= 3 words) and does not end in punctuation
    if (
      lines.length > 0 &&
      currentWords.length <= 2 &&
      last.words &&
      last.words.length <= 3 &&
      !/[.!?]$/.test(last.text)
    ) {
      last.words = [...(last.words || []), ...currentWords];
      last.text = `${last.text} ${currentWords.map((cw) => cw.text).join(" ")}`.trim();
      last.end = currentWords[currentWords.length - 1].end;
    } else {
      lines.push({
        id: `l${lineIdx++}`,
        text: currentWords.map((cw) => cw.text).join(" ").trim(),
        start: currentWords[0].start,
        end: currentWords[currentWords.length - 1].end,
        words: [...currentWords],
      });
    }
  }

  return normalizeLyricalLines(lines);
}

function parseGroqDataToLines(groqData: any, defaultDuration = 90): Line[] | null {
  const allWords: Word[] = (groqData.words || [])
    .map((w: any) => ({
      text: (w.word || "").trim(),
      start: +(w.start || 0).toFixed(2),
      end: +(w.end || 0).toFixed(2),
    }))
    .filter((w: any) => w.text.length > 0);

  // When word timestamps are present, group into clean Apple Music vocal phrasing
  if (allWords.length > 0) {
    const lines = groupWordsIntoLyricalLines(allWords);
    if (lines.length > 0) return lines;
  }

  const segments = groqData.segments || [];
  if (segments.length > 0) {
    return segments.map((seg: any, idx: number) => {
      const segStart = +(seg.start || 0).toFixed(2);
      const segEnd = +(seg.end || segStart + 3).toFixed(2);
      const segText = (seg.text || "").trim();

      const wordsRaw = segText.split(/\s+/).filter(Boolean);
      const dur = Math.max(0.6, segEnd - segStart);
      const wDur = dur / Math.max(1, wordsRaw.length);
      const segWords: Word[] = wordsRaw.map((txt: string, wIdx: number) => ({
        text: txt,
        start: +(segStart + wIdx * wDur).toFixed(2),
        end: +(segStart + (wIdx + 1) * wDur).toFixed(2),
      }));

      return {
        id: `l${idx}`,
        text: segText,
        start: segStart,
        end: segEnd,
        words: segWords,
      };
    });
  }

  return null;
}

/**
 * Searches LRCLIB directly for synchronized lyrics & word timings
 */
export async function searchLrclib(
  title: string,
  artist?: string,
  duration?: number,
): Promise<RecognizeResult | null> {
  try {
    if (artist && title) {
      try {
        const getUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}${duration ? `&duration=${Math.round(duration)}` : ""}`;
        const res = await fetch(getUrl);
        if (res.ok) {
          const data = await res.json();
          const lines = parseLrclibData(data, duration);
          if (lines && lines.length > 0) {
            return {
              success: true,
              title: data.trackName || title,
              artist: data.artistName || artist,
              album: data.albumName,
              lines,
              source: "lrclib",
            };
          }
        }
      } catch (e) {
        console.warn("LRCLIB exact get failed, trying search:", e);
      }
    }

    const query = artist ? `${artist} ${title}` : title;
    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return null;

    const items = await searchRes.json();
    if (!Array.isArray(items) || items.length === 0) return null;

    const bestItem = items.find((x) => x.lyricsfile || x.syncedLyrics) || items[0];
    const lines = parseLrclibData(bestItem, duration);

    if (lines && lines.length > 0) {
      return {
        success: true,
        title: bestItem.trackName || title,
        artist: bestItem.artistName || artist || "Artist",
        album: bestItem.albumName,
        lines,
        source: "lrclib",
      };
    }

    return null;
  } catch (err) {
    console.warn("LRCLIB search error:", err);
    return null;
  }
}

function parseLrclibData(data: any, duration = 90): Line[] | null {
  if (!data) return null;

  if (data.syncedLyrics) {
    const synced = parseLrcToLines(data.syncedLyrics, duration);
    if (synced && synced.length > 0) {
      return synced;
    }
  }

  if (data.plainLyrics) {
    const raw = data.plainLyrics
      .split(/\r?\n/)
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0 && !l.startsWith("[") && !l.startsWith("("));

    if (raw.length > 0) {
      const step = Math.max(2.5, duration / (raw.length + 1));
      const rawLines: Line[] = raw.map((text: string, idx: number) => {
        const start = +(idx * step).toFixed(2);
        const end = +((idx + 1) * step - 0.25).toFixed(2);
        const wordsRaw = text.split(/\s+/).filter(Boolean);
        const wordDur = wordsRaw.length > 0 ? (end - start) / wordsRaw.length : 0;
        const words = wordsRaw.map((w: string, wIdx: number) => ({
          text: w,
          start: +(start + wIdx * wordDur).toFixed(2),
          end: +(start + (wIdx + 1) * wordDur).toFixed(2),
        }));
        return {
          id: `l${idx}`,
          text,
          start,
          end,
          words,
        };
      });
      return normalizeLyricalLines(rawLines);
    }
  }

  return null;
}

/**
 * Master multi-layer song recognition & synchronized lyric fetcher.
 */
export async function identifyAndFetchLyrics(
  audioFile: File,
  duration = 90,
): Promise<RecognizeResult> {
  const groqToken = getStoredGroqToken();
  const auddToken = getStoredAudDToken();
  const {
    artist: fileArtist,
    title: fileTitle,
    query: fileQuery,
  } = extractSongInfoFromFilename(audioFile.name);

  // PRIORITY 1: Server backend (/api/recognize)
  // Handles Groq Whisper-large-v3 and AudD server-side (no browser CORS limits).
  // Works both in local dev (via Vite middleware) and production (via Vercel Serverless Function).
  try {
    const formData = new FormData();
    formData.append("file", audioFile, audioFile.name);
    formData.append("duration", String(duration));
    if (groqToken) formData.append("groqApiKey", groqToken);
    if (auddToken) formData.append("customToken", auddToken);

    const res = await fetch("/api/recognize", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (data.success && data.lines && data.lines.length > 0) {
      return {
        ...data,
        lines: normalizeLyricalLines(data.lines),
        title: data.title || fileTitle,
        artist: data.artist || fileArtist || "Identified Artist",
      };
    }

    // If Groq Whisper was explicitly used and returned an error, try direct browser Groq call as fallback
    if (!data.success && groqToken) {
      if (data.error && (data.error.includes("network error") || data.error.includes("fetch failed"))) {
        console.info("Server Groq call had a network error; attempting direct browser Groq call...");
        const directResult = await callGroqDirect(audioFile, groqToken, duration);
        if (directResult && directResult.success) {
          return directResult;
        }
      }

      if (!data.error?.includes("network error") && !data.error?.includes("fetch failed")) {
        return {
          success: false,
          source: "groq_whisper",
          error: data.error,
          title: fileTitle,
          artist: fileArtist || "My Audio",
        };
      }
    }
  } catch (err: any) {
    console.warn("/api/recognize request failed:", err);
    if (groqToken) {
      console.info("Server unreachable; attempting direct browser Groq call...");
      const directResult = await callGroqDirect(audioFile, groqToken, duration);
      if (directResult && directResult.success) {
        return directResult;
      }
    }
  }

  // PRIORITY 2: Query LRCLIB with detected title/artist or cleaned filename
  const lrclibResult = await searchLrclib(fileTitle, fileArtist, duration);
  if (lrclibResult && lrclibResult.lines && lrclibResult.lines.length > 0) {
    return lrclibResult;
  }

  // PRIORITY 3: Full query fallback search
  if (fileQuery && fileQuery !== fileTitle) {
    const fallbackSearch = await searchLrclib(fileQuery, undefined, duration);
    if (fallbackSearch && fallbackSearch.lines && fallbackSearch.lines.length > 0) {
      return fallbackSearch;
    }
  }

  return {
    success: false,
    title: fileTitle,
    artist: fileArtist || "My Audio",
    error: groqToken
      ? "Groq Whisper could not transcribe this audio file. Please check your Groq API Key or audio quality."
      : 'Could not auto-fetch lyrics for this song. Click "API Keys" to add a Groq Whisper key for 100% word sync.',
  };
}
