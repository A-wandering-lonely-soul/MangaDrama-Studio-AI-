import { Injectable } from '@nestjs/common';
import type { Asset } from '@manga-drama/types';
import type {
  AiImageTaskResult,
  AiTaskResponse,
  AiTaskStatus,
  StoryboardOutput,
  StoryOutput
} from './ai.types';

interface InternalTask {
  status: AiTaskStatus;
  result?: AiImageTaskResult;
  error?: string;
}

@Injectable()
export class AiService {
  private readonly tasks = new Map<string, InternalTask>();

  async createStory(prompt: string): Promise<StoryOutput> {
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

  async createStoryboard(prompt: string): Promise<StoryboardOutput> {
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

  async createImageTask(prompt: string): Promise<{ taskId: string }> {
    const taskId = this.makeTaskId();
    this.tasks.set(taskId, { status: 'PENDING' });

    setTimeout(() => {
      const task = this.tasks.get(taskId);
      if (!task) {
        return;
      }

      task.status = 'RUNNING';
      this.tasks.set(taskId, task);
    }, 700);

    setTimeout(() => {
      const task = this.tasks.get(taskId);
      if (!task) {
        return;
      }

      const asset: Asset = {
        id: `asset-${crypto.randomUUID()}`,
        type: 'image',
        name: `AI-${prompt.slice(0, 12) || '角色素材'}`,
        url: this.makeImageDataUrl(prompt || '雨夜漫剧角色'),
        width: 1080,
        height: 1080
      };

      task.status = 'SUCCEEDED';
      task.result = { asset };
      this.tasks.set(taskId, task);
    }, 2100);

    return { taskId };
  }

  async getTask(taskId: string): Promise<AiTaskResponse<AiImageTaskResult>> {
    const task = this.tasks.get(taskId);
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

  private makeTaskId(): string {
    return `task-${crypto.randomUUID()}`;
  }

  private makeImageDataUrl(prompt: string): string {
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
}