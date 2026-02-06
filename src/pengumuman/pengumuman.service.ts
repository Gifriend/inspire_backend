import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePengumumanDto } from './dto/create-pengumuman.dto';
import { User, Role } from '@prisma/client';
import { NotificationService } from 'src/notification/notification.service';

@Injectable()
export class PengumumanService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async create(dto: CreatePengumumanDto, user: User) {
    const hasMultipleClasses = dto.kelasIds && dto.kelasIds.length > 1;

    // RULE: Only PROGRAM COORDINATOR can send to MULTIPLE classes at once
    if (hasMultipleClasses && user.role !== Role.KOORPRODI) {
      throw new ForbiddenException(
        'Hanya Koorprodi yang dapat membuat pengumuman untuk banyak kelas sekaligus.',
      );
    }

    // Validate Class Ownership (If regular Lecturer)
    if (dto.kelasIds && dto.kelasIds.length > 0 && user.role === Role.DOSEN) {
      // Ensure all selected classes belong to this lecturer
      const count = await this.prisma.kelasPerkuliahan.count({
        where: {
          id: { in: dto.kelasIds },
          dosenId: user.id,
        },
      });

      if (count !== dto.kelasIds.length) {
        throw new ForbiddenException(
          'Salah satu kelas yang dipilih bukan milik Anda.',
        );
      }
    }

    const pengumuman = await this.prisma.pengumuman.create({
      data: {
        judul: dto.title,
        isi: dto.content,
        kategori: dto.category,
        dosenId: user.id,
        kelas:
          dto.kelasIds && dto.kelasIds.length > 0
            ? {
                connect: dto.kelasIds.map((id) => ({ id })),
              }
            : undefined,
        // Global Logic
        isGlobal:
          (!dto.kelasIds || dto.kelasIds.length === 0) &&
          user.role === Role.KOORPRODI,
      },
      include: {
        kelas: { select: { nama: true, kode: true } },
      },
    });

    try {
      await this.handleNotification(pengumuman, dto.kelasIds);
    } catch (err) {
      console.error('Notification Error:', err);
      // Optional: Tetap return pengumuman meskipun notif gagal
    }

    return pengumuman;
  }

  private async handleNotification(pengumuman: any, kelasIds?: number[]) {
    console.log(' [NOTIF] handleNotification called');
    console.log(' [NOTIF] isGlobal:', pengumuman.isGlobal);
    console.log(' [NOTIF] kelasIds:', kelasIds);
    let tokens: string[] = [];

    if (pengumuman.isGlobal) {
      // KASUS A: Pengumuman Global -> Ambil token SEMUA Mahasiswa
      console.log('🔔 [NOTIF] Querying all students with FCM tokens...');
      const students = await this.prisma.user.findMany({
        where: { role: Role.MAHASISWA, fcmToken: { not: null } },
        select: { fcmToken: true },
      });
      console.log('🔔 [NOTIF] Found', students.length, 'students with tokens');
      // Mapping ke array string: ['token1', 'token2', ...]
      tokens = students.map((s) => s.fcmToken as string);
      console.log('🔔 [NOTIF] Mapped', tokens.length, 'tokens');
    } else if (kelasIds && kelasIds.length > 0) {
      // KASUS B: Pengumuman Per Kelas -> Ambil mahasiswa dari KRS
      const krsList = await this.prisma.kRS.findMany({
        where: {
          kelasPerkuliahanId: { in: kelasIds },
          status: 'DISETUJUI', // Hanya yang sudah disetujui
          mahasiswa: { fcmToken: { not: null } }, // Hanya yang punya token
        },
        select: {
          mahasiswa: { select: { fcmToken: true } },
        },
      });

      // Mapping dan Unique (Set) untuk menghindari duplikat token
      // (jika mahasiswa mengambil 2 kelas yang sama-sama dapat pengumuman)
      const tokenSet = new Set(
        krsList.map((k) => k.mahasiswa.fcmToken as string),
      );
      tokens = Array.from(tokenSet);
    }

    // Kirim jika ada target
    if (tokens.length > 0) {
      // Potong isi pesan agar tidak terlalu panjang di notifikasi bar
      const bodyPreview =
        pengumuman.isi.length > 100
          ? pengumuman.isi.substring(0, 100) + '...'
          : pengumuman.isi;

      await this.notificationService.sendMulticast(
        tokens,
        `Pengumuman: ${pengumuman.judul}`,
        bodyPreview,
      );
    }
  }

  // Update findAllForMahasiswa to support M-N relation
  async findAllForMahasiswa(mahasiswaId: number) {
    // 1. Get Class IDs taken by student (Approved KRS)
    const krs = await this.prisma.kRS.findMany({
      where: { mahasiswaId, status: 'DISETUJUI' },
      select: { kelasPerkuliahanId: true },
    });

    // Filter null values (because in new schema kelasPerkuliahanId is nullable)
    const myKelasIds = krs
      .map((k) => k.kelasPerkuliahanId)
      .filter((id): id is number => id !== null);

    // 2. Query Announcements
    return this.prisma.pengumuman.findMany({
      where: {
        aktif: true,
        OR: [
          // A. Pengumuman yang terhubung ke kelas saya (Many-to-Many check)
          { kelas: { some: { id: { in: myKelasIds } } } },

          // B. Pengumuman Global (Flag isGlobal = true)
          { isGlobal: true },
        ],
      },
      include: {
        dosen: { select: { name: true, nip: true } },
        kelas: { select: { nama: true, kode: true } }, // Tampilkan tag kelas
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const pengumuman = await this.prisma.pengumuman.findUnique({
      where: { id },
      include: {
        dosen: {
          select: {
            name: true,
            nip: true,
          },
        },
        kelas: {
          select: {
            nama: true,
            kode: true,
          },
        },
      },
    });

    if (!pengumuman) {
      throw new NotFoundException(`Pengumuman dengan ID ${id} tidak ditemukan`);
    }

    return pengumuman;
  }
}
