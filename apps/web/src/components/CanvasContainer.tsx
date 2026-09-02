import { useEffect, useRef } from 'react';
import type { Scene, SceneObject } from '@manga-drama/types';
import { Renderer } from '@manga-drama/renderer';
import { TimelineEngine, evaluateTrackValue } from '@manga-drama/timeline';
import { useSceneStore } from '../stores/sceneStore';
import { usePlaybackStore } from '../stores/playbackStore';

export default function CanvasContainer() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const engineRef = useRef<TimelineEngine | null>(null);
  const scene = useSceneStore((state) => state.scene);
  const sceneRef = useRef(scene);
  const assets = useSceneStore((state) => state.assets);
  const selectedIds = useSceneStore((state) => state.selectedIds);
  const updateObjectPosition = useSceneStore((state) => state.updateObjectPosition);
  const updateCamera = useSceneStore((state) => state.updateCamera);
  const selectObject = useSceneStore((state) => state.selectObject);
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const currentTime = usePlaybackStore((state) => state.currentTime);
  const setIsPlaying = usePlaybackStore((state) => state.setIsPlaying);
  const setCurrentTime = usePlaybackStore((state) => state.setCurrentTime);

  sceneRef.current = scene;

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

      engineRef.current = new TimelineEngine({
        duration: snapshot.scene.duration,
        onTick: ({ time }) => {
          const runtimeScene = createRuntimeScene(sceneRef.current, time);
          renderer.applyRuntimeScene(runtimeScene);
          setCurrentTime(time);
        },
        onStateChange: (nextPlaying) => {
          setIsPlaying(nextPlaying);
        }
      });
    })();

    return () => {
      cancelled = true;
      engineRef.current?.stop();
      engineRef.current = null;
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [selectObject, setCurrentTime, setIsPlaying, updateCamera, updateObjectPosition]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) {
      return;
    }

    renderer.sync({ scene, assets, selectedIds });
  }, [assets, scene, selectedIds]);

  useEffect(() => {
    const engine = engineRef.current;
    const renderer = rendererRef.current;
    if (!engine || !renderer) {
      return;
    }

    if (isPlaying) {
      engine.play(currentTime);
      return;
    }

    engine.pause();
    const runtimeScene = createRuntimeScene(scene, currentTime);
    renderer.applyRuntimeScene(runtimeScene);
  }, [currentTime, isPlaying, scene]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 640, background: '#020617' }} />;
}

function createRuntimeScene(scene: Scene, time: number): Scene {
  const nextObjects = scene.objects.map((object) => applyTrackToObject(object, scene, time));
  return {
    ...scene,
    objects: nextObjects
  };
}

function applyTrackToObject(object: SceneObject, scene: Scene, time: number): SceneObject {
  const track = scene.animationTracks.find((entry) => entry.type === 'object' && entry.targetId === object.id);
  if (!track) {
    return object;
  }

  const nextTransform = { ...object.transform };
  const x = evaluateTrackValue(track, 'x', time);
  const y = evaluateTrackValue(track, 'y', time);
  const scaleX = evaluateTrackValue(track, 'scaleX', time);
  const scaleY = evaluateTrackValue(track, 'scaleY', time);
  const rotation = evaluateTrackValue(track, 'rotation', time);
  const opacity = evaluateTrackValue(track, 'opacity', time);

  if (x !== null) {
    nextTransform.x = x;
  }
  if (y !== null) {
    nextTransform.y = y;
  }
  if (scaleX !== null) {
    nextTransform.scaleX = scaleX;
  }
  if (scaleY !== null) {
    nextTransform.scaleY = scaleY;
  }
  if (rotation !== null) {
    nextTransform.rotation = rotation;
  }

  return {
    ...object,
    transform: nextTransform,
    opacity: opacity ?? object.opacity
  };
}
