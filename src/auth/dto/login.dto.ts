import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  identifier: string; 

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional() // FCM Token bersifat opsional
  fcmToken?: string;
}