import { Module } from '@nestjs/common';
import { ElearningController } from './elearning.controller';
import {  ElearningService } from './elearning.service';

@Module({
  controllers: [ElearningController],
  providers: [ElearningService],
})
export class ElearningModule {}