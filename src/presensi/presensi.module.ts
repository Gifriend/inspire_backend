import { Module } from '@nestjs/common';
import { PresensiService } from './presensi.service';
import { PresensiController } from './presensi.controller';
import { PrismaModule } from 'src/prisma/prsima.module';

@Module({
  imports: [PrismaModule], 
  controllers: [PresensiController],
  providers: [PresensiService],
})
export class PresensiModule {}