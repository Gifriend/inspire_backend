import { Injectable, NotFoundException } from '@nestjs/common';
import { KhsResponseDto, TranskripResponseDto } from './dto/academic.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as PDFDocument from 'pdfkit';

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
    // 1. Ambil data mahasiswa
    const mahasiswa = await this.prisma.user.findUnique({
      where: { id: studentId },
      include: { prodi: true },
    });
    if (!mahasiswa) throw new NotFoundException('Mahasiswa tidak ditemukan');

    // 2. Ambil nilai semester yang dipilih
    const rawNilai = await this.prisma.nilai.findMany({
      where: {
        mahasiswaId: studentId,
        academicYear: semester,
        status: 'SUDAH_ADA',
      },
      include: { mataKuliah: true },
      orderBy: { mataKuliah: { kode: 'asc' } },
    });

    // 3. Hitung IPS dan bentuk daftar nilai
    let totalSks = 0;
    let totalNilaiSks = 0;

    const nilaiList = rawNilai.map((item, idx) => {
      const sks = item.mataKuliah.sks;
      const indeks = item.indeksNilai ?? 0;
      totalSks += sks;
      totalNilaiSks += sks * indeks;
      return {
        no: idx + 1,
        kodeMk: item.mataKuliah.kode,
        namaMk: item.mataKuliah.name,
        sks,
        nilaiHuruf: item.nilaiHuruf ?? '-',
        indeks,
        nilaiSks: parseFloat((sks * indeks).toFixed(2)),
      };
    });

    const ips = totalSks > 0 ? parseFloat((totalNilaiSks / totalSks).toFixed(2)) : 0;

    // 4. Hitung IPK kumulatif & update data akademik
    const ipk = await this.calculateRealIPK(studentId);
    await this.updateUserAcademicData(studentId, semester);

    return {
      semester,
      mahasiswa: {
        nama: mahasiswa.name,
        nim: mahasiswa.nim ?? '-',
        angkatan: this.getAngkatan(mahasiswa.nim, semester),
        prodi: mahasiswa.prodi?.name ?? '-',
        pembimbingAkademik: null, // Diisi dari sistem kepegawaian jika tersedia
      },
      statistik: {
        totalSks,
        totalNilaiSks: parseFloat(totalNilaiSks.toFixed(2)),
        ips,
        ipk,
        maksBebaSksBerikutnya: this.getMaksBebaSks(ips),
      },
      nilai: nilaiList,
    };
  }


  // ==========================================
  // 2. TRANSCRIPT FEATURES
  // ==========================================

  async getTranskrip(mahasiswaId: number): Promise<TranskripResponseDto> {
    const mahasiswa = await this.prisma.user.findUnique({
      where: { id: mahasiswaId },
      include: { prodi: true, fakultas: true },
    });
    if (!mahasiswa) throw new NotFoundException('Mahasiswa tidak ditemukan');

    // 1. Ambil semua nilai yang sudah ada
    const allNilai = await this.prisma.nilai.findMany({
      where: { mahasiswaId, status: 'SUDAH_ADA' },
      include: { mataKuliah: true },
      orderBy: [{ academicYear: 'asc' }, { mataKuliah: { kode: 'asc' } }],
    });

    // 2. Ambil nilai TERBAIK per MK (untuk kasus mengulang)
    const bestGradesMap = new Map<string, typeof allNilai[0]>();
    for (const record of allNilai) {
      const kode = record.mataKuliah.kode;
      const existing = bestGradesMap.get(kode);
      const nilaiBaru = record.indeksNilai ?? 0;
      const nilaiLama = existing ? (existing.indeksNilai ?? 0) : -1;
      if (!existing || nilaiBaru > nilaiLama) {
        bestGradesMap.set(kode, record);
      }
    }

    // 3. Kelompokkan nilai terbaik berdasarkan academicYear (semester)
    const bySemesterMap = new Map<string, typeof allNilai>();
    for (const record of bestGradesMap.values()) {
      const ay = record.academicYear;
      if (!bySemesterMap.has(ay)) bySemesterMap.set(ay, []);
      bySemesterMap.get(ay)!.push(record);
    }

    // 4. Urutkan semester secara kronologis
    const sortedAcademicYears = Array.from(bySemesterMap.keys()).sort(
      this.compareAcademicYear,
    );

    // 5. Bangun struktur bySemester
    let globalTotalSKS = 0;
    let globalTotalNilaiSks = 0;
    let globalMkCount = 0;

    const bySemester = sortedAcademicYears.map((ay, semIdx) => {
      const records = bySemesterMap.get(ay)!.sort((a, b) =>
        a.mataKuliah.kode.localeCompare(b.mataKuliah.kode),
      );

      let subSks = 0;
      let subNilaiSks = 0;

      const matakuliah = records.map((r, i) => {
        const sks = r.mataKuliah.sks;
        const indeks = r.indeksNilai ?? 0;
        subSks += sks;
        subNilaiSks += sks * indeks;
        return {
          no: i + 1,
          kode: r.mataKuliah.kode,
          nama: r.mataKuliah.name,
          sks,
          nilaiHuruf: r.nilaiHuruf ?? '-',
          indeks,
          nilaiSks: parseFloat((sks * indeks).toFixed(2)),
        };
      });

      globalTotalSKS += subSks;
      globalTotalNilaiSks += subNilaiSks;
      globalMkCount += matakuliah.length;

      return {
        semesterKe: semIdx + 1,
        label: `Semester ${semIdx + 1}`,
        academicYear: ay,
        matakuliah,
        subTotal: {
          sks: subSks,
          nilaiSks: parseFloat(subNilaiSks.toFixed(2)),
        },
      };
    });

    const ipkNum = globalTotalSKS > 0 ? globalTotalNilaiSks / globalTotalSKS : 0;
    const ipkStr = ipkNum.toFixed(2);

    return {
      mahasiswa: {
        nama: mahasiswa.name,
        nim: mahasiswa.nim ?? '-',
        angkatan: this.getAngkatan(mahasiswa.nim, sortedAcademicYears[0]),
        jenisKelamin: mahasiswa.gender === 'LAKI_LAKI' ? 'Laki-Laki' : 'Perempuan',
        tempatLahir: null,
        tanggalLahir: mahasiswa.tanggalLahir
          ? mahasiswa.tanggalLahir.toLocaleDateString('id-ID', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : null,
        prodi: mahasiswa.prodi?.name ?? '-',
        jenjang: mahasiswa.prodi?.jenjang ?? '-',
        fakultas: mahasiswa.fakultas.name,
        tanggalMasuk: null,
        tanggalCetak: new Date().toLocaleDateString('id-ID', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      },
      statistik: {
        totalSKS: globalTotalSKS,
        totalMataKuliah: globalMkCount,
        ipk: ipkStr,
        predikat: this.getPredikat(parseFloat(ipkStr)),
      },
      bySemester,
    };
  }

  // ==========================================
  // 3. PDF GENERATION
  // ==========================================

  /** Converts a pdfkit Document stream into a Buffer */
  private pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }

  /** Draws one table row. Returns the Y coordinate after the row. */
  private drawRow(
    doc: PDFKit.PDFDocument,
    y: number,
    cells: { text: string; x: number; w: number; align?: 'left'|'center'|'right' }[],
    rowH: number,
    opts: { header?: boolean; gray?: boolean } = {},
  ): number {
    const totalW = cells[cells.length - 1].x + cells[cells.length - 1].w - cells[0].x;
    if (opts.header || opts.gray) {
      doc.save()
        .rect(cells[0].x, y, totalW, rowH)
        .fill(opts.header ? '#D0D0D0' : '#F2F2F2')
        .restore();
    }
    cells.forEach(cell => {
      doc.rect(cell.x, y, cell.w, rowH).stroke('#000');
      doc
        .fontSize(opts.header ? 8 : 8)
        .font(opts.header ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor('#000')
        .text(cell.text, cell.x + 3, y + (rowH - 10) / 2 + 1, {
          width: cell.w - 6,
          align: cell.align ?? 'left',
          lineBreak: false,
        });
    });
    return y + rowH;
  }

  /** Renders the university header block. Returns Y after the header. */
  private drawPageHeader(doc: PDFKit.PDFDocument, fakultas: string): number {
    const L = 50, W = doc.page.width - 100;
    doc
      .font('Helvetica-Bold').fontSize(11)
      .text('KEMENTERIAN PENDIDIKAN, KEBUDAYAAN, RISET DAN TEKNOLOGI', L, 50, { width: W, align: 'center' })
      .fontSize(13)
      .text('UNIVERSITAS SAM RATULANGI', { width: W, align: 'center' })
      .fontSize(11)
      .text(fakultas.toUpperCase(), { width: W, align: 'center' });
    const afterFak = doc.y + 2;
    doc.moveTo(L, afterFak).lineTo(L + W, afterFak).lineWidth(2).stroke('#000');
    doc.moveTo(L, afterFak + 2).lineTo(L + W, afterFak + 2).lineWidth(0.5).stroke('#000');
    return afterFak + 8;
  }

  async generateKhsPdf(studentId: number, semester: string): Promise<Buffer> {
    const data = await this.getKhs(studentId, semester);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const L = 50;
    const PAGE_W = doc.page.width - 100; // 495

    // ---- HEADER ----
    const headerEnd = this.drawPageHeader(doc, 'Fakultas Teknik');

    // ---- TITLE ----
    doc.moveDown(0.4)
      .font('Helvetica-Bold').fontSize(13)
      .text('KARTU HASIL STUDI', L, headerEnd + 8, { width: PAGE_W, align: 'center' });
    doc.font('Helvetica').fontSize(10)
      .text(`Semester: ${data.semester}`, { width: PAGE_W, align: 'center' });
    doc.moveDown(0.6);

    // ---- STUDENT INFO ----
    const infoY = doc.y;
    const col1X = L, col2X = L + 230;
    const infoData: [string, string][] = [
      ['Nama Mahasiswa', data.mahasiswa.nama],
      ['Nomor Induk Mahasiswa', data.mahasiswa.nim],
      ['Angkatan', data.mahasiswa.angkatan],
      ['Program Studi', data.mahasiswa.prodi],
    ];
    let infoRowY = infoY;
    infoData.forEach(([label, val]) => {
      doc.font('Helvetica-Bold').fontSize(9).text(label, col1X, infoRowY);
      doc.font('Helvetica').fontSize(9).text(`: ${val}`, col2X, infoRowY);
      infoRowY += 14;
    });
    doc.moveDown(0.3);

    // ---- TABLE ----
    const cols = [
      { w: 25,  align: 'center' as const }, // No
      { w: 65,  align: 'left'   as const }, // Kode
      { w: 200, align: 'left'   as const }, // Nama MK
      { w: 40,  align: 'center' as const }, // SKS
      { w: 50,  align: 'center' as const }, // Nilai Huruf
      { w: 50,  align: 'center' as const }, // Angka
      { w: 65,  align: 'right'  as const }, // Nilai SKS
    ];
    const headers = ['No', 'Kode', 'Mata Kuliah', 'SKS', 'Nilai', 'Angka', 'Nilai SKS'];
    const ROW_H = 18;

    const buildCells = (values: string[], y: number) => {
      let x = L;
      return cols.map((c, i) => {
        const cell = { text: values[i], x, w: c.w, align: c.align };
        x += c.w;
        return cell;
      });
    };

    let tableY = doc.y + 4;
    tableY = this.drawRow(doc, tableY, buildCells(headers, tableY), ROW_H, { header: true });

    data.nilai.forEach((n, i) => {
      const cells = buildCells(
        [String(n.no), n.kodeMk, n.namaMk, String(n.sks), n.nilaiHuruf, String(n.indeks.toFixed(2)), String(n.nilaiSks.toFixed(2))],
        tableY,
      );
      tableY = this.drawRow(doc, tableY, cells, ROW_H, { gray: i % 2 === 1 });
    });

    // Total row
    tableY = this.drawRow(
      doc, tableY,
      buildCells(['', '', 'Total', String(data.statistik.totalSks), '', '', String(data.statistik.totalNilaiSks.toFixed(2))], tableY),
      ROW_H, { header: true },
    );

    // ---- STATS ----
    doc.y = tableY + 8;
    doc.font('Helvetica').fontSize(9);
    const stats: [string, string][] = [
      ['IP Semester (IPS)', `: ${data.statistik.ips.toFixed(2)}`],
      ['IP Kumulatif (IPK)', `: ${data.statistik.ipk.toFixed(2)}`],
      ['Maks. Beban sks semester berikutnya', `: ${data.statistik.maksBebaSksBerikutnya}`],
    ];
    stats.forEach(([lbl, val]) => {
      doc.font('Helvetica-Bold').text(lbl, L, doc.y, { continued: true })
        .font('Helvetica').text(val);
    });

    // ---- SIGNATURE ----
    doc.moveDown(2);
    const sigX = doc.page.width - 50 - 180;
    doc.font('Helvetica').fontSize(9)
      .text(
        `Manado, ${new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        sigX, doc.y, { width: 180, align: 'center' },
      )
      .moveDown(0.2)
      .text('Wakil Dekan 1,', sigX, doc.y, { width: 180, align: 'center' })
      .moveDown(3);

    return this.pdfToBuffer(doc);
  }

  async generateTranskripPdf(studentId: number): Promise<Buffer> {
    const data = await this.getTranskrip(studentId);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const L = 50;
    const PAGE_W = doc.page.width - 100;

    // ---- HEADER ----
    const headerEnd = this.drawPageHeader(doc, data.mahasiswa.fakultas);

    // ---- TITLE ----
    doc.moveDown(0.3)
      .font('Helvetica-Bold').fontSize(12)
      .text('TRANSKRIP NILAI', L, headerEnd + 8, { width: PAGE_W, align: 'center' });
    doc.moveDown(0.6);

    // ---- STUDENT INFO (2 columns) ----
    const infoY = doc.y;
    const c1 = L, c1v = L + 165, c2 = L + 280, c2v = L + 420;
    const infoLeft: [string, string][] = [
      ['Nama', data.mahasiswa.nama],
      ['Tempat / Tanggal Lahir', data.mahasiswa.tanggalLahir ?? '-'],
      ['NIM / NIP', data.mahasiswa.nim],
      ['Nama & Jenjang Program Studi', `${data.mahasiswa.prodi} / ${data.mahasiswa.jenjang}`],
      ['Tanggal Masuk', data.mahasiswa.tanggalMasuk ?? '-'],
      ['Tanggal Cetak', data.mahasiswa.tanggalCetak],
    ];
    let infoY2 = infoY;
    infoLeft.forEach(([lbl, val]) => {
      doc.font('Helvetica-Bold').fontSize(8).text(lbl, c1, infoY2, { width: c1v - c1 - 4, lineBreak: false });
      doc.font('Helvetica').fontSize(8).text(`: ${val}`, c1v, infoY2, { width: c2 - c1v - 4, lineBreak: false });
      infoY2 += 13;
    });
    doc.y = infoY2 + 4;

    // ---- TABLE PER SEMESTER ----
    const cols = [
      { w: 25,  align: 'center' as const },
      { w: 60,  align: 'left'   as const },
      { w: 205, align: 'left'   as const },
      { w: 40,  align: 'center' as const },
      { w: 45,  align: 'center' as const },
      { w: 55,  align: 'center' as const },
      { w: 65,  align: 'right'  as const },
    ];
    const HEADER_LABELS = ['No', 'Kode', 'Mata Kuliah', 'SKS', 'Nilai', 'Angka', 'Nilai SKS'];
    const ROW_H = 16;

    const buildCells = (values: string[]) => {
      let x = L;
      return cols.map((c, i) => {
        const cell = { text: values[i], x, w: c.w, align: c.align };
        x += c.w;
        return cell;
      });
    };

    for (const sem of data.bySemester) {
      // Add page if near bottom
      if (doc.y > doc.page.height - 140) doc.addPage();

      let tableY = doc.y + 4;

      // Semester header bar (full width, dark)
      const totalW = cols.reduce((s, c) => s + c.w, 0);
      doc.save()
        .rect(L, tableY, totalW, ROW_H)
        .fill('#555555')
        .restore();
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF')
        .text(
          `${sem.label}  (${sem.academicYear})`,
          L + 4, tableY + (ROW_H - 9) / 2 + 1,
          { width: totalW - 8, lineBreak: false },
        );
      doc.fillColor('#000');
      tableY += ROW_H;

      // Column headers
      tableY = this.drawRow(doc, tableY, buildCells(HEADER_LABELS), ROW_H, { header: true });

      // Value rows
      sem.matakuliah.forEach((mk, i) => {
        if (doc.y > doc.page.height - 80) doc.addPage();
        const cells = buildCells([
          String(mk.no), mk.kode, mk.nama, String(mk.sks),
          mk.nilaiHuruf, mk.indeks.toFixed(2), mk.nilaiSks.toFixed(2),
        ]);
        tableY = this.drawRow(doc, tableY, cells, ROW_H, { gray: i % 2 === 1 });
      });

      // Sub-total row
      tableY = this.drawRow(
        doc, tableY,
        buildCells(['', '', 'Sub Total', String(sem.subTotal.sks), '', '', sem.subTotal.nilaiSks.toFixed(2)]),
        ROW_H, { header: true },
      );

      doc.y = tableY + 4;
    }

    // ---- GRAND TOTAL ----
    doc.moveDown(0.5).font('Helvetica').fontSize(9);
    const summary: [string, string][] = [
      ['Total SRS (Sistem Referensi Studi)', `: ${data.statistik.totalSKS}`],
      ['Indeks Prestasi Kumulatif (IPK)', `: ${data.statistik.ipk}`],
      ['Predikat Kelulusan', `: ${data.statistik.predikat}`],
    ];
    summary.forEach(([lbl, val]) => {
      doc.font('Helvetica-Bold').text(lbl, L, doc.y, { continued: true })
        .font('Helvetica').text(val);
    });

    // ---- SIGNATURE ----
    doc.moveDown(2);
    const sigX = doc.page.width - 50 - 180;
    doc.font('Helvetica').fontSize(9)
      .text(
        `Manado, ${new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        sigX, doc.y, { width: 180, align: 'center' },
      )
      .moveDown(0.2)
      .text('Dekan,', sigX, doc.y, { width: 180, align: 'center' })
      .moveDown(3)
      .text('Prof. Dr. Ir. ....................................', sigX, doc.y, { width: 180, align: 'center' })
      .text('NIP. ......................................', sigX, doc.y, { width: 180, align: 'center' });

    return this.pdfToBuffer(doc);
  }

  // ==========================================
  // HELPERS
  // ==========================================
  private getPredikat(ipk: number): string {
    if (ipk >= 3.51) return 'Dengan Pujian (Cumlaude)';
    if (ipk >= 3.01) return 'Sangat Memuaskan';
    if (ipk >= 2.76) return 'Memuaskan';
    return 'Cukup';
  }

  // Helper: hitung maks beban SKS semester berikutnya berdasarkan IPS
  private getMaksBebaSks(ips: number): number {
    if (ips >= 3.0) return 24;
    if (ips >= 2.5) return 21;
    if (ips >= 2.0) return 18;
    return 15;
  }

  // Helper: estimasi angkatan dari NIM atau academicYear pertama
  private getAngkatan(nim: string | null | undefined, firstAcademicYear?: string): string {
    // Coba parse dari NIM (format UNSRAT: 2 digit tahun di awal, e.g. 220211060328 → 2022)
    if (nim && nim.length >= 2) {
      const prefix = nim.substring(0, 2);
      const year = parseInt(prefix, 10);
      if (!isNaN(year)) {
        // 00–40 → 2000–2040, 41–99 → abad 20 (legacy)
        return year <= 40 ? `20${prefix}` : `19${prefix}`;
      }
    }
    // Fallback: ambil tahun awal dari academicYear pertama, e.g. "2022/2023 Ganjil" → "2022"
    if (firstAcademicYear) {
      const match = firstAcademicYear.match(/^(\d{4})/);
      if (match) return match[1];
    }
    return '-';
  }

  // Helper: urutkan academicYear secara kronologis ("2022/2023 Ganjil" < "2022/2023 Genap" < "2023/2024 Ganjil")
  private compareAcademicYear = (a: string, b: string): number => {
    const parse = (ay: string) => {
      const m = ay.match(/^(\d{4})\/(\d{4})\s+(.+)$/i);
      if (!m) return { year: 0, half: 0 };
      const year = parseInt(m[1]);
      const term = m[3].toLowerCase();
      // Ganjil/Gasal = 0 (semester 1), Genap = 1 (semester 2)
      const half = term === 'genap' ? 1 : 0;
      return { year, half };
    };
    const pa = parse(a);
    const pb = parse(b);
    if (pa.year !== pb.year) return pa.year - pb.year;
    return pa.half - pb.half;
  };

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
