import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { Gender, Role, Status, User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let jwtService: JwtService;

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockUser = {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    nim: '12345',
    password: '$2b$10$...',
    role: 'MAHASISWA',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should login successfully with NIM - ONLY TOKENS', async () => {
    const loginDto: LoginDto = { nim: '12345', password: 'password123' };
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    mockUserRepository.findOne.mockResolvedValue({ ...mockUser, password: hashedPassword });
    mockJwtService.sign
      .mockReturnValueOnce('access_token')
      .mockReturnValueOnce('refresh_token');

    const result = await service.login(loginDto);

    expect(mockUserRepository.findOne).toHaveBeenCalledWith({ nim: '12345' });
    expect(bcrypt.compare).toHaveBeenCalledWith('password123', hashedPassword);
    
    // ✅ FIX 3: HANYA TOKEN - NO USER!
    expect(result).toEqual({
      access_token: 'access_token',
      refresh_token: 'refresh_token',
    });
  });

    it('should throw UnauthorizedException for wrong NIM', async () => {
      const loginDto: LoginDto = { nim: '99999', password: 'wrong' };
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow('NIM atau password salah');
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const loginDto: LoginDto = { nim: '12345', password: 'wrong' };
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.login(loginDto)).rejects.toThrow('NIM atau password salah');
    });
  });

  describe('refresh', () => {
    it('should refresh token successfully', async () => {
      const refreshTokenDto = { refreshToken: 'valid_refresh_token' };
      mockJwtService.verify.mockReturnValue({ sub: 1 });
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('new_access_token');

      const result = await service.refresh(refreshTokenDto);

      expect(result).toEqual({
        access_token: 'new_access_token',
        refresh_token: 'valid_refresh_token',
      });
    });

    it('should throw for invalid refresh token', async () => {
      const refreshTokenDto = { refreshToken: 'invalid' };
      mockJwtService.verify.mockImplementation(() => { throw new Error(); });

      await expect(service.refresh(refreshTokenDto)).rejects.toThrow('Refresh token tidak valid');
    });
  });

  describe('create', () => {
    it('should create user successfully', async () => {
      const createUserDto: CreateUserDto = {
        name: 'Jane Doe',
        nim: '67890',
        email: 'jane@example.com',
        password: 'password123',
        role: Role.DOSEN,
        gender: Gender.LAKI_LAKI,
        status: Status.AKTIF,
        fakultasId: 1,
      };

      const hashedPassword = await bcrypt.hash('password123', 10);
      mockUserRepository.create.mockReturnValue({ 
        ...createUserDto, 
        password: hashedPassword 
      });
      mockUserRepository.save.mockResolvedValue({ 
        id: 2, 
        ...createUserDto, 
        password: hashedPassword 
      });

      const result = await service.create(createUserDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(result.id).toBe(2);
      expect(result.nim).toBe('67890'); // ✅ NIM TERDAFTAR
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      const users = [mockUser];
      mockUserRepository.find.mockResolvedValue(users);

      const result = await service.findAll();
      expect(result).toEqual(users);
    });
  });

  describe('findOne', () => {
    it('should return user by id', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      const result = await service.findOne(1);
      expect(result).toEqual(mockUser);
    });
  });

  describe('update', () => {
    it('should update user without password', async () => {
      const updateDto = { name: 'Updated Name' };
      mockUserRepository.update.mockResolvedValue(undefined);
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, name: 'Updated Name' });

      const result = await service.update(1, updateDto);
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Updated Name');
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove user', async () => {
      mockUserRepository.delete.mockResolvedValue(undefined);
      await service.remove(1);
      expect(mockUserRepository.delete).toHaveBeenCalledWith(1);
    });
  });
});