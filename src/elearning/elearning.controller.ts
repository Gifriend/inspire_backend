import { Controller, Get, Post, Body, Param, Req } from '@nestjs/common';
import { ElearningService } from './elearning.service';
import { 
  CreateSessionDto, 
  CreateMaterialDto, 
  CreateAssignmentDto, 
  SubmitAssignmentDto, 
  CreateQuizDto 
} from './dto/elearning.dto';

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
}