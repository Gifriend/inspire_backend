import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { NilaiService } from './nilai.service';
import { InputNilaiDto, BatchInputNilaiDto } from './dto/nilai.dto';
import { JwtAuthGuard } from '../auth/strategy/jwt-auth.guard';
import { Request } from 'express';

interface AuthRequest extends Request {
  user: { id: number; role: string };
}

@Controller('nilai')
@UseGuards(JwtAuthGuard)
export class NilaiController {
  constructor(private readonly nilaiService: NilaiService) {}

  /**
   * GET /nilai/kelas
   * Daftar kelas yang diampu dosen (untuk dropdown / pilih kelas).
   */
  @Get('kelas')
  async getKelasDosen(@Req() req: AuthRequest) {
    this.assertDosen(req);
    return this.nilaiService.getKelasDosen(req.user.id);
  }

  /**
   * GET /nilai/kelas/:kelasId
   * Daftar mahasiswa + nilai di suatu kelas perkuliahan.
   * Hanya bisa diakses oleh dosen pengampu kelas tersebut.
   */
  @Get('kelas/:kelasId')
  async getNilaiByKelas(
    @Req() req: AuthRequest,
    @Param('kelasId', ParseIntPipe) kelasId: number,
  ) {
    this.assertDosen(req);
    return this.nilaiService.getNilaiByKelas(req.user.id, kelasId);
  }

  /**
   * POST /nilai/input
   * Input/update nilai satu mahasiswa.
   * Dosen mengirim: { mahasiswaId, mataKuliahId, academicYear, nilaiTugas, nilaiUTS, nilaiUAS }
   * Backend auto-hitung: nilaiAkhir, nilaiHuruf, indeksNilai, status.
   * Otomatis update IPK & totalSksLulus di profil mahasiswa.
   */
  @Post('input')
  async inputNilai(
    @Req() req: AuthRequest,
    @Body() dto: InputNilaiDto,
  ) {
    this.assertDosen(req);
    return this.nilaiService.inputNilai(req.user.id, dto);
  }

  /**
   * POST /nilai/input/batch
   * Input nilai banyak mahasiswa sekaligus.
   * Body: { items: [ { mahasiswaId, mataKuliahId, academicYear, nilaiTugas, nilaiUTS, nilaiUAS }, ... ] }
   */
  @Post('input/batch')
  async inputNilaiBatch(
    @Req() req: AuthRequest,
    @Body() dto: BatchInputNilaiDto,
  ) {
    this.assertDosen(req);
    return this.nilaiService.inputNilaiBatch(req.user.id, dto.items);
  }

  // Helper: pastikan role = DOSEN atau KOORPRODI
  private assertDosen(req: AuthRequest) {
    if (req.user.role !== 'DOSEN' && req.user.role !== 'KOORPRODI') {
      throw new ForbiddenException('Hanya dosen yang bisa mengakses penilaian');
    }
  }
}
