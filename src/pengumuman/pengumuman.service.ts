import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; 
import { CreatePengumumanDto } from './dto/create-pengumuman.dto';
import { User, Role } from '@prisma/client';

@Injectable()
export class PengumumanService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePengumumanDto, user: User) {
    const hasMultipleClasses = dto.kelasIds && dto.kelasIds.length > 1;

    // RULE: Only PROGRAM COORDINATOR can send to MULTIPLE classes at once
    if (hasMultipleClasses && user.role !== Role.KOORPRODI) {
      throw new ForbiddenException(
        'Hanya Koorprodi yang dapat membuat pengumuman untuk banyak kelas sekaligus.'
      );
    }

    // Validate Class Ownership (If regular Lecturer)
    if (dto.kelasIds && dto.kelasIds.length > 0 && user.role === Role.DOSEN) {
      // Ensure all selected classes belong to this lecturer
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

    // Create with Many-to-Many Relation
    return this.prisma.pengumuman.create({
      data: {
        // MAPPING DTO -> SCHEMA
        judul: dto.title,       // Schema: judul (title)
        isi: dto.content,       // Schema: isi (content)
        kategori: dto.category, // Schema: kategori (category) (Required)
        
        dosenId: user.id,
        
        // Connect to multiple classes (Many-to-Many)
        kelas: dto.kelasIds && dto.kelasIds.length > 0 ? {
          connect: dto.kelasIds.map((id) => ({ id })),
        } : undefined,

        // Global Logic: If no kelasIds AND user is Program Coordinator
        isGlobal: (!dto.kelasIds || dto.kelasIds.length === 0) && user.role === Role.KOORPRODI
      },
      include: { 
        kelas: { select: { nama: true, kode: true } } // Display class tags
      }
    });
  }

  // Update findAllForMahasiswa to support M-N relation
  async findAllForMahasiswa(mahasiswaId: number) {
    // 1. Get Class IDs taken by student (Approved KRS)
    const krs = await this.prisma.kRS.findMany({
      where: { mahasiswaId, status: 'DISETUJUI' },
      select: { kelasPerkuliahanId: true }
    });
    
    // Filter null values (because in new schema kelasPerkuliahanId is nullable)
    const myKelasIds = krs
      .map(k => k.kelasPerkuliahanId)
      .filter((id): id is number => id !== null);

    // 2. Query Announcements
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