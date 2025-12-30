import { Module } from '@nestjs/common';
import { PengumumanService } from './pengumuman.service';
import { PengumumanController } from './pengumuman.controller';
import { PrismaModule } from '../prisma/prsima.module';

@Module({
  imports: [PrismaModule],
  controllers: [PengumumanController],
  providers: [PengumumanService],
})
export class PengumumanModule {}