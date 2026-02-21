import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  ParseIntPipe,
} from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { PengumumanService } from './pengumuman.service';
import { JwtAuthGuard } from 'src/auth/strategy/jwt-auth.guard';
import { CreatePengumumanDto } from './dto/create-pengumuman.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('pengumuman')
export class PengumumanController {
  constructor(private readonly pengumumanService: PengumumanService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreatePengumumanDto, @CurrentUser() user: User) {
    if (user.role === Role.MAHASISWA) {
      throw new ForbiddenException('Mahasiswa tidak dapat membuat pengumuman');
    }
    return this.pengumumanService.create(dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mahasiswa')
  async findAllForMahasiswa(@CurrentUser() user: User) {
    if (user.role !== Role.MAHASISWA) {
      throw new ForbiddenException('Hanya mahasiswa yang dapat mengakses ini');
    }
    return this.pengumumanService.findAllForMahasiswa(user.id);
  }

  // DOSEN: riwayat semua pengumuman yang pernah dia buat
  @UseGuards(JwtAuthGuard)
  @Get('dosen/history')
  async findAllForDosen(@CurrentUser() user: User) {
    if (user.role !== Role.DOSEN) {
      throw new ForbiddenException('Hanya dosen yang dapat mengakses ini');
    }
    return this.pengumumanService.findAllForDosen(user.id);
  }

  // DOSEN: riwayat pengumuman untuk kelas tertentu yang dia ampu
  @UseGuards(JwtAuthGuard)
  @Get('dosen/kelas/:kelasId')
  async findAllForDosenByKelas(
    @Param('kelasId', ParseIntPipe) kelasId: number,
    @CurrentUser() user: User,
  ) {
    if (user.role !== Role.DOSEN) {
      throw new ForbiddenException('Hanya dosen yang dapat mengakses ini');
    }
    return this.pengumumanService.findAllForDosenByKelas(user.id, kelasId);
  }

  // KOORPRODI/KAPRODI: lihat semua pengumuman yang pernah dibuat
  @UseGuards(JwtAuthGuard)
  @Get('koorprodi/all')
  async findAllForKoorprodi(@CurrentUser() user: User) {
    if (user.role !== Role.KOORPRODI) {
      throw new ForbiddenException('Hanya koorprodi yang dapat mengakses ini');
    }
    return this.pengumumanService.findAllForKoorprodi();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pengumumanService.findOne(id);
  }
}