import { Module } from '@nestjs/common';
import { KrsService } from './krs.service';
import { KrsController } from './krs.controller';
import { PrismaService } from '../prisma/prisma.service'; // Assume you have a PrismaService

@Module({
  controllers: [KrsController],
  providers: [KrsService, PrismaService],
})
export class KrsModule {}