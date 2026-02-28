import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PengumumanModule } from './pengumuman/pengumuman.module';
import { KrsModule } from './krs/krs.module';
import { AuthModule } from './auth/auth.module';
import { ElearningModule } from './elearning/elearning.module';
import { AcademicModule } from './academic/academic.module';
import { LoggerMiddleware } from './common/middleware/middleware';
import { PresensiModule } from './presensi/presensi.module';
import { NotificationModule } from './notification/notifications.module';
import { ScheduleModule } from './schedule/schedule.module';
import { NilaiModule } from './nilai/nilai.module';

@Module({
  imports: [
    PengumumanModule,
    KrsModule,
    AuthModule,
    ElearningModule,
    AcademicModule,
    PresensiModule,
    NotificationModule,
    ScheduleModule,
    NilaiModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  // Implementasi configure untuk memasang Middleware
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*'); // Terapkan untuk SEMUA route ('*')
  }
}
