export interface Transform {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  anchorX: number;
  anchorY: number;
}

export type SceneObjectType =
  | 'background'
  | 'character'
  | 'prop'
  | 'text'
  | 'image'
  | 'video'
  | 'effect';

export interface SceneObject {
  id: string;
  type: SceneObjectType;
  name: string;
  assetId?: string;
  transform: Transform;
  opacity: number;
  visible: boolean;
  locked: boolean;
  zIndex: number;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
}

export interface AudioTrack {
  id: string;
  assetId: string;
  startTime: number;
  duration: number;
  volume: number;
  loop: boolean;
}

export interface SubtitleTrack {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface Keyframe {
  id: string;
  time: number;
  property: 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotation' | 'opacity';
  value: number;
}

export interface TimelineTrack {
  id: string;
  type: 'camera' | 'object' | 'subtitle' | 'audio' | 'effect';
  targetId?: string;
  keyframes?: Keyframe[];
}

export interface Scene {
  id: string;
  name: string;
  width: number;
  height: number;
  duration: number;
  camera: Camera;
  objects: SceneObject[];
  audioTracks: AudioTrack[];
  subtitleTracks: SubtitleTrack[];
  animationTracks: TimelineTrack[];
}

export interface Episode {
  id: string;
  title: string;
  scenes: Scene[];
}

export interface Project {
  id: string;
  name: string;
  version: string;
  createdAt: number;
  updatedAt: number;
  episodes: Episode[];
}

export interface Asset {
  id: string;
  type: 'image' | 'character' | 'background' | 'prop' | 'audio' | 'video' | 'effect';
  name: string;
  url: string;
  width?: number;
  height?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}
