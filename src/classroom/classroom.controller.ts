import { Controller, Get, Param, Headers, UnauthorizedException } from '@nestjs/common';
import { ClassroomService } from './classroom.service';

@Controller('api/classroom')
export class ClassroomController {
  constructor(private readonly classroomService: ClassroomService) {}

  // Helper untuk memvalidasi dan mengambil token dari header
  private extractToken(authHeader: string): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token Google Access tidak valid atau tidak ditemukan');
    }
    return authHeader.split(' ')[1];
  }

  // Endpoint: GET /api/classroom/courses
  @Get('courses')
  async getCourses(@Headers('authorization') authHeader: string) {
    const token = this.extractToken(authHeader);
    return this.classroomService.getMyCourses(token);
  }

  // Endpoint: GET /api/classroom/courses/:courseId/course-work
  @Get('courses/:courseId/course-work')
  async getCourseWork(
    @Headers('authorization') authHeader: string,
    @Param('courseId') courseId: string,
  ) {
    const token = this.extractToken(authHeader);
    return this.classroomService.getCourseWork(token, courseId);
  }

  // Endpoint: GET /api/classroom/courses/:courseId/students
  @Get('courses/:courseId/students')
  async getCourseStudents(
    @Headers('authorization') authHeader: string,
    @Param('courseId') courseId: string,
  ) {
    const token = this.extractToken(authHeader);
    return this.classroomService.getCourseStudents(token, courseId);
  }
}