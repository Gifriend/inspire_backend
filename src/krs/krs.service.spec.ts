import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KrsService } from './krs.service';
import { KRS, StatusKRS } from './entites/krs.entity';
import { AddClassDto } from './dto/add-class.dto';
import { SubmitKrsDto } from './dto/submit-krs.dto';
import { User } from '../auth/entities/user.entity';

describe('KrsService', () => {
  let service: KrsService;
  let krsRepo: Repository<KRS>;
  let userRepo: Repository<User>;

  const mockKrsRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KrsService,
        { provide: getRepositoryToken(KRS), useValue: mockKrsRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile();

    service = module.get<KrsService>(KrsService);
    krsRepo = module.get<Repository<KRS>>(getRepositoryToken(KRS));
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addClassToKrs', () => {
    it('should add class to draft KRS successfully', async () => {
      const mahasiswaId = 1;
      const dto: AddClassDto = {
        kelasId: 1,
        // kodeMataKuliah: 'MK001',
        // namaMataKuliah: 'Test',
        // sks: 3,
        // dosen: 'Test',
        // kapasitas: 30,
        semester: '2024/2025 Ganjil',
      };

      mockUserRepo.findOne.mockResolvedValue({ id: 1, role: 'MAHASISWA' });
      mockKrsRepo.findOne.mockResolvedValue(null);
      const newKrs = {
        id: 1,
        status: StatusKRS.DRAFT,
        totalSKS: 0,
        kelasTerpilih: [],
        mahasiswaId,
      };
      mockKrsRepo.create.mockReturnValue(newKrs);
      mockKrsRepo.save
        .mockResolvedValueOnce(newKrs) // create
        .mockResolvedValueOnce({
          ...newKrs,
          totalSKS: 3,
          kelasTerpilih: [dto],
        }); // add

      const result = await service.addClassToKrs(mahasiswaId, dto);
      expect(result.totalSKS).toBe(3);
      // expect(result.kelasTerpilih).toHaveLength(1);
    });
  });

  describe('submitKrs', () => {
    it('should submit draft KRS successfully', async () => {
      const dto: SubmitKrsDto = { semester: '2024/2025 Ganjil' };
      mockUserRepo.findOne.mockResolvedValue({ id: 1, role: 'MAHASISWA' });
      const krs = {
        id: 1,
        status: StatusKRS.DRAFT,
        kelasTerpilih: [{ sks: 3 }],
      };
      mockKrsRepo.findOne.mockResolvedValue(krs);
      mockKrsRepo.save.mockResolvedValue({
        ...krs,
        status: StatusKRS.DIAJUKAN,
      });

      const result = await service.submitKrs(1, dto);
      expect(result.status).toBe(StatusKRS.DIAJUKAN);
    });
  });

  describe('approveKrs', () => {
    it('should approve KRS successfully', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 2, role: 'DOSEN' });
      const krs = { id: 1, status: StatusKRS.DIAJUKAN };
      mockKrsRepo.findOne.mockResolvedValue(krs);
      mockKrsRepo.save.mockResolvedValue({
        ...krs,
        status: StatusKRS.DISETUJUI,
      });

      const result = await service.approveKrs(2, 1, 'OK');
      expect(result.status).toBe(StatusKRS.DISETUJUI);
    });
  });

  describe('rejectKrs', () => {
    it('should reject KRS successfully', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 2, role: 'DOSEN' });
      const krs = { id: 1, status: StatusKRS.DIAJUKAN };
      mockKrsRepo.findOne.mockResolvedValue(krs);
      mockKrsRepo.save.mockResolvedValue({ ...krs, status: StatusKRS.DITOLAK });

      const result = await service.rejectKrs(2, 1, 'Reason');
      expect(result.status).toBe(StatusKRS.DITOLAK);
    });
  });

  describe('cancelKrs', () => {
    it('should cancel approved KRS back to DRAFT successfully', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 2, role: 'DOSEN' });
      const krs = { id: 1, status: StatusKRS.DISETUJUI };
      mockKrsRepo.findOne.mockResolvedValue(krs);
      mockKrsRepo.save.mockResolvedValue({
        ...krs,
        status: StatusKRS.DRAFT, // change to draft
        catatanDosen: 'Cancel reason',
        tanggalPersetujuan: null,
      });

      const result = await service.cancelKrs(2, 1, 'Cancel reason');
      expect(result.status).toBe(StatusKRS.DRAFT); //  TEST DRAFT
      expect(result.catatanDosen).toBe('Cancel reason');
      expect(result.tanggalPersetujuan).toBeNull();
    });
  });
});
