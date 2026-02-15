// academic.controller.ts
import {
  Controller,
  Get,
  Query,
  Res,
  Request,
  UseGuards,
  Header,
} from '@nestjs/common';
import { AcademicService } from './academic.service';
import { GetKhsDto } from './dto/academic.dto';
import { Response } from 'express';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { User } from 'src/auth/entities/user.entity'; // Sesuaikan path entity User kamu
import { JwtAuthGuard } from 'src/auth/strategy/jwt-auth.guard'; // Sesuaikan path Guard kamu

@UseGuards(JwtAuthGuard)
@Controller('academic')
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  @Get('khs/semesters')
  async getSemesters(@CurrentUser() user: User) {
    // Mengambil daftar semester yang pernah dilalui mahasiswa ini
    return this.academicService.getStudentSemesters(user.id);
  }

  // KHS JSON
  @Get('khs')
  async getKhs(@Query() query: GetKhsDto, @CurrentUser() user: User) {
    // UPDATED: Menggunakan user.id dari token login, bukan hardcode
    return this.academicService.getKhs(user.id, query.semester);
  }

  //KHS HTML
  @Get('khs/download')
  async downloadKhs(
    @Query() query: GetKhsDto,
    @CurrentUser() user: User, 
    @Res() res: Response,
  ) {
    const htmlContent = await this.academicService.generateKhsHtml(
      user.id,
      query.semester,
    );

    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
  }

  @Get('transkrip')
  async getMyTranskrip(@CurrentUser() user: User) {
    return this.academicService.getTranskrip(user.id);
  }

  @Get('transkrip/download')
  @Header('Content-Type', 'text/html')
  async downloadTranskrip(@CurrentUser() user: User) {
    return this.academicService.generateTranskripHtml(user.id);
  }
}