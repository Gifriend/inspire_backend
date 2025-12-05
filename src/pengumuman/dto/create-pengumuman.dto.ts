import { IsString, IsEnum, IsOptional, IsInt } from 'class-validator';

export class CreatePengumumanDto {
  @IsString()
  judul: string;

  @IsString()
  isi: string;

  @IsString()
  kategori: string;

  @IsEnum(['TINGGI', 'NORMAL', 'RENDAH'])
  @IsOptional()
  prioritas?: 'TINGGI' | 'NORMAL' | 'RENDAH' = 'NORMAL';

  @IsInt()
  @IsOptional()
  kelasPerkuliahanId?: number;
}