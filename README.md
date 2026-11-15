# Lyriq (LRRG) — Lyrics Reel Maker 🎵✨

> Create stunning, beat-synced lyric videos and reels for Instagram Reels, YouTube Shorts, and TikTok with AI transcription and rich visual presets.

---

## 🌟 Overview

**Lyriq** is a web-based lyrics reel generator designed for creators, musicians, and video editors. Upload any audio track or song, automatically identify it or transcribe it with word-level AI precision, customize typography and motion styles (Spotify, Apple Music, Nothing OS Glyph, and more), and export high-resolution vertical videos (9:16) or subtitle files directly in your browser.

---

## ✨ Key Features

### 🎙️ Audio Recognition & AI Transcription
- **Groq Whisper-large-v3 AI**: Transcribe speech and vocals into word-by-word timestamps with ultra-fast latency.
- **AudD Music Recognition**: Identify songs and artists directly from audio fingerprints.
- **LRCLIB Integration**: Instant lookup of community-synced `.lrc` lyrics.
- **Flexible Fallbacks**: Import your own `.lrc` files or paste plain lyrics with smart auto-segmentation.

### ⚡ Real-Time Lyric Synchronization
- **Tap-to-Sync Engine**: Align line timestamps on the fly while listening to audio playback.
- **Word-Level Karaoke Timing**: Fine-tune word start and end timings for fluid karaoke highlights.
- **Smart Sentence Grouping**: Automatically handles phrasing, pauses, and custom line breaks.

### 🎨 Visual Styles & Presets
- **Iconic Visual Themes**:
  - **Spotify**: Sleek Spotify Sans layout with active line tracking.
  - **Apple Music**: Smooth fluid animations and modern typography.
  - **Nothing OS (Glyph / Dot Matrix)**: Distinctive dot-matrix font with live reactive glyph borders and glitch effects.
  - **Retro & Minimal**: Clean editorial aesthetics using Instrument Serif, Grotesk, Bebas Neue, Syne, and Geist.
- **Dynamic Backgrounds**:
  - Dynamic Material You tone-mapping and color palettes.
  - Curated gradient themes, live stage visuals, and dark velvet hues.
  - Upload custom background images or video loops.
- **Safe-Zone Overlays**: Preview in real-time with authentic Instagram Reels and YouTube Shorts UI overlays.

### 🎬 High-Quality Export
- **Vertical Video Export (9:16)**:
  - Resolutions: **720p (HD)**, **1080p (Full HD)**, and **4K (Ultra HD)**.
  - Framerates: **24 fps**, **30 fps**, and **60 fps**.
  - Direct canvas-based recording with audio track synchronization.
- **Subtitle & Data Export**:
  - `.srt` (SubRip Subtitle)
  - `.lrc` (Synced Lyrics)
  - `.vtt` (WebVTT)
  - `.json` (Full lyric and word timestamp data)

---

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/) with [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 6](https://vite.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Audio & Media**: Web Audio API, Canvas 2D Rendering, MediaRecorder API with `fix-webm-duration`
- **Backend / Edge**: Vercel Edge Serverless Functions for API proxies (Groq Whisper & AudD)

---

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v18 or higher) and `npm` or `pnpm` installed.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/LRRG.git
   cd LRRG
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   pnpm install
   ```

3. (Optional) Set up environment variables:
   Create a `.env` or `.env.local` file in the root directory for API integrations:
   ```env
   # Optional: For server-side default keys (Vercel deployment)
   GROQ_API_KEY=your_groq_api_key_here
   AUDD_API_TOKEN=your_audd_api_token_here
   ```
   > *Note: Users can also input their custom API keys directly within the app settings (stored securely in browser `localStorage`).*

### Development Server

Run the development server:

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to start creating lyric reels.

### Production Build

Build the project for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

---

## 📁 Project Structure

```text
├── api/
│   └── recognize.ts          # Vercel Edge function (Groq Whisper & AudD recognition)
├── public/                   # Static assets & fonts
├── src/
│   ├── components/           # UI components, TopBar, ReelPreview
│   │   └── lyrics/           # Lyrics containers, synchronizer, parser, Nothing live view
│   ├── screens/
│   │   ├── Landing.tsx       # Track upload & audio input screen
│   │   ├── Editor.tsx        # Lyrics editing & visual style controls
│   │   ├── Sync.tsx          # Real-time tap-to-sync & word timing interface
│   │   └── Export.tsx        # Video rendering & subtitle export screen
│   ├── services/
│   │   └── lyricsService.ts  # Client API handlers for Groq, AudD, and LRCLIB
│   ├── data.ts               # Types, fonts, default styles, background presets
│   ├── player.ts             # Audio player hook and synchronization state
│   ├── App.tsx               # Main routing & state coordinator
│   └── main.tsx              # Application entry point
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 📱 Keyboard Shortcuts & Navigation

- **Deep Links**: Navigate directly to specific screens during development or review using URL hashes:
  - `#editor`: Style & typography editor
  - `#sync`: Timing and word synchronizer
  - `#export`: Video export & download settings
- **Spacebar**: Play / Pause audio preview
- **Arrow Keys**: Scrub through track or adjust timestamps

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
