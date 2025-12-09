import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; 
import { CreatePengumumanDto } from './dto/create-pengumuman.dto';
import { User, Role } from '@prisma/client';

@Injectable()
export class PengumumanService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePengumumanDto, user: User) {
    const hasMultipleClasses = dto.kelasIds && dto.kelasIds.length > 1;

    // RULE: Hanya KOORPRODI yang boleh kirim ke BANYAK kelas sekaligus
    if (hasMultipleClasses && user.role !== Role.KOORPRODI) {
      throw new ForbiddenException(
        'Hanya Koorprodi yang dapat membuat pengumuman untuk banyak kelas sekaligus.'
      );
    }

    // Validasi Kepemilikan Kelas (Jika Dosen biasa)
    if (dto.kelasIds && dto.kelasIds.length > 0 && user.role === Role.DOSEN) {
      // Pastikan semua kelas yang dipilih adalah milik dosen tersebut
      const count = await this.prisma.kelasPerkuliahan.count({
        where: {
          id: { in: dto.kelasIds },
          dosenId: user.id
        }
      });
      
      if (count !== dto.kelasIds.length) {
        throw new ForbiddenException('Salah satu kelas yang dipilih bukan milik Anda.');
      }
    }

    // Create dengan Relasi Many-to-Many
    return this.prisma.pengumuman.create({
      data: {
        // MAPPING DTO -> SCHEMA
        judul: dto.title,       // Schema: judul
        isi: dto.content,       // Schema: isi
        kategori: dto.category, // Schema: kategori (Wajib)
        
        dosenId: user.id,
        
        // Connect ke beberapa kelas (Many-to-Many)
        kelas: dto.kelasIds && dto.kelasIds.length > 0 ? {
          connect: dto.kelasIds.map((id) => ({ id })),
        } : undefined,

        // Logic Global: Jika tidak ada kelasIds DAN user adalah Koorprodi
        isGlobal: (!dto.kelasIds || dto.kelasIds.length === 0) && user.role === Role.KOORPRODI
      },
      include: { 
        kelas: { select: { nama: true, kode: true } } 
      }
    });
  }

  // Update findAllForMahasiswa agar mendukung M-N relation
  async findAllForMahasiswa(mahasiswaId: number) {
    // 1. Ambil ID Kelas yang diambil mahasiswa (KRS Disetujui)
    const krs = await this.prisma.kRS.findMany({
      where: { mahasiswaId, status: 'DISETUJUI' },
      select: { kelasPerkuliahanId: true }
    });
    
    // Filter null values (karena di schema baru kelasPerkuliahanId bersifat nullable)
    const myKelasIds = krs
      .map(k => k.kelasPerkuliahanId)
      .filter((id): id is number => id !== null);

    // 2. Query Pengumuman
    return this.prisma.pengumuman.findMany({
      where: {
        aktif: true,
        OR: [
          // A. Pengumuman yang terhubung ke kelas saya (Many-to-Many check)
          { kelas: { some: { id: { in: myKelasIds } } } },
          
          // B. Pengumuman Global (Flag isGlobal = true)
          { isGlobal: true }
        ]
      },
      include: {
        dosen: { select: { name: true, nip: true } },
        kelas: { select: { nama: true, kode: true } } // Tampilkan tag kelas
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}