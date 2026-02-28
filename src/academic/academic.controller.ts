import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AcademicService } from './academic.service';
import { GetKhsDto } from './dto/academic.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { JwtAuthGuard } from 'src/auth/strategy/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('academic')
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

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
}