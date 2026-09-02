import type { Asset, AudioTrack, Scene } from '@manga-drama/types';

interface ActiveSource {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

class AudioEngine {
  private context: AudioContext | null = null;
  private bufferCache = new Map<string, AudioBuffer>();
  private activeSources: ActiveSource[] = [];

  async prime(): Promise<void> {
    const context = this.getContext();
    if (context.state === 'suspended') {
      await context.resume();
    }
  }

  stop(): void {
    for (const item of this.activeSources) {
      try {
        item.source.stop();
      } catch {
        // ignore stop errors on already-ended sources
      }
      item.source.disconnect();
      item.gain.disconnect();
    }
    this.activeSources = [];
  }

  async play(scene: Scene, assets: Asset[], fromTime: number): Promise<void> {
    const context = this.getContext();
    if (context.state === 'suspended') {
      await context.resume();
    }

    this.stop();

    const tracks = scene.audioTracks.filter((track) => {
      const endTime = track.startTime + track.duration;
      return endTime > fromTime;
    });

    if (tracks.length === 0) {
      return;
    }

    for (const track of tracks) {
      const asset = assets.find((entry) => entry.id === track.assetId && entry.type === 'audio');
      if (!asset?.url) {
        continue;
      }

      const buffer = await this.loadBuffer(track, asset.url);
      if (!buffer) {
        continue;
      }

      this.scheduleTrack(context, track, buffer, fromTime);
    }
  }

  private getContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
    }

    return this.context;
  }

  private async loadBuffer(track: AudioTrack, url: string): Promise<AudioBuffer | null> {
    const cacheKey = `${track.assetId}:${url}`;
    const cached = this.bufferCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(url);
      const data = await response.arrayBuffer();
      const context = this.getContext();
      const decoded = await context.decodeAudioData(data.slice(0));
      this.bufferCache.set(cacheKey, decoded);
      return decoded;
    } catch {
      return null;
    }
  }

  private scheduleTrack(context: AudioContext, track: AudioTrack, buffer: AudioBuffer, fromTime: number): void {
    const trackEnd = track.startTime + track.duration;
    if (fromTime >= trackEnd) {
      return;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = track.loop;

    const gain = context.createGain();
    gain.gain.value = Math.max(0, Math.min(1, track.volume));
    source.connect(gain);
    gain.connect(context.destination);

    const offset = fromTime <= track.startTime ? 0 : fromTime - track.startTime;
    const delay = fromTime <= track.startTime ? track.startTime - fromTime : 0;
    const startAt = context.currentTime + delay;

    source.start(startAt, offset);

    if (!track.loop) {
      const remain = Math.max(0, track.duration - offset);
      source.stop(startAt + remain);
    }

    const active: ActiveSource = { source, gain };
    this.activeSources.push(active);

    source.onended = () => {
      this.activeSources = this.activeSources.filter((item) => item !== active);
      source.disconnect();
      gain.disconnect();
    };
  }
}

export const audioEngine = new AudioEngine();

export async function primeAudioContext(): Promise<void> {
  await audioEngine.prime();
}
