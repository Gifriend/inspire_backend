import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ScheduleService } from './schedule.service';
import { GetMonthlyScheduleDto } from './dto/schedule.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { JwtAuthGuard } from 'src/auth/strategy/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  /**
   * GET /schedule/monthly?year=2026&month=2
   * Returns the monthly calendar with events for each date.
   * Works for both MAHASISWA and DOSEN.
   * If year/month are omitted, defaults to current month.
   */
  @Get('monthly')
  async getMonthlySchedule(
    @Query() query: GetMonthlyScheduleDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const now = new Date();
    const year = query.year ? parseInt(query.year) : now.getFullYear();
    const month = query.month ? parseInt(query.month) : now.getMonth() + 1;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return this.scheduleService.getMonthlySchedule(user.id, year, month, baseUrl);
  }

  /**
   * GET /schedule/today
   * Returns only today's classes.
   */
  @Get('today')
  async getTodaySchedule(
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return this.scheduleService.getTodaySchedule(user.id, baseUrl);
  }

  /**
   * GET /schedule/ical
   * Returns an iCal (.ics) file that can be subscribed to in Google Calendar.
   * 
   * How to use in Google Calendar:
   *   1. Copy the URL: {baseUrl}/schedule/ical?token=<jwt>
   *   2. Google Calendar → Settings → Add calendar → From URL
   *   3. Paste the URL → Add calendar
   *   4. Jadwal akan otomatis tampil di Google Calendar!
   */
  @Get('ical')
  async getIcal(
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const ical = await this.scheduleService.generateIcal(user.id);
    res.set({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="jadwal-kuliah.ics"',
    });
    res.send(ical);
  }
}
