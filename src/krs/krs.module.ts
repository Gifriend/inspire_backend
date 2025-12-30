import { Module } from '@nestjs/common';
import { KrsService } from './krs.service';
import { KrsController } from './krs.controller';
import { PrismaModule } from '../prisma/prsima.module';

@Module({
  imports: [PrismaModule],
  controllers: [KrsController],
  providers: [KrsService],
})
export class KrsModule {}