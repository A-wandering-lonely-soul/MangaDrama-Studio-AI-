import { useEffect } from 'react';
import type { Asset, Scene } from '@manga-drama/types';
import { useProjectStore } from '../stores/projectStore';

export function useAutoSave(scene: Scene, assets: Asset[]): void {
  const saveCurrent = useProjectStore((state) => state.saveCurrent);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void saveCurrent(scene, assets);
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [assets, saveCurrent, scene]);
}
