import { IsInt, IsNotEmpty, IsString, IsArray, ArrayNotEmpty } from 'class-validator';

export class CreateContractDto {
  @IsInt()
  mahasiswaId: number;

  @IsString()
  @IsNotEmpty()
  semester: string; // ex: "2024/2025 Ganjil"

  @IsArray()
  @ArrayNotEmpty()
  kelasPerkuliahanIds: number[]; // array of kelasPerkuliahan.id
}
