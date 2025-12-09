import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service'; // Pastikan path import benar
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService, // Ganti Repository dengan PrismaService
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { nim, password } = loginDto;
    
    // TypeORM: findOne({ where: { nim } })
    // Prisma: findUnique({ where: { nim } }) (karena nim @unique)
    const user = await this.prisma.user.findUnique({ 
      where: { nim } 
    });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('NIM atau password salah');
    }

    // ✅ PAYLOAD LENGKAP
    const payload = { 
      sub: user.id, 
      nim: user.nim, 
      name: user.name,
      email: user.email,
      role: user.role 
    };
    
    const access_token = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refresh_token = this.jwtService.sign(payload, { expiresIn: '7d' });

    return {
      access_token,
      refresh_token,
    };
  }

  async refresh(refreshTokenDto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(refreshTokenDto.refreshToken);
      
      // Prisma findUnique by ID
      const user = await this.prisma.user.findUnique({ 
        where: { id: payload.sub } 
      });
      
      if (!user) {
        throw new UnauthorizedException('Refresh token tidak valid');
      }

      // Re-sign token dengan payload yang sama
      // Note: Sebaiknya buat ulang payload bersih dari user db terbaru
      const newPayload = { 
        sub: user.id, 
        nim: user.nim, 
        name: user.name,
        email: user.email,
        role: user.role 
      };

      const newAccessToken = this.jwtService.sign(newPayload, { expiresIn: '15d' });

      return {
        access_token: newAccessToken,
        refresh_token: refreshTokenDto.refreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException('Refresh token tidak valid');
    }
  }

  async create(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    
    // Prisma Create
    // Pastikan field di DTO sesuai dengan schema.prisma User model
    // Jika ada field enum (Role/Gender), pastikan dikirim dengan benar atau di-cast
    return this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
        // Default values seperti status, role, dll biasanya sudah dihandle
        // oleh @default() di schema.prisma atau harus diset di sini jika wajib
      },
    });
  }

  async findAll() {
    return this.prisma.user.findMany();
  }

  async findOne(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
  }

  async remove(id: number) {
    return this.prisma.user.delete({ where: { id } });
  }
}