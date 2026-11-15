import {
  BACKGROUNDS,
  FONTS,
  TRACK,
  activeIndex,
  fmt,
  getLineWordsWithTimings,
  normalizeLyricalLines,
  splitWordsIntoSentenceGroups,
  splitTextIntoSentenceGroups,
  type Line,
  type ReelStyle,
  type TrackInfo,
} from "../data.ts";

export const bgImageCache = new Map<string, any>();
export const bgVideoCache = new Map<string, any>();

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function preloadBgImage(url: string, ImageConstructor?: any): Promise<any> {
  if (!url) return Promise.resolve(null);
  if (bgImageCache.has(url)) return Promise.resolve(bgImageCache.get(url));

  const Ctor = ImageConstructor || (typeof window !== "undefined" ? (window as any).Image : null);
  if (!Ctor) return Promise.resolve(null);

  return new Promise((resolve) => {
    const img = new Ctor();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      bgImageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = url;
    if (img.complete && img.naturalWidth > 0) {
      bgImageCache.set(url, img);
      resolve(img);
    }
  });
}

export function getOrLoadBgVideo(url: string): HTMLVideoElement | null {
  if (!url || typeof window === "undefined") return null;
  let vid = bgVideoCache.get(url);
  if (!vid) {
    vid = document.createElement("video");
    vid.src = url;
    vid.muted = true;
    vid.loop = true;
    vid.playsInline = true;
    vid.currentTime = 0;
    vid.play().catch(() => {});
    bgVideoCache.set(url, vid);
  }
  return vid;
}

/**
 * Draws the high-fidelity reel background matching Live Preview 1:1.
 * Resolves Problem 3 (Background Quality) with accurate gradients,
 * fluid Apple Music liquid meshes, dot matrix grids, and uncompressed media scaling.
 */
export function drawReelBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  style: ReelStyle,
  t: number,
) {
  ctx.save();

  // Custom media background (Image or Video)
  if (style.customBgUrl) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);

    if (style.customBgType === "video") {
      const vid = getOrLoadBgVideo(style.customBgUrl);
      if (vid && vid.readyState >= 2 && vid.videoWidth > 0) {
        try {
          if (Math.abs(vid.currentTime - (t % (vid.duration || 10))) > 0.3) {
            vid.currentTime = t % (vid.duration || 10);
          }
          const scale = Math.max(w / vid.videoWidth, h / vid.videoHeight);
          const dw = vid.videoWidth * scale;
          const dh = vid.videoHeight * scale;
          const dx = (w - dw) / 2;
          const dy = (h - dh) / 2;
          ctx.drawImage(vid, dx, dy, dw, dh);
        } catch {}
      }
    } else {
      let img = bgImageCache.get(style.customBgUrl);
      if (img && (img.naturalWidth > 0 || img.width > 0)) {
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        const scale = Math.max(w / iw, h / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = (w - dw) / 2;
        const dy = (h - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
      }
    }

    // Delicate contrast film overlay (12% black, preserves original media vibrancy)
    ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    return;
  }

  const bgDef = BACKGROUNDS.find((b) => b.id === style.bg) ?? BACKGROUNDS[0];

  // 1. Apple Music Theme: Deep velvet base + animated fluid liquid glow meshes
  if (bgDef.id === "applemusic") {
    ctx.fillStyle = "#0d0714";
    ctx.fillRect(0, 0, w, h);

    // Liquid Sphere 1: Top-Left Mesh
    const p1 = 0.5 + 0.5 * Math.sin(t * 0.78);
    const r1 = w * (0.50 + 0.06 * p1);
    const g1 = ctx.createRadialGradient(-w * 0.12, -h * 0.08, 0, -w * 0.12, -h * 0.08, r1);
    g1.addColorStop(0, "rgba(250, 45, 72, 0.38)"); // #FA2D48 Apple Red/Pink
    g1.addColorStop(0.55, "rgba(138, 35, 135, 0.26)"); // #8A2387
    g1.addColorStop(1, "rgba(13, 7, 20, 0)");
    ctx.fillStyle = g1;
    ctx.beginPath();
    ctx.arc(-w * 0.12, -h * 0.08, r1, 0, Math.PI * 2);
    ctx.fill();

    // Liquid Sphere 2: Mid-Right Mesh
    const p2 = 0.5 + 0.5 * Math.sin(t * 0.62 + 1.8);
    const r2 = w * (0.46 + 0.07 * p2);
    const g2 = ctx.createRadialGradient(w * 1.08, h * 0.36, 0, w * 1.08, h * 0.36, r2);
    g2.addColorStop(0, "rgba(155, 81, 224, 0.32)"); // #9b51e0 Apple Purple
    g2.addColorStop(0.55, "rgba(250, 45, 72, 0.22)"); // #FA2D48
    g2.addColorStop(1, "rgba(13, 7, 20, 0)");
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(w * 1.08, h * 0.36, r2, 0, Math.PI * 2);
    ctx.fill();

    // Liquid Sphere 3: Bottom-Left Mesh
    const p3 = 0.5 + 0.5 * Math.sin(t * 0.71 + 3.4);
    const r3 = w * (0.48 + 0.06 * p3);
    const g3 = ctx.createRadialGradient(w * 0.24, h * 1.04, 0, w * 0.24, h * 1.04, r3);
    g3.addColorStop(0, "rgba(233, 64, 87, 0.28)"); // #E94057
    g3.addColorStop(0.55, "rgba(74, 0, 224, 0.20)"); // #4A00E0
    g3.addColorStop(1, "rgba(13, 7, 20, 0)");
    ctx.fillStyle = g3;
    ctx.beginPath();
    ctx.arc(w * 0.24, h * 1.04, r3, 0, Math.PI * 2);
    ctx.fill();

    // Liquid glass blur overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    return;
  }

  // 2. Material You Dynamic Tone
  if (bgDef.id === "materialyou") {
    const myGrad = ctx.createRadialGradient(w * 0.5, h * 0.3, 10, w * 0.5, h * 0.3, w * 0.95);
    myGrad.addColorStop(0, "#2A3B5C");
    myGrad.addColorStop(0.6, "#151D2F");
    myGrad.addColorStop(1, "#0A0E17");
    ctx.fillStyle = myGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    return;
  }

  // 3. Spotify Royal Blue
  if (bgDef.id === "spotifyblue") {
    const spBlue = ctx.createLinearGradient(0, 0, 0, h);
    spBlue.addColorStop(0, "#3760F8");
    spBlue.addColorStop(0.55, "#2A4BD6");
    spBlue.addColorStop(1, "#162B85");
    ctx.fillStyle = spBlue;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    return;
  }

  // 4. Spotify Pure Dark
  if (bgDef.id === "spotifydark") {
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    return;
  }

  // 5. Cyber Neon Grid
  if (bgDef.id === "cyberneon") {
    const cnGrad = ctx.createLinearGradient(0, 0, 0, h);
    cnGrad.addColorStop(0, "#090314");
    cnGrad.addColorStop(0.6, "#17092B");
    cnGrad.addColorStop(1, "#05010B");
    ctx.fillStyle = cnGrad;
    ctx.fillRect(0, 0, w, h);

    const cyanGlow = ctx.createRadialGradient(w * 0.5, h * 0.5, 30, w * 0.5, h * 0.5, w * 0.7);
    cyanGlow.addColorStop(0, "rgba(0, 242, 254, 0.15)");
    cyanGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = cyanGlow;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    return;
  }

  // 6. Vintage Amber Vinyl Tape
  if (bgDef.id === "vintagetape") {
    const vtGrad = ctx.createRadialGradient(w * 0.5, h * 0.4, 20, w * 0.5, h * 0.4, w * 0.9);
    vtGrad.addColorStop(0, "#2C2218");
    vtGrad.addColorStop(0.65, "#17120D");
    vtGrad.addColorStop(1, "#0B0806");
    ctx.fillStyle = vtGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    return;
  }

  // 7. Nothing OS Glyph Matrix
  if (bgDef.id === "nothingmatrix") {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(255, 255, 255, 0.24)";
    const dotPitch = Math.max(16, Math.round(w / 36));
    const dotRadius = Math.max(1.2, w / 720);
    for (let gx = dotPitch / 2; gx < w; gx += dotPitch) {
      for (let gy = dotPitch / 2; gy < h; gy += dotPitch) {
        ctx.beginPath();
        ctx.arc(gx, gy, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Subtle Nothing red ambient pulse at center
    const redGlow = ctx.createRadialGradient(w * 0.5, h * 0.45, 10, w * 0.5, h * 0.45, w * 0.6);
    redGlow.addColorStop(0, "rgba(215, 25, 32, 0.12)");
    redGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = redGlow;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    return;
  }

  // 8. Halo / Aurora
  if (bgDef.id === "aurora") {
    const haloGrad = ctx.createRadialGradient(w * 0.5, h * 0.42, 20, w * 0.5, h * 0.42, w * 0.7);
    haloGrad.addColorStop(0, "#3a3a3a");
    haloGrad.addColorStop(0.55, "#141414");
    haloGrad.addColorStop(1, "#050505");
    ctx.fillStyle = haloGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    return;
  }

  // 9. Paper Void
  if (bgDef.id === "void") {
    const paperGrad = ctx.createLinearGradient(0, 0, 0, h);
    paperGrad.addColorStop(0, "#f3f3f3");
    paperGrad.addColorStop(1, "#dadada");
    ctx.fillStyle = paperGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    return;
  }

  // 10. Photo / Stage Backgrounds (neon, crowd, ocean, ember)
  ctx.fillStyle = "#0a0a0c";
  ctx.fillRect(0, 0, w, h);

  let drewImage = false;
  if (bgDef.image) {
    const img = bgImageCache.get(bgDef.image);
    if (img && (img.naturalWidth > 0 || img.width > 0)) {
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const scale = Math.max(w / iw, h / ih) * 1.02;
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
      drewImage = true;
    }
  }

  if (!drewImage) {
    if (bgDef.id === "neon") {
      const cityGrad = ctx.createLinearGradient(0, 0, 0, h);
      cityGrad.addColorStop(0, "#080612");
      cityGrad.addColorStop(0.4, "#150d26");
      cityGrad.addColorStop(0.75, "#251238");
      cityGrad.addColorStop(1, "#090510");
      ctx.fillStyle = cityGrad;
      ctx.fillRect(0, 0, w, h);
    } else if (bgDef.id === "crowd") {
      const stageGrad = ctx.createLinearGradient(0, 0, 0, h);
      stageGrad.addColorStop(0, "#07070a");
      stageGrad.addColorStop(0.5, "#18141e");
      stageGrad.addColorStop(0.85, "#2e1e36");
      stageGrad.addColorStop(1, "#0d0b10");
      ctx.fillStyle = stageGrad;
      ctx.fillRect(0, 0, w, h);
    } else if (bgDef.id === "ocean") {
      const oceanGrad = ctx.createLinearGradient(0, 0, 0, h);
      oceanGrad.addColorStop(0, "#030c14");
      oceanGrad.addColorStop(0.5, "#082236");
      oceanGrad.addColorStop(0.85, "#0e3857");
      oceanGrad.addColorStop(1, "#04101c");
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, w, h);
    }
  } else {
    // Subtle, natural contrast overlay for photography
    const imgOverlay = ctx.createLinearGradient(0, 0, 0, h);
    imgOverlay.addColorStop(0, "rgba(0, 0, 0, 0.35)");
    imgOverlay.addColorStop(0.5, "rgba(0, 0, 0, 0.15)");
    imgOverlay.addColorStop(1, "rgba(0, 0, 0, 0.55)");
    ctx.fillStyle = imgOverlay;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.restore();
}

/**
 * Renders an exact frame of the music video onto the 2D canvas.
 * Perfectly mirrors ReelPreview visual output with sub-pixel typography,
 * word-by-word karaoke synchronization, and safe margins.
 */
// Vector drawing primitives for pixel-perfect player controls
function drawSkipBack(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color = "#FFFFFF") {
  ctx.save();
  ctx.fillStyle = color;
  const barW = size * 0.16;
  const halfH = size * 0.44;
  ctx.fillRect(cx - size * 0.42, cy - halfH, barW, halfH * 2);
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.42 + barW, cy);
  ctx.lineTo(cx + size * 0.38, cy - halfH);
  ctx.lineTo(cx + size * 0.38, cy + halfH);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSkipForward(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color = "#FFFFFF") {
  ctx.save();
  ctx.fillStyle = color;
  const barW = size * 0.16;
  const halfH = size * 0.44;
  ctx.fillRect(cx + size * 0.42 - barW, cy - halfH, barW, halfH * 2);
  ctx.beginPath();
  ctx.moveTo(cx + size * 0.42 - barW, cy);
  ctx.lineTo(cx - size * 0.38, cy - halfH);
  ctx.lineTo(cx - size * 0.38, cy + halfH);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPauseIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color = "#000000") {
  ctx.save();
  ctx.fillStyle = color;
  const barW = size * 0.22;
  const gap = size * 0.22;
  const halfH = size * 0.42;
  ctx.fillRect(cx - gap / 2 - barW, cy - halfH, barW, halfH * 2);
  ctx.fillRect(cx + gap / 2, cy - halfH, barW, halfH * 2);
  ctx.restore();
}

function drawHeartIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color = "#1ED760") {
  ctx.save();
  ctx.fillStyle = color;
  ctx.translate(cx, cy);
  ctx.beginPath();
  const d = size * 0.48;
  ctx.moveTo(0, d * 0.75);
  ctx.bezierCurveTo(-d * 1.25, -d * 0.3, -d * 0.85, -d * 1.15, 0, -d * 0.55);
  ctx.bezierCurveTo(d * 0.85, -d * 1.15, d * 1.25, -d * 0.3, 0, d * 0.75);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawShuffleIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color = "#1ED760") {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.1);
  ctx.lineCap = "round";
  const r = size * 0.38;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - r * 0.5);
  ctx.bezierCurveTo(cx - r * 0.2, cy - r * 0.5, cx + r * 0.2, cy + r * 0.5, cx + r, cy + r * 0.5);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - r, cy + r * 0.5);
  ctx.bezierCurveTo(cx - r * 0.2, cy + r * 0.5, cx + r * 0.2, cy - r * 0.5, cx + r, cy - r * 0.5);
  ctx.stroke();

  // Green dot below
  ctx.beginPath();
  ctx.arc(cx, cy + r * 1.15, size * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTimerIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color = "rgba(255,255,255,0.85)") {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.09);
  const r = size * 0.36;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy - r * 0.6);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + r * 0.45, cy);
  ctx.stroke();
  ctx.restore();
}

function drawAlbumArtSquare(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  roundRect(ctx, x, y, size, size, Math.round(size * 0.22));
  ctx.clip();
  const grad = ctx.createLinearGradient(x, y, x + size, y + size);
  grad.addColorStop(0, "#F5F5F5");
  grad.addColorStop(1, "#8E8E8E");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, size, size);

  // Grooves
  ctx.strokeStyle = "rgba(0, 0, 0, 0.10)";
  ctx.lineWidth = 1.5;
  const center = size / 2;
  for (let r = size * 0.22; r <= size * 0.42; r += size * 0.08) {
    ctx.beginPath();
    ctx.arc(x + center, y + center, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Spindle hole
  ctx.fillStyle = "#0A0A0A";
  ctx.beginPath();
  ctx.arc(x + center, y + center, size * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStarIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color = "#FFFFFF") {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  const spikes = 5;
  const outerR = size * 0.48;
  const innerR = size * 0.22;
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerR;
    y = cy + Math.sin(rot) * outerR;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerR;
    y = cy + Math.sin(rot) * innerR;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerR);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawAirplayIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color = "rgba(255,255,255,0.85)") {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.8, size * 0.08);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const rW = size * 0.76;
  const rH = size * 0.52;
  const left = cx - rW / 2;
  const top = cy - size * 0.42;

  ctx.beginPath();
  ctx.moveTo(cx - size * 0.18, top + rH);
  ctx.lineTo(left, top + rH);
  ctx.lineTo(left, top);
  ctx.lineTo(left + rW, top);
  ctx.lineTo(left + rW, top + rH);
  ctx.lineTo(cx + size * 0.18, top + rH);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.04);
  ctx.lineTo(cx - size * 0.22, cy + size * 0.40);
  ctx.lineTo(cx + size * 0.22, cy + size * 0.40);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSpeechBubbleIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color = "#FFFFFF") {
  ctx.save();
  ctx.fillStyle = color;

  const rW = size * 0.72;
  const rH = size * 0.52;
  const left = cx - rW / 2;
  const top = cy - rH / 2 - size * 0.05;

  roundRect(ctx, left, top, rW, rH, size * 0.16);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - size * 0.14, top + rH);
  ctx.lineTo(cx - size * 0.24, top + rH + size * 0.20);
  ctx.lineTo(cx + size * 0.04, top + rH);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  const dotR = size * 0.055;
  ctx.beginPath();
  ctx.arc(cx - size * 0.16, top + rH / 2, dotR, 0, Math.PI * 2);
  ctx.arc(cx, top + rH / 2, dotR, 0, Math.PI * 2);
  ctx.arc(cx + size * 0.16, top + rH / 2, dotR, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawVolumeIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color = "rgba(255,255,255,0.7)") {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.8, size * 0.08);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const w = size * 0.25;
  const h = size * 0.35;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.25, cy - h / 2);
  ctx.lineTo(cx - size * 0.1, cy - h / 2);
  ctx.lineTo(cx + size * 0.1, cy - size * 0.38);
  ctx.lineTo(cx + size * 0.1, cy + size * 0.38);
  ctx.lineTo(cx - size * 0.1, cy + h / 2);
  ctx.lineTo(cx - size * 0.25, cy + h / 2);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx + size * 0.1, cy, size * 0.22, -Math.PI / 4, Math.PI / 4);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx + size * 0.1, cy, size * 0.36, -Math.PI / 4, Math.PI / 4);
  ctx.stroke();

  ctx.restore();
}

export type DrawFrameOptions = {
  platformUI?: boolean;
  platform?: "reels" | "shorts";
  watermark?: boolean;
};

export function drawCanvasFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  duration: number,
  lines: Line[],
  style: ReelStyle,
  track: TrackInfo,
  options: DrawFrameOptions = {},
) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);

  // 1. Draw High-Fidelity Background
  drawReelBackground(ctx, w, h, style, t);

  const anim = style.animation || "karaoke";
  const isApple = anim === "apple";
  const isSpotify = anim === "spotify";
  const isNothing = anim === "nothing";
  const isRetro = anim === "retro";

  // 2. Top Chrome: Spotify gets Top-Center Title & Artist; other presets get Top Badge + Live EQ Bars
  ctx.save();
  const topPad = Math.round(h * 0.032);
  const isAi = (s?: string) => !s || /groq|whisper|identified artist|upload audio/i.test(s);
  const cleanArt = isAi(track.artist) ? "" : track.artist;
  const cleanTit = isAi(track.title) ? "Audio Track" : track.title;

  if (isSpotify) {
    // Spotify: Centered Song Title & Author at top, NO left badge, NO right EQ bars
    const topTitleFontSize = Math.round(w * 0.038);
    const topArtistFontSize = Math.round(w * 0.026);

    ctx.font = `900 ${topTitleFontSize}px sans-serif`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const maxTopW = Math.round(w * 0.85);

    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = 8;
    ctx.fillText(cleanTit, w / 2, topPad, maxTopW);

    ctx.font = `600 ${topArtistFontSize}px sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.70)";
    ctx.shadowBlur = 6;
    ctx.fillText(cleanArt || "Spotify Artist", w / 2, topPad + topTitleFontSize + 4, maxTopW);
  } else {
    const badgeText = isApple
      ? ` ${cleanArt ? cleanArt.toUpperCase() : "LIVE LYRICS"}`
      : isRetro
        ? `📻 ${cleanArt ? cleanArt.toUpperCase() : "VINYL TAPE"}`
        : `● ${cleanArt ? cleanArt.toUpperCase() : "(N) NOW PLAYING"}`;

    const badgeFontSize = Math.round(w * 0.017);
    ctx.font = isNothing ? `700 ${badgeFontSize}px monospace` : `800 ${badgeFontSize}px sans-serif`;
    const badgeTextW = ctx.measureText(badgeText).width;
    const badgeW = badgeTextW + Math.round(w * 0.034);
    const badgeH = Math.round(w * 0.042);
    const badgeX = Math.round(w * 0.05);
    const badgeY = topPad;

    ctx.fillStyle = isApple
      ? "rgba(255, 255, 255, 0.12)"
      : isRetro
        ? "rgba(251, 191, 36, 0.15)"
        : "rgba(0, 0, 0, 0.80)";
    ctx.strokeStyle = isApple
      ? "rgba(255, 255, 255, 0.20)"
      : isRetro
        ? "rgba(251, 191, 36, 0.40)"
        : "rgba(255, 255, 255, 0.20)";
    ctx.lineWidth = 1;
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, Math.round(badgeH / 2));
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isRetro
      ? "#FDE68A"
      : "rgba(255, 255, 255, 0.90)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2);

    // 3. Live Animated EQ Bars (Top Right)
    const eqW = Math.round(w * 0.08);
    const eqX = w - badgeX - eqW;
    const eqY = topPad + Math.round(badgeH * 0.22);
    const eqH = Math.round(badgeH * 0.55);
    const barWidth = Math.round(w * 0.005);
    const barGap = Math.round(w * 0.005);
    const eqHeights = [0.5, 0.9, 0.65, 1.0];
    ctx.fillStyle = isRetro
      ? "#FBBF24"
      : isNothing
        ? "#D71920"
        : "rgba(255, 255, 255, 0.85)";
    for (let i = 0; i < 4; i++) {
      const pulse = 0.35 + 0.65 * Math.abs(Math.sin(t * 8 + i * 1.5));
      const bh = eqH * eqHeights[i] * pulse;
      roundRect(ctx, eqX + i * (barWidth + barGap), eqY + (eqH - bh), barWidth, bh, 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // 4. Lyrics Lines
  const fontObj = FONTS.find((f) => f.id === style.font) ?? FONTS[0];
  const isUpper = Boolean(fontObj.upper);
  const fontFamily = fontObj.family || "sans-serif";

  const normalizedLines = normalizeLyricalLines(lines);
  const currentIdx = activeIndex(normalizedLines, t);
  const curLine = currentIdx >= 0 ? normalizedLines[currentIdx] : null;
  const prevLine = currentIdx > 0 ? normalizedLines[currentIdx - 1] : null;
  const nextLine =
    currentIdx >= 0 && currentIdx < normalizedLines.length - 1 ? normalizedLines[currentIdx + 1] : null;
  const nextNextLine =
    currentIdx >= 0 && currentIdx < normalizedLines.length - 2 ? normalizedLines[currentIdx + 2] : null;

  const fontSize = Math.round((style.size / 360) * w * (anim === "spotify" ? 0.90 : 0.94));
  const textAlign = style.align || "center";

  // Strict Safe Zone Boundaries: left 7%, right 15%, top 13%, bottom 23-35%
  const safeLeft = Math.round(w * 0.07);
  const safeRight = Math.round(w * 0.85); // 15% right margin to guarantee inside safe zone
  const safeW = safeRight - safeLeft;
  const safeTop = Math.round(h * 0.13);
  const safeBottom = Math.round(options.platformUI ? h * 0.77 : h * 0.72);

  // Target X for left/center/right alignment strictly within the safe zone
  const targetPrevNextX =
    textAlign === "left"
      ? safeLeft
      : textAlign === "right"
        ? safeRight
        : safeLeft + safeW / 2;

  let centerY = options.platformUI
    ? (style.position === "top" ? h * 0.28 : style.position === "bottom" ? h * 0.65 : h * 0.46)
    : (style.position === "top" ? h * 0.28 : style.position === "bottom" ? h * 0.53 : h * 0.40);

  // Active Lyric Line (Current)
  let activeTotalH = 0;
  let activeStartY = centerY;

  // Previous Lyric Line (Faded / Blurred above)
  if (prevLine) {
    ctx.save();
    const prevFontSize = anim === "spotify" ? Math.round(fontSize * 0.95) : Math.round(fontSize * 0.58);
    ctx.font = `800 ${prevFontSize}px ${fontFamily}`;
    ctx.fillStyle = isApple
      ? style.textColor || "rgba(255, 255, 255, 0.44)"
      : isSpotify
        ? style.highlight || "#FFFFFF"
        : style.textColor || "rgba(255, 255, 255, 0.3)";
    ctx.globalAlpha = isApple ? 0.44 : isSpotify ? 0.85 : 0.3;
    if (isApple) {
      try {
        ctx.filter = "blur(2.5px)";
      } catch (_) {}
    }
    ctx.textAlign = textAlign;
    ctx.textBaseline = "middle";

    const rawPrevGroups = splitTextIntoSentenceGroups(
      isUpper ? prevLine.text.toUpperCase() : prevLine.text,
    );

    // Ensure rows fit safeW
    const pIntraH = Math.round(prevFontSize * 1.14);
    const pGap = Math.round(prevFontSize * 0.55);
    let pTotalH = 0;
    const boundedPrevRows: string[] = [];

    for (const g of rawPrevGroups) {
      for (const rowText of g.rows) {
        const words = rowText.split(/\s+/).filter(Boolean);
        let curLine = "";
        for (const word of words) {
          const test = curLine ? `${curLine} ${word}` : word;
          if (curLine && ctx.measureText(test).width > safeW) {
            boundedPrevRows.push(curLine);
            curLine = word;
          } else {
            curLine = test;
          }
        }
        if (curLine) boundedPrevRows.push(curLine);
      }
    }

    pTotalH = boundedPrevRows.length * pIntraH;
    const prevBaseY = centerY - pTotalH - Math.round(fontSize * 0.85);

    if (prevBaseY >= safeTop) {
      let curPY = prevBaseY;
      for (const rowText of boundedPrevRows) {
        ctx.fillText(rowText, targetPrevNextX, curPY);
        curPY += pIntraH;
      }
    }
    ctx.restore();
  }

  // Active Lyric Line (Current)
  if (curLine) {
    ctx.save();
    ctx.font = `800 ${fontSize}px ${fontFamily}`;
    ctx.textAlign = textAlign;
    ctx.textBaseline = "middle";

    const rawLineWords = getLineWordsWithTimings(curLine);
    const lineWords = rawLineWords.map((lw) => ({
      ...lw,
      text: isUpper ? lw.text.toUpperCase() : lw.text,
    }));

    // Word measurements for karaoke layout
    const measuredWords = lineWords.map((wObj) => {
      const metrics = ctx.measureText(wObj.text);
      return {
        ...wObj,
        w: metrics.width,
        spaceW: ctx.measureText(" ").width,
      };
    });

    const baseSentenceGroups = splitWordsIntoSentenceGroups(measuredWords as any) as {
      words: typeof measuredWords;
      rows: (typeof measuredWords)[];
    }[];

    // Guarantee that every row mathematically fits inside safeW
    const sentenceGroups: typeof baseSentenceGroups = [];
    for (const group of baseSentenceGroups) {
      const wrappedRows: (typeof measuredWords)[] = [];
      for (const row of group.rows) {
        let curSubRow: typeof measuredWords = [];
        let curSubW = 0;

        for (const wObj of row) {
          const itemW = wObj.w + (curSubRow.length > 0 ? wObj.spaceW : 0);
          if (curSubRow.length > 0 && curSubW + itemW > safeW) {
            wrappedRows.push(curSubRow);
            curSubRow = [wObj];
            curSubW = wObj.w;
          } else {
            curSubRow.push(wObj);
            curSubW += itemW;
          }
        }
        if (curSubRow.length > 0) {
          wrappedRows.push(curSubRow);
        }
      }
      sentenceGroups.push({
        words: group.words,
        rows: wrappedRows,
      });
    }

    const intraLineH = Math.round(fontSize * 1.14);
    const interSentenceGap = Math.round(fontSize * 0.55);

    activeTotalH = 0;
    sentenceGroups.forEach((g, gIdx) => {
      activeTotalH += g.rows.length * intraLineH + (gIdx > 0 ? interSentenceGap : 0);
    });

    // Clamp active line to stay strictly inside safe zone
    activeStartY = Math.max(
      safeTop + Math.round(fontSize * 0.5),
      Math.min(safeBottom - activeTotalH, centerY - activeTotalH / 2),
    );
    let currentY = activeStartY;

    for (const group of sentenceGroups) {
      for (const row of group.rows) {
        const rowWordW = row.reduce((sum, item) => sum + item.w, 0);
        const rowSpacesW = Math.max(0, row.length - 1) * (row[0]?.spaceW || fontSize * 0.25);
        const totalRowW = rowWordW + rowSpacesW;

        let startX =
          textAlign === "left"
            ? safeLeft
            : textAlign === "right"
              ? safeRight - totalRowW
              : safeLeft + (safeW - totalRowW) / 2;

        // Strict clamp to safe zone bounds
        startX = Math.max(safeLeft, Math.min(safeRight - totalRowW, startX));

        for (let wi = 0; wi < row.length; wi++) {
          const wObj = row[wi];
          const wordText = wObj.text;
          const wordW = wObj.w;
          const spaceW = wObj.spaceW;

          let localProgress = 0;
          if (t >= wObj.end) {
            localProgress = 1;
          } else if (t <= wObj.start) {
            localProgress = 0;
          } else {
            localProgress = Math.min(1, Math.max(0, (t - wObj.start) / Math.max(0.08, wObj.end - wObj.start)));
          }

          if (isSpotify) {
            // Spotify active sentence: Full bright highlight with clean shadow
            const spHl = style.highlight || "#FFFFFF";
            ctx.fillStyle = spHl;
            ctx.shadowColor = "rgba(0, 0, 0, 0.40)";
            ctx.shadowBlur = 10;
            ctx.fillText(wordText, startX, currentY);
            ctx.shadowBlur = 0;
          } else if (isNothing) {
            // Nothing OS Glyph: Active word glows Nothing Red (#D71920)
            const isRed = style.highlight === "#FFFFFF" ? "#D71920" : style.highlight;
            const isSung = localProgress >= 1;
            const isActive = localProgress > 0 && localProgress < 1;

            ctx.fillStyle = isActive ? isRed : isSung ? "#FFFFFF" : style.textColor || "rgba(255, 255, 255, 0.4)";
            if (isActive) {
              ctx.shadowColor = isRed;
              ctx.shadowBlur = 14;
            }
            ctx.fillText(wordText, startX, currentY);
            ctx.shadowBlur = 0;
          } else if (isApple) {
            // Authentic Apple Music iOS active karaoke syllabic glowing wipe
            const baseColor = style.textColor || "rgba(255, 255, 255, 0.44)";
            const activeColor = style.highlight || "#FFFFFF";
            ctx.fillStyle = baseColor;
            ctx.fillText(wordText, startX, currentY);

            if (localProgress > 0) {
              ctx.save();
              ctx.beginPath();
              ctx.rect(startX, currentY - intraLineH / 2, wordW * localProgress, intraLineH);
              ctx.clip();

              ctx.fillStyle = activeColor;
              ctx.shadowColor = activeColor;
              ctx.shadowBlur = 18;
              ctx.fillText(wordText, startX, currentY);
              ctx.restore();
            }
          } else {
            // Material You / Classic Karaoke smooth gradient fill
            const baseColor = style.textColor || "rgba(255, 255, 255, 0.50)";
            const activeColor = style.highlight || "#8AB4F8";

            ctx.fillStyle = baseColor;
            ctx.fillText(wordText, startX, currentY);

            if (localProgress > 0) {
              ctx.save();
              ctx.beginPath();
              ctx.rect(startX, currentY - intraLineH / 2, wordW * localProgress, intraLineH);
              ctx.clip();

              ctx.fillStyle = activeColor;
              ctx.shadowColor = activeColor;
              ctx.shadowBlur = 12;
              ctx.fillText(wordText, startX, currentY);
              ctx.restore();
            }
          }

          startX += wordW + spaceW;
        }

        currentY += intraLineH;
      }
      currentY += interSentenceGap;
    }

    ctx.restore();
  }

  // Upcoming Lyric Lines (Faded below)
  if (nextLine) {
    ctx.save();
    const nextFontSize = anim === "spotify" ? Math.round(fontSize * 0.95) : Math.round(fontSize * 0.60);
    ctx.font = `800 ${nextFontSize}px ${fontFamily}`;
    ctx.fillStyle = isApple
      ? style.textColor || "rgba(255, 255, 255, 0.50)"
      : isSpotify
        ? style.textColor || "rgba(0, 0, 0, 0.72)"
        : style.textColor || "rgba(255, 255, 255, 0.35)";
    ctx.globalAlpha = isApple ? 0.48 : isSpotify ? 0.78 : 0.35;
    if (isApple) {
      try {
        ctx.filter = "blur(2.2px)";
      } catch (_) {}
    }
    ctx.textAlign = textAlign;
    ctx.textBaseline = "middle";

    const rawNextGroups = splitTextIntoSentenceGroups(
      isUpper ? nextLine.text.toUpperCase() : nextLine.text,
    );

    const nIntraH = Math.round(nextFontSize * 1.14);
    const nGap = Math.round(nextFontSize * 0.55);
    const boundedNextRows: string[] = [];

    for (const g of rawNextGroups) {
      for (const rowText of g.rows) {
        const words = rowText.split(/\s+/).filter(Boolean);
        let curLine = "";
        for (const word of words) {
          const test = curLine ? `${curLine} ${word}` : word;
          if (curLine && ctx.measureText(test).width > safeW) {
            boundedNextRows.push(curLine);
            curLine = word;
          } else {
            curLine = test;
          }
        }
        if (curLine) boundedNextRows.push(curLine);
      }
    }

    const nextBaseY = activeStartY + activeTotalH + Math.round(fontSize * 0.4);
    let curNY = nextBaseY;

    for (const rowText of boundedNextRows) {
      if (curNY + nIntraH <= safeBottom) {
        ctx.fillText(rowText, targetPrevNextX, curNY);
        curNY += nIntraH;
      }
    }

    ctx.restore();
  }

  // Next-Next Lyric Line (for Apple Music depth-of-field effect)
  if (isApple && nextNextLine) {
    ctx.save();
    const nnFontSize = Math.round(fontSize * 0.52);
    ctx.font = `800 ${nnFontSize}px ${fontFamily}`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
    ctx.globalAlpha = 0.22;
    try {
      ctx.filter = "blur(4.5px)";
    } catch (_) {}
    ctx.textAlign = textAlign;
    ctx.textBaseline = "middle";

    const rawNnGroups = splitTextIntoSentenceGroups(
      isUpper ? nextNextLine.text.toUpperCase() : nextNextLine.text,
    );
    const nnIntraH = Math.round(nnFontSize * 1.14);
    const boundedNnRows: string[] = [];

    for (const g of rawNnGroups) {
      for (const rowText of g.rows) {
        const words = rowText.split(/\s+/).filter(Boolean);
        let curLine = "";
        for (const word of words) {
          const test = curLine ? `${curLine} ${word}` : word;
          if (curLine && ctx.measureText(test).width > safeW) {
            boundedNnRows.push(curLine);
            curLine = word;
          } else {
            curLine = test;
          }
        }
        if (curLine) boundedNnRows.push(curLine);
      }
    }

    const nnBaseY = activeStartY + activeTotalH + Math.round(fontSize * 1.1);
    let curNNY = nnBaseY;

    for (const rowText of boundedNnRows) {
      if (curNNY + nnIntraH <= safeBottom) {
        ctx.fillText(rowText, targetPrevNextX, curNNY);
        curNNY += nnIntraH;
      }
    }

    ctx.restore();
  }

  // 5. Watermark (if enabled)
  if (options.watermark) {
    ctx.save();
    const wmText = "LYRIQ";
    const wmFontSize = Math.round(w * 0.026);
    ctx.font = `700 ${wmFontSize}px sans-serif`;
    const wmTextW = ctx.measureText(wmText).width;
    const wmPadX = Math.round(w * 0.024);
    const wmPadY = Math.round(w * 0.010);
    const wmW = wmTextW + wmPadX * 2;
    const wmH = wmFontSize + wmPadY * 2;
    const wmX = Math.round(w * 0.95 - wmW);
    const wmY = Math.round(h * 0.075);
    ctx.fillStyle = "rgba(0, 0, 0, 0.40)";
    roundRect(ctx, wmX, wmY, wmW, wmH, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(wmText, wmX + wmW / 2, wmY + wmH / 2);
    ctx.restore();
  }

  // 6. Bottom Player Chrome or Platform Overlay (Exact Pure Clone of Live Preview)
  if (options.platformUI) {
    // Platform Overlay: Instagram Reels / YouTube Shorts interface
    ctx.save();
    const isReels = options.platform === "reels";
    const rightX = Math.round(w * 0.92);
    const rightStartY = Math.round(h * 0.58);
    const itemGap = Math.round(h * 0.072);
    const iconSize = Math.round(w * 0.075);

    // Right Action Rail
    const actions = isReels
      ? [
          { label: "48.2K", color: "#FFFFFF" },
          { label: "1,204", color: "#FFFFFF" },
          { label: "3.1K", color: "#FFFFFF" },
          { label: "", color: "#FFFFFF" },
        ]
      : [
          { label: "92K", color: "#FFFFFF" },
          { label: "Dislike", color: "#FFFFFF" },
          { label: "2,318", color: "#FFFFFF" },
          { label: "Share", color: "#FFFFFF" },
        ];

    actions.forEach((act, idx) => {
      const cy = rightStartY + idx * itemGap;
      if (idx === 0) {
        drawHeartIcon(ctx, rightX, cy, iconSize, "#FFFFFF");
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.90)";
        ctx.beginPath();
        ctx.arc(rightX, cy, iconSize * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      if (act.label) {
        ctx.font = `600 ${Math.round(w * 0.026)}px sans-serif`;
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(act.label, rightX, cy + iconSize * 0.45);
      }
    });

    // Spinning Vinyl Disc at bottom right
    const discY = rightStartY + 4 * itemGap;
    ctx.save();
    ctx.translate(rightX, discY);
    ctx.rotate(t * 2);
    roundRect(ctx, -iconSize / 2, -iconSize / 2, iconSize, iconSize, 6);
    ctx.clip();
    const discGrad = ctx.createLinearGradient(-iconSize / 2, -iconSize / 2, iconSize / 2, iconSize / 2);
    discGrad.addColorStop(0, "#CCFF00");
    discGrad.addColorStop(1, "#555555");
    ctx.fillStyle = discGrad;
    ctx.fillRect(-iconSize / 2, -iconSize / 2, iconSize, iconSize);
    ctx.restore();

    // Bottom Left Creator & Song Info
    const leftX = Math.round(w * 0.06);
    const leftBottomY = Math.round(h * 0.88);
    const avatarR = Math.round(w * 0.04);
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.beginPath();
    ctx.arc(leftX + avatarR, leftBottomY, avatarR, 0, Math.PI * 2);
    ctx.fill();

    const artistName = (track.artist || "artist").toLowerCase().replace(/\s+/g, "");
    ctx.font = `700 ${Math.round(w * 0.034)}px sans-serif`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(artistName, leftX + avatarR * 2 + 12, leftBottomY);

    // Follow pill
    const followText = isReels ? "Follow" : "Subscribe";
    ctx.font = `600 ${Math.round(w * 0.026)}px sans-serif`;
    const fW = ctx.measureText(followText).width + 16;
    const fH = Math.round(w * 0.048);
    const fX = leftX + avatarR * 2 + 12 + ctx.measureText(artistName).width + 12;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.70)";
    ctx.lineWidth = 1;
    roundRect(ctx, fX, leftBottomY - fH / 2, fW, fH, 4);
    ctx.stroke();
    ctx.fillText(followText, fX + 8, leftBottomY);

    // Song Title
    ctx.font = `600 ${Math.round(w * 0.030)}px sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fillText(track.title || "lyric reel", leftX, leftBottomY + Math.round(w * 0.055));
    ctx.restore();

    ctx.restore();
  } else if (isSpotify) {
    // Spotify Standard Player Chrome at Bottom (clean seekbar & controls, title/artist moved to top center)
    ctx.save();
    const botX = Math.round(w * 0.06);
    const botW = Math.round(w * 0.88);
    const botBottom = Math.round(h * 0.05);
    const botH = Math.round(h * 0.11);
    const botY = h - botBottom - botH;

    // Seekbar
    const seekY = botY;
    const seekH = Math.round(w * 0.009);
    const seekPct = Math.min(1, Math.max(0, duration > 0 ? t / duration : 0));

    ctx.fillStyle = "rgba(255, 255, 255, 0.20)";
    roundRect(ctx, botX, seekY, botW, seekH, seekH / 2);
    ctx.fill();

    if (seekPct > 0) {
      ctx.fillStyle = "#FFFFFF";
      roundRect(ctx, botX, seekY, Math.max(seekH, botW * seekPct), seekH, seekH / 2);
      ctx.fill();

      // Circular White Knob
      const knobX = botX + botW * seekPct;
      const knobR = Math.round(w * 0.013);
      ctx.beginPath();
      ctx.arc(knobX, seekY + seekH / 2, knobR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Time Labels
    const timeFontSize = Math.round(w * 0.025);
    ctx.font = `600 ${timeFontSize}px sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(fmt(t), botX, seekY + seekH + 6);

    ctx.textAlign = "right";
    const remTime = Math.max(0, duration - t);
    ctx.fillText(`-${fmt(remTime)}`, botX + botW, seekY + seekH + 6);

    // Controls Row: Shuffle, Previous, Big White Pause Circle, Next, Like Heart
    const ctrlY = seekY + seekH + timeFontSize + Math.round(h * 0.036);
    const ctrlSpacing = botW / 5;

    // 1. Shuffle
    drawShuffleIcon(ctx, botX + ctrlSpacing * 0.5, ctrlY, Math.round(w * 0.05), "#1ED760");

    // 2. Previous
    drawSkipBack(ctx, botX + ctrlSpacing * 1.5, ctrlY, Math.round(w * 0.06), "rgba(255, 255, 255, 0.85)");

    // 3. Big White Center Pause Button
    const playCenterR = Math.round(w * 0.07);
    ctx.save();
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(botX + ctrlSpacing * 2.5, ctrlY, playCenterR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawPauseIcon(ctx, botX + ctrlSpacing * 2.5, ctrlY, Math.round(w * 0.065), "#000000");

    // 4. Next
    drawSkipForward(ctx, botX + ctrlSpacing * 3.5, ctrlY, Math.round(w * 0.06), "rgba(255, 255, 255, 0.85)");

    // 5. Green Like Heart
    drawHeartIcon(ctx, botX + ctrlSpacing * 4.5, ctrlY, Math.round(w * 0.052), "#1ED760");

    ctx.restore();
  } else if (isApple) {
    // Apple Music iOS Authentic Floating Glass Player Sheet
    ctx.save();
    const cardX = Math.round(w * 0.04);
    const cardW = Math.round(w * 0.92);
    const cardH = Math.round(h * 0.23);
    const cardBottom = Math.round(h * 0.035);
    const cardY = h - cardBottom - cardH;
    const cardRadius = Math.round(w * 0.07);

    // Frosted Glass Sheet Background & Border
    ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1;
    roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
    ctx.fill();
    ctx.stroke();

    // 1. Sheet Grabber Handle Pill at top center
    const grabberW = Math.round(w * 0.09);
    const grabberH = Math.round(w * 0.009);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    roundRect(ctx, cardX + (cardW - grabberW) / 2, cardY + Math.round(cardH * 0.035), grabberW, grabberH, grabberH / 2);
    ctx.fill();

    const padX = Math.round(w * 0.045);
    const headerY = cardY + Math.round(cardH * 0.10);

    // 2. Album Cover Art
    const artSize = Math.round(w * 0.092);
    const artX = cardX + padX;
    drawAlbumArtSquare(ctx, artX, headerY, artSize);

    // 3. Track Title & Artist
    const titleX = artX + artSize + Math.round(w * 0.03);
    const titleFontSz = Math.round(w * 0.036);
    const artistFontSz = Math.round(w * 0.026);
    const maxTitleW = cardW - padX * 2 - artSize - Math.round(w * 0.24);

    ctx.font = `700 ${titleFontSz}px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(track.title || "Apple Music Track", titleX, headerY + 1, maxTitleW);

    ctx.font = `500 ${artistFontSz}px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.fillText(cleanArt || "Apple Music", titleX, headerY + titleFontSz + 5, maxTitleW);

    // 4. Right side: Favorite Star & Lyric Counter Badge
    const starSize = Math.round(w * 0.052);
    const starX = cardX + cardW - padX - starSize - Math.round(w * 0.12);
    const starY = headerY + artSize / 2;
    drawStarIcon(ctx, starX, starY, starSize, "rgba(255, 255, 255, 0.85)");

    const countText = `${currentIdx >= 0 ? String(currentIdx + 1).padStart(2, "0") : "00"}/${String(lines.length).padStart(2, "0")}`;
    const badgeFontSz = Math.round(w * 0.024);
    ctx.font = `700 ${badgeFontSz}px sans-serif`;
    const countW = ctx.measureText(countText).width + 14;
    const countH = Math.round(w * 0.046);
    const countX = cardX + cardW - padX - countW;
    const countY = headerY + (artSize - countH) / 2;

    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1;
    roundRect(ctx, countX, countY, countW, countH, countH / 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.90)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(countText, countX + countW / 2, countY + countH / 2);

    // 5. Seekbar
    const seekY = headerY + artSize + Math.round(h * 0.016);
    const seekW = cardW - padX * 2;
    const seekH = Math.round(w * 0.008);
    const pct = Math.min(1, Math.max(0, duration > 0 ? t / duration : 0));

    ctx.fillStyle = "rgba(255, 255, 255, 0.20)";
    roundRect(ctx, cardX + padX, seekY, seekW, seekH, seekH / 2);
    ctx.fill();

    if (pct > 0) {
      ctx.fillStyle = "#FFFFFF";
      roundRect(ctx, cardX + padX, seekY, Math.max(seekH, seekW * pct), seekH, seekH / 2);
      ctx.fill();

      const knobX = cardX + padX + seekW * pct;
      const knobR = Math.round(w * 0.0125);
      ctx.save();
      ctx.fillStyle = "#FFFFFF";
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(knobX, seekY + seekH / 2, knobR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 6. Timestamps: Elapsed on left, Negative Remaining on right
    const timeFontSz = Math.round(w * 0.025);
    ctx.font = `600 ${timeFontSz}px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.60)";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(fmt(t), cardX + padX, seekY + seekH + 5);

    ctx.textAlign = "right";
    const remTime = Math.max(0, duration - t);
    ctx.fillText(`-${fmt(remTime)}`, cardX + cardW - padX, seekY + seekH + 5);

    // 7. Apple 3-Button Controls: SkipBack, Big White Play/Pause Button, SkipForward
    const btnCenterY = seekY + seekH + timeFontSz + Math.round(h * 0.034);
    const centerX = cardX + cardW / 2;
    const btnSpacing = Math.round(w * 0.22);
    const playRadius = Math.round(w * 0.068);

    // SkipBack
    drawSkipBack(ctx, centerX - btnSpacing, btnCenterY, Math.round(w * 0.062), "#FFFFFF");

    // Center Big White Circle Play/Pause Button
    ctx.save();
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(255, 255, 255, 0.4)";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(centerX, btnCenterY, playRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawPauseIcon(ctx, centerX, btnCenterY, Math.round(w * 0.058), "#000000");

    // SkipForward
    drawSkipForward(ctx, centerX + btnSpacing, btnCenterY, Math.round(w * 0.062), "#FFFFFF");

    // 8. Apple Bottom Utility Row: Volume Slider, AirPlay, Active Lyrics Bubble
    const utilY = btnCenterY + playRadius + Math.round(h * 0.016);
    const utilH = Math.round(w * 0.045);

    // Volume
    const volX = cardX + padX;
    const volW = Math.round(cardW * 0.30);
    drawVolumeIcon(ctx, volX + Math.round(w * 0.018), utilY + utilH / 2, Math.round(w * 0.036), "rgba(255, 255, 255, 0.65)");
    const volBarX = volX + Math.round(w * 0.042);
    const volBarW = volW - Math.round(w * 0.045);
    const volBarH = Math.round(w * 0.006);
    const volBarY = utilY + (utilH - volBarH) / 2;
    ctx.fillStyle = "rgba(255, 255, 255, 0.20)";
    roundRect(ctx, volBarX, volBarY, volBarW, volBarH, volBarH / 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.70)";
    roundRect(ctx, volBarX, volBarY, volBarW * 0.7, volBarH, volBarH / 2);
    ctx.fill();

    // AirPlay in Center
    drawAirplayIcon(ctx, centerX, utilY + utilH / 2, Math.round(w * 0.044), "rgba(255, 255, 255, 0.80)");

    // Active Lyrics Speech Bubble Pill on right
    const pillW = Math.round(w * 0.09);
    const pillH = Math.round(w * 0.042);
    const pillX = cardX + cardW - padX - pillW;
    const pillY = utilY + (utilH - pillH) / 2;
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.30)";
    ctx.lineWidth = 1;
    roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.stroke();
    drawSpeechBubbleIcon(ctx, pillX + pillW / 2, pillY + pillH / 2, Math.round(w * 0.038), "#FFFFFF");

    ctx.restore();
  } else {
    // Nothing / Retro / Default Floating Glass Player Card
    ctx.save();
    const cardX = Math.round(w * 0.04);
    const cardW = Math.round(w * 0.92);
    const cardH = Math.round(h * 0.215);
    const cardBottom = Math.round(h * 0.038);
    const cardY = h - cardBottom - cardH;
    const cardRadius = Math.round(w * 0.05);

    // Card Background & Glass Border
    ctx.fillStyle = isRetro
      ? "rgba(23, 18, 13, 0.92)"
      : "rgba(0, 0, 0, 0.88)";
    ctx.strokeStyle = isRetro
      ? "rgba(251, 191, 36, 0.35)"
      : "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1;

    roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
    ctx.fill();
    ctx.stroke();

    const padX = Math.round(w * 0.05);
    const padY = Math.round(h * 0.024);

    // Top Header Row: Album Art + Track Info + Counter Badge
    const artSize = Math.round(w * 0.088);
    const artX = cardX + padX;
    const artY = cardY + padY;
    drawAlbumArtSquare(ctx, artX, artY, artSize);

    // Track Title & Artist
    const textLeft = artX + artSize + Math.round(w * 0.03);
    const titleFontSz = Math.round(w * 0.034);
    const artistFontSz = Math.round(w * 0.026);
    const maxTextW = cardW - padX * 2 - artSize - Math.round(w * 0.22);

    ctx.font = isNothing ? `700 ${titleFontSz}px monospace` : `700 ${titleFontSz}px sans-serif`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(track.title || "Audio Track", textLeft, artY + 2, maxTextW);

    ctx.font = isNothing ? `600 ${artistFontSz}px monospace` : `500 ${artistFontSz}px sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.60)";
    ctx.fillText(track.artist || "Original Track", textLeft, artY + titleFontSz + 6, maxTextW);

    // Lyric Counter Badge on right: e.g. "01 / 15"
    const countText = `${currentIdx >= 0 ? String(currentIdx + 1).padStart(2, "0") : "00"} / ${String(lines.length).padStart(2, "0")}`;
    const badgeFontSz = Math.round(w * 0.024);
    ctx.font = isNothing ? `700 ${badgeFontSz}px monospace` : `700 ${badgeFontSz}px sans-serif`;
    const countW = ctx.measureText(countText).width + 16;
    const countH = Math.round(w * 0.046);
    const countX = cardX + cardW - padX - countW;
    const countY = artY + (artSize - countH) / 2;

    if (isNothing) {
      ctx.fillStyle = "rgba(215, 25, 32, 0.20)";
      ctx.strokeStyle = "rgba(215, 25, 32, 0.60)";
      ctx.lineWidth = 1;
      roundRect(ctx, countX, countY, countW, countH, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#D71920";
    } else {
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.20)";
      ctx.lineWidth = 1;
      roundRect(ctx, countX, countY, countW, countH, countH / 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, 0.90)";
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(countText, countX + countW / 2, countY + countH / 2);

    // Middle Row: Progress Seekbar
    const seekY = artY + artSize + Math.round(h * 0.020);
    const seekW = cardW - padX * 2;
    const seekH = Math.round(w * 0.008);
    const pct = Math.min(1, Math.max(0, duration > 0 ? t / duration : 0));

    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    roundRect(ctx, cardX + padX, seekY, seekW, seekH, seekH / 2);
    ctx.fill();

    const seekFillColor = isNothing
      ? "#D71920"
      : isRetro
        ? "#FBBF24"
        : style.highlight || "#FFFFFF";

    if (pct > 0) {
      ctx.fillStyle = seekFillColor;
      roundRect(ctx, cardX + padX, seekY, Math.max(seekH, seekW * pct), seekH, seekH / 2);
      ctx.fill();

      // Progress Knob
      const knobX = cardX + padX + seekW * pct;
      const knobR = Math.round(w * 0.012);
      ctx.save();
      ctx.fillStyle = seekFillColor;
      ctx.shadowColor = seekFillColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(knobX, seekY + seekH / 2, knobR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Timestamps
    const timeFontSz = Math.round(w * 0.026);
    ctx.font = isNothing ? `500 ${timeFontSz}px monospace` : `500 ${timeFontSz}px sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(fmt(t), cardX + padX, seekY + seekH + 6);

    ctx.textAlign = "right";
    ctx.fillText(fmt(duration), cardX + cardW - padX, seekY + seekH + 6);

    // Bottom Row: Controls (SkipBack, Play/Pause circle, SkipForward)
    const btnCenterY = seekY + seekH + timeFontSz + Math.round(h * 0.036);
    const centerX = cardX + cardW / 2;
    const btnSpacing = Math.round(w * 0.22);
    const playRadius = Math.round(w * 0.065);

    // SkipBack
    drawSkipBack(ctx, centerX - btnSpacing, btnCenterY, Math.round(w * 0.06), "rgba(255, 255, 255, 0.80)");

    // Center Play/Pause button
    ctx.save();
    if (isNothing) {
      ctx.fillStyle = "#000000";
      ctx.strokeStyle = "#D71920";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "rgba(215, 25, 32, 0.4)";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(centerX, btnCenterY, playRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      drawPauseIcon(ctx, centerX, btnCenterY, Math.round(w * 0.055), "#FFFFFF");
    } else {
      ctx.fillStyle = isRetro ? "#FBBF24" : (style.highlight || "#FFFFFF");
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(centerX, btnCenterY, playRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawPauseIcon(ctx, centerX, btnCenterY, Math.round(w * 0.055), isRetro ? "#000000" : "#000000");
    }

    // SkipForward
    drawSkipForward(ctx, centerX + btnSpacing, btnCenterY, Math.round(w * 0.06), "rgba(255, 255, 255, 0.80)");

    ctx.restore();
  }

  ctx.restore();
}
