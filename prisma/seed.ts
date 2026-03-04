import 'dotenv/config';
import { 
  PrismaClient, Role, Gender, Status, StatusKRS, ElearningSetupMode,
  MaterialType, QuestionType, QuizGradingMethod
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() { 
  console.log('🌱 Starting database seed...');

  const currentYear = new Date().getFullYear();
  const activeAcademicYear = `${currentYear - 1}/${currentYear} Genap`;

  // ==========================================
  // 0. CLEANUP 
  // ==========================================
  console.log('🧹 Cleaning up old transactional data...');
  await prisma.quizAttempt.deleteMany({});
  await prisma.submission.deleteMany({});
  await prisma.question.deleteMany({});
  await prisma.quiz.deleteMany({});
  await prisma.assignment.deleteMany({});
  await prisma.material.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.elearningClassConfig.deleteMany({});
  await prisma.nilai.deleteMany({});
  await prisma.kRS.deleteMany({});

  // ==========================================
  // 1. MASTER DATA (Fakultas & Prodi)
  // ==========================================
  const ft = await prisma.fakultas.upsert({
    where: { kode: 'FT' }, update: {},
    create: { name: 'Fakultas Teknik', kode: 'FT', dekan: 'Dr. Teknik' },
  });

  const ifProdi = await prisma.prodi.upsert({
    where: { kode: 'IF' }, update: {},
    create: { name: 'Informatika', kode: 'IF', jenjang: 'S1', fakultasId: ft.id },
  });

  // ==========================================
  // 2. USERS
  // ==========================================
  const password = await bcrypt.hash('123456', 10);

  const dosen = await prisma.user.upsert({
    where: { email: 'dosen@univ.ac.id' }, update: { password },
    create: {
      name: 'Dr. Budi Hartono', email: 'dosen@univ.ac.id', nip: '19800101',
      role: Role.DOSEN, gender: Gender.LAKI_LAKI, password,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
    },
  });

  const dosenKolab1 = await prisma.user.upsert({
    where: { email: 'dosen.kolab1@univ.ac.id' }, update: { password },
    create: {
      name: 'Dr. Sari Widya', email: 'dosen.kolab1@univ.ac.id', nip: '19809002',
      role: Role.DOSEN, gender: Gender.PEREMPUAN, password,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
    },
  });

  const dosenKolab2 = await prisma.user.upsert({
    where: { email: 'dosen.kolab2@univ.ac.id' }, update: { password },
    create: {
      name: 'Dr. Rudi Pratama', email: 'dosen.kolab2@univ.ac.id', nip: '19809003',
      role: Role.DOSEN, gender: Gender.LAKI_LAKI, password,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
    },
  });

  const koorprodi = await prisma.user.upsert({
    where: { email: 'koor@univ.ac.id' }, update: { password },
    create: {
      name: 'Prof. Kurniawan', email: 'koor@univ.ac.id', nip: '19750101',
      role: Role.KOORPRODI, gender: Gender.LAKI_LAKI, password,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
    },
  });

  // STUDENT 1: Andi (Flow 1: Blank KRS - Needs to pick subjects)
  const andiBlank = await prisma.user.upsert({
    where: { email: 'andi@univ.ac.id' }, update: { password },
    create: {
      name: 'Andi (Belum Kontrak)', email: 'andi@univ.ac.id', nim: '20249001', 
      role: Role.MAHASISWA, gender: Gender.LAKI_LAKI, password,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
    },
  });

  // STUDENT 2: Budi (Flow 2: KRS Approved - Can use E-Learning)
  const budiActive = await prisma.user.upsert({
    where: { email: 'budi@univ.ac.id' }, update: { password },
    create: {
      name: 'Budi (Active E-Learning)', email: 'budi@univ.ac.id', nim: '20249002',
      role: Role.MAHASISWA, gender: Gender.LAKI_LAKI, password,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
    },
  });

  // STUDENT 3: Citra (Flow 3: Same-Dosen Merge - enrolled in AlgoC merged to AlgoB)
  const citraAlgo = await prisma.user.upsert({
    where: { email: 'citra@univ.ac.id' }, update: { password },
    create: {
      name: 'Citra (Merge Same Dosen)', email: 'citra@univ.ac.id', nim: '20240002',
      role: Role.MAHASISWA, gender: Gender.PEREMPUAN, password,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
    },
  });

  // STUDENT 4: Dani (Flow 4: Has KHS & Transkrip - completed past semesters)
  const daniTranskrip = await prisma.user.upsert({
    where: { email: 'dani@univ.ac.id' }, update: { password },
    create: {
      name: 'Dani (Punya KHS & Transkrip)', email: 'dani@univ.ac.id', nim: '20239001',
      role: Role.MAHASISWA, gender: Gender.LAKI_LAKI, password,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
      ipk: 0, totalSksLulus: 0, // will be updated after Nilai seed
    },
  });

  // ==========================================
  // 3. MATAKULIAH & KELAS PERKULIAHAN
  // ==========================================
  let kurikulum = await prisma.kurikulum.findFirst({ where: { name: 'Kurikulum 2024' } });
  if (!kurikulum) {
    kurikulum = await prisma.kurikulum.create({ data: { name: 'Kurikulum 2024', tahun: 2024, prodiId: ifProdi.id }});
  }

  // --- Mata Kuliah Semester 1 (untuk histori KHS/Transkrip) ---
  const mkDasarProg = await prisma.matakuliah.upsert({
    where: { kode: 'IF101' }, update: {},
    create: {
      name: 'Dasar Pemrograman', kode: 'IF101', sks: 3, semester: 1,
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id,
    },
  });
  const mkKalkulus1 = await prisma.matakuliah.upsert({
    where: { kode: 'IF102' }, update: {},
    create: {
      name: 'Kalkulus I', kode: 'IF102', sks: 3, semester: 1,
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id,
    },
  });
  const mkFisika = await prisma.matakuliah.upsert({
    where: { kode: 'IF103' }, update: {},
    create: {
      name: 'Fisika Dasar', kode: 'IF103', sks: 3, semester: 1,
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id,
    },
  });
  const mkBahasaInggris = await prisma.matakuliah.upsert({
    where: { kode: 'IF104' }, update: {},
    create: {
      name: 'Bahasa Inggris', kode: 'IF104', sks: 2, semester: 1,
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id,
    },
  });
  const mkPengkom = await prisma.matakuliah.upsert({
    where: { kode: 'IF105' }, update: {},
    create: {
      name: 'Pengantar Teknologi Informasi', kode: 'IF105', sks: 2, semester: 1,
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id,
    },
  });

  // --- Mata Kuliah Semester 2 (untuk histori KHS/Transkrip) ---
  const mkOop = await prisma.matakuliah.upsert({
    where: { kode: 'IF106' }, update: {},
    create: {
      name: 'Pemrograman Berorientasi Objek', kode: 'IF106', sks: 3, semester: 2,
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id,
    },
  });
  const mkKalkulus2 = await prisma.matakuliah.upsert({
    where: { kode: 'IF107' }, update: {},
    create: {
      name: 'Kalkulus II', kode: 'IF107', sks: 3, semester: 2,
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id,
    },
  });
  const mkStatistika = await prisma.matakuliah.upsert({
    where: { kode: 'IF108' }, update: {},
    create: {
      name: 'Probabilitas dan Statistika', kode: 'IF108', sks: 3, semester: 2,
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id,
    },
  });
  const mkLogika = await prisma.matakuliah.upsert({
    where: { kode: 'IF109' }, update: {},
    create: {
      name: 'Logika Informatika', kode: 'IF109', sks: 3, semester: 2,
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id,
    },
  });
  const mkSisdig = await prisma.matakuliah.upsert({
    where: { kode: 'IF110' }, update: {},
    create: {
      name: 'Sistem Digital', kode: 'IF110', sks: 2, semester: 2,
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id,
    },
  });

  // --- Mata Kuliah Semester 3 (existing + baru) ---
  const mkWeb = await prisma.matakuliah.upsert({
    where: { kode: 'IF201' }, update: {},
    create: {
      name: 'Pemrograman Web', kode: 'IF201', sks: 3, semester: 3, 
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id
    }
  });

  const mkAlgo = await prisma.matakuliah.upsert({
    where: { kode: 'IF202' }, update: {},
    create: {
      name: 'Algoritma dan Struktur Data', kode: 'IF202', sks: 3, semester: 3,
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id
    }
  });

  const mkBasisData = await prisma.matakuliah.upsert({
    where: { kode: 'IF203' }, update: {},
    create: {
      name: 'Basis Data', kode: 'IF203', sks: 3, semester: 3,
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id,
    },
  });

  const kelasWebA = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'WEB-GENAP-REGULER' },
    update: {
      nama: 'Pemrograman Web A',
      kapasitas: 40,
      ruangan: 'Lab Komputer 1',
      jadwal: 'Senin 08:00-10:00',
      academicYear: activeAcademicYear,
      mataKuliahId: mkWeb.id,
      dosenId: dosen.id,
    },
    create: {
      nama: 'Pemrograman Web A', kode: 'WEB-GENAP-REGULER', kapasitas: 40,
      ruangan: 'Lab Komputer 1', jadwal: 'Senin 08:00-10:00',
      academicYear: activeAcademicYear, mataKuliahId: mkWeb.id, dosenId: dosen.id
    }
  });

  const kelasWebB = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'WEB-GENAP-KOLAB-B' },
    update: {
      nama: 'Pemrograman Web B',
      kapasitas: 35,
      ruangan: 'Lab Komputer 2',
      jadwal: 'Selasa 10:00-12:00',
      academicYear: activeAcademicYear,
      mataKuliahId: mkWeb.id,
      dosenId: dosenKolab1.id,
    },
    create: {
      nama: 'Pemrograman Web B', kode: 'WEB-GENAP-KOLAB-B', kapasitas: 35,
      ruangan: 'Lab Komputer 2', jadwal: 'Selasa 10:00-12:00',
      academicYear: activeAcademicYear, mataKuliahId: mkWeb.id, dosenId: dosenKolab1.id
    }
  });

  const kelasWebC = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'WEB-GENAP-KOLAB-C' },
    update: {
      nama: 'Pemrograman Web C',
      kapasitas: 30,
      ruangan: 'Lab Komputer 3',
      jadwal: 'Rabu 13:00-15:00',
      academicYear: activeAcademicYear,
      mataKuliahId: mkWeb.id,
      dosenId: dosenKolab2.id,
    },
    create: {
      nama: 'Pemrograman Web C', kode: 'WEB-GENAP-KOLAB-C', kapasitas: 30,
      ruangan: 'Lab Komputer 3', jadwal: 'Rabu 13:00-15:00',
      academicYear: activeAcademicYear, mataKuliahId: mkWeb.id, dosenId: dosenKolab2.id
    }
  });

  const kelasWebD = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'WEB-GENAP-CLONE-D' },
    update: {
      nama: 'Pemrograman Web D',
      kapasitas: 25,
      ruangan: 'Lab Komputer 4',
      jadwal: 'Kamis 08:00-10:00',
      academicYear: activeAcademicYear,
      mataKuliahId: mkWeb.id,
      dosenId: dosen.id,
    },
    create: {
      nama: 'Pemrograman Web D', kode: 'WEB-GENAP-CLONE-D', kapasitas: 25,
      ruangan: 'Lab Komputer 4', jadwal: 'Kamis 08:00-10:00',
      academicYear: activeAcademicYear, mataKuliahId: mkWeb.id, dosenId: dosen.id
    }
  });

  const kelasAlgoA = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'ALGO-GENAP-A' },
    update: {
      nama: 'Algoritma A',
      kapasitas: 40,
      ruangan: 'Ruang 201',
      jadwal: 'Jumat 09:00-11:00',
      academicYear: activeAcademicYear,
      mataKuliahId: mkAlgo.id,
      dosenId: dosenKolab1.id,
    },
    create: {
      nama: 'Algoritma A', kode: 'ALGO-GENAP-A', kapasitas: 40,
      ruangan: 'Ruang 201', jadwal: 'Jumat 09:00-11:00',
      academicYear: activeAcademicYear, mataKuliahId: mkAlgo.id, dosenId: dosenKolab1.id
    }
  });

  // --- SKENARIO MERGER DOSEN PENGAMPUH SAMA ---
  // Dosen 1 (dosen@univ.ac.id) mengajar 2 kelas Algoritma yang berbeda.
  // AlgoB = kelas master (elearning NEW, punya konten).
  // AlgoC = kelas member yang di-merge ke AlgoB (EXISTING + isMergedClass=true).
  const kelasAlgoB = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'ALGO-GENAP-B-MASTER' },
    update: {
      nama: 'Algoritma B (Master Merge)',
      kapasitas: 35,
      ruangan: 'Ruang 202',
      jadwal: 'Senin 13:00-15:00',
      academicYear: activeAcademicYear,
      mataKuliahId: mkAlgo.id,
      dosenId: dosen.id,
    },
    create: {
      nama: 'Algoritma B (Master Merge)', kode: 'ALGO-GENAP-B-MASTER', kapasitas: 35,
      ruangan: 'Ruang 202', jadwal: 'Senin 13:00-15:00',
      academicYear: activeAcademicYear, mataKuliahId: mkAlgo.id, dosenId: dosen.id,
    },
  });

  const kelasAlgoC = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'ALGO-GENAP-C-MEMBER' },
    update: {
      nama: 'Algoritma C (Member Merge)',
      kapasitas: 30,
      ruangan: 'Ruang 203',
      jadwal: 'Rabu 08:00-10:00',
      academicYear: activeAcademicYear,
      mataKuliahId: mkAlgo.id,
      dosenId: dosen.id,
    },
    create: {
      nama: 'Algoritma C (Member Merge)', kode: 'ALGO-GENAP-C-MEMBER', kapasitas: 30,
      ruangan: 'Ruang 203', jadwal: 'Rabu 08:00-10:00',
      academicYear: activeAcademicYear, mataKuliahId: mkAlgo.id, dosenId: dosen.id,
    },
  });

  // ==========================================
  // 4. KRS FLOW SCENARIOS
  // ==========================================
  
  // Andi's KRS -> DRAFT (Empty, 0 SKS, no subjects connected)
  await prisma.kRS.upsert({
    where: {
      mahasiswaId_academicYear: {
        mahasiswaId: andiBlank.id,
        academicYear: activeAcademicYear,
      },
    },
    update: {
      status: StatusKRS.DRAFT,
      totalSKS: 0,
      kelasPerkuliahan: { set: [] },
      tanggalPengajuan: null,
      tanggalPersetujuan: null,
      catatanDosen: null,
    },
    create: {
      mahasiswaId: andiBlank.id,
      academicYear: activeAcademicYear,
      status: StatusKRS.DRAFT,
      totalSKS: 0,
    },
  });

  // Budi's KRS -> DISETUJUI (Contracted, mapped to e-learning)
  await prisma.kRS.upsert({
    where: {
      mahasiswaId_academicYear: {
        mahasiswaId: budiActive.id,
        academicYear: activeAcademicYear,
      },
    },
    update: {
      status: StatusKRS.DISETUJUI,
      totalSKS: 3,
      kelasPerkuliahan: { set: [{ id: kelasWebB.id }] },
      tanggalPersetujuan: new Date(),
    },
    create: {
      mahasiswaId: budiActive.id,
      academicYear: activeAcademicYear,
      status: StatusKRS.DISETUJUI,
      totalSKS: 3,
      tanggalPersetujuan: new Date(),
      kelasPerkuliahan: { connect: [{ id: kelasWebB.id }] },
    },
  });

  // Citra's KRS -> DISETUJUI (Enrolled in AlgoC which is MERGED to AlgoB by same dosen)
  await prisma.kRS.upsert({
    where: {
      mahasiswaId_academicYear: {
        mahasiswaId: citraAlgo.id,
        academicYear: activeAcademicYear,
      },
    },
    update: {
      status: StatusKRS.DISETUJUI,
      totalSKS: 3,
      kelasPerkuliahan: { set: [{ id: kelasAlgoC.id }] },
      tanggalPersetujuan: new Date(),
    },
    create: {
      mahasiswaId: citraAlgo.id,
      academicYear: activeAcademicYear,
      status: StatusKRS.DISETUJUI,
      totalSKS: 3,
      tanggalPersetujuan: new Date(),
      kelasPerkuliahan: { connect: [{ id: kelasAlgoC.id }] },
    },
  });

  // ==========================================
  // 4b. DANI's KRS & NILAI (KHS + TRANSKRIP DATA)
  // ==========================================
  // Dani sudah menyelesaikan semester 1 (2023/2024 Ganjil), semester 2 (2023/2024 Genap),
  // dan sedang semester 3 aktif (2024/2025 Genap).

  const sem1AY = '2023/2024 Ganjil';
  const sem2AY = '2023/2024 Genap';
  const sem3AY = activeAcademicYear; // semester aktif saat ini

  // --- KRS Semester 1 (DISETUJUI, sudah selesai) ---
  await prisma.kRS.upsert({
    where: { mahasiswaId_academicYear: { mahasiswaId: daniTranskrip.id, academicYear: sem1AY } },
    update: { status: StatusKRS.DISETUJUI, totalSKS: 13, tanggalPersetujuan: new Date('2023-09-05') },
    create: {
      mahasiswaId: daniTranskrip.id, academicYear: sem1AY,
      status: StatusKRS.DISETUJUI, totalSKS: 13,
      tanggalPengajuan: new Date('2023-09-01'), tanggalPersetujuan: new Date('2023-09-05'),
    },
  });

  // --- KRS Semester 2 (DISETUJUI, sudah selesai) ---
  await prisma.kRS.upsert({
    where: { mahasiswaId_academicYear: { mahasiswaId: daniTranskrip.id, academicYear: sem2AY } },
    update: { status: StatusKRS.DISETUJUI, totalSKS: 14, tanggalPersetujuan: new Date('2024-02-10') },
    create: {
      mahasiswaId: daniTranskrip.id, academicYear: sem2AY,
      status: StatusKRS.DISETUJUI, totalSKS: 14,
      tanggalPengajuan: new Date('2024-02-05'), tanggalPersetujuan: new Date('2024-02-10'),
    },
  });

  // --- KRS Semester 3 Aktif (DISETUJUI, sedang berjalan) ---
  await prisma.kRS.upsert({
    where: { mahasiswaId_academicYear: { mahasiswaId: daniTranskrip.id, academicYear: sem3AY } },
    update: {
      status: StatusKRS.DISETUJUI, totalSKS: 9,
      kelasPerkuliahan: { set: [{ id: kelasWebA.id }, { id: kelasAlgoA.id }] },
      tanggalPersetujuan: new Date(),
    },
    create: {
      mahasiswaId: daniTranskrip.id, academicYear: sem3AY,
      status: StatusKRS.DISETUJUI, totalSKS: 9,
      tanggalPengajuan: new Date(), tanggalPersetujuan: new Date(),
      kelasPerkuliahan: { connect: [{ id: kelasWebA.id }, { id: kelasAlgoA.id }] },
    },
  });

  // --- NILAI Semester 1 (2023/2024 Ganjil) ---
  // Dasar Pemrograman: A (4.0), Kalkulus I: B+ (3.5), Fisika: B (3.0), B.Inggris: A (4.0), PTI: A (4.0)
  const nilaiSem1 = [
    { mataKuliahId: mkDasarProg.id,    nilaiTugas: 88, nilaiUTS: 85, nilaiUAS: 90, nilaiAkhir: 88, nilaiHuruf: 'A',  indeksNilai: 4.0 },
    { mataKuliahId: mkKalkulus1.id,     nilaiTugas: 78, nilaiUTS: 80, nilaiUAS: 75, nilaiAkhir: 78, nilaiHuruf: 'B+', indeksNilai: 3.5 },
    { mataKuliahId: mkFisika.id,        nilaiTugas: 72, nilaiUTS: 70, nilaiUAS: 73, nilaiAkhir: 72, nilaiHuruf: 'B',  indeksNilai: 3.0 },
    { mataKuliahId: mkBahasaInggris.id, nilaiTugas: 92, nilaiUTS: 88, nilaiUAS: 95, nilaiAkhir: 92, nilaiHuruf: 'A',  indeksNilai: 4.0 },
    { mataKuliahId: mkPengkom.id,       nilaiTugas: 85, nilaiUTS: 90, nilaiUAS: 88, nilaiAkhir: 88, nilaiHuruf: 'A',  indeksNilai: 4.0 },
  ];

  for (const n of nilaiSem1) {
    await prisma.nilai.upsert({
      where: { mahasiswaId_mataKuliahId_academicYear: { mahasiswaId: daniTranskrip.id, mataKuliahId: n.mataKuliahId, academicYear: sem1AY } },
      update: { ...n, status: 'SUDAH_ADA' },
      create: { mahasiswaId: daniTranskrip.id, academicYear: sem1AY, status: 'SUDAH_ADA', ...n },
    });
  }

  // --- NILAI Semester 2 (2023/2024 Genap) ---
  // OOP: A (4.0), Kalkulus II: B (3.0), Statistika: B+ (3.5), Logika: A (4.0), Sisdig: B+ (3.5)
  const nilaiSem2 = [
    { mataKuliahId: mkOop.id,        nilaiTugas: 90, nilaiUTS: 87, nilaiUAS: 92, nilaiAkhir: 90, nilaiHuruf: 'A',  indeksNilai: 4.0 },
    { mataKuliahId: mkKalkulus2.id,   nilaiTugas: 70, nilaiUTS: 72, nilaiUAS: 68, nilaiAkhir: 70, nilaiHuruf: 'B',  indeksNilai: 3.0 },
    { mataKuliahId: mkStatistika.id,  nilaiTugas: 80, nilaiUTS: 78, nilaiUAS: 82, nilaiAkhir: 80, nilaiHuruf: 'B+', indeksNilai: 3.5 },
    { mataKuliahId: mkLogika.id,      nilaiTugas: 88, nilaiUTS: 90, nilaiUAS: 85, nilaiAkhir: 88, nilaiHuruf: 'A',  indeksNilai: 4.0 },
    { mataKuliahId: mkSisdig.id,      nilaiTugas: 82, nilaiUTS: 78, nilaiUAS: 80, nilaiAkhir: 80, nilaiHuruf: 'B+', indeksNilai: 3.5 },
  ];

  for (const n of nilaiSem2) {
    await prisma.nilai.upsert({
      where: { mahasiswaId_mataKuliahId_academicYear: { mahasiswaId: daniTranskrip.id, mataKuliahId: n.mataKuliahId, academicYear: sem2AY } },
      update: { ...n, status: 'SUDAH_ADA' },
      create: { mahasiswaId: daniTranskrip.id, academicYear: sem2AY, status: 'SUDAH_ADA', ...n },
    });
  }

  // --- NILAI Semester 3 aktif: Basis Data sudah ada (mid-semester), Web & Algo belum ---
  await prisma.nilai.upsert({
    where: { mahasiswaId_mataKuliahId_academicYear: { mahasiswaId: daniTranskrip.id, mataKuliahId: mkBasisData.id, academicYear: sem3AY } },
    update: { nilaiTugas: 85, nilaiUTS: 80, nilaiUAS: 0, nilaiAkhir: 0, nilaiHuruf: null, indeksNilai: null, status: 'BELUM_ADA' },
    create: { mahasiswaId: daniTranskrip.id, academicYear: sem3AY, mataKuliahId: mkBasisData.id, status: 'BELUM_ADA', nilaiTugas: 85, nilaiUTS: 80 },
  });

  // Update IPK dan total SKS lulus untuk Dani berdasarkan Nilai yang sudah di-seed
  // Sem1: 3*4.0 + 3*3.5 + 3*3.0 + 2*4.0 + 2*4.0 = 12+10.5+9+8+8 = 47.5 / 13 SKS = 3.65
  // Sem2: 3*4.0 + 3*3.0 + 3*3.5 + 3*4.0 + 2*3.5 = 12+9+10.5+12+7 = 50.5 / 14 SKS = 3.61
  // IPK: (47.5+50.5) / (13+14) = 98/27 = 3.63
  await prisma.user.update({
    where: { id: daniTranskrip.id },
    data: { ipk: 3.63, totalSksLulus: 27, semesterTerakhir: sem3AY },
  });

  // ==========================================
  // 5. E-LEARNING CONFIG SCENARIOS (COLLAB)
  // ==========================================
  await prisma.elearningClassConfig.upsert({
    where: { kelasPerkuliahanId: kelasWebA.id },
    update: {
      setupMode: ElearningSetupMode.NEW,
      sourceKelasPerkuliahanId: null,
      isMergedClass: false,
      createdByDosenId: dosen.id,
    },
    create: {
      kelasPerkuliahanId: kelasWebA.id,
      setupMode: ElearningSetupMode.NEW,
      isMergedClass: false,
      createdByDosenId: dosen.id,
    },
  });

  await prisma.elearningClassConfig.upsert({
    where: { kelasPerkuliahanId: kelasWebB.id },
    update: {
      setupMode: ElearningSetupMode.EXISTING,
      sourceKelasPerkuliahanId: kelasWebA.id,
      isMergedClass: true,
      createdByDosenId: dosenKolab1.id,
    },
    create: {
      kelasPerkuliahanId: kelasWebB.id,
      setupMode: ElearningSetupMode.EXISTING,
      sourceKelasPerkuliahanId: kelasWebA.id,
      isMergedClass: true,
      createdByDosenId: dosenKolab1.id,
    },
  });

  await prisma.elearningClassConfig.upsert({
    where: { kelasPerkuliahanId: kelasWebC.id },
    update: {
      setupMode: ElearningSetupMode.NEW,
      sourceKelasPerkuliahanId: null,
      isMergedClass: false,
      createdByDosenId: dosenKolab2.id,
    },
    create: {
      kelasPerkuliahanId: kelasWebC.id,
      setupMode: ElearningSetupMode.NEW,
      isMergedClass: false,
      createdByDosenId: dosenKolab2.id,
    },
  });

  await prisma.elearningClassConfig.upsert({
    where: { kelasPerkuliahanId: kelasWebD.id },
    update: {
      setupMode: ElearningSetupMode.EXISTING,
      sourceKelasPerkuliahanId: kelasWebA.id,
      isMergedClass: false,
      createdByDosenId: dosen.id,
    },
    create: {
      kelasPerkuliahanId: kelasWebD.id,
      setupMode: ElearningSetupMode.EXISTING,
      sourceKelasPerkuliahanId: kelasWebA.id,
      isMergedClass: false,
      createdByDosenId: dosen.id,
    },
  });

  // --- SKENARIO SAMA DOSEN: AlgoB = master (NEW), AlgoC = member (EXISTING+merged) ---
  // AlgoB: kelas utama milik Dosen 1, setup elearning baru (master)
  await prisma.elearningClassConfig.upsert({
    where: { kelasPerkuliahanId: kelasAlgoB.id },
    update: {
      setupMode: ElearningSetupMode.NEW,
      sourceKelasPerkuliahanId: null,
      isMergedClass: false,
      createdByDosenId: dosen.id,
    },
    create: {
      kelasPerkuliahanId: kelasAlgoB.id,
      setupMode: ElearningSetupMode.NEW,
      isMergedClass: false,
      createdByDosenId: dosen.id,
    },
  });

  // AlgoC: kelas kedua milik Dosen 1 (DOSEN PENGAMPUH SAMA), di-merge ke AlgoB
  // Ini mensimulasikan skenario: 1 dosen → 2 kelas berbeda → elearning digabung
  await prisma.elearningClassConfig.upsert({
    where: { kelasPerkuliahanId: kelasAlgoC.id },
    update: {
      setupMode: ElearningSetupMode.EXISTING,
      sourceKelasPerkuliahanId: kelasAlgoB.id,
      isMergedClass: true,
      createdByDosenId: dosen.id,
    },
    create: {
      kelasPerkuliahanId: kelasAlgoC.id,
      setupMode: ElearningSetupMode.EXISTING,
      sourceKelasPerkuliahanId: kelasAlgoB.id,
      isMergedClass: true,
      createdByDosenId: dosen.id,
    },
  });

  // ==========================================
  // 6. E-LEARNING CONTENT
  // ==========================================
  
  const session1 = await prisma.session.create({
    data: {
      title: 'Pertemuan 1: Pengenalan HTML & CSS',
      description: 'Materi dasar struktur web.',
      weekNumber: 1,
      kelasPerkuliahanId: kelasWebA.id,
      materials: {
        create: [
          {
            title: 'Slide Pengenalan Web',
            type: MaterialType.FILE,
            fileUrl: 'https://example.com/slide.pdf',
            isHidden: false,
          },
          {
            title: 'Draft Materi Khusus Lanjutan',
            type: MaterialType.TEXT,
            content: 'Materi ini masih disembunyikan untuk mahasiswa',
            isHidden: true,
          }
        ]
      },
      assignments: {
        create: [
          {
            title: 'Tugas 1: Buat Profil Biodata',
            description: 'Gunakan HTML dan CSS murni.',
            deadline: new Date(new Date().setDate(new Date().getDate() + 7)),
            allowLate: true,
            isHidden: false,
          },
          {
            title: 'Tugas 2: Mini Landing Page',
            description: 'Masih disiapkan, belum ditampilkan',
            deadline: new Date(new Date().setDate(new Date().getDate() + 10)),
            allowLate: false,
            isHidden: true,
          }
        ]
      }
    }
  });

  const assignment1 = await prisma.assignment.findFirst({ where: { sessionId: session1.id } });
  if (assignment1) {
    await prisma.submission.create({
      data: {
        studentId: budiActive.id,
        assignmentId: assignment1.id,
        textContent: 'Ini tugas saya pak, link repository: github.com/budi/tugas1',
        grade: 90 
      }
    });
  }

  const session2 = await prisma.session.create({
    data: {
      title: 'Pertemuan 2: Kuis Dasar HTML',
      weekNumber: 2,
      kelasPerkuliahanId: kelasWebA.id,
      quizzes: {
        create: [
          {
            title: 'Quiz 1: HTML Tag Basics',
            duration: 30,
            startTime: new Date(new Date().setDate(new Date().getDate() - 1)),
            endTime: new Date(new Date().setDate(new Date().getDate() + 3)),
            gradingMethod: QuizGradingMethod.HIGHEST_GRADE,
            isHidden: false,
            questions: {
              create: [
                {
                  text: 'Apa tag untuk membuat hyperlink?',
                  type: QuestionType.MULTIPLE_CHOICE,
                  options: ['<a>', '<link>', '<href>', '<p>'],
                  correctAnswer: '<a>',
                  points: 100
                }
              ]
            }
          },
          {
            title: 'Quiz 2: CSS Draft Quiz',
            duration: 20,
            startTime: new Date(new Date().setDate(new Date().getDate() + 1)),
            endTime: new Date(new Date().setDate(new Date().getDate() + 4)),
            gradingMethod: QuizGradingMethod.LATEST_GRADE,
            isHidden: true,
            questions: {
              create: [
                {
                  text: 'Properti CSS untuk warna teks?',
                  type: QuestionType.MULTIPLE_CHOICE,
                  options: ['font-color', 'color', 'text-color', 'fgcolor'],
                  correctAnswer: 'color',
                  points: 100,
                }
              ]
            }
          }
        ]
      }
    }
  });

  await prisma.session.create({
    data: {
      title: 'Pertemuan Clone: Materi dari Kelas Lama',
      description: 'Simulasi hasil clone mode EXISTING non-merged',
      weekNumber: 1,
      kelasPerkuliahanId: kelasWebD.id,
      materials: {
        create: [
          {
            title: 'Clone Materi Hidden',
            type: MaterialType.FILE,
            fileUrl: 'https://example.com/clone-hidden.pdf',
            isHidden: true,
          },
        ],
      },
    },
  });

  // --- KONTEN ELEARNING UNTUK ALGO B (MASTER MERGE SAME DOSEN) ---
  // AlgoC tidak punya sesi sendiri; ia membaca dari AlgoB via isMergedClass=true.
  const sessionAlgoB1 = await prisma.session.create({
    data: {
      title: 'Pertemuan 1: Kompleksitas Algoritma',
      description: 'Memahami Big O Notation dan analisis waktu algoritma.',
      weekNumber: 1,
      kelasPerkuliahanId: kelasAlgoB.id,
      materials: {
        create: [
          {
            title: 'Slide Big O Notation',
            type: MaterialType.FILE,
            fileUrl: 'https://example.com/big-o.pdf',
            isHidden: false,
          },
          {
            title: 'Catatan Dosen: Contoh Kode Tambahan',
            type: MaterialType.TEXT,
            content: 'Materi suplemen ini disembunyikan sementara sebelum kelas.',
            isHidden: true,
          },
        ],
      },
      assignments: {
        create: [
          {
            title: 'Tugas 1: Analisis Kompleksitas Sorting',
            description: 'Tentukan kompleksitas waktu untuk 3 algoritma sorting berbeda.',
            deadline: new Date(new Date().setDate(new Date().getDate() + 7)),
            allowLate: false,
            isHidden: false,
          },
        ],
      },
    },
  });

  await prisma.session.create({
    data: {
      title: 'Pertemuan 2: Struktur Data Linear',
      description: 'Stack, Queue, dan Linked List.',
      weekNumber: 2,
      kelasPerkuliahanId: kelasAlgoB.id,
      quizzes: {
        create: [
          {
            title: 'Quiz 1: Stack & Queue Basics',
            duration: 20,
            startTime: new Date(new Date().setDate(new Date().getDate() - 1)),
            endTime: new Date(new Date().setDate(new Date().getDate() + 5)),
            gradingMethod: QuizGradingMethod.HIGHEST_GRADE,
            isHidden: false,
            questions: {
              create: [
                {
                  text: 'Struktur data yang menggunakan prinsip LIFO adalah?',
                  type: QuestionType.MULTIPLE_CHOICE,
                  options: ['Queue', 'Stack', 'Linked List', 'Tree'],
                  correctAnswer: 'Stack',
                  points: 100,
                },
              ],
            },
          },
        ],
      },
    },
  });

  // Simulasi pengumpulan tugas oleh Citra (mahasiswa AlgoC yang merged ke AlgoB)
  const assignmentAlgoB1 = await prisma.assignment.findFirst({
    where: { sessionId: sessionAlgoB1.id },
  });
  if (assignmentAlgoB1) {
    await prisma.submission.create({
      data: {
        studentId: citraAlgo.id,
        assignmentId: assignmentAlgoB1.id,
        textContent: 'Bubble Sort: O(n²), Merge Sort: O(n log n), Binary Search: O(log n)',
        grade: 85,
      },
    });
  }

  const quiz1 = await prisma.quiz.findFirst({ where: { sessionId: session2.id } });
  if (quiz1) {
    await prisma.quizAttempt.create({
      data: {
        studentId: budiActive.id,
        quizId: quiz1.id,
        score: 100, 
        finishedAt: new Date()
      }
    });
  }

  // ==========================================
  // ASSIGN DOSEN PEMBIMBING AKADEMIK (PA)
  // ==========================================
  console.log('👨‍🏫 Assigning Dosen PA (Pembimbing Akademik)...');
  // Assign Dr. Budi Hartono sebagai PA untuk semua mahasiswa
  await prisma.user.updateMany({
    where: { id: { in: [andiBlank.id, budiActive.id, citraAlgo.id, daniTranskrip.id] } },
    data: { dosenPAId: dosen.id },
  });

  // ==========================================
  // EXTRA: Simulate controller/service flows for testing
  // ==========================================
  console.log('🧪 Simulating controller/service flows for testing...');

  // 1) Andi: add class Pemrograman Web A to KRS, submit, and approve by PA (dosen)
  try {
    const andiKrs = await prisma.kRS.findUnique({
      where: { mahasiswaId_academicYear: { mahasiswaId: andiBlank.id, academicYear: activeAcademicYear } },
      include: { kelasPerkuliahan: true },
    });

    if (andiKrs) {
      if ((andiKrs.kelasPerkuliahan || []).length === 0) {
        const updated = await prisma.kRS.update({
          where: { id: andiKrs.id },
          data: {
            totalSKS: { increment: mkWeb.sks },
            kelasPerkuliahan: { connect: { id: kelasWebA.id } },
          },
        });
        console.log(`- Andi: connected to kelas ${kelasWebA.nama ?? kelasWebA.id}`);

        await prisma.kRS.update({ where: { id: updated.id }, data: { status: StatusKRS.DIAJUKAN, tanggalPengajuan: new Date() } });
        console.log('- Andi: submitted KRS (DIAJUKAN)');

        await prisma.kRS.update({ where: { id: updated.id }, data: { status: StatusKRS.DISETUJUI, tanggalPersetujuan: new Date(), catatanDosen: 'Disetujui oleh seed' } });
        console.log('- Dosen: approved Andi KRS (DISETUJUI)');
      } else {
        console.log('- Andi already has classes in KRS, skipping add/submit flow');
      }
    }
  } catch (e) {
    console.error('⚠️ Andi KRS flow failed:', e instanceof Error ? e.message : e);
  }

  // 2) Clone elearning content for EXISTING non-merged configs (simulate clone behavior)
  try {
    const configsToClone = await prisma.elearningClassConfig.findMany({
      where: { setupMode: ElearningSetupMode.EXISTING, isMergedClass: false, sourceKelasPerkuliahanId: { not: null } },
    });

    for (const cfg of configsToClone) {
      await prisma.$transaction(async (tx) => {
        const existingCount = await tx.session.count({ where: { kelasPerkuliahanId: cfg.kelasPerkuliahanId } });
        if (existingCount > 0) return; // skip if target already has content

        const sourceSessions = await tx.session.findMany({
          where: { kelasPerkuliahanId: cfg.sourceKelasPerkuliahanId! },
          include: { materials: true, assignments: true, quizzes: { include: { questions: true } } },
          orderBy: { weekNumber: 'asc' },
        });

        for (const s of sourceSessions) {
          await tx.session.create({
            data: {
              title: s.title,
              description: s.description,
              weekNumber: s.weekNumber,
              kelasPerkuliahanId: cfg.kelasPerkuliahanId,
              materials: {
                create: s.materials.map((m) => ({ title: m.title, type: m.type, content: m.content, fileUrl: m.fileUrl, isHidden: true })),
              },
              assignments: {
                create: s.assignments.map((a) => ({ title: a.title, description: a.description, fileUrl: a.fileUrl, deadline: a.deadline, allowLate: a.allowLate, isHidden: true })),
              },
              quizzes: {
                create: s.quizzes.map((q) => ({
                  title: q.title,
                  description: q.description,
                  duration: q.duration,
                  startTime: q.startTime,
                  endTime: q.endTime,
                  gradingMethod: q.gradingMethod,
                  isHidden: true,
                  questions: { create: q.questions.map((qq) => ({ text: qq.text, type: qq.type, options: qq.options ?? undefined, correctAnswer: qq.correctAnswer, points: qq.points })) },
                })),
              },
            },
          });
        }
        console.log(`- Cloned ${sourceSessions.length} sessions into kelasId=${cfg.kelasPerkuliahanId}`);
      });
    }
  } catch (e) {
    console.error('⚠️ Elearning clone flow failed:', e instanceof Error ? e.message : e);
  }

  // 3) Presensi: create a token session for kelasWebB and mark Budi hadir
  try {
    const generateToken = (length: number) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
      return result;
    };

    const token = generateToken(8);
    const presensiSession = await prisma.presensiSession.create({
      data: {
        title: 'Sesi Presensi Testing',
        type: 'KELAS',
        kelasPerkuliahanId: kelasWebB.id,
        date: new Date(),
        isOpen: true,
        token,
        deadlineAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      },
    });

    await prisma.presensiRecord.create({ data: { sessionId: presensiSession.id, mahasiswaId: budiActive.id, method: 'TOKEN', status: 'HADIR' } });
    console.log(`- Presensi created for kelasWebB (session ${presensiSession.id}), Budi marked HADIR (token ${token})`);
  } catch (e) {
    console.error('⚠️ Presensi simulation failed:', e instanceof Error ? e.message : e);
  }

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('✅ Seeding Complete!');
  console.log('\n--- HOW TO TEST YOUR FLOWS ---');
  
  console.log('\n👤 STUDENT 1 (STARTING FROM SCRATCH):');
  console.log('Email: andi@univ.ac.id | Pass: 123456');
  console.log('  -> Login as Andi. You should see an empty KRS (DRAFT state).');
  console.log('  -> Go to the contract page, select "Pemrograman Web A", and submit it (changes status to DIAJUKAN).');
  
  console.log('\n👤 ADMIN / LECTURER (APPROVAL):');
  console.log('Email: koor@univ.ac.id OR dosen@univ.ac.id | Pass: 123456');
  console.log('  -> After Andi submits, log in here to approve or decline his KRS.');

  console.log('\n👨‍🏫 MULTI DOSEN KOLABORASI E-LEARNING:');
  console.log('Dosen 1 (master): dosen@univ.ac.id | Pass: 123456');
  console.log('Dosen 2 (member): dosen.kolab1@univ.ac.id | Pass: 123456');
  console.log('Dosen 3 (indep): dosen.kolab2@univ.ac.id | Pass: 123456');
  console.log('  -> Kelas WEB A (Dosen 1) adalah source/master konten.');
  console.log('  -> Kelas WEB B (Dosen 2) sudah merged ke WEB A (cross-dosen).');
  console.log('  -> Kelas WEB C (Dosen 3) masih independent (belum merge).');
  console.log('  -> Kelas WEB D simulasikan mode EXISTING non-merge dengan konten hidden.');
  console.log('  -> Coba invalid case: merge kelas WEB dengan ALGO A (harus gagal karena beda mata kuliah).');
  
  console.log('\n👤 STUDENT 2 (E-LEARNING ALREADY ACTIVE):');
  console.log('Email: budi@univ.ac.id | Pass: 123456');
  console.log('  -> Login as Budi. His KRS terhubung ke kelas WEB B (member class).');
  console.log('  -> Karena WEB B merged ke WEB A, konten WEB A akan terbaca otomatis.');
  console.log('  -> Konten dengan isHidden=true tidak tampil ke mahasiswa.');

  console.log('\n� SKENARIO MERGER DOSEN PENGAMPUH SAMA (KELAS BERBEDA):');
  console.log('Dosen (master & member): dosen@univ.ac.id | Pass: 123456');
  console.log('  -> Algo B (master) dan Algo C (member) diajar oleh DOSEN YANG SAMA.');
  console.log('  -> Algo C di-merge ke Algo B: setupMode=EXISTING, isMergedClass=true.');
  console.log('  -> Mahasiswa Citra ada di Algo C dan bisa mengakses konten Algo B.');
  console.log('  -> Untuk test: POST /elearning/setup/merge');
  console.log('     body: { masterKelasPerkuliahanId: <AlgoB_ID>, memberKelasPerkuliahanIds: [<AlgoC_ID>] }');
  console.log('  -> Atau gunakan endpoint setup: POST /elearning/setup/class');
  console.log('     body: { kelasPerkuliahanId: <AlgoC_ID>, setupMode: "EXISTING", sourceKelasPerkuliahanId: <AlgoB_ID>, isMergedClass: true }');

  console.log('\n👤 STUDENT 3 (MERGE SAME DOSEN):');
  console.log('Email: citra@univ.ac.id | Pass: 123456');
  console.log('  -> KRS Citra terhubung ke Algo C (member class).');
  console.log('  -> Karena Algo C merged ke Algo B, konten Algo B terbaca oleh Citra.');
  console.log('  -> Dosen yang mengajar SAMA (dosen@univ.ac.id), hanya kelasnya berbeda.');

  console.log('\n📚 DATA KELAS UNTUK TEST FRONTEND:');
  console.log(`WEB A ID: ${kelasWebA.id} | Dosen: ${dosen.email}`);
  console.log(`WEB B ID: ${kelasWebB.id} | Dosen: ${dosenKolab1.email}`);
  console.log(`WEB C ID: ${kelasWebC.id} | Dosen: ${dosenKolab2.email}`);
  console.log(`WEB D ID: ${kelasWebD.id} | Dosen: ${dosen.email}`);
  console.log(`ALGO A ID: ${kelasAlgoA.id} | Dosen: ${dosenKolab1.email}`);
  console.log(`ALGO B ID: ${kelasAlgoB.id} | Dosen: ${dosen.email} [MASTER MERGE - SAME DOSEN]`);
  console.log(`ALGO C ID: ${kelasAlgoC.id} | Dosen: ${dosen.email} [MEMBER MERGE - SAME DOSEN]`);

  console.log('\n👨‍🏫 DOSEN PA (PEMBIMBING AKADEMIK):');
  console.log('Email: dosen@univ.ac.id | Pass: 123456');
  console.log('  -> Dosen Dr. Budi Hartono adalah PA untuk semua mahasiswa (Andi, Budi, Citra, Dani).');
  console.log('  -> GET /academic/pa/mahasiswa → lihat daftar mahasiswa bimbingan');
  console.log('  -> GET /academic/pa/mahasiswa/:id/semesters → semester tersedia');
  console.log('  -> GET /academic/pa/mahasiswa/:id/khs?semester=... → lihat KHS');
  console.log('  -> GET /academic/pa/mahasiswa/:id/khs/download?semester=... → download KHS PDF');
  console.log('  -> GET /academic/pa/mahasiswa/:id/transkrip → lihat transkrip');
  console.log('  -> GET /academic/pa/mahasiswa/:id/transkrip/download → download transkrip PDF');
  console.log('  -> GET /academic/pa/mahasiswa/:id/ringkasan → ringkasan akademik untuk pertimbangan KRS');
  console.log('-------------------------------\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });