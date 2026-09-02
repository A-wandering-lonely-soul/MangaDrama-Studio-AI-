import { create } from 'zustand';
import type { Asset, Camera, Scene, SceneObject } from '@manga-drama/types';

interface SceneState {
  scene: Scene;
  assets: Asset[];
  addAsset: (asset: Asset) => void;
  addObject: (object: SceneObject) => void;
  updateObjectPosition: (objectId: string, x: number, y: number) => void;
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
