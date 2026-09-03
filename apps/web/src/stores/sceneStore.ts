import { create } from 'zustand';
import type { Asset, Camera, Scene, SceneObject } from '@manga-drama/types';

export type PositionAnimationPreset = 'right-drift' | 'left-drift' | 'rise' | 'fall' | 'arc';
export type CameraAnimationPreset = 'push-in' | 'pull-out' | 'pan-left' | 'pan-right' | 'follow-selected';

interface SceneState {
  scene: Scene;
  assets: Asset[];
  selectedIds: string[];
  clipboard: SceneObject[];
  hydrate: (scene: Scene, assets: Asset[]) => void;
  addAsset: (asset: Asset) => void;
  replaceAsset: (asset: Asset) => void;
  removeAsset: (assetId: string) => void;
  addObject: (object: SceneObject) => void;
  selectObject: (objectId: string, append?: boolean) => void;
  clearSelection: () => void;
  removeSelectedObjects: () => void;
  duplicateSelectedObjects: () => void;
  copySelection: () => void;
  pasteSelection: () => void;
  bringToFront: () => void;
  sendToBack: () => void;
  moveLayerUp: () => void;
  moveLayerDown: () => void;
  updateObjectPosition: (objectId: string, x: number, y: number) => void;
  updateObjectTransform: (objectId: string, payload: Partial<SceneObject['transform']>) => void;
  addPositionKeyframesForSelection: (preset?: PositionAnimationPreset) => void;
  addCameraZoomKeyframes: (preset?: CameraAnimationPreset) => void;
  addDemoSubtitleTracks: () => void;
  addAudioTrackForAsset: (assetId: string, duration?: number) => void;
  clearAnimationTracks: () => void;
  updateCamera: (camera: Camera) => void;
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

const initialScene: Scene = {
  id: 'scene-001',
  name: '雨夜场景',
  width: 1080,
  height: 1920,
  duration: 10,
  camera: {
    x: 540,
    y: 960,
    zoom: 0.5,
    rotation: 0
  },
  objects: [],
  audioTracks: [],
  subtitleTracks: [],
  animationTracks: []
};

export const useSceneStore = create<SceneState>((set) => ({
  scene: initialScene,
  assets: [],
  selectedIds: [],
  clipboard: [],
  hydrate: (scene, assets) =>
    set({
      scene,
      assets,
      selectedIds: [],
      clipboard: []
    }),
  addAsset: (asset) =>
    set((state) => ({
      assets: [...state.assets, asset]
    })),
  replaceAsset: (asset) =>
    set((state) => ({
      assets: state.assets.map((item) => (item.id === asset.id ? asset : item))
    })),
  removeAsset: (assetId) =>
    set((state) => {
      const removedObjectIds = new Set(
        state.scene.objects.filter((object) => object.assetId === assetId).map((object) => object.id)
      );

      return {
        assets: state.assets.filter((asset) => asset.id !== assetId),
        selectedIds: state.selectedIds.filter((objectId) => !removedObjectIds.has(objectId)),
        clipboard: state.clipboard.filter((object) => object.assetId !== assetId),
        scene: {
          ...state.scene,
          objects: state.scene.objects.filter((object) => object.assetId !== assetId),
          audioTracks: state.scene.audioTracks.filter((track) => track.assetId !== assetId),
          animationTracks: state.scene.animationTracks.filter(
            (track) => !track.targetId || !removedObjectIds.has(track.targetId)
          )
        }
      };
    }),
  addObject: (object) =>
    set((state) => {
      const maxZ = state.scene.objects.reduce((max, item) => Math.max(max, item.zIndex), 0);
      return {
        scene: {
          ...state.scene,
          objects: [
            ...state.scene.objects,
            {
              ...object,
              zIndex: maxZ + 1
            }
          ]
        }
      };
    }),
  selectObject: (objectId, append = false) =>
    set((state) => {
      if (!objectId) {
        return { selectedIds: [] };
      }

      if (!append) {
        return { selectedIds: [objectId] };
      }

      const selected = new Set(state.selectedIds);
      if (selected.has(objectId)) {
        selected.delete(objectId);
      } else {
        selected.add(objectId);
      }

      return { selectedIds: Array.from(selected) };
    }),
  clearSelection: () => set({ selectedIds: [] }),
  removeSelectedObjects: () =>
    set((state) => {
      const selected = new Set(state.selectedIds);
      if (selected.size === 0) {
        return state;
      }

      return {
        scene: {
          ...state.scene,
          objects: state.scene.objects.filter((object) => !selected.has(object.id))
        },
        selectedIds: []
      };
    }),
  duplicateSelectedObjects: () =>
    set((state) => {
      if (state.selectedIds.length === 0) {
        return state;
      }

      const selected = new Set(state.selectedIds);
      const maxZ = state.scene.objects.reduce((max, object) => Math.max(max, object.zIndex), 0);

      const duplicates = state.scene.objects
        .filter((object) => selected.has(object.id))
        .map((object, index) => ({
          ...object,
          id: createId('object'),
          name: `${object.name} 副本`,
          transform: {
            ...object.transform,
            x: object.transform.x + 40,
            y: object.transform.y + 40
          },
          zIndex: maxZ + (index + 1)
        }));

      return {
        scene: {
          ...state.scene,
          objects: [...state.scene.objects, ...duplicates]
        },
        selectedIds: duplicates.map((item) => item.id)
      };
    }),
  copySelection: () =>
    set((state) => {
      const selected = new Set(state.selectedIds);
      return {
        clipboard: state.scene.objects
          .filter((object) => selected.has(object.id))
          .map((object) => ({
            ...object,
            transform: { ...object.transform }
          }))
      };
    }),
  pasteSelection: () =>
    set((state) => {
      if (state.clipboard.length === 0) {
        return state;
      }

      const maxZ = state.scene.objects.reduce((max, object) => Math.max(max, object.zIndex), 0);
      const pasted = state.clipboard.map((object, index) => ({
        ...object,
        id: createId('object'),
        name: `${object.name} 粘贴`,
        transform: {
          ...object.transform,
          x: object.transform.x + 50,
          y: object.transform.y + 50
        },
        zIndex: maxZ + (index + 1)
      }));

      return {
        scene: {
          ...state.scene,
          objects: [...state.scene.objects, ...pasted]
        },
        selectedIds: pasted.map((item) => item.id)
      };
    }),
  bringToFront: () =>
    set((state) => {
      if (state.selectedIds.length === 0) {
        return state;
      }

      const selected = new Set(state.selectedIds);
      const maxZ = state.scene.objects.reduce((max, object) => Math.max(max, object.zIndex), 0);
      let step = 1;
      return {
        scene: {
          ...state.scene,
          objects: state.scene.objects.map((object) => {
            if (!selected.has(object.id)) {
              return object;
            }

            const next = {
              ...object,
              zIndex: maxZ + step
            };
            step += 1;
            return next;
          })
        }
      };
    }),
  sendToBack: () =>
    set((state) => {
      if (state.selectedIds.length === 0) {
        return state;
      }

      const selected = new Set(state.selectedIds);
      const minZ = state.scene.objects.reduce((min, object) => Math.min(min, object.zIndex), 0);
      let step = 1;
      return {
        scene: {
          ...state.scene,
          objects: state.scene.objects.map((object) => {
            if (!selected.has(object.id)) {
              return object;
            }

            const next = {
              ...object,
              zIndex: minZ - step
            };
            step += 1;
            return next;
          })
        }
      };
    }),
  moveLayerUp: () =>
    set((state) => {
      if (state.selectedIds.length !== 1) {
        return state;
      }

      const targetId = state.selectedIds[0];
      const sorted = sortObjectsByLayer(state.scene.objects);
      const index = sorted.findIndex((item) => item.id === targetId);
      if (index < 0 || index === sorted.length - 1) {
        return state;
      }

      const nextOrder = [...sorted];
      const current = nextOrder[index];
      const next = nextOrder[index + 1];
      nextOrder[index] = next;
      nextOrder[index + 1] = current;
      const zById = makeSequentialZIndexMap(nextOrder);

      return {
        scene: {
          ...state.scene,
          objects: state.scene.objects.map((object) => {
            const nextZ = zById.get(object.id);
            return nextZ === undefined ? object : { ...object, zIndex: nextZ };
          })
        }
      };
    }),
  moveLayerDown: () =>
    set((state) => {
      if (state.selectedIds.length !== 1) {
        return state;
      }

      const targetId = state.selectedIds[0];
      const sorted = sortObjectsByLayer(state.scene.objects);
      const index = sorted.findIndex((item) => item.id === targetId);
      if (index <= 0) {
        return state;
      }

      const nextOrder = [...sorted];
      const current = nextOrder[index];
      const prev = nextOrder[index - 1];
      nextOrder[index] = prev;
      nextOrder[index - 1] = current;
      const zById = makeSequentialZIndexMap(nextOrder);

      return {
        scene: {
          ...state.scene,
          objects: state.scene.objects.map((object) => {
            const nextZ = zById.get(object.id);
            return nextZ === undefined ? object : { ...object, zIndex: nextZ };
          })
        }
      };
    }),
  updateObjectPosition: (objectId, x, y) =>
    set((state) => {
      const target = state.scene.objects.find((object) => object.id === objectId);
      if (!target) {
        return state;
      }

      const deltaX = x - target.transform.x;
      const deltaY = y - target.transform.y;

      return {
        scene: {
          ...state.scene,
          objects: state.scene.objects.map((object) =>
            object.id === objectId
              ? {
                  ...object,
                  transform: {
                    ...object.transform,
                    x,
                    y
                  }
                }
              : object
          ),
          animationTracks: state.scene.animationTracks.map((track) => {
            if (track.type !== 'object' || track.targetId !== objectId || !track.keyframes) {
              return track;
            }

            return {
              ...track,
              keyframes: track.keyframes.map((keyframe) => {
                if (keyframe.property === 'x') {
                  return {
                    ...keyframe,
                    value: keyframe.value + deltaX
                  };
                }

                if (keyframe.property === 'y') {
                  return {
                    ...keyframe,
                    value: keyframe.value + deltaY
                  };
                }

                return keyframe;
              })
            };
          })
        }
      };
    }),
  updateObjectTransform: (objectId, payload) =>
    set((state) => ({
      scene: {
        ...state.scene,
        objects: state.scene.objects.map((object) =>
          object.id === objectId
            ? {
                ...object,
                transform: {
                  ...object.transform,
                  ...payload
                }
              }
            : object
        )
      }
    })),
  addPositionKeyframesForSelection: (preset = 'right-drift') =>
    set((state) => {
      if (state.selectedIds.length !== 1) {
        return state;
      }

      const targetId = state.selectedIds[0];
      const target = state.scene.objects.find((object) => object.id === targetId);
      if (!target) {
        return state;
      }

      const keyframes = buildObjectMotionKeyframes(state.scene, target, preset);

      const trackId = createId('track');
      const nextTracks = state.scene.animationTracks.filter((track) => track.targetId !== targetId);
      nextTracks.push({
        id: trackId,
        type: 'object',
        targetId,
        keyframes
      });

      return {
        scene: {
          ...state.scene,
          animationTracks: nextTracks
        }
      };
    }),
  addCameraZoomKeyframes: (preset = 'push-in') =>
    set((state) => {
      const camera = state.scene.camera;
      const focusObject =
        state.selectedIds.length === 1
          ? state.scene.objects.find((object) => object.id === state.selectedIds[0])
          : null;
      const keyframes = buildCameraMotionKeyframes(state.scene, camera, preset, focusObject ?? undefined);

      const nextTracks = state.scene.animationTracks.filter((track) => track.type !== 'camera');
      nextTracks.push({
        id: createId('track'),
        type: 'camera',
        keyframes
      });

      return {
        scene: {
          ...state.scene,
          animationTracks: nextTracks
        }
      };
    }),
  addDemoSubtitleTracks: () =>
    set((state) => ({
      scene: {
        ...state.scene,
        subtitleTracks: [
          {
            id: createId('subtitle'),
            startTime: 0.5,
            endTime: 2.2,
            text: '你终于来了……'
          },
          {
            id: createId('subtitle'),
            startTime: 2.6,
            endTime: 4.4,
            text: '雨夜里的一切，才刚开始。'
          }
        ]
      }
    })),
  addAudioTrackForAsset: (assetId, duration = 8) =>
    set((state) => ({
      scene: {
        ...state.scene,
        audioTracks: [
          ...state.scene.audioTracks,
          {
            id: createId('audio'),
            assetId,
            startTime: 0,
            duration,
            volume: 0.9,
            loop: false
          }
        ]
      }
    })),
  clearAnimationTracks: () =>
    set((state) => ({
      scene: {
        ...state.scene,
        animationTracks: []
      }
    })),
  updateCamera: (camera) =>
    set((state) => ({
      scene: {
        ...state.scene,
        camera
      }
    }))
}));

function sortObjectsByLayer(objects: SceneObject[]): SceneObject[] {
  return [...objects]
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      if (left.item.zIndex !== right.item.zIndex) {
        return left.item.zIndex - right.item.zIndex;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.item);
}

function makeSequentialZIndexMap(ordered: SceneObject[]): Map<string, number> {
  const base = 100;
  const step = 10;
  const map = new Map<string, number>();
  ordered.forEach((object, index) => {
    map.set(object.id, base + index * step);
  });

  return map;
}

export function buildObjectMotionKeyframes(
  scene: Scene,
  target: SceneObject,
  preset: PositionAnimationPreset
): Array<{ id: string; time: number; property: 'x' | 'y'; value: number }> {
  const travelX = Math.min(360, Math.max(140, scene.width * 0.18));
  const travelY = Math.min(260, Math.max(120, scene.height * 0.1));
  const waveY = Math.min(140, Math.max(60, scene.height * 0.05));

  if (preset === 'left-drift') {
    return [
      { id: createId('kf'), time: 0, property: 'x', value: target.transform.x },
      { id: createId('kf'), time: 1.2, property: 'x', value: target.transform.x - travelX * 0.45 },
      { id: createId('kf'), time: 2.4, property: 'x', value: target.transform.x - travelX * 0.85 },
      { id: createId('kf'), time: 3.6, property: 'x', value: target.transform.x - travelX },
      { id: createId('kf'), time: 0, property: 'y', value: target.transform.y },
      { id: createId('kf'), time: 1.2, property: 'y', value: target.transform.y - waveY * 0.45 },
      { id: createId('kf'), time: 2.4, property: 'y', value: target.transform.y + waveY * 0.2 },
      { id: createId('kf'), time: 3.6, property: 'y', value: target.transform.y }
    ];
  }

  if (preset === 'rise') {
    return [
      { id: createId('kf'), time: 0, property: 'x', value: target.transform.x },
      { id: createId('kf'), time: 1.8, property: 'x', value: target.transform.x + travelX * 0.1 },
      { id: createId('kf'), time: 3.6, property: 'x', value: target.transform.x },
      { id: createId('kf'), time: 0, property: 'y', value: target.transform.y },
      { id: createId('kf'), time: 1.8, property: 'y', value: target.transform.y - travelY * 0.65 },
      { id: createId('kf'), time: 3.6, property: 'y', value: target.transform.y - travelY }
    ];
  }

  if (preset === 'fall') {
    return [
      { id: createId('kf'), time: 0, property: 'x', value: target.transform.x },
      { id: createId('kf'), time: 1.8, property: 'x', value: target.transform.x - travelX * 0.1 },
      { id: createId('kf'), time: 3.6, property: 'x', value: target.transform.x },
      { id: createId('kf'), time: 0, property: 'y', value: target.transform.y },
      { id: createId('kf'), time: 1.8, property: 'y', value: target.transform.y + travelY * 0.65 },
      { id: createId('kf'), time: 3.6, property: 'y', value: target.transform.y + travelY }
    ];
  }

  if (preset === 'arc') {
    return [
      { id: createId('kf'), time: 0, property: 'x', value: target.transform.x },
      { id: createId('kf'), time: 1.2, property: 'x', value: target.transform.x + travelX * 0.4 },
      { id: createId('kf'), time: 2.4, property: 'x', value: target.transform.x + travelX * 0.8 },
      { id: createId('kf'), time: 3.6, property: 'x', value: target.transform.x + travelX },
      { id: createId('kf'), time: 0, property: 'y', value: target.transform.y },
      { id: createId('kf'), time: 1.2, property: 'y', value: target.transform.y - travelY * 0.55 },
      { id: createId('kf'), time: 2.4, property: 'y', value: target.transform.y - travelY * 0.2 },
      { id: createId('kf'), time: 3.6, property: 'y', value: target.transform.y }
    ];
  }

  return [
    { id: createId('kf'), time: 0, property: 'x', value: target.transform.x },
    { id: createId('kf'), time: 1.2, property: 'x', value: target.transform.x + travelX * 0.45 },
    { id: createId('kf'), time: 2.4, property: 'x', value: target.transform.x + travelX * 0.85 },
    { id: createId('kf'), time: 3.6, property: 'x', value: target.transform.x + travelX },
    { id: createId('kf'), time: 0, property: 'y', value: target.transform.y },
    { id: createId('kf'), time: 1.2, property: 'y', value: target.transform.y - waveY },
    { id: createId('kf'), time: 2.4, property: 'y', value: target.transform.y + waveY * 0.42 },
    { id: createId('kf'), time: 3.6, property: 'y', value: target.transform.y }
  ];
}

export function buildCameraMotionKeyframes(
  scene: Scene,
  camera: Camera,
  preset: CameraAnimationPreset,
  focusObject?: SceneObject
): Array<{ id: string; time: number; property: 'x' | 'y' | 'zoom'; value: number }> {
  const targetX = focusObject?.transform.x ?? camera.x + scene.width * 0.06;
  const targetY = focusObject?.transform.y ?? camera.y - scene.height * 0.04;
  const followPanX = (targetX - camera.x) * 0.7;
  const followPanY = (targetY - camera.y) * 0.7;
  const basePanX = Math.max(120, scene.width * 0.12);

  if (preset === 'pull-out') {
    return [
      { id: createId('kf'), time: 0, property: 'zoom', value: camera.zoom },
      { id: createId('kf'), time: 1.2, property: 'zoom', value: Math.max(0.2, camera.zoom - 0.12) },
      { id: createId('kf'), time: 2.8, property: 'zoom', value: Math.max(0.2, camera.zoom - 0.22) },
      { id: createId('kf'), time: 0, property: 'x', value: camera.x },
      { id: createId('kf'), time: 2.8, property: 'x', value: camera.x - followPanX * 0.4 },
      { id: createId('kf'), time: 0, property: 'y', value: camera.y },
      { id: createId('kf'), time: 2.8, property: 'y', value: camera.y - followPanY * 0.4 }
    ];
  }

  if (preset === 'pan-left') {
    return [
      { id: createId('kf'), time: 0, property: 'zoom', value: camera.zoom },
      { id: createId('kf'), time: 2.8, property: 'zoom', value: camera.zoom },
      { id: createId('kf'), time: 0, property: 'x', value: camera.x },
      { id: createId('kf'), time: 2.8, property: 'x', value: camera.x - basePanX },
      { id: createId('kf'), time: 0, property: 'y', value: camera.y },
      { id: createId('kf'), time: 2.8, property: 'y', value: camera.y }
    ];
  }

  if (preset === 'pan-right') {
    return [
      { id: createId('kf'), time: 0, property: 'zoom', value: camera.zoom },
      { id: createId('kf'), time: 2.8, property: 'zoom', value: camera.zoom },
      { id: createId('kf'), time: 0, property: 'x', value: camera.x },
      { id: createId('kf'), time: 2.8, property: 'x', value: camera.x + basePanX },
      { id: createId('kf'), time: 0, property: 'y', value: camera.y },
      { id: createId('kf'), time: 2.8, property: 'y', value: camera.y }
    ];
  }

  if (preset === 'follow-selected') {
    return [
      { id: createId('kf'), time: 0, property: 'zoom', value: camera.zoom },
      { id: createId('kf'), time: 1.2, property: 'zoom', value: Math.min(2.5, camera.zoom + 0.12) },
      { id: createId('kf'), time: 2.8, property: 'zoom', value: Math.min(3, camera.zoom + 0.22) },
      { id: createId('kf'), time: 0, property: 'x', value: camera.x },
      { id: createId('kf'), time: 1.2, property: 'x', value: camera.x + followPanX * 0.6 },
      { id: createId('kf'), time: 2.8, property: 'x', value: camera.x + followPanX },
      { id: createId('kf'), time: 0, property: 'y', value: camera.y },
      { id: createId('kf'), time: 1.2, property: 'y', value: camera.y + followPanY * 0.6 },
      { id: createId('kf'), time: 2.8, property: 'y', value: camera.y + followPanY }
    ];
  }

  return [
    { id: createId('kf'), time: 0, property: 'zoom', value: camera.zoom },
    { id: createId('kf'), time: 1.2, property: 'zoom', value: Math.min(2.5, camera.zoom + 0.2) },
    { id: createId('kf'), time: 2.8, property: 'zoom', value: Math.min(3, camera.zoom + 0.35) },
    { id: createId('kf'), time: 0, property: 'x', value: camera.x },
    { id: createId('kf'), time: 1.2, property: 'x', value: camera.x + followPanX * 0.6 },
    { id: createId('kf'), time: 2.8, property: 'x', value: camera.x + followPanX },
    { id: createId('kf'), time: 0, property: 'y', value: camera.y },
    { id: createId('kf'), time: 1.2, property: 'y', value: camera.y + followPanY * 0.6 },
    { id: createId('kf'), time: 2.8, property: 'y', value: camera.y + followPanY }
  ];
}

export function createDemoAsset(): Asset {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#22d3ee" />
          <stop offset="100%" stop-color="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect width="640" height="640" rx="48" fill="url(#bg)" />
      <circle cx="320" cy="220" r="120" fill="#fde68a" opacity="0.9" />
      <rect x="180" y="310" width="280" height="220" rx="110" fill="#f8fafc" opacity="0.9" />
      <rect x="255" y="410" width="130" height="200" rx="24" fill="#0f172a" opacity="0.75" />
    </svg>
  `;

  return {
    id: createId('asset'),
    type: 'image',
    name: 'Demo Character',
    url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`,
    width: 640,
    height: 640
  };
}

export function createSceneObjectFromAsset(asset: Asset): SceneObject {
  return {
    id: createId('object'),
    type: 'character',
    name: asset.name,
    assetId: asset.id,
    transform: {
      x: initialScene.camera.x,
      y: initialScene.camera.y,
      width: 320,
      height: 320,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      anchorX: 0.5,
      anchorY: 0.5
    },
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 300
  };
}
