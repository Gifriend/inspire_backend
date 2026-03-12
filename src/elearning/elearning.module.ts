import { Module } from '@nestjs/common';
import { ElearningController } from './elearning.controller';
import { ElearningService } from './elearning.service';
import { PrismaModule } from '../prisma/prsima.module';
import { ElearningSetupController } from './elearning-setup.controller';
import { ElearningSetupService } from './elearning-setup.service';
import { NotificationModule } from '../notification/notifications.module';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [ElearningController, ElearningSetupController],
  providers: [ElearningService, ElearningSetupService],
})
export class ElearningModule {}