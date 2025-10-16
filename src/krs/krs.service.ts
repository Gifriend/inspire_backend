import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { KRS, StatusKRS } from './entites/krs.entity';
import { AddClassDto } from './dto/add-class.dto';
import { SubmitKrsDto } from './dto/submit-krs.dto';

@Injectable()
export class KrsService {
  constructor(
    @InjectRepository(KRS)
    private krsRepository: Repository<KRS>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async getOrCreateKrs(mahasiswaId: number, semester: string): Promise<KRS> {
    let krs = await this.krsRepository.findOne({
      where: { mahasiswaId, semester },
    });

    if (!krs) {
      krs = this.krsRepository.create({
        semester,
        status: StatusKRS.DRAFT,
        totalSKS: 0,
        mahasiswaId,
        kelasTerpilih: [],
      });
      krs = await this.krsRepository.save(krs); //  Return saved
    }

    return krs;
  }

  async addClassToKrs(mahasiswaId: number, dto: AddClassDto): Promise<KRS> {
    const user = await this.userRepository.findOne({
      where: { id: mahasiswaId },
    });
    if (!user || user.role !== 'MAHASISWA') {
      throw new ForbiddenException('Hanya mahasiswa yang bisa menambah kelas');
    }

    const krs = await this.getOrCreateKrs(mahasiswaId, dto.semester);

    if (krs.status !== StatusKRS.DRAFT) {

      throw new BadRequestException(
        'KRS sudah diajukan, tidak bisa tambah kelas',
      );
    }

    // check if class already added
    const alreadyExists = krs.kelasTerpilih?.some(
      (kelas) => kelas.kelasId === dto.kelasId, 
    );
    if (alreadyExists) {
      throw new BadRequestException('Kelas sudah terdaftar');
    }

    // check class full (simulation)
    const enrolledCount = Math.floor(Math.random() * dto.kapasitas);
    if (enrolledCount >= dto.kapasitas) {

      throw new BadRequestException('Kelas sudah penuh');
    }

    // Tambah kelas ke array
    krs.kelasTerpilih = [
      ...(krs.kelasTerpilih || []),
      {
        kelasId: dto.kelasId, 
        kodeMataKuliah: dto.kodeMataKuliah, 
        namaMataKuliah: dto.namaMataKuliah,
        sks: dto.sks, 
        dosen: dto.dosen, 
        kapasitas: dto.kapasitas, 
      },
    ];
    krs.totalSKS += dto.sks;

    await this.krsRepository.save(krs);
    return krs;
  }

  async submitKrs(mahasiswaId: number, dto: SubmitKrsDto): Promise<KRS> {
    const user = await this.userRepository.findOne({
      where: { id: mahasiswaId },
    });
    if (!user || user.role !== 'MAHASISWA') {
      throw new ForbiddenException('Hanya mahasiswa yang bisa submit KRS');
    }

    const krs = await this.getOrCreateKrs(mahasiswaId, dto.semester);

    if (krs.status !== StatusKRS.DRAFT) {

      throw new BadRequestException('KRS sudah diajukan');
    }

    if (!krs.kelasTerpilih || krs.kelasTerpilih.length === 0) {
      throw new BadRequestException('Tambahkan minimal 1 mata kuliah');
    }

    krs.status = StatusKRS.DIAJUKAN; 
    krs.tanggalPengajuan = new Date();
    await this.krsRepository.save(krs);

    return krs;
  }

  async getKrs(mahasiswaId: number, semester: string): Promise<KRS | null> {
    //  Allow null
    const user = await this.userRepository.findOne({
      where: { id: mahasiswaId },
    });
    if (!user || user.role !== 'MAHASISWA') {
      throw new ForbiddenException('Hanya mahasiswa yang bisa lihat KRS');
    }

    return this.krsRepository.findOne({
      where: { mahasiswaId, semester },
    }); 
  }

  async approveKrs(
    dosenId: number,
    krsId: number,
    catatan?: string,
  ): Promise<KRS> {
    const dosen = await this.userRepository.findOne({
      where: { id: dosenId },
    });
    if (!dosen || dosen.role !== 'DOSEN') {
      throw new ForbiddenException('Hanya dosen yang bisa approve');
    }

    const krs = await this.krsRepository.findOne({
      where: { id: krsId, status: StatusKRS.DIAJUKAN }, 
    });

    if (!krs) {
      throw new BadRequestException(
        'KRS tidak ditemukan atau bukan status DIAJUKAN',
      );
    }

    krs.status = StatusKRS.DISETUJUI;
    krs.tanggalPersetujuan = new Date();
    krs.catatanDosen = catatan || 'Disetujui';
    await this.krsRepository.save(krs);

    return krs;
  }

  async rejectKrs(
    dosenId: number,
    krsId: number,
    catatan: string,
  ): Promise<KRS> {
    const dosen = await this.userRepository.findOne({
      where: { id: dosenId },
    });
    if (!dosen || dosen.role !== 'DOSEN') {
      throw new ForbiddenException('Hanya dosen yang bisa reject');
    }

    const krs = await this.krsRepository.findOne({
      where: { id: krsId, status: StatusKRS.DIAJUKAN },
    });

    if (!krs) {
      throw new BadRequestException(
        'KRS tidak ditemukan atau bukan status DIAJUKAN',
      );
    }

    krs.status = StatusKRS.DITOLAK;
    krs.catatanDosen = catatan;
    await this.krsRepository.save(krs);

    return krs;
  }

  async cancelKrs(
    dosenId: number,
    krsId: number,
    catatan: string,
  ): Promise<KRS> {
    const dosen = await this.userRepository.findOne({
      where: { id: dosenId },
    });
    if (!dosen || dosen.role !== 'DOSEN') {
      throw new ForbiddenException('Hanya dosen yang bisa membatalkan KRS');
    }

    const krs = await this.krsRepository.findOne({
      where: { id: krsId, status: StatusKRS.DISETUJUI },
    });

    if (!krs) {
      throw new BadRequestException(
        'KRS tidak ditemukan atau bukan status DISETUJUI',
      );
    }

    krs.status = StatusKRS.DRAFT; //  KEMBALI DRAFT
    krs.catatanDosen = catatan;
    krs.tanggalPersetujuan = null; // Reset approval
    await this.krsRepository.save(krs);

    return krs;
  }
}
