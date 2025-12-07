import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service'; // Import Prisma
import { JwtStrategy } from './strategy/jwt.strategy';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'portalinspiremobile', 
      signOptions: { expiresIn: '15m' },
    }),
    // ❌ HAPUS BARIS INI: TypeOrmModule.forFeature([User]),
  ],
  controllers: [AuthController],
  // ✅ Tambahkan PrismaService di providers
  providers: [AuthService, JwtStrategy, PrismaService], 
  exports: [AuthService],
})
export class AuthModule {}