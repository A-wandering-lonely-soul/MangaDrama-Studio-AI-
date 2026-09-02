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

interface InternalTask {
  status: AiTaskStatus;
  result?: AiImageTaskResult;
  error?: string;
}

const tasks = new Map<string, InternalTask>();

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function makeTaskId(): string {
  return `task-${crypto.randomUUID()}`;
}

function makeImageDataUrl(prompt: string): string {
  const safeText = prompt.slice(0, 34).replace(/[<&>]/g, '');
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0ea5e9"/>
        <stop offset="100%" stop-color="#1d4ed8"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1080" fill="url(#grad)"/>
    <circle cx="820" cy="230" r="160" fill="#f8fafc" opacity="0.35"/>
    <rect x="120" y="640" width="840" height="260" rx="28" fill="rgba(15,23,42,0.65)"/>
    <text x="160" y="740" font-size="52" fill="#f8fafc" font-family="sans-serif">AI 素材</text>
    <text x="160" y="810" font-size="34" fill="#bfdbfe" font-family="sans-serif">${safeText}</text>
  </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

export async function postAiStory(prompt: string): Promise<StoryOutput> {
  await wait(420);
  return {
    title: '雨夜',
    logline: prompt || '一个少年在雨夜遇见神秘女孩。',
    episodes: [
      {
        title: '第 1 集：雨夜相遇',
        scenes: [
          {
            name: '场景 01',
            summary: '雨夜街头，少年独自行走，霓虹灯倒映在路面。',
            duration: 4
          },
          {
            name: '场景 02',
            summary: '女孩从巷口出现，轻声说“你终于来了”。',
            duration: 4
          }
        ]
      }
    ]
  };
}

export async function postAiStoryboard(prompt: string): Promise<StoryboardOutput> {
  await wait(380);
  return {
    scenes: [
      {
        description: '雨夜城市全景，街道反光明显，远景先建立氛围。',
        duration: 3,
        camera: { x: 540, y: 960, zoom: 0.48, rotation: 0 },
        characters: ['少年'],
        background: '雨夜街道',
        mood: '神秘',
        dialogue: '今夜有些不寻常……'
      },
      {
        description: `角色中景推进，女孩出现在路灯下。${prompt ? `提示词：${prompt.slice(0, 20)}` : ''}`,
        duration: 3,
        camera: { x: 540, y: 960, zoom: 0.72, rotation: 0 },
        characters: ['少年', '女孩'],
        background: '路灯与巷口',
        mood: '紧张',
        dialogue: '你终于来了……'
      }
    ]
  };
}

export async function postAiImage(prompt: string): Promise<{ taskId: string }> {
  await wait(120);
  const taskId = makeTaskId();
  tasks.set(taskId, { status: 'PENDING' });

  window.setTimeout(() => {
    const task = tasks.get(taskId);
    if (!task) {
      return;
    }
    task.status = 'RUNNING';
    tasks.set(taskId, task);
  }, 700);

  window.setTimeout(() => {
    const task = tasks.get(taskId);
    if (!task) {
      return;
    }

    const asset: Asset = {
      id: `asset-${crypto.randomUUID()}`,
      type: 'image',
      name: `AI-${prompt.slice(0, 12) || '角色素材'}`,
      url: makeImageDataUrl(prompt || '雨夜漫剧角色'),
      width: 1080,
      height: 1080
    };

    task.status = 'SUCCEEDED';
    task.result = { asset };
    tasks.set(taskId, task);
  }, 2100);

  return { taskId };
}

export async function getAiTask(taskId: string): Promise<AiTaskResponse<AiImageTaskResult>> {
  await wait(80);
  const task = tasks.get(taskId);
  if (!task) {
    return {
      taskId,
      status: 'FAILED',
      error: '任务不存在或已过期'
    };
  }

  return {
    taskId,
    status: task.status,
    result: task.result,
    error: task.error
  };
}
