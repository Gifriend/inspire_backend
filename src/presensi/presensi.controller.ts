import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  ForbiddenException, 
  BadRequestException,
  Delete,
  Get, Param, ParseIntPipe, Query
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

  // 4. Dosen Lihat Daftar Pertemuan (Token per pertemuan)
  @Get('kelas/:kelasId/sessions')
  async getSessionsByClass(
    @Param('kelasId', ParseIntPipe) kelasId: number,
    @CurrentUser() user: User,
  ) {
    return this.presensiService.getSessionsByClass(kelasId, user);
  }

  // 5. Dosen Lihat List Mahasiswa per Kelas (+opsional status per sesi)
  @Get('kelas/:kelasId/mahasiswa')
  async getClassStudents(
    @Param('kelasId', ParseIntPipe) kelasId: number,
    @Query('sessionId') sessionId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const parsedSessionId = sessionId ? parseInt(sessionId, 10) : undefined;
    if (sessionId && Number.isNaN(parsedSessionId)) {
      throw new BadRequestException('sessionId harus berupa angka.');
    }
    return this.presensiService.getClassStudents(kelasId, user, parsedSessionId);
  }

  // 6. Dosen Lihat Siapa Saja yang Sudah Isi Presensi di Sesi Tertentu
  @Get('session/:sessionId/attendances')
  async getSessionAttendances(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Query('method') method: string | undefined,
    @CurrentUser() user: User,
  ) {
    if (method && method !== 'TOKEN' && method !== 'MANUAL') {
      throw new BadRequestException('method hanya boleh TOKEN atau MANUAL.');
    }

    return this.presensiService.getSessionAttendances(
      sessionId,
      user,
      method as 'TOKEN' | 'MANUAL' | undefined,
    );
  }

  // 7. Dosen Batalkan Kehadiran Mahasiswa pada Sesi Tertentu
  @Delete('session/:sessionId/mahasiswa/:mahasiswaId')
  async revokeAttendance(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Param('mahasiswaId', ParseIntPipe) mahasiswaId: number,
    @CurrentUser() user: User,
  ) {
    return this.presensiService.revokeAttendance(sessionId, mahasiswaId, user);
  }
}