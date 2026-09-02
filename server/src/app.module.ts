import { Module } from '@nestjs/common';
import { AiController } from './modules/ai/ai.controller';
import { AiService } from './modules/ai/ai.service';

@Module({
  controllers: [AiController],
  providers: [AiService]
})
export class AppModule {}