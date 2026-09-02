import type { Camera } from '@manga-drama/types';

export interface Point {
  x: number;
  y: number;
}

export function worldToScreen(point: Point, camera: Camera, viewport: Point): Point {
  const centerX = viewport.x / 2;
  const centerY = viewport.y / 2;
  const translatedX = (point.x - camera.x) * camera.zoom;
  const translatedY = (point.y - camera.y) * camera.zoom;

  return {
    x: centerX + translatedX,
    y: centerY + translatedY
  };
}

export function screenToWorld(point: Point, camera: Camera, viewport: Point): Point {
  const centerX = viewport.x / 2;
  const centerY = viewport.y / 2;

  return {
    x: (point.x - centerX) / camera.zoom + camera.x,
    y: (point.y - centerY) / camera.zoom + camera.y
  };
}
