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
   async create(
    @Body() dto: CreatePengumumanDto,
    @CurrentUser() user: User,
  ) {
    // Cek basic: Mahasiswa tidak boleh
    if (user.role === Role.MAHASISWA) {
      throw new ForbiddenException('Mahasiswa tidak dapat membuat pengumuman');
    }

    // Logika Koorprodi ada di Service untuk validasi multi-kelas
    return this.pengumumanService.create(dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mahasiswa')
  async findAllForMahasiswa(@CurrentUser() user: User) {
    if (user.role !== 'MAHASISWA') {
      throw new ForbiddenException('Hanya mahasiswa yang dapat mengakses ini');
    }
    return this.pengumumanService.findAllForMahasiswa(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pengumumanService.findOne(id);
  }
}