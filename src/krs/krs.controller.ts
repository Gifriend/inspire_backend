  import {
    Body,
    Controller,
    ForbiddenException,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Query,
    Req,
    UseGuards,
  } from '@nestjs/common';
  import { KrsService } from './krs.service';
  import { JwtAuthGuard } from '../auth/strategy/jwt-auth.guard';
  import { AddClassDto } from './dto/add-class.dto';
  import { SubmitKrsDto } from './dto/submit-krs.dto';
  import { Request } from 'express';

  interface AuthRequest extends Request {
    user: { id: number; role: string };
  }

  @Controller('krs')
  @UseGuards(JwtAuthGuard)
  export class KrsController {
    constructor(private krsService: KrsService) {}

    // ==========================================
    // MAHASISWA — Fitur KRS
    // ==========================================

    @Post('add-class')
    async addClass(@Req() req: AuthRequest, @Body() dto: AddClassDto) {
      return this.krsService.addClassToKrs(req.user.id, dto);
    }

    @Post('submit')
    async submitKrs(@Req() req: AuthRequest, @Body() dto: SubmitKrsDto) {
      return this.krsService.submitKrs(req.user.id, dto);
    }

    @Get('available-courses')
    async getAvailableCourses(
      @Req() req: AuthRequest,
      @Query('academicYear') academicYear?: string,
    ) {
      return this.krsService.getAvailableCourses(req.user.id, academicYear);
    }

    @Get(':academicYear')
    async getKrs(
      @Req() req: AuthRequest,
      @Param('academicYear') academicYear: string,
    ) {
      return this.krsService.getKrs(req.user.id, academicYear);
    }

    // ==========================================
    // DOSEN PA — Review & Approve/Reject KRS mahasiswa bimbingan
    // ==========================================

    /**
     * GET /krs/pa/mahasiswa
     * Daftar KRS mahasiswa bimbingan PA.
     * Query params optional: status (DIAJUKAN, DISETUJUI, DITOLAK, DRAFT), academicYear
     */
    @Get('pa/mahasiswa')
    async getKrsMahasiswaBimbingan(
      @Req() req: AuthRequest,
      @Query('status') status?: string,
      @Query('academicYear') academicYear?: string,
    ) {
      this.assertDosen(req);
      return this.krsService.getKrsMahasiswaBimbingan(req.user.id, status, academicYear);
    }

    /**
     * GET /krs/pa/detail/:krsId
     * Detail KRS tertentu (sebelum approve/reject).
     */
    @Get('pa/detail/:krsId')
    async getKrsDetailByPA(
      @Req() req: AuthRequest,
      @Param('krsId', ParseIntPipe) krsId: number,
    ) {
      this.assertDosen(req);
      return this.krsService.getKrsDetailByPA(req.user.id, krsId);
    }

    /**
     * POST /krs/approve/:krsId
     * Hanya dosen PA dari mahasiswa pemilik KRS yang bisa approve.
     */
    @Post('approve/:krsId')
    async approveKrs(
      @Req() req: AuthRequest,
      @Param('krsId', ParseIntPipe) krsId: number,
      @Body('catatan') catatan?: string,
    ) {
      this.assertDosen(req);
      return this.krsService.approveKrs(req.user.id, krsId, catatan);
    }

    /**
     * POST /krs/reject/:krsId
     * Hanya dosen PA dari mahasiswa pemilik KRS yang bisa reject.
     */
    @Post('reject/:krsId')
    async rejectKrs(
      @Req() req: AuthRequest,
      @Param('krsId', ParseIntPipe) krsId: number,
      @Body('catatan') catatan: string,
    ) {
      this.assertDosen(req);
      return this.krsService.rejectKrs(req.user.id, krsId, catatan);
    }

    /**
     * POST /krs/cancel/:krsId
     * Hanya dosen PA dari mahasiswa pemilik KRS yang bisa cancel.
     */
    @Post('cancel/:krsId')
    async cancelKrs(
      @Req() req: AuthRequest,
      @Param('krsId', ParseIntPipe) krsId: number,
      @Body('catatan') catatan: string,
    ) {
      this.assertDosen(req);
      return this.krsService.cancelKrs(req.user.id, krsId, catatan);
    }

    // ==========================================
    // Helper
    // ==========================================

    private assertDosen(req: AuthRequest) {
      if (req.user.role !== 'DOSEN' && req.user.role !== 'KOORPRODI') {
        throw new ForbiddenException('Hanya dosen yang bisa mengakses fitur ini');
      }
    }
  }
