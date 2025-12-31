import 'dotenv/config';
import { PrismaClient, Role, Gender, Status, StatusNilai, StatusKRS, SessionType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg'; 
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Start seeding...');

  // 1. MASTER DATA
  const ft = await prisma.fakultas.upsert({
    where: { kode: 'FT' }, update: {},
    create: { name: 'Fakultas Teknik', kode: 'FT', dekan: 'Dr. Teknik' },
  });

  const ifProdi = await prisma.prodi.upsert({
    where: { kode: 'IF' }, update: {},
    create: { name: 'Informatika', kode: 'IF', jenjang: 'S1', fakultasId: ft.id },
  });

  // 2. USERS
  const password = await bcrypt.hash('123456', 10);

  const dosen = await prisma.user.upsert({
    where: { email: 'dosen@univ.ac.id' }, update: { password },
    create: {
      name: 'Dr. Budi Hartono', email: 'dosen@univ.ac.id', nip: '19800101',
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

  // Ahmad: Mahasiswa Lama (Untuk Test Transkrip & History)
  const mahasiswa = await prisma.user.upsert({
    where: { email: 'mhs@univ.ac.id' }, update: { password },
    create: {
      name: 'Ahmad Senior', email: 'mhs@univ.ac.id', nim: '20021101', 
      role: Role.MAHASISWA, gender: Gender.LAKI_LAKI, password,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
    },
  });

  // Budi: Mahasiswa Baru (Untuk Test KRS Draft/Add Class)
  const mahasiswaDraft = await prisma.user.upsert({
    where: { email: 'mhs_draft@univ.ac.id' }, update: { password },
    create: {
      name: 'Budi Junior', email: 'mhs_draft@univ.ac.id', nim: '20240001', 
      role: Role.MAHASISWA, gender: Gender.LAKI_LAKI, password,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
    },
  });

  // 3. KURIKULUM & MK
  let kurikulum = await prisma.kurikulum.findFirst({ where: { name: 'Kurikulum 2024' } });
  if (!kurikulum) {
    kurikulum = await prisma.kurikulum.create({
      data: { name: 'Kurikulum 2024', tahun: 2024, prodiId: ifProdi.id }
    });
  }

  const mkAlpro = await prisma.matakuliah.upsert({
    where: { kode: 'IF101' }, update: {},
    create: {
      name: 'Algoritma Pemrograman', kode: 'IF101', sks: 3, semester: 1, 
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id
    }
  });

  const mkWeb = await prisma.matakuliah.upsert({
    where: { kode: 'IF201' }, update: {},
    create: {
      name: 'Pemrograman Web', kode: 'IF201', sks: 3, semester: 3, 
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id
    }
  });

  // 4. CLEANUP DATA LAMA (PENTING)
  await prisma.presensiRecord.deleteMany({ where: { mahasiswaId: { in: [mahasiswa.id, mahasiswaDraft.id] } } });
  await prisma.nilai.deleteMany({ where: { mahasiswaId: { in: [mahasiswa.id, mahasiswaDraft.id] } } });
  await prisma.kRS.deleteMany({ where: { mahasiswaId: { in: [mahasiswa.id, mahasiswaDraft.id] } } });

  // 5. SKENARIO TRANSKRIP (MENGULANG MATKUL)
  
  // A. Semester 1 (Masa Lalu): Ahmad ambil Alpro dpt D
  const kelasAlproSem1 = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'ALPRO-2023-GANJIL' }, update: {},
    create: {
      nama: 'Algoritma Pemrograman A', kode: 'ALPRO-2023-GANJIL', kapasitas: 40,
      semester: '2023/2024 Ganjil', mataKuliahId: mkAlpro.id, dosenId: dosen.id
    }
  });

  await prisma.kRS.create({
    data: {
      mahasiswaId: mahasiswa.id, semester: '2023/2024 Ganjil', status: StatusKRS.DISETUJUI,
      totalSKS: 3, kelasPerkuliahan: { connect: [{ id: kelasAlproSem1.id }] }
    }
  });

  await prisma.nilai.create({
    data: {
      mahasiswaId: mahasiswa.id, mataKuliahId: mkAlpro.id, semester: '2023/2024 Ganjil',
      nilaiHuruf: 'D', indeksNilai: 1.0, nilaiAkhir: 45, status: StatusNilai.SUDAH_ADA
    }
  });

  // B. Semester 3 (Sekarang/Baru Lewat): Ahmad mengulang Alpro dpt A, ambil Web dpt B
  const kelasAlproSem3 = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'ALPRO-2024-GANJIL' }, update: {},
    create: {
      nama: 'Algoritma Pemrograman (Mengulang)', kode: 'ALPRO-2024-GANJIL', kapasitas: 40,
      semester: '2024/2025 Ganjil', mataKuliahId: mkAlpro.id, dosenId: dosen.id
    }
  });

  const kelasWebSem3 = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'WEB-2024-GANJIL' }, update: {},
    create: {
      nama: 'Pemrograman Web A', kode: 'WEB-2024-GANJIL', kapasitas: 40,
      semester: '2024/2025 Ganjil', mataKuliahId: mkWeb.id, dosenId: dosen.id
    }
  });

  await prisma.kRS.create({
    data: {
      mahasiswaId: mahasiswa.id, semester: '2024/2025 Ganjil', status: StatusKRS.DISETUJUI,
      totalSKS: 6, kelasPerkuliahan: { connect: [{ id: kelasAlproSem3.id }, { id: kelasWebSem3.id }] }
    }
  });

  await prisma.nilai.create({
    data: {
      mahasiswaId: mahasiswa.id, mataKuliahId: mkAlpro.id, semester: '2024/2025 Ganjil',
      nilaiHuruf: 'A', indeksNilai: 4.0, nilaiAkhir: 86, status: StatusNilai.SUDAH_ADA
    }
  });

  await prisma.nilai.create({
    data: {
      mahasiswaId: mahasiswa.id, mataKuliahId: mkWeb.id, semester: '2024/2025 Ganjil',
      nilaiHuruf: 'B', indeksNilai: 3.0, nilaiAkhir: 75, status: StatusNilai.SUDAH_ADA
    }
  });

  // 6. SKENARIO KRS AKTIF (SEMESTER GENAP)
  // Kelas tersedia untuk Semester Depan
  const kelasWebGenap = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'WEB-2024-GENAP' }, update: {},
    create: {
      nama: 'Pemrograman Web (Genap)', kode: 'WEB-2024-GENAP', kapasitas: 40,
      semester: '2024/2025 Genap', mataKuliahId: mkWeb.id, dosenId: dosen.id
    }
  });

  // Budi (Mhs Baru) isi KRS Draft
  await prisma.kRS.create({
    data: {
      mahasiswaId: mahasiswaDraft.id, semester: '2024/2025 Genap', status: StatusKRS.DRAFT,
      totalSKS: 3, kelasPerkuliahan: { connect: [{ id: kelasWebGenap.id }] }
    }
  });

  // 7. E-LEARNING (Di Kelas Web Sem 3)
  // Hapus session lama jika ada (cleanup detail)
  const sessions = await prisma.session.findMany({ where: { kelasPerkuliahanId: kelasWebSem3.id }});
  const sessionIds = sessions.map(s => s.id);
  if (sessionIds.length) {
    // Cleanup submissions first (foreign key constraint)
    const assignments = await prisma.assignment.findMany({ where: { sessionId: { in: sessionIds }}});
    const assignmentIds = assignments.map(a => a.id);
    await prisma.submission.deleteMany({ where: { assignmentId: { in: assignmentIds }}});
    
    // Cleanup quiz attempts (foreign key constraint)
    const quizzes = await prisma.quiz.findMany({ where: { sessionId: { in: sessionIds }}});
    const quizIds = quizzes.map(q => q.id);
    await prisma.quizAttempt.deleteMany({ where: { quizId: { in: quizIds }}});
    await prisma.question.deleteMany({ where: { quizId: { in: quizIds }}});
    
    await prisma.material.deleteMany({ where: { sessionId: { in: sessionIds }}});
    await prisma.assignment.deleteMany({ where: { sessionId: { in: sessionIds }}});
    await prisma.quiz.deleteMany({ where: { sessionId: { in: sessionIds }}});
    await prisma.session.deleteMany({ where: { id: { in: sessionIds }}});
  }

  // Session 1: HTML & CSS
  const session1 = await prisma.session.create({
    data: {
      title: 'Pertemuan 1: HTML & CSS', 
      description: 'Pengenalan dasar HTML dan CSS',
      weekNumber: 1, 
      kelasPerkuliahanId: kelasWebSem3.id,
      materials: {
        create: [
          { 
            title: 'Slide HTML Dasar', 
            type: 'FILE', 
            fileUrl: 'https://example.com/html-slides.pdf' 
          },
          { 
            title: 'Video Tutorial CSS', 
            type: 'TEXT', 
            content: 'Link video: https://youtube.com/css-tutorial' 
          },
          {
            title: 'Panduan Lengkap HTML & CSS',
            type: 'HYBRID',
            content: 'Materi lengkap dapat diunduh di link berikut',
            fileUrl: 'https://example.com/html-css-guide.pdf'
          }
        ]
      },
      assignments: {
        create: {
          title: 'Tugas 1: Buat Web Profil Sederhana',
          description: 'Buat halaman web profil pribadi menggunakan HTML dan CSS',
          deadline: new Date(new Date().setDate(new Date().getDate() + 7)),
          allowLate: true
        }
      }
    }
  });

  // Get assignment from session 1 for submission
  const assignment1 = await prisma.assignment.findFirst({
    where: { sessionId: session1.id }
  });

  // Create submission for Ahmad Mahasiswa
  if (assignment1) {
    await prisma.submission.create({
      data: {
        studentId: mahasiswa.id,
        assignmentId: assignment1.id,
        fileUrl: 'https://example.com/ahmad-profile.zip',
        textContent: 'Sudah saya kerjakan sesuai instruksi',
        grade: 85
      }
    });
  }

  // Session 2: JavaScript Dasar
  const session2 = await prisma.session.create({
    data: {
      title: 'Pertemuan 2: JavaScript Dasar',
      description: 'Mempelajari dasar-dasar pemrograman JavaScript',
      weekNumber: 2,
      kelasPerkuliahanId: kelasWebSem3.id,
      materials: {
        create: [
          {
            title: 'Slide JavaScript',
            type: 'FILE',
            fileUrl: 'https://example.com/js-slides.pdf'
          }
        ]
      },
      quizzes: {
        create: {
          title: 'Quiz 1: HTML & CSS Basics',
          duration: 30,
          startTime: new Date(new Date().setDate(new Date().getDate() - 1)),
          endTime: new Date(new Date().setDate(new Date().getDate() + 7)),
          gradingMethod: 'HIGHEST_GRADE',
          questions: {
            create: [
              {
                text: 'Apa kepanjangan dari HTML?',
                type: 'MULTIPLE_CHOICE',
                options: ['HyperText Markup Language', 'HighText Modern Language', 'HyperTransfer Markup Link', 'None of the above'],
                correctAnswer: 'HyperText Markup Language',
                points: 25
              },
              {
                text: 'CSS digunakan untuk apa?',
                type: 'MULTIPLE_CHOICE',
                options: ['Styling halaman web', 'Database', 'Programming logic', 'Server management'],
                correctAnswer: 'Styling halaman web',
                points: 25
              },
              {
                text: 'Tag HTML untuk membuat paragraf adalah?',
                type: 'MULTIPLE_CHOICE',
                options: ['<p>', '<para>', '<paragraph>', '<text>'],
                correctAnswer: '<p>',
                points: 25
              },
              {
                text: 'HTML adalah bahasa pemrograman. Benar atau salah?',
                type: 'TRUE_FALSE',
                options: ['Benar', 'Salah'],
                correctAnswer: 'Salah',
                points: 25
              }
            ]
          }
        }
      }
    }
  });

  // Get quiz from session 2
  const quiz1 = await prisma.quiz.findFirst({
    where: { sessionId: session2.id },
    include: { questions: true }
  });

  // Create quiz attempt for Ahmad (score 75 - answered 3 out of 4 correctly)
  if (quiz1) {
    await prisma.quizAttempt.create({
      data: {
        studentId: mahasiswa.id,
        quizId: quiz1.id,
        score: 75,
        finishedAt: new Date()
      }
    });
  }

  // Session 3: JavaScript Lanjutan
  await prisma.session.create({
    data: {
      title: 'Pertemuan 3: JavaScript DOM Manipulation',
      description: 'Belajar memanipulasi DOM dengan JavaScript',
      weekNumber: 3,
      kelasPerkuliahanId: kelasWebSem3.id,
      materials: {
        create: [
          {
            title: 'Materi DOM Manipulation',
            type: 'FILE',
            fileUrl: 'https://example.com/dom-slides.pdf'
          },
          {
            title: 'Contoh Code DOM',
            type: 'TEXT',
            content: 'document.querySelector("#myId").innerHTML = "Hello World"'
          }
        ]
      },
      assignments: {
        create: {
          title: 'Tugas 2: Membuat Todo List App',
          description: 'Buat aplikasi todo list sederhana dengan JavaScript',
          deadline: new Date(new Date().setDate(new Date().getDate() + 14)),
          allowLate: false
        }
      }
    }
  });

  // 8. PENGUMUMAN
  await prisma.pengumuman.deleteMany({}); // Cleanup

  // Global Koorprodi
  await prisma.pengumuman.create({
    data: {
      judul: 'Registrasi Ulang Semester Genap',
      isi: 'Harap segera melakukan pembayaran UKT.',
      kategori: 'AKADEMIK',
      dosenId: koorprodi.id,
      isGlobal: true,
    }
  });

  // Spesifik Kelas (Dosen)
  await prisma.pengumuman.create({
    data: {
      judul: 'Remedial UTS Web',
      isi: 'Bagi yang nilai < 50 harap kumpul.',
      kategori: 'AKADEMIK',
      dosenId: dosen.id,
      kelas: { connect: [{ id: kelasWebSem3.id }] }
    }
  });

  // 9. PRESENSI (Token & Manual)
  await prisma.presensiSession.deleteMany({ where: { kelasPerkuliahanId: kelasWebSem3.id } });
  
  await prisma.presensiSession.create({
    data: {
      title: 'Pertemuan 1: Kontrak', type: SessionType.KELAS, kelasPerkuliahanId: kelasWebSem3.id,
      date: new Date(), token: 'ABC123XY', // Token Absen
      records: {
        create: {
          mahasiswaId: mahasiswa.id,
          method: 'MANUAL', // Absen Manual oleh Dosen
        }
      }
    }
  });

  console.log('✅ Seeding Selesai!');
  console.log('------------------------------------------------');
  console.log(`User Ahmad (History) : ${mahasiswa.nim}`);
  console.log(`User Budi (Draft)    : ${mahasiswaDraft.nim}`);
  console.log(`User Dosen           : ${dosen.email}`);
  console.log(`User Koorprodi       : ${koorprodi.email}`);
  console.log('------------------------------------------------');
  console.log('SKENARIO TRANSKRIP (Ahmad):');
  console.log(' - Sem 2023/2024 Ganjil: Alpro (D)');
  console.log(' - Sem 2024/2025 Ganjil: Alpro (A) -> Harusnya ini yg muncul di transkrip');
  console.log(' - Sem 2024/2025 Ganjil: Web   (B)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });