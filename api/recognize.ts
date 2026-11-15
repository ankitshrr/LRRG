// Vercel Serverless Function (Edge Runtime)
// Safe backend handler for Groq Whisper AI transcription, AudD recognition, and synced lyrics

import { isLyricalSentenceBreak, normalizeLyricalLines, type Line, type Word } from "../src/data";

export const config = {
  runtime: "edge",
};

export default async function handler(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (request.method !== "POST") {
    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob | null;
    const customGroqKey = (formData.get("groqApiKey") as string | null) || "";
    const customAudDToken = (formData.get("customToken") as string | null) || "";
    const duration = parseFloat((formData.get("duration") as string) || "90");

    const groqKey = customGroqKey || process.env.GROQ_API_KEY || "";
    const auddToken = customAudDToken || process.env.AUDD_API_TOKEN || "";

    if (!file) {
      return Response.json({ success: false, error: "No audio file provided" }, { status: 400 });
    }

    // PRIORITY 1: Groq Whisper-large-v3 AI Audio-to-Word Transcription (100% Word Sync)
    if (groqKey) {
      try {
        const origName = (file as any).name || "audio.mp3";
        const groqBody = new FormData();
        groqBody.append("file", file, origName);
        groqBody.append("model", "whisper-large-v3");
        groqBody.append("response_format", "verbose_json");
        groqBody.append("timestamp_granularities[]", "word");
        groqBody.append("timestamp_granularities[]", "segment");

        const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey.trim()}`,
          },
          body: groqBody,
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          const lines = parseGroqWhisperToLines(groqData, duration);
          if (lines && lines.length > 0) {
            const base = origName.replace(/\.[^/.]+$/, "");
            let extractedArtist = "";
            let extractedTitle = base.replace(/[-_]+/g, " ").trim();
            if (base.includes(" - ")) {
              const parts = base.split(" - ");
              extractedArtist = parts[0].trim();
              extractedTitle = parts.slice(1).join(" - ").trim();
            }
            return Response.json({
              success: true,
              source: "groq_whisper",
              title: extractedTitle || "Transcribed Song",
              artist: extractedArtist || "",
              lines,
            });
          }
        } else {
          const groqErr = await groqRes.text();
          console.warn("Groq Whisper error response:", groqRes.status, groqErr);
          let errMsg = groqErr;
          try {
            const parsed = JSON.parse(groqErr);
            errMsg = parsed.error?.message || groqErr;
          } catch {}
          return Response.json(
            {
              success: false,
              source: "groq_whisper",
              error: `Groq Whisper API (${groqRes.status}): ${errMsg}`,
            },
            { status: 400 },
          );
        }
      } catch (err: any) {
        console.warn("Groq Whisper transcription failed, falling back:", err);
        return Response.json(
          {
            success: false,
            error: `Groq Whisper network error: ${err.message}`,
          },
          { status: 500 },
        );
      }
    }

    // PRIORITY 2: AudD Recognition & LRCLIB Synced Lyrics
    if (auddToken) {
      const auddBody = new FormData();
      auddBody.append("api_token", auddToken);
      auddBody.append("file", file);
      auddBody.append("return", "lyrics,apple_music,spotify");

      const auddResponse = await fetch("https://api.audd.io/", {
        method: "POST",
        body: auddBody,
      });

      const auddResult = await auddResponse.json();

      if (auddResult.status === "success" && auddResult.result) {
        const title = auddResult.result.title || "Unknown Title";
        const artist = auddResult.result.artist || "Unknown Artist";
        const rawLyrics = auddResult.result.lyrics?.lyrics || "";

        let syncedLines: any[] = [];
        try {
          const lrcQuery = `track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
          const lrcRes = await fetch(`https://lrclib.net/api/get?${lrcQuery}`, {
            headers: {
              "User-Agent": "LyricsReelMaker/1.0 (https://github.com/audd-integration)",
            },
          });

          if (lrcRes.ok) {
            const lrcData = await lrcRes.json();
            if (lrcData.syncedLyrics) {
              syncedLines = parseLrc(lrcData.syncedLyrics, duration);
            }
          }
        } catch (lrcErr) {
          console.warn("LRCLIB synced lyrics fetch failed:", lrcErr);
        }

        if (syncedLines.length === 0 && rawLyrics) {
          syncedLines = parsePlainLyricsToLines(rawLyrics, duration);
        }

        const normalizedLines = normalizeLyricalLines(syncedLines);

        return Response.json({
          success: true,
          source: "audd",
          title,
          artist,
          lines: normalizedLines,
          rawLyrics,
        });
      }
    }

    return Response.json(
      {
        success: false,
        error:
          "Please configure GROQ_API_KEY (for Whisper AI word sync) or AUDD_API_TOKEN in Settings / Vercel.",
      },
      { status: 400 },
    );
  } catch (err: any) {
    console.error("Recognition handler error:", err);
    return Response.json(
      {
        success: false,
        error: err.message || "Internal server error",
      },
      { status: 500 },
    );
  }
}

/** Groups raw Whisper words into clean, Apple Music-style lyrical lines */
function groupWordsIntoLyricalLines(allWords: any[]) {
  if (allWords.length === 0) return [];

  const lines: any[] = [];
  let currentWords: any[] = [];
  let lineIdx = 0;

  for (let i = 0; i < allWords.length; i++) {
    const w = allWords[i];
    currentWords.push(w);

    const nextW = allWords[i + 1];
    const wordsCount = currentWords.length;
    const currentChars = currentWords.reduce((sum: number, cw: any) => sum + cw.text.length, 0) + wordsCount - 1;
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
      const lineText = currentWords.map((cw: any) => cw.text).join(" ").trim();
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
    if (lines.length > 0 && currentWords.length <= 2) {
      const last = lines[lines.length - 1];
      last.words = [...(last.words || []), ...currentWords];
      last.text = `${last.text} ${currentWords.map((cw: any) => cw.text).join(" ")}`.trim();
      last.end = currentWords[currentWords.length - 1].end;
    } else {
      lines.push({
        id: `l${lineIdx++}`,
        text: currentWords.map((cw: any) => cw.text).join(" ").trim(),
        start: currentWords[0].start,
        end: currentWords[currentWords.length - 1].end,
        words: [...currentWords],
      });
    }
  }

  return normalizeLyricalLines(lines);
}

/** Parses Groq Whisper verbose_json segments and word timestamps */
function parseGroqWhisperToLines(groqData: any, defaultDuration = 90) {
  const allWords = (groqData.words || [])
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
    return segments
      .map((seg: any, idx: number) => {
        const segStart = +(seg.start || 0).toFixed(2);
        const segEnd = +(seg.end || segStart + 3).toFixed(2);
        const segText = (seg.text || "").trim();

        const wordsRaw = segText.split(/\s+/).filter(Boolean);
        const dur = Math.max(0.6, segEnd - segStart);
        const wDur = dur / Math.max(1, wordsRaw.length);
        const segWords = wordsRaw.map((txt: string, wIdx: number) => ({
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
      })
      .filter((l: any) => l.text.length > 0);
  }

  return [];
}

/** Parses LRC timestamped lyrics into lines with word-level segments */
function parseLrc(lrcText: string, defaultDuration = 90) {
  const rawTextLines = lrcText.split(/\r?\n/);
  const parsed: { time: number; text: string }[] = [];

  for (const raw of rawTextLines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\](.*)$/);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseFloat(match[2]);
      const start = +(min * 60 + sec).toFixed(2);
      const text = match[3].trim();
      if (text) {
        parsed.push({ time: start, text });
      }
    }
  }

  parsed.sort((a, b) => a.time - b.time);
  if (parsed.length === 0) return [];

  const rawLines: Line[] = parsed.map((item, idx) => {
    const nextItem = parsed[idx + 1];
    const lineEnd = nextItem
      ? Math.max(item.time + 0.8, nextItem.time - 0.2)
      : Math.max(item.time + 3.5, defaultDuration);
    const wordsRaw = item.text.split(/\s+/).filter(Boolean);
    const wordDur = wordsRaw.length > 0 ? (lineEnd - item.time) / wordsRaw.length : 0;

    const words: Word[] = wordsRaw.map((w, wIdx) => ({
      text: w,
      start: +(item.time + wIdx * wordDur).toFixed(2),
      end: +(item.time + (wIdx + 1) * wordDur).toFixed(2),
    }));

    return {
      id: `l${idx}`,
      text: item.text,
      start: item.time,
      end: +lineEnd.toFixed(2),
      words,
    };
  });

  return normalizeLyricalLines(rawLines);
}

/** Distributes plain lyrics evenly across duration when no timestamps exist */
function parsePlainLyricsToLines(plainLyrics: string, duration: number) {
  const linesRaw = plainLyrics
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("[") && !l.startsWith("("));

  if (linesRaw.length === 0) return [];

  const step = Math.max(2.5, duration / (linesRaw.length + 1));
  const rawLines: Line[] = linesRaw.map((text, idx) => {
    const start = +(idx * step).toFixed(2);
    const end = +((idx + 1) * step - 0.3).toFixed(2);
    const wordsRaw = text.split(/\s+/).filter(Boolean);
    const wordDur = wordsRaw.length > 0 ? (end - start) / wordsRaw.length : 0;
    const words: Word[] = wordsRaw.map((w, wIdx) => ({
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
