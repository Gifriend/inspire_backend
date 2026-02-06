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

  // Citra: Mahasiswa dengan KRS Diajukan (Untuk Test Approval)
  const mahasiswaDiajukan = await prisma.user.upsert({
    where: { email: 'citra@univ.ac.id' }, update: { password },
    create: {
      name: 'Citra Dewi', email: 'citra@univ.ac.id', nim: '20240002',
      role: Role.MAHASISWA, gender: Gender.PEREMPUAN, password,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
    },
  });

  // Dedi: Mahasiswa dengan KRS Sudah Disetujui (Untuk Test Active Learning)
  const mahasiswaAktif = await prisma.user.upsert({
    where: { email: 'dedi@univ.ac.id' }, update: { password },
    create: {
      name: 'Dedi Santoso', email: 'dedi@univ.ac.id', nim: '20240003',
      role: Role.MAHASISWA, gender: Gender.LAKI_LAKI, password,
      status: Status.AKTIF, fakultasId: ft.id, prodiId: ifProdi.id,
    },
  });

  // Dosen kedua untuk variasi
  const dosen2 = await prisma.user.upsert({
    where: { email: 'dosen2@univ.ac.id' }, update: { password },
    create: {
      name: 'Dr. Siti Aminah', email: 'dosen2@univ.ac.id', nip: '19850202',
      role: Role.DOSEN, gender: Gender.PEREMPUAN, password,
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

  const mkBasisData = await prisma.matakuliah.upsert({
    where: { kode: 'IF202' }, update: {},
    create: {
      name: 'Basis Data', kode: 'IF202', sks: 3, semester: 3,
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id
    }
  });

  const mkPBO = await prisma.matakuliah.upsert({
    where: { kode: 'IF203' }, update: {},
    create: {
      name: 'Pemrograman Berorientasi Objek', kode: 'IF203', sks: 3, semester: 3,
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id
    }
  });

  const mkJarkom = await prisma.matakuliah.upsert({
    where: { kode: 'IF301' }, update: {},
    create: {
      name: 'Jaringan Komputer', kode: 'IF301', sks: 3, semester: 5,
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id
    }
  });

  const mkMobile = await prisma.matakuliah.upsert({
    where: { kode: 'IF302' }, update: {},
    create: {
      name: 'Pemrograman Mobile', kode: 'IF302', sks: 3, semester: 5,
      jenisMK: 'Pilihan', prodiId: ifProdi.id, kurikulumId: kurikulum.id
    }
  });

  // 4. CLEANUP DATA LAMA (PENTING)
  await prisma.presensiRecord.deleteMany({ where: { mahasiswaId: { in: [mahasiswa.id, mahasiswaDraft.id, mahasiswaDiajukan.id, mahasiswaAktif.id] } } });
  await prisma.nilai.deleteMany({ where: { mahasiswaId: { in: [mahasiswa.id, mahasiswaDraft.id, mahasiswaDiajukan.id, mahasiswaAktif.id] } } });
  await prisma.kRS.deleteMany({ where: { mahasiswaId: { in: [mahasiswa.id, mahasiswaDraft.id, mahasiswaDiajukan.id, mahasiswaAktif.id] } } });

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

  // Tambahan nilai untuk Ahmad di semester lain (untuk KHS yang lebih lengkap)
  // Semester 2: Struktur Data & Matematika Diskrit
  const mkStrukturData = await prisma.matakuliah.upsert({
    where: { kode: 'IF102' }, update: {},
    create: {
      name: 'Struktur Data', kode: 'IF102', sks: 3, semester: 2,
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id
    }
  });

  const mkMatdis = await prisma.matakuliah.upsert({
    where: { kode: 'IF103' }, update: {},
    create: {
      name: 'Matematika Diskrit', kode: 'IF103', sks: 3, semester: 2,
      jenisMK: 'Wajib', prodiId: ifProdi.id, kurikulumId: kurikulum.id
    }
  });

  // Kelas Semester 2 (Genap 2023/2024)
  const kelasStrukturDataSem2 = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'SD-2023-GENAP' }, update: {},
    create: {
      nama: 'Struktur Data A', kode: 'SD-2023-GENAP', kapasitas: 40,
      semester: '2023/2024 Genap', mataKuliahId: mkStrukturData.id, dosenId: dosen.id
    }
  });

  const kelasMatdisSem2 = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'MATDIS-2023-GENAP' }, update: {},
    create: {
      nama: 'Matematika Diskrit A', kode: 'MATDIS-2023-GENAP', kapasitas: 40,
      semester: '2023/2024 Genap', mataKuliahId: mkMatdis.id, dosenId: dosen2.id
    }
  });

  await prisma.kRS.create({
    data: {
      mahasiswaId: mahasiswa.id, semester: '2023/2024 Genap', status: StatusKRS.DISETUJUI,
      totalSKS: 6, kelasPerkuliahan: { connect: [{ id: kelasStrukturDataSem2.id }, { id: kelasMatdisSem2.id }] }
    }
  });

  await prisma.nilai.create({
    data: {
      mahasiswaId: mahasiswa.id, mataKuliahId: mkStrukturData.id, semester: '2023/2024 Genap',
      nilaiTugas: 85, nilaiUTS: 80, nilaiUAS: 88, nilaiAkhir: 84,
      nilaiHuruf: 'A', indeksNilai: 4.0, status: StatusNilai.SUDAH_ADA
    }
  });

  await prisma.nilai.create({
    data: {
      mahasiswaId: mahasiswa.id, mataKuliahId: mkMatdis.id, semester: '2023/2024 Genap',
      nilaiTugas: 78, nilaiUTS: 75, nilaiUAS: 80, nilaiAkhir: 78,
      nilaiHuruf: 'B+', indeksNilai: 3.5, status: StatusNilai.SUDAH_ADA
    }
  });

  // Nilai untuk Dedi (mahasiswa aktif) - semester sebelumnya
  // Semester Ganjil 2024/2025 - Dedi ambil Algoritma & Web
  const kelasAlproGanjilDedi = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'ALPRO-DEDI-2024-GANJIL' }, update: {},
    create: {
      nama: 'Algoritma Pemrograman B', kode: 'ALPRO-DEDI-2024-GANJIL', kapasitas: 40,
      semester: '2024/2025 Ganjil', mataKuliahId: mkAlpro.id, dosenId: dosen2.id
    }
  });

  const kelasWebGanjilDedi = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'WEB-DEDI-2024-GANJIL' }, update: {},
    create: {
      nama: 'Pemrograman Web B', kode: 'WEB-DEDI-2024-GANJIL', kapasitas: 40,
      semester: '2024/2025 Ganjil', mataKuliahId: mkWeb.id, dosenId: dosen2.id
    }
  });

  await prisma.kRS.create({
    data: {
      mahasiswaId: mahasiswaAktif.id, semester: '2024/2025 Ganjil', status: StatusKRS.DISETUJUI,
      totalSKS: 6, kelasPerkuliahan: { connect: [{ id: kelasAlproGanjilDedi.id }, { id: kelasWebGanjilDedi.id }] }
    }
  });

  await prisma.nilai.create({
    data: {
      mahasiswaId: mahasiswaAktif.id, mataKuliahId: mkAlpro.id, semester: '2024/2025 Ganjil',
      nilaiTugas: 88, nilaiUTS: 85, nilaiUAS: 90, nilaiAkhir: 88,
      nilaiHuruf: 'A', indeksNilai: 4.0, status: StatusNilai.SUDAH_ADA
    }
  });

  await prisma.nilai.create({
    data: {
      mahasiswaId: mahasiswaAktif.id, mataKuliahId: mkWeb.id, semester: '2024/2025 Ganjil',
      nilaiTugas: 82, nilaiUTS: 80, nilaiUAS: 85, nilaiAkhir: 82,
      nilaiHuruf: 'A-', indeksNilai: 3.7, status: StatusNilai.SUDAH_ADA
    }
  });

  // Nilai untuk Citra (mahasiswa diajukan) - semester sebelumnya
  const kelasAlproGanjilCitra = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'ALPRO-CITRA-2024-GANJIL' }, update: {},
    create: {
      nama: 'Algoritma Pemrograman C', kode: 'ALPRO-CITRA-2024-GANJIL', kapasitas: 40,
      semester: '2024/2025 Ganjil', mataKuliahId: mkAlpro.id, dosenId: dosen.id
    }
  });

  await prisma.kRS.create({
    data: {
      mahasiswaId: mahasiswaDiajukan.id, semester: '2024/2025 Ganjil', status: StatusKRS.DISETUJUI,
      totalSKS: 3, kelasPerkuliahan: { connect: [{ id: kelasAlproGanjilCitra.id }] }
    }
  });

  await prisma.nilai.create({
    data: {
      mahasiswaId: mahasiswaDiajukan.id, mataKuliahId: mkAlpro.id, semester: '2024/2025 Ganjil',
      nilaiTugas: 75, nilaiUTS: 72, nilaiUAS: 78, nilaiAkhir: 75,
      nilaiHuruf: 'B', indeksNilai: 3.0, status: StatusNilai.SUDAH_ADA
    }
  });

  // 6. SKENARIO KRS AKTIF (SEMESTER GENAP 2024/2025 - Sedang Berlangsung)
  // Kelas-kelas tersedia untuk Semester Genap (Semester Aktif untuk Kontrak)
  const kelasWebGenap = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'WEB-2024-GENAP' }, update: {},
    create: {
      nama: 'Pemrograman Web A', kode: 'WEB-2024-GENAP', kapasitas: 40,
      semester: '2024/2025 Genap', mataKuliahId: mkWeb.id, dosenId: dosen.id
    }
  });

  const kelasBDGenap = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'BD-2024-GENAP' }, update: {},
    create: {
      nama: 'Basis Data A', kode: 'BD-2024-GENAP', kapasitas: 40,
      semester: '2024/2025 Genap', mataKuliahId: mkBasisData.id, dosenId: dosen2.id
    }
  });

  const kelasPBOGenap = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'PBO-2024-GENAP' }, update: {},
    create: {
      nama: 'Pemrograman Berorientasi Objek A', kode: 'PBO-2024-GENAP', kapasitas: 35,
      semester: '2024/2025 Genap', mataKuliahId: mkPBO.id, dosenId: dosen.id
    }
  });

  const kelasJarkomGenap = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'JARKOM-2024-GENAP' }, update: {},
    create: {
      nama: 'Jaringan Komputer A', kode: 'JARKOM-2024-GENAP', kapasitas: 30,
      semester: '2024/2025 Genap', mataKuliahId: mkJarkom.id, dosenId: dosen2.id
    }
  });

  const kelasMobileGenap = await prisma.kelasPerkuliahan.upsert({
    where: { kode: 'MOBILE-2024-GENAP' }, update: {},
    create: {
      nama: 'Pemrograman Mobile A', kode: 'MOBILE-2024-GENAP', kapasitas: 30,
      semester: '2024/2025 Genap', mataKuliahId: mkMobile.id, dosenId: dosen.id
    }
  });

  // A. Budi (Mhs Baru) - KRS Draft
  await prisma.kRS.create({
    data: {
      mahasiswaId: mahasiswaDraft.id, semester: '2024/2025 Genap', status: StatusKRS.DRAFT,
      totalSKS: 3, kelasPerkuliahan: { connect: [{ id: kelasWebGenap.id }] }
    }
  });

  // B. Citra - KRS Diajukan (Menunggu Persetujuan Koorprodi)
  await prisma.kRS.create({
    data: {
      mahasiswaId: mahasiswaDiajukan.id, semester: '2024/2025 Genap', status: StatusKRS.DIAJUKAN,
      totalSKS: 9, kelasPerkuliahan: { connect: [
        { id: kelasWebGenap.id },
        { id: kelasBDGenap.id },
        { id: kelasPBOGenap.id }
      ] }
    }
  });

  // C. Dedi - KRS Disetujui (Sudah Bisa Mengakses E-Learning)
  await prisma.kRS.create({
    data: {
      mahasiswaId: mahasiswaAktif.id, semester: '2024/2025 Genap', status: StatusKRS.DISETUJUI,
      totalSKS: 9, kelasPerkuliahan: { connect: [
        { id: kelasBDGenap.id },
        { id: kelasPBOGenap.id },
        { id: kelasJarkomGenap.id }
      ] }
    }
  });

  // 7. E-LEARNING (Multiple Kelas dengan Konten Lengkap)
  
  // === KELAS WEB SEM 3 (Semester Lalu - Ahmad) ===
  // Hapus session lama jika ada (cleanup detail)
  let sessions = await prisma.session.findMany({ where: { kelasPerkuliahanId: kelasWebSem3.id }});
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

  // === KELAS BASIS DATA GENAP (Semester Aktif - Dedi & Citra) ===
  sessions = await prisma.session.findMany({ where: { kelasPerkuliahanId: kelasBDGenap.id }});
  let sessionBDIds = sessions.map(s => s.id);
  if (sessionBDIds.length) {
    const assignmentsBD = await prisma.assignment.findMany({ where: { sessionId: { in: sessionBDIds }}});
    const assignmentBDIds = assignmentsBD.map(a => a.id);
    await prisma.submission.deleteMany({ where: { assignmentId: { in: assignmentBDIds }}});
    
    const quizzesBD = await prisma.quiz.findMany({ where: { sessionId: { in: sessionBDIds }}});
    const quizBDIds = quizzesBD.map(q => q.id);
    await prisma.quizAttempt.deleteMany({ where: { quizId: { in: quizBDIds }}});
    await prisma.question.deleteMany({ where: { quizId: { in: quizBDIds }}});
    
    await prisma.material.deleteMany({ where: { sessionId: { in: sessionBDIds }}});
    await prisma.assignment.deleteMany({ where: { sessionId: { in: sessionBDIds }}});
    await prisma.quiz.deleteMany({ where: { sessionId: { in: sessionBDIds }}});
    await prisma.session.deleteMany({ where: { id: { in: sessionBDIds }}});
  }

  // Session BD 1: Pengenalan Database
  const sessionBD1 = await prisma.session.create({
    data: {
      title: 'Pertemuan 1: Pengenalan Basis Data',
      description: 'Konsep dasar database, DBMS, dan SQL',
      weekNumber: 1,
      kelasPerkuliahanId: kelasBDGenap.id,
      materials: {
        create: [
          {
            title: 'Slide Pengenalan Database',
            type: 'FILE',
            fileUrl: 'https://example.com/db-intro.pdf'
          },
          {
            title: 'Video Tutorial SQL',
            type: 'TEXT',
            content: 'Link: https://youtube.com/sql-basics'
          },
          {
            title: 'E-Book Database Systems',
            type: 'HYBRID',
            content: 'Download e-book lengkap tentang sistem basis data',
            fileUrl: 'https://example.com/db-systems-ebook.pdf'
          }
        ]
      },
      quizzes: {
        create: {
          title: 'Quiz 1: Konsep Dasar Database',
          duration: 20,
          startTime: new Date(new Date().setDate(new Date().getDate() - 2)),
          endTime: new Date(new Date().setDate(new Date().getDate() + 5)),
          gradingMethod: 'LATEST_GRADE',
          questions: {
            create: [
              {
                text: 'Apa kepanjangan dari DBMS?',
                type: 'MULTIPLE_CHOICE',
                options: ['Database Management System', 'Data Based Management Software', 'Digital Base Management System', 'Database Main System'],
                correctAnswer: 'Database Management System',
                points: 25
              },
              {
                text: 'SQL adalah bahasa pemrograman. Benar atau salah?',
                type: 'TRUE_FALSE',
                options: ['Benar', 'Salah'],
                correctAnswer: 'Salah',
                points: 25
              },
              {
                text: 'Perintah SQL untuk mengambil data adalah?',
                type: 'MULTIPLE_CHOICE',
                options: ['SELECT', 'GET', 'FETCH', 'RETRIEVE'],
                correctAnswer: 'SELECT',
                points: 25
              },
              {
                text: 'Primary key dapat bernilai NULL. Benar atau salah?',
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

  // Quiz attempt untuk Dedi di BD Quiz 1
  const quizBD1 = await prisma.quiz.findFirst({
    where: { sessionId: sessionBD1.id },
    include: { questions: true }
  });

  if (quizBD1) {
    await prisma.quizAttempt.create({
      data: {
        studentId: mahasiswaAktif.id,
        quizId: quizBD1.id,
        score: 100,
        finishedAt: new Date()
      }
    });
  }

  // Session BD 2: SQL DDL & DML
  const sessionBD2 = await prisma.session.create({
    data: {
      title: 'Pertemuan 2: SQL DDL dan DML',
      description: 'Mempelajari CREATE, INSERT, UPDATE, DELETE',
      weekNumber: 2,
      kelasPerkuliahanId: kelasBDGenap.id,
      materials: {
        create: [
          {
            title: 'Materi SQL DDL',
            type: 'FILE',
            fileUrl: 'https://example.com/sql-ddl.pdf'
          },
          {
            title: 'Contoh Query SQL',
            type: 'TEXT',
            content: 'CREATE TABLE mahasiswa (\\n  id INT PRIMARY KEY,\\n  nama VARCHAR(100)\\n);'
          }
        ]
      },
      assignments: {
        create: {
          title: 'Tugas 1: Membuat Database Perpustakaan',
          description: 'Buat schema database perpustakaan dengan minimal 5 tabel',
          deadline: new Date(new Date().setDate(new Date().getDate() + 7)),
          allowLate: true
        }
      }
    }
  });

  // Submission untuk Dedi di BD Assignment 1
  const assignmentBD1 = await prisma.assignment.findFirst({
    where: { sessionId: sessionBD2.id }
  });

  if (assignmentBD1) {
    await prisma.submission.create({
      data: {
        studentId: mahasiswaAktif.id,
        assignmentId: assignmentBD1.id,
        fileUrl: 'https://example.com/dedi-perpustakaan-schema.sql',
        textContent: 'Sudah membuat 5 tabel: buku, anggota, peminjaman, kategori, penerbit',
        grade: 90
      }
    });
  }

  // Session BD 3: SQL Query Lanjutan
  await prisma.session.create({
    data: {
      title: 'Pertemuan 3: JOIN dan Subquery',
      description: 'Mempelajari berbagai jenis JOIN dan subquery',
      weekNumber: 3,
      kelasPerkuliahanId: kelasBDGenap.id,
      materials: {
        create: [
          {
            title: 'Slide JOIN Operations',
            type: 'FILE',
            fileUrl: 'https://example.com/sql-join.pdf'
          },
          {
            title: 'Video Tutorial JOIN',
            type: 'TEXT',
            content: 'Link: https://youtube.com/sql-join-tutorial'
          }
        ]
      }
    }
  });

  // === KELAS PBO GENAP (Semester Aktif - Dedi & Citra) ===
  sessions = await prisma.session.findMany({ where: { kelasPerkuliahanId: kelasPBOGenap.id }});
  let sessionPBOIds = sessions.map(s => s.id);
  if (sessionPBOIds.length) {
    const assignmentsPBO = await prisma.assignment.findMany({ where: { sessionId: { in: sessionPBOIds }}});
    const assignmentPBOIds = assignmentsPBO.map(a => a.id);
    await prisma.submission.deleteMany({ where: { assignmentId: { in: assignmentPBOIds }}});
    
    const quizzesPBO = await prisma.quiz.findMany({ where: { sessionId: { in: sessionPBOIds }}});
    const quizPBOIds = quizzesPBO.map(q => q.id);
    await prisma.quizAttempt.deleteMany({ where: { quizId: { in: quizPBOIds }}});
    await prisma.question.deleteMany({ where: { quizId: { in: quizPBOIds }}});
    
    await prisma.material.deleteMany({ where: { sessionId: { in: sessionPBOIds }}});
    await prisma.assignment.deleteMany({ where: { sessionId: { in: sessionPBOIds }}});
    await prisma.quiz.deleteMany({ where: { sessionId: { in: sessionPBOIds }}});
    await prisma.session.deleteMany({ where: { id: { in: sessionPBOIds }}});
  }

  // Session PBO 1: Konsep OOP
  const sessionPBO1 = await prisma.session.create({
    data: {
      title: 'Pertemuan 1: Konsep OOP',
      description: 'Memahami konsep Object-Oriented Programming',
      weekNumber: 1,
      kelasPerkuliahanId: kelasPBOGenap.id,
      materials: {
        create: [
          {
            title: 'Pengenalan OOP',
            type: 'FILE',
            fileUrl: 'https://example.com/oop-intro.pdf'
          },
          {
            title: 'Contoh Class Java',
            type: 'TEXT',
            content: 'public class Mahasiswa {\\n  private String nama;\\n  public Mahasiswa(String nama) {\\n    this.nama = nama;\\n  }\\n}'
          },
          {
            title: 'E-Book Java OOP',
            type: 'HYBRID',
            content: 'Buku lengkap tentang OOP dengan Java',
            fileUrl: 'https://example.com/java-oop-book.pdf'
          }
        ]
      },
      assignments: {
        create: {
          title: 'Tugas 1: Membuat Class Sederhana',
          description: 'Buat class Mahasiswa dengan atribut dan method',
          deadline: new Date(new Date().setDate(new Date().getDate() + 7)),
          allowLate: true
        }
      },
      quizzes: {
        create: {
          title: 'Quiz 1: Dasar OOP',
          duration: 25,
          startTime: new Date(new Date().setDate(new Date().getDate() - 1)),
          endTime: new Date(new Date().setDate(new Date().getDate() + 6)),
          gradingMethod: 'HIGHEST_GRADE',
          questions: {
            create: [
              {
                text: 'Apa kepanjangan dari OOP?',
                type: 'MULTIPLE_CHOICE',
                options: ['Object-Oriented Programming', 'Object Oriented Process', 'Online Operation Program', 'Order Of Programming'],
                correctAnswer: 'Object-Oriented Programming',
                points: 20
              },
              {
                text: 'Encapsulation adalah menyembunyikan detail implementasi. Benar atau salah?',
                type: 'TRUE_FALSE',
                options: ['Benar', 'Salah'],
                correctAnswer: 'Benar',
                points: 20
              },
              {
                text: 'Keyword untuk inheritance di Java adalah?',
                type: 'MULTIPLE_CHOICE',
                options: ['extends', 'inherit', 'implements', 'derives'],
                correctAnswer: 'extends',
                points: 20
              },
              {
                text: 'Polymorphism hanya bisa diterapkan pada method. Benar atau salah?',
                type: 'TRUE_FALSE',
                options: ['Benar', 'Salah'],
                correctAnswer: 'Salah',
                points: 20
              },
              {
                text: 'Constructor adalah method khusus untuk membuat objek. Benar atau salah?',
                type: 'TRUE_FALSE',
                options: ['Benar', 'Salah'],
                correctAnswer: 'Benar',
                points: 20
              }
            ]
          }
        }
      }
    }
  });

  // Dedi mengerjakan quiz PBO
  const quizPBO1 = await prisma.quiz.findFirst({
    where: { sessionId: sessionPBO1.id },
    include: { questions: true }
  });

  if (quizPBO1) {
    await prisma.quizAttempt.create({
      data: {
        studentId: mahasiswaAktif.id,
        quizId: quizPBO1.id,
        score: 80,
        finishedAt: new Date()
      }
    });
  }

  // Session PBO 2: Inheritance & Polymorphism
  await prisma.session.create({
    data: {
      title: 'Pertemuan 2: Inheritance dan Polymorphism',
      description: 'Memahami konsep pewarisan dan polimorfisme',
      weekNumber: 2,
      kelasPerkuliahanId: kelasPBOGenap.id,
      materials: {
        create: [
          {
            title: 'Materi Inheritance',
            type: 'FILE',
            fileUrl: 'https://example.com/inheritance.pdf'
          },
          {
            title: 'Contoh Polymorphism',
            type: 'TEXT',
            content: 'Method overloading dan overriding dalam Java'
          }
        ]
      },
      assignments: {
        create: {
          title: 'Tugas 2: Implementasi Inheritance',
          description: 'Buat hierarki class dengan inheritance',
          deadline: new Date(new Date().setDate(new Date().getDate() + 10)),
          allowLate: false
        }
      }
    }
  });

  // === KELAS JARINGAN KOMPUTER GENAP (Semester Aktif - Dedi) ===
  sessions = await prisma.session.findMany({ where: { kelasPerkuliahanId: kelasJarkomGenap.id }});
  let sessionJarkomIds = sessions.map(s => s.id);
  if (sessionJarkomIds.length) {
    const assignmentsJarkom = await prisma.assignment.findMany({ where: { sessionId: { in: sessionJarkomIds }}});
    const assignmentJarkomIds = assignmentsJarkom.map(a => a.id);
    await prisma.submission.deleteMany({ where: { assignmentId: { in: assignmentJarkomIds }}});
    
    const quizzesJarkom = await prisma.quiz.findMany({ where: { sessionId: { in: sessionJarkomIds }}});
    const quizJarkomIds = quizzesJarkom.map(q => q.id);
    await prisma.quizAttempt.deleteMany({ where: { quizId: { in: quizJarkomIds }}});
    await prisma.question.deleteMany({ where: { quizId: { in: quizJarkomIds }}});
    
    await prisma.material.deleteMany({ where: { sessionId: { in: sessionJarkomIds }}});
    await prisma.assignment.deleteMany({ where: { sessionId: { in: sessionJarkomIds }}});
    await prisma.quiz.deleteMany({ where: { sessionId: { in: sessionJarkomIds }}});
    await prisma.session.deleteMany({ where: { id: { in: sessionJarkomIds }}});
  }

  // Session Jarkom 1: Pengenalan Jaringan
  await prisma.session.create({
    data: {
      title: 'Pertemuan 1: Pengenalan Jaringan Komputer',
      description: 'Konsep dasar jaringan, topologi, dan protokol',
      weekNumber: 1,
      kelasPerkuliahanId: kelasJarkomGenap.id,
      materials: {
        create: [
          {
            title: 'Slide Pengenalan Jaringan',
            type: 'FILE',
            fileUrl: 'https://example.com/network-intro.pdf'
          },
          {
            title: 'Video OSI Layer',
            type: 'TEXT',
            content: 'Link: https://youtube.com/osi-layer-explained'
          },
          {
            title: 'Modul Jaringan Lengkap',
            type: 'HYBRID',
            content: 'Modul lengkap jaringan komputer dari dasar hingga lanjut',
            fileUrl: 'https://example.com/network-module.pdf'
          }
        ]
      },
      quizzes: {
        create: {
          title: 'Quiz 1: Dasar Jaringan',
          duration: 30,
          startTime: new Date(new Date().setDate(new Date().getDate() - 3)),
          endTime: new Date(new Date().setDate(new Date().getDate() + 4)),
          gradingMethod: 'LATEST_GRADE',
          questions: {
            create: [
              {
                text: 'Berapa layer OSI?',
                type: 'MULTIPLE_CHOICE',
                options: ['7', '5', '9', '4'],
                correctAnswer: '7',
                points: 25
              },
              {
                text: 'IP Address termasuk layer berapa?',
                type: 'MULTIPLE_CHOICE',
                options: ['Network Layer', 'Transport Layer', 'Application Layer', 'Physical Layer'],
                correctAnswer: 'Network Layer',
                points: 25
              },
              {
                text: 'TCP adalah protokol yang connection-oriented. Benar atau salah?',
                type: 'TRUE_FALSE',
                options: ['Benar', 'Salah'],
                correctAnswer: 'Benar',
                points: 25
              },
              {
                text: 'Topologi star menggunakan hub/switch sebagai pusat. Benar atau salah?',
                type: 'TRUE_FALSE',
                options: ['Benar', 'Salah'],
                correctAnswer: 'Benar',
                points: 25
              }
            ]
          }
        }
      },
      assignments: {
        create: {
          title: 'Tugas 1: Analisis Topologi Jaringan',
          description: 'Analisis dan gambarkan topologi jaringan kampus',
          deadline: new Date(new Date().setDate(new Date().getDate() + 14)),
          allowLate: true
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
  console.log('================================================');
  console.log('AKUN USERS:');
  console.log('------------------------------------------------');
  console.log(`Ahmad (Mahasiswa Lama)      : ${mahasiswa.nim} / mhs@univ.ac.id`);
  console.log(`Budi (KRS Draft)            : ${mahasiswaDraft.nim} / mhs_draft@univ.ac.id`);
  console.log(`Citra (KRS Diajukan)        : ${mahasiswaDiajukan.nim} / citra@univ.ac.id`);
  console.log(`Dedi (KRS Disetujui/Aktif)  : ${mahasiswaAktif.nim} / dedi@univ.ac.id`);
  console.log(`Dosen 1 (Dr. Budi)          : ${dosen.email}`);
  console.log(`Dosen 2 (Dr. Siti)          : ${dosen2.email}`);
  console.log(`Koorprodi (Prof. Kurniawan) : ${koorprodi.email}`);
  console.log('Password semua user: 123456');
  console.log('================================================');
  console.log('MATAKULIAH TERSEDIA:');
  console.log('------------------------------------------------');
  console.log('1. Algoritma Pemrograman (IF101) - 3 SKS - Sem 1');
  console.log('2. Struktur Data (IF102) - 3 SKS - Sem 2');
  console.log('3. Matematika Diskrit (IF103) - 3 SKS - Sem 2');
  console.log('4. Pemrograman Web (IF201) - 3 SKS - Sem 3');
  console.log('5. Basis Data (IF202) - 3 SKS - Sem 3');
  console.log('6. PBO (IF203) - 3 SKS - Sem 3');
  console.log('7. Jaringan Komputer (IF301) - 3 SKS - Sem 5');
  console.log('8. Pemrograman Mobile (IF302) - 3 SKS - Sem 5');
  console.log('================================================');
  console.log('KELAS SEMESTER GENAP 2024/2025 (TERSEDIA UNTUK KONTRAK):');
  console.log('------------------------------------------------');
  console.log('- Pemrograman Web A (WEB-2024-GENAP)');
  console.log('- Basis Data A (BD-2024-GENAP) [Ada E-Learning]');
  console.log('- PBO A (PBO-2024-GENAP) [Ada E-Learning]');
  console.log('- Jaringan Komputer A (JARKOM-2024-GENAP) [Ada E-Learning]');
  console.log('- Pemrograman Mobile A (MOBILE-2024-GENAP)');
  console.log('================================================');
  console.log('STATUS KRS MAHASISWA:');
  console.log('------------------------------------------------');
  console.log('Ahmad  : KRS Semester Ganjil sudah DISETUJUI (History)');
  console.log('Budi   : KRS Semester Genap DRAFT (1 kelas)');
  console.log('Citra  : KRS Semester Genap DIAJUKAN (3 kelas, menunggu approval)');
  console.log('Dedi   : KRS Semester Genap DISETUJUI (3 kelas dengan e-learning)');
  console.log('================================================');
  console.log('E-LEARNING CONTENT:');
  console.log('------------------------------------------------');
  console.log('Basis Data A (Dedi terdaftar):');
  console.log('  - 3 Session dengan materi, quiz, dan assignment');
  console.log('  - Dedi sudah mengerjakan Quiz 1 (100) & Assignment 1 (90)');
  console.log('PBO A (Dedi terdaftar):');
  console.log('  - 2 Session dengan materi, quiz, dan assignment');
  console.log('  - Dedi sudah mengerjakan Quiz 1 (80)');
  console.log('Jaringan Komputer A (Dedi terdaftar):');
  console.log('  - 1 Session dengan materi, quiz, dan assignment');
  console.log('Pemrograman Web Ganjil (Ahmad - semester lalu):');
  console.log('  - 3 Session lengkap dengan materi, quiz, assignment');
  console.log('================================================');
  console.log('KHS (KARTU HASIL STUDI):');
  console.log('------------------------------------------------');
  console.log('Ahmad (20021101):');
  console.log('  Sem 2023/2024 Ganjil:');
  console.log('    - Algoritma Pemrograman: D (1.0) [Diulang]');
  console.log('  Sem 2023/2024 Genap:');
  console.log('    - Struktur Data: A (4.0)');
  console.log('    - Matematika Diskrit: B+ (3.5)');
  console.log('    IPS: 3.75 | IPK: ~2.83');
  console.log('  Sem 2024/2025 Ganjil:');
  console.log('    - Algoritma Pemrograman: A (4.0) [Perbaikan]');
  console.log('    - Pemrograman Web: B (3.0)');
  console.log('    IPS: 3.5 | IPK: ~3.35');
  console.log('');
  console.log('Dedi (20240003):');
  console.log('  Sem 2024/2025 Ganjil:');
  console.log('    - Algoritma Pemrograman: A (4.0)');
  console.log('    - Pemrograman Web: A- (3.7)');
  console.log('    IPS: 3.85 | IPK: 3.85');
  console.log('');
  console.log('Citra (20240002):');
  console.log('  Sem 2024/2025 Ganjil:');
  console.log('    - Algoritma Pemrograman: B (3.0)');
  console.log('    IPS: 3.0 | IPK: 3.0');
  console.log('================================================');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });