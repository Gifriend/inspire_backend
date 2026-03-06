import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  ParseIntPipe,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ElearningService } from './elearning.service';
import {
  CreateSessionDto,
  CreateMaterialDto,
  CreateAssignmentDto,
  SubmitAssignmentDto,
  CreateQuizDto,
  SubmitQuizDto,
} from './dto/elearning.dto';
import { JwtAuthGuard } from '../auth/strategy/jwt-auth.guard';
import { GradeSubmissionDto } from './dto/grade.submisssion.dto';

@Controller('elearning')
export class ElearningController {
  constructor(private readonly elearningService: ElearningService) {}

  // POST: /elearning/session
  @UseGuards(JwtAuthGuard)
  @Post('session')
  async createSession(@Body() dto: CreateSessionDto, @Req() req) {
    return this.elearningService.createSession(dto, req.user);
  }

  // POST: /elearning/material
  @UseGuards(JwtAuthGuard)
  @Post('material')
  async createMaterial(@Body() dto: CreateMaterialDto, @Req() req) {
    return this.elearningService.createMaterial(dto, req.user);
  }

  // POST: /elearning/assignment
  @UseGuards(JwtAuthGuard)
  @Post('assignment')
  async createAssignment(@Body() dto: CreateAssignmentDto, @Req() req) {
    return this.elearningService.createAssignment(dto, req.user);
  }

  // POST: /elearning/assignment/submit
  @UseGuards(JwtAuthGuard)
  @Post('assignment/submit')
  async submitAssignment(@Body() dto: SubmitAssignmentDto, @Req() req) {
    return this.elearningService.submitAssignment(dto, req.user);
  }

  // POST: /elearning/quiz
  @UseGuards(JwtAuthGuard)
  @Post('quiz')
  async createQuiz(@Body() dto: CreateQuizDto, @Req() req) {
    return this.elearningService.createQuiz(dto, req.user);
  }

  // GET: /elearning/course/:kelasId
  @Get('course/:kelasId')
  async getCourseContent(@Param('kelasId') kelasId: string) {
    return this.elearningService.getCourseContent(Number(kelasId));
  }

  // GET: /elearning/course-detail/:kelasId - Get course detail with complete information
  @UseGuards(JwtAuthGuard)
  @Get('course-detail/:kelasId')
  async getCourseDetail(@Param('kelasId', ParseIntPipe) kelasId: number) {
    return this.elearningService.getCourseDetail(kelasId);
  }

  // POST: /elearning/quiz/submit
  @UseGuards(JwtAuthGuard)
  @Post('quiz/submit')
  async submitQuiz(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
      }),
    )
    dto: SubmitQuizDto,
    @Req() req,
  ) {
    return this.elearningService.submitQuiz(dto, req.user);
  }

  // GET: /elearning/courses - Get student's enrolled courses
  @UseGuards(JwtAuthGuard)
  @Get('courses')
  async getStudentCourses(@Req() req) {
    return this.elearningService.getStudentCourses(req.user.id);
  }

  // GET: /elearning/assignment/:id - Get assignment detail with submission status
  @UseGuards(JwtAuthGuard)
  @Get('assignment/:id')
  async getAssignmentDetail(@Param('id') id: string, @Req() req) {
    return this.elearningService.getAssignmentDetail(id, req.user.id);
  }

  // GET: /elearning/quiz/:id - Get quiz detail with attempt history
  @UseGuards(JwtAuthGuard)
  @Get('quiz/:id')
  async getQuizDetail(@Param('id') id: string, @Req() req) {
    return this.elearningService.getQuizDetail(id, req.user.id);
  }

  // GET: /elearning/material/:id - Get material detail
  @UseGuards(JwtAuthGuard)
  @Get('material/:id')
  async getMaterialDetail(@Param('id') id: string) {
    return this.elearningService.getMaterialDetail(id);
  }

  // elearning.controller.ts
@UseGuards(JwtAuthGuard)
@Get('assignment/:id/submissions')
async getAssignmentSubmissions(@Param('id') assignmentId: string, @Req() req) {
  return this.elearningService.getAssignmentSubmissions(assignmentId, req.user.id);
}

@UseGuards(JwtAuthGuard)
@Patch('submission/:id/grade')
async gradeSubmission(
  @Param('id') submissionId: string,
  @Body() dto: GradeSubmissionDto,
  @Req() req,
) {
  return this.elearningService.gradeSubmission(submissionId, dto, req.user.id);
}

@UseGuards(JwtAuthGuard)
@Get('quiz/:id/attempts')
async getQuizAttempts(@Param('id') quizId: string, @Req() req) {
  return this.elearningService.getQuizAttempts(quizId, req.user.id);
}

// OPTIONAL (helper)
@UseGuards(JwtAuthGuard)
@Get('submission/:id')
async getSubmissionDetail(@Param('id') submissionId: string) {
  return this.elearningService.getSubmissionDetail(submissionId);
}

@UseGuards(JwtAuthGuard)
@Get('lecturer/courses')
async getLecturerCourses(@Req() req) {
  return this.elearningService.getLecturerCourses(req.user.id);
}
}
