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
      name: 'Dr. Budi Hartono', email: 'dosen@univ.ac.id', nip: '19809001',
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
      name: 'Prof. Kurniawan', email: 'koor@univ.ac.id', nip: '19759001',
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
      name: 'Citra (Merge Same Dosen)', email: 'citra@univ.ac.id', nim: '20249003',
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
  console.log('-------------------------------\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });