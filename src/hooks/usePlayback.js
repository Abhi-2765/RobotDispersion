import { useCallback, useEffect, useState } from "react";

export const PLAYBACK_SPEEDS = { slow: 1000, normal: 400, fast: 120 };

/**
 * Index-over-frames playback. Deterministic: the frames are precomputed, so
 * Previous, Next, Play, Pause and Reset only move the index.
 */
export function usePlayback(frameCount) {
  const last = frameCount - 1;
  const [index, setIndex] = useState(0);
  const [wantsToPlay, setWantsToPlay] = useState(false);
  const [speed, setSpeed] = useState(PLAYBACK_SPEEDS.normal);
  const isPlaying = wantsToPlay && index < last;

  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = window.setInterval(() => {
      setIndex((current) => Math.min(current + 1, last));
    }, speed);
    return () => window.clearInterval(timer);
  }, [isPlaying, speed, last]);

  const jump = useCallback(
    (target) => {
      setWantsToPlay(false);
      setIndex(Math.max(0, Math.min(target, last)));
    },
    [last]
  );

  return {
    index,
    isPlaying,
    speed,
    setSpeed,
    next: () => jump(index + 1),
    prev: () => jump(index - 1),
    jump,
    reset: () => jump(0),
    toggle: () => {
      if (isPlaying) {
        setWantsToPlay(false);
        return;
      }
      if (index >= last) setIndex(0);
      setWantsToPlay(true);
    },
    atStart: index === 0,
    atEnd: index >= last,
  };
}
