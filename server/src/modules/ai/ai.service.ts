import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Asset } from '@manga-drama/types';
import type {
  AiImageTaskResult,
  AiTaskResponse,
  StoryboardOutput,
  StoryOutput
} from './ai.types';
import { AiTaskStore } from './ai-task.store';

@Injectable()
export class AiService {
  constructor(@Inject(AiTaskStore) private readonly aiTaskStore: AiTaskStore) {}

  async createStory(prompt: string): Promise<StoryOutput> {
    const normalizedPrompt = this.normalizePrompt(prompt);

    return {
      title: '雨夜',
      logline: normalizedPrompt,
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
    const normalizedPrompt = this.normalizePrompt(prompt);

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
          description: `角色中景推进，女孩出现在路灯下。提示词：${normalizedPrompt.slice(0, 20)}`,
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
    const normalizedPrompt = this.normalizePrompt(prompt);
    const taskId = this.makeTaskId();
    this.aiTaskStore.create(taskId, 'PENDING');

    setTimeout(() => {
      const task = this.aiTaskStore.get(taskId);
      if (!task) {
        return;
      }

      this.aiTaskStore.update(taskId, { status: 'RUNNING' });
    }, 700);

    setTimeout(() => {
      const task = this.aiTaskStore.get(taskId);
      if (!task) {
        return;
      }

      const asset: Asset = {
        id: `asset-${crypto.randomUUID()}`,
        type: 'image',
        name: `AI-${normalizedPrompt.slice(0, 12) || '角色素材'}`,
        url: this.makeImageDataUrl(normalizedPrompt),
        width: 1080,
        height: 1080
      };

      this.aiTaskStore.update(taskId, {
        status: 'SUCCEEDED',
        result: { asset }
      });
    }, 2100);

    return { taskId };
  }

  async getTask(taskId: string): Promise<AiTaskResponse<AiImageTaskResult>> {
    const task = this.aiTaskStore.get(taskId);
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

  private normalizePrompt(prompt: string): string {
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) {
      throw new BadRequestException('prompt 不能为空');
    }

    return normalizedPrompt;
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