import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PollService } from './poll.service';
import { TCurrentUserType } from '../auth/types/user.type';
import { CreatePollDto } from './dto/create-poll.dto';

describe('PollService', () => {
  let service: PollService;
  let configService: ConfigService;

  const SSO_URL = process.env.SSO_URL || 'http://sso-service';
  const SERVICE_KEY = process.env.ODIN_SERVICE_KEY || 'test-service-key';

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'SSO_URL') return SSO_URL;
      if (key === 'ODIN_SERVICE_KEY') return SERVICE_KEY;
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PollService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PollService>(PollService);
    configService = module.get<ConfigService>(ConfigService);

    // Mock global fetch
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { id: 'poll-123' } }),
      }),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should use x-service-key header and internal path for creation', async () => {
    const createPollDto: CreatePollDto = {
      question: 'Test Poll',
      options: ['Option 1', 'Option 2'],
    } as any;

    const user: TCurrentUserType = {
      sub: 'user-123',
      name: 'John Doe',
      email: 'john@example.com',
    };

    await service.createPoll(createPollDto, user, []);

    expect(global.fetch).toHaveBeenCalledWith(
      `${SSO_URL}/api/internal/polls`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-service-key': SERVICE_KEY,
        }),
      }),
    );

    const callHeaders = (global.fetch as jest.Mock).mock.calls[0][1].headers;
    expect(callHeaders).not.toHaveProperty('x-api-key');
    expect(callHeaders).not.toHaveProperty('Authorization');
  });

  it('should use internal path for findAll', async () => {
    await service.findAll({ limit: 10 });

    expect(global.fetch).toHaveBeenCalledWith(
      `${SSO_URL}/api/internal/polls?limit=10`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-service-key': SERVICE_KEY,
        }),
      }),
    );
  });
});
