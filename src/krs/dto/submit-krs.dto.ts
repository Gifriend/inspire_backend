import { IsString, IsNotEmpty } from 'class-validator';

export class SubmitKrsDto {
  @IsString()
  @IsNotEmpty()
  semester: string;
}