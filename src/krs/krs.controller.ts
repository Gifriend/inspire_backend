import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
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

  @Get(':semester')
  async getKrs(@Req() req: AuthRequest, @Param('semester') semester: string) {
    return this.krsService.getKrs(req.user.id, semester);
  }

  @Post('approve/:krsId')
  async approveKrs(
    @Req() req: AuthRequest, 
    @Param('krsId') krsId: number, 
    @Body('catatan') catatan?: string
  ) {
    if (req.user.role !== 'DOSEN') throw new ForbiddenException('Akses ditolak');
    return this.krsService.approveKrs(req.user.id, +krsId, catatan);
  }

  @Post('reject/:krsId')
  async rejectKrs(
    @Req() req: AuthRequest, 
    @Param('krsId') krsId: number, 
    @Body('catatan') catatan: string
  ) {
    if (req.user.role !== 'DOSEN') throw new ForbiddenException('Akses ditolak');
    return this.krsService.rejectKrs(req.user.id, +krsId, catatan);
  }
}