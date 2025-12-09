import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { 
  CreateSessionDto, 
  CreateMaterialDto, 
  CreateAssignmentDto, 
  SubmitAssignmentDto, 
  CreateQuizDto 
} from './dto/elearning.dto';

// Catatan: Di production, sebaiknya gunakan PrismaService dengan Dependency Injection
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

@Injectable()
export class ElearningService {
  
  // 1. Buat Sesi Pertemuan
  async createSession(data: CreateSessionDto) {
    return prisma.session.create({
      data: {
        title: data.title,
        description: data.description,
        weekNumber: data.weekNumber,
        kelasPerkuliahanId: data.kelasPerkuliahanId,
      },
    });
  }

  // 2. Upload Materi (Text, File, atau Hybrid)
  async createMaterial(data: CreateMaterialDto) {
    // Validasi sederhana
    if (data.type === 'FILE' && !data.fileUrl) {
      throw new HttpException('File URL is required for FILE type', HttpStatus.BAD_REQUEST);
    }
    if (data.type === 'TEXT' && !data.content) {
      throw new HttpException('Content is required for TEXT type', HttpStatus.BAD_REQUEST);
    }

    return prisma.material.create({
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
    return prisma.assignment.create({
      data: {
        title: data.title,
        description: data.description,
        deadline: new Date(data.deadline),
        sessionId: data.sessionId,
      },
    });
  }

  // 4. Mahasiswa Mengirim Tugas
  async submitAssignment(data: SubmitAssignmentDto) {
    // Cek deadline
    const assignment = await prisma.assignment.findUnique({
      where: { id: data.assignmentId },
    });

    if (!assignment) throw new HttpException('Assignment not found', HttpStatus.NOT_FOUND);

    if (new Date() > assignment.deadline && !assignment.allowLate) {
      throw new HttpException('Deadline has passed', HttpStatus.FORBIDDEN);
    }

    // Cek apakah sudah pernah submit (Update or Create)
    const existing = await prisma.submission.findFirst({
      where: {
        studentId: data.studentId,
        assignmentId: data.assignmentId
      }
    });

    if (existing) {
      return prisma.submission.update({
        where: { id: existing.id },
        data: {
          fileUrl: data.fileUrl,
          textContent: data.textContent,
          submittedAt: new Date(),
        }
      });
    }

    return prisma.submission.create({
      data: {
        studentId: data.studentId,
        assignmentId: data.assignmentId,
        fileUrl: data.fileUrl,
        textContent: data.textContent,
      },
    });
  }

  // 5. Buat Kuis Lengkap dengan Soal
  async createQuiz(data: CreateQuizDto) {
    return prisma.quiz.create({
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
  
  // 6. Get Course Content (Untuk Halaman E-learning)
  async getCourseContent(kelasPerkuliahanId: number) {
    return prisma.session.findMany({
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