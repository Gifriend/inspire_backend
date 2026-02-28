import { Module } from '@nestjs/common';
import { NilaiController } from './nilai.controller';
import { NilaiService } from './nilai.service';
import { PrismaModule } from '../prisma/prsima.module';

@Module({
  imports: [PrismaModule],
  controllers: [NilaiController],
  providers: [NilaiService],
})
export class NilaiModule {}
