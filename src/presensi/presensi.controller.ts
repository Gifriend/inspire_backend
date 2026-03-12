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

  // Lecturer Generate Session Token
  @Post('session')
  async createSession(@Body() dto: CreatePresensiDto, @CurrentUser() user: User) {
    return this.presensiService.createSession(dto, user);
  }

  // Student Submit Attendance with Token
  @Post('submit')
  async submitPresensi(@Body() dto: SubmitPresensiDto, @CurrentUser() user: User) {
    if (user.role !== Role.MAHASISWA) throw new ForbiddenException('Hanya mahasiswa bisa submit sendiri.');
    return this.presensiService.submitPresensi(dto, user);
  }

  // Lecturer Manually Mark Attendance for Student
  @Post('manual')
  async manualPresensi(@Body() dto: ManualPresensiDto, @CurrentUser() user: User) {
    if (user.role === Role.MAHASISWA) throw new ForbiddenException('Mahasiswa tidak boleh akses ini.');
    return this.presensiService.manualPresensi(dto, user);
  }

  // Lecturer View Regular Sessions per Class
  @Get('kelas/:kelasId/sessions/kelas')
  async getKelasSessionsByClass(
    @Param('kelasId', ParseIntPipe) kelasId: number,
    @CurrentUser() user: User,
  ) {
    return this.presensiService.getKelasSessionsByClass(kelasId, user);
  }

  // Lecturer View UAS Sessions per Class
  @Get('kelas/:kelasId/sessions/uas')
  async getUASSessionByClass(
    @Param('kelasId', ParseIntPipe) kelasId: number,
    @CurrentUser() user: User,
  ) {
    return this.presensiService.getUASSessionByClass(kelasId, user);
  }

  // Lecturer View All Sessions for Events (non-class sessions)
  @Get('sessions/event')
  async getEventSessions(@CurrentUser() user: User) {
    return this.presensiService.getEventSessions(user);
  }

  // Lecturer View Students in Class with Attendance Status for a Session
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

  // Lecturer View Attendance List for a Session (with optional filter by method)
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

  // Lecturer Revoke Attendance for a Student in a Session
  @Delete('session/:sessionId/mahasiswa/:mahasiswaId')
  async revokeAttendance(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Param('mahasiswaId', ParseIntPipe) mahasiswaId: number,
    @CurrentUser() user: User,
  ) {
    return this.presensiService.revokeAttendance(sessionId, mahasiswaId, user);
  }

  // Lecturer View My Attendance in a Class (for students, shows their own attendance)
  @Get('my/kelas/:kelasId')
  async getMyPresensiInClass(
    @Param('kelasId', ParseIntPipe) kelasId: number,
    @CurrentUser() user: User,
  ) {
    if (user.role !== Role.MAHASISWA)
      throw new ForbiddenException('Hanya mahasiswa yang dapat mengakses ini.');
    return this.presensiService.getMyPresensiInClass(kelasId, user);
  }
}