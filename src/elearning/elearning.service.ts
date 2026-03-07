import {
  Injectable,
  HttpException,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateSessionDto,
  CreateMaterialDto,
  CreateAssignmentDto,
  SubmitAssignmentDto,
  CreateQuizDto,
  SubmitQuizDto,
} from './dto/elearning.dto';
import { ElearningSetupMode, Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ElearningService {
  constructor(private prisma: PrismaService) {}

  /**
   * Jika kelas sudah punya ElearningClassConfig mode NEW (bukan merged)
   * tapi belum punya sesi, buat 16 sesi default secara otomatis.
   */
  private async ensureDefaultSessions(kelasPerkuliahanId: number): Promise<void> {
    const config = await this.prisma.elearningClassConfig.findUnique({
      where: { kelasPerkuliahanId },
      select: { isMergedClass: true, setupMode: true },
    });

    if (!config || config.isMergedClass || config.setupMode !== ElearningSetupMode.NEW) {
      return;
    }

    const count = await this.prisma.session.count({
      where: { kelasPerkuliahanId },
    });

    if (count > 0) return;

    await this.prisma.session.createMany({
      data: Array.from({ length: 16 }, (_, i) => ({
        title: `Pertemuan ${i + 1}`,
        weekNumber: i + 1,
        kelasPerkuliahanId,
      })),
    });
  }

  private async resolveEffectiveKelasId(kelasPerkuliahanId: number) {
    const config = await this.prisma.elearningClassConfig.findUnique({
      where: { kelasPerkuliahanId },
      select: {
        sourceKelasPerkuliahanId: true,
        isMergedClass: true,
      },
    });

    if (config?.isMergedClass && config.sourceKelasPerkuliahanId) {
      return config.sourceKelasPerkuliahanId;
    }

    return kelasPerkuliahanId;
  }

  // 1. Create Session/Meeting
  async createSession(data: CreateSessionDto, user: User) {
    if (user.role !== Role.DOSEN) {
      throw new ForbiddenException('Hanya dosen yang dapat membuat sesi pertemuan');
    }
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
      throw new HttpException(
        'File URL is required for FILE type',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (data.type === 'TEXT' && !data.content) {
      throw new HttpException(
        'Content is required for TEXT type',
        HttpStatus.BAD_REQUEST,
      );
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
  async createAssignment(data: CreateAssignmentDto, user: User) {
    if (user.role !== Role.DOSEN) {
      throw new ForbiddenException('Hanya dosen yang dapat membuat tugas');
    }
    return this.prisma.assignment.create({
      data: {
        title: data.title,
        description: data.description,
        deadline: new Date(data.deadline),
        sessionId: data.sessionId,
        kategori: data.kategori ?? 'TUGAS',
        bobot: data.bobot ?? 0,
      },
    });
  }

  // 4. Student Submits Assignment
  async submitAssignment(data: SubmitAssignmentDto, user: User) {
    if (user.role !== Role.MAHASISWA) {
      throw new ForbiddenException(
        'Hanya mahasiswa yang dapat mengumpulkan tugas.',
      );
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
        assignmentId: data.assignmentId,
      },
    });

    if (existing) {
      return this.prisma.submission.update({
        where: { id: existing.id },
        data: {
          fileUrl: data.fileUrl,
          textContent: data.textContent,
          submittedAt: new Date(),
        },
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
  async createQuiz(data: CreateQuizDto, user: User) {
    if (user.role !== Role.DOSEN) {
      throw new ForbiddenException('Hanya dosen yang dapat membuat kuis');
    }
    // Normalize gradingMethod: accept short forms from client
    const gmRaw = (data.gradingMethod ?? '').toString().toUpperCase();
    let normalizedGm: 'HIGHEST_GRADE' | 'LATEST_GRADE' | 'AVERAGE_GRADE';
    if (gmRaw === 'LATEST' || gmRaw === 'LATEST_GRADE') normalizedGm = 'LATEST_GRADE';
    else if (gmRaw === 'HIGHEST' || gmRaw === 'HIGHEST_GRADE') normalizedGm = 'HIGHEST_GRADE';
    else normalizedGm = 'AVERAGE_GRADE';

    // Validate questions and normalize fields
    if (!Array.isArray(data.questions) || data.questions.length === 0) {
      throw new BadRequestException('questions harus diisi minimal satu');
    }

    const questionsToCreate = data.questions.map((q, idx) => {
      const text = (q as any).text ?? (q as any).question;
      if (!text || typeof text !== 'string') {
        throw new BadRequestException(`Pertanyaan pada index ${idx} harus memiliki field 'text' atau 'question'`);
      }
      return {
        text: text as string,
        type: q.type,
        options: q.options ?? undefined,
        correctAnswer: q.correctAnswer ?? undefined,
        points: q.points ?? 10,
      } as any;
    });

    return this.prisma.quiz.create({
      data: {
        title: data.title,
        duration: data.duration,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        gradingMethod: normalizedGm,
        sessionId: data.sessionId,
        kategori: data.kategori ?? 'KUIS',
        bobot: data.bobot ?? 0,
        questions: { create: questionsToCreate },
      },
      include: { questions: true },
    });
  }

  // 6. Submit Quiz (Calculate Score) - NEW FEATURE
  async submitQuiz(data: SubmitQuizDto, user: User) {
    // Validation
    if (user.role !== Role.MAHASISWA) {
      throw new ForbiddenException(
        'Hanya mahasiswa yang dapat mengerjakan kuis.',
      );
    }

    // Get Quiz Data
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: data.quizId },
      include: { questions: true },
    });

    if (!quiz) throw new NotFoundException('Kuis tidak ditemukan');

    // Time validation
    const now = new Date();
    if (now < quiz.startTime) {
      throw new BadRequestException('Kuis belum dimulai');
    }
    if (now > quiz.endTime) {
      throw new BadRequestException('Waktu pengerjaan kuis sudah habis');
    }

    // Opsional: Cek apakah user sudah pernah submit (jika 1x attempt only)
    const existingAttempt = await this.prisma.quizAttempt.findFirst({
      where: { studentId: user.id, quizId: data.quizId },
    });
    if (existingAttempt) {
      throw new BadRequestException('Anda sudah mengerjakan kuis ini');
    }

    // Calculate Score
    let score = 0;
    if (data.answers && Array.isArray(data.answers)) {
      for (const answer of data.answers) {
        const question = quiz.questions.find((q) => q.id === answer.questionId);
        // If answer is correct (match key)
        if (question && question.correctAnswer === answer.answer) {
          score += question.points;
        }
      }
    }

    // Save Attempt
    return this.prisma.quizAttempt.create({
      data: {
        studentId: user.id,
        quizId: data.quizId,
        score: score,
        finishedAt: new Date(),
      },
    });
  }

  // 7. Get Course Content (For E-learning Page)
  async getCourseContent(kelasPerkuliahanId: number) {
    const effectiveKelasId = await this.resolveEffectiveKelasId(kelasPerkuliahanId);
    await this.ensureDefaultSessions(effectiveKelasId);

    return this.prisma.session.findMany({
      where: { kelasPerkuliahanId: effectiveKelasId },
      orderBy: { weekNumber: 'asc' },
      include: {
        materials: {
          where: { isHidden: false },
        },
        assignments: {
          where: { isHidden: false },
        },
        quizzes: {
          where: { isHidden: false },
        },
      },
    });
  }

  // 7b. Get Course Detail (Complete Course Information)
  async getCourseDetail(kelasPerkuliahanId: number) {
    const effectiveKelasId = await this.resolveEffectiveKelasId(kelasPerkuliahanId);
    await this.ensureDefaultSessions(effectiveKelasId);

    const kelas = await this.prisma.kelasPerkuliahan.findUnique({
      where: { id: effectiveKelasId },
      include: {
        mataKuliah: {
          select: {
            id: true,
            name: true,
            kode: true,
            sks: true,
            semester: true,
            jenisMK: true,
            deskripsi: true,
          },
        },
        dosen: {
          select: {
            id: true,
            name: true,
            nip: true,
            email: true,
            photo: true,
          },
        },
        sessions: {
          orderBy: { weekNumber: 'asc' },
          include: {
            materials: true,
            assignments: {
              include: {
                _count: {
                  select: { submissions: true },
                },
              },
            },
            quizzes: {
              include: {
                _count: {
                  select: { attempts: true },
                },
              },
            },
          },
        },
        _count: {
          select: {
            krs: true,
          },
        },
      },
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
        status: 'DISETUJUI',
      },
      include: {
        kelasPerkuliahan: true,
      },
    });

    // Flatten all classes from all approved KRS
    const allClasses = krs.flatMap((k) => k.kelasPerkuliahan);
    const kelasIds = allClasses.map((kelas) => kelas.id);

    // Return unique classes with details
    return this.prisma.kelasPerkuliahan.findMany({
      where: {
        id: { in: kelasIds },
      },
      include: {
        mataKuliah: true,
        dosen: {
          select: {
            id: true,
            name: true,
            nip: true,
            photo: true,
          },
        },
      },
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
                    nip: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment tidak ditemukan');
    }

    // Get student's submission if exists
    const submission = await this.prisma.submission.findFirst({
      where: {
        assignmentId,
        studentId,
      },
    });

    return {
      ...assignment,
      submission,
    };
  }

  // 10. Get Quiz Detail with Attempt History
  async getQuizDetail(quizId: string, studentId: number) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          select: {
            id: true,
            text: true,
            type: true,
            options: true,
            points: true,
            // correctAnswer: false
          },
        },
        attempts: {
          where: { studentId },
          orderBy: { finishedAt: 'desc' },
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
                    nip: true,
                  },
                },
              },
            },
          },
        },
      },
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
                    photo: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!material) {
      throw new NotFoundException('Material tidak ditemukan');
    }

    return material;
  }

  // elearning.service.ts
  async getAssignmentSubmissions(assignmentId: string, userId: number) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        session: {
          include: { kelasPerkuliahan: { include: { dosen: true } } },
        },
      },
    });
    if (!assignment) throw new NotFoundException('Assignment tidak ditemukan');
    if (assignment.session.kelasPerkuliahan.dosen.id !== userId) {
      throw new ForbiddenException(
        'Hanya dosen pengajar yang dapat melihat submission',
      );
    }

    const submissions = await this.prisma.submission.findMany({
      where: { assignmentId },
      include: {
        student: {
          select: { id: true, nim: true, name: true, email: true, photo: true },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return submissions;
  }

  async gradeSubmission(
    submissionId: string,
    dto: { grade: string | number; feedback?: string },
    userId: number,
  ) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          include: {
            session: {
              include: { kelasPerkuliahan: { include: { dosen: true } } },
            },
          },
        },
      },
    });
    if (!submission) throw new NotFoundException('Submission tidak ditemukan');
    if (submission.assignment.session.kelasPerkuliahan.dosen.id !== userId) {
      throw new ForbiddenException(
        'Hanya dosen pengajar yang dapat memberi nilai',
      );
    }

    const gradeValue =
      typeof dto.grade === 'number' ? dto.grade : parseFloat(dto.grade);

    return this.prisma.submission.update({
      where: { id: submissionId },
      data: { grade: gradeValue, feedback: dto.feedback ?? null },
    });
  }

  async getQuizAttempts(quizId: string, userId: number) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        session: {
          include: { kelasPerkuliahan: { include: { dosen: true } } },
        },
      },
    });
    if (!quiz) throw new NotFoundException('Quiz tidak ditemukan');
    if (quiz.session.kelasPerkuliahan.dosen.id !== userId) {
      throw new ForbiddenException(
        'Hanya dosen pengajar yang dapat melihat hasil quiz',
      );
    }

    return this.prisma.quizAttempt.findMany({
      where: { quizId },
      include: {
        student: {
          select: { id: true, nim: true, name: true, email: true, photo: true },
        },
      },
      orderBy: { finishedAt: 'desc' },
    });
  }

  // OPTIONAL
  async getSubmissionDetail(submissionId: string) {
    return this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        student: {
          select: { id: true, nim: true, name: true, email: true, photo: true },
        },
        assignment: true,
      },
    });
  }

  async getLecturerCourses(userId: number) {
    return this.prisma.kelasPerkuliahan.findMany({
      where: { dosenId: userId },
      include: {
        mataKuliah: true,
        elearningConfig: true,
        _count: { select: { krs: true, sessions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================================
  // 14. STUDENT: Daftar peserta (participants) di suatu kelas
  // GET /elearning/kelas/:kelasId/participants (mahasiswa)
  // ============================================================
  async getStudentParticipants(kelasId: number, studentId: number) {
    // Verify student is enrolled (KRS DISETUJUI)
    const enrolled = await this.prisma.kRS.findFirst({
      where: {
        mahasiswaId: studentId,
        status: 'DISETUJUI',
        kelasPerkuliahan: { some: { id: kelasId } },
      },
    });
    if (!enrolled)
      throw new ForbiddenException('Anda tidak terdaftar di kelas ini');

    const kelas = await this.prisma.kelasPerkuliahan.findUnique({
      where: { id: kelasId },
      include: {
        mataKuliah: { select: { kode: true, name: true, sks: true } },
        dosen: { select: { id: true, name: true, nip: true, photo: true } },
        krs: {
          where: { status: 'DISETUJUI' },
          include: {
            mahasiswa: {
              select: { id: true, name: true, nim: true, photo: true },
            },
          },
        },
      },
    });
    if (!kelas) throw new NotFoundException('Kelas tidak ditemukan');

    const mahasiswaMap = new Map<number, { id: number; name: string; nim: string | null; photo: string | null }>();
    for (const krs of kelas.krs) {
      if (!mahasiswaMap.has(krs.mahasiswa.id))
        mahasiswaMap.set(krs.mahasiswa.id, krs.mahasiswa);
    }
    const peserta = Array.from(mahasiswaMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    return {
      kelasId: kelas.id,
      namaKelas: kelas.nama,
      kodeMK: kelas.mataKuliah.kode,
      namaMK: kelas.mataKuliah.name,
      sks: kelas.mataKuliah.sks,
      academicYear: kelas.academicYear,
      dosen: kelas.dosen,
      totalPeserta: peserta.length,
      peserta,
    };
  }

  // ============================================================
  // 15. STUDENT: Nilai & ranking diri sendiri di suatu kelas
  // GET /elearning/kelas/:kelasId/my-grades (mahasiswa)
  // ============================================================
  async getMyGrades(kelasId: number, studentId: number) {
    // Verify enrollment
    const enrolled = await this.prisma.kRS.findFirst({
      where: {
        mahasiswaId: studentId,
        status: 'DISETUJUI',
        kelasPerkuliahan: { some: { id: kelasId } },
      },
    });
    if (!enrolled)
      throw new ForbiddenException('Anda tidak terdaftar di kelas ini');

    const kelas = await this.prisma.kelasPerkuliahan.findUnique({
      where: { id: kelasId },
      include: {
        mataKuliah: { select: { kode: true, name: true, sks: true } },
        dosen: { select: { id: true, name: true } },
        krs: {
          where: { status: 'DISETUJUI' },
          include: { mahasiswa: { select: { id: true } } },
        },
      },
    });
    if (!kelas) throw new NotFoundException('Kelas tidak ditemukan');

    const effectiveKelasId = await this.resolveEffectiveKelasId(kelasId);

    const sessions = await this.prisma.session.findMany({
      where: { kelasPerkuliahanId: effectiveKelasId },
      orderBy: { weekNumber: 'asc' },
      include: {
        assignments: {
          where: { isHidden: false },
          include: {
            submissions: {
              where: { studentId },
              select: { grade: true, feedback: true, submittedAt: true, fileUrl: true, textContent: true },
            },
          },
        },
        quizzes: {
          where: { isHidden: false },
          include: {
            questions: { select: { points: true } },
            attempts: {
              where: { studentId },
              orderBy: { finishedAt: 'desc' },
              select: { score: true, finishedAt: true },
            },
          },
        },
      },
    });

    // Build per-item grade details
    const detailTugas = sessions.flatMap((s) =>
      s.assignments.map((a) => {
        const sub = a.submissions[0] ?? null;
        const kontribusi =
          sub?.grade != null && a.bobot > 0
            ? parseFloat(((sub.grade * a.bobot) / 100).toFixed(2))
            : 0;
        return {
          id: a.id,
          title: a.title,
          kategori: a.kategori,
          bobot: a.bobot,
          deadline: a.deadline,
          pertemuan: s.weekNumber,
          submitted: !!sub,
          nilai: sub?.grade ?? null,
          feedback: sub?.feedback ?? null,
          submittedAt: sub?.submittedAt ?? null,
          kontribusi,
        };
      }),
    );

    const detailKuis = sessions.flatMap((s) =>
      s.quizzes.map((q) => {
        const maxPoints = q.questions.reduce((sum, qq) => sum + qq.points, 0);
        // Best attempt among student's attempts
        const bestAttempt = q.attempts.reduce<{ score: number | null; finishedAt: Date | null }>(
          (best, at) => (at.score ?? 0) > (best.score ?? -1) ? { score: at.score, finishedAt: at.finishedAt } : best,
          { score: null, finishedAt: null },
        );
        const scorePercent =
          bestAttempt.score != null && maxPoints > 0
            ? parseFloat(((bestAttempt.score / maxPoints) * 100).toFixed(2))
            : null;
        const kontribusi =
          scorePercent != null && q.bobot > 0
            ? parseFloat(((scorePercent * q.bobot) / 100).toFixed(2))
            : 0;
        return {
          id: q.id,
          title: q.title,
          kategori: q.kategori,
          bobot: q.bobot,
          maxPoints,
          pertemuan: s.weekNumber,
          attempted: q.attempts.length > 0,
          score: bestAttempt.score,
          scorePercentage: scorePercent,
          finishedAt: bestAttempt.finishedAt,
          kontribusi,
        };
      }),
    );

    const totalNilai = parseFloat(
      [...detailTugas.map((d) => d.kontribusi), ...detailKuis.map((d) => d.kontribusi)]
        .reduce((s, v) => s + v, 0)
        .toFixed(2),
    );

    const totalBobot = [
      ...sessions.flatMap((s) => s.assignments.map((a) => a.bobot)),
      ...sessions.flatMap((s) => s.quizzes.map((q) => q.bobot)),
    ].reduce((s, b) => s + b, 0);

    // Calculate ranking among all enrolled students
    const mahasiswaIds = Array.from(
      new Set(kelas.krs.flatMap((k) => k.mahasiswa.id)),
    );

    // Get all submissions + attempts for all students to compute rank
    const allSubmissions = await this.prisma.submission.findMany({
      where: {
        assignment: {
          session: { kelasPerkuliahanId: effectiveKelasId },
          isHidden: false,
        },
        studentId: { in: mahasiswaIds },
      },
      select: { studentId: true, grade: true, assignmentId: true },
    });
    const allAttempts = await this.prisma.quizAttempt.findMany({
      where: {
        quiz: {
          session: { kelasPerkuliahanId: effectiveKelasId },
          isHidden: false,
        },
        studentId: { in: mahasiswaIds },
      },
      select: { studentId: true, score: true, quizId: true },
    });

    // Assignment bobot map
    const assignmentBobotMap = new Map(
      sessions.flatMap((s) => s.assignments.map((a) => [a.id, a.bobot])),
    );
    // Quiz bobot + maxPoints map
    const quizInfoMap = new Map(
      sessions.flatMap((s) =>
        s.quizzes.map((q) => [
          q.id,
          { bobot: q.bobot, maxPoints: q.questions.reduce((sum, qq) => sum + qq.points, 0) },
        ]),
      ),
    );

    const studentTotals = mahasiswaIds.map((mhsId) => {
      let total = 0;
      for (const sub of allSubmissions.filter((x) => x.studentId === mhsId)) {
        const bobot = assignmentBobotMap.get(sub.assignmentId) ?? 0;
        if (sub.grade != null && bobot > 0) total += (sub.grade * bobot) / 100;
      }
      // Best attempt per quiz
      const attemptsGrouped = new Map<string, number>();
      for (const at of allAttempts.filter((x) => x.studentId === mhsId)) {
        const prev = attemptsGrouped.get(at.quizId) ?? -1;
        if ((at.score ?? 0) > prev) attemptsGrouped.set(at.quizId, at.score ?? 0);
      }
      for (const [qId, score] of attemptsGrouped) {
        const info = quizInfoMap.get(qId);
        if (info && info.maxPoints > 0 && info.bobot > 0)
          total += (score / info.maxPoints) * 100 * info.bobot / 100;
      }
      return { id: mhsId, total: parseFloat(total.toFixed(2)) };
    });

    studentTotals.sort((a, b) => b.total - a.total);
    const myRank = studentTotals.findIndex((s) => s.id === studentId) + 1;

    return {
      kelasId: kelas.id,
      namaKelas: kelas.nama,
      kodeMK: kelas.mataKuliah.kode,
      namaMK: kelas.mataKuliah.name,
      sks: kelas.mataKuliah.sks,
      academicYear: kelas.academicYear,
      dosenNama: kelas.dosen.name,
      totalBobot,
      totalNilai,
      peringkat: myRank,
      totalPeserta: mahasiswaIds.length,
      catatan: totalBobot !== 100 ? `Total bobot ${totalBobot}% (belum mencapai 100%)` : null,
      detailTugas,
      detailKuis,
    };
  }

  // GET /elearning/kelas/:kelasId/participation
  // ============================================================
  async getParticipation(kelasId: number, userId: number) {
    const kelas = await this.prisma.kelasPerkuliahan.findUnique({
      where: { id: kelasId },
      include: {
        mataKuliah: { select: { id: true, kode: true, name: true } },
        dosen: { select: { id: true, name: true } },
        krs: {
          where: { status: 'DISETUJUI' },
          include: {
            mahasiswa: { select: { id: true, name: true, nim: true } },
          },
        },
      },
    });
    if (!kelas) throw new NotFoundException('Kelas tidak ditemukan');
    if (kelas.dosenId !== userId)
      throw new ForbiddenException('Hanya dosen pengampu yang dapat melihat partisipasi');

    const effectiveKelasId = await this.resolveEffectiveKelasId(kelasId);

    // Collect unique enrolled students
    const mahasiswaMap = new Map<number, { id: number; name: string; nim: string | null }>();
    for (const krs of kelas.krs) {
      if (!mahasiswaMap.has(krs.mahasiswa.id)) mahasiswaMap.set(krs.mahasiswa.id, krs.mahasiswa);
    }
    const mahasiswaList = Array.from(mahasiswaMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    // Get all sessions with assignments and quizzes (including bobot/kategori)
    const sessions = await this.prisma.session.findMany({
      where: { kelasPerkuliahanId: effectiveKelasId },
      orderBy: { weekNumber: 'asc' },
      include: {
        assignments: {
          where: { isHidden: false },
          include: {
            submissions: {
              select: { studentId: true, grade: true, submittedAt: true },
            },
          },
        },
        quizzes: {
          where: { isHidden: false },
          include: {
            questions: { select: { points: true } },
            attempts: {
              select: { studentId: true, score: true, finishedAt: true },
            },
          },
        },
      },
    });

    // Build assignment participation list
    const assignmentItems = sessions.flatMap((s) =>
      s.assignments.map((a) => {
        const submissionMap = new Map(a.submissions.map((sub) => [sub.studentId, sub]));
        return {
          id: a.id,
          title: a.title,
          kategori: a.kategori,
          bobot: a.bobot,
          deadline: a.deadline,
          pertemuan: s.weekNumber,
          totalMahasiswaTerdaftar: mahasiswaList.length,
          totalSubmitted: a.submissions.length,
          partisipasi: mahasiswaList.map((mhs) => {
            const sub = submissionMap.get(mhs.id);
            return {
              mahasiswaId: mhs.id,
              nama: mhs.name,
              nim: mhs.nim ?? '-',
              submitted: !!sub,
              nilai: sub?.grade ?? null,
              submittedAt: sub?.submittedAt ?? null,
            };
          }),
        };
      }),
    );

    // Build quiz participation list
    const quizItems = sessions.flatMap((s) =>
      s.quizzes.map((q) => {
        const maxPoints = q.questions.reduce((sum, qq) => sum + qq.points, 0);
        const attemptMap = new Map(q.attempts.map((at) => [at.studentId, at]));
        return {
          id: q.id,
          title: q.title,
          kategori: q.kategori,
          bobot: q.bobot,
          startTime: q.startTime,
          endTime: q.endTime,
          maxPoints,
          pertemuan: s.weekNumber,
          totalMahasiswaTerdaftar: mahasiswaList.length,
          totalAttempted: q.attempts.length,
          partisipasi: mahasiswaList.map((mhs) => {
            const at = attemptMap.get(mhs.id);
            const scorePercent =
              at?.score != null && maxPoints > 0
                ? parseFloat(((at.score / maxPoints) * 100).toFixed(2))
                : null;
            return {
              mahasiswaId: mhs.id,
              nama: mhs.name,
              nim: mhs.nim ?? '-',
              attempted: !!at,
              score: at?.score ?? null,
              scorePercentage: scorePercent,
              finishedAt: at?.finishedAt ?? null,
            };
          }),
        };
      }),
    );

    return {
      kelasId: kelas.id,
      namaKelas: kelas.nama,
      kodeMK: kelas.mataKuliah.kode,
      namaMK: kelas.mataKuliah.name,
      academicYear: kelas.academicYear,
      dosenNama: kelas.dosen.name,
      totalMahasiswa: mahasiswaList.length,
      tugas: assignmentItems,
      kuis: quizItems,
    };
  }

  // ============================================================
  // 13. RANKING: Peringkat mahasiswa berdasarkan total nilai
  // GET /elearning/kelas/:kelasId/ranking
  // ============================================================
  async getRanking(kelasId: number, userId: number) {
    const kelas = await this.prisma.kelasPerkuliahan.findUnique({
      where: { id: kelasId },
      include: {
        mataKuliah: { select: { id: true, kode: true, name: true } },
        dosen: { select: { id: true, name: true } },
        krs: {
          where: { status: 'DISETUJUI' },
          include: {
            mahasiswa: { select: { id: true, name: true, nim: true } },
          },
        },
      },
    });
    if (!kelas) throw new NotFoundException('Kelas tidak ditemukan');
    if (kelas.dosenId !== userId)
      throw new ForbiddenException('Hanya dosen pengampu yang dapat melihat ranking');

    const effectiveKelasId = await this.resolveEffectiveKelasId(kelasId);

    const mahasiswaMap = new Map<number, { id: number; name: string; nim: string | null }>();
    for (const krs of kelas.krs) {
      if (!mahasiswaMap.has(krs.mahasiswa.id)) mahasiswaMap.set(krs.mahasiswa.id, krs.mahasiswa);
    }

    // Load all assignments + submissions for this kelas
    const sessions = await this.prisma.session.findMany({
      where: { kelasPerkuliahanId: effectiveKelasId },
      include: {
        assignments: {
          where: { isHidden: false },
          include: {
            submissions: { select: { studentId: true, grade: true } },
          },
        },
        quizzes: {
          where: { isHidden: false },
          include: {
            questions: { select: { points: true } },
            attempts: { select: { studentId: true, score: true } },
          },
        },
      },
    });

    const allAssignments = sessions.flatMap((s) => s.assignments);
    const allQuizzes = sessions.flatMap((s) => s.quizzes);

    // Pre-index: submissionMap[assignmentId][studentId] = grade
    const submissionIndex = new Map<string, Map<number, number | null>>();
    for (const a of allAssignments) {
      const sm = new Map<number, number | null>(a.submissions.map((sub) => [sub.studentId, sub.grade]));
      submissionIndex.set(a.id, sm);
    }

    // Pre-index: quizAttemptIndex[quizId][studentId] = best score percentage
    const quizAttemptIndex = new Map<string, Map<number, number>>();
    for (const q of allQuizzes) {
      const maxPoints = q.questions.reduce((sum, qq) => sum + qq.points, 0);
      const am = new Map<number, number>();
      for (const at of q.attempts) {
        const scorePercent = maxPoints > 0 ? (at.score ?? 0) / maxPoints * 100 : 0;
        const prev = am.get(at.studentId);
        if (prev === undefined || scorePercent > prev) am.set(at.studentId, scorePercent);
      }
      quizAttemptIndex.set(q.id, am);
    }

    // Calculate total weighted score per student
    const totalBobot = [
      ...allAssignments.map((a) => a.bobot),
      ...allQuizzes.map((q) => q.bobot),
    ].reduce((s, b) => s + b, 0);

    const ranking = Array.from(mahasiswaMap.values()).map((mhs) => {
      let totalNilai = 0;
      const detailTugas: { id: string; title: string; kategori: string; bobot: number; nilai: number | null; kontribusi: number }[] = [];
      const detailKuis: { id: string; title: string; kategori: string; bobot: number; scorePercentage: number | null; kontribusi: number }[] = [];

      for (const a of allAssignments) {
        const grade = submissionIndex.get(a.id)?.get(mhs.id) ?? null;
        const kontribusi = grade != null && a.bobot > 0 ? parseFloat(((grade * a.bobot) / 100).toFixed(2)) : 0;
        totalNilai += kontribusi;
        detailTugas.push({ id: a.id, title: a.title, kategori: a.kategori, bobot: a.bobot, nilai: grade, kontribusi });
      }

      for (const q of allQuizzes) {
        const scorePercent = quizAttemptIndex.get(q.id)?.get(mhs.id) ?? null;
        const kontribusi = scorePercent != null && q.bobot > 0 ? parseFloat(((scorePercent * q.bobot) / 100).toFixed(2)) : 0;
        totalNilai += kontribusi;
        detailKuis.push({ id: q.id, title: q.title, kategori: q.kategori, bobot: q.bobot, scorePercentage: scorePercent != null ? parseFloat(scorePercent.toFixed(2)) : null, kontribusi });
      }

      return {
        mahasiswaId: mhs.id,
        nama: mhs.name,
        nim: mhs.nim ?? '-',
        totalNilai: parseFloat(totalNilai.toFixed(2)),
        detailTugas,
        detailKuis,
      };
    });

    // Sort by totalNilai descending, assign rank
    ranking.sort((a, b) => b.totalNilai - a.totalNilai);
    const rankedList = ranking.map((r, idx) => ({ rank: idx + 1, ...r }));

    return {
      kelasId: kelas.id,
      namaKelas: kelas.nama,
      kodeMK: kelas.mataKuliah.kode,
      namaMK: kelas.mataKuliah.name,
      academicYear: kelas.academicYear,
      dosenNama: kelas.dosen.name,
      totalBobot,
      catatan: totalBobot !== 100 ? `Total bobot saat ini ${totalBobot}% (disarankan 100%)` : null,
      ranking: rankedList,
    };
  }
}
