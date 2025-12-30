import { IsNotEmpty, IsString, IsUrl, IsOptional } from 'class-validator';

export class SubmitAssignmentDto {
  @IsNotEmpty()
  @IsString()
  assignmentId: string;

  @IsNotEmpty()
  @IsUrl()
  fileUrl: string;

  @IsOptional()
  @IsString()
  notes?: string;
}