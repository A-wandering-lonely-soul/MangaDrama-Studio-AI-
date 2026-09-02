import { create } from 'zustand';
import type { Asset, Camera, Scene, SceneObject } from '@manga-drama/types';

interface SceneState {
  scene: Scene;
  assets: Asset[];
  selectedIds: string[];
  clipboard: SceneObject[];
  hydrate: (scene: Scene, assets: Asset[]) => void;
  addAsset: (asset: Asset) => void;
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
  addPositionKeyframesForSelection: () => void;
  addCameraZoomKeyframes: () => void;
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
  addObject: (object) =>
    set((state) => ({
      scene: {
        ...state.scene,
        objects: [...state.scene.objects, object]
      }
    })),
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
      const sorted = [...state.scene.objects].sort((a, b) => a.zIndex - b.zIndex);
      const index = sorted.findIndex((item) => item.id === targetId);
      if (index < 0 || index === sorted.length - 1) {
        return state;
      }

      const current = sorted[index];
      const next = sorted[index + 1];
      return {
        scene: {
          ...state.scene,
          objects: state.scene.objects.map((object) => {
            if (object.id === current.id) {
              return { ...object, zIndex: next.zIndex };
            }
            if (object.id === next.id) {
              return { ...object, zIndex: current.zIndex };
            }
            return object;
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
      const sorted = [...state.scene.objects].sort((a, b) => a.zIndex - b.zIndex);
      const index = sorted.findIndex((item) => item.id === targetId);
      if (index <= 0) {
        return state;
      }

      const current = sorted[index];
      const prev = sorted[index - 1];
      return {
        scene: {
          ...state.scene,
          objects: state.scene.objects.map((object) => {
            if (object.id === current.id) {
              return { ...object, zIndex: prev.zIndex };
            }
            if (object.id === prev.id) {
              return { ...object, zIndex: current.zIndex };
            }
            return object;
          })
        }
      };
    }),
  updateObjectPosition: (objectId, x, y) =>
    set((state) => ({
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
        )
      }
    })),
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
  addPositionKeyframesForSelection: () =>
    set((state) => {
      if (state.selectedIds.length !== 1) {
        return state;
      }

      const targetId = state.selectedIds[0];
      const target = state.scene.objects.find((object) => object.id === targetId);
      if (!target) {
        return state;
      }

      const keyframes = [
        { id: createId('kf'), time: 0, property: 'x' as const, value: target.transform.x },
        { id: createId('kf'), time: 1.5, property: 'x' as const, value: target.transform.x + 260 },
        { id: createId('kf'), time: 3, property: 'x' as const, value: target.transform.x + 520 }
      ];

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
  addCameraZoomKeyframes: () =>
    set((state) => {
      const camera = state.scene.camera;
      const keyframes = [
        { id: createId('kf'), time: 0, property: 'zoom' as const, value: camera.zoom },
        { id: createId('kf'), time: 1.5, property: 'zoom' as const, value: camera.zoom + 0.25 },
        { id: createId('kf'), time: 3, property: 'zoom' as const, value: camera.zoom + 0.5 }
      ];

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
