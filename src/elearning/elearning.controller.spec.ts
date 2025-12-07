import { Test, TestingModule } from '@nestjs/testing';
import { ElearningController } from './elearning.controller';
import { ElearningService } from './elearning.service';
import { 
  CreateSessionDto, 
  CreateMaterialDto, 
  CreateAssignmentDto, 
  SubmitAssignmentDto, 
  CreateQuizDto 
} from './dto/elearning.dto';

describe('ElearningController', () => {
  let controller: ElearningController;
  let service: ElearningService;

  // Mock Service agar tidak menyentuh database
  const mockElearningService = {
    createSession: jest.fn(),
    createMaterial: jest.fn(),
    createAssignment: jest.fn(),
    submitAssignment: jest.fn(),
    createQuiz: jest.fn(),
    getCourseContent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ElearningController],
      providers: [
        {
          provide: ElearningService,
          useValue: mockElearningService,
        },
      ],
    }).compile();

    controller = module.get<ElearningController>(ElearningController);
    service = module.get<ElearningService>(ElearningService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createSession', () => {
    it('should call service.createSession with correct dto', async () => {
      const dto: CreateSessionDto = {
        title: 'Session 1',
        weekNumber: 1,
        kelasPerkuliahanId: 1,
      };
      
      mockElearningService.createSession.mockResolvedValue({ id: '1', ...dto });

      const result = await controller.createSession(dto);

      expect(service.createSession).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: '1', ...dto });
    });
  });

  describe('createMaterial', () => {
    it('should call service.createMaterial', async () => {
      const dto: CreateMaterialDto = {
        title: 'Slide PDF',
        type: 'FILE',
        fileUrl: 'http://test.com/file.pdf',
        sessionId: 'session-1',
      };

      await controller.createMaterial(dto);
      expect(service.createMaterial).toHaveBeenCalledWith(dto);
    });
  });

  describe('submitAssignment', () => {
    it('should call service.submitAssignment', async () => {
      const dto: SubmitAssignmentDto = {
        assignmentId: 'assign-1',
        studentId: 123,
        textContent: 'Jawaban saya',
      };

      await controller.submitAssignment(dto);
      expect(service.submitAssignment).toHaveBeenCalledWith(dto);
    });
  });

  describe('getCourseContent', () => {
    it('should return course content by class id', async () => {
      const kelasId = '10';
      const mockContent = [{ id: 'session-1', title: 'Intro' }];
      mockElearningService.getCourseContent.mockResolvedValue(mockContent);

      const result = await controller.getCourseContent(kelasId);
      expect(service.getCourseContent).toHaveBeenCalledWith(10); // Check number conversion
      expect(result).toEqual(mockContent);
    });
  });
});