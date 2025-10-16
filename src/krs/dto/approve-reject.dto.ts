import { IsInt, IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class ApproveRejectDto {
  @IsInt()
  @IsNotEmpty()
  krsId: number;

  @IsString()
  @IsOptional()
  catatan?: string;
}