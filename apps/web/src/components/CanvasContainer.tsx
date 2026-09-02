import { useEffect, useRef } from 'react';
import { Renderer } from '@manga-drama/renderer';
import { useSceneStore } from '../stores/sceneStore';

export default function CanvasContainer() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const scene = useSceneStore((state) => state.scene);
  const assets = useSceneStore((state) => state.assets);
  const updateObjectPosition = useSceneStore((state) => state.updateObjectPosition);
  const updateCamera = useSceneStore((state) => state.updateCamera);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let cancelled = false;
    const renderer = new Renderer();
    rendererRef.current = renderer;

    void (async () => {
      await renderer.mount(container);
      if (cancelled) {
        renderer.destroy();
        return;
      }

      renderer.setObjectMoveHandler((objectId, nextPosition) => {
        updateObjectPosition(objectId, nextPosition.x, nextPosition.y);
      });
      renderer.setCameraChangeHandler((camera) => {
        updateCamera(camera);
      });
      renderer.sync({ scene, assets });
    })();

    return () => {
      cancelled = true;
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [updateCamera, updateObjectPosition]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) {
      return;
    }

    renderer.sync({ scene, assets });
  }, [assets, scene]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 640, background: '#020617' }} />;
}
