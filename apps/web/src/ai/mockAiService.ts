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

const AI_API_BASE = import.meta.env.VITE_AI_API_BASE_URL ?? 'http://localhost:3000/api/ai';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${AI_API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    throw new Error(`AI 请求失败: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function postAiStory(prompt: string): Promise<StoryOutput> {
  return requestJson<StoryOutput>('/story', {
    method: 'POST',
    body: JSON.stringify({ prompt })
  });
}

export async function postAiStoryboard(prompt: string): Promise<StoryboardOutput> {
  return requestJson<StoryboardOutput>('/storyboard', {
    method: 'POST',
    body: JSON.stringify({ prompt })
  });
}

export async function postAiImage(prompt: string): Promise<{ taskId: string }> {
  return requestJson<{ taskId: string }>('/image', {
    method: 'POST',
    body: JSON.stringify({ prompt })
  });
}

export async function getAiTask(taskId: string): Promise<AiTaskResponse<AiImageTaskResult>> {
  return requestJson<AiTaskResponse<AiImageTaskResult>>(`/tasks/${taskId}`);
}
