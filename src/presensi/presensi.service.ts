import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePresensiDto,
  SubmitPresensiDto,
  ManualPresensiDto,
} from './dto/presensi.dto';
import {
  User,
  SessionType,
  Role,
  AttendanceStatus,
  StatusKRS,
} from '@prisma/client';

@Injectable()
export class PresensiService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // 1. GENERATE SESSION + TOKEN (LECTURER)
  // ============================================
  async createSession(dto: CreatePresensiDto, user: User) {
    if (user.role === Role.MAHASISWA)
      throw new ForbiddenException('Akses ditolak');

    // Validate Logic for Class/Final Exam (Same as before)
    if (dto.type === SessionType.KELAS) {
      if (!dto.kelasPerkuliahanId)
        throw new BadRequestException('ID Kelas wajib diisi');

      // Validate Class Owner
      if (user.role === Role.DOSEN) {
        const kelas = await this.prisma.kelasPerkuliahan.findUnique({
          where: { id: dto.kelasPerkuliahanId },
        });
        if (!kelas || kelas.dosenId !== user.id)
          throw new ForbiddenException('Bukan kelas Anda.');
      }

      // Validate Max 16 sessions
      const count = await this.prisma.presensiSession.count({
        where: {
          kelasPerkuliahanId: dto.kelasPerkuliahanId,
          type: SessionType.KELAS,
        },
      });
      if (count >= 16) throw new BadRequestException('Maksimal 16 pertemuan.');
    }

    if (dto.type === SessionType.UAS) {
      if (!dto.kelasPerkuliahanId)
        throw new BadRequestException('ID Kelas wajib diisi');
      // Validate Class Owner for UAS: only dosen pemilik kelas boleh buat UAS
      if (user.role === Role.DOSEN) {
        const kelas = await this.prisma.kelasPerkuliahan.findUnique({
          where: { id: dto.kelasPerkuliahanId },
        });
        if (!kelas || kelas.dosenId !== user.id)
          throw new ForbiddenException('Bukan kelas Anda.');
      }

      const exists = await this.prisma.presensiSession.findFirst({
        where: {
          kelasPerkuliahanId: dto.kelasPerkuliahanId,
          type: SessionType.UAS,
        },
      });
      if (exists) throw new BadRequestException('UAS sudah dibuat.');
    }

    // GENERATE TOKEN (8 UPPERCASE LETTERS & NUMBERS)
    const token = this.generateToken(8);

    // Process Deadline (combine deadlineDate and deadlineTime)
    let deadlineAt: Date | null = null;
    if (dto.deadlineDate && dto.deadlineTime) {
      try {
        const [hours, minutes] = dto.deadlineTime.split(':').map(Number);
        const deadline = new Date(dto.deadlineDate);
        deadline.setHours(hours, minutes, 0, 0);

        // Validasi deadline harus di masa depan
        if (deadline <= new Date()) {
          throw new BadRequestException('Deadline harus di masa depan.');
        }

        deadlineAt = deadline;
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          'Format deadline tidak valid. Gunakan YYYY-MM-DD untuk tanggal dan HH:mm untuk jam.',
        );
      }
    } else if (dto.deadlineDate || dto.deadlineTime) {
      throw new BadRequestException(
        'Baik deadlineDate maupun deadlineTime harus diisi bersama atau keduanya kosong.',
      );
    }

    return this.prisma.presensiSession.create({
      data: {
        title: dto.title,
        type: dto.type,
        kelasPerkuliahanId: dto.kelasPerkuliahanId || null,
        date: new Date(),
        isOpen: true,
        token: token, // Save token
        deadlineAt: deadlineAt, // Save deadline
      },
    });
  }

  // ============================================
  // 2. SUBMIT VIA TOKEN (STUDENT)
  // ============================================
  async submitPresensi(dto: SubmitPresensiDto, mahasiswa: User) {
    const normalizedToken = dto.token.trim().toUpperCase();

    const session = await this.prisma.presensiSession.findUnique({
      where: { token: normalizedToken },
    });
    if (!session)
      throw new NotFoundException('Sesi/token presensi tidak ditemukan.');
    if (!session.isOpen) throw new BadRequestException('Sesi sudah ditutup.');

    // VALIDATE DEADLINE
    if (session.deadlineAt && new Date() > session.deadlineAt) {
      throw new BadRequestException('Batas waktu presensi sudah terlewat.');
    }

    // Validate KRS & Final Exam Threshold
    if (session.type !== SessionType.EVENT) {
      const krs = await this.prisma.kRS.findFirst({
        where: {
          mahasiswaId: mahasiswa.id,
          status: StatusKRS.DISETUJUI,
          kelasPerkuliahan: {
            some: { id: session.kelasPerkuliahanId! },
          },
        },
      });
      if (!krs)
        throw new ForbiddenException('Anda tidak terdaftar di kelas ini.');

      if (session.type === SessionType.UAS) {
        if (session.kelasPerkuliahanId === null) {
          throw new BadRequestException(
            'ID Kelas tidak ditemukan untuk sesi UAS.',
          );
        }
        const rate = await this.calculateAttendanceRate(
          session.kelasPerkuliahanId,
          mahasiswa.id,
        );
        if (rate < 80)
          throw new ForbiddenException(
            `Kehadiran ${rate.toFixed(1)}% (Min 80%).`,
          );
      }
    }

    return this.recordAttendance(
      session.id,
      mahasiswa.id,
      'TOKEN',
      AttendanceStatus.HADIR,
    );
  }

  // ============================================
  // 3. MANUAL INPUT (LECTURER)
  // ============================================
  async manualPresensi(dto: ManualPresensiDto, dosen: User) {
    const session = await this.prisma.presensiSession.findUnique({
      where: { id: dto.sessionId },
      include: { kelasPerkuliahan: true },
    });

    if (!session) throw new NotFoundException('Sesi tidak ditemukan');

    if (dosen.role === Role.DOSEN) {
      if (
        session.kelasPerkuliahanId &&
        session.kelasPerkuliahan?.dosenId !== dosen.id
      ) {
        throw new ForbiddenException(
          'Anda tidak berhak melakukan presensi manual di kelas ini.',
        );
      }
    }

    const mahasiswa = await this.prisma.user.findUnique({
      where: { id: dto.mahasiswaId },
    });
    if (!mahasiswa || mahasiswa.role !== Role.MAHASISWA) {
      throw new NotFoundException('Mahasiswa invalid.');
    }

    // Upsert: Mark method as "MANUAL"
    return this.prisma.presensiRecord.upsert({
      where: {
        sessionId_mahasiswaId: {
          sessionId: dto.sessionId,
          mahasiswaId: dto.mahasiswaId,
        },
      },
      update: { method: 'MANUAL', status: dto.status, createdAt: new Date() },
      create: {
        sessionId: dto.sessionId,
        mahasiswaId: dto.mahasiswaId,
        method: 'MANUAL',
        status: dto.status,
      },
    });
  }

  // ============================================
  // 4. LIST PERTEMUAN PER KELAS (LECTURER)
  // ============================================
  async getSessionsByClass(kelasId: number, user: User) {
    if (user.role === Role.MAHASISWA)
      throw new ForbiddenException('Akses ditolak');

    const kelas = await this.prisma.kelasPerkuliahan.findUnique({
      where: { id: kelasId },
    });
    if (!kelas) throw new NotFoundException('Kelas tidak ditemukan');

    if (user.role === Role.DOSEN && kelas.dosenId !== user.id) {
      throw new ForbiddenException('Bukan kelas Anda.');
    }

    return this.prisma.presensiSession.findMany({
      where: { kelasPerkuliahanId: kelasId, type: SessionType.KELAS },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        title: true,
        date: true,
        isOpen: true,
        token: true,
        type: true,
      },
    });
  }

  // ============================================
  // 5. LIST MAHASISWA PER KELAS (+STATUS PER SESI)
  // ============================================
  async getClassStudents(kelasId: number, user: User, sessionId?: number) {
    if (user.role === Role.MAHASISWA)
      throw new ForbiddenException('Akses ditolak');

    const kelas = await this.prisma.kelasPerkuliahan.findUnique({
      where: { id: kelasId },
    });
    if (!kelas) throw new NotFoundException('Kelas tidak ditemukan');

    if (user.role === Role.DOSEN && kelas.dosenId !== user.id) {
      throw new ForbiddenException('Bukan kelas Anda.');
    }

    const krsList = await this.prisma.kRS.findMany({
      where: {
        status: StatusKRS.DISETUJUI,
        kelasPerkuliahan: { some: { id: kelasId } },
      },
      include: {
        mahasiswa: {
          select: { id: true, name: true, nim: true, email: true },
        },
      },
    });

    const mahasiswaList = krsList.map((krs) => krs.mahasiswa);

    if (!sessionId) {
      return mahasiswaList;
    }

    const records = await this.prisma.presensiRecord.findMany({
      where: { sessionId, mahasiswaId: { in: mahasiswaList.map((m) => m.id) } },
      select: {
        mahasiswaId: true,
        status: true,
        method: true,
        createdAt: true,
      },
    });

    const recordMap = new Map(
      records.map((record) => [record.mahasiswaId, record]),
    );

    return mahasiswaList.map((mhs) => ({
      ...mhs,
      presensi: recordMap.get(mhs.id) || null,
    }));
  }

  // ============================================
  // 6. LIST PENGISI PRESENSI PER SESI
  // ============================================
  async getSessionAttendances(
    sessionId: number,
    user: User,
    method?: 'TOKEN' | 'MANUAL',
  ) {
    if (user.role === Role.MAHASISWA)
      throw new ForbiddenException('Akses ditolak');

    const session = await this.prisma.presensiSession.findUnique({
      where: { id: sessionId },
      include: { kelasPerkuliahan: true },
    });

    if (!session) throw new NotFoundException('Sesi tidak ditemukan');

    if (
      user.role === Role.DOSEN &&
      session.kelasPerkuliahanId &&
      session.kelasPerkuliahan?.dosenId !== user.id
    ) {
      throw new ForbiddenException(
        'Anda tidak berhak melihat presensi kelas ini.',
      );
    }

    return this.prisma.presensiRecord.findMany({
      where: {
        sessionId,
        ...(method ? { method } : {}),
      },
      include: {
        mahasiswa: {
          select: {
            id: true,
            name: true,
            nim: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ============================================
  // 7. BATALKAN KEHADIRAN MAHASISWA
  // ============================================
  async revokeAttendance(sessionId: number, mahasiswaId: number, user: User) {
    if (user.role === Role.MAHASISWA)
      throw new ForbiddenException('Akses ditolak');

    const session = await this.prisma.presensiSession.findUnique({
      where: { id: sessionId },
      include: { kelasPerkuliahan: true },
    });

    if (!session) throw new NotFoundException('Sesi tidak ditemukan');

    if (
      user.role === Role.DOSEN &&
      session.kelasPerkuliahanId &&
      session.kelasPerkuliahan?.dosenId !== user.id
    ) {
      throw new ForbiddenException(
        'Anda tidak berhak membatalkan presensi kelas ini.',
      );
    }

    const existing = await this.prisma.presensiRecord.findUnique({
      where: { sessionId_mahasiswaId: { sessionId, mahasiswaId } },
    });

    if (!existing) {
      throw new NotFoundException(
        'Data presensi mahasiswa tidak ditemukan di sesi ini.',
      );
    }

    await this.prisma.presensiRecord.delete({
      where: { sessionId_mahasiswaId: { sessionId, mahasiswaId } },
    });

    return { message: 'Presensi mahasiswa berhasil dibatalkan.' };
  }

  // --- Helpers ---

  // Helper: Generate Token
  private generateToken(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async recordAttendance(
    sessionId: number,
    mahasiswaId: number,
    method: string,
    status: AttendanceStatus,
  ) {
    const existing = await this.prisma.presensiRecord.findUnique({
      where: { sessionId_mahasiswaId: { sessionId, mahasiswaId } },
    });
    if (existing) throw new BadRequestException('Sudah presensi.');

    return this.prisma.presensiRecord.create({
      data: { sessionId, mahasiswaId, method, status },
    });
  }

  private async calculateAttendanceRate(
    kelasId: number,
    mhsId: number,
  ): Promise<number> {
    const totalSessions = await this.prisma.presensiSession.count({
      where: { kelasPerkuliahanId: kelasId, type: SessionType.KELAS },
    });
    if (totalSessions === 0) return 100;

    const presentCount = await this.prisma.presensiRecord.count({
      where: {
        mahasiswaId: mhsId,
        session: { kelasPerkuliahanId: kelasId, type: SessionType.KELAS },
      },
    });

    return (presentCount / totalSessions) * 100;
  }
}
