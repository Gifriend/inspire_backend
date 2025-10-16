import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Role, Gender, Status } from './entities/user.entity';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    login: jest.fn(),
    refresh: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  // ✅ FIX 1: HANYA TOKEN (sesuai requirement terbaru)
  const loginResponse = {
    access_token: 'access_token',
    refresh_token: 'refresh_token',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should login successfully - ONLY TOKENS', async () => {
    mockAuthService.login.mockResolvedValue(loginResponse);
    const result = await controller.login({ nim: '12345', password: '123' });
    expect(result).toEqual(loginResponse);
    expect(mockAuthService.login).toHaveBeenCalledWith({ nim: '12345', password: '123' });
  });

  it('should refresh token successfully', async () => {
    const refreshResponse = { access_token: 'new_token', refresh_token: 'old_refresh' };
    mockAuthService.refresh.mockResolvedValue(refreshResponse);
    
    const result = await controller.refresh({ refreshToken: 'old_refresh' });
    expect(result).toEqual(refreshResponse);
  });

  // ✅ FIX 2: FULL CreateUserDto sesuai schema
  it('should register user', async () => {
    const user = { id: 1, name: 'New User' };
    mockAuthService.create.mockResolvedValue(user);
    
    const createUserDto: CreateUserDto = {
      name: 'New User',
      email: 'new@test.com',
      password: '123',
      role: Role.DOSEN,
      gender: Gender.LAKI_LAKI,
      status: Status.AKTIF,
      fakultasId: 1,
      nim: '12345', // Optional
    };
    
    const result = await controller.register(createUserDto);
    expect(result).toEqual(user);
  });

  it('should return all users', async () => {
    const users = [{ id: 1 }];
    mockAuthService.findAll.mockResolvedValue(users);
    
    const result = await controller.findAll();
    expect(result).toEqual(users);
  });
}); 