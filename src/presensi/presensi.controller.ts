import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  ForbiddenException, 
  Get, Param, ParseIntPipe
} from '@nestjs/common';
import { User, Role } from '@prisma/client';
import { PresensiService } from './presensi.service';
import { CreatePresensiDto, SubmitPresensiDto, ManualPresensiDto } from './dto/presensi.dto';
import { JwtAuthGuard } from '../auth/strategy/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('presensi')
export class PresensiController {
  constructor(private readonly presensiService: PresensiService) {}

  // 1. Dosen Generate Pertemuan
  @Post('session')
  async createSession(@Body() dto: CreatePresensiDto, @CurrentUser() user: User) {
    return this.presensiService.createSession(dto, user);
  }

  // 2. Mahasiswa Absen Mandiri
  @Post('submit')
  async submitPresensi(@Body() dto: SubmitPresensiDto, @CurrentUser() user: User) {
    if (user.role !== Role.MAHASISWA) throw new ForbiddenException('Hanya mahasiswa bisa submit sendiri.');
    return this.presensiService.submitPresensi(dto, user);
  }

  // 3. Dosen Input Manual (Satu per satu)
  @Post('manual')
  async manualPresensi(@Body() dto: ManualPresensiDto, @CurrentUser() user: User) {
    if (user.role === Role.MAHASISWA) throw new ForbiddenException('Mahasiswa tidak boleh akses ini.');
    return this.presensiService.manualPresensi(dto, user);
  }
}