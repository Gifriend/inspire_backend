import 'dotenv/config';
import { 
  PrismaClient, Role, Gender, Status, StatusKRS, ElearningSetupMode,
  MaterialType, QuestionType, QuizGradingMethod, TaskKategori
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ============================================================
// SEED PURPOSE:
//   This seed creates a complete, repeatable test dataset that
//   covers every major feature flow in the application:
//
//   1. KRS (Study Plan): DRAFT → DIAJUKAN → DISETUJUI / DITOLAK
//   2. Nilai (Grading): historical KHS + transkrip for a senior student
//   3. E-Learning: NEW / EXISTING / merged (same-dosen & cross-dosen)
//   4. E-Learning Content: materials, assignments (with bobot/kategori),
//      quizzes (with bobot/kategori), student submissions & quiz attempts
//   5. Participation: populated so /kelas/:id/participation returns data
//   6. My-Grades / Ranking: populated so /kelas/:id/my-grades & ranking work
//   7. Grade Submission: one graded + one ungraded submission for testing
//      PATCH /elearning/submission/:id/grade
//   8. Presensi (Attendance): open session with token + student records
//   9. Pengumuman (Announcements): global + class-specific
//  10. Dosen PA (Academic Advisor): all students assigned to one advisor
// ============================================================

async function main() { 
  console.log('🌱 Starting database seed...');

  const currentYear = new Date().getFullYear();
  const activeAcademicYear = `${currentYear - 1}/${currentYear} Genap`;

  // ==========================================
  // 0. CLEANUP — safe to re-run any time
  // ==========================================
  console.log('🧹 Cleaning up old transactional data...');
  await prisma.presensiRecord.deleteMany({});
  await prisma.presensiSession.deleteMany({});
  await prisma.pengumuman.deleteMany({});
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
  // 2. USERS — all passwords are "123456"
  // ==========================================
  const password = await bcrypt.hash('123456', 10);

  // This is the main lecturer (PA/advisor for all students).
  // Teaches: Web A, Web D, Algo B (master), Algo C (member/merged).
  // Use to: approve/reject KRS, grade submissions, manage e-learning content,
  //         view participation, view ranking, manage presensi.
  const dosen = await prisma.user.upsert({
    where: { email: 'dosen@univ.ac.id' }, update: { password },
    create: {
      name: 'Dr. Budi Hartono', email: 'dosen@univ.ac.id', nip: '19800101',
      role: Role.DOSEN, gender: Gender.LAKI_LAKI, password,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
    },
  });

  // This is the second collaborating lecturer.
  // Teaches: Web B (merged to Web A as cross-dosen), Algo A (independent).
  const dosenKolab1 = await prisma.user.upsert({
    where: { email: 'dosen.kolab1@univ.ac.id' }, update: { password },
    create: {
      name: 'Dr. Sari Widya', email: 'dosen.kolab1@univ.ac.id', nip: '19809002',
      role: Role.DOSEN, gender: Gender.PEREMPUAN, password,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
    },
  });

  // This is the third collaborating lecturer.
  // Teaches: Web C (independent NEW setup, no merge).
  const dosenKolab2 = await prisma.user.upsert({
    where: { email: 'dosen.kolab2@univ.ac.id' }, update: { password },
    create: {
      name: 'Dr. Rudi Pratama', email: 'dosen.kolab2@univ.ac.id', nip: '19809003',
      role: Role.DOSEN, gender: Gender.LAKI_LAKI, password,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
    },
  });

  // This is the study program coordinator (Koorprodi).
  // Use to: approve/reject KRS (same capability as dosen in this system).
  const koorprodi = await prisma.user.upsert({
    where: { email: 'koor@univ.ac.id' }, update: { password },
    create: {
      name: 'Prof. Kurniawan', email: 'koor@univ.ac.id', nip: '19750101',
      role: Role.KOORPRODI, gender: Gender.LAKI_LAKI, password,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
    },
  });

  // STUDENT 1 — Andi: fresh student with a DRAFT KRS, no classes connected yet.
  // Test flow: login → add class to KRS → submit KRS (DIAJUKAN) → dosen approves/rejects.
  const andiBlank = await prisma.user.upsert({
    where: { email: 'andi@univ.ac.id' }, update: { password },
    create: {
      name: 'Andi Saputra', email: 'andi@univ.ac.id', nim: '20249001', 
      role: Role.MAHASISWA, gender: Gender.LAKI_LAKI, password,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
    },
  });

  // STUDENT 2 — Budi: KRS already APPROVED, enrolled in Web B (cross-dosen merged to Web A).
  // Test flow: view courses, submit assignment, take quiz, view my-grades,
  //            view participants, submit presensi via token.
  const budiActive = await prisma.user.upsert({
    where: { email: 'budi@univ.ac.id' }, update: { password },
    create: {
      name: 'Budi Santoso', email: 'budi@univ.ac.id', nim: '20249002',
      role: Role.MAHASISWA, gender: Gender.LAKI_LAKI, password,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
    },
  });

  // STUDENT 3 — Citra: KRS approved, enrolled in Algo C (same-dosen merged to Algo B).
  // Test flow: access e-learning content of Algo B through merged Algo C,
  //            submit assignment, test participation & ranking endpoints.
  const citraAlgo = await prisma.user.upsert({
    where: { email: 'citra@univ.ac.id' }, update: { password },
    create: {
      name: 'Citra Dewi', email: 'citra@univ.ac.id', nim: '20240002',
      role: Role.MAHASISWA, gender: Gender.PEREMPUAN, password,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
    },
  });

  // STUDENT 4 — Dani: senior student with completed semesters 1 & 2 (KHS + transkrip).
  // Test flow: GET /academic/pa/mahasiswa/:id/khs, /transkrip, /ringkasan.
  const daniTranskrip = await prisma.user.upsert({
    where: { email: 'dani@univ.ac.id' }, update: { password },
    create: {
      name: 'Dani Firmansyah', email: 'dani@univ.ac.id', nim: '20239001',
      role: Role.MAHASISWA, gender: Gender.LAKI_LAKI, password,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
      ipk: 0, totalSksLulus: 0, // will be recalculated below after Nilai seed
    },
  });

  // STUDENT 5 — Eva: KRS DITOLAK (rejected), used to test the rejection flow.
  // Test flow: dosen rejects KRS → student sees DITOLAK + catatanDosen.
  const evaRejected = await prisma.user.upsert({
    where: { email: 'eva@univ.ac.id' }, update: { password },
    create: {
      name: 'Eva Rahayu', email: 'eva@univ.ac.id', nim: '20249003',
      role: Role.MAHASISWA, gender: Gender.PEREMPUAN, password,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
    },
  });

  // ==========================================
  // 3. MATAKULIAH & KELAS PERKULIAHAN
  // ==========================================
  let kurikulum = await prisma.kurikulum.findFirst({ where: { name: 'Kurikulum 2024' } });
  if (!kurikulum) {
    kurikulum = await prisma.kurikulum.create({ data: { name: 'Kurikulum 2024', tahun: 2024, prodiId: ifProdi.id }});
  }

  // --- Courses for semester 1 (historical data for Dani's KHS/Transkrip) ---
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

  // --- Courses for semester 2 (historical data for Dani's KHS/Transkrip) ---
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

  // --- Courses for semester 3 (active semester, with e-learning content) ---
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

  // --- Classes ---
  // Web A: master class for e-learning (NEW). Taught by dosen (main lecturer).
  // Enrolled by: Andi (after seed flow), Dani.
  const kelasWebA = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'WEB-GENAP-REGULER' },
    update: {
      nama: 'Pemrograman Web A', kapasitas: 40, ruangan: 'Lab Komputer 1',
      jadwal: 'Senin 08:00-10:00', academicYear: activeAcademicYear,
      mataKuliahId: mkWeb.id, dosenId: dosen.id,
    },
    create: {
      nama: 'Pemrograman Web A', kode: 'WEB-GENAP-REGULER', kapasitas: 40,
      ruangan: 'Lab Komputer 1', jadwal: 'Senin 08:00-10:00',
      academicYear: activeAcademicYear, mataKuliahId: mkWeb.id, dosenId: dosen.id
    }
  });

  // Web B: EXISTING (cross-dosen merge) — points to Web A as source.
  // Enrolled by: Budi. isMergedClass=true means it reads content from Web A.
  const kelasWebB = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'WEB-GENAP-KOLAB-B' },
    update: {
      nama: 'Pemrograman Web B', kapasitas: 35, ruangan: 'Lab Komputer 2',
      jadwal: 'Selasa 10:00-12:00', academicYear: activeAcademicYear,
      mataKuliahId: mkWeb.id, dosenId: dosenKolab1.id,
    },
    create: {
      nama: 'Pemrograman Web B', kode: 'WEB-GENAP-KOLAB-B', kapasitas: 35,
      ruangan: 'Lab Komputer 2', jadwal: 'Selasa 10:00-12:00',
      academicYear: activeAcademicYear, mataKuliahId: mkWeb.id, dosenId: dosenKolab1.id
    }
  });

  // Web C: independent NEW setup. Taught by dosenKolab2. No students enrolled.
  // Used to test: independent e-learning creation, no merge.
  const kelasWebC = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'WEB-GENAP-KOLAB-C' },
    update: {
      nama: 'Pemrograman Web C', kapasitas: 30, ruangan: 'Lab Komputer 3',
      jadwal: 'Rabu 13:00-15:00', academicYear: activeAcademicYear,
      mataKuliahId: mkWeb.id, dosenId: dosenKolab2.id,
    },
    create: {
      nama: 'Pemrograman Web C', kode: 'WEB-GENAP-KOLAB-C', kapasitas: 30,
      ruangan: 'Lab Komputer 3', jadwal: 'Rabu 13:00-15:00',
      academicYear: activeAcademicYear, mataKuliahId: mkWeb.id, dosenId: dosenKolab2.id
    }
  });

  // Web D: EXISTING non-merged clone from Web A (content hidden by default).
  // Used to test: clone mode (isMergedClass=false, setupMode=EXISTING).
  const kelasWebD = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'WEB-GENAP-CLONE-D' },
    update: {
      nama: 'Pemrograman Web D', kapasitas: 25, ruangan: 'Lab Komputer 4',
      jadwal: 'Kamis 08:00-10:00', academicYear: activeAcademicYear,
      mataKuliahId: mkWeb.id, dosenId: dosen.id,
    },
    create: {
      nama: 'Pemrograman Web D', kode: 'WEB-GENAP-CLONE-D', kapasitas: 25,
      ruangan: 'Lab Komputer 4', jadwal: 'Kamis 08:00-10:00',
      academicYear: activeAcademicYear, mataKuliahId: mkWeb.id, dosenId: dosen.id
    }
  });

  // Algo A: independent NEW setup. Taught by dosenKolab1. Enrolled by Dani.
  const kelasAlgoA = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'ALGO-GENAP-A' },
    update: {
      nama: 'Algoritma A', kapasitas: 40, ruangan: 'Ruang 201',
      jadwal: 'Jumat 09:00-11:00', academicYear: activeAcademicYear,
      mataKuliahId: mkAlgo.id, dosenId: dosenKolab1.id,
    },
    create: {
      nama: 'Algoritma A', kode: 'ALGO-GENAP-A', kapasitas: 40,
      ruangan: 'Ruang 201', jadwal: 'Jumat 09:00-11:00',
      academicYear: activeAcademicYear, mataKuliahId: mkAlgo.id, dosenId: dosenKolab1.id
    }
  });

  // Algo B: MASTER class for same-dosen merge scenario. Taught by dosen.
  // setupMode=NEW. AlgoC is the member that merges into this.
  const kelasAlgoB = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'ALGO-GENAP-B-MASTER' },
    update: {
      nama: 'Algoritma B (Master Merge)', kapasitas: 35, ruangan: 'Ruang 202',
      jadwal: 'Senin 13:00-15:00', academicYear: activeAcademicYear,
      mataKuliahId: mkAlgo.id, dosenId: dosen.id,
    },
    create: {
      nama: 'Algoritma B (Master Merge)', kode: 'ALGO-GENAP-B-MASTER', kapasitas: 35,
      ruangan: 'Ruang 202', jadwal: 'Senin 13:00-15:00',
      academicYear: activeAcademicYear, mataKuliahId: mkAlgo.id, dosenId: dosen.id,
    },
  });

  // Algo C: MEMBER class merged to Algo B (same lecturer, different class).
  // setupMode=EXISTING, isMergedClass=true, source=AlgoB. Enrolled by Citra.
  // Citra access Algo B content transparently through this merge.
  const kelasAlgoC = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'ALGO-GENAP-C-MEMBER' },
    update: {
      nama: 'Algoritma C (Member Merge)', kapasitas: 30, ruangan: 'Ruang 203',
      jadwal: 'Rabu 08:00-10:00', academicYear: activeAcademicYear,
      mataKuliahId: mkAlgo.id, dosenId: dosen.id,
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

  // Andi's KRS → DRAFT (empty, 0 SKS — student hasn't picked classes yet).
  // Test flow: POST /krs/add-class + POST /krs/submit → dosen PATCH /krs/:id/approve
  await prisma.kRS.upsert({
    where: {
      mahasiswaId_academicYear: {
        mahasiswaId: andiBlank.id,
        academicYear: activeAcademicYear,
      },
    },
    update: {
      status: StatusKRS.DRAFT, totalSKS: 0,
      kelasPerkuliahan: { set: [] },
      tanggalPengajuan: null, tanggalPersetujuan: null, catatanDosen: null,
    },
    create: {
      mahasiswaId: andiBlank.id, academicYear: activeAcademicYear,
      status: StatusKRS.DRAFT, totalSKS: 0,
    },
  });

  // Budi's KRS → DISETUJUI (approved, enrolled in Web B).
  // Test flow: access e-learning via GET /elearning/courses,
  //            submit assignment, take quiz, view my-grades, presensi.
  await prisma.kRS.upsert({
    where: {
      mahasiswaId_academicYear: {
        mahasiswaId: budiActive.id,
        academicYear: activeAcademicYear,
      },
    },
    update: {
      status: StatusKRS.DISETUJUI, totalSKS: 3,
      kelasPerkuliahan: { set: [{ id: kelasWebB.id }] },
      tanggalPersetujuan: new Date(),
    },
    create: {
      mahasiswaId: budiActive.id, academicYear: activeAcademicYear,
      status: StatusKRS.DISETUJUI, totalSKS: 3,
      tanggalPersetujuan: new Date(),
      kelasPerkuliahan: { connect: [{ id: kelasWebB.id }] },
    },
  });

  // Citra's KRS → DISETUJUI (enrolled in Algo C, which merges into Algo B).
  // Test flow: student accesses content from merged master class (Algo B).
  await prisma.kRS.upsert({
    where: {
      mahasiswaId_academicYear: {
        mahasiswaId: citraAlgo.id,
        academicYear: activeAcademicYear,
      },
    },
    update: {
      status: StatusKRS.DISETUJUI, totalSKS: 3,
      kelasPerkuliahan: { set: [{ id: kelasAlgoC.id }] },
      tanggalPersetujuan: new Date(),
    },
    create: {
      mahasiswaId: citraAlgo.id, academicYear: activeAcademicYear,
      status: StatusKRS.DISETUJUI, totalSKS: 3, tanggalPersetujuan: new Date(),
      kelasPerkuliahan: { connect: [{ id: kelasAlgoC.id }] },
    },
  });

  // Eva's KRS → DITOLAK (rejected) — demonstrates the rejection flow.
  // catatanDosen is the rejection reason shown to the student.
  await prisma.kRS.upsert({
    where: {
      mahasiswaId_academicYear: {
        mahasiswaId: evaRejected.id,
        academicYear: activeAcademicYear,
      },
    },
    update: {
      status: StatusKRS.DITOLAK, totalSKS: 3,
      kelasPerkuliahan: { set: [{ id: kelasWebA.id }] },
      tanggalPengajuan: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      tanggalPersetujuan: null,
      catatanDosen: 'Jumlah SKS tidak memenuhi syarat minimum semester ini. Silakan konsultasi dengan dosen PA.',
    },
    create: {
      mahasiswaId: evaRejected.id, academicYear: activeAcademicYear,
      status: StatusKRS.DITOLAK, totalSKS: 3,
      tanggalPengajuan: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      catatanDosen: 'Jumlah SKS tidak memenuhi syarat minimum semester ini. Silakan konsultasi dengan dosen PA.',
      kelasPerkuliahan: { connect: [{ id: kelasWebA.id }] },
    },
  });

  // ==========================================
  // 4b. DANI's KRS & NILAI (KHS + TRANSKRIP DATA)
  // ==========================================
  // Dani completed semester 1 (2023/2024 Ganjil) and semester 2 (2023/2024 Genap),
  // and is currently active in semester 3. This enables testing:
  //   GET /academic/pa/mahasiswa/:id/khs?semester=2023/2024 Ganjil
  //   GET /academic/pa/mahasiswa/:id/transkrip
  //   GET /academic/pa/mahasiswa/:id/ringkasan

  const sem1AY = '2023/2024 Ganjil';
  const sem2AY = '2023/2024 Genap';
  const sem3AY = activeAcademicYear;

  // Semester 1 KRS (completed, approved)
  await prisma.kRS.upsert({
    where: { mahasiswaId_academicYear: { mahasiswaId: daniTranskrip.id, academicYear: sem1AY } },
    update: { status: StatusKRS.DISETUJUI, totalSKS: 13, tanggalPersetujuan: new Date('2023-09-05') },
    create: {
      mahasiswaId: daniTranskrip.id, academicYear: sem1AY,
      status: StatusKRS.DISETUJUI, totalSKS: 13,
      tanggalPengajuan: new Date('2023-09-01'), tanggalPersetujuan: new Date('2023-09-05'),
    },
  });

  // Semester 2 KRS (completed, approved)
  await prisma.kRS.upsert({
    where: { mahasiswaId_academicYear: { mahasiswaId: daniTranskrip.id, academicYear: sem2AY } },
    update: { status: StatusKRS.DISETUJUI, totalSKS: 14, tanggalPersetujuan: new Date('2024-02-10') },
    create: {
      mahasiswaId: daniTranskrip.id, academicYear: sem2AY,
      status: StatusKRS.DISETUJUI, totalSKS: 14,
      tanggalPengajuan: new Date('2024-02-05'), tanggalPersetujuan: new Date('2024-02-10'),
    },
  });

  // Semester 3 KRS (active, approved) — enrolled in Web A and Algo A
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

  // --- Semester 1 grades: Dasar Prog A, Kalkulus I B+, Fisika B, B.Inggris A, PTI A ---
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

  // --- Semester 2 grades: OOP A, Kalkulus II B, Statistika B+, Logika A, Sisdig B+ ---
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

  // Semester 3 mid-semester: Basis Data partial (no UAS yet → BELUM_ADA)
  await prisma.nilai.upsert({
    where: { mahasiswaId_mataKuliahId_academicYear: { mahasiswaId: daniTranskrip.id, mataKuliahId: mkBasisData.id, academicYear: sem3AY } },
    update: { nilaiTugas: 85, nilaiUTS: 80, nilaiUAS: 0, nilaiAkhir: 0, nilaiHuruf: null, indeksNilai: null, status: 'BELUM_ADA' },
    create: { mahasiswaId: daniTranskrip.id, academicYear: sem3AY, mataKuliahId: mkBasisData.id, status: 'BELUM_ADA', nilaiTugas: 85, nilaiUTS: 80 },
  });

  // Recalculate Dani's cumulative IPK and total passed SKS.
  // Sem1: 3*4.0 + 3*3.5 + 3*3.0 + 2*4.0 + 2*4.0 = 47.5 / 13 SKS
  // Sem2: 3*4.0 + 3*3.0 + 3*3.5 + 3*4.0 + 2*3.5 = 50.5 / 14 SKS
  // IPK cumulative: (47.5 + 50.5) / (13 + 14) = 98 / 27 ≈ 3.63
  await prisma.user.update({
    where: { id: daniTranskrip.id },
    data: { ipk: 3.63, totalSksLulus: 27, semesterTerakhir: sem3AY },
  });

  // ==========================================
  // 5. E-LEARNING CONFIG SCENARIOS
  // ==========================================

  // Web A: NEW (master source for Web B and Web D)
  await prisma.elearningClassConfig.upsert({
    where: { kelasPerkuliahanId: kelasWebA.id },
    update: { setupMode: ElearningSetupMode.NEW, sourceKelasPerkuliahanId: null, isMergedClass: false, createdByDosenId: dosen.id },
    create: { kelasPerkuliahanId: kelasWebA.id, setupMode: ElearningSetupMode.NEW, isMergedClass: false, createdByDosenId: dosen.id },
  });

  // Web B: EXISTING + isMergedClass=true (cross-dosen merge — reads Web A content)
  await prisma.elearningClassConfig.upsert({
    where: { kelasPerkuliahanId: kelasWebB.id },
    update: { setupMode: ElearningSetupMode.EXISTING, sourceKelasPerkuliahanId: kelasWebA.id, isMergedClass: true, createdByDosenId: dosenKolab1.id },
    create: { kelasPerkuliahanId: kelasWebB.id, setupMode: ElearningSetupMode.EXISTING, sourceKelasPerkuliahanId: kelasWebA.id, isMergedClass: true, createdByDosenId: dosenKolab1.id },
  });

  // Web C: NEW + independent (dosenKolab2, no merge)
  await prisma.elearningClassConfig.upsert({
    where: { kelasPerkuliahanId: kelasWebC.id },
    update: { setupMode: ElearningSetupMode.NEW, sourceKelasPerkuliahanId: null, isMergedClass: false, createdByDosenId: dosenKolab2.id },
    create: { kelasPerkuliahanId: kelasWebC.id, setupMode: ElearningSetupMode.NEW, isMergedClass: false, createdByDosenId: dosenKolab2.id },
  });

  // Web D: EXISTING + isMergedClass=false (clone of Web A with hidden content)
  await prisma.elearningClassConfig.upsert({
    where: { kelasPerkuliahanId: kelasWebD.id },
    update: { setupMode: ElearningSetupMode.EXISTING, sourceKelasPerkuliahanId: kelasWebA.id, isMergedClass: false, createdByDosenId: dosen.id },
    create: { kelasPerkuliahanId: kelasWebD.id, setupMode: ElearningSetupMode.EXISTING, sourceKelasPerkuliahanId: kelasWebA.id, isMergedClass: false, createdByDosenId: dosen.id },
  });

  // Algo B: NEW (master source for Algo C — same-dosen merge scenario)
  await prisma.elearningClassConfig.upsert({
    where: { kelasPerkuliahanId: kelasAlgoB.id },
    update: { setupMode: ElearningSetupMode.NEW, sourceKelasPerkuliahanId: null, isMergedClass: false, createdByDosenId: dosen.id },
    create: { kelasPerkuliahanId: kelasAlgoB.id, setupMode: ElearningSetupMode.NEW, isMergedClass: false, createdByDosenId: dosen.id },
  });

  // Algo C: EXISTING + isMergedClass=true (same-dosen merge into Algo B).
  // Citra is enrolled here but reads Algo B content transparently.
  await prisma.elearningClassConfig.upsert({
    where: { kelasPerkuliahanId: kelasAlgoC.id },
    update: { setupMode: ElearningSetupMode.EXISTING, sourceKelasPerkuliahanId: kelasAlgoB.id, isMergedClass: true, createdByDosenId: dosen.id },
    create: { kelasPerkuliahanId: kelasAlgoC.id, setupMode: ElearningSetupMode.EXISTING, sourceKelasPerkuliahanId: kelasAlgoB.id, isMergedClass: true, createdByDosenId: dosen.id },
  });

  // Algo A: NEW + independent (dosenKolab1, Dani enrolled)
  await prisma.elearningClassConfig.upsert({
    where: { kelasPerkuliahanId: kelasAlgoA.id },
    update: { setupMode: ElearningSetupMode.NEW, sourceKelasPerkuliahanId: null, isMergedClass: false, createdByDosenId: dosenKolab1.id },
    create: { kelasPerkuliahanId: kelasAlgoA.id, setupMode: ElearningSetupMode.NEW, isMergedClass: false, createdByDosenId: dosenKolab1.id },
  });

  // ==========================================
  // 6. E-LEARNING CONTENT
  // ==========================================

  // Helper: create 16 default empty sessions for a class
  const createDefaultSessions = async (kelasPerkuliahanId: number) => {
    const sessions: { id: string; weekNumber: number }[] = [];
    for (let i = 1; i <= 16; i++) {
      const s = await prisma.session.create({
        data: { title: `Pertemuan ${i}`, weekNumber: i, kelasPerkuliahanId },
        select: { id: true, weekNumber: true },
      });
      sessions.push(s);
    }
    return sessions;
  };

  // -------------------------------------------------------
  // WEB A (master, NEW) — full content for testing all flows
  // -------------------------------------------------------
  const webASessions = await createDefaultSessions(kelasWebA.id);

  // Session 1: materials (one visible, one hidden) + assignment with bobot
  // isHidden=false → visible to students; isHidden=true → only lecturer sees it
  await prisma.material.createMany({
    data: [
      {
        title: 'Slide Pengenalan Web Development',
        type: MaterialType.FILE,
        fileUrl: 'https://example.com/slide-web-intro.pdf',
        isHidden: false,
        sessionId: webASessions[0].id,
      },
      {
        title: 'Catatan Tambahan (Draft — belum dipublish)',
        type: MaterialType.TEXT,
        content: 'Materi ini masih dalam penyusunan dan belum ditampilkan ke mahasiswa.',
        isHidden: true,
        sessionId: webASessions[0].id,
      },
    ],
  });

  // Assignment 1: TUGAS kategori (bobot 20%) — visible, deadline future
  // Test flow: student submits → lecturer grades via PATCH /elearning/submission/:id/grade
  const assignment1WebA = await prisma.assignment.create({
    data: {
      title: 'Tugas 1: Buat Halaman Profil HTML',
      description: 'Buat halaman profil personal menggunakan HTML & CSS murni. Kumpulkan link repository GitHub.',
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      allowLate: true,
      isHidden: false,
      kategori: TaskKategori.TUGAS,
      bobot: 20,
      sessionId: webASessions[0].id,
    },
  });

  // Assignment 2: TUGAS kategori (bobot 0%) — hidden draft, not yet published
  const assignment2WebA = await prisma.assignment.create({
    data: {
      title: 'Tugas 2: Mini Landing Page (Draft)',
      description: 'Akan dipublish setelah pertemuan 2 selesai.',
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      allowLate: false,
      isHidden: true,
      kategori: TaskKategori.TUGAS,
      bobot: 0,
      sessionId: webASessions[0].id,
    },
  });

  // Session 2: UTS assignment (bobot 30%) + quiz (bobot 10%) + hidden quiz draft
  const assignmentUTSWebA = await prisma.assignment.create({
    data: {
      title: 'UTS: Implementasi Responsive Web',
      description: 'Implementasikan halaman web responsive dengan 3 breakpoint.',
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      allowLate: false,
      isHidden: false,
      kategori: TaskKategori.UTS,
      bobot: 30,
      sessionId: webASessions[1].id,
    },
  });

  // Quiz 1: active (startTime past, endTime future) — students can attempt it
  // kategori=KUIS, bobot=10%, grading=HIGHEST_GRADE
  const quiz1WebA = await prisma.quiz.create({
    data: {
      title: 'Quiz 1: HTML Tag Basics',
      description: 'Uji pemahaman dasar tentang HTML tags dan atribut.',
      duration: 30,
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      gradingMethod: QuizGradingMethod.HIGHEST_GRADE,
      isHidden: false,
      kategori: TaskKategori.KUIS,
      bobot: 10,
      sessionId: webASessions[1].id,
      questions: {
        create: [
          {
            text: 'Tag HTML yang digunakan untuk membuat hyperlink adalah?',
            type: QuestionType.MULTIPLE_CHOICE,
            options: ['<a>', '<link>', '<href>', '<p>'],
            correctAnswer: '<a>',
            points: 50,
          },
          {
            text: 'Atribut yang wajib ada pada tag <img> adalah?',
            type: QuestionType.MULTIPLE_CHOICE,
            options: ['src', 'href', 'class', 'id'],
            correctAnswer: 'src',
            points: 50,
          },
        ],
      },
    },
  });

  // Quiz 2: hidden draft (not published to students)
  await prisma.quiz.create({
    data: {
      title: 'Quiz 2: CSS Layout Draft',
      description: 'Draft — belum dipublish.',
      duration: 20,
      startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      gradingMethod: QuizGradingMethod.LATEST_GRADE,
      isHidden: true,
      kategori: TaskKategori.KUIS,
      bobot: 0,
      sessionId: webASessions[1].id,
      questions: {
        create: [
          {
            text: 'CSS property untuk warna teks adalah?',
            type: QuestionType.MULTIPLE_CHOICE,
            options: ['font-color', 'color', 'text-color', 'fgcolor'],
            correctAnswer: 'color',
            points: 100,
          },
        ],
      },
    },
  });

  // Session 3: UAS assignment (bobot 40%) — not yet open for submission
  await prisma.assignment.create({
    data: {
      title: 'UAS: Full-Stack Web Project',
      description: 'Bangun aplikasi web lengkap dengan frontend dan backend sederhana.',
      deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      allowLate: false,
      isHidden: false,
      kategori: TaskKategori.UAS,
      bobot: 40,
      sessionId: webASessions[2].id,
    },
  });

  // -------------------------------------------------------
  // SUBMISSIONS & QUIZ ATTEMPTS — populate participation & grades data
  // -------------------------------------------------------

  // Budi submits Assignment 1 → GRADED (grade=90).
  // Use to test: GET /elearning/assignment/:id/submissions (as dosen)
  //              GET /elearning/kelas/:id/participation (dosen sees Budi's submission)
  //              GET /elearning/kelas/:id/my-grades (Budi sees his own grade)
  //              GET /elearning/kelas/:id/ranking (Budi's rank appears)
  const budiSub1 = await prisma.submission.create({
    data: {
      studentId: budiActive.id,
      assignmentId: assignment1WebA.id,
      textContent: 'Link repo: https://github.com/budi-santoso/tugas1-web',
      grade: 90,
      feedback: 'Bagus! Struktur HTML sudah rapi. Perhatikan semantic tags.',
    },
  });

  // Dani submits Assignment 1 → UNGRADED (no grade yet).
  // Use to test: PATCH /elearning/submission/:id/grade — grade this submission
  const daniSub1 = await prisma.submission.create({
    data: {
      studentId: daniTranskrip.id,
      assignmentId: assignment1WebA.id,
      textContent: 'Link repo: https://github.com/dani-firmansyah/html-profile',
      grade: null,
      feedback: null,
    },
  });

  // Budi attempts Quiz 1 → full score (100/100 → 100%)
  // Use to test: GET /elearning/quiz/:id/attempts (as dosen)
  const budiAttempt1 = await prisma.quizAttempt.create({
    data: {
      studentId: budiActive.id,
      quizId: quiz1WebA.id,
      score: 100,
      finishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    },
  });

  // Dani attempts Quiz 1 → partial score (50/100 → 50%)
  const daniAttempt1 = await prisma.quizAttempt.create({
    data: {
      studentId: daniTranskrip.id,
      quizId: quiz1WebA.id,
      score: 50,
      finishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    },
  });

  // -------------------------------------------------------
  // WEB C (NEW, independent — dosenKolab2, no students enrolled)
  // -------------------------------------------------------
  await createDefaultSessions(kelasWebC.id);

  // -------------------------------------------------------
  // ALGO B (NEW, master for same-dosen merge — Citra enrolled via Algo C)
  // -------------------------------------------------------
  const algoBSessions = await createDefaultSessions(kelasAlgoB.id);

  await prisma.material.createMany({
    data: [
      {
        title: 'Slide Big O Notation',
        type: MaterialType.FILE,
        fileUrl: 'https://example.com/big-o-notation.pdf',
        isHidden: false,
        sessionId: algoBSessions[0].id,
      },
      {
        title: 'Contoh Kode Tambahan (Hidden)',
        type: MaterialType.TEXT,
        content: 'Materi suplemen ini disembunyikan sebelum kelas dimulai.',
        isHidden: true,
        sessionId: algoBSessions[0].id,
      },
    ],
  });

  // Assignment Algo B 1: TUGAS bobot=30%
  const assignmentAlgoB1 = await prisma.assignment.create({
    data: {
      title: 'Tugas 1: Analisis Kompleksitas Sorting',
      description: 'Tentukan dan jelaskan kompleksitas waktu untuk 3 algoritma sorting (Bubble, Merge, Quick).',
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      allowLate: false,
      isHidden: false,
      kategori: TaskKategori.TUGAS,
      bobot: 30,
      sessionId: algoBSessions[0].id,
    },
  });

  // Assignment Algo B 2: UTS bobot=30%
  await prisma.assignment.create({
    data: {
      title: 'UTS: Implementasi Linked List',
      description: 'Implementasikan singly linked list dengan operasi insert, delete, dan search.',
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      allowLate: false,
      isHidden: false,
      kategori: TaskKategori.UTS,
      bobot: 30,
      sessionId: algoBSessions[1].id,
    },
  });

  // Quiz Algo B: KUIS bobot=10%, active
  const quizAlgoB1 = await prisma.quiz.create({
    data: {
      title: 'Quiz 1: Stack & Queue Basics',
      duration: 20,
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      gradingMethod: QuizGradingMethod.HIGHEST_GRADE,
      isHidden: false,
      kategori: TaskKategori.KUIS,
      bobot: 10,
      sessionId: algoBSessions[1].id,
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
  });

  // Citra submits Algo B Assignment 1 → GRADED (grade=85)
  // Note: Citra is enrolled in Algo C (member), which transparently reads Algo B (master).
  await prisma.submission.create({
    data: {
      studentId: citraAlgo.id,
      assignmentId: assignmentAlgoB1.id,
      textContent: 'Bubble Sort: O(n²) worst, O(n) best. Merge Sort: O(n log n). Quick Sort: O(n²) worst.',
      grade: 85,
      feedback: 'Analisis sudah benar. Tambahkan contoh kode untuk nilai lebih.',
    },
  });

  // Citra attempts Quiz Algo B 1 → perfect score
  await prisma.quizAttempt.create({
    data: {
      studentId: citraAlgo.id,
      quizId: quizAlgoB1.id,
      score: 100,
      finishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    },
  });

  // -------------------------------------------------------
  // ALGO A (NEW, independent — dosenKolab1, Dani enrolled)
  // -------------------------------------------------------
  await createDefaultSessions(kelasAlgoA.id);

  // ==========================================
  // 7. ASSIGN DOSEN PA (ACADEMIC ADVISOR)
  // ==========================================
  console.log('👨‍🏫 Assigning Academic Advisors (Dosen PA)...');
  // dosen (Dr. Budi Hartono) is the academic advisor for all students.
  // Test flow: GET /academic/pa/mahasiswa → list students under this advisor
  await prisma.user.updateMany({
    where: { id: { in: [andiBlank.id, budiActive.id, citraAlgo.id, daniTranskrip.id, evaRejected.id] } },
    data: { dosenPAId: dosen.id },
  });

  // ==========================================
  // 8. PRESENSI (ATTENDANCE) SESSIONS
  // ==========================================
  console.log('📋 Creating presensi sessions...');

  const generateToken = (length: number) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
  };

  // Presensi session 1 (Web B): OPEN — students can still submit via token.
  // Budi is marked HADIR via TOKEN.
  // Test flow: POST /presensi/submit with token
  const tokenWebB1 = generateToken(8);
  const presensiWebB1 = await prisma.presensiSession.create({
    data: {
      title: 'Pertemuan 1 - Pengenalan Web',
      type: 'KELAS',
      kelasPerkuliahanId: kelasWebB.id,
      date: new Date(),
      isOpen: true,
      token: tokenWebB1,
      deadlineAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  await prisma.presensiRecord.create({
    data: { sessionId: presensiWebB1.id, mahasiswaId: budiActive.id, method: 'TOKEN', status: 'HADIR' },
  });

  // Presensi session 2 (Web A): CLOSED — testing a closed session scenario.
  // Dani is marked HADIR via MANUAL entry.
  // Test flow: GET /presensi/kelas/:id/sessions → see this closed session
  const tokenWebA1 = generateToken(8);
  const presensiWebA1 = await prisma.presensiSession.create({
    data: {
      title: 'Pertemuan 1 - Pengenalan Web Development',
      type: 'KELAS',
      kelasPerkuliahanId: kelasWebA.id,
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      isOpen: false,
      token: tokenWebA1,
      deadlineAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.presensiRecord.create({
    data: { sessionId: presensiWebA1.id, mahasiswaId: daniTranskrip.id, method: 'MANUAL', status: 'HADIR' },
  });

  // Presensi session 3 (Algo B): OPEN — for testing same-dosen merge presensi.
  // Citra not yet recorded (tests Alpha/missing case in GET /presensi/kelas/:id/mahasiswa)
  const tokenAlgoB1 = generateToken(8);
  await prisma.presensiSession.create({
    data: {
      title: 'Pertemuan 1 - Big O Notation',
      type: 'KELAS',
      kelasPerkuliahanId: kelasAlgoB.id,
      date: new Date(),
      isOpen: true,
      token: tokenAlgoB1,
      deadlineAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
    },
  });

  // ==========================================
  // 9. PENGUMUMAN (ANNOUNCEMENTS)
  // ==========================================
  console.log('📢 Creating announcements...');

  // Global announcement (no specific class) — visible to all students.
  // Use to test: GET /pengumuman?isGlobal=true
  await prisma.pengumuman.create({
    data: {
      judul: 'Pengingat: Batas Akhir Pengisian KRS',
      isi: 'Mahasiswa diharapkan mengisi dan mengajukan KRS sebelum tanggal 15 bulan ini. KRS yang belum diajukan tidak akan diproses.',
      kategori: 'AKADEMIK',
      prioritas: 'TINGGI',
      aktif: true,
      isGlobal: true,
      dosenId: koorprodi.id,
    },
  });

  // Class-specific announcement for Web A and Web B.
  // Use to test: GET /pengumuman?kelasId=<WebA_ID>
  await prisma.pengumuman.create({
    data: {
      judul: 'Perubahan Jadwal Kelas Pemrograman Web',
      isi: 'Pertemuan minggu depan dipindah ke Selasa jam 10:00 di Lab Komputer 2. Harap konfirmasi kehadiran.',
      kategori: 'AKADEMIK',
      prioritas: 'NORMAL',
      aktif: true,
      isGlobal: false,
      dosenId: dosen.id,
      kelas: { connect: [{ id: kelasWebA.id }, { id: kelasWebB.id }] },
    },
  });

  // Announcement for Algo classes.
  await prisma.pengumuman.create({
    data: {
      judul: 'Materi Quiz 1 Algoritma',
      isi: 'Quiz 1 akan mencakup materi Big O Notation dan Stack & Queue. Pelajari slide yang sudah diunggah.',
      kategori: 'AKADEMIK',
      prioritas: 'NORMAL',
      aktif: true,
      isGlobal: false,
      dosenId: dosen.id,
      kelas: { connect: [{ id: kelasAlgoB.id }, { id: kelasAlgoC.id }] },
    },
  });

  // ==========================================
  // EXTRA: Simulate service/controller flows
  // ==========================================
  console.log('🧪 Simulating extra controller/service flows...');

  // 1) Andi: add Web A to KRS → submit → approve (simulates full KRS approval flow)
  try {
    const andiKrs = await prisma.kRS.findUnique({
      where: { mahasiswaId_academicYear: { mahasiswaId: andiBlank.id, academicYear: activeAcademicYear } },
      include: { kelasPerkuliahan: true },
    });

    if (andiKrs && (andiKrs.kelasPerkuliahan || []).length === 0) {
      const updated = await prisma.kRS.update({
        where: { id: andiKrs.id },
        data: {
          totalSKS: { increment: mkWeb.sks },
          kelasPerkuliahan: { connect: { id: kelasWebA.id } },
        },
      });
      await prisma.kRS.update({ where: { id: updated.id }, data: { status: StatusKRS.DIAJUKAN, tanggalPengajuan: new Date() } });
      await prisma.kRS.update({ where: { id: updated.id }, data: { status: StatusKRS.DISETUJUI, tanggalPersetujuan: new Date(), catatanDosen: 'Disetujui.' } });
      console.log('  ✓ Andi KRS: DRAFT → DIAJUKAN → DISETUJUI');
    } else {
      console.log('  ⚠ Andi already has classes in KRS, skipping flow');
    }
  } catch (e) {
    console.error('  ✗ Andi KRS flow failed:', e instanceof Error ? e.message : e);
  }

  // 2) Clone e-learning content for EXISTING non-merged configs (Web D)
  try {
    const configsToClone = await prisma.elearningClassConfig.findMany({
      where: { setupMode: ElearningSetupMode.EXISTING, isMergedClass: false, sourceKelasPerkuliahanId: { not: null } },
    });

    for (const cfg of configsToClone) {
      await prisma.$transaction(async (tx) => {
        const existingCount = await tx.session.count({ where: { kelasPerkuliahanId: cfg.kelasPerkuliahanId } });
        if (existingCount > 0) return;

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
                create: s.assignments.map((a) => ({
                  title: a.title, description: a.description, fileUrl: a.fileUrl,
                  deadline: a.deadline, allowLate: a.allowLate, isHidden: true,
                  kategori: a.kategori, bobot: a.bobot,
                })),
              },
              quizzes: {
                create: s.quizzes.map((q) => ({
                  title: q.title, description: q.description, duration: q.duration,
                  startTime: q.startTime, endTime: q.endTime, gradingMethod: q.gradingMethod,
                  isHidden: true, kategori: q.kategori, bobot: q.bobot,
                  questions: { create: q.questions.map((qq) => ({ text: qq.text, type: qq.type, options: qq.options ?? undefined, correctAnswer: qq.correctAnswer, points: qq.points })) },
                })),
              },
            },
          });
        }
        console.log(`  ✓ Cloned ${sourceSessions.length} sessions into kelasId=${cfg.kelasPerkuliahanId}`);
      });
    }
  } catch (e) {
    console.error('  ✗ E-learning clone flow failed:', e instanceof Error ? e.message : e);
  }

  // ==========================================
  // 10. RIWAYAT PRESENSI LENGKAP (HISTORY)
  //   Covers:
  //   - GET /presensi/my/kelas/:kelasId     → mahasiswa lihat riwayat sendiri
  //   - GET /presensi/session/:id/attendances → dosen lihat siapa yang hadir
  //   - GET /presensi/kelas/:id/mahasiswa?sessionId=xxx → dosen lihat status per mahasiswa
  // ==========================================
  console.log('📋 Creating presensi history (riwayat)...');

  // --- WEB A: Pertemuan 2-6 (kelasWebA, dosen@univ.ac.id) ---
  // Enrolled students: Dani (from sem3 KRS) + Andi (enrolled via extra flow above)

  const webARwSess2 = await prisma.presensiSession.create({
    data: {
      title: 'Pertemuan 2 - HTML & CSS Dasar',
      type: 'KELAS', kelasPerkuliahanId: kelasWebA.id,
      date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      isOpen: false, token: generateToken(8),
      deadlineAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.presensiRecord.createMany({
    data: [
      { sessionId: webARwSess2.id, mahasiswaId: daniTranskrip.id, method: 'TOKEN', status: 'HADIR' },
      { sessionId: webARwSess2.id, mahasiswaId: andiBlank.id, method: 'TOKEN', status: 'HADIR' },
    ],
  });

  const webARwSess3 = await prisma.presensiSession.create({
    data: {
      title: 'Pertemuan 3 - JavaScript Dasar',
      type: 'KELAS', kelasPerkuliahanId: kelasWebA.id,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      isOpen: false, token: generateToken(8),
      deadlineAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.presensiRecord.createMany({
    data: [
      // Dani IZIN (Surat Izin), Andi HADIR via token
      { sessionId: webARwSess3.id, mahasiswaId: daniTranskrip.id, method: 'MANUAL', status: 'IZIN' },
      { sessionId: webARwSess3.id, mahasiswaId: andiBlank.id, method: 'TOKEN', status: 'HADIR' },
    ],
  });

  const webARwSess4 = await prisma.presensiSession.create({
    data: {
      title: 'Pertemuan 4 - DOM Manipulation',
      type: 'KELAS', kelasPerkuliahanId: kelasWebA.id,
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      isOpen: false, token: generateToken(8),
      deadlineAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.presensiRecord.createMany({
    data: [
      { sessionId: webARwSess4.id, mahasiswaId: daniTranskrip.id, method: 'TOKEN', status: 'HADIR' },
      // Andi ALPHA (absent without reason — dosen manually marks ALPHA)
      { sessionId: webARwSess4.id, mahasiswaId: andiBlank.id, method: 'MANUAL', status: 'ALPHA' },
    ],
  });

  const webARwSess5 = await prisma.presensiSession.create({
    data: {
      title: 'Pertemuan 5 - Fetch API & AJAX',
      type: 'KELAS', kelasPerkuliahanId: kelasWebA.id,
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      isOpen: false, token: generateToken(8),
      deadlineAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    },
  });
  await prisma.presensiRecord.createMany({
    data: [
      // Dani SAKIT (surat dokter), Andi hadir
      { sessionId: webARwSess5.id, mahasiswaId: daniTranskrip.id, method: 'MANUAL', status: 'SAKIT' },
      { sessionId: webARwSess5.id, mahasiswaId: andiBlank.id, method: 'TOKEN', status: 'HADIR' },
    ],
  });

  // Pertemuan 6 Web A: OPEN — students can still submit
  const tokenWebA6 = generateToken(8);
  await prisma.presensiSession.create({
    data: {
      title: 'Pertemuan 6 - React.js Intro',
      type: 'KELAS', kelasPerkuliahanId: kelasWebA.id,
      date: new Date(), isOpen: true,
      token: tokenWebA6,
      deadlineAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    },
  });

  // --- WEB B: Pertemuan 2-5 (kelasWebB, dosen.kolab1@univ.ac.id) ---
  // Enrolled student: Budi only
  // Use: GET /presensi/my/kelas/<WebB_ID> as budi → lihat riwayat
  //      GET /presensi/session/<id>/attendances as dosen.kolab1 → lihat daftar hadir

  const webBRwSess2 = await prisma.presensiSession.create({
    data: {
      title: 'Pertemuan 2 - Styling & Responsive Design',
      type: 'KELAS', kelasPerkuliahanId: kelasWebB.id,
      date: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000),
      isOpen: false, token: generateToken(8),
      deadlineAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.presensiRecord.create({
    data: { sessionId: webBRwSess2.id, mahasiswaId: budiActive.id, method: 'TOKEN', status: 'HADIR' },
  });

  const webBRwSess3 = await prisma.presensiSession.create({
    data: {
      title: 'Pertemuan 3 - JavaScript Events',
      type: 'KELAS', kelasPerkuliahanId: kelasWebB.id,
      date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      isOpen: false, token: generateToken(8),
      deadlineAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.presensiRecord.create({
    data: { sessionId: webBRwSess3.id, mahasiswaId: budiActive.id, method: 'MANUAL', status: 'IZIN' },
  });

  const webBRwSess4 = await prisma.presensiSession.create({
    data: {
      title: 'Pertemuan 4 - Async Programming',
      type: 'KELAS', kelasPerkuliahanId: kelasWebB.id,
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      isOpen: false, token: generateToken(8),
      deadlineAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.presensiRecord.create({
    data: { sessionId: webBRwSess4.id, mahasiswaId: budiActive.id, method: 'MANUAL', status: 'SAKIT' },
  });

  // Pertemuan 5 Web B: OPEN — Budi can still check in
  const tokenWebB5 = generateToken(8);
  await prisma.presensiSession.create({
    data: {
      title: 'Pertemuan 5 - Framework Introduction',
      type: 'KELAS', kelasPerkuliahanId: kelasWebB.id,
      date: new Date(), isOpen: true,
      token: tokenWebB5,
      deadlineAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    },
  });

  // --- ALGO C: Pertemuan 1-3 (kelasAlgoC, dosen@univ.ac.id) ---
  // Enrolled student: Citra only
  // Use: GET /presensi/my/kelas/<AlgoC_ID> as citra

  const algoCRwSess1 = await prisma.presensiSession.create({
    data: {
      title: 'Pertemuan 1 - Pengantar Algoritma',
      type: 'KELAS', kelasPerkuliahanId: kelasAlgoC.id,
      date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      isOpen: false, token: generateToken(8),
      deadlineAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.presensiRecord.create({
    data: { sessionId: algoCRwSess1.id, mahasiswaId: citraAlgo.id, method: 'TOKEN', status: 'HADIR' },
  });

  const algoCRwSess2 = await prisma.presensiSession.create({
    data: {
      title: 'Pertemuan 2 - Kompleksitas Waktu & Ruang',
      type: 'KELAS', kelasPerkuliahanId: kelasAlgoC.id,
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      isOpen: false, token: generateToken(8),
      deadlineAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });
  // Citra ALPHA — explicitly recorded by dosen
  await prisma.presensiRecord.create({
    data: { sessionId: algoCRwSess2.id, mahasiswaId: citraAlgo.id, method: 'MANUAL', status: 'ALPHA' },
  });

  // Pertemuan 3 Algo C: OPEN session, BELUM_ISI (no record yet)
  const tokenAlgoC3 = generateToken(8);
  await prisma.presensiSession.create({
    data: {
      title: 'Pertemuan 3 - Array dan Sorting',
      type: 'KELAS', kelasPerkuliahanId: kelasAlgoC.id,
      date: new Date(), isOpen: true,
      token: tokenAlgoC3,
      deadlineAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
    },
  });

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('\n✅ Seeding Complete!');
  console.log('========================================================');
  console.log('ALL PASSWORDS: 123456');
  console.log('========================================================');

  console.log('\n--- USERS ---');
  console.log(`Lecturer (main/PA):         dosen@univ.ac.id`);
  console.log(`Lecturer (Web B / Algo A):  dosen.kolab1@univ.ac.id`);
  console.log(`Lecturer (Web C):           dosen.kolab2@univ.ac.id`);
  console.log(`Coordinator (Koorprodi):    koor@univ.ac.id`);
  console.log(`Student (DRAFT KRS):        andi@univ.ac.id`);
  console.log(`Student (KRS approved, e-learning active): budi@univ.ac.id`);
  console.log(`Student (Algo C merged to B): citra@univ.ac.id`);
  console.log(`Student (KHS + Transkrip):  dani@univ.ac.id`);
  console.log(`Student (KRS rejected):     eva@univ.ac.id`);

  console.log('\n--- KRS FLOWS TO TEST ---');
  console.log('  andi@univ.ac.id   → KRS is DISETUJUI (seeded by extra flow). To retest:');
  console.log('    1. Manually reset Andi KRS to DRAFT via DELETE or re-seed');
  console.log('    2. POST /krs/add-class { kelasId: <WebA_ID>, semester: "GENAP" }');
  console.log('    3. POST /krs/submit');
  console.log('    4. Login as dosen → PATCH /krs/:id/approve or /krs/:id/reject');
  console.log('  eva@univ.ac.id    → KRS is DITOLAK. See catatanDosen for rejection reason.');

  console.log('\n--- E-LEARNING CONTENT (Web A — master) ---');
  console.log('  GET /elearning/course/<WebA_ID>        → public, no auth, isHidden=false only');
  console.log('  GET /elearning/course-detail/<WebA_ID> → full detail with submission counts');
  console.log('  Assignment 1 (Tugas, bobot=20%): Budi=GRADED(90), Dani=UNGRADED');
  console.log('    → PATCH /elearning/submission/<daniSub1_ID>/grade { "grade": 85, "feedback": "..." }');
  console.log('  Quiz 1 (Kuis, bobot=10%): Budi=100/100, Dani=50/100');
  console.log('    → GET /elearning/quiz/<quiz1_ID>/attempts (as dosen)');
  console.log('  UTS Assignment (bobot=30%), UAS Assignment (bobot=40%): no submissions yet');

  console.log('\n--- PARTICIPATION & GRADE ENDPOINTS ---');
  console.log(`  GET /elearning/kelas/<WebA_ID>/participation  → as dosen (sees Budi+Dani data)`);
  console.log(`  GET /elearning/kelas/<WebA_ID>/ranking        → as dosen`);
  console.log(`  GET /elearning/kelas/<WebB_ID>/my-grades      → as budi (reads Web A via merge)`);
  console.log(`  GET /elearning/kelas/<WebB_ID>/participants   → as budi`);
  console.log(`  GET /elearning/kelas/<AlgoC_ID>/my-grades     → as citra (reads Algo B via merge)`);
  console.log(`  GET /elearning/kelas/<AlgoB_ID>/participation → as dosen (sees Citra's data)`);

  console.log('\n--- PRESENSI (ATTENDANCE) ---');
  console.log(`  Web B open session 1 token : ${tokenWebB1}  (deadline: 24h from now)`);
  console.log(`  Algo B open session 1 token: ${tokenAlgoB1} (deadline: 12h from now)`);
  console.log(`  Web A open session 6 token : ${tokenWebA6}  (deadline: 2h from now)`);
  console.log(`  Web B open session 5 token : ${tokenWebB5}  (deadline: 2h from now)`);
  console.log(`  Algo C open session 3 token: ${tokenAlgoC3} (deadline: 3h from now)`);
  console.log('  POST /presensi/submit { "token": "<TOKEN>" }  → as any enrolled student');
  console.log('  GET  /presensi/kelas/<WebB_ID>/sessions/kelas → as dosen.kolab1');
  console.log('  GET  /presensi/session/<sessionId>/attendances → as dosen');

  console.log('\n--- RIWAYAT PRESENSI (HISTORY) ---');
  console.log('  Mahasiswa lihat presensi sendiri:');
  console.log('  GET /presensi/my/kelas/<WebA_ID>   → as dani@univ.ac.id  (HADIR,IZIN,HADIR,SAKIT + 2 open)');
  console.log('  GET /presensi/my/kelas/<WebA_ID>   → as andi@univ.ac.id  (HADIR,HADIR,ALPHA,HADIR + 2 open)');
  console.log('  GET /presensi/my/kelas/<WebB_ID>   → as budi@univ.ac.id  (HADIR,HADIR,IZIN,SAKIT + 1 open)');
  console.log('  GET /presensi/my/kelas/<AlgoC_ID>  → as citra@univ.ac.id (HADIR,ALPHA + 1 open)');
  console.log('  Dosen lihat mahasiswa yang sudah presensi per sesi:');
  console.log(`  GET /presensi/kelas/<WebA_ID>/mahasiswa?sessionId=<id>   → as dosen (shows Dani+Andi status)`);
  console.log(`  GET /presensi/session/<WebA_sess2_id>/attendances         → as dosen (Dani+Andi HADIR)`);

  console.log('\n--- ACADEMIC (PA) ---');
  console.log('  Login as dosen@univ.ac.id (PA for all students):');
  console.log('  GET /academic/pa/mahasiswa');
  console.log('  GET /academic/pa/mahasiswa/<dani_ID>/khs?semester=2023/2024 Ganjil');
  console.log('  GET /academic/pa/mahasiswa/<dani_ID>/transkrip');
  console.log('  GET /academic/pa/mahasiswa/<dani_ID>/ringkasan');

  console.log('\n--- CLASS IDs (printed at runtime) ---');
  console.log(`  Web A ID : ${kelasWebA.id}  | Dosen: dosen@univ.ac.id`);
  console.log(`  Web B ID : ${kelasWebB.id}  | Dosen: dosen.kolab1@univ.ac.id  [MERGED → Web A]`);
  console.log(`  Web C ID : ${kelasWebC.id}  | Dosen: dosen.kolab2@univ.ac.id  [independent]`);
  console.log(`  Web D ID : ${kelasWebD.id}  | Dosen: dosen@univ.ac.id         [clone of Web A]`);
  console.log(`  Algo A ID: ${kelasAlgoA.id} | Dosen: dosen.kolab1@univ.ac.id  [independent]`);
  console.log(`  Algo B ID: ${kelasAlgoB.id} | Dosen: dosen@univ.ac.id         [MASTER merge]`);
  console.log(`  Algo C ID: ${kelasAlgoC.id} | Dosen: dosen@univ.ac.id         [MEMBER → Algo B]`);

  console.log('\n--- SUBMISSION IDs (for grading test) ---');
  console.log(`  Budi sub Assignment 1 (graded=90):   ${budiSub1.id}`);
  console.log(`  Dani sub Assignment 1 (ungraded):    ${daniSub1.id}`);
  console.log(`    → PATCH /elearning/submission/${daniSub1.id}/grade`);
  console.log('       Body: { "grade": 80, "feedback": "Bagus, perlu perbaikan minor." }');
  console.log('\n========================================================\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });