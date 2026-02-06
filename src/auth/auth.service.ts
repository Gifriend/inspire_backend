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
    const { identifier, password, fcmToken } = loginDto;
    console.log(' [AUTH] Login with FCM token:', fcmToken ? 'YES' : 'NO');
    
    // Cari user berdasarkan NIM (mahasiswa) atau NIP (dosen)
    const user = await this.prisma.user.findFirst({ 
      where: {
        OR: [
          { nim: identifier },
          { nip: identifier }
        ]
      }
    });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('NIM/NIP atau password salah');
    }

    // Update FCM Token jika diberikan
    if (fcmToken) {
      console.log(' [AUTH] Saving FCM token for user:', user.id, user.role);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { fcmToken }
      });
    }

    // ✅ PAYLOAD LENGKAP
    const payload = { 
      sub: user.id, 
      nim: user.nim, 
      name: user.name,
      email: user.email,
      role: user.role 
    };
    
    const access_token = this.jwtService.sign(payload, { expiresIn: '1d' });
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

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({ 
      where: { id: userId },
      select: {
        id: true,
        nim: true,
        nip: true,
        name: true,
        email: true,
        telepon: true,
        alamat: true,
        tanggalLahir: true,
        gender: true,
        role: true,
        status: true,
        photo: true,
        fakultasId: true,
        prodiId: true,
        createdAt: true,
        updatedAt: true,
        // Exclude password
        fakultas: {
          select: {
            id: true,
            name: true,
            kode: true,
          }
        },
        prodi: {
          select: {
            id: true,
            name: true,
            kode: true,
            jenjang: true,
          }
        }
      }
    });
    
    if (!user) {
      throw new UnauthorizedException('User tidak ditemukan');
    }
    
    return user;
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

  async updateFcmToken(userId: number, token: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { 
        fcmToken: token 
      },
    });
  }

  async removeFcmToken(userId: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken: null },
    });
  }

}
