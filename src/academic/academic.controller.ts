import {
  Controller,
  Get,
  Query,
  Res,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AcademicService } from './academic.service';
import { GetKhsDto } from './dto/academic.dto';
import { Response } from 'express';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { JwtAuthGuard } from 'src/auth/strategy/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('academic')
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  // Endpoint 1: LIHAT DATA (JSON)
  // URL: http://localhost:3000/academic/khs?semester=2024/2025 Ganjil
  // @UseGuards(JwtAuthGuard) // Aktifkan ini nanti
  @Get('khs')
  async getKhs(@Query() query: GetKhsDto, @Request() req) {
    // Mock user ID (Ganti dengan req.user.id jika Auth sudah aktif)
    const studentId = 1; // req.user.userId
    return this.academicService.getKhs(studentId, query.semester);
  }

  // Endpoint 2: DOWNLOAD (HTML/PDF)
  // URL: http://localhost:3000/academic/khs/download?semester=2024/2025 Ganjil
  // @UseGuards(JwtAuthGuard) // Aktifkan ini nanti
  @Get('khs/download')
  async downloadKhs(
    @Query() query: GetKhsDto,
    @Request() req,
    @Res() res: Response,
  ) {
    const studentId = 1; // req.user.userId
    const htmlContent = await this.academicService.generateKhsHtml(
      studentId,
      query.semester,
    );

    // Set header agar browser tahu ini file HTML yang bisa didownload/print
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
  }

  @Get('transkrip')
  async getMyTranskrip(@CurrentUser() user: User) {
    // Jika Dosen ingin lihat transkrip mahasiswa, logicnya beda (perlu param ID)
    // Di sini kita fokus untuk Mahasiswa melihat transkripnya sendiri
    return this.academicService.getTranskrip(user.id);
  }
}
