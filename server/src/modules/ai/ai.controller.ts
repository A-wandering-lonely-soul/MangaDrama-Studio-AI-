import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { AiService } from './ai.service';
import type { PromptPayload } from './ai.types';

@Controller('api/ai')
export class AiController {
  constructor(@Inject(AiService) private readonly aiService: AiService) {}

  @Get('static-images')
  listStaticImages() {
    return this.aiService.listStaticImages();
  }

  @Get('static-audios')
  listStaticAudios() {
    return this.aiService.listStaticAudios();
  }

  @Post('story')
  createStory(@Body() payload: PromptPayload) {
    return this.aiService.createStory(payload?.prompt ?? '');
  }

  @Post('storyboard')
  createStoryboard(@Body() payload: PromptPayload) {
    return this.aiService.createStoryboard(payload?.prompt ?? '');
  }

  @Post('image')
  createImage(@Body() payload: PromptPayload) {
    return this.aiService.createImageTask(payload?.prompt ?? '');
  }

  @Get('tasks/:taskId')
  getTask(@Param('taskId') taskId: string) {
    return this.aiService.getTask(taskId);
  }
}