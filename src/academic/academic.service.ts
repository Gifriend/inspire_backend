import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { KhsResponseDto } from './dto/academic.dto';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

@Injectable()
export class AcademicService {
  
  // 1. GET KHS DATA (Untuk Tampilan UI)
  async getKhs(studentId: number, semester: string): Promise<KhsResponseDto> {
    // Ambil data nilai berdasarkan semester
    const rawNilai = await prisma.nilai.findMany({
      where: {
        mahasiswaId: studentId,
        semester: semester,
        status: 'SUDAH_ADA' // Hanya ambil yang sudah dinilai
      },
      include: {
        mataKuliah: true,
        mahasiswa: {
          include: { prodi: true }
        }
      }
    });

    if (!rawNilai.length) {
      // Return kosong jika belum ada nilai, jangan error agar UI tetap jalan
      const mhs = await prisma.user.findUnique({ 
        where: { id: studentId },
        include: { prodi: true }
      });
      return {
        semester,
        totalSks: 0,
        totalBobot: 0,
        ips: 0.00,
        ipk: 0.00, // Implementasi IPK butuh query semua semester
        mahasiswa: {
          nama: mhs?.name || '-',
          nim: mhs?.nim || '-',
          prodi: mhs?.prodi?.name || '-'
        },
        nilai: []
      };
    }

    // Hitung IPS
    let totalSks = 0;
    let totalBobot = 0;

    const formattedNilai = rawNilai.map(item => {
      const sks = item.mataKuliah.sks;
      const indeks = item.indeksNilai || 0; // 4.0, 3.0
      
      totalSks += sks;
      totalBobot += (sks * indeks);

      return {
        kodeMk: item.mataKuliah.kode,
        namaMk: item.mataKuliah.name,
        sks: sks,
        nilaiHuruf: item.nilaiHuruf || 'T', // Tunda jika null
        indeks: indeks
      };
    });

    const ips = totalSks > 0 ? (totalBobot / totalSks) : 0;

    // Ambil data profil mahasiswa dari record pertama
    const studentInfo = rawNilai[0].mahasiswa;

    return {
      semester,
      totalSks,
      totalBobot,
      ips: parseFloat(ips.toFixed(2)), // Bulatkan 2 desimal
      ipk: 3.50, // Dummy: Logic IPK butuh query agregat seluruh semester
      mahasiswa: {
        nama: studentInfo.name,
        nim: studentInfo.nim ?? '-',
        prodi: studentInfo.prodi?.name || 'Umum'
      },
      nilai: formattedNilai
    };
  }

  // 2. GENERATE HTML REPORT (Untuk Download PDF)
  async generateKhsHtml(studentId: number, semester: string): Promise<string> {
    const data = await this.getKhs(studentId, semester);

    // Template HTML Sederhana untuk Laporan
    const rows = data.nilai.map((n, index) => `
      <tr>
        <td style="text-align: center;">${index + 1}</td>
        <td>${n.kodeMk}</td>
        <td>${n.namaMk}</td>
        <td style="text-align: center;">${n.sks}</td>
        <td style="text-align: center;">${n.nilaiHuruf}</td>
        <td style="text-align: center;">${n.indeks}</td>
        <td style="text-align: center;">${(n.sks * n.indeks).toFixed(2)}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 40px; }
          h2, h3 { text-align: center; margin: 0; }
          .header { margin-bottom: 30px; }
          .info-table { width: 100%; margin-bottom: 20px; }
          .info-table td { padding: 5px; }
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
          <tr>
            <td width="15%">Nama</td><td>: <b>${data.mahasiswa.nama}</b></td>
            <td width="15%">Semester</td><td>: ${data.semester}</td>
          </tr>
          <tr>
            <td>NIM</td><td>: ${data.mahasiswa.nim}</td>
            <td>Prodi</td><td>: ${data.mahasiswa.prodi}</td>
          </tr>
        </table>

        <table class="nilai-table">
          <thead>
            <tr style="background-color: #f0f0f0;">
              <th width="5%">No</th>
              <th width="15%">Kode</th>
              <th>Mata Kuliah</th>
              <th width="10%">SKS</th>
              <th width="10%">Nilai</th>
              <th width="10%">Bobot</th>
              <th width="10%">Mutu</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="text-align: right; font-weight: bold;">Total</td>
              <td style="text-align: center; font-weight: bold;">${data.totalSks}</td>
              <td colspan="2"></td>
              <td style="text-align: center; font-weight: bold;">${data.totalBobot.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        <div style="margin-top: 20px;">
          <p><b>Indeks Prestasi Semester (IPS): ${data.ips}</b></p>
        </div>

        <div class="footer">
          <p>Manado, ${new Date().toLocaleDateString('id-ID')}</p>
          <p>Mengetahui,</p>
          <br><br><br>
          <p><b>Dosen Pembimbing Akademik</b></p>
        </div>
      </body>
      </html>
    `;
  }

  async getTranskrip(mahasiswaId: number) {
    // 1. Ambil data mahasiswa
    const mahasiswa = await prisma.user.findUnique({
      where: { id: mahasiswaId },
      include: {
        prodi: true,
        fakultas: true,
      },
    });

    if (!mahasiswa) throw new NotFoundException('Mahasiswa tidak ditemukan');

    // 2. Ambil SEMUA nilai yang sudah ada (SUDAH_ADA)
    const allNilai = await prisma.nilai.findMany({
      where: {
        mahasiswaId: mahasiswaId,
        status: 'SUDAH_ADA', // Hanya nilai yang sudah fix
      },
      include: {
        mataKuliah: true, // Butuh data SKS dan Kode MK
      },
      orderBy: {
        semester: 'asc', // Urutkan berdasarkan semester pengambilan
      },
    });

    // 3. LOGIKA FILTER NILAI TERBAIK (Best Grade Policy)
    // Jika mahasiswa mengulang MK, kita hanya ambil nilai indeks tertinggi untuk IPK
    const bestGradesMap = new Map<string, any>();

    for (const record of allNilai) {
      const kodeMK = record.mataKuliah.kode;
      const existing = bestGradesMap.get(kodeMK);

      // Jika belum ada, atau nilai sekarang LEBIH BESAR dari yang tersimpan
      if (
        !existing ||
        (record.indeksNilai !== null &&
          (existing.indeksNilai === null || record.indeksNilai > existing.indeksNilai))
      ) {
        bestGradesMap.set(kodeMK, {
          kode: kodeMK,
          matakuliah: record.mataKuliah.name,
          sks: record.mataKuliah.sks,
          nilaiHuruf: record.nilaiHuruf,
          indeks: record.indeksNilai, // 4.0, 3.0, dst
          semester: record.semester,
        });
      }
    }

    // Konversi Map ke Array
    const transkripList = Array.from(bestGradesMap.values());

    // 4. HITUNG IPK (Indeks Prestasi Kumulatif)
    let totalSKS = 0;
    let totalBobot = 0; // SKS * Indeks

    transkripList.forEach((item) => {
      totalSKS += item.sks;
      totalBobot += item.sks * item.indeks;
    });

    const ipk = totalSKS > 0 ? (totalBobot / totalSKS).toFixed(2) : '0.00';

    // 5. Return Data Rapih
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
      transkrip: transkripList.sort((a, b) => a.semester.localeCompare(b.semester)), // Urutkan display per semester
    };
  }

  // Helper Predikat Kelulusan
  private getPredikat(ipk: number): string {
    if (ipk >= 3.51) return 'Dengan Pujian (Cumlaude)';
    if (ipk >= 3.01) return 'Sangat Memuaskan';
    if (ipk >= 2.76) return 'Memuaskan';
    return 'Cukup';
  }
}