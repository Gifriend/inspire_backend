import { IsString, IsNotEmpty, IsEnum, IsOptional, IsInt, Length } from 'class-validator';
import { SessionType } from '@prisma/client';

export class CreatePresensiDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsEnum(SessionType)
  type: SessionType;

  @IsOptional()
  @IsInt()
  kelasPerkuliahanId?: number;
}

export class SubmitPresensiDto {
  @IsNotEmpty()
  @IsInt()
  sessionId: number;

  @IsNotEmpty()
  @IsString()
  @Length(8, 8, { message: 'Token harus 8 karakter' })
  token: string; // GANTI: Swafoto jadi Token
}

export class ManualPresensiDto {
  @IsNotEmpty()
  @IsInt()
  sessionId: number;

  @IsNotEmpty()
  @IsInt()
  mahasiswaId: number;
}