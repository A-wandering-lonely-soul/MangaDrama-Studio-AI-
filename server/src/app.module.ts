import { Module } from '@nestjs/common';
import { AiController } from './modules/ai/ai.controller';
import { AiService } from './modules/ai/ai.service';
import { AiTaskStore } from './modules/ai/ai-task.store';

@Module({
  controllers: [AiController],
  providers: [AiService, AiTaskStore]
})
export class AppModule {}