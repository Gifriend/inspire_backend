import { Module } from '@nestjs/common';
import { ElearningService } from './elearning.service';
import { ElearningController } from './elearning.controller';

@Module({
  controllers: [ElearningController],
  providers: [ElearningService],
  exports: [ElearningService], // Diexport agar bisa digunakan module lain jika perlu
})
export class ElearningModule {}