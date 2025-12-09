import { IsString, IsArray, IsOptional, IsInt, IsNotEmpty } from 'class-validator';

export class CreatePengumumanDto {
  @IsNotEmpty()
  @IsString()
  title: string; 

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsNotEmpty()
  @IsString()
  category: string; 

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  kelasIds?: number[]; 
}