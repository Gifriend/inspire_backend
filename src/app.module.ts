import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PengumumanModule } from './pengumuman/pengumuman.module';
import { KrsModule } from './krs/krs.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [PengumumanModule, KrsModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
