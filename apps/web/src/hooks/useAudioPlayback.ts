import { useEffect, useRef } from 'react';
import type { Asset, Scene } from '@manga-drama/types';
import { audioEngine } from '../audio/audioEngine';

export function useAudioPlayback(scene: Scene, assets: Asset[], isPlaying: boolean, currentTime: number): void {
  const previousPlaying = useRef(false);

  useEffect(() => {
    const wasPlaying = previousPlaying.current;
    previousPlaying.current = isPlaying;

    if (!wasPlaying && isPlaying) {
      void audioEngine.play(scene, assets, currentTime);
      return;
    }

    if (wasPlaying && !isPlaying) {
      audioEngine.stop();
    }
  }, [assets, currentTime, isPlaying, scene]);

  useEffect(() => {
    return () => {
      audioEngine.stop();
    };
  }, []);
}
