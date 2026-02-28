import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GetKhsDto {
  @IsNotEmpty()
  @IsString()
  semester: string; // Contoh: "2024/2025 Ganjil"
}

// DTO untuk satu baris nilai di KHS
export class KhsNilaiItemDto {
  no: number;
  kodeMk: string;
  namaMk: string;
  sks: number;
  nilaiHuruf: string;
  indeks: number;   // 4.0, 3.5, dst
  nilaiSks: number; // sks × indeks (mutu)
}

// DTO response KHS per semester
export class KhsResponseDto {
  semester: string;
  mahasiswa: {
    nama: string;
    nim: string;
    angkatan: string;         // Tahun masuk, misal "2022"
    prodi: string;
    pembimbingAkademik: string | null;
  };
  statistik: {
    totalSks: number;
    totalNilaiSks: number;    // Total mutu (bobot)
    ips: number;              // Indeks Prestasi Semester
    ipk: number;              // Indeks Prestasi Kumulatif
    maksBebaSksBerikutnya: number; // Beban SKS maks semester berikutnya
  };
  nilai: KhsNilaiItemDto[];
}

// DTO untuk satu baris nilai di Transkrip
export class TranskripNilaiItemDto {
  no: number;
  kode: string;
  nama: string;
  sks: number;
  nilaiHuruf: string;
  indeks: number;
  nilaiSks: number;
}

// DTO untuk satu kelompok semester dalam transkrip
export class TranskripSemesterDto {
  semesterKe: number;        // Urutan ke-1, ke-2, dst
  label: string;             // "Semester 1", "Semester 2", dst
  academicYear: string;      // "2022/2023 Ganjil"
  matakuliah: TranskripNilaiItemDto[];
  subTotal: {
    sks: number;
    nilaiSks: number;
  };
}

// DTO response Transkrip keseluruhan
export class TranskripResponseDto {
  mahasiswa: {
    nama: string;
    nim: string;
    angkatan: string;
    jenisKelamin: string;
    tempatLahir: string | null;
    tanggalLahir: string | null;
    prodi: string;
    jenjang: string;
    fakultas: string;
    tanggalMasuk: string | null;
    tanggalCetak: string;
  };
  statistik: {
    totalSKS: number;
    totalMataKuliah: number;
    ipk: string;
    predikat: string;
  };
  bySemester: TranskripSemesterDto[];
}

// ==============================
// DTO khusus Dosen Pembimbing Akademik (PA)
// ==============================

// Query param optional semester untuk endpoint PA
export class GetPaKhsQueryDto {
  @IsOptional()
  @IsString()
  semester?: string;
}

// Ringkasan mahasiswa bimbingan PA
export class MahasiswaBimbinganDto {
  id: number;
  nama: string;
  nim: string;
  prodi: string;
  angkatan: string;
  status: string;
  ipk: number;
  totalSksLulus: number;
  semesterTerakhir: string | null;
}