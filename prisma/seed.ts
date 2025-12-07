import { PrismaClient, Role, Gender, Status, StatusNilai, StatusKRS } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Start seeding...');

  // 1. DATA MASTER: FAKULTAS & PRODI
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

  // 2. DATA USER (Mahasiswa & Dosen)
  const password = await bcrypt.hash('123456', 10);

  const dosen = await prisma.user.upsert({
    where: { email: 'dosen@univ.ac.id' },
    update: {},
    create: {
      name: 'Dr. Budi Hartono',
      email: 'dosen@univ.ac.id',
      nip: '19800101',
      role: Role.DOSEN,
      gender: Gender.LAKI_LAKI,
      password,
      status: Status.AKTIF,
      fakultasId: ft.id,
      prodiId: ifProdi.id,
    },
  });

  const mahasiswa = await prisma.user.upsert({
    where: { email: 'mhs@univ.ac.id' },
    update: {},
    create: {
      name: 'Ahmad Mahasiswa',
      email: 'mhs@univ.ac.id',
      nim: '20021101', // Gunakan NIM ini untuk Login nanti
      role: Role.MAHASISWA,
      gender: Gender.LAKI_LAKI,
      password,
      status: Status.AKTIF,
      fakultasId: ft.id,
      prodiId: ifProdi.id,
    },
  });

  // 3. DATA AKADEMIK (Kurikulum & MK)
  const kurikulum = await prisma.kurikulum.create({
    data: { name: 'Kurikulum 2024', tahun: 2024, prodiId: ifProdi.id }
  });

  const mkWeb = await prisma.matakuliah.create({
    data: {
      name: 'Pemrograman Web', kode: 'IF201', sks: 3, semester: 3, 
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id
    }
  });

  const mkAlpro = await prisma.matakuliah.create({
    data: {
      name: 'Algoritma Pemrograman', kode: 'IF101', sks: 3, semester: 1, 
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id
    }
  });

  // 4. KELAS PERKULIAHAN
  const kelasWeb = await prisma.kelasPerkuliahan.create({
    data: {
      nama: 'Pemrograman Web A', kode: 'WEB-A-2024', kapasitas: 40, 
      semester: '2024/2025 Ganjil', mataKuliahId: mkWeb.id, dosenId: dosen.id
    }
  });

  // 5. KRS & NILAI (PENTING UNTUK TESTING KHS)
  // Mahasiswa mengambil kelas
  await prisma.kRS.create({
    data: {
      mahasiswaId: mahasiswa.id,
      semester: '2024/2025 Ganjil',
      status: StatusKRS.DISETUJUI,
      totalSKS: 6,
      kelasPerkuliahan: { connect: [{ id: kelasWeb.id }] }
    }
  });

  // Input Nilai (Agar IPS tidak 0)
  // Nilai MK 1: A (4.0)
  await prisma.nilai.create({
    data: {
      mahasiswaId: mahasiswa.id,
      mataKuliahId: mkWeb.id,
      semester: '2024/2025 Ganjil',
      nilaiHuruf: 'A',
      indeksNilai: 4.0,
      nilaiAkhir: 85,
      status: StatusNilai.SUDAH_ADA
    }
  });

  // Nilai MK 2: B (3.0)
  await prisma.nilai.create({
    data: {
      mahasiswaId: mahasiswa.id,
      mataKuliahId: mkAlpro.id,
      semester: '2024/2025 Ganjil',
      nilaiHuruf: 'B',
      indeksNilai: 3.0,
      nilaiAkhir: 75,
      status: StatusNilai.SUDAH_ADA
    }
  });

  // 6. DATA E-LEARNING
  const session1 = await prisma.session.create({
    data: {
      title: 'Pertemuan 1: Pengenalan HTML',
      weekNumber: 1,
      kelasPerkuliahanId: kelasWeb.id,
      materials: {
        create: [
          { title: 'Slide HTML', type: 'FILE', fileUrl: 'https://example.com/slide.pdf' },
          { title: 'Video Tutorial', type: 'TEXT', content: 'Tonton video di Youtube...' }
        ]
      },
      assignments: {
        create: {
          title: 'Tugas 1: Halaman Web Sederhana',
          deadline: new Date(new Date().setDate(new Date().getDate() + 7)), // +7 hari
        }
      }
    }
  });

  console.log('✅ Seeding finished.');
  console.log(`🔑 Test User: ${mahasiswa.email} / 123456`);
  console.log(`🏫 Kelas ID untuk Testing E-Learning: ${kelasWeb.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });