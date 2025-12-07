import { Test, TestingModule } from '@nestjs/testing';
import { AcademicController } from './academic.controller';
import { AcademicService } from './academic.service';
import { Response } from 'express';

describe('AcademicController', () => {
  let controller: AcademicController;
  let service: AcademicService;

  const mockAcademicService = {
    getKhs: jest.fn(),
    generateKhsHtml: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AcademicController],
      providers: [
        { provide: AcademicService, useValue: mockAcademicService },
      ],
    }).compile();

    controller = module.get<AcademicController>(AcademicController);
    service = module.get<AcademicService>(AcademicService);
  });

  describe('getKhs', () => {
    it('should return KHS data', async () => {
      const query = { semester: '2024/2025 Ganjil' };
      const req = { user: { userId: 1 } }; // Mock Request object
      const expectedResult = { ips: 3.5, mahasiswa: {} };

      mockAcademicService.getKhs.mockResolvedValue(expectedResult);

      // Kita hardcode studentId=1 di controller sementara, jadi test mengikuti itu
      const result = await controller.getKhs(query, req);
      
      expect(service.getKhs).toHaveBeenCalledWith(1, query.semester);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('downloadKhs', () => {
    it('should send HTML response', async () => {
      const query = { semester: '2024/2025 Ganjil' };
      const req = { user: { userId: 1 } };
      const mockHtml = '<html>Report</html>';
      
      // Mock Response Express
      const res = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      mockAcademicService.generateKhsHtml.mockResolvedValue(mockHtml);

      await controller.downloadKhs(query, req, res);

      expect(service.generateKhsHtml).toHaveBeenCalledWith(1, query.semester);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
      expect(res.send).toHaveBeenCalledWith(mockHtml);
    });
  });
});