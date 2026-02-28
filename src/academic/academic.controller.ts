import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Res,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { AcademicService } from './academic.service';
import { GetKhsDto, GetPaKhsQueryDto } from './dto/academic.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { JwtAuthGuard } from 'src/auth/strategy/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('academic')
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  // ==========================================
  // MAHASISWA — Fitur KHS & Transkrip (self)
  // ==========================================

  /**
   * GET /academic/khs/semesters
   */
  @Get('khs/semesters')
  async getSemesters(@CurrentUser() user: User) {
    return this.academicService.getStudentSemesters(user.id);
  }

  /**
   * GET /academic/khs?semester=2024/2025 Ganjil
   */
  @Get('khs')
  async getKhs(@Query() query: GetKhsDto, @CurrentUser() user: User) {
    return this.academicService.getKhs(user.id, query.semester);
  }

  /**
   * GET /academic/khs/download?semester=2024/2025 Ganjil
   * Returns a PDF file. In Flutter, use http.get with an authorization header,
   * then save the bytes to a file and open with open_filex or url_launcher.
   */
  @Get('khs/download')
  async downloadKhs(
    @Query() query: GetKhsDto,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const buffer = await this.academicService.generateKhsPdf(user.id, query.semester);
    const filename = `KHS-${user.id}-${query.semester.replace(/[\/\s]/g, '_')}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /**
   * GET /academic/transkrip
   */
  @Get('transkrip')
  async getMyTranskrip(@CurrentUser() user: User) {
    return this.academicService.getTranskrip(user.id);
  }

  /**
   * GET /academic/transkrip/download
   * Returns a PDF file. In Flutter, use http.get with an authorization header,
   * then save the bytes to a file and open with open_filex or url_launcher.
   */
  @Get('transkrip/download')
  async downloadTranskrip(@CurrentUser() user: User, @Res() res: Response) {
    const buffer = await this.academicService.generateTranskripPdf(user.id);
    const filename = `Transkrip-${user.id}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ==========================================
  // DOSEN PA — Fitur KHS & Transkrip mahasiswa bimbingan
  // ==========================================

  /**
   * GET /academic/pa/mahasiswa
   * Daftar mahasiswa bimbingan PA dari dosen yang login.
   */
  @Get('pa/mahasiswa')
  async getMahasiswaBimbinganPA(@CurrentUser() user: User) {
    this.assertDosen(user);
    return this.academicService.getMahasiswaBimbinganPA(user.id);
  }

  /**
   * GET /academic/pa/mahasiswa/:mahasiswaId/semesters
   * List semester yang tersedia untuk mahasiswa tertentu.
   */
  @Get('pa/mahasiswa/:mahasiswaId/semesters')
  async getStudentSemestersByPA(
    @CurrentUser() user: User,
    @Param('mahasiswaId', ParseIntPipe) mahasiswaId: number,
  ) {
    this.assertDosen(user);
    return this.academicService.getStudentSemestersByPA(user.id, mahasiswaId);
  }

  /**
   * GET /academic/pa/mahasiswa/:mahasiswaId/khs?semester=2024/2025 Ganjil
   * Lihat KHS mahasiswa bimbingan.
   */
  @Get('pa/mahasiswa/:mahasiswaId/khs')
  async getKhsByPA(
    @CurrentUser() user: User,
    @Param('mahasiswaId', ParseIntPipe) mahasiswaId: number,
    @Query() query: GetKhsDto,
  ) {
    this.assertDosen(user);
    return this.academicService.getKhsByPA(user.id, mahasiswaId, query.semester);
  }

  /**
   * GET /academic/pa/mahasiswa/:mahasiswaId/khs/download?semester=2024/2025 Ganjil
   * Download KHS PDF mahasiswa bimbingan.
   */
  @Get('pa/mahasiswa/:mahasiswaId/khs/download')
  async downloadKhsByPA(
    @CurrentUser() user: User,
    @Param('mahasiswaId', ParseIntPipe) mahasiswaId: number,
    @Query() query: GetKhsDto,
    @Res() res: Response,
  ) {
    this.assertDosen(user);
    const buffer = await this.academicService.downloadKhsByPA(user.id, mahasiswaId, query.semester);
    const filename = `KHS-PA-${mahasiswaId}-${query.semester.replace(/[\/\s]/g, '_')}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /**
   * GET /academic/pa/mahasiswa/:mahasiswaId/transkrip
   * Lihat transkrip mahasiswa bimbingan.
   */
  @Get('pa/mahasiswa/:mahasiswaId/transkrip')
  async getTranskripByPA(
    @CurrentUser() user: User,
    @Param('mahasiswaId', ParseIntPipe) mahasiswaId: number,
  ) {
    this.assertDosen(user);
    return this.academicService.getTranskripByPA(user.id, mahasiswaId);
  }

  /**
   * GET /academic/pa/mahasiswa/:mahasiswaId/transkrip/download
   * Download transkrip PDF mahasiswa bimbingan.
   */
  @Get('pa/mahasiswa/:mahasiswaId/transkrip/download')
  async downloadTranskripByPA(
    @CurrentUser() user: User,
    @Param('mahasiswaId', ParseIntPipe) mahasiswaId: number,
    @Res() res: Response,
  ) {
    this.assertDosen(user);
    const buffer = await this.academicService.downloadTranskripByPA(user.id, mahasiswaId);
    const filename = `Transkrip-PA-${mahasiswaId}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /**
   * GET /academic/pa/mahasiswa/:mahasiswaId/ringkasan
   * Ringkasan akademik mahasiswa untuk pertimbangan KRS:
   * IPK, IPS per semester, rekomendasi beban SKS, dsb.
   */
  @Get('pa/mahasiswa/:mahasiswaId/ringkasan')
  async getRingkasanAkademikByPA(
    @CurrentUser() user: User,
    @Param('mahasiswaId', ParseIntPipe) mahasiswaId: number,
  ) {
    this.assertDosen(user);
    return this.academicService.getRingkasanAkademikByPA(user.id, mahasiswaId);
  }

  // ==========================================
  // Helper
  // ==========================================

  private assertDosen(user: User) {
    const role = user.role as string;
    if (role !== 'DOSEN' && role !== 'KOORPRODI') {
      throw new ForbiddenException('Hanya dosen yang bisa mengakses fitur ini');
    }
  }
}