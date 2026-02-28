import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InputNilaiDto, NilaiResponseDto, KelasNilaiResponseDto } from './dto/nilai.dto';

// ========== GRADE CONVERSION HELPERS ==========

/**
 * Hitung nilai akhir dari komponen (bobot: Tugas 30%, UTS 30%, UAS 40%).
 * Jika salah satu komponen null → skip perhitungan.
 */
function hitungNilaiAkhir(tugas?: number | null, uts?: number | null, uas?: number | null): number | null {
  if (tugas == null || uts == null || uas == null) return null;
  return parseFloat((tugas * 0.3 + uts * 0.3 + uas * 0.4).toFixed(2));
}

/** Konversi nilai akhir (0-100) ke huruf. null → 'N' (belum dinilai). */
function toNilaiHuruf(nilaiAkhir: number | null): string {
  if (nilaiAkhir == null) return 'N'; // Belum dinilai / dikosongkan dosen
  if (nilaiAkhir >= 80) return 'A';
  if (nilaiAkhir >= 76) return 'B+';
  if (nilaiAkhir >= 70) return 'B';
  if (nilaiAkhir >= 66) return 'C+';
  if (nilaiAkhir >= 60) return 'C';
  if (nilaiAkhir >= 50) return 'D';
  return 'E'; // < 50
}

/** Konversi nilai huruf ke indeks (bobot). 'N' → null (tidak masuk IPK). */
function toIndeksNilai(huruf: string | null): number | null {
  if (!huruf || huruf === 'N') return null; // N = belum dinilai, tidak masuk IPK
  const map: Record<string, number> = {
    'A': 4.0, 'A-': 3.75, 'B+': 3.5, 'B': 3.0, 'B-': 2.75,
    'C+': 2.5, 'C': 2.0, 'D': 1.0, 'E': 0.0,
  };
  return map[huruf] ?? null;
}

// ========== SERVICE ==========

@Injectable()
export class NilaiService {
  constructor(private prisma: PrismaService) {}

  /**
   * GET daftar mahasiswa + nilai di suatu kelas perkuliahan.
   * Hanya dosen pengampu kelas yang bisa melihat.
   */
  async getNilaiByKelas(dosenId: number, kelasId: number): Promise<KelasNilaiResponseDto> {
    const kelas = await this.prisma.kelasPerkuliahan.findUnique({
      where: { id: kelasId },
      include: {
        mataKuliah: true,
        dosen: { select: { id: true, name: true } },
        krs: {
          where: { status: 'DISETUJUI' },
          include: {
            mahasiswa: { select: { id: true, name: true, nim: true } },
          },
        },
      },
    });

    if (!kelas) throw new NotFoundException('Kelas tidak ditemukan');
    if (kelas.dosenId !== dosenId) throw new ForbiddenException('Anda bukan dosen pengampu kelas ini');

    // Collect unique mahasiswa from approved KRS
    const mahasiswaMap = new Map<number, { id: number; name: string; nim: string | null }>();
    for (const krs of kelas.krs) {
      const mhs = krs.mahasiswa;
      if (!mahasiswaMap.has(mhs.id)) {
        mahasiswaMap.set(mhs.id, mhs);
      }
    }

    // Get existing Nilai records for these mahasiswa + this matakuliah + academicYear
    const mahasiswaIds = Array.from(mahasiswaMap.keys());
    const existingNilai = await this.prisma.nilai.findMany({
      where: {
        mahasiswaId: { in: mahasiswaIds },
        mataKuliahId: kelas.mataKuliahId,
        academicYear: kelas.academicYear,
      },
    });

    const nilaiMap = new Map<number, typeof existingNilai[0]>();
    for (const n of existingNilai) {
      nilaiMap.set(n.mahasiswaId, n);
    }

    // Build response
    const mahasiswaList: NilaiResponseDto[] = Array.from(mahasiswaMap.values())
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
      .map((mhs) => {
        const n = nilaiMap.get(mhs.id);
        return {
          id: n?.id ?? 0,
          mahasiswaId: mhs.id,
          namaMahasiswa: mhs.name,
          nim: mhs.nim ?? '-',
          mataKuliahId: kelas.mataKuliahId,
          kodeMK: kelas.mataKuliah.kode,
          namaMK: kelas.mataKuliah.name,
          sks: kelas.mataKuliah.sks,
          academicYear: kelas.academicYear,
          nilaiTugas: n?.nilaiTugas ?? null,
          nilaiUTS: n?.nilaiUTS ?? null,
          nilaiUAS: n?.nilaiUAS ?? null,
          nilaiAkhir: n?.nilaiAkhir ?? null,
          nilaiHuruf: n?.nilaiHuruf ?? null,
          indeksNilai: n?.indeksNilai ?? null,
          status: n?.status ?? 'BELUM_ADA',
        };
      });

    return {
      kelasId: kelas.id,
      namaKelas: kelas.nama,
      kodeMK: kelas.mataKuliah.kode,
      namaMK: kelas.mataKuliah.name,
      sks: kelas.mataKuliah.sks,
      academicYear: kelas.academicYear,
      dosenNama: kelas.dosen.name,
      mahasiswa: mahasiswaList,
    };
  }

  /**
   * Input/update nilai satu mahasiswa.
   * Auto-hitung nilaiAkhir, nilaiHuruf, indeksNilai.
   * Auto-update IPK & totalSksLulus di profil mahasiswa.
   */
  async inputNilai(dosenId: number, dto: InputNilaiDto): Promise<NilaiResponseDto> {
    // Verify dosen mengajar matakuliah ini di kelas yang sesuai
    await this.verifyDosenAccess(dosenId, dto.mataKuliahId, dto.academicYear);

    // Verify mahasiswa terdaftar di kelas dosen untuk MK ini
    await this.verifyMahasiswaEnrolled(dto.mahasiswaId, dto.mataKuliahId, dto.academicYear);

    // Calculate derived values
    const nilaiAkhir = hitungNilaiAkhir(dto.nilaiTugas, dto.nilaiUTS, dto.nilaiUAS);
    const nilaiHuruf = toNilaiHuruf(nilaiAkhir);
    const indeksNilai = toIndeksNilai(nilaiHuruf);
    // isComplete = true jika semua komponen terisi DAN bukan N
    const isComplete = nilaiAkhir !== null && nilaiHuruf !== 'N';

    // Upsert nilai
    const nilai = await this.prisma.nilai.upsert({
      where: {
        mahasiswaId_mataKuliahId_academicYear: {
          mahasiswaId: dto.mahasiswaId,
          mataKuliahId: dto.mataKuliahId,
          academicYear: dto.academicYear,
        },
      },
      update: {
        nilaiTugas: dto.nilaiTugas ?? undefined,
        nilaiUTS: dto.nilaiUTS ?? undefined,
        nilaiUAS: dto.nilaiUAS ?? undefined,
        nilaiAkhir,
        nilaiHuruf,
        indeksNilai,
        status: isComplete ? 'SUDAH_ADA' : 'BELUM_ADA',
      },
      create: {
        mahasiswaId: dto.mahasiswaId,
        mataKuliahId: dto.mataKuliahId,
        academicYear: dto.academicYear,
        nilaiTugas: dto.nilaiTugas ?? 0,
        nilaiUTS: dto.nilaiUTS ?? 0,
        nilaiUAS: dto.nilaiUAS ?? 0,
        nilaiAkhir,
        nilaiHuruf,
        indeksNilai,
        status: isComplete ? 'SUDAH_ADA' : 'BELUM_ADA',
      },
      include: {
        mahasiswa: { select: { id: true, name: true, nim: true } },
        mataKuliah: { select: { kode: true, name: true, sks: true } },
      },
    });

    // Auto-update IPK & totalSksLulus jika nilai lengkap
    if (isComplete) {
      await this.updateMahasiswaAcademicData(dto.mahasiswaId, dto.academicYear);
    }

    return {
      id: nilai.id,
      mahasiswaId: nilai.mahasiswaId,
      namaMahasiswa: nilai.mahasiswa.name,
      nim: nilai.mahasiswa.nim ?? '-',
      mataKuliahId: nilai.mataKuliahId,
      kodeMK: nilai.mataKuliah.kode,
      namaMK: nilai.mataKuliah.name,
      sks: nilai.mataKuliah.sks,
      academicYear: nilai.academicYear,
      nilaiTugas: nilai.nilaiTugas,
      nilaiUTS: nilai.nilaiUTS,
      nilaiUAS: nilai.nilaiUAS,
      nilaiAkhir: nilai.nilaiAkhir,
      nilaiHuruf: nilai.nilaiHuruf,
      indeksNilai: nilai.indeksNilai,
      status: nilai.status,
    };
  }

  /**
   * Input nilai banyak mahasiswa sekaligus (batch).
   */
  async inputNilaiBatch(dosenId: number, items: InputNilaiDto[]): Promise<{ success: number; results: NilaiResponseDto[] }> {
    if (!items.length) throw new BadRequestException('Items tidak boleh kosong');

    const results: NilaiResponseDto[] = [];
    for (const item of items) {
      const result = await this.inputNilai(dosenId, item);
      results.push(result);
    }

    return { success: results.length, results };
  }

  /**
   * GET daftar kelas yang diampu dosen (untuk dropdown pilih kelas).
   */
  async getKelasDosen(dosenId: number) {
    const kelasList = await this.prisma.kelasPerkuliahan.findMany({
      where: { dosenId },
      include: {
        mataKuliah: { select: { kode: true, name: true, sks: true } },
      },
      orderBy: { academicYear: 'desc' },
    });

    return kelasList.map((k) => ({
      kelasId: k.id,
      namaKelas: k.nama,
      kodeMK: k.mataKuliah.kode,
      namaMK: k.mataKuliah.name,
      sks: k.mataKuliah.sks,
      academicYear: k.academicYear,
    }));
  }

  // ========== PRIVATE HELPERS ==========

  /** Cek apakah dosen mengajar matakuliah ini di academic year tertentu */
  private async verifyDosenAccess(dosenId: number, mataKuliahId: number, academicYear: string) {
    const kelas = await this.prisma.kelasPerkuliahan.findFirst({
      where: { dosenId, mataKuliahId, academicYear },
    });
    if (!kelas) {
      throw new ForbiddenException('Anda tidak mengampu mata kuliah ini di semester tersebut');
    }
  }

  /** Cek apakah mahasiswa terdaftar di kelas untuk MK + academic year ini */
  private async verifyMahasiswaEnrolled(mahasiswaId: number, mataKuliahId: number, academicYear: string) {
    const krs = await this.prisma.kRS.findFirst({
      where: {
        mahasiswaId,
        academicYear,
        status: 'DISETUJUI',
        kelasPerkuliahan: {
          some: { mataKuliahId },
        },
      },
    });
    if (!krs) {
      throw new BadRequestException(`Mahasiswa ID ${mahasiswaId} tidak terdaftar di mata kuliah ini`);
    }
  }

  /** Update IPK & totalSksLulus di profil mahasiswa */
  private async updateMahasiswaAcademicData(mahasiswaId: number, academicYear: string) {
    try {
      const allGrades = await this.prisma.nilai.findMany({
        where: { mahasiswaId, status: 'SUDAH_ADA' },
        include: { mataKuliah: true },
      });

      // Best grade per MK (skip nilai 'N' — belum dinilai, tidak masuk IPK)
      const bestMap = new Map<string, typeof allGrades[0]>();
      for (const g of allGrades) {
        if (g.nilaiHuruf === 'N') continue; // N tidak masuk IPK
        const kode = g.mataKuliah.kode;
        const existing = bestMap.get(kode);
        if (!existing || (g.indeksNilai ?? 0) > (existing.indeksNilai ?? 0)) {
          bestMap.set(kode, g);
        }
      }

      let totalSks = 0;
      let totalBobot = 0;
      let totalSksLulus = 0;

      for (const g of bestMap.values()) {
        const sks = g.mataKuliah.sks;
        const idx = g.indeksNilai ?? 0;
        totalSks += sks;
        totalBobot += sks * idx;
        if (idx >= 2.0) totalSksLulus += sks; // minimal C
      }

      const ipk = totalSks > 0 ? parseFloat((totalBobot / totalSks).toFixed(2)) : 0;

      await this.prisma.user.update({
        where: { id: mahasiswaId },
        data: { ipk, totalSksLulus, semesterTerakhir: academicYear },
      });
    } catch (err) {
      console.error(`Failed to update academic data for student ${mahasiswaId}:`, err);
    }
  }
}
