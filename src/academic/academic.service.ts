import { Injectable, NotFoundException } from '@nestjs/common';
import { KhsResponseDto } from './dto/academic.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AcademicService {
  constructor(private prisma: PrismaService) {}

  async getStudentSemesters(studentId: number) {
    // Get from KRS table to get academic year history
    const history = await this.prisma.kRS.findMany({
      where: {
        mahasiswaId: studentId,
      },
      select: {
        academicYear: true,
      },
      distinct: ['academicYear'], // Remove duplicates
      orderBy: {
        academicYear: 'desc', // Oder from newest (2024/2025 -> 2023/2024)
      },
    });

    // fallback if krs table is empty
    if (!history.length) {
      const nilaiHistory = await this.prisma.nilai.findMany({
        where: { mahasiswaId: studentId },
        select: { academicYear: true },
        distinct: ['academicYear'],
        orderBy: { academicYear: 'desc' },
      });
      return nilaiHistory.map((h) => h.academicYear);
    }

    return history.map((h) => h.academicYear);
  }

  async getKhs(studentId: number, semester: string): Promise<KhsResponseDto> {
    // 1. Ambil Data Nilai Semester Ini (Untuk tabel KHS & IPS)
    const rawNilai = await this.prisma.nilai.findMany({
      where: {
        mahasiswaId: studentId,
        academicYear: semester,
        status: 'SUDAH_ADA',
      },  
      include: {
        mataKuliah: true,
        mahasiswa: { include: { prodi: true } },
      },
    });

    // 2. Hitung IPS (Indeks Prestasi Semester Ini)
    let totalSksSemester = 0;
    let totalBobotSemester = 0;

    const formattedNilai = rawNilai.map((item) => {
      const sks = item.mataKuliah.sks;
      const indeks = item.indeksNilai || 0;

      totalSksSemester += sks;
      totalBobotSemester += sks * indeks;

      return {
        kodeMk: item.mataKuliah.kode,
        namaMk: item.mataKuliah.name,
        sks: sks,
        nilaiHuruf: item.nilaiHuruf || 'T',
        indeks: indeks,
      };
    });

    const ips =
      totalSksSemester > 0 ? totalBobotSemester / totalSksSemester : 0;

    // 3. HITUNG IPK (KUMULATIF) YANG SEBENARNYA
    const ipk = await this.calculateRealIPK(studentId);
    
    // 4. UPDATE USER DATA DENGAN CONDITIONAL (HANYA UNTUK MAHASISWA)
    await this.updateUserAcademicData(studentId, semester);

    // Handle jika data kosong
    if (!rawNilai.length) {
      const mhs = await this.prisma.user.findUnique({
        where: { id: studentId },
        include: { prodi: true },
      });
      return {
        semester,
        totalSks: 0,
        totalBobot: 0,
        ips: 0.0,
        ipk: ipk, // Tetap return IPK kumulatif meski semester ini kosong
        mahasiswa: {
          nama: mhs?.name || '-',
          nim: mhs?.nim || '-',
          prodi: mhs?.prodi?.name || '-',
        },
        nilai: [],
      };
    }

    const studentInfo = rawNilai[0].mahasiswa;

    return {
      semester,
      totalSks: totalSksSemester,
      totalBobot: totalBobotSemester,
      ips: parseFloat(ips.toFixed(2)),
      ipk: ipk, // Sekarang dinamis!
      mahasiswa: {
        nama: studentInfo.name,
        nim: studentInfo.nim ?? '-',
        prodi: studentInfo.prodi?.name || 'Umum',
      },
      nilai: formattedNilai,
    };
  }

  async generateKhsHtml(studentId: number, semester: string): Promise<string> {
    const data = await this.getKhs(studentId, semester);

    const rows = data.nilai
      .map(
        (n, index) => `
      <tr>
        <td style="text-align: center;">${index + 1}</td>
        <td>${n.kodeMk}</td>
        <td>${n.namaMk}</td>
        <td style="text-align: center;">${n.sks}</td>
        <td style="text-align: center;">${n.nilaiHuruf}</td>
        <td style="text-align: center;">${n.indeks}</td>
        <td style="text-align: center;">${(n.sks * n.indeks).toFixed(2)}</td>
      </tr>
    `,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 40px; }
          h2, h3 { text-align: center; margin: 0; }
          .header { margin-bottom: 30px; }
          .info-table { width: 100%; margin-bottom: 20px; }
          .nilai-table { width: 100%; border-collapse: collapse; }
          .nilai-table th, .nilai-table td { border: 1px solid black; padding: 8px; font-size: 14px; }
          .footer { margin-top: 50px; text-align: right; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>KARTU HASIL STUDI (KHS)</h2>
          <h3>UNIVERSITAS SAM RATULANGI</h3>
        </div>
        <table class="info-table">
          <tr><td width="15%">Nama</td><td>: <b>${data.mahasiswa.nama}</b></td><td width="15%">Semester</td><td>: ${data.semester}</td></tr>
          <tr><td>NIM</td><td>: ${data.mahasiswa.nim}</td><td>Prodi</td><td>: ${data.mahasiswa.prodi}</td></tr>
        </table>
        <table class="nilai-table">
          <thead>
            <tr style="background-color: #f0f0f0;">
              <th>No</th><th>Kode</th><th>Mata Kuliah</th><th>SKS</th><th>Nilai</th><th>Bobot</th><th>Mutu</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="text-align: right; font-weight: bold;">Total</td>
              <td style="text-align: center; font-weight: bold;">${data.totalSks}</td>
              <td colspan="2"></td>
              <td style="text-align: center; font-weight: bold;">${data.totalBobot.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        <p><b>Indeks Prestasi Semester (IPS): ${data.ips}</b></p>
      </body>
      </html>
    `;
  }

  // ==========================================
  // 2. TRANSCRIPT FEATURES WITH HTML TABLE
  // ==========================================

  async getTranskrip(mahasiswaId: number) {
    const mahasiswa = await this.prisma.user.findUnique({
      where: { id: mahasiswaId },
      include: { prodi: true, fakultas: true },
    });

    if (!mahasiswa) throw new NotFoundException('Mahasiswa tidak ditemukan');

    const allNilai = await this.prisma.nilai.findMany({
      where: { mahasiswaId: mahasiswaId, status: 'SUDAH_ADA' },
      include: { mataKuliah: true },
      orderBy: { academicYear: 'asc' },
    });

    const bestGradesMap = new Map<string, any>();

    for (const record of allNilai) {
      const kodeMK = record.mataKuliah.kode;
      const existing = bestGradesMap.get(kodeMK);

      // BUG FIX HERE:
      // Ensure the checked property name ('existing.indeksNilai') matches what is stored
      if (
        !existing ||
        (record.indeksNilai !== null &&
          (existing.indeksNilai === null ||
            record.indeksNilai > existing.indeksNilai))
      ) {
        bestGradesMap.set(kodeMK, {
          kode: kodeMK,
          matakuliah: record.mataKuliah.name,
          sks: record.mataKuliah.sks,
          nilaiHuruf: record.nilaiHuruf,
          indeksNilai: record.indeksNilai, // CHANGED FROM 'indeks' TO 'indeksNilai' FOR CONSISTENCY
          academicYear: record.academicYear,
        });
      }
    }

    const transkripList = Array.from(bestGradesMap.values());

    let totalSKS = 0;
    let totalBobot = 0;

    transkripList.forEach((item) => {
      totalSKS += item.sks;
      totalBobot += item.sks * item.indeksNilai; // Adjust property access
    });

    const ipk = totalSKS > 0 ? (totalBobot / totalSKS).toFixed(2) : '0.00';

    return {
      mahasiswa: {
        nama: mahasiswa.name,
        nim: mahasiswa.nim,
        prodi: mahasiswa.prodi?.name ?? '-',
        fakultas: mahasiswa.fakultas.name,
      },
      statistik: {
        totalSKS: totalSKS,
        totalMataKuliah: transkripList.length,
        ipk: ipk,
        predikat: this.getPredikat(parseFloat(ipk)),
      },
      transkrip: transkripList.sort((a, b) =>
        a.semester.localeCompare(b.semester),
      ),
    };
  }

  // Helper method for GPA predicate
  private getPredikat(ipk: number): string {
    if (ipk >= 3.51) return 'Dengan Pujian (Cumlaude)';
    if (ipk >= 3.01) return 'Sangat Memuaskan';
    if (ipk >= 2.76) return 'Memuaskan';
    return 'Cukup';
  }

  // 3. GENERATE HTML REPORT FOR TRANSCRIPT (NEW)
  async generateTranskripHtml(mahasiswaId: number): Promise<string> {
    const data = await this.getTranskrip(mahasiswaId);

    // Generate table rows
    const rows = data.transkrip
      .map((item, index) => {
        const mutu = (item.sks * item.indeks).toFixed(2);
        return `
        <tr>
          <td style="text-align: center;">${index + 1}</td>
          <td>${item.kode}</td>
          <td>${item.matakuliah}</td>
          <td style="text-align: center;">${item.sks}</td>
          <td style="text-align: center;">${item.nilaiHuruf}</td>
          <td style="text-align: center;">${item.indeks}</td>
          <td style="text-align: center;">${mutu}</td>
        </tr>
      `;
      })
      .join('');

    // HTML Template
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Transkrip Nilai - ${data.mahasiswa.nim}</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 40px; color: #000; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 3px double #000; padding-bottom: 20px; }
          .header h2 { margin: 0; font-size: 20px; text-transform: uppercase; }
          .header h3 { margin: 5px 0 0 0; font-size: 16px; font-weight: normal; }
          
          .info-section { width: 100%; margin-bottom: 20px; }
          .info-section td { padding: 4px; vertical-align: top; }
          
          .table-nilai { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .table-nilai th, .table-nilai td { border: 1px solid #000; padding: 6px 8px; font-size: 13px; }
          .table-nilai th { background-color: #f4f4f4; text-align: center; font-weight: bold; }
          
          .summary { margin-top: 30px; border: 1px solid #000; padding: 15px; width: 50%; }
          .summary p { margin: 5px 0; }
          
          .footer { margin-top: 60px; display: flex; justify-content: space-between; }
          .signature { text-align: center; width: 200px; }
        </style>
      </head>
      <body>
      
        <div class="header">
          <h2>Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi</h2>
          <h2>Universitas Sam Ratulangi</h2>
          <h3>${data.mahasiswa.fakultas}</h3>
          <h2 style="margin-top: 20px; text-decoration: underline;">TRANSKRIP AKADEMIK</h2>
        </div>

        <table class="info-section">
          <tr>
            <td width="150"><b>Nama Mahasiswa</b></td>
            <td width="10">:</td>
            <td>${data.mahasiswa.nama}</td>
            
            <td width="100"><b>Fakultas</b></td>
            <td width="10">:</td>
            <td>${data.mahasiswa.fakultas}</td>
          </tr>
          <tr>
            <td><b>NIM</b></td>
            <td>:</td>
            <td>${data.mahasiswa.nim}</td>
            
            <td><b>Program Studi</b></td>
            <td>:</td>
            <td>${data.mahasiswa.prodi}</td>
          </tr>
        </table>

        <table class="table-nilai">
          <thead>
            <tr>
              <th width="5%">No</th>
              <th width="15%">Kode MK</th>
              <th>Mata Kuliah</th>
              <th width="8%">SKS</th>
              <th width="8%">Nilai</th>
              <th width="8%">Bobot</th>
              <th width="10%">Mutu</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="text-align: right; font-weight: bold;">Total</td>
              <td style="text-align: center; font-weight: bold;">${data.statistik.totalSKS}</td>
              <td colspan="3"></td>
            </tr>
          </tfoot>
        </table>

        <div class="summary">
          <p><b>Total SKS Lulus:</b> ${data.statistik.totalSKS}</p>
          <p><b>Indeks Prestasi Kumulatif (IPK):</b> ${data.statistik.ipk}</p>
          <p><b>Predikat Kelulusan:</b> ${data.statistik.predikat}</p>
        </div>

        <div class="footer">
          <div class="signature"></div> <!-- Spacer kiri -->
          <div class="signature">
            <p>Manado, ${new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p>Wakil Dekan Bidang Akademik,</p>
            <br><br><br><br>
            <p><b>(Nama Pejabat)</b></p>
            <p>NIP. ...........................</p>
          </div>
        </div>

      </body>
      </html>
    `;
  }

  private async calculateRealIPK(studentId: number): Promise<number> {
    // Ambil SEMUA nilai yang pernah diambil mahasiswa ini (status SUDAH_ADA)
    const allGrades = await this.prisma.nilai.findMany({
      where: {
        mahasiswaId: studentId,
        status: 'SUDAH_ADA',
      },
      include: {
        mataKuliah: true,
      },
      orderBy: {
        academicYear: 'asc', // Urutkan biar logis (opsional)
      },
    });

    if (allGrades.length === 0) return 0.0;

    // Map untuk menyimpan nilai TERBAIK per Kode Mata Kuliah
    // Key: Kode MK, Value: Record Nilai
    const bestGradesMap = new Map<string, any>();

    for (const grade of allGrades) {
      const kode = grade.mataKuliah.kode;
      const currentBest = bestGradesMap.get(kode);

      // Jika belum ada nilai untuk MK ini, atau nilai baru LEBIH BAGUS dari nilai lama
      // Contoh: Dulu dapat D (1.0), sekarang mengulang dapat B (3.0), maka simpan yang B.
      const nilaiBaru = grade.indeksNilai || 0;
      const nilaiLama = currentBest ? currentBest.indeksNilai || 0 : -1;

      if (!currentBest || nilaiBaru > nilaiLama) {
        bestGradesMap.set(kode, grade);
      }
    }

    // Hitung rata-rata dari Map
    let totalSksKumulatif = 0;
    let totalBobotKumulatif = 0;

    bestGradesMap.forEach((grade) => {
      const sks = grade.mataKuliah.sks;
      const indeks = grade.indeksNilai || 0;

      totalSksKumulatif += sks;
      totalBobotKumulatif += sks * indeks;
    });

    if (totalSksKumulatif === 0) return 0.0;

    const rawIpk = totalBobotKumulatif / totalSksKumulatif;
    return parseFloat(rawIpk.toFixed(2)); // Return 2 desimal
  }

  // ==========================================
  // UPDATE USER ACADEMIC DATA (CONDITIONAL)
  // ==========================================
  private async updateUserAcademicData(studentId: number, semesterTerakhir: string): Promise<void> {
    try {
      // Cek apakah user ada dan role-nya adalah MAHASISWA
      const user = await this.prisma.user.findUnique({
        where: { id: studentId },
        select: { id: true, role: true },
      });

      // CONDITIONAL: Hanya update jika user ada dan role MAHASISWA
      if (!user || user.role !== 'MAHASISWA') {
        return; // Jangan update untuk dosen/non-mahasiswa
      }

      // Hitung IPK kumulatif terbaru
      const ipk = await this.calculateRealIPK(studentId);

      // Hitung total SKS yang sudah lulus (berhasil)
      const totalSksLulus = await this.calculateTotalSksLulus(studentId);

      // Update user data
      await this.prisma.user.update({
        where: { id: studentId },
        data: {
          ipk: parseFloat(ipk.toFixed(2)),
          totalSksLulus: totalSksLulus,
          semesterTerakhir: semesterTerakhir,
        },
      });
    } catch (error) {
      // Silent error - jangan throw, agar KHS tetap bisa diambil
      console.error(`Failed to update academic data for student ${studentId}:`, error);
    }
  }

  // ==========================================
  // HELPER: CALCULATE TOTAL SKS LULUS 
  // ==========================================
  private async calculateTotalSksLulus(studentId: number): Promise<number> {
    // Ambil semua nilai dengan status SUDAH_ADA dan nilai minimal C (indeks >= 2.0)
    const allPassing = await this.prisma.nilai.findMany({
      where: {
        mahasiswaId: studentId,
        status: 'SUDAH_ADA',
        // Ambil hanya nilai yang lulus (indeksNilai >= 2.0, artinya minimal C)
        indeksNilai: {
          gte: 2.0,
        },
      },
      include: {
        mataKuliah: true,
      },
    });

    if (allPassing.length === 0) return 0;

    // Gunakan Map untuk tracking nilai terbaik per MK (sama seperti IPK calculation)
    const bestGradesMap = new Map<string, any>();

    for (const grade of allPassing) {
      const kode = grade.mataKuliah.kode;
      const currentBest = bestGradesMap.get(kode);
      const nilaiBaru = grade.indeksNilai || 0;
      const nilaiLama = currentBest ? currentBest.indeksNilai || 0 : -1;

      if (!currentBest || nilaiBaru > nilaiLama) {
        bestGradesMap.set(kode, grade);
      }
    }

    // Hitung total SKS dari nilai terbaik
    let totalSks = 0;
    bestGradesMap.forEach((grade) => {
      totalSks += grade.mataKuliah.sks;
    });

    return totalSks;
  }
}
