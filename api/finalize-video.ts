import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "POST") {
    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  const tmpFiles: string[] = [];

  try {
    const formData = await request.formData();
    const videoFile = formData.get("video") as Blob | null;
    const audioFile = formData.get("audio") as Blob | null;
    const startOffset = Math.max(0, parseFloat((formData.get("startOffset") as string) || "0"));
    const targetDuration = Math.max(0.5, parseFloat((formData.get("targetDuration") as string) || "15"));
    const fps = parseInt((formData.get("fps") as string) || "30", 10);
    const resolution = (formData.get("resolution") as string) || "1080";
    const videoBitrate = resolution === "2160" ? "24M" : resolution === "720" ? "8M" : "14M";

    if (!videoFile) {
      return Response.json({ success: false, error: "Missing video file" }, { status: 400 });
    }

    const id = randomUUID();
    const videoExt = videoFile.type.includes("webm") ? ".webm" : ".mp4";
    const videoPath = path.join(os.tmpdir(), `export_video_${id}${videoExt}`);
    tmpFiles.push(videoPath);

    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    await fs.writeFile(videoPath, videoBuffer);

    let audioPath: string | null = null;
    if (audioFile && audioFile.size > 0) {
      const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
      if (audioBuffer.length > 0) {
        audioPath = path.join(os.tmpdir(), `export_audio_${id}.tmp`);
        tmpFiles.push(audioPath);
        await fs.writeFile(audioPath, audioBuffer);
      }
    }

    const outputPath = path.join(os.tmpdir(), `export_final_${id}.mp4`);
    tmpFiles.push(outputPath);

    // Build FFmpeg command arguments for broadcast-quality MP4 finalization
    const args: string[] = ["-y"];

    // Input 0: Video stream from client
    args.push("-i", videoPath);

    // Input 1: Original audio track (trimmed with millisecond accuracy) or silent stereo fallback
    if (audioPath) {
      args.push("-ss", startOffset.toFixed(3), "-t", targetDuration.toFixed(3), "-i", audioPath);
    } else {
      args.push("-f", "lavfi", "-i", `anullsrc=r=48000:cl=stereo:d=${targetDuration.toFixed(3)}`);
    }

    // Map video and audio explicitly
    args.push(
      "-map", "0:v:0",
      "-map", "1:a:0",
      "-t", targetDuration.toFixed(3),
      // Video transcoding / remuxing to strict H.264 High Profile Level 4.2 YUV420p CFR
      "-c:v", "libx264",
      "-preset", "fast",
      "-profile:v", "high",
      "-level", "4.2",
      "-pix_fmt", "yuv420p",
      "-r", String(fps),
      "-b:v", videoBitrate,
      "-maxrate", videoBitrate,
      "-bufsize", "30M",
      // Pristine AAC audio at 320 kbps, 48 kHz, true stereo
      "-c:a", "aac",
      "-b:a", "320k",
      "-ar", "48000",
      "-ac", "2",
      "-shortest",
      // Faststart: moves moov atom to the front for instant streaming and correct duration
      "-movflags", "+faststart",
      outputPath,
    );

    // Execute FFmpeg
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("ffmpeg", args);
      let stderr = "";
      proc.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-600)}`));
      });
      proc.on("error", reject);
    });

    const outputBuffer = await fs.readFile(outputPath);

    return new Response(outputBuffer, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="lyriq_music_video.mp4"',
        "Content-Length": String(outputBuffer.length),
        "X-Export-Engine": "FFmpeg-Native-AAC-320k",
      },
    });
  } catch (err: any) {
    console.error("Video export finalize error:", err);
    return Response.json(
      { success: false, error: err.message || "Failed to finalize video with FFmpeg" },
      { status: 500 },
    );
  } finally {
    for (const f of tmpFiles) {
      await fs.unlink(f).catch(() => {});
    }
  }
}

