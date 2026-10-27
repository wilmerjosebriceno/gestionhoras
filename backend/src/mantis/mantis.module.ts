import { Module } from '@nestjs/common';
import { LlmModule } from '../agente/llm.module';
import { MantisController } from './mantis.controller';
import { MantisService } from './mantis.service';
import { MantisClientService } from './mantis-client.service';

@Module({
  imports: [LlmModule],
  controllers: [MantisController],
  providers: [MantisService, MantisClientService],
  exports: [MantisService, MantisClientService],
})
export class MantisModule {}
