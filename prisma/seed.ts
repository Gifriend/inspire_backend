import 'dotenv/config';
import { PrismaClient, Role, Gender, Status, StatusNilai, StatusKRS, SessionType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg'; 
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Start seeding...');

  // 1. MASTER
  const ft = await prisma.fakultas.upsert({
    where: { kode: 'FT' },
    update: {},
    create: { name: 'Fakultas Teknik', kode: 'FT', dekan: 'Dr. Teknik' },
  });

  const ifProdi = await prisma.prodi.upsert({
    where: { kode: 'IF' },
    update: {},
    create: { name: 'Informatika', kode: 'IF', jenjang: 'S1', fakultasId: ft.id },
  });

  // 2. USERS
  const hashedPassword = await bcrypt.hash('123456', 10);

  const dosen = await prisma.user.upsert({
    where: { email: 'dosen@univ.ac.id' },
    update: { password: hashedPassword },
    create: {
      name: 'Dr. Budi Hartono', email: 'dosen@univ.ac.id', nip: '19800101',
      role: Role.DOSEN, gender: Gender.LAKI_LAKI, password: hashedPassword,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
    },
  });

  const koorprodi = await prisma.user.upsert({
    where: { email: 'koor@univ.ac.id' },
    update: { password: hashedPassword },
    create: {
      name: 'Prof. Kurniawan (Koorprodi)', email: 'koor@univ.ac.id', nip: '19750101',
      role: Role.KOORPRODI, gender: Gender.LAKI_LAKI, password: hashedPassword,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
    },
  });

  const mahasiswa = await prisma.user.upsert({
    where: { email: 'mhs@univ.ac.id' },
    update: { password: hashedPassword },
    create: {
      name: 'Ahmad Mahasiswa', email: 'mhs@univ.ac.id', nim: '20021101', 
      role: Role.MAHASISWA, gender: Gender.LAKI_LAKI, password: hashedPassword,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
    },
  });

  const mahasiswaDraft = await prisma.user.upsert({
    where: { email: 'mhs_draft@univ.ac.id' },
    update: { password: hashedPassword },
    create: {
      name: 'Budi Draft', email: 'mhs_draft@univ.ac.id', nim: '20220001', 
      role: Role.MAHASISWA, gender: Gender.LAKI_LAKI, password: hashedPassword,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
    },
  });

  // 3. AKADEMIK
  let kurikulum = await prisma.kurikulum.findFirst({ where: { name: 'Kurikulum 2024' } });
  if (!kurikulum) {
    kurikulum = await prisma.kurikulum.create({
      data: { name: 'Kurikulum 2024', tahun: 2024, prodiId: ifProdi.id }
    });
  }

  const mkWeb = await prisma.matakuliah.upsert({
    where: { kode: 'IF201' },
    update: {},
    create: {
      name: 'Pemrograman Web', kode: 'IF201', sks: 3, semester: 3, 
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id
    }
  });

  const mkAlpro = await prisma.matakuliah.upsert({
    where: { kode: 'IF101' },
    update: {},
    create: {
      name: 'Algoritma Pemrograman', kode: 'IF101', sks: 3, semester: 1, 
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id
    }
  });

  // 4. KELAS
  const kelasWebGanjil = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'WEB-A-GANJIL' },
    update: {},
    create: {
      nama: 'Pemrograman Web A (Ganjil)', kode: 'WEB-A-GANJIL', kapasitas: 40, 
      semester: '2024/2025 Ganjil', mataKuliahId: mkWeb.id, dosenId: dosen.id
    }
  });

  const kelasWebGenap = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'WEB-A-GENAP' },
    update: {},
    create: {
      nama: 'Pemrograman Web A (Genap)', kode: 'WEB-A-GENAP', kapasitas: 40, 
      semester: '2024/2025 Genap', mataKuliahId: mkWeb.id, dosenId: dosen.id
    }
  });

  const kelasAlproGenap = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'ALPRO-A-GENAP' },
    update: {},
    create: {
      nama: 'Algoritma Pemrograman A (Genap)', kode: 'ALPRO-A-GENAP', kapasitas: 40, 
      semester: '2024/2025 Genap', mataKuliahId: mkAlpro.id, dosenId: dosen.id
    }
  });

  // 5. CLEANUP
  await prisma.presensiRecord.deleteMany({ where: { mahasiswaId: mahasiswa.id } });
  await prisma.presensiSession.deleteMany({ where: { kelasPerkuliahanId: kelasWebGanjil.id } });
  
  await prisma.nilai.deleteMany({ where: { mahasiswaId: mahasiswa.id } });
  await prisma.kRS.deleteMany({ where: { mahasiswaId: mahasiswa.id } });
  await prisma.kRS.deleteMany({ where: { mahasiswaId: mahasiswaDraft.id } });

  await prisma.pengumuman.deleteMany({ where: { dosenId: dosen.id } });
  await prisma.pengumuman.deleteMany({ where: { dosenId: koorprodi.id } });

  // 6. SKENARIO HISTORY
  await prisma.kRS.create({
    data: {
      mahasiswaId: mahasiswa.id, semester: '2024/2025 Ganjil', status: StatusKRS.DISETUJUI,
      totalSKS: 3, kelasPerkuliahan: { connect: [{ id: kelasWebGanjil.id }] }
    }
  });

  await prisma.nilai.create({
    data: {
      mahasiswaId: mahasiswa.id, mataKuliahId: mkWeb.id, semester: '2024/2025 Ganjil',
      nilaiHuruf: 'A', indeksNilai: 4.0, nilaiAkhir: 85, status: StatusNilai.SUDAH_ADA
    }
  });

  // 7. SKENARIO ACTIVE
  await prisma.kRS.create({
    data: {
      mahasiswaId: mahasiswaDraft.id, semester: '2024/2025 Ganjil', status: StatusKRS.DRAFT,
      totalSKS: 3, kelasPerkuliahan: { connect: [{ id: kelasWebGenap.id }] }
    }
  });

  // 8. E-LEARNING
  const sessionsToDelete = await prisma.session.findMany({ 
    where: { kelasPerkuliahanId: kelasWebGanjil.id }, select: { id: true } 
  });
  
  if (sessionsToDelete.length > 0) {
    const ids = sessionsToDelete.map(s => s.id);
    await prisma.material.deleteMany({ where: { sessionId: { in: ids } } });
    await prisma.assignment.deleteMany({ where: { sessionId: { in: ids } } });
    await prisma.session.deleteMany({ where: { id: { in: ids } } });
  }

  await prisma.session.create({
    data: {
      title: 'Pertemuan 1: Intro & Setup', weekNumber: 1, kelasPerkuliahanId: kelasWebGanjil.id,
      materials: {
        create: [
          { title: 'Slide Pengenalan', type: 'FILE', fileUrl: 'https://google.com/slide.pdf' },
          { title: 'Video Instalasi', type: 'TEXT', content: 'Silakan tonton di Youtube: ...' }
        ]
      },
      assignments: {
        create: {
          title: 'Tugas 1: Hello World',
          description: 'Buat file HTML menampilkan Hello World',
          deadline: new Date(new Date().setDate(new Date().getDate() + 7)), 
        }
      }
    }
  });

  // 9. PENGUMUMAN
  await prisma.pengumuman.create({
    data: {
      judul: 'Informasi Akademik Koorprodi',
      isi: 'Jadwal UAS akan dimulai bulan depan.',
      kategori: 'AKADEMIK',
      dosenId: koorprodi.id,
      isGlobal: true, 
    }
  });

  await prisma.pengumuman.create({
    data: {
      judul: 'Persiapan UAS Web',
      isi: 'Pelajari materi pertemuan 1-7.',
      kategori: 'AKADEMIK',
      dosenId: dosen.id,
      kelas: { connect: [{ id: kelasWebGanjil.id }] }
    }
  });

  // 10. PRESENSI (Updated Schema: Token & Method)
  await prisma.presensiSession.create({
    data: {
      title: 'Pertemuan 1: Kontrak Kuliah',
      type: SessionType.KELAS,
      kelasPerkuliahanId: kelasWebGanjil.id,
      date: new Date(),
      token: 'A1B2C3D4', // NEW: Token wajib 8 karakter
      records: {
        create: {
          mahasiswaId: mahasiswa.id,
          method: 'MANUAL', // NEW: Method pengganti swafotoUrl
        }
      }
    }
  });

  console.log('✅ Seeding Selesai!');
  console.log(`User Mhs 1  : ${mahasiswa.nim}`);
  console.log(`User Mhs 2  : ${mahasiswaDraft.nim}`);
  console.log(`User Dosen  : ${dosen.email}`);
  console.log(`User Koor   : ${koorprodi.email}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });