import type { Asset, Scene, SceneObject, TimelineTrack } from '@manga-drama/types';
import type { StoryboardOutput } from './mockAiService';

interface ConversionResult {
  scene: Scene;
  assets: Asset[];
}

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function makeSvgDataUrl(title: string, subtitle: string, baseColor: string, accentColor: string): string {
  const t = title.slice(0, 24).replace(/[<&>]/g, '');
  const s = subtitle.slice(0, 32).replace(/[<&>]/g, '');
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${baseColor}"/>
        <stop offset="100%" stop-color="${accentColor}"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1080" fill="url(#bg)"/>
    <rect x="80" y="690" width="920" height="260" rx="26" fill="rgba(2,6,23,0.62)"/>
    <text x="130" y="790" font-size="56" fill="#f8fafc" font-family="sans-serif">${t}</text>
    <text x="130" y="860" font-size="34" fill="#bfdbfe" font-family="sans-serif">${s}</text>
  </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

function createBackgroundAsset(description: string): Asset {
  return {
    id: makeId('asset'),
    type: 'background',
    name: 'AI 背景',
    url: makeSvgDataUrl('雨夜背景', description, '#0f172a', '#1d4ed8'),
    width: 1080,
    height: 1080
  };
}

function createCharacterAsset(name: string): Asset {
  return {
    id: makeId('asset'),
    type: 'character',
    name,
    url: makeSvgDataUrl(name, '角色素材', '#0ea5e9', '#0284c7'),
    width: 1080,
    height: 1080
  };
}

function createObjectFromAsset(asset: Asset, options: { x: number; y: number; w: number; h: number; z: number; type: SceneObject['type'] }): SceneObject {
  return {
    id: makeId('object'),
    type: options.type,
    name: asset.name,
    assetId: asset.id,
    transform: {
      x: options.x,
      y: options.y,
      width: options.w,
      height: options.h,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      anchorX: 0.5,
      anchorY: 0.5
    },
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: options.z
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeCamera(camera: { x: number; y: number; zoom: number; rotation: number }): {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
} {
  return {
    x: clamp(Number.isFinite(camera.x) ? camera.x : 540, 0, 1080),
    y: clamp(Number.isFinite(camera.y) ? camera.y : 960, 0, 1920),
    zoom: clamp(Number.isFinite(camera.zoom) ? camera.zoom : 0.6, 0.25, 2.5),
    rotation: clamp(Number.isFinite(camera.rotation) ? camera.rotation : 0, -Math.PI, Math.PI)
  };
}

export function storyboardToScene(storyboard: StoryboardOutput): ConversionResult {
  const scenes = storyboard.scenes;
  const totalDuration = scenes.reduce((sum, item) => sum + Math.max(1, item.duration), 0);

  const backgroundAsset = createBackgroundAsset(scenes[0]?.description ?? '雨夜街道');
  const characterNames = Array.from(new Set(scenes.flatMap((item) => item.characters))).slice(0, 3);
  const characterAssets = characterNames.map((name) => createCharacterAsset(name));
  const assets: Asset[] = [backgroundAsset, ...characterAssets];

  const objects: SceneObject[] = [];
  objects.push(
    createObjectFromAsset(backgroundAsset, {
      x: 540,
      y: 960,
      w: 1280,
      h: 1920,
      z: 100,
      type: 'background'
    })
  );

  characterAssets.forEach((asset, index) => {
    objects.push(
      createObjectFromAsset(asset, {
        x: 420 + index * 240,
        y: 1150,
        w: 360,
        h: 360,
        z: 300 + index * 10,
        type: 'character'
      })
    );
  });

  const subtitleTracks: Scene['subtitleTracks'] = [];
  const cameraTrack: TimelineTrack = {
    id: makeId('track'),
    type: 'camera',
    keyframes: []
  };

  let cursor = 0;
  for (const item of scenes) {
    const duration = Math.max(1, item.duration);
    const safeCamera = sanitizeCamera(item.camera);
    if (item.dialogue) {
      subtitleTracks.push({
        id: makeId('subtitle'),
        startTime: cursor,
        endTime: cursor + Math.min(duration, 2.8),
        text: item.dialogue
      });
    }

    cameraTrack.keyframes?.push(
      { id: makeId('kf'), time: cursor, property: 'x', value: safeCamera.x },
      { id: makeId('kf'), time: cursor, property: 'y', value: safeCamera.y },
      { id: makeId('kf'), time: cursor, property: 'zoom', value: safeCamera.zoom },
      { id: makeId('kf'), time: cursor, property: 'rotation', value: safeCamera.rotation }
    );

    cursor += duration;
  }

  if (scenes.length > 0) {
    const last = scenes[scenes.length - 1];
    const safeCamera = sanitizeCamera(last.camera);
    cameraTrack.keyframes?.push(
      { id: makeId('kf'), time: totalDuration, property: 'x', value: safeCamera.x },
      { id: makeId('kf'), time: totalDuration, property: 'y', value: safeCamera.y },
      { id: makeId('kf'), time: totalDuration, property: 'zoom', value: safeCamera.zoom },
      { id: makeId('kf'), time: totalDuration, property: 'rotation', value: safeCamera.rotation }
    );
  }

  const initialCamera = scenes[0] ? sanitizeCamera(scenes[0].camera) : { x: 540, y: 960, zoom: 0.55, rotation: 0 };

  const scene: Scene = {
    id: makeId('scene'),
    name: 'AI 自动编排场景',
    width: 1080,
    height: 1920,
    duration: Math.max(4, totalDuration),
    camera: initialCamera,
    objects,
    audioTracks: [],
    subtitleTracks,
    animationTracks: [cameraTrack]
  };

  return { scene, assets };
}
