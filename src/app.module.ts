import { Module } from '@nestjs/common';
import { PengumumanModule } from './pengumuman/pengumuman.module';
import { KrsModule } from './krs/krs.module';
import { AuthModule } from './auth/auth.module';
import { ElearningModule } from './elearning/elearning.dto';
import { AcademicModule } from './academic/academic.module';

@Module({
  imports: [PengumumanModule, KrsModule, AuthModule, ElearningModule, AcademicModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
