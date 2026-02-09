import {
  Controller,
  Get,
  Post,
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

@Controller('elearning')
export class ElearningController {
  constructor(private readonly elearningService: ElearningService) {}

  // POST: /elearning/session
  @Post('session')
  async createSession(@Body() dto: CreateSessionDto) {
    return this.elearningService.createSession(dto);
  }

  // POST: /elearning/material
  @Post('material')
  async createMaterial(@Body() dto: CreateMaterialDto, @Req() req) {
    return this.elearningService.createMaterial(dto, req.user);
  }

  // POST: /elearning/assignment
  @Post('assignment')
  async createAssignment(@Body() dto: CreateAssignmentDto) {
    return this.elearningService.createAssignment(dto);
  }

  // POST: /elearning/assignment/submit
  @Post('assignment/submit')
  async submitAssignment(@Body() dto: SubmitAssignmentDto, @Req() req) {
    return this.elearningService.submitAssignment(dto, req.user);
  }

  // POST: /elearning/quiz
  @Post('quiz')
  async createQuiz(@Body() dto: CreateQuizDto) {
    return this.elearningService.createQuiz(dto);
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
}
