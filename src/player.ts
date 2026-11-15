import { useCallback, useEffect, useRef, useState } from "react";
import { activeIndex, type Line } from "./data";

export function usePlayer(
  duration: number,
  lines: Line[],
  initialTime = 0,
  audioUrl?: string,
  onDurationChange?: (dur: number) => void,
) {
  const [time, setTime] = useState(initialTime);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const timeRef = useRef(time);
  timeRef.current = time;
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Manage HTMLAudioElement lifecycle when audioUrl changes
  useEffect(() => {
    if (!audioUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      return;
    }

    const audio = new Audio(audioUrl);
    audio.volume = volume;
    audio.playbackRate = playbackRate;
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      if (
        audio.duration &&
        !isNaN(audio.duration) &&
        isFinite(audio.duration) &&
        audio.duration > 0
      ) {
        onDurationChange?.(audio.duration);
      }
    };

    const onEnded = () => {
      setPlaying(false);
      setTime(0);
      if (audioRef.current) audioRef.current.currentTime = 0;
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    if (audio.readyState >= 1 && audio.duration) {
      onDurationChange?.(audio.duration);
    }

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      audio.src = "";
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
    };
  }, [audioUrl, onDurationChange]);

  // Play / Pause audio element in sync with playing state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      if (Math.abs(audio.currentTime - timeRef.current) > 0.15) {
        audio.currentTime = Math.min(duration, Math.max(0, timeRef.current));
      }
      audio.play().catch((err) => {
        console.warn("Audio playback error:", err);
        setPlaying(false);
      });
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [playing, duration]);

  // Playback loop (syncs with audio.currentTime when real audio is loaded, or fallback clock)
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        const cur = audio.currentTime;
        setTime(cur);
        if (cur >= duration) {
          setPlaying(false);
          setTime(0);
          return;
        }
      } else if (!audio) {
        const dt = (now - last) / 1000;
        last = now;
        setTime((t) => (t + dt >= duration ? 0 : t + dt));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration]);

  const seek = useCallback(
    (t: number) => {
      const target = Math.min(duration, Math.max(0, t));
      setTime(target);
      if (audioRef.current) {
        audioRef.current.currentTime = target;
      }
    },
    [duration],
  );

  const prev = useCallback(() => {
    const t = timeRef.current;
    const i = activeIndex(lines, t);
    if (i < 0) return seek(0);
    if (t - lines[i].start > 1.2) return seek(lines[i].start);
    seek(lines[Math.max(0, i - 1)].start);
  }, [lines, seek]);

  const next = useCallback(() => {
    const n = lines[activeIndex(lines, timeRef.current) + 1];
    if (n) seek(n.start);
  }, [lines, seek]);

  const toggle = useCallback(() => setPlaying((p) => !p), []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const clamped = Math.max(0.25, Math.min(3, rate));
    setPlaybackRateState(clamped);
    if (audioRef.current) {
      audioRef.current.playbackRate = clamped;
    }
  }, []);

  return {
    time,
    duration,
    playing,
    volume,
    playbackRate,
    setVolume,
    setPlaybackRate,
    setPlaying,
    toggle,
    seek,
    prev,
    next,
    hasAudio: Boolean(audioUrl),
  };
}

export type Player = ReturnType<typeof usePlayer>;
