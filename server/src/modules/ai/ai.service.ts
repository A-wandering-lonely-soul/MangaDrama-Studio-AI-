import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Asset } from '@manga-drama/types';
import { getAppConfig } from '../../config/app.config';
import type {
  AiImageTaskResult,
  AiTaskResponse,
  ProviderStatusResponse,
  StaticAudioItem,
  StaticImageItem,
  StoryboardOutput,
  StoryOutput
} from './ai.types';
import { AiTaskStore } from './ai-task.store';

@Injectable()
export class AiService {
  private readonly appConfig = getAppConfig();

  constructor(@Inject(AiTaskStore) private readonly aiTaskStore: AiTaskStore) {}

  getProviderStatus(): ProviderStatusResponse {
    return {
      provider: this.appConfig.aiProvider,
      textModel: this.appConfig.dashscopeTextModel,
      imageModel: this.appConfig.dashscopeImageModel,
      keyConfigured: this.appConfig.dashscopeApiKey.length > 0,
      baseUrl: this.appConfig.dashscopeBaseUrl
    };
  }

  async listStaticImages(): Promise<StaticImageItem[]> {
    const baseDirs = [join(process.cwd(), 'static'), join(process.cwd(), '..', 'static')];
    const staticDirs = [
      ...baseDirs.map((baseDir) => ({ dir: join(baseDir, 'image'), urlPrefix: '/static/image/' })),
      ...baseDirs.map((baseDir) => ({ dir: baseDir, urlPrefix: '/static/' }))
    ];
    const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
    const uniqueNames = new Set<string>();
    const items: StaticImageItem[] = [];

    for (const staticDir of staticDirs) {
      try {
        const entries = await readdir(staticDir.dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile()) {
            continue;
          }

          const name = entry.name;
          if (uniqueNames.has(name)) {
            continue;
          }

          const dotIndex = name.lastIndexOf('.');
          if (dotIndex < 0) {
            continue;
          }

          const extension = name.slice(dotIndex).toLowerCase();
          if (!allowedExtensions.has(extension)) {
            continue;
          }

          uniqueNames.add(name);
          items.push({
            name,
            url: `${staticDir.urlPrefix}${encodeURIComponent(name)}`
          });
        }
      } catch {
        // Ignore missing directories and continue scanning others.
      }
    }

    return items;
  }

  async listStaticAudios(): Promise<StaticAudioItem[]> {
    const baseDirs = [join(process.cwd(), 'static'), join(process.cwd(), '..', 'static')];
    const staticDirs = [
      ...baseDirs.map((baseDir) => ({ dir: join(baseDir, 'music'), urlPrefix: '/static/music/' })),
      ...baseDirs.map((baseDir) => ({ dir: baseDir, urlPrefix: '/static/' }))
    ];
    const audioExtensions = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac']);
    const uniqueNames = new Set<string>();
    const items: StaticAudioItem[] = [];

    for (const staticDir of staticDirs) {
      try {
        const entries = await readdir(staticDir.dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile()) {
            continue;
          }

          const name = entry.name;
          if (uniqueNames.has(name)) {
            continue;
          }

          const dotIndex = name.lastIndexOf('.');
          if (dotIndex < 0) {
            continue;
          }

          const extension = name.slice(dotIndex).toLowerCase();
          let kind: StaticAudioItem['kind'] | null = null;
          if (audioExtensions.has(extension)) {
            kind = 'audio';
          } else if (extension === '.lrc') {
            kind = 'lrc';
          } else if (extension === '.ncm') {
            kind = 'ncm';
          }

          if (!kind) {
            continue;
          }

          uniqueNames.add(name);
          items.push({
            name,
            url: `${staticDir.urlPrefix}${encodeURIComponent(name)}`,
            kind
          });
        }
      } catch {
        // Ignore missing directories and continue scanning others.
      }
    }

    return items;
  }

  async createStory(prompt: string): Promise<StoryOutput> {
    const normalizedPrompt = this.normalizePrompt(prompt);

    if (this.appConfig.aiProvider === 'aliyun') {
      return this.createStoryByAliyun(normalizedPrompt);
    }

    return this.createStoryByMock(normalizedPrompt);
  }

  async createStoryboard(prompt: string): Promise<StoryboardOutput> {
    const normalizedPrompt = this.normalizePrompt(prompt);

    if (this.appConfig.aiProvider === 'aliyun') {
      return this.createStoryboardByAliyun(normalizedPrompt);
    }

    return this.createStoryboardByMock(normalizedPrompt);
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
      void this.resolveImageTask(taskId, normalizedPrompt);
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

  private async resolveImageTask(taskId: string, normalizedPrompt: string): Promise<void> {
    const task = this.aiTaskStore.get(taskId);
    if (!task) {
      return;
    }

    try {
      const asset =
        this.appConfig.aiProvider === 'aliyun'
          ? await this.createImageAssetByAliyun(normalizedPrompt)
          : this.createImageAssetByMock(normalizedPrompt);

      this.aiTaskStore.update(taskId, {
        status: 'SUCCEEDED',
        result: { asset }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片任务生成失败';
      if (this.appConfig.aiProvider === 'aliyun') {
        const fallback = this.createImageAssetByMock(normalizedPrompt);
        this.aiTaskStore.update(taskId, {
          status: 'SUCCEEDED',
          result: {
            asset: {
              ...fallback,
              name: `${fallback.name}-回退` ,
              metadata: {
                provider: 'mock-fallback',
                reason: message
              }
            }
          },
          error: `阿里云失败，已自动回退Mock: ${message}`
        });
        return;
      }

      this.aiTaskStore.update(taskId, {
        status: 'FAILED',
        error: message
      });
    }
  }

  private createStoryByMock(normalizedPrompt: string): StoryOutput {
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

  private createStoryboardByMock(normalizedPrompt: string): StoryboardOutput {
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

  private ensureAliyunConfig(): void {
    if (!this.appConfig.dashscopeApiKey) {
      throw new BadRequestException('AI_PROVIDER=aliyun 时必须配置 DASHSCOPE_API_KEY');
    }
  }

  private async createStoryByAliyun(prompt: string): Promise<StoryOutput> {
    this.ensureAliyunConfig();

    const content = await this.callDashScopeChat(
      this.appConfig.dashscopeTextModel,
      [
        {
          role: 'system',
          content:
            '你是中文动漫短剧编剧助手。请只输出 JSON，不要输出 markdown。JSON 结构必须是 {"title":string,"logline":string,"episodes":[{"title":string,"scenes":[{"name":string,"summary":string,"duration":number}]}]}。'
        },
        {
          role: 'user',
          content: `根据下面提示词生成 1 集短剧，2-4 个场景，每个场景时长建议 2-6 秒。提示词：${prompt}`
        }
      ]
    );

    const parsed = this.parseJsonObject(content);
    return this.normalizeStoryOutput(parsed, prompt);
  }

  private async createStoryboardByAliyun(prompt: string): Promise<StoryboardOutput> {
    this.ensureAliyunConfig();

    const content = await this.callDashScopeChat(
      this.appConfig.dashscopeTextModel,
      [
        {
          role: 'system',
          content:
            '你是中文分镜导演助手。请只输出 JSON，不要输出 markdown。JSON 结构必须是 {"scenes":[{"description":string,"duration":number,"camera":{"x":number,"y":number,"zoom":number,"rotation":number},"characters":string[],"background":string,"mood":string,"dialogue":string}]}。'
        },
        {
          role: 'user',
          content:
            `基于提示词输出 2-5 条分镜，镜头参数适合竖屏 1080x1920：${prompt}`
        }
      ]
    );

    const parsed = this.parseJsonObject(content);
    return this.normalizeStoryboardOutput(parsed, prompt);
  }

  private createImageAssetByMock(prompt: string): Asset {
    return {
      id: `asset-${crypto.randomUUID()}`,
      type: 'image',
      name: `AI-${prompt.slice(0, 12) || '角色素材'}`,
      url: this.makeImageDataUrl(prompt),
      width: 1080,
      height: 1080
    };
  }

  private async createImageAssetByAliyun(prompt: string): Promise<Asset> {
    this.ensureAliyunConfig();

    const imageBaseUrl = this.resolveDashscopeImageBaseUrl();
    const model = this.appConfig.dashscopeImageModel;
    const endpoints = this.resolveDashscopeImageTaskEndpoints(imageBaseUrl, model);
    const endpointErrors: string[] = [];
    let imageUrl = '';

    for (const endpoint of endpoints) {
      try {
        const taskId = await this.createDashscopeImageTask(endpoint, model, prompt);
        imageUrl = await this.pollDashscopeImageTask(imageBaseUrl, taskId);
        if (imageUrl) {
          break;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        endpointErrors.push(`${endpoint}: ${message}`);
      }
    }

    if (!imageUrl) {
      const detail = endpointErrors.join(' | ');
      throw new Error(`阿里云图片生成失败（请检查 DASHSCOPE_IMAGE_BASE_URL 与业务空间地域）: ${detail}`);
    }

    return {
      id: `asset-${crypto.randomUUID()}`,
      type: 'image',
      name: `AI-${prompt.slice(0, 12) || '角色素材'}`,
      url: imageUrl,
      width: 1024,
      height: 1024,
      metadata: {
        provider: 'aliyun',
        model: this.appConfig.dashscopeImageModel
      }
    };
  }

  private async createDashscopeImageTask(endpoint: string, model: string, prompt: string): Promise<string> {
    const payloadCandidates = this.buildDashscopeImagePayloadCandidates(model, prompt);
    const asyncModes = endpoint.includes('/multimodal-generation/') ? [true, false] : [true];

    let lastError = 'unknown error';
    for (const useAsync of asyncModes) {
      for (const payload of payloadCandidates) {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.appConfig.dashscopeApiKey}`
        };
        if (useAsync) {
          headers['X-DashScope-Async'] = 'enable';
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const message = await this.safeReadResponseText(response);
          lastError = `${response.status} ${message}`;
          const canRetryWithNextPayload =
            response.status === 400 &&
            (/required body invalid/i.test(message) || /url error/i.test(message) || /invalid parameter/i.test(message));
          const canRetryWithSyncMode =
            useAsync &&
            response.status === 403 &&
            /does not support asynchronous calls/i.test(message);
          if (canRetryWithNextPayload || canRetryWithSyncMode) {
            continue;
          }

          throw new Error(`阿里云图片任务创建失败: ${lastError}`);
        }

        const body = (await response.json()) as Record<string, unknown>;
        const taskId = this.extractDashscopeTaskId(body);
        if (taskId) {
          return taskId;
        }

        const imageUrl = this.extractDashscopeImageUrl(body);
        if (imageUrl) {
          return this.registerSyntheticTaskFromUrl(imageUrl);
        }

        throw new Error('阿里云图片任务创建成功但未返回 task_id');
      }
    }

    throw new Error(`阿里云图片任务创建失败: ${lastError}`);
  }

  private buildDashscopeImagePayloadCandidates(model: string, prompt: string): Array<Record<string, unknown>> {
    return [
      {
        model,
        input: {
          prompt
        },
        parameters: {
          size: '1024*1024'
        }
      },
      {
        model,
        input: {
          messages: [
            {
              role: 'user',
              content: [
                {
                  text: prompt
                }
              ]
            }
          ]
        },
        parameters: {
          size: '1024*1024'
        }
      },
      {
        model,
        messages: [
          {
            role: 'user',
            content: [
              {
                text: prompt
              }
            ]
          }
        ],
        parameters: {
          size: '1024*1024'
        }
      },
      {
        model,
        prompt,
        size: '1024*1024'
      }
    ];
  }

  private async pollDashscopeImageTask(imageBaseUrl: string, taskId: string): Promise<string> {
    if (taskId.startsWith('inline-image:')) {
      return taskId.slice('inline-image:'.length);
    }

    const endpoint = `${imageBaseUrl}/tasks/${taskId}`;
    const maxAttempts = 20;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.appConfig.dashscopeApiKey}`
        }
      });

      if (!response.ok) {
        const message = await this.safeReadResponseText(response);
        throw new Error(`阿里云图片任务查询失败: ${response.status} ${message}`);
      }

      const body = (await response.json()) as Record<string, unknown>;
      const status = this.extractDashscopeTaskStatus(body);
      if (status === 'SUCCEEDED') {
        const imageUrl = this.extractDashscopeImageUrl(body);
        if (!imageUrl) {
          throw new Error('阿里云图片任务成功但未返回图片链接');
        }

        return imageUrl;
      }

      if (status === 'FAILED' || status === 'CANCELED') {
        const message = this.extractDashscopeTaskMessage(body);
        throw new Error(`阿里云图片任务失败(${status}): ${message}`);
      }

      await this.wait(1500);
    }

    throw new Error('阿里云图片任务轮询超时，请稍后重试');
  }

  private resolveDashscopeImageBaseUrl(): string {
    const configured = this.appConfig.dashscopeImageBaseUrl.trim();
    if (configured) {
      return configured.replace(/\/$/, '');
    }

    return this.appConfig.dashscopeBaseUrl.replace(/\/compatible-mode\/v1\/?$/i, '/api/v1').replace(/\/$/, '');
  }

  private resolveDashscopeImageTaskEndpoints(imageBaseUrl: string, model: string): string[] {
    const allEndpoints = [
      `${imageBaseUrl}/services/aigc/text2image/image-synthesis`,
      `${imageBaseUrl}/services/aigc/image-generation/generation`,
      `${imageBaseUrl}/services/aigc/multimodal-generation/generation`
    ];

    if (model.startsWith('wan2.6')) {
      return [allEndpoints[1], allEndpoints[2], allEndpoints[0]];
    }

    if (model.startsWith('qwen-image')) {
      return [allEndpoints[2], allEndpoints[1], allEndpoints[0]];
    }

    return allEndpoints;
  }

  private extractDashscopeTaskId(body: Record<string, unknown>): string {
    const directTaskId = this.asString(body.task_id);
    if (directTaskId) {
      return directTaskId;
    }

    const output = body.output;
    if (!output || typeof output !== 'object') {
      return '';
    }

    return this.asString((output as Record<string, unknown>).task_id);
  }

  private extractDashscopeTaskStatus(body: Record<string, unknown>): string {
    const directStatus = this.asString(body.task_status).toUpperCase();
    if (directStatus) {
      return directStatus;
    }

    const output = body.output;
    if (!output || typeof output !== 'object') {
      return '';
    }

    return this.asString((output as Record<string, unknown>).task_status).toUpperCase();
  }

  private extractDashscopeTaskMessage(body: Record<string, unknown>): string {
    const code = this.asString(body.code);
    const message = this.asString(body.message);

    if (code || message) {
      return `${code}${code && message ? ': ' : ''}${message}`.trim();
    }

    const output = body.output;
    if (output && typeof output === 'object') {
      const outputRecord = output as Record<string, unknown>;
      const outputCode = this.asString(outputRecord.code);
      const outputMessage = this.asString(outputRecord.message);
      if (outputCode || outputMessage) {
        return `${outputCode}${outputCode && outputMessage ? ': ' : ''}${outputMessage}`.trim();
      }
    }

    return 'unknown error';
  }

  private extractDashscopeImageUrl(body: Record<string, unknown>): string {
    const output = body.output;
    if (!output || typeof output !== 'object') {
      return '';
    }

    const outputRecord = output as Record<string, unknown>;
    const results = outputRecord.results;
    if (Array.isArray(results)) {
      for (const item of results) {
        if (!item || typeof item !== 'object') {
          continue;
        }

        const url = this.asString((item as Record<string, unknown>).url);
        if (url) {
          return url;
        }
      }
    }

    const choices = outputRecord.choices;
    if (!Array.isArray(choices)) {
      return '';
    }

    for (const choice of choices) {
      if (!choice || typeof choice !== 'object') {
        continue;
      }

      const message = (choice as Record<string, unknown>).message;
      if (!message || typeof message !== 'object') {
        continue;
      }

      const content = (message as Record<string, unknown>).content;
      if (!Array.isArray(content)) {
        continue;
      }

      for (const contentItem of content) {
        if (!contentItem || typeof contentItem !== 'object') {
          continue;
        }

        const imageUrl = this.asString((contentItem as Record<string, unknown>).image);
        if (imageUrl) {
          return imageUrl;
        }
      }
    }

    return '';
  }

  private registerSyntheticTaskFromUrl(imageUrl: string): string {
    return `inline-image:${imageUrl}`;
  }

  private async wait(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private async callDashScopeChat(
    model: string,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    const endpoint = `${this.appConfig.dashscopeBaseUrl.replace(/\/$/, '')}/chat/completions`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.appConfig.dashscopeApiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        messages
      })
    });

    if (!response.ok) {
      const message = await this.safeReadResponseText(response);
      throw new Error(`阿里云文本生成失败: ${response.status} ${message}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('阿里云文本生成返回为空');
    }

    return content;
  }

  private parseJsonObject(value: string): Record<string, unknown> {
    const cleaned = value
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    const candidate = cleaned.startsWith('{')
      ? cleaned
      : cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1);
    if (!candidate || !candidate.startsWith('{')) {
      throw new Error('模型返回不是有效 JSON');
    }

    return JSON.parse(candidate) as Record<string, unknown>;
  }

  private normalizeStoryOutput(raw: Record<string, unknown>, prompt: string): StoryOutput {
    const title = this.asString(raw.title) || '未命名故事';
    const logline = this.asString(raw.logline) || prompt;
    const episodesInput = Array.isArray(raw.episodes) ? raw.episodes : [];
    const episodes = episodesInput
      .map((episode, index) => {
        if (!episode || typeof episode !== 'object') {
          return null;
        }

        const entry = episode as Record<string, unknown>;
        const scenesInput = Array.isArray(entry.scenes) ? entry.scenes : [];
        const scenes = scenesInput
          .map((scene, sceneIndex) => {
            if (!scene || typeof scene !== 'object') {
              return null;
            }

            const sceneEntry = scene as Record<string, unknown>;
            return {
              name: this.asString(sceneEntry.name) || `场景 ${sceneIndex + 1}`,
              summary: this.asString(sceneEntry.summary) || '待补充',
              duration: this.asNumber(sceneEntry.duration, 4)
            };
          })
          .filter(isNonNullable);

        if (scenes.length === 0) {
          return null;
        }

        return {
          title: this.asString(entry.title) || `第 ${index + 1} 集`,
          scenes
        };
      })
      .filter((item): item is StoryOutput['episodes'][number] => Boolean(item));

    if (episodes.length === 0) {
      return this.createStoryByMock(prompt);
    }

    return { title, logline, episodes };
  }

  private normalizeStoryboardOutput(raw: Record<string, unknown>, prompt: string): StoryboardOutput {
    const scenesInput = Array.isArray(raw.scenes) ? raw.scenes : [];
    const scenes = scenesInput
      .map((scene) => {
        if (!scene || typeof scene !== 'object') {
          return null;
        }

        const entry = scene as Record<string, unknown>;
        const cameraInput = entry.camera && typeof entry.camera === 'object' ? (entry.camera as Record<string, unknown>) : {};
        const characters = Array.isArray(entry.characters)
          ? entry.characters.map((item) => this.asString(item)).filter((item): item is string => Boolean(item))
          : [];

        return {
          description: this.asString(entry.description) || `分镜描述：${prompt.slice(0, 30)}`,
          duration: this.asNumber(entry.duration, 3),
          camera: {
            x: this.asNumber(cameraInput.x, 540),
            y: this.asNumber(cameraInput.y, 960),
            zoom: this.asNumber(cameraInput.zoom, 0.6),
            rotation: this.asNumber(cameraInput.rotation, 0)
          },
          characters,
          background: this.asString(entry.background) || '场景背景',
          mood: this.asString(entry.mood) || '平稳',
          dialogue: this.asString(entry.dialogue) || ''
        };
      })
      .filter(isNonNullable);

    if (scenes.length === 0) {
      return this.createStoryboardByMock(prompt);
    }

    return { scenes };
  }

  private asString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private asNumber(value: unknown, fallback: number): number {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }

    return numeric;
  }

  private async safeReadResponseText(response: Response): Promise<string> {
    try {
      const text = (await response.text()).trim();
      if (text.length === 0) {
        return 'empty response';
      }

      return text.length > 400 ? `${text.slice(0, 400)}...` : text;
    } catch {
      return 'unable to read error body';
    }
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

function isNonNullable<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}