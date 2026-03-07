import { Type } from "class-transformer";
import {
  IsString, IsArray, ValidateNested, IsNotEmpty, Min, IsInt, IsIn,
  IsOptional, IsEnum, IsNumber, IsPositive, IsDateString, Max,
} from "class-validator";
import { TaskKategori } from '@prisma/client';

export class CreateSessionDto {
  @IsNotEmpty() @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsInt() @Min(1) weekNumber: number;
  @IsInt() @Min(1) kelasPerkuliahanId: number;
}

export class CreateMaterialDto {
  @IsNotEmpty() @IsString() title: string;
  @IsIn(['TEXT', 'FILE', 'HYBRID']) type: 'TEXT' | 'FILE' | 'HYBRID';
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() fileUrl?: string;
  @IsNotEmpty() @IsString() sessionId: string;
}

export class CreateAssignmentDto {
  @IsNotEmpty() @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsNotEmpty() @IsDateString() deadline: string;
  @IsNotEmpty() @IsString() sessionId: string;
  @IsOptional() @IsEnum(TaskKategori) kategori?: TaskKategori;
  @IsOptional() @IsNumber() @Min(0) @Max(100) bobot?: number;
}

export class SubmitAssignmentDto {
  @IsNotEmpty() @IsString() assignmentId: string;
  @IsOptional() @IsString() fileUrl?: string;
  @IsOptional() @IsString() textContent?: string;
}

export class CreateQuestionDto {
  // Accept either `text` (preferred) or `question` (client alias)
  @IsOptional() @IsString() text?: string;
  @IsOptional() @IsString() question?: string;
  @IsIn(['MULTIPLE_CHOICE', 'ESSAY', 'TRUE_FALSE']) type: 'MULTIPLE_CHOICE' | 'ESSAY' | 'TRUE_FALSE';
  @IsOptional() @IsArray() options?: any[];
  @IsOptional() @IsString() correctAnswer?: string;
  @IsOptional() @IsNumber() @IsPositive() points?: number;
}

export class CreateQuizDto {
  @IsNotEmpty() @IsString() title: string;
  @IsInt() @IsPositive() duration: number;
  @IsNotEmpty() @IsDateString() startTime: string;
  @IsNotEmpty() @IsDateString() endTime: string;
  // Accept both short and long forms from client (e.g. "LATEST" or "LATEST_GRADE")
  @IsIn(['HIGHEST_GRADE', 'LATEST_GRADE', 'AVERAGE_GRADE', 'HIGHEST', 'LATEST', 'AVERAGE'])
  gradingMethod: 'HIGHEST_GRADE' | 'LATEST_GRADE' | 'AVERAGE_GRADE' | 'HIGHEST' | 'LATEST' | 'AVERAGE';
  @IsNotEmpty() @IsString() sessionId: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CreateQuestionDto) questions: CreateQuestionDto[];
  @IsOptional() @IsEnum(TaskKategori) kategori?: TaskKategori;
  @IsOptional() @IsNumber() @Min(0) @Max(100) bobot?: number;
}

export class QuizAnswerDto {
  @IsString()
  questionId: string;

  @IsString()
  answer: string;
}


export class SubmitQuizDto {
  @IsString()
  quizId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers: QuizAnswerDto[];
}