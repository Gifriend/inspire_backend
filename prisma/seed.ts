import 'dotenv/config';
import { 
  PrismaClient, Role, Gender, Status, StatusKRS, 
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

  const kelasWebGenap = await prisma.kelasPerkuliahan.upsert({
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
      kelasPerkuliahan: { set: [{ id: kelasWebGenap.id }] },
      tanggalPersetujuan: new Date(),
    },
    create: {
      mahasiswaId: budiActive.id,
      academicYear: activeAcademicYear,
      status: StatusKRS.DISETUJUI,
      totalSKS: 3,
      tanggalPersetujuan: new Date(),
      kelasPerkuliahan: { connect: [{ id: kelasWebGenap.id }] },
    },
  });

  // ==========================================
  // 5. E-LEARNING (Tied to the contracted class)
  // ==========================================
  
  const session1 = await prisma.session.create({
    data: {
      title: 'Pertemuan 1: Pengenalan HTML & CSS',
      description: 'Materi dasar struktur web.',
      weekNumber: 1,
      kelasPerkuliahanId: kelasWebGenap.id,
      materials: {
        create: [
          { title: 'Slide Pengenalan Web', type: MaterialType.FILE, fileUrl: 'https://example.com/slide.pdf' }
        ]
      },
      assignments: {
        create: {
          title: 'Tugas 1: Buat Profil Biodata',
          description: 'Gunakan HTML dan CSS murni.',
          deadline: new Date(new Date().setDate(new Date().getDate() + 7)),
          allowLate: true
        }
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
      kelasPerkuliahanId: kelasWebGenap.id,
      quizzes: {
        create: {
          title: 'Quiz 1: HTML Tag Basics',
          duration: 30, 
          startTime: new Date(new Date().setDate(new Date().getDate() - 1)), 
          endTime: new Date(new Date().setDate(new Date().getDate() + 3)),   
          gradingMethod: QuizGradingMethod.HIGHEST_GRADE,
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
        }
      }
    }
  });

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
  
  console.log('\n👤 STUDENT 2 (E-LEARNING ALREADY ACTIVE):');
  console.log('Email: budi@univ.ac.id | Pass: 123456');
  console.log('  -> Login as Budi. His KRS is already DISETUJUI.');
  console.log('  -> Open the E-Learning module to see Session 1 & 2 for Pemrograman Web A.');
  console.log('-------------------------------\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });