import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusKRS } from '@prisma/client'; // Import Enum from Prisma Client
import { AddClassDto } from './dto/add-class.dto';
import { SubmitKrsDto } from './dto/submit-krs.dto';

@Injectable()
export class KrsService {
  constructor(private prisma: PrismaService) {}

  private normalizeAcademicYear(input?: string) {
    const trimmed = (input || '').trim();
    const currentYear = new Date().getFullYear();

    if (!trimmed) {
      return {
        canonical: `${currentYear - 1}/${currentYear} Genap`,
        semesterType: 'GENAP' as const,
      };
    }

    const dbFormatMatch = trimmed.match(
      /^(\d{4})\/(\d{4})\s+(Genap|Ganjil)$/i,
    );
    if (dbFormatMatch) {
      const semesterType =
        dbFormatMatch[3].toUpperCase() === 'GENAP' ? 'GENAP' : 'GANJIL';
      const rightYear = parseInt(dbFormatMatch[2], 10);
      const semesterDisplay = semesterType === 'GENAP' ? 'Genap' : 'Ganjil';

      return {
        canonical: `${rightYear - 1}/${rightYear} ${semesterDisplay}`,
        semesterType,
      };
    }

    const shortMatch = trimmed.match(/^(GENAP|GANJIL)(?:-(\d{4}))?$/i);
    if (shortMatch) {
      const semesterType = shortMatch[1].toUpperCase() as 'GENAP' | 'GANJIL';
      const rightYear = shortMatch[2]
        ? parseInt(shortMatch[2], 10)
        : currentYear;
      const semesterDisplay = semesterType === 'GENAP' ? 'Genap' : 'Ganjil';

      return {
        canonical: `${rightYear - 1}/${rightYear} ${semesterDisplay}`,
        semesterType,
      };
    }

    throw new BadRequestException(
      'Format academicYear tidak valid. Gunakan GENAP-2026, GANJIL-2026, GENAP, GANJIL, atau 2025/2026 Genap.',
    );
  }

  // Helper: Get active KRS or create new one (DRAFT)
  async getOrCreateKrs(mahasiswaId: number, academicYear: string) {
    const normalizedAcademicYear =
      this.normalizeAcademicYear(academicYear).canonical;

    // Check if KRS already exists
    let krs = await this.prisma.kRS.findUnique({
      where: {
        mahasiswaId_academicYear: {
          // Composite key from Prisma schema
          mahasiswaId,
          academicYear: normalizedAcademicYear,
        },
      },
      include: {
        kelasPerkuliahan: {
          include: { mataKuliah: true, dosen: true },
        },
      },
    });

    // If not exists, create new one
    if (!krs) {
      krs = await this.prisma.kRS.create({
        data: {
          mahasiswaId,
          academicYear: normalizedAcademicYear,
          status: StatusKRS.DRAFT,
          totalSKS: 0,
        },
        include: {
          kelasPerkuliahan: {
            include: { mataKuliah: true, dosen: true },
          },
        },
      });
    }

    return krs;
  }

  async addClassToKrs(mahasiswaId: number, dto: AddClassDto) {
    // 1. Validate Student
    const user = await this.prisma.user.findUnique({
      where: { id: mahasiswaId },
    });
    if (!user || user.role !== 'MAHASISWA') {
      throw new ForbiddenException('Hanya mahasiswa yang bisa tambah kelas');
    }

    // 2. Get the class to be taken to check SKS & Capacity
    const targetKelas = await this.prisma.kelasPerkuliahan.findUnique({
      where: { id: dto.kelasId }, // Assuming DTO sends ID (Int) not string
      include: { mataKuliah: true },
    });

    if (!targetKelas) throw new NotFoundException('Kelas tidak ditemukan');

    // 3. Get Draft KRS
    const krs = await this.getOrCreateKrs(mahasiswaId, dto.semester);

    if (krs.status !== StatusKRS.DRAFT) {
      throw new BadRequestException(
        'KRS sudah diajukan/disetujui, tidak bisa tambah kelas',
      );
    }

    // 4. Check for Duplicates (Is this class already taken?)
    const alreadyExists = krs.kelasPerkuliahan.some(
      (k) => k.id === dto.kelasId,
    );
    if (alreadyExists) {
      throw new BadRequestException('Kelas sudah terdaftar di KRS Anda');
    }

    // 5. Update KRS: Connect Class & Update Total SKS
    // Prisma automatically handles join table (many-to-many)
    const updatedKrs = await this.prisma.kRS.update({
      where: { id: krs.id },
      data: {
        totalSKS: { increment: targetKelas.mataKuliah.sks },
        kelasPerkuliahan: {
          connect: { id: dto.kelasId },
        },
      },
      include: { kelasPerkuliahan: true },
    });

    return updatedKrs;
  }

  async submitKrs(mahasiswaId: number, dto: SubmitKrsDto) {
    const krs = await this.getOrCreateKrs(mahasiswaId, dto.semester);

    if (krs.status !== StatusKRS.DRAFT) {
      throw new BadRequestException('KRS sudah diajukan sebelumnya');
    }

    if (krs.kelasPerkuliahan.length === 0) {
      throw new BadRequestException(
        'Pilih minimal 1 mata kuliah sebelum submit',
      );
    }

    return this.prisma.kRS.update({
      where: { id: krs.id },
      data: {
        status: StatusKRS.DIAJUKAN,
        tanggalPengajuan: new Date(),
      },
    });
  }

  async getKrs(mahasiswaId: number, semester: string) {
    return this.getOrCreateKrs(mahasiswaId, semester);
  }

  // --- LECTURER (DOSEN PA) FEATURES ---

  /**
   * Verifikasi bahwa dosen adalah PA dari mahasiswa yang memiliki KRS ini.
   * Mengembalikan KRS yang sudah di-load beserta data mahasiswanya.
   */
  private async verifyPAForKrs(dosenId: number, krsId: number) {
    const dosen = await this.prisma.user.findUnique({
      where: { id: dosenId },
    });

    if (!dosen || (dosen.role !== 'DOSEN' && dosen.role !== 'KOORPRODI')) {
      throw new ForbiddenException(
        'Hanya Dosen atau Koorprodi yang dapat mengakses fitur ini',
      );
    }

    const krs = await this.prisma.kRS.findUnique({
      where: { id: krsId },
      include: {
        mahasiswa: { select: { id: true, name: true, nim: true, dosenPAId: true } },
        kelasPerkuliahan: { include: { mataKuliah: true, dosen: true } },
      },
    });

    if (!krs) throw new NotFoundException('KRS tidak ditemukan');

    // Cek apakah dosen ini adalah Pembimbing Akademik dari mahasiswa pemilik KRS
    if (krs.mahasiswa.dosenPAId !== dosenId) {
      throw new ForbiddenException(
        'Anda bukan Pembimbing Akademik dari mahasiswa ini. Hanya dosen PA yang dapat approve/reject KRS.',
      );
    }

    return krs;
  }

  /**
   * Daftar KRS mahasiswa bimbingan PA (untuk dosen melihat KRS yang perlu di-review).
   * Bisa filter berdasarkan status (DIAJUKAN, DISETUJUI, DITOLAK, DRAFT) dan academicYear.
   */
  async getKrsMahasiswaBimbingan(
    dosenId: number,
    statusFilter?: string,
    academicYear?: string,
  ) {
    const dosen = await this.prisma.user.findUnique({
      where: { id: dosenId },
    });
    if (!dosen || (dosen.role !== 'DOSEN' && dosen.role !== 'KOORPRODI')) {
      throw new ForbiddenException('Hanya dosen yang bisa mengakses fitur ini');
    }

    // Cari semua mahasiswa bimbingan PA dosen ini
    const mahasiswaIds = await this.prisma.user.findMany({
      where: { dosenPAId: dosenId, role: 'MAHASISWA' },
      select: { id: true },
    });

    const where: any = {
      mahasiswaId: { in: mahasiswaIds.map((m) => m.id) },
    };

    if (statusFilter) {
      where.status = statusFilter as StatusKRS;
    }

    if (academicYear) {
      where.academicYear = this.normalizeAcademicYear(academicYear).canonical;
    }

    const krsList = await this.prisma.kRS.findMany({
      where,
      include: {
        mahasiswa: {
          select: { id: true, name: true, nim: true, ipk: true, totalSksLulus: true },
        },
        kelasPerkuliahan: {
          include: { mataKuliah: { select: { kode: true, name: true, sks: true } } },
        },
      },
      orderBy: [
        { status: 'asc' },        // DIAJUKAN dulu
        { tanggalPengajuan: 'desc' },
      ],
    });

    return krsList.map((krs) => ({
      id: krs.id,
      academicYear: krs.academicYear,
      status: krs.status,
      totalSKS: krs.totalSKS,
      tanggalPengajuan: krs.tanggalPengajuan,
      tanggalPersetujuan: krs.tanggalPersetujuan,
      catatanDosen: krs.catatanDosen,
      mahasiswa: {
        id: krs.mahasiswa.id,
        nama: krs.mahasiswa.name,
        nim: krs.mahasiswa.nim ?? '-',
        ipk: krs.mahasiswa.ipk ?? 0,
        totalSksLulus: krs.mahasiswa.totalSksLulus ?? 0,
      },
      matakuliah: krs.kelasPerkuliahan.map((kp) => ({
        kelasId: kp.id,
        kodeMK: kp.mataKuliah.kode,
        namaMK: kp.mataKuliah.name,
        sks: kp.mataKuliah.sks,
      })),
    }));
  }

  /**
   * Detail KRS mahasiswa tertentu (untuk dosen PA melihat detail sebelum approve).
   */
  async getKrsDetailByPA(dosenId: number, krsId: number) {
    const krs = await this.verifyPAForKrs(dosenId, krsId);

    return {
      id: krs.id,
      academicYear: krs.academicYear,
      status: krs.status,
      totalSKS: krs.totalSKS,
      tanggalPengajuan: krs.tanggalPengajuan,
      tanggalPersetujuan: krs.tanggalPersetujuan,
      catatanDosen: krs.catatanDosen,
      mahasiswa: {
        id: krs.mahasiswa.id,
        nama: krs.mahasiswa.name,
        nim: krs.mahasiswa.nim ?? '-',
      },
      kelasPerkuliahan: krs.kelasPerkuliahan.map((kp) => ({
        kelasId: kp.id,
        kodeMK: kp.mataKuliah.kode,
        namaMK: kp.mataKuliah.name,
        sks: kp.mataKuliah.sks,
        namaKelas: kp.nama,
        dosenPengampu: kp.dosen.name,
      })),
    };
  }

  async approveKrs(dosenId: number, krsId: number, catatan?: string) {
    // Verifikasi bahwa dosen adalah PA dari mahasiswa pemilik KRS
    const krs = await this.verifyPAForKrs(dosenId, krsId);

    if (krs.status !== StatusKRS.DIAJUKAN) {
      throw new BadRequestException(
        `KRS tidak bisa disetujui karena status saat ini: ${krs.status}`,
      );
    }

    return this.prisma.kRS.update({
      where: { id: krsId },
      data: {
        status: StatusKRS.DISETUJUI,
        tanggalPersetujuan: new Date(),
        catatanDosen: catatan || 'Disetujui',
      },
    });
  }

  async rejectKrs(dosenId: number, krsId: number, catatan: string) {
    // Verifikasi bahwa dosen adalah PA dari mahasiswa pemilik KRS
    const krs = await this.verifyPAForKrs(dosenId, krsId);

    if (krs.status !== StatusKRS.DIAJUKAN) {
      throw new BadRequestException(
        `KRS tidak bisa ditolak karena status saat ini: ${krs.status}`,
      );
    }

    return this.prisma.kRS.update({
      where: { id: krsId },
      data: {
        status: StatusKRS.DITOLAK,
        catatanDosen: catatan,
      },
    });
  }

  async cancelKrs(dosenId: number, krsId: number, catatan: string) {
    // Verifikasi bahwa dosen adalah PA dari mahasiswa pemilik KRS
    const krs = await this.verifyPAForKrs(dosenId, krsId);

    if (krs.status !== StatusKRS.DISETUJUI) {
      throw new BadRequestException(
        `KRS tidak bisa dibatalkan karena status saat ini: ${krs.status}`,
      );
    }

    return this.prisma.kRS.update({
      where: { id: krsId },
      data: {
        status: StatusKRS.DRAFT,
        catatanDosen: catatan,
        tanggalPersetujuan: null,
      },
    });
  }

  async getAvailableCourses(mahasiswaId: number, academicYearInput?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: mahasiswaId },
    });
    if (!user || user.role !== 'MAHASISWA') {
      throw new ForbiddenException(
        'Hanya mahasiswa yang bisa akses mata kuliah tersedia',
      );
    }

    const normalized = this.normalizeAcademicYear(academicYearInput);
    const normalizedAcademicYear = normalized.canonical;
    const semesterType = normalized.semesterType;
    const semesterNumbers =
      semesterType === 'GENAP' ? [2, 4, 6, 8] : [1, 3, 5, 7];
    const semesterDisplay = semesterType === 'GENAP' ? 'Genap' : 'Ganjil';

    let activeAcademicYear = normalizedAcademicYear;

    let availableCourses = await this.prisma.kelasPerkuliahan.findMany({
      where: {
        mataKuliah: {
          semester: { in: semesterNumbers },
          // prodiId: user.prodiId, // Filter berdasarkan prodi mahasiswa
        },
        academicYear: activeAcademicYear,
      },
      include: {
        mataKuliah: true,
        dosen: true,
      },
    });

    if (availableCourses.length === 0) {
      const fallbackAcademicYear = await this.prisma.kelasPerkuliahan.findFirst({
        where: {
          academicYear: { endsWith: ` ${semesterDisplay}` },
          mataKuliah: {
            semester: { in: semesterNumbers },
          },
        },
        orderBy: { academicYear: 'desc' },
        select: { academicYear: true },
      });

      if (fallbackAcademicYear) {
        activeAcademicYear = fallbackAcademicYear.academicYear;
        availableCourses = await this.prisma.kelasPerkuliahan.findMany({
          where: {
            mataKuliah: {
              semester: { in: semesterNumbers },
            },
            academicYear: activeAcademicYear,
          },
          include: {
            mataKuliah: true,
            dosen: true,
          },
        });
      }
    }

    const currentKrs = await this.prisma.kRS.findMany({
      where: { mahasiswaId, academicYear: activeAcademicYear },
      include: { kelasPerkuliahan: true },
    });
    const takenCourseIds = currentKrs.flatMap((krs) =>
      krs.kelasPerkuliahan.map((k) => k.id),
    );

    const filteredCourses = availableCourses.filter(
      (course) => !takenCourseIds.includes(course.id),
    );

    return filteredCourses;
  }
}
