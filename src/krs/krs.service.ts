import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusKRS } from '@prisma/client'; // Import Enum dari Prisma Client
import { AddClassDto } from './dto/add-class.dto';
import { SubmitKrsDto } from './dto/submit-krs.dto';

@Injectable()
export class KrsService {
  constructor(private prisma: PrismaService) {}

  // Helper: Ambil KRS aktif atau buat baru (DRAFT)
  async getOrCreateKrs(mahasiswaId: number, semester: string) {
    // Cek apakah sudah ada KRS
    let krs = await this.prisma.kRS.findUnique({
      where: {
        mahasiswaId_semester: { // Composite key dari schema prisma
          mahasiswaId,
          semester,
        },
      },
      include: {
        kelasPerkuliahan: {
          include: { mataKuliah: true, dosen: true }
        }
      }
    });

    // Jika belum ada, buat baru
    if (!krs) {
      krs = await this.prisma.kRS.create({
        data: {
          mahasiswaId,
          semester,
          status: StatusKRS.DRAFT,
          totalSKS: 0,
        },
        include: {
          kelasPerkuliahan: {
            include: { mataKuliah: true, dosen: true }
          }
        }
      });
    }

    return krs;
  }

  async addClassToKrs(mahasiswaId: number, dto: AddClassDto) {
    // 1. Validasi Mahasiswa
    const user = await this.prisma.user.findUnique({ where: { id: mahasiswaId } });
    if (!user || user.role !== 'MAHASISWA') {
      throw new ForbiddenException('Hanya mahasiswa yang bisa tambah kelas');
    }

    // 2. Ambil Kelas yang mau diambil untuk cek SKS & Kapasitas
    const targetKelas = await this.prisma.kelasPerkuliahan.findUnique({
      where: { id: dto.kelasId }, // Asumsi DTO kirim ID (Int) bukan string
      include: { mataKuliah: true }
    });

    if (!targetKelas) throw new NotFoundException('Kelas tidak ditemukan');

    // 3. Ambil KRS Draf
    const krs = await this.getOrCreateKrs(mahasiswaId, dto.semester);

    if (krs.status !== StatusKRS.DRAFT) {
      throw new BadRequestException('KRS sudah diajukan/disetujui, tidak bisa tambah kelas');
    }

    // 4. Cek Duplikasi (Apakah kelas ini sudah diambil?)
    const alreadyExists = krs.kelasPerkuliahan.some(k => k.id === dto.kelasId);
    if (alreadyExists) {
      throw new BadRequestException('Kelas sudah terdaftar di KRS Anda');
    }

    // 5. Update KRS: Connect Kelas & Update Total SKS
    // Prisma otomatis menangani join table (many-to-many)
    const updatedKrs = await this.prisma.kRS.update({
      where: { id: krs.id },
      data: {
        totalSKS: { increment: targetKelas.mataKuliah.sks },
        kelasPerkuliahan: {
          connect: { id: dto.kelasId }
        }
      },
      include: { kelasPerkuliahan: true }
    });

    return updatedKrs;
  }

  async submitKrs(mahasiswaId: number, dto: SubmitKrsDto) {
    const krs = await this.getOrCreateKrs(mahasiswaId, dto.semester);

    if (krs.status !== StatusKRS.DRAFT) {
      throw new BadRequestException('KRS sudah diajukan sebelumnya');
    }

    if (krs.kelasPerkuliahan.length === 0) {
      throw new BadRequestException('Pilih minimal 1 mata kuliah sebelum submit');
    }

    return this.prisma.kRS.update({
      where: { id: krs.id },
      data: {
        status: StatusKRS.DIAJUKAN,
        tanggalPengajuan: new Date(),
      }
    });
  }

  async getKrs(mahasiswaId: number, semester: string) {
    return this.getOrCreateKrs(mahasiswaId, semester);
  }

  // --- FITUR DOSEN ---

  async approveKrs(dosenId: number, krsId: number, catatan?: string) {
    // Validasi Dosen (Optional jika sudah dihandle Guard)
    
    return this.prisma.kRS.update({
      where: { id: krsId },
      data: {
        status: StatusKRS.DISETUJUI,
        tanggalPersetujuan: new Date(),
        catatanDosen: catatan || 'Disetujui',
      }
    });
  }

  async rejectKrs(dosenId: number, krsId: number, catatan: string) {
    return this.prisma.kRS.update({
      where: { id: krsId },
      data: {
        status: StatusKRS.DITOLAK,
        catatanDosen: catatan,
      }
    });
  }

  async cancelKrs(dosenId: number, krsId: number, catatan: string) {
    return this.prisma.kRS.update({
      where: { id: krsId },
      data: {
        status: StatusKRS.DRAFT,
        catatanDosen: catatan,
        tanggalPersetujuan: null,
      }
    });
  }
}