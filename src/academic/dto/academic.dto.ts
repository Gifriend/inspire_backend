import { IsNotEmpty, IsString } from 'class-validator';

export class GetKhsDto {
  @IsNotEmpty()
  @IsString()
  semester: string; // Contoh: "2024/2025 Ganjil"
}

export class KhsResponseDto {
  semester: string;
  totalSks: number;
  totalBobot: number; // SKS x Nilai Indeks
  ips: number; // Indeks Prestasi Semester
  ipk: number; // Indeks Prestasi Kumulatif (Optional/Dummy dulu)
  mahasiswa: {
    nama: string;
    nim: string;
    prodi: string;
  };
  nilai: {
    kodeMk: string;
    namaMk: string;
    sks: number;
    nilaiHuruf: string;
    indeks: number; // 4.0, 3.0, dst
  }[];
}