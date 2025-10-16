import { Module } from '@nestjs/common';
import { KrsService } from './krs.service';
import { KrsController } from './krs.controller';
import { PrismaService } from '../prisma/prisma.service'; 

@Module({
  controllers: [KrsController],
  providers: [KrsService, PrismaService],
})
export class KrsModule {}