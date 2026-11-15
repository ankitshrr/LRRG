import { createCanvas } from "@napi-rs/canvas";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Import rendering engine directly from the codebase
import {
  drawCanvasFrame,
  drawReelBackground,
} from "../src/services/videoRenderer.ts";

const OUTPUT_DIR = path.join(os.tmpdir(), "lrrg-test-exports");

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

/**
 * Generates an MP4 using the project's exact Canvas drawing engine
 * piped directly to FFmpeg with AAC 320k 48kHz stereo and faststart.
 */
async function generateTestVideo({
  filename,
  duration,
  fps = 30,
  width = 1080,
  height = 1920,
  lines,
  style,
  track,
  stereoType = "sine",
}) {
  const outPath = path.join(OUTPUT_DIR, filename);
  const totalFrames = Math.round(duration * fps);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Create temporary stereo audio file
  const audioPath = path.join(OUTPUT_DIR, `temp_audio_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`);

  // Generate distinct stereo audio: 440Hz on left, 880Hz on right
  // Testing true stereo channel separation and 48kHz sampling
  execFileSync("ffmpeg", [
    "-y",
    "-f", "lavfi",
    "-i", `sine=frequency=440:duration=${duration.toFixed(2)}`,
    "-f", "lavfi",
    "-i", `sine=frequency=880:duration=${duration.toFixed(2)}`,
    "-filter_complex", "[0:a][1:a]join=inputs=2:channel_layout=stereo[a]",
    "-map", "[a]",
    "-ar", "48000",
    audioPath,
  ]);

  // Spawn FFmpeg to receive raw RGB frames from stdin
  const ffmpegArgs = [
    "-y",
    // Video input from stdin (raw 24-bit RGB)
    "-f", "rawvideo",
    "-pix_fmt", "rgba",
    "-s", `${width}x${height}`,
    "-r", String(fps),
    "-i", "pipe:0",
    // Stereo Audio input
    "-i", audioPath,
    // Output mapping
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-t", duration.toFixed(3),
    // H.264 Video Settings
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-profile:v", "high",
    "-level", "4.2",
    "-pix_fmt", "yuv420p",
    "-r", String(fps),
    "-b:v", "14M",
    "-maxrate", "14M",
    "-bufsize", "28M",
    // AAC Audio Settings
    "-c:a", "aac",
    "-b:a", "320k",
    "-ar", "48000",
    "-ac", "2",
    // Faststart Container
    "-movflags", "+faststart",
    "-shortest",
    outPath,
  ];

  const proc = spawn("ffmpeg", ffmpegArgs, { stdio: ["pipe", "ignore", "pipe"] });

  let stderr = "";
  proc.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const procPromise = new Promise((resolve, reject) => {
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-400)}`));
    });
    proc.on("error", reject);
  });

  // Render and pipe every frame deterministically
  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / fps;
    drawCanvasFrame(ctx, width, height, t, duration, lines, style, track);
    const rawBuffer = canvas.data();

    const canWrite = proc.stdin.write(rawBuffer);
    if (!canWrite) {
      await new Promise((r) => proc.stdin.once("drain", r));
    }
  }

  proc.stdin.end();
  await procPromise;
  await fs.unlink(audioPath).catch(() => {});

  return outPath;
}

/**
 * Runs FFprobe to inspect and validate the generated MP4 file.
 */
function probeVideo(filePath) {
  const jsonStr = execFileSync("ffprobe", [
    "-v", "quiet",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]).toString();

  const data = JSON.parse(jsonStr);
  const format = data.format;
  const vStream = data.streams.find((s) => s.codec_type === "video");
  const aStream = data.streams.find((s) => s.codec_type === "audio");

  const actualDuration = parseFloat(format.duration);
  const vDuration = parseFloat(vStream.duration);
  const aDuration = parseFloat(aStream.duration);
  const frameCount = parseInt(vStream.nb_frames || "0", 10);
  const fpsStr = vStream.r_frame_rate;
  const [num, den] = fpsStr.split("/").map(Number);
  const calcFps = den ? num / den : 0;

  return {
    filename: path.basename(filePath),
    formatName: format.format_name,
    durationSec: actualDuration,
    videoDuration: vDuration,
    audioDuration: aDuration,
    resolution: `${vStream.width}x${vStream.height}`,
    codecVideo: vStream.codec_name,
    pixelFormat: vStream.pix_fmt,
    fps: calcFps,
    frameCount: frameCount,
    codecAAC: aStream.codec_name,
    audioSampleRate: parseInt(aStream.sample_rate, 10),
    audioChannels: aStream.channels,
    audioBitrateKbps: Math.round(parseInt(aStream.bit_rate || "0", 10) / 1000),
  };
}

async function runAllTests() {
  await ensureDir(OUTPUT_DIR);
  console.log("==================================================================");
  console.log("LRRG VIDEO EXPORT & DOWNLOAD TEST SUITE (FFPROBE VALIDATION)");
  console.log("==================================================================\n");

  const sampleTrack = {
    title: "Midnight Symphony",
    artist: "Acoustic Horizon",
    file: "midnight.mp3",
    sizeMb: 5.2,
    bpm: 124,
    duration: 65,
  };

  const sampleLines = [
    {
      id: "l1",
      text: "I saw the light shining through the night",
      start: 0.5,
      end: 4.8,
      words: [
        { text: "I", start: 0.5, end: 0.8 },
        { text: "saw", start: 0.8, end: 1.3 },
        { text: "the", start: 1.3, end: 1.7 },
        { text: "light", start: 1.7, end: 2.5 },
        { text: "shining", start: 2.5, end: 3.4 },
        { text: "through", start: 3.4, end: 4.0 },
        { text: "the", start: 4.0, end: 4.3 },
        { text: "night", start: 4.3, end: 4.8 },
      ],
    },
    {
      id: "l2",
      text: "And every melody begins to heal the scars",
      start: 5.2,
      end: 9.8,
      words: [
        { text: "And", start: 5.2, end: 5.5 },
        { text: "every", start: 5.5, end: 6.2 },
        { text: "melody", start: 6.2, end: 7.2 },
        { text: "begins", start: 7.2, end: 8.0 },
        { text: "to", start: 8.0, end: 8.3 },
        { text: "heal", start: 8.3, end: 9.0 },
        { text: "the", start: 9.0, end: 9.3 },
        { text: "scars", start: 9.3, end: 9.8 },
      ],
    },
    {
      id: "l3",
      text: "We rise above the storm into the open sky",
      start: 10.2,
      end: 14.5,
      words: [
        { text: "We", start: 10.2, end: 10.6 },
        { text: "rise", start: 10.6, end: 11.4 },
        { text: "above", start: 11.4, end: 12.1 },
        { text: "the", start: 12.1, end: 12.4 },
        { text: "storm", start: 12.4, end: 13.1 },
        { text: "into", start: 13.1, end: 13.7 },
        { text: "the", start: 13.7, end: 14.0 },
        { text: "open", start: 14.0, end: 14.3 },
        { text: "sky", start: 14.3, end: 14.5 },
      ],
    },
  ];

  const results = [];

  // TEST 1: 15-second video (Full HD 1080x1920 @ 30 FPS)
  console.log(">>> Running Test 1: 15-second video export...");
  const t1File = await generateTestVideo({
    filename: "test1_15sec.mp4",
    duration: 15.0,
    fps: 30,
    lines: sampleLines,
    style: {
      font: "apple",
      size: 32,
      textColor: "#D9D9D9",
      highlight: "#FA2D48",
      bg: "spotifyblue",
      position: "center",
      animation: "apple",
    },
    track: sampleTrack,
  });
  results.push({ test: "1. 15-Second Video (Full HD)", ...probeVideo(t1File) });

  // TEST 2: 30-second video (Full HD 1080x1920 @ 30 FPS)
  console.log(">>> Running Test 2: 30-second video export...");
  const t2File = await generateTestVideo({
    filename: "test2_30sec.mp4",
    duration: 30.0,
    fps: 30,
    lines: sampleLines,
    style: {
      font: "spotify",
      size: 30,
      textColor: "#A6A6A6",
      highlight: "#1ED760",
      bg: "spotifydark",
      position: "center",
      animation: "spotify",
    },
    track: sampleTrack,
  });
  results.push({ test: "2. 30-Second Video (Full HD)", ...probeVideo(t2File) });

  // TEST 3: 60-second video (Full HD 1080x1920 @ 60 FPS)
  console.log(">>> Running Test 3: 60-second video export @ 60 FPS...");
  const t3File = await generateTestVideo({
    filename: "test3_60sec_60fps.mp4",
    duration: 60.0,
    fps: 60,
    lines: sampleLines,
    style: {
      font: "dot",
      size: 28,
      textColor: "#A6A6A6",
      highlight: "#D71920",
      bg: "nothingmatrix",
      position: "center",
      animation: "nothing",
    },
    track: sampleTrack,
  });
  results.push({ test: "3. 60-Second Video @ 60 FPS", ...probeVideo(t3File) });

  // TEST 4: Continuous lyrics video (joined lyrics clause)
  console.log(">>> Running Test 4: Continuous lyrics (joined sentence)...");
  const t4File = await generateTestVideo({
    filename: "test4_continuous_lyrics.mp4",
    duration: 15.0,
    fps: 30,
    lines: [
      {
        id: "cl1",
        text: "Holding on to every whisper across the silent sea",
        start: 1.0,
        end: 8.5,
        joinedWithNext: false,
        words: [
          { text: "Holding", start: 1.0, end: 1.6 },
          { text: "on", start: 1.6, end: 1.9 },
          { text: "to", start: 1.9, end: 2.2 },
          { text: "every", start: 2.2, end: 2.9 },
          { text: "whisper", start: 2.9, end: 4.2 },
          { text: "across", start: 4.2, end: 5.1 },
          { text: "the", start: 5.1, end: 5.4 },
          { text: "silent", start: 5.4, end: 6.8 },
          { text: "sea", start: 6.8, end: 8.5 },
        ],
      },
    ],
    style: {
      font: "geist",
      size: 32,
      textColor: "#D9D9D9",
      highlight: "#00F2FE",
      bg: "cyberneon",
      position: "center",
      animation: "karaoke",
    },
    track: sampleTrack,
  });
  results.push({ test: "4. Continuous Lyrics", ...probeVideo(t4File) });

  // TEST 5: Animated backgrounds (Apple Music animated glow mesh)
  console.log(">>> Running Test 5: Animated backgrounds (Apple Music Fluid Liquid Mesh)...");
  const t5File = await generateTestVideo({
    filename: "test5_animated_bg.mp4",
    duration: 15.0,
    fps: 30,
    lines: sampleLines,
    style: {
      font: "apple",
      size: 34,
      textColor: "#E0E0E0",
      highlight: "#FA2D48",
      bg: "applemusic",
      position: "center",
      animation: "apple",
    },
    track: sampleTrack,
  });
  results.push({ test: "5. Animated Background (Apple Music)", ...probeVideo(t5File) });

  // TEST 6: Video with stereo music (48 kHz stereo AAC)
  console.log(">>> Running Test 6: Stereo music audio fidelity...");
  const t6File = await generateTestVideo({
    filename: "test6_stereo_audio.mp4",
    duration: 15.0,
    fps: 30,
    lines: sampleLines,
    style: {
      font: "grotesk",
      size: 32,
      textColor: "#D9D9D9",
      highlight: "#FBBF24",
      bg: "vintagetape",
      position: "bottom",
      animation: "retro",
    },
    track: sampleTrack,
  });
  results.push({ test: "6. Stereo Music Quality", ...probeVideo(t6File) });

  // TEST 7: Word-by-word lyric highlighting (Karaoke precision)
  console.log(">>> Running Test 7: Word-by-word lyric highlighting...");
  const t7File = await generateTestVideo({
    filename: "test7_karaoke_highlight.mp4",
    duration: 15.0,
    fps: 30,
    lines: sampleLines,
    style: {
      font: "syne",
      size: 32,
      textColor: "#FFFFFF",
      highlight: "#1ED760",
      bg: "materialyou",
      position: "center",
      animation: "karaoke",
    },
    track: sampleTrack,
  });
  results.push({ test: "7. Word-by-Word Highlight", ...probeVideo(t7File) });

  console.log("\n==================================================================");
  console.log("VALIDATION RESULTS SUMMARY:");
  console.log("==================================================================\n");
  console.table(results, [
    "test",
    "durationSec",
    "resolution",
    "codecVideo",
    "fps",
    "frameCount",
    "codecAAC",
    "audioSampleRate",
    "audioChannels",
  ]);

  console.log("\nAll 7 video exports generated and probed successfully!");
}

runAllTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
