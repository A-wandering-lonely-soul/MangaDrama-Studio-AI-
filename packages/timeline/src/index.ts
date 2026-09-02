import type { Keyframe, TimelineTrack } from '@manga-drama/types';

export interface TimelineTick {
  time: number;
  delta: number;
}

export interface TimelineEngineOptions {
  duration: number;
  onTick: (tick: TimelineTick) => void;
  onStateChange?: (isPlaying: boolean) => void;
}

export function interpolate(start: number, end: number, progress: number): number {
  const safeProgress = Math.min(1, Math.max(0, progress));
  return start + (end - start) * safeProgress;
}

export function evaluateTrackValue(track: TimelineTrack, property: Keyframe['property'], time: number): number | null {
  if (!track.keyframes || track.keyframes.length === 0) {
    return null;
  }

  const keyframes = track.keyframes
    .filter((keyframe) => keyframe.property === property)
    .sort((left, right) => left.time - right.time);

  if (keyframes.length === 0) {
    return null;
  }

  if (time <= keyframes[0].time) {
    return keyframes[0].value;
  }

  if (time >= keyframes[keyframes.length - 1].time) {
    return keyframes[keyframes.length - 1].value;
  }

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const start = keyframes[index];
    const end = keyframes[index + 1];
    if (time >= start.time && time <= end.time) {
      const progress = (time - start.time) / (end.time - start.time);
      return interpolate(start.value, end.value, progress);
    }
  }

  return null;
}

export class TimelineEngine {
  private readonly duration: number;
  private readonly onTick: (tick: TimelineTick) => void;
  private readonly onStateChange?: (isPlaying: boolean) => void;
  private rafId: number | null = null;
  private startPerf = 0;
  private startTime = 0;
  private currentTime = 0;

  constructor(options: TimelineEngineOptions) {
    this.duration = options.duration;
    this.onTick = options.onTick;
    this.onStateChange = options.onStateChange;
  }

  play(fromTime = this.currentTime): void {
    this.stopRaf();
    this.startTime = Math.max(0, Math.min(this.duration, fromTime));
    this.currentTime = this.startTime;
    this.startPerf = performance.now();
    this.onStateChange?.(true);

    const loop = () => {
      const now = performance.now();
      const elapsed = (now - this.startPerf) / 1000;
      const nextTime = Math.min(this.duration, this.startTime + elapsed);
      const delta = nextTime - this.currentTime;
      this.currentTime = nextTime;
      this.onTick({ time: nextTime, delta });

      if (nextTime >= this.duration) {
        this.stop();
        return;
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  pause(): void {
    this.stopRaf();
    this.onStateChange?.(false);
  }

  stop(): void {
    this.stopRaf();
    this.currentTime = 0;
    this.onTick({ time: 0, delta: 0 });
    this.onStateChange?.(false);
  }

  seek(time: number): void {
    this.currentTime = Math.max(0, Math.min(this.duration, time));
    this.onTick({ time: this.currentTime, delta: 0 });
  }

  getTime(): number {
    return this.currentTime;
  }

  private stopRaf(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
