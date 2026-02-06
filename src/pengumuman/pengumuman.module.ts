import { Module } from '@nestjs/common';
import { PengumumanService } from './pengumuman.service';
import { PengumumanController } from './pengumuman.controller';
import { PrismaModule } from '../prisma/prsima.module';
import { NotificationModule } from 'src/notification/notifications.module';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [PengumumanController],
  providers: [PengumumanService],
})
export class PengumumanModule {}