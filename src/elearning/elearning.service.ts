import { Injectable, HttpException, HttpStatus, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { 
  CreateSessionDto, 
  CreateMaterialDto, 
  CreateAssignmentDto, 
  SubmitAssignmentDto, 
  CreateQuizDto 
} from './dto/elearning.dto';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ElearningService {
  constructor(private prisma: PrismaService) {}
  
  // 1. Buat Sesi Pertemuan
  async createSession(data: CreateSessionDto) {
    return this.prisma.session.create({
      data: {
        title: data.title,
        description: data.description,
        weekNumber: data.weekNumber,
        kelasPerkuliahanId: data.kelasPerkuliahanId,
      },
    });
  }

  // 2. Upload Materi (Text, File, atau Hybrid)
  async createMaterial(data: CreateMaterialDto, user: User) {
    // Validasi Role
    if (user.role === Role.MAHASISWA) {
      throw new ForbiddenException('Mahasiswa tidak dapat membuat materi');
    }

    // Validasi data
    if (data.type === 'FILE' && !data.fileUrl) {
      throw new HttpException('File URL is required for FILE type', HttpStatus.BAD_REQUEST);
    }
    if (data.type === 'TEXT' && !data.content) {
      throw new HttpException('Content is required for TEXT type', HttpStatus.BAD_REQUEST);
    }

    return this.prisma.material.create({
      data: {
        title: data.title,
        type: data.type,
        content: data.content,
        fileUrl: data.fileUrl,
        sessionId: data.sessionId,
      },
    });
  }

  // 3. Buat Tugas
  async createAssignment(data: CreateAssignmentDto) {
    return this.prisma.assignment.create({
      data: {
        title: data.title,
        description: data.description,
        deadline: new Date(data.deadline),
        sessionId: data.sessionId,
      },
    });
  }

  // 4. Mahasiswa Mengirim Tugas
  async submitAssignment(data: SubmitAssignmentDto, user: User) {
    if (user.role !== Role.MAHASISWA) {
      throw new ForbiddenException('Hanya mahasiswa yang dapat mengumpulkan tugas.');
    }

    // Cek deadline
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: data.assignmentId },
    });

    if (!assignment) throw new NotFoundException('Assignment not found');

    if (new Date() > assignment.deadline && !assignment.allowLate) {
      throw new BadRequestException('Deadline has passed');
    }

    // Cek apakah sudah pernah submit (Update or Create)
    const existing = await this.prisma.submission.findFirst({
      where: {
        studentId: user.id,
        assignmentId: data.assignmentId
      }
    });

    if (existing) {
      return this.prisma.submission.update({
        where: { id: existing.id },
        data: {
          fileUrl: data.fileUrl,
          textContent: data.textContent,
          submittedAt: new Date(),
        }
      });
    }

    return this.prisma.submission.create({
      data: {
        studentId: user.id,
        assignmentId: data.assignmentId,
        fileUrl: data.fileUrl,
        textContent: data.textContent,
      },
    });
  }

  // 5. Buat Kuis Lengkap dengan Soal
  async createQuiz(data: CreateQuizDto) {
    return this.prisma.quiz.create({
      data: {
        title: data.title,
        duration: data.duration,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        gradingMethod: data.gradingMethod,
        sessionId: data.sessionId,
        questions: {
          create: data.questions.map(q => ({
            text: q.text,
            type: q.type,
            options: q.options, // Prisma otomatis handle JSON
            correctAnswer: q.correctAnswer,
            points: q.points
          }))
        }
      },
      include: { questions: true }
    });
  }

  // 6. Submit Quiz (Menghitung Nilai) - FITUR BARU
  async submitQuiz(data: any, user: User) {
    // 1. Validasi
    if (user.role !== Role.MAHASISWA) {
      throw new ForbiddenException('Hanya mahasiswa yang dapat mengerjakan kuis.');
    }

    // 2. Ambil Data Quiz
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: data.quizId },
      include: { questions: true }
    });

    if (!quiz) throw new NotFoundException('Kuis tidak ditemukan');

    // 3. Hitung Score
    let score = 0;
    if (data.answers && Array.isArray(data.answers)) {
      for (const answer of data.answers) {
        const question = quiz.questions.find(q => q.id === answer.questionId);
        // Jika jawaban benar (match key)
        if (question && question.correctAnswer === answer.answer) {
          score += question.points;
        }
      }
    }

    // 4. Simpan Attempt
    return this.prisma.quizAttempt.create({
      data: {
        studentId: user.id,
        quizId: data.quizId,
        score: score,
        finishedAt: new Date()
      }
    });
  }
  
  // 7. Get Course Content (Untuk Halaman E-learning)
  async getCourseContent(kelasPerkuliahanId: number) {
    return this.prisma.session.findMany({
      where: { kelasPerkuliahanId },
      orderBy: { weekNumber: 'asc' },
      include: {
        materials: true,
        assignments: true,
        quizzes: true,
      }
    });
  }
}