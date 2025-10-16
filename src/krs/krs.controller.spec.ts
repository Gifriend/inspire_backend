import { Test, TestingModule } from '@nestjs/testing';
import { KrsController } from './krs.controller';
import { KrsService } from './krs.service';
import { ForbiddenException } from '@nestjs/common';
import { StatusKRS } from './entites/krs.entity'; 

describe('KrsController', () => {
  let controller: KrsController;
  let service: KrsService;

  const mockService = {
    addClassToKrs: jest.fn(),
    submitKrs: jest.fn(),
    getKrs: jest.fn(),
    approveKrs: jest.fn(),
    rejectKrs: jest.fn(),
    cancelKrs: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KrsController],
      providers: [{ provide: KrsService, useValue: mockService }],
    }).compile();

    controller = module.get<KrsController>(KrsController);
    service = module.get<KrsService>(KrsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addClass', () => {
    it('should call addClassToKrs successfully', async () => {
      const req = { user: { id: 1, role: 'MAHASISWA' } } as any;
      const dto = { kelasId: 1, semester: '2024/2025 Ganjil' } as any;

      mockService.addClassToKrs.mockResolvedValue({ status: StatusKRS.DRAFT });

      const result = await controller.addClass(req, dto);
      expect(mockService.addClassToKrs).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual({ status: StatusKRS.DRAFT });
    });
  });

  describe('submitKrs', () => {
    it('should call submitKrs successfully', async () => {
      const req = { user: { id: 1, role: 'MAHASISWA' } } as any;
      const dto = { semester: '2024/2025 Ganjil' } as any;

      mockService.submitKrs.mockResolvedValue({ status: StatusKRS.DIAJUKAN });

      const result = await controller.submitKrs(req, dto);
      expect(mockService.submitKrs).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual({ status: StatusKRS.DIAJUKAN });
    });
  });

  describe('getKrs', () => {
    it('should call getKrs successfully', async () => {
      const req = { user: { id: 1, role: 'MAHASISWA' } } as any;
      const semester = '2024/2025 Ganjil';

      mockService.getKrs.mockResolvedValue({ status: StatusKRS.DRAFT });

      const result = await controller.getKrs(req, semester);
      expect(mockService.getKrs).toHaveBeenCalledWith(1, semester);
      expect(result).toEqual({ status: StatusKRS.DRAFT });
    });
  });

  describe('approveKrs', () => {
    it('should call approveKrs if dosen', async () => {
      const req = { user: { id: 2, role: 'DOSEN' } } as any;
      const krsId = 1;
      const catatan = 'OK';

      mockService.approveKrs.mockResolvedValue({ status: StatusKRS.DISETUJUI });

      const result = await controller.approveKrs(req, krsId, catatan);
      expect(mockService.approveKrs).toHaveBeenCalledWith(2, 1, 'OK');
      expect(result).toEqual({ status: StatusKRS.DISETUJUI });
    });

    it('should throw ForbiddenException if not dosen', async () => {
      const req = { user: { id: 2, role: 'MAHASISWA' } } as any;

      await expect(controller.approveKrs(req, 1, 'OK')).rejects.toThrow(ForbiddenException);
      expect(mockService.approveKrs).not.toHaveBeenCalled();
    });
  });

  describe('rejectKrs', () => {
    it('should call rejectKrs if dosen', async () => {
      const req = { user: { id: 2, role: 'DOSEN' } } as any;
      const krsId = 1;
      const catatan = 'Rejected';

      mockService.rejectKrs.mockResolvedValue({ status: StatusKRS.DITOLAK });

      const result = await controller.rejectKrs(req, krsId, catatan);
      expect(mockService.rejectKrs).toHaveBeenCalledWith(2, 1, 'Rejected');
      expect(result).toEqual({ status: StatusKRS.DITOLAK });
    });

    it('should throw ForbiddenException if not dosen', async () => {
      const req = { user: { id: 2, role: 'MAHASISWA' } } as any;

      await expect(controller.rejectKrs(req, 1, 'Reason')).rejects.toThrow(ForbiddenException);
      expect(mockService.rejectKrs).not.toHaveBeenCalled();
    });
  });

  describe('cancelKrs', () => {
    it('should call cancelKrs if dosen', async () => {
      const req = { user: { id: 2, role: 'DOSEN' } } as any;
      const krsId = 1;
      const catatan = 'Cancel reason';

      mockService.cancelKrs.mockResolvedValue({ status: StatusKRS.DRAFT });

      const result = await controller.cancelKrs(req, krsId, catatan);
      expect(mockService.cancelKrs).toHaveBeenCalledWith(2, 1, 'Cancel reason');
      expect(result).toEqual({ status: StatusKRS.DRAFT });
    });

    it('should throw ForbiddenException if not dosen', async () => {
      const req = { user: { id: 2, role: 'MAHASISWA' } } as any;

      await expect(controller.cancelKrs(req, 1, 'Reason')).rejects.toThrow(ForbiddenException);
      expect(mockService.cancelKrs).not.toHaveBeenCalled();
    });
  });
});