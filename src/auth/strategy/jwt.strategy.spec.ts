import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('secret'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should return full user data from payload', async () => {
    const payload = {
      sub: 1,
      nim: '12345',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'MAHASISWA',
    };

    const result = await strategy.validate(payload);

    expect(result).toEqual({
      id: 1,
      nim: '12345',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'MAHASISWA',
    });
  });
});