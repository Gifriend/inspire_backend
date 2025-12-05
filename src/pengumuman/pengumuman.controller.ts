import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { User } from '@prisma/client';
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
    if (user.role !== 'DOSEN') {
      throw new ForbiddenException('Hanya dosen yang dapat membuat pengumuman');
    }
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
}