import { Injectable, UnauthorizedException } from '@nestjs/common';
import { google } from 'googleapis';

@Injectable()
export class ClassroomService {
  
  // Fungsi pembantu untuk inisialisasi auth Google
  private getAuthClient(accessToken: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    return auth;
  }

  // 1. Mengambil daftar kelas
  async getMyCourses(accessToken: string) {
    try {
      const auth = this.getAuthClient(accessToken);
      const classroom = google.classroom({ version: 'v1', auth });

      const response = await classroom.courses.list({
        courseStates: ['ACTIVE'],
      });

      return response.data.courses || [];
    } catch (error) {
      throw new UnauthorizedException('Gagal mengambil kelas dari Google Classroom.');
    }
  }

  // 2. Mengambil daftar tugas (Assignment/Materi) dari kelas tertentu
  async getCourseWork(accessToken: string, courseId: string) {
    try {
      const auth = this.getAuthClient(accessToken);
      const classroom = google.classroom({ version: 'v1', auth });

      const response = await classroom.courses.courseWork.list({
        courseId: courseId,
      });

      return response.data.courseWork || [];
    } catch (error) {
      throw new UnauthorizedException(`Gagal mengambil tugas untuk kelas ${courseId}.`);
    }
  }

  // 3. Mengambil daftar mahasiswa di kelas tertentu
  async getCourseStudents(accessToken: string, courseId: string) {
    try {
      const auth = this.getAuthClient(accessToken);
      const classroom = google.classroom({ version: 'v1', auth });

      const response = await classroom.courses.students.list({
        courseId: courseId,
      });

      return response.data.students || [];
    } catch (error) {
      throw new UnauthorizedException(`Gagal mengambil data mahasiswa untuk kelas ${courseId}.`);
    }
  }
}