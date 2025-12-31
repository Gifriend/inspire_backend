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
  
  // 1. Create Session/Meeting
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

  // 2. Upload Material (Text, File, or Hybrid)
  async createMaterial(data: CreateMaterialDto, user: User) {
    // Validate Role
    if (user.role === Role.MAHASISWA) {
      throw new ForbiddenException('Mahasiswa tidak dapat membuat materi');
    }

    // Validate data
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

  // 3. Create Assignment
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

  // 4. Student Submits Assignment
  async submitAssignment(data: SubmitAssignmentDto, user: User) {
    if (user.role !== Role.MAHASISWA) {
      throw new ForbiddenException('Hanya mahasiswa yang dapat mengumpulkan tugas.');
    }

    // Check deadline
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: data.assignmentId },
    });

    if (!assignment) throw new NotFoundException('Assignment not found');

    if (new Date() > assignment.deadline && !assignment.allowLate) {
      throw new BadRequestException('Deadline has passed');
    }

    // Check if already submitted (Update or Create)
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

  // 5. Create Quiz Complete with Questions
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
            options: q.options, // Prisma automatically handles JSON
            correctAnswer: q.correctAnswer,
            points: q.points
          }))
        }
      },
      include: { questions: true }
    });
  }

  // 6. Submit Quiz (Calculate Score) - NEW FEATURE
  async submitQuiz(data: any, user: User) {
    // 1. Validation
    if (user.role !== Role.MAHASISWA) {
      throw new ForbiddenException('Hanya mahasiswa yang dapat mengerjakan kuis.');
    }

    // 2. Get Quiz Data
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: data.quizId },
      include: { questions: true }
    });

    if (!quiz) throw new NotFoundException('Kuis tidak ditemukan');

    // 3. Calculate Score
    let score = 0;
    if (data.answers && Array.isArray(data.answers)) {
      for (const answer of data.answers) {
        const question = quiz.questions.find(q => q.id === answer.questionId);
        // If answer is correct (match key)
        if (question && question.correctAnswer === answer.answer) {
          score += question.points;
        }
      }
    }

    // 4. Save Attempt
    return this.prisma.quizAttempt.create({
      data: {
        studentId: user.id,
        quizId: data.quizId,
        score: score,
        finishedAt: new Date()
      }
    });
  }
  
  // 7. Get Course Content (For E-learning Page)
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

  // 7b. Get Course Detail (Complete Course Information)
  async getCourseDetail(kelasPerkuliahanId: number) {
    const kelas = await this.prisma.kelasPerkuliahan.findUnique({
      where: { id: kelasPerkuliahanId },
      include: {
        mataKuliah: {
          select: {
            id: true,
            name: true,
            kode: true,
            sks: true,
            semester: true,
            jenisMK: true,
            deskripsi: true
          }
        },
        dosen: {
          select: {
            id: true,
            name: true,
            nip: true,
            email: true,
            photo: true
          }
        },
        sessions: {
          orderBy: { weekNumber: 'asc' },
          include: {
            materials: true,
            assignments: {
              include: {
                _count: {
                  select: { submissions: true }
                }
              }
            },
            quizzes: {
              include: {
                _count: {
                  select: { attempts: true }
                }
              }
            }
          }
        },
        _count: {
          select: {
            krs: true
          }
        }
      }
    });

    if (!kelas) {
      throw new NotFoundException('Kelas perkuliahan tidak ditemukan');
    }

    return kelas;
  }

  // 8. Get Student's Enrolled Courses
  async getStudentCourses(studentId: number) {
    // Get approved KRS to find enrolled classes
    const krs = await this.prisma.kRS.findMany({
      where: {
        mahasiswaId: studentId,
        status: 'DISETUJUI'
      },
      select: {
        kelasPerkuliahanId: true
      }
    });

    const kelasIds = krs
      .map(k => k.kelasPerkuliahanId)
      .filter((id): id is number => id !== null);

    return this.prisma.kelasPerkuliahan.findMany({
      where: {
        id: { in: kelasIds }
      },
      include: {
        mataKuliah: true,
        dosen: {
          select: {
            id: true,
            name: true,
            nip: true,
            photo: true
          }
        }
      }
    });
  }

  // 9. Get Assignment Detail with Submission Status
  async getAssignmentDetail(assignmentId: string, studentId: number) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        session: {
          include: {
            kelasPerkuliahan: {
              include: {
                mataKuliah: true,
                dosen: {
                  select: {
                    id: true,
                    name: true,
                    nip: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!assignment) {
      throw new NotFoundException('Assignment tidak ditemukan');
    }

    // Get student's submission if exists
    const submission = await this.prisma.submission.findFirst({
      where: {
        assignmentId,
        studentId
      }
    });

    return {
      ...assignment,
      submission
    };
  }

  // 10. Get Quiz Detail with Attempt History
  async getQuizDetail(quizId: string, studentId: number) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: true,
        attempts: {
          where: { studentId },
          orderBy: { startedAt: 'desc' }
        },
        session: {
          include: {
            kelasPerkuliahan: {
              include: {
                mataKuliah: true,
                dosen: {
                  select: {
                    id: true,
                    name: true,
                    nip: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!quiz) {
      throw new NotFoundException('Quiz tidak ditemukan');
    }

    return quiz;
  }

  // 11. Get Material Detail
  async getMaterialDetail(materialId: string) {
    const material = await this.prisma.material.findUnique({
      where: { id: materialId },
      include: {
        session: {
          include: {
            kelasPerkuliahan: {
              include: {
                mataKuliah: true,
                dosen: {
                  select: {
                    id: true,
                    name: true,
                    nip: true,
                    photo: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!material) {
      throw new NotFoundException('Material tidak ditemukan');
    }

    return material;
  }
}