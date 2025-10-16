import { IsInt, IsArray, IsString, ArrayNotEmpty } from 'class-validator';

export class KontrakMataKuliahDto {
  @IsInt()
  mahasiswaId: number;

  @IsString()
  semester: string;

  @IsArray()
  @ArrayNotEmpty()
  kelasIds: number[];
}
