import { IsOptional, IsNumberString } from 'class-validator';

export class GetMonthlyScheduleDto {
  @IsOptional()
  @IsNumberString()
  year?: string;

  @IsOptional()
  @IsNumberString()
  month?: string; // 1-12
}

/** Satu event jadwal pada suatu tanggal */
export class ScheduleEventDto {
  date: string;           // "2026-02-02"
  dayName: string;        // "Senin"
  startTime: string;      // "08:00"
  endTime: string;        // "10:00"
  mataKuliah: string;     // "Pemrograman Web"
  kodeMK: string;         // "IF201"
  kelas: string;          // "Pemrograman Web A"
  ruangan: string | null; // "Lab Komputer 1"
  dosenNama: string;      // "Dr. Budi Hartono"
  googleCalendarUrl: string; // Deep link to add to Google Calendar
}

/** Respons bulanan: daftar event per tanggal */
export class MonthlyScheduleResponseDto {
  year: number;
  month: number;
  monthName: string;
  role: string;             // "MAHASISWA" | "DOSEN"
  totalEvents: number;
  /** Map tanggal ISO → daftar event di hari itu */
  events: ScheduleEventDto[];
  /** URL iCal (.ics) untuk subscribe di Google Calendar */
  icalUrl: string;
}
