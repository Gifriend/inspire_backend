import { IsInt, IsString, IsNotEmpty } from 'class-validator';

export class AddClassDto {
  @IsInt()
  @IsNotEmpty()
  kelasId: number;

  // @IsString()
  // @IsNotEmpty()
  // kodeMataKuliah: string;

  // @IsString()
  // @IsNotEmpty()
  // namaMataKuliah: string;

  // @IsInt()
  // @IsNotEmpty()
  // sks: number;

  // @IsString()
  // @IsNotEmpty()
  // dosen: string;

  // @IsInt()
  // @IsNotEmpty()
  // kapasitas: number;

  @IsString()
  @IsNotEmpty()
  semester: string;
}