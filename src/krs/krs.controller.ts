import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
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
    // Default: gunakan semester saat ini jika tidak ada query
    let semesterType = 'GENAP'; // Default ke Genap
    let year = new Date().getFullYear().toString();

    // Jika ada query parameter, parse-nya
    if (academicYear) {
      const parts = academicYear.split('-');
      if (parts.length === 2) {
        semesterType = parts[0].toUpperCase();
        year = parts[1];
      } else if (parts.length === 1) {
        // Hanya semester type saja (misal: "GENAP")
        semesterType = parts[0].toUpperCase();
      }
    }

    // Validasi semester type
    if (!['GENAP', 'GANJIL'].includes(semesterType)) {
      throw new BadRequestException(
        'Tipe semester harus GENAP atau GANJIL. Contoh: ?academicYear=GENAP-2026 atau hanya ?academicYear=GENAP',
      );
    }

    // Konversi ke format database: "2025/2026 Genap"
    const semesterDisplay = semesterType === 'GENAP' ? 'Genap' : 'Ganjil';
    const prevYear = parseInt(year) - 1;
    const academicYearFormatted = `${prevYear}/${year} ${semesterDisplay}`;

    // Semester numbers untuk filter
    const semesterNumbers =
      semesterType === 'GENAP' ? [2, 4, 6, 8] : [1, 3, 5, 7];

    return this.krsService.getAvailableCourses(
      req.user.id,
      semesterNumbers,
      academicYearFormatted,
    );
  }

  @Get(':semester')
  async getKrs(@Req() req: AuthRequest, @Param('semester') semester: string) {
    return this.krsService.getKrs(req.user.id, semester);
  }

  @Post('approve/:krsId')
  async approveKrs(
    @Req() req: AuthRequest,
    @Param('krsId') krsId: number,
    @Body('catatan') catatan?: string,
  ) {
    if (req.user.role !== 'DOSEN')
      throw new ForbiddenException('Akses ditolak');
    return this.krsService.approveKrs(req.user.id, +krsId, catatan);
  }

  @Post('reject/:krsId')
  async rejectKrs(
    @Req() req: AuthRequest,
    @Param('krsId') krsId: number,
    @Body('catatan') catatan: string,
  ) {
    if (req.user.role !== 'DOSEN')
      throw new ForbiddenException('Akses ditolak');
    return this.krsService.rejectKrs(req.user.id, +krsId, catatan);
  }

  @Post('cancel/:krsId')
  async cancelKrs(
    @Req() req: AuthRequest,
    @Param('krsId') krsId: number,
    @Body('catatan') catatan: string,
  ) {
    if (req.user.role !== 'DOSEN')
      throw new ForbiddenException('Akses ditolak');
    return this.krsService.cancelKrs(req.user.id, +krsId, catatan);
  }
}
