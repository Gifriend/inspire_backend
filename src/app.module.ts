import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PengumumanModule } from './pengumuman/pengumuman.module';
import { KrsModule } from './krs/krs.module';
import { AuthModule } from './auth/auth.module';
import { ElearningModule } from './elearning/elearning.dto';
import { AcademicModule } from './academic/academic.module';
import { LoggerMiddleware } from './common/middleware/middleware';

@Module({
  imports: [
    PengumumanModule,
    KrsModule,
    AuthModule,
    ElearningModule,
    AcademicModule,
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
