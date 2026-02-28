import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  MonthlyScheduleResponseDto,
  ScheduleEventDto,
} from './dto/schedule.dto';

// ========== HELPERS ==========

const HARI_MAP: Record<string, number> = {
  Minggu: 0, Senin: 1, Selasa: 2, Rabu: 3,
  Kamis: 4, Jumat: 5, Sabtu: 6,
};

const HARI_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const MONTH_NAMES = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

interface ParsedJadwal {
  dayIndex: number; // 0=Minggu … 6=Sabtu
  dayName: string;
  startTime: string; // "08:00"
  endTime: string;   // "10:00"
}

/** Parse "Senin 08:00-10:00" → structured object (null if invalid) */
function parseJadwal(raw: string | null): ParsedJadwal | null {
  if (!raw) return null;
  const match = raw.match(/^(\w+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
  if (!match) return null;
  const dayName = match[1];
  const dayIndex = HARI_MAP[dayName];
  if (dayIndex === undefined) return null;
  return { dayIndex, dayName, startTime: match[2], endTime: match[3] };
}

/** Get all dates in a month that fall on a given dayOfWeek (0-6). */
function datesForDayInMonth(year: number, month: number, dayOfWeek: number): Date[] {
  const dates: Date[] = [];
  const d = new Date(year, month - 1, 1); // month is 0-indexed in JS
  // Jump to first occurrence of dayOfWeek
  while (d.getDay() !== dayOfWeek) d.setDate(d.getDate() + 1);
  while (d.getMonth() === month - 1) {
    dates.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return dates;
}

/** Format Date → "2026-02-03" */
function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Build a Google Calendar deep-link for a single event. */
function buildGoogleCalendarUrl(title: string, date: Date, startTime: string, endTime: string, location: string | null, description: string): string {
  const dateStr = isoDate(date).replace(/-/g, '');
  const start = `${dateStr}T${startTime.replace(':', '')}00`;
  const end = `${dateStr}T${endTime.replace(':', '')}00`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    details: description,
    ctz: 'Asia/Jakarta',
  });
  if (location) params.set('location', location);
  return `https://calendar.google.com/calendar/event?${params.toString()}`;
}

/** Build an iCal VEVENT block. */
function icalEvent(uid: string, title: string, date: Date, startTime: string, endTime: string, location: string | null, description: string): string {
  const dateStr = isoDate(date).replace(/-/g, '');
  const dtStart = `${dateStr}T${startTime.replace(':', '')}00`;
  const dtEnd = `${dateStr}T${endTime.replace(':', '')}00`;
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=Asia/Jakarta:${dtStart}`,
    `DTEND;TZID=Asia/Jakarta:${dtEnd}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
  ];
  if (location) lines.push(`LOCATION:${location}`);
  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

// ========== SERVICE ==========

@Injectable()
export class ScheduleService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get the monthly schedule for a user (MAHASISWA or DOSEN).
   * - MAHASISWA: classes come from their approved KRS for the active academic year.
   * - DOSEN / KOORPRODI: classes they teach (KelasPerkuliahan.dosenId).
   */
  async getMonthlySchedule(
    userId: number,
    year: number,
    month: number,
    baseUrl: string,
  ): Promise<MonthlyScheduleResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    // Determine the active academic year from the seed convention
    const kelasList = await this.getKelasForUser(userId, user.role);

    const events: ScheduleEventDto[] = [];

    for (const kelas of kelasList) {
      const parsed = parseJadwal(kelas.jadwal);
      if (!parsed) continue;

      const dates = datesForDayInMonth(year, month, parsed.dayIndex);

      for (const date of dates) {
        const title = `${kelas.mataKuliah.name} — ${kelas.nama}`;
        const desc = `${kelas.mataKuliah.kode} | Dosen: ${kelas.dosen.name}` +
          (kelas.ruangan ? ` | Ruangan: ${kelas.ruangan}` : '');

        events.push({
          date: isoDate(date),
          dayName: parsed.dayName,
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          mataKuliah: kelas.mataKuliah.name,
          kodeMK: kelas.mataKuliah.kode,
          kelas: kelas.nama,
          ruangan: kelas.ruangan,
          dosenNama: kelas.dosen.name,
          googleCalendarUrl: buildGoogleCalendarUrl(title, date, parsed.startTime, parsed.endTime, kelas.ruangan, desc),
        });
      }
    }

    // Sort by date then startTime
    events.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

    return {
      year,
      month,
      monthName: MONTH_NAMES[month],
      role: user.role,
      totalEvents: events.length,
      events,
      icalUrl: `${baseUrl}/schedule/ical`,
    };
  }

  /**
   * Get today's schedule for a user.
   */
  async getTodaySchedule(userId: number, baseUrl: string) {
    const now = new Date();
    const result = await this.getMonthlySchedule(userId, now.getFullYear(), now.getMonth() + 1, baseUrl);
    const today = isoDate(now);
    return {
      date: today,
      dayName: HARI_NAMES[now.getDay()],
      events: result.events.filter((e) => e.date === today),
    };
  }

  /**
   * Generate a full iCal (.ics) file for the current semester's schedule.
   * Users can subscribe to this URL in Google Calendar → "Other calendars → From URL".
   */
  async generateIcal(userId: number): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const kelasList = await this.getKelasForUser(userId, user.role);

    // Generate recurring events for 6 months (one semester ~5 months)
    const now = new Date();
    const startMonth = now.getMonth() + 1;
    const startYear = now.getFullYear();

    const vevents: string[] = [];

    for (const kelas of kelasList) {
      const parsed = parseJadwal(kelas.jadwal);
      if (!parsed) continue;

      for (let offset = 0; offset < 6; offset++) {
        let m = startMonth + offset;
        let y = startYear;
        if (m > 12) { m -= 12; y += 1; }

        const dates = datesForDayInMonth(y, m, parsed.dayIndex);
        for (const date of dates) {
          const title = `${kelas.mataKuliah.name} — ${kelas.nama}`;
          const desc = `${kelas.mataKuliah.kode} | Dosen: ${kelas.dosen.name}`;
          const uid = `${kelas.id}-${isoDate(date)}@inspire`;
          vevents.push(icalEvent(uid, title, date, parsed.startTime, parsed.endTime, kelas.ruangan, desc));
        }
      }
    }

    const calName = user.role === 'MAHASISWA'
      ? `Jadwal Kuliah — ${user.name}`
      : `Jadwal Mengajar — ${user.name}`;

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//INSPIRE//Jadwal//ID',
      `X-WR-CALNAME:${calName}`,
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      ...vevents,
      'END:VCALENDAR',
    ].join('\r\n');
  }

  // ========== PRIVATE ==========

  private async getKelasForUser(userId: number, role: string) {
    if (role === 'MAHASISWA') {
      // Get classes from approved KRS
      const krs = await this.prisma.kRS.findMany({
        where: { mahasiswaId: userId, status: 'DISETUJUI' },
        include: {
          kelasPerkuliahan: {
            include: {
              mataKuliah: true,
              dosen: { select: { id: true, name: true, email: true } },
            },
          },
        },
        orderBy: { academicYear: 'desc' },
        take: 1, // latest semester
      });
      return krs.flatMap((k) => k.kelasPerkuliahan);
    }

    // DOSEN / KOORPRODI — classes they teach
    return this.prisma.kelasPerkuliahan.findMany({
      where: { dosenId: userId },
      include: {
        mataKuliah: true,
        dosen: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
