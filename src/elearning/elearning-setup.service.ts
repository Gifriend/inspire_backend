import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ElearningEntityTypeDto,
  ElearningSetupModeDto,
  MergeElearningClassesDto,
  SetupElearningClassDto,
  ToggleElearningVisibilityDto,
} from './dto/elearning-setup.dto';

@Injectable()
export class ElearningSetupService {
  constructor(private readonly prisma: PrismaService) {}

  private async findClassOrThrow(kelasPerkuliahanId: number) {
    const kelas = await this.prisma.kelasPerkuliahan.findUnique({
      where: { id: kelasPerkuliahanId },
      include: { mataKuliah: true },
    });

    if (!kelas) {
      throw new NotFoundException('Kelas perkuliahan tidak ditemukan');
    }

    return kelas;
  }

  private async validateLecturerClassOwnership(
    kelasPerkuliahanId: number,
    userId: number,
  ) {
    const kelas = await this.findClassOrThrow(kelasPerkuliahanId);

    if (kelas.dosenId !== userId) {
      throw new ForbiddenException('Anda bukan dosen pengampu kelas ini');
    }

    return kelas;
  }

  private async canManageSharedSourceClass(kelasPerkuliahanId: number, userId: number) {
    const directlyOwned = await this.prisma.kelasPerkuliahan.findFirst({
      where: {
        id: kelasPerkuliahanId,
        dosenId: userId,
      },
      select: { id: true },
    });

    if (directlyOwned) return true;

    const viaMergedClass = await this.prisma.elearningClassConfig.findFirst({
      where: {
        sourceKelasPerkuliahanId: kelasPerkuliahanId,
        kelasPerkuliahan: {
          dosenId: userId,
        },
      },
      select: { id: true },
    });

    return !!viaMergedClass;
  }

  private async cloneElearningContent(
    tx: Prisma.TransactionClient,
    sourceKelasPerkuliahanId: number,
    targetKelasPerkuliahanId: number,
    isHidden = true,
  ) {
    const sourceSessions = await tx.session.findMany({
      where: { kelasPerkuliahanId: sourceKelasPerkuliahanId },
      include: {
        materials: true,
        assignments: true,
        quizzes: {
          include: {
            questions: true,
          },
        },
      },
      orderBy: { weekNumber: 'asc' },
    });

    for (const sourceSession of sourceSessions) {
      await tx.session.create({
        data: {
          title: sourceSession.title,
          description: sourceSession.description,
          weekNumber: sourceSession.weekNumber,
          kelasPerkuliahanId: targetKelasPerkuliahanId,
          materials: {
            create: sourceSession.materials.map((material) => ({
              title: material.title,
              type: material.type,
              content: material.content,
              fileUrl: material.fileUrl,
              isHidden,
            })),
          },
          assignments: {
            create: sourceSession.assignments.map((assignment) => ({
              title: assignment.title,
              description: assignment.description,
              fileUrl: assignment.fileUrl,
              deadline: assignment.deadline,
              allowLate: assignment.allowLate,
              isHidden,
            })),
          },
          quizzes: {
            create: sourceSession.quizzes.map((quiz) => ({
              title: quiz.title,
              description: quiz.description,
              duration: quiz.duration,
              startTime: quiz.startTime,
              endTime: quiz.endTime,
              gradingMethod: quiz.gradingMethod,
              isHidden,
              questions: {
                create: quiz.questions.map((question) => ({
                  text: question.text,
                  type: question.type,
                  options: question.options ?? Prisma.JsonNull,
                  correctAnswer: question.correctAnswer,
                  points: question.points,
                })),
              },
            })),
          },
        },
      });
    }

    return sourceSessions.length;
  }

  async setupClass(dto: SetupElearningClassDto, user: { id: number; role: Role }) {
    if (user.role !== Role.DOSEN) {
      throw new ForbiddenException('Hanya dosen yang dapat mengatur e-learning kelas');
    }

    const targetClass = await this.validateLecturerClassOwnership(
      dto.kelasPerkuliahanId,
      user.id,
    );

    if (dto.setupMode === ElearningSetupModeDto.EXISTING && !dto.sourceKelasPerkuliahanId) {
      throw new BadRequestException('sourceKelasPerkuliahanId wajib diisi untuk mode EXISTING');
    }

    const sourceClassId = dto.sourceKelasPerkuliahanId ?? null;
    const isMergedClass = dto.isMergedClass ?? false;
    const cloneContentAsHidden = dto.cloneContentAsHidden ?? true;

    if (dto.setupMode === ElearningSetupModeDto.EXISTING && sourceClassId === dto.kelasPerkuliahanId) {
      throw new BadRequestException('Kelas sumber tidak boleh sama dengan kelas target');
    }

    let sourceClass: Awaited<
      ReturnType<typeof this.prisma.kelasPerkuliahan.findUnique>
    > | null = null;

    if (sourceClassId) {
      sourceClass = await this.findClassOrThrow(sourceClassId);
      if (sourceClass.mataKuliahId !== targetClass.mataKuliahId) {
        throw new BadRequestException(
          'Kelas sumber harus berada pada mata kuliah yang sama',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const existingTargetSessionCount = await tx.session.count({
        where: { kelasPerkuliahanId: dto.kelasPerkuliahanId },
      });

      const config = await tx.elearningClassConfig.upsert({
        where: { kelasPerkuliahanId: dto.kelasPerkuliahanId },
        update: {
          setupMode: dto.setupMode,
          sourceKelasPerkuliahanId: sourceClassId,
          isMergedClass,
          createdByDosenId: user.id,
        },
        create: {
          kelasPerkuliahanId: dto.kelasPerkuliahanId,
          setupMode: dto.setupMode,
          sourceKelasPerkuliahanId: sourceClassId,
          isMergedClass,
          createdByDosenId: user.id,
        },
      });

      let clonedSessionCount = 0;
      const shouldClone =
        dto.setupMode === ElearningSetupModeDto.EXISTING &&
        !isMergedClass &&
        !!sourceClassId;

      if (shouldClone) {
        if (existingTargetSessionCount > 0) {
          throw new BadRequestException(
            'Kelas target sudah memiliki konten e-learning. Kosongkan terlebih dahulu sebelum clone.',
          );
        }

        clonedSessionCount = await this.cloneElearningContent(
          tx,
          sourceClassId,
          dto.kelasPerkuliahanId,
          cloneContentAsHidden,
        );
      }

      return {
        message: 'Pengaturan e-learning kelas berhasil disimpan',
        config,
        clonedSessionCount,
      };
    });
  }

  async mergeClasses(dto: MergeElearningClassesDto, user: { id: number; role: Role }) {
    if (user.role !== Role.DOSEN) {
      throw new ForbiddenException('Hanya dosen yang dapat menggabungkan kelas');
    }

    const memberIds = dto.memberKelasPerkuliahanIds.filter(
      (kelasId) => kelasId !== dto.masterKelasPerkuliahanId,
    );

    if (!memberIds.length) {
      throw new BadRequestException('Minimal satu kelas anggota harus dipilih');
    }

    const allClassIds = [dto.masterKelasPerkuliahanId, ...memberIds];
    const allClasses = await this.prisma.kelasPerkuliahan.findMany({
      where: {
        id: {
          in: allClassIds,
        },
      },
      select: {
        id: true,
        nama: true,
        mataKuliahId: true,
        dosenId: true,
      },
    });

    if (allClasses.length !== allClassIds.length) {
      throw new NotFoundException('Sebagian kelas tidak ditemukan');
    }

    const masterClass = allClasses.find(
      (kelas) => kelas.id === dto.masterKelasPerkuliahanId,
    );

    if (!masterClass) {
      throw new NotFoundException('Kelas master tidak ditemukan');
    }

    const requesterOwnsAnyClass = allClasses.some(
      (kelas) => kelas.dosenId === user.id,
    );

    if (!requesterOwnsAnyClass) {
      throw new ForbiddenException(
        'Anda harus menjadi dosen pengampu minimal satu kelas yang akan digabung',
      );
    }

    for (const kelas of allClasses) {
      if (kelas.mataKuliahId !== masterClass.mataKuliahId) {
        throw new BadRequestException(
          `Kelas ${kelas.nama} tidak berada pada mata kuliah yang sama`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.elearningClassConfig.upsert({
        where: { kelasPerkuliahanId: dto.masterKelasPerkuliahanId },
        update: {
          setupMode: ElearningSetupModeDto.NEW,
          sourceKelasPerkuliahanId: null,
          isMergedClass: false,
          createdByDosenId: user.id,
        },
        create: {
          kelasPerkuliahanId: dto.masterKelasPerkuliahanId,
          setupMode: ElearningSetupModeDto.NEW,
          isMergedClass: false,
          createdByDosenId: user.id,
        },
      });

      for (const memberId of memberIds) {
        await tx.elearningClassConfig.upsert({
          where: { kelasPerkuliahanId: memberId },
          update: {
            setupMode: ElearningSetupModeDto.EXISTING,
            sourceKelasPerkuliahanId: dto.masterKelasPerkuliahanId,
            isMergedClass: true,
            createdByDosenId: user.id,
          },
          create: {
            kelasPerkuliahanId: memberId,
            setupMode: ElearningSetupModeDto.EXISTING,
            sourceKelasPerkuliahanId: dto.masterKelasPerkuliahanId,
            isMergedClass: true,
            createdByDosenId: user.id,
          },
        });
      }

      return {
        message: 'Penggabungan kelas e-learning berhasil disimpan',
        masterKelasPerkuliahanId: dto.masterKelasPerkuliahanId,
        mergedClassIds: memberIds,
      };
    });
  }

  async unmergeClass(kelasPerkuliahanId: number, user: { id: number; role: Role }) {
    if (user.role !== Role.DOSEN) {
      throw new ForbiddenException('Hanya dosen yang dapat memisahkan kelas');
    }

    await this.validateLecturerClassOwnership(kelasPerkuliahanId, user.id);

    const config = await this.prisma.elearningClassConfig.findUnique({
      where: { kelasPerkuliahanId },
    });

    if (!config || !config.isMergedClass) {
      throw new BadRequestException('Kelas ini tidak sedang dalam mode gabung');
    }

    return this.prisma.elearningClassConfig.update({
      where: { kelasPerkuliahanId },
      data: {
        setupMode: ElearningSetupModeDto.NEW,
        sourceKelasPerkuliahanId: null,
        isMergedClass: false,
        createdByDosenId: user.id,
      },
    });
  }

  async toggleVisibility(
    dto: ToggleElearningVisibilityDto,
    user: { id: number; role: Role },
  ) {
    if (user.role !== Role.DOSEN) {
      throw new ForbiddenException('Hanya dosen yang dapat mengatur visibilitas konten');
    }

    if (dto.entityType === ElearningEntityTypeDto.MATERIAL) {
      const material = await this.prisma.material.findUnique({
        where: { id: dto.entityId },
        include: {
          session: {
            include: {
              kelasPerkuliahan: true,
            },
          },
        },
      });

      if (!material) throw new NotFoundException('Material tidak ditemukan');
      const canManage = await this.canManageSharedSourceClass(
        material.session.kelasPerkuliahan.id,
        user.id,
      );

      if (!canManage) {
        throw new ForbiddenException('Anda tidak memiliki akses ke material ini');
      }

      return this.prisma.material.update({
        where: { id: dto.entityId },
        data: { isHidden: dto.isHidden },
      });
    }

    if (dto.entityType === ElearningEntityTypeDto.ASSIGNMENT) {
      const assignment = await this.prisma.assignment.findUnique({
        where: { id: dto.entityId },
        include: {
          session: {
            include: {
              kelasPerkuliahan: true,
            },
          },
        },
      });

      if (!assignment) throw new NotFoundException('Tugas tidak ditemukan');
      const canManage = await this.canManageSharedSourceClass(
        assignment.session.kelasPerkuliahan.id,
        user.id,
      );

      if (!canManage) {
        throw new ForbiddenException('Anda tidak memiliki akses ke tugas ini');
      }

      return this.prisma.assignment.update({
        where: { id: dto.entityId },
        data: { isHidden: dto.isHidden },
      });
    }

    const quiz = await this.prisma.quiz.findUnique({
      where: { id: dto.entityId },
      include: {
        session: {
          include: {
            kelasPerkuliahan: true,
          },
        },
      },
    });

    if (!quiz) throw new NotFoundException('Quiz tidak ditemukan');
    const canManage = await this.canManageSharedSourceClass(
      quiz.session.kelasPerkuliahan.id,
      user.id,
    );

    if (!canManage) {
      throw new ForbiddenException('Anda tidak memiliki akses ke quiz ini');
    }

    return this.prisma.quiz.update({
      where: { id: dto.entityId },
      data: { isHidden: dto.isHidden },
    });
  }

  async getClassSetup(kelasPerkuliahanId: number, user: { id: number; role: Role }) {
    if (user.role !== Role.DOSEN) {
      throw new ForbiddenException('Hanya dosen yang dapat melihat pengaturan kelas');
    }

    await this.validateLecturerClassOwnership(kelasPerkuliahanId, user.id);

    return this.prisma.elearningClassConfig.findUnique({
      where: { kelasPerkuliahanId },
      include: {
        sourceKelasPerkuliahan: {
          include: {
            mataKuliah: {
              select: {
                id: true,
                kode: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }
}
