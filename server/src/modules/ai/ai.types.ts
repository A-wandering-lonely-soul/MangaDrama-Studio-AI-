import type { Asset } from '@manga-drama/types';

export type AiTaskStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface StoryOutput {
  title: string;
  logline: string;
  episodes: Array<{
    title: string;
    scenes: Array<{
      name: string;
      summary: string;
      duration: number;
    }>;
  }>;
}

export interface StoryboardScene {
  description: string;
  duration: number;
  camera: {
    x: number;
    y: number;
    zoom: number;
    rotation: number;
  };
  characters: string[];
  background: string;
  dialogue?: string;
  mood?: string;
}

export interface StoryboardOutput {
  scenes: StoryboardScene[];
}

export interface AiImageTaskResult {
  asset: Asset;
}

export interface AiTaskResponse<T = unknown> {
  taskId: string;
  status: AiTaskStatus;
  result?: T;
  error?: string;
}

export interface PromptPayload {
  prompt?: string;
}

export interface StaticImageItem {
  name: string;
  url: string;
}

export type StaticAudioKind = 'audio' | 'lrc' | 'ncm';

export interface StaticAudioItem {
  name: string;
  url: string;
  kind: StaticAudioKind;
}
