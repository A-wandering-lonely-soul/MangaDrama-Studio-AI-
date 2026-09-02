import { useEffect, useRef } from 'react';
import { Renderer } from '@manga-drama/renderer';
import { useSceneStore } from '../stores/sceneStore';

export default function CanvasContainer() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const scene = useSceneStore((state) => state.scene);
  const assets = useSceneStore((state) => state.assets);
  const selectedIds = useSceneStore((state) => state.selectedIds);
  const updateObjectPosition = useSceneStore((state) => state.updateObjectPosition);
  const updateCamera = useSceneStore((state) => state.updateCamera);
  const selectObject = useSceneStore((state) => state.selectObject);

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
      renderer.setSelectionChangeHandler(({ objectId, append }) => {
        selectObject(objectId, append);
      });
      const snapshot = useSceneStore.getState();
      renderer.sync({ scene: snapshot.scene, assets: snapshot.assets, selectedIds: snapshot.selectedIds });
    })();

    return () => {
      cancelled = true;
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [selectObject, updateCamera, updateObjectPosition]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) {
      return;
    }

    renderer.sync({ scene, assets, selectedIds });
  }, [assets, scene, selectedIds]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 640, background: '#020617' }} />;
}
