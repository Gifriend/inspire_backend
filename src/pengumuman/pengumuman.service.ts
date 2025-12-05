import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; 
import { CreatePengumumanDto } from './dto/create-pengumuman.dto';
import { User } from '@prisma/client';

@Injectable()
export class PengumumanService {
  constructor(private prisma: PrismaService) {}

  async create(
    dto: CreatePengumumanDto,
    dosen: User,
  ) {
    if (dosen.role !== 'DOSEN') {
      throw new ForbiddenException('Hanya dosen yang dapat membuat pengumuman');
    }

    if (dto.kelasPerkuliahanId) {
      const kelas = await this.prisma.kelasPerkuliahan.findUnique({
        where: { id: dto.kelasPerkuliahanId },
      });
      if (!kelas || kelas.dosenId !== dosen.id) {
        throw new ForbiddenException('Kelas tidak ditemukan atau bukan milik Anda');
      }
    }

    return this.prisma.pengumuman.create({
      data: {
        ...dto,
        dosenId: dosen.id,
      },
      include: { dosen: { select: { id: true, name: true, nip: true } } },
    });
  }

  async findAllForMahasiswa(mahasiswaId: number) {
    // Ambil semua kelas yang dikontrak mahasiswa (KRS disetujui)
    const krsList = await this.prisma.kRS.findMany({
      where: {
        mahasiswaId,
        status: 'DISETUJUI',
      },
      select: {
        kelasPerkuliahan: {
          select: { dosenId: true, id: true },
        },
      },
    });

    const dosenIdsSet = new Set<number>();
    const kelasIds: number[] = [];

    for (const k of krsList) {
      const kp = (k as any).kelasPerkuliahan;
      if (Array.isArray(kp)) {
        for (const p of kp) {
          if (p?.dosenId) dosenIdsSet.add(p.dosenId);
          if (p?.id) kelasIds.push(p.id);
        }
      } else {
        if (kp?.dosenId) dosenIdsSet.add(kp.dosenId);
        if (kp?.id) kelasIds.push(kp.id);
      }
    }

    const dosenIds = Array.from(dosenIdsSet);

    // Get Announcements:
    // - that be chosen to spesific classes (kelasPerkuliahanId IN kelasIds)
    // - or globally from dosen (kelasPerkuliahanId = null AND dosenId IN dosenIds)
    const pengumuman = await this.prisma.pengumuman.findMany({
      where: {
        aktif: true,
        OR: [
          { kelasPerkuliahanId: { in: kelasIds } },
          { kelasPerkuliahanId: null, dosenId: { in: dosenIds } },
        ],
      },
      include: {
        dosen: { select: { name: true, nip: true } },
        kelasPerkuliahan: { select: { nama: true, kode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return pengumuman;
  }
}