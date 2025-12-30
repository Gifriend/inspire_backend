import { Module } from '@nestjs/common';
import { ElearningController } from './elearning.controller';
import { ElearningService } from './elearning.service';
import { PrismaModule } from '../prisma/prsima.module';

@Module({
  imports: [PrismaModule],
  controllers: [ElearningController],
  providers: [ElearningService],
})
export class ElearningModule {}