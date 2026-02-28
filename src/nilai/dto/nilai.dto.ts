import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Input nilai satu mahasiswa */
export class InputNilaiDto {
  @IsNumber()
  @IsNotEmpty()
  mahasiswaId: number;

  @IsNumber()
  @IsNotEmpty()
  mataKuliahId: number;

  @IsString()
  @IsNotEmpty()
  academicYear: string; // "2024/2025 Genap"

  @IsOptional()
  @IsNumber()
  @Min(0) @Max(100)
  nilaiTugas?: number;

  @IsOptional()
  @IsNumber()
  @Min(0) @Max(100)
  nilaiUTS?: number;

  @IsOptional()
  @IsNumber()
  @Min(0) @Max(100)
  nilaiUAS?: number;
}

/** Input nilai banyak mahasiswa sekaligus */
export class BatchInputNilaiDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InputNilaiDto)
  items: InputNilaiDto[];
}

/** Response untuk satu record nilai */
export class NilaiResponseDto {
  id: number;
  mahasiswaId: number;
  namaMahasiswa: string;
  nim: string;
  mataKuliahId: number;
  kodeMK: string;
  namaMK: string;
  sks: number;
  academicYear: string;
  nilaiTugas: number | null;
  nilaiUTS: number | null;
  nilaiUAS: number | null;
  nilaiAkhir: number | null;
  nilaiHuruf: string | null;
  indeksNilai: number | null;
  status: string;
}

/** Response daftar mahasiswa + nilai di suatu kelas */
export class KelasNilaiResponseDto {
  kelasId: number;
  namaKelas: string;
  kodeMK: string;
  namaMK: string;
  sks: number;
  academicYear: string;
  dosenNama: string;
  mahasiswa: NilaiResponseDto[];
}
