import { Module } from '@nestjs/common';
import { PengumumanService } from './pengumuman.service';
import { PengumumanController } from './pengumuman.controller';
import { PrismaService } from '../prisma/prisma.service'; // sesuaikan

@Module({
  controllers: [PengumumanController],
  providers: [PengumumanService, PrismaService],
})
export class PengumumanModule {}